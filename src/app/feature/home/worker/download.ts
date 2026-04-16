/* eslint-disable jsdoc/require-jsdoc */

import {RecordingManifest} from '../model/recording';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface TribeInfo {
  id: string;
  color: string;
}

interface DownloadRequest {
  type: 'download';
  opts: {csv: boolean; json: boolean; frames: boolean; mp4: boolean; png: boolean; fps: number};
  snapshot: {generation: number; cols: number; rows: number; grid: Uint32Array | number[]};
  recording: {manifest: RecordingManifest; cols: number; rows: number} | null;
  tribes: TribeInfo[];
  rules: unknown;
  metricsHistory: MetricEntry[];
}

interface MetricEntry {
  type: 'metrics';
  generation: number;
  population: Record<string, number>;
  shannonEntropy: number;
  simpsonIndex: number;
  boundaryLength: number;
  frontierLength?: Record<string, number>;
  extinctionTime?: Record<string, number | null>;
  fps?: number;
}

type WorkerInput = DownloadRequest;

// ---------------------------------------------------------------------------
//  CRC-32 (used by streaming ZIP)
// ---------------------------------------------------------------------------

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
//  Streaming ZIP writer
//  Writes local file entries immediately into a growing list of byte chunks.
//  Keeps only a compact central-directory record per entry (no file data).
//  Finalizes by appending the central directory + EOCD and merging once.
// ---------------------------------------------------------------------------

interface CentralDirRecord {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  localOffset: number;
}

class StreamingZip {
  private chunks: Uint8Array[] = [];

  private offset = 0;

  private records: CentralDirRecord[] = [];

  addEntry(path: string, data: Uint8Array): void {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(path);
    const entryCrc = crc32(data);
    const localOffset = this.offset;

    // Local file header: 30 bytes + name + data
    const headerSize = 30 + nameBytes.length;
    const header = new Uint8Array(headerSize);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);
    hv.setUint16(6, 0, true);
    hv.setUint16(8, 0, true);
    hv.setUint16(10, 0, true);
    hv.setUint16(12, 0, true);
    hv.setUint32(14, entryCrc, true);
    hv.setUint32(18, data.length, true);
    hv.setUint32(22, data.length, true);
    hv.setUint16(26, nameBytes.length, true);
    hv.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    this.chunks.push(header);
    this.chunks.push(data);
    this.offset += headerSize + data.length;

    this.records.push({
      nameBytes,
      crc: entryCrc,
      size: data.length,
      localOffset
    });
  }

  finalize(): ArrayBuffer {
    const centralDirOffset = this.offset;
    let centralDirSize = 0;

    for (const rec of this.records) {
      const entry = new Uint8Array(46 + rec.nameBytes.length);
      const ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true);
      ev.setUint16(4, 20, true);
      ev.setUint16(6, 20, true);
      ev.setUint16(8, 0, true);
      ev.setUint16(10, 0, true);
      ev.setUint16(12, 0, true);
      ev.setUint16(14, 0, true);
      ev.setUint32(16, rec.crc, true);
      ev.setUint32(20, rec.size, true);
      ev.setUint32(24, rec.size, true);
      ev.setUint16(28, rec.nameBytes.length, true);
      ev.setUint16(30, 0, true);
      ev.setUint16(32, 0, true);
      ev.setUint16(34, 0, true);
      ev.setUint16(36, 0, true);
      ev.setUint32(38, 0, true);
      ev.setUint32(42, rec.localOffset, true);
      entry.set(rec.nameBytes, 46);

      this.chunks.push(entry);
      centralDirSize += entry.length;
    }

    // End of central directory
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, this.records.length, true);
    ev.setUint16(10, this.records.length, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);
    this.chunks.push(eocd);

    const totalSize = this.offset + centralDirSize + 22;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    this.chunks = [];
    this.records = [];
    return out.buffer;
  }

  get currentSize(): number {
    return this.offset;
  }

  get entryCount(): number {
    return this.records.length;
  }
}

// ---------------------------------------------------------------------------
//  Metrics computation
// ---------------------------------------------------------------------------

function computeFrameMetrics(
  frame: Uint8Array,
  frameCols: number,
  frameRows: number,
  tribeList: readonly TribeInfo[],
  deadId: string,
  generation: number
): MetricEntry {
  const total = frameCols * frameRows;
  const deadIdx = tribeList.findIndex(t => t.id === deadId);

  const counts = new Array<number>(tribeList.length).fill(0);
  for (let i = 0; i < total; i++) {
    counts[frame[i]!]!++;
  }
  const population: Record<string, number> = {};
  let totalAlive = 0;
  for (let t = 0; t < tribeList.length; t++) {
    population[tribeList[t]!.id] = counts[t]!;
    if (t !== deadIdx) {
      totalAlive += counts[t]!;
    }
  }

  let shannonEntropy = 0;
  let simpsonSum = 0;
  if (totalAlive > 0) {
    for (let t = 0; t < tribeList.length; t++) {
      if (t === deadIdx) {
        continue;
      }
      const p = counts[t]! / totalAlive;
      if (p > 0) {
        shannonEntropy -= p * Math.log2(p);
        simpsonSum += p * p;
      }
    }
  }

  let boundaryLength = 0;
  const frontierCounts = new Array<number>(tribeList.length).fill(0);
  for (let y = 0; y < frameRows; y++) {
    for (let x = 0; x < frameCols; x++) {
      const selfTribe = frame[y * frameCols + x]!;
      const right = frame[y * frameCols + ((x + 1) % frameCols)]!;
      if (right !== selfTribe) {
        boundaryLength++;
        frontierCounts[selfTribe]!++;
      }
      const bottom = frame[((y + 1) % frameRows) * frameCols + x]!;
      if (bottom !== selfTribe) {
        boundaryLength++;
        frontierCounts[selfTribe]!++;
      }
    }
  }

  const frontierLength: Record<string, number> = {};
  for (let t = 0; t < tribeList.length; t++) {
    if (t !== deadIdx) {
      frontierLength[tribeList[t]!.id] = frontierCounts[t]!;
    }
  }

  return {
    type: 'metrics',
    generation,
    population,
    shannonEntropy,
    simpsonIndex: 1 - simpsonSum,
    boundaryLength,
    frontierLength
  };
}

// ---------------------------------------------------------------------------
//  Media helpers
// ---------------------------------------------------------------------------

function computeMediaDimensions(cols: number, rows: number, evenRequired: boolean): {width: number; height: number; scale: number} {
  const MAX_DIM = 4096;
  const MIN_DIM = 480;
  const maxSide = Math.max(cols, rows);
  let scale: number;
  if (maxSide <= MIN_DIM) {
    scale = Math.max(1, Math.floor(MIN_DIM / maxSide));
  } else if (maxSide > MAX_DIM) {
    scale = MAX_DIM / maxSide;
  } else {
    scale = 1;
  }
  let w = Math.round(cols * scale);
  let h = Math.round(rows * scale);
  if (evenRequired) {
    w += w % 2;
    h += h % 2;
  }
  return {
    width: w,
    height: h,
    scale
  };
}

function buildColorMap(tribes: readonly TribeInfo[]): number[][] {
  return tribes.map(t => {
    const c = t.color;
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  });
}

function renderFrameToImageData(
  frame: Uint8Array,
  cols: number,
  rows: number,
  colorMap: number[][],
  imageData: ImageData,
  targetW: number,
  targetH: number,
  scale: number
): void {
  const pixels = imageData.data;
  for (let oy = 0; oy < targetH; oy++) {
    const sy = Math.min(Math.floor(oy / scale), rows - 1);
    for (let ox = 0; ox < targetW; ox++) {
      const sx = Math.min(Math.floor(ox / scale), cols - 1);
      const tribeIdx = frame[sy * cols + sx]!;
      const rgb = colorMap[tribeIdx] ?? [0, 0, 0];
      const pi = (oy * targetW + ox) * 4;
      pixels[pi] = rgb[0]!;
      pixels[pi + 1] = rgb[1]!;
      pixels[pi + 2] = rgb[2]!;
      pixels[pi + 3] = 255;
    }
  }
}

// ---------------------------------------------------------------------------
//  CSV builder
// ---------------------------------------------------------------------------

function buildCsvFromMetrics(metrics: MetricEntry[]): string {
  const popKeys = new Set<string>();
  const frontierKeys = new Set<string>();
  for (const m of metrics) {
    for (const k of Object.keys(m.population)) {
      popKeys.add(k);
    }
    if (m.frontierLength) {
      for (const k of Object.keys(m.frontierLength)) {
        frontierKeys.add(k);
      }
    }
  }
  const popCols = [...popKeys];
  const frCols = [...frontierKeys];
  const header = [
    'generation',
    ...popCols.map(k => `pop_${k}`),
    'shannon_entropy',
    'simpson_index',
    'boundary_length',
    ...frCols.map(k => `frontier_${k}`)
  ].join(',');
  const rows = metrics.map(m => [
    m.generation,
    ...popCols.map(k => m.population[k] ?? 0),
    m.shannonEntropy,
    m.simpsonIndex,
    m.boundaryLength,
    ...frCols.map(k => m.frontierLength?.[k] ?? 0)
  ].join(','));
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
//  MP4 generation
// ---------------------------------------------------------------------------

const AVC_CODECS = [
  'avc1.64003D',
  'avc1.64003C',
  'avc1.640034',
  'avc1.640033',
  'avc1.640032',
  'avc1.640029',
  'avc1.640028',
  'avc1.64001F',
  'avc1.4D0029',
  'avc1.4D0028',
  'avc1.42001F'
];

async function findVideoConfig(
  targetW: number,
  targetH: number,
  bitrate: number
): Promise<{config: VideoEncoderConfig; width: number; height: number} | null> {
  for (const codec of AVC_CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported({
        codec,
        width: targetW,
        height: targetH,
        bitrate
      });
      if (r.supported) {
        return {
          config: r.config!,
          width: targetW,
          height: targetH
        };
      }
    } catch { /* Unsupported, try next */ }
  }

  for (let div = 2; div <= 16; div++) {
    let w = Math.floor(targetW / div);
    let h = Math.floor(targetH / div);
    w += w % 2;
    h += h % 2;
    if (w < 16 || h < 16) {
      break;
    }
    for (const codec of AVC_CODECS) {
      try {
        const r = await VideoEncoder.isConfigSupported({
          codec,
          width: w,
          height: h,
          bitrate
        });
        if (r.supported) {
          return {
            config: r.config!,
            width: w,
            height: h
          };
        }
      } catch { /* Continue */ }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
//  Streaming MP4 encoder
// ---------------------------------------------------------------------------

interface Mp4StreamEncoder {
  encodeFrame(frame: Uint8Array): void;
  finalize(): Promise<ArrayBuffer | null>;
}

async function createMp4StreamEncoder(
  cols: number,
  rows: number,
  tribes: TribeInfo[],
  fps: number,
  sharedImageData: ImageData
): Promise<Mp4StreamEncoder | null> {
  const {Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket} = await import('mediabunny');

  const {width: idealW, height: idealH} = computeMediaDimensions(cols, rows, true);
  const found = await findVideoConfig(idealW, idealH, 2_000_000);
  if (!found) {
    return null;
  }

  const {config, width: vw, height: vh} = found;
  const renderScale = vw / cols;

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({fastStart: 'in-memory'}),
    target
  });

  const videoSource = new EncodedVideoPacketSource('avc');
  output.addVideoTrack(videoSource, {frameRate: fps});
  await output.start();

  const addPromises: Promise<void>[] = [];
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      addPromises.push(videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta));
    },
    error: e => console.error('VideoEncoder error', e)
  });

  encoder.configure(config);

  const colorMap = buildColorMap(tribes);
  const frameDuration = 1_000_000 / fps;

  const offscreen = new OffscreenCanvas(vw, vh);
  const ctx = offscreen.getContext('2d')!;

  // Reuse shared ImageData if dimensions match, otherwise create one for MP4.
  let mp4ImageData: ImageData;
  if (sharedImageData.width === vw && sharedImageData.height === vh) {
    mp4ImageData = sharedImageData;
  } else {
    mp4ImageData = new ImageData(vw, vh);
  }

  let frameIndex = 0;

  return {
    encodeFrame(frame: Uint8Array): void {
      renderFrameToImageData(frame, cols, rows, colorMap, mp4ImageData, vw, vh, renderScale);
      ctx.putImageData(mp4ImageData, 0, 0);
      const videoFrame = new VideoFrame(offscreen, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration
      });
      encoder.encode(videoFrame);
      videoFrame.close();
      frameIndex++;
    },
    async finalize(): Promise<ArrayBuffer | null> {
      await encoder.flush();
      encoder.close();
      await Promise.all(addPromises);
      await output.finalize();
      return target.buffer!;
    }
  };
}

// ---------------------------------------------------------------------------
//  Frame unpacking
// ---------------------------------------------------------------------------

function unpackGridToFrame(packed: Uint8Array, frameCols: number, frameRows: number): Uint8Array {
  const packedCols = Math.ceil(frameCols / 4);
  const words = new Uint32Array(packed.buffer, packed.byteOffset, packed.byteLength / 4);
  const frame = new Uint8Array(frameCols * frameRows);
  for (let y = 0; y < frameRows; y++) {
    for (let px = 0; px < packedCols; px++) {
      const word = words[y * packedCols + px]!;
      const baseX = px * 4;
      for (let b = 0; b < 4 && baseX + b < frameCols; b++) {
        frame[y * frameCols + baseX + b] = (word >> (b * 8)) & 0xFF;
      }
    }
  }
  return frame;
}

const OPFS_DIR = 'gol-recording';

// ---------------------------------------------------------------------------
//  Chunk decompression (deflate-raw via DecompressionStream API)
// ---------------------------------------------------------------------------

async function decompressChunk(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) {
    totalLen += c.byteLength;
  }
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.byteLength;
  }
  return result.buffer;
}

// ---------------------------------------------------------------------------
//  Preflight estimation
// ---------------------------------------------------------------------------

const PART_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

interface PartPlan {
  partIndex: number;
  chunkIndices: number[];
  frameCount: number;
  genStart: number;
  genEnd: number;
  estimatedSize: number;
}

function planParts(
  manifest: RecordingManifest,
  cols: number,
  rows: number,
  opts: {frames: boolean; png: boolean; mp4: boolean; csv: boolean; json: boolean}
): {totalFrames: number; partPlan: PartPlan[]} {
  let totalFrames = 0;
  for (const c of manifest.chunks) {
    totalFrames += c.blockCount;
  }

  const decodedFrameSize = cols * rows;
  const estimatedRawPerFrame = opts.frames ? decodedFrameSize : 0;
  const pngDims = computeMediaDimensions(cols, rows, false);
  const estimatedPngPerFrame = opts.png ? pngDims.width * pngDims.height * 4 : 0;
  const estimatedPerFrame = estimatedRawPerFrame + estimatedPngPerFrame;

  const partPlan: PartPlan[] = [];
  if (totalFrames === 0 || estimatedPerFrame === 0) {
    partPlan.push({
      partIndex: 0,
      chunkIndices: manifest.chunks.map((_, i) => i),
      frameCount: totalFrames,
      genStart: manifest.generationStart,
      genEnd: manifest.generationEnd,
      estimatedSize: 0
    });
  } else {
    let currentChunks: number[] = [];
    let currentFrames = 0;
    let currentGenStart = manifest.chunks[0]?.generationStart ?? 0;
    let currentSize = 0;

    for (let ci = 0; ci < manifest.chunks.length; ci++) {
      const chunk = manifest.chunks[ci]!;
      const chunkOutputSize = chunk.blockCount * estimatedPerFrame;

      if (currentFrames > 0 && currentSize + chunkOutputSize > PART_SIZE_LIMIT) {
        const lastChunk = manifest.chunks[currentChunks[currentChunks.length - 1]!]!;
        partPlan.push({
          partIndex: partPlan.length,
          chunkIndices: [...currentChunks],
          frameCount: currentFrames,
          genStart: currentGenStart,
          genEnd: lastChunk.generationEnd,
          estimatedSize: currentSize
        });
        currentChunks = [];
        currentFrames = 0;
        currentGenStart = chunk.generationStart;
        currentSize = 0;
      }

      currentChunks.push(ci);
      currentFrames += chunk.blockCount;
      currentSize += chunkOutputSize;
    }

    if (currentChunks.length > 0) {
      const lastChunk = manifest.chunks[currentChunks[currentChunks.length - 1]!]!;
      partPlan.push({
        partIndex: partPlan.length,
        chunkIndices: [...currentChunks],
        frameCount: currentFrames,
        genStart: currentGenStart,
        genEnd: lastChunk.generationEnd,
        estimatedSize: currentSize
      });
    }
  }

  return {totalFrames,
    partPlan};
}

// ---------------------------------------------------------------------------
//  State JSON builder — produces version-1 format (grid as JSON number array)
//  Compatible with the save-snapshot / load-state flow.
// ---------------------------------------------------------------------------

function buildStateData(
  generation: number,
  cols: number,
  rows: number,
  grid: Uint32Array | number[],
  tribes: TribeInfo[],
  rules: unknown,
  textEncoder: TextEncoder
): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    version: 1,
    generation,
    cols,
    rows,
    tribes: [...tribes],
    rules,
    grid: Array.from(grid)
  }, null, 2));
}

// ---------------------------------------------------------------------------
//  Main handler -- fully streaming, split-output aware
// ---------------------------------------------------------------------------

self.onmessage = async(e: MessageEvent<WorkerInput>) => {
  const msg = e.data;
  const {opts, snapshot, recording: rec, tribes, rules, metricsHistory} = msg;

  const textEncoder = new TextEncoder();

  const mainProgress = (percent: number, status = '') =>
    self.postMessage({
      type: 'progress',
      percent,
      status
    });
  const subProgress = (percent: number, status: string) =>
    self.postMessage({
      type: 'sub-progress',
      percent,
      status
    });

  const hasRecording = rec !== null && rec.manifest.chunks.length > 0;
  const needMetrics = opts.csv || opts.json;
  const needFrameOutput = opts.frames || opts.png;

  // -- Preflight ---------------------------------------------------------
  mainProgress(0, 'Preflight');
  subProgress(0, '');

  let totalFrames = 0;
  let partPlanList: PartPlan[] = [];

  if (hasRecording) {
    const result = planParts(rec.manifest, rec.cols, rec.rows, opts);
    totalFrames = result.totalFrames;
    partPlanList = result.partPlan;
  }

  // When there are multiple frame-data splits we produce an extra summary
  // Zip containing MP4 + metrics + states.  When there is only one split
  // (or no frame output) everything goes into a single zip.
  const multiPart = needFrameOutput && partPlanList.length > 1;
  const totalParts = partPlanList.length;

  // -- Allocate reusable ImageData for PNG rendering ---------------------
  let pngCanvas: OffscreenCanvas | null = null;
  let pngCtx: OffscreenCanvasRenderingContext2D | null = null;
  let pngImageData: ImageData | null = null;
  let pngW = 0;
  let pngH = 0;
  let pngScale = 1;
  let pngColorMap: number[][] = [];
  if (hasRecording && opts.png) {
    const dims = computeMediaDimensions(rec.cols, rec.rows, false);
    pngW = dims.width;
    pngH = dims.height;
    pngScale = dims.scale;
    pngColorMap = buildColorMap(tribes);
    pngCanvas = new OffscreenCanvas(pngW, pngH);
    pngCtx = pngCanvas.getContext('2d')!;
    pngImageData = new ImageData(pngW, pngH);
  }

  // -- MP4 encoder -------------------------------------------------------
  let mp4Encoder: Mp4StreamEncoder | null = null;
  if (hasRecording && opts.mp4) {
    mainProgress(1, 'Initializing MP4 encoder');
    try {
      const mp4ImgData = pngImageData ?? new ImageData(1, 1);
      mp4Encoder = await createMp4StreamEncoder(rec.cols, rec.rows, tribes, opts.fps, mp4ImgData);
    } catch {
      // VideoEncoder not supported -- skip MP4.
    }
  }

  // -- Metrics accumulator -----------------------------------------------
  const allMetrics: MetricEntry[] = [];
  const deadId = hasRecording ? tribes.find(t => t.id === 'dead')?.id ?? 'dead' : 'dead';

  // OPFS dir handle (opened once).
  let opfsDir: FileSystemDirectoryHandle | null = null;
  let packedCols = 0;
  let frameByteSz = 0;
  if (hasRecording) {
    packedCols = Math.ceil(rec.cols / 4);
    frameByteSz = packedCols * rec.rows * 4;
  }

  // Track first and last frame for state snapshots.
  let firstFrame: {gen: number; packed: Uint8Array} | null = null;
  let lastFrame: {gen: number; packed: Uint8Array} | null = null;

  // Progress budget: chunks 2-82%, metrics 85%, MP4 90%, finalize 95%.
  const PCT_CHUNKS_START = 2;
  const PCT_CHUNKS_END = 82;
  const PCT_METRICS = 85;
  const PCT_MP4 = 90;
  const PCT_FINALIZE = 95;

  // -- Process frame-data parts ------------------------------------------
  let chunksProcessed = 0;
  const totalChunks = hasRecording ? rec.manifest.chunks.length : 0;

  for (let pi = 0; pi < totalParts; pi++) {
    const part = partPlanList[pi]!;
    const partLabel = multiPart ? ` (part ${pi + 1}/${totalParts})` : '';
    const zip = new StreamingZip();

    // Raw-frames metadata.
    if (hasRecording && opts.frames && part.frameCount > 0) {
      const meta = JSON.stringify({
        cols: rec.cols,
        rows: rec.rows,
        startGeneration: part.genStart,
        frameCount: part.frameCount,
        format: {
          description: 'Each frame file is a flat binary array of unsigned 8-bit integers (one byte per cell). ' +
            'Cells are stored in row-major order: the first `cols` bytes represent row 0 (left to right), ' +
            'the next `cols` bytes represent row 1, and so on. ' +
            'Each byte is a 0-based index into the `tribes` array below. ' +
            'File size is always cols * rows bytes.',
          bytesPerCell: 1,
          cellOrder: 'row-major, top-to-bottom, left-to-right',
          valueType: 'uint8 (tribe index)'
        },
        tribes: tribes.map((t, i) => ({
          id: t.id,
          color: t.color,
          index: i
        }))
      }, null, 2);
      zip.addEntry('frames/metadata.json', textEncoder.encode(meta));
    }

    // -- Stream chunks for this part -------------------------------------
    if (hasRecording && part.chunkIndices.length > 0) {
      if (!opfsDir) {
        const root = await navigator.storage.getDirectory();
        opfsDir = await root.getDirectoryHandle(OPFS_DIR);
      }

      let partFrameIndex = 0;
      const partTotalFrames = part.frameCount;

      for (const ci of part.chunkIndices) {
        const chunkMeta = rec.manifest.chunks[ci]!;
        chunksProcessed++;
        const pct = PCT_CHUNKS_START + ((chunksProcessed / totalChunks) * (PCT_CHUNKS_END - PCT_CHUNKS_START));
        mainProgress(Math.round(pct), `Chunk ${chunksProcessed}/${totalChunks}`);

        subProgress(Math.round((partFrameIndex / partTotalFrames) * 100), `Loading chunk${partLabel}`);
        const fileHandle = await opfsDir.getFileHandle(chunkMeta.filename);
        const blob = await fileHandle.getFile();
        const storedData = await blob.arrayBuffer();
        const chunkData = new Uint8Array(
          chunkMeta.codec === 'deflate-raw' ? await decompressChunk(storedData) : storedData
        );

        for (let fi = 0; fi < chunkMeta.blockCount; fi++) {
          const frameGen = chunkMeta.generations[fi] ?? (chunkMeta.generationStart + fi);
          partFrameIndex++;

          if (fi % 50 === 0 || fi === chunkMeta.blockCount - 1) {
            subProgress(
              Math.round((partFrameIndex / partTotalFrames) * 100),
              `Processing frame gen ${frameGen}${partLabel}`
            );
          }

          const byteOff = fi * frameByteSz;
          const packed = chunkData.subarray(byteOff, byteOff + frameByteSz);
          const frame = unpackGridToFrame(packed, rec.cols, rec.rows);

          // Track first/last for state snapshots.
          if (!firstFrame || frameGen < firstFrame.gen) {
            firstFrame = {gen: frameGen,
              packed: new Uint8Array(packed)};
          }
          if (!lastFrame || frameGen > lastFrame.gen) {
            lastFrame = {gen: frameGen,
              packed: new Uint8Array(packed)};
          }

          if (needMetrics) {
            allMetrics.push(computeFrameMetrics(frame, rec.cols, rec.rows, tribes, deadId, frameGen));
          }

          if (opts.frames) {
            zip.addEntry(`frames/${frameGen}`, frame);
          }

          if (mp4Encoder) {
            mp4Encoder.encodeFrame(frame);
          }

          if (pngCanvas && pngCtx && pngImageData) {
            renderFrameToImageData(frame, rec.cols, rec.rows, pngColorMap, pngImageData, pngW, pngH, pngScale);
            pngCtx.putImageData(pngImageData, 0, 0);
            const pngBlob = await pngCanvas.convertToBlob({type: 'image/png'});
            const pngData = new Uint8Array(await pngBlob.arrayBuffer());
            zip.addEntry(`frames/${frameGen}.png`, pngData);
          }
        }
      }
    }

    // In single-part mode, append everything into the same zip below.
    // In multi-part mode, finalize and stream each frame-data zip now.
    if (multiPart) {
      subProgress(100, `Building archive part ${pi + 1}/${totalParts}`);
      const buf = zip.finalize();
      const filename = `gol-export-part${String(pi + 1).padStart(2, '0')}.zip`;
      self.postMessage({
        type: 'done-part',
        buffer: buf,
        filename
      }, [buf] as never);
      subProgress(100, `Sent part ${pi + 1}/${totalParts}`);
    } else {
      // Single-part: we'll add metrics/MP4/states to this zip after the loop.
      // Store zip reference for use after the loop.
      (self as any).__singleZip = zip;
    }
  }

  // -- Summary zip (MP4 + metrics + states) ------------------------------
  let summaryZip: StreamingZip;
  if (multiPart) {
    summaryZip = new StreamingZip();
  } else if ((self as any).__singleZip) {
    summaryZip = (self as any).__singleZip as StreamingZip;
    delete (self as any).__singleZip;
  } else {
    summaryZip = new StreamingZip();
  }

  // Sub-progress for the summary phase: 0-100% across states/metrics/MP4/finalize.
  // Use monotonically increasing milestones.
  const SUB_STATES = 20;
  const SUB_METRICS = 40;
  const SUB_MP4 = 80;
  const SUB_FINALIZE = 95;

  // States: first and last generation frames converted to state JSONs.
  if (hasRecording && firstFrame) {
    mainProgress(PCT_METRICS, 'Writing states');
    subProgress(SUB_STATES, 'Building first-gen state');

    const firstU32 = new Uint32Array(firstFrame.packed.buffer, firstFrame.packed.byteOffset, firstFrame.packed.byteLength / 4);
    summaryZip.addEntry(
      'state-first.json',
      buildStateData(firstFrame.gen, rec.cols, rec.rows, firstU32, tribes, rules, textEncoder)
    );

    if (lastFrame && lastFrame.gen !== firstFrame.gen) {
      subProgress(SUB_STATES + 10, 'Building last-gen state');
      const lastU32 = new Uint32Array(lastFrame.packed.buffer, lastFrame.packed.byteOffset, lastFrame.packed.byteLength / 4);
      summaryZip.addEntry(
        'state-last.json',
        buildStateData(lastFrame.gen, rec.cols, rec.rows, lastU32, tribes, rules, textEncoder)
      );
    }
  } else {
    // No recording -- save the current snapshot state.
    mainProgress(PCT_METRICS, 'Writing state');
    subProgress(SUB_STATES, 'Building snapshot state');
    summaryZip.addEntry(
      'state.json',
      buildStateData(snapshot.generation, snapshot.cols, snapshot.rows, snapshot.grid, tribes, rules, textEncoder)
    );
  }

  // Metrics.
  subProgress(SUB_METRICS, 'Writing metrics');
  if (needMetrics && allMetrics.length > 0) {
    const cleanMetrics = allMetrics.map(({type: _t, fps: _f, ...rest}) => rest);
    if (opts.json) {
      summaryZip.addEntry('metrics.json', textEncoder.encode(JSON.stringify(cleanMetrics, null, 2)));
    }
    if (opts.csv) {
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(allMetrics)));
    }
  } else if (needMetrics && metricsHistory.length > 0) {
    const cleanHistory = metricsHistory.map(({type: _t, fps: _f, ...rest}) => rest);
    if (opts.json) {
      summaryZip.addEntry('metrics.json', textEncoder.encode(JSON.stringify(cleanHistory, null, 2)));
    }
    if (opts.csv) {
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(metricsHistory)));
    }
  }

  // MP4.
  if (mp4Encoder) {
    mainProgress(PCT_MP4, 'Finalizing MP4');
    subProgress(SUB_MP4, 'Encoding MP4');
    try {
      const mp4Buffer = await mp4Encoder.finalize();
      if (mp4Buffer) {
        summaryZip.addEntry('recording.mp4', new Uint8Array(mp4Buffer));
      }
    } catch {
      // Encoder finalization failed -- skip MP4.
    }
  }

  // Finalize summary zip.
  mainProgress(PCT_FINALIZE, 'Building final archive');
  subProgress(SUB_FINALIZE, multiPart ? 'Building summary archive' : 'Building archive');
  const summaryBuf = summaryZip.finalize();
  const summaryFilename = multiPart ? 'gol-export-summary.zip' : 'gol-export.zip';
  self.postMessage({
    type: 'done-part',
    buffer: summaryBuf,
    filename: summaryFilename
  }, [summaryBuf] as never);

  mainProgress(100, 'Done');
  subProgress(100, 'Done');
  self.postMessage({type: 'done'});
};
