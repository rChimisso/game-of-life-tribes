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
  opts: {csv: boolean; mp4: boolean; png: boolean; saves: boolean; fps: number};
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
//  Indexed-color PNG encoder (palette mode, no alpha, no OffscreenCanvas)
//
//  One palette entry per tribe color.  Each cell maps 1:1 to one pixel.
//  Uses CompressionStream('deflate') for zlib-format IDAT compression.
//  Header (signature + IHDR + PLTE) and IEND are pre-computed once and
//  Reused across every frame.  A single `filtered` buffer is allocated
//  Once and refilled per frame to avoid per-frame allocation.
// ---------------------------------------------------------------------------

class IndexedPngEncoder {
  private readonly header: Uint8Array;

  private readonly iend: Uint8Array;

  private readonly filtered: Uint8Array;

  private readonly cols: number;

  private readonly rows: number;

  private readonly rowStride: number;

  constructor(cols: number, rows: number, palette: number[][]) {
    this.cols = cols;
    this.rows = rows;
    this.rowStride = 1 + cols;
    this.filtered = new Uint8Array(rows * this.rowStride);
    // Pre-fill filter bytes (type 0 = None) — they never change.
    for (let y = 0; y < rows; y++) {
      this.filtered[y * this.rowStride] = 0;
    }
    this.header = IndexedPngEncoder.buildHeader(cols, rows, palette);
    this.iend = IndexedPngEncoder.wrapChunk('IEND', new Uint8Array(0));
  }

  async encodeFrame(frame: Uint8Array): Promise<Uint8Array> {
    const {cols, rows, rowStride, filtered} = this;
    // Copy pixel data into the filtered buffer (filter bytes already set).
    for (let y = 0; y < rows; y++) {
      filtered.set(frame.subarray(y * cols, y * cols + cols), y * rowStride + 1);
    }

    // Compress with zlib via CompressionStream('deflate').
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(filtered);
    writer.close();
    const compressedBuf = await new Response(cs.readable).arrayBuffer();

    const idat = IndexedPngEncoder.wrapChunk('IDAT', new Uint8Array(compressedBuf));

    const total = this.header.length + idat.length + this.iend.length;
    const png = new Uint8Array(total);
    png.set(this.header, 0);
    png.set(idat, this.header.length);
    png.set(this.iend, this.header.length + idat.length);
    return png;
  }

  private static buildHeader(cols: number, rows: number, palette: number[][]): Uint8Array {
    const sig = new Uint8Array([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10
    ]);

    // IHDR: width, height, bit depth 8, color type 3 (indexed)
    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, cols);
    ihdrView.setUint32(4, rows);
    ihdrData[8] = 8; // Bit depth
    ihdrData[9] = 3; // Color type: indexed
    ihdrData[10] = 0; // Compression: deflate
    ihdrData[11] = 0; // Filter: adaptive
    ihdrData[12] = 0; // Interlace: none
    const ihdr = IndexedPngEncoder.wrapChunk('IHDR', ihdrData);

    // PLTE: exactly palette.length entries (no padding)
    const plteData = new Uint8Array(palette.length * 3);
    for (let i = 0; i < palette.length; i++) {
      plteData[i * 3] = palette[i]![0]!;
      plteData[i * 3 + 1] = palette[i]![1]!;
      plteData[i * 3 + 2] = palette[i]![2]!;
    }
    const plte = IndexedPngEncoder.wrapChunk('PLTE', plteData);

    const header = new Uint8Array(sig.length + ihdr.length + plte.length);
    header.set(sig, 0);
    header.set(ihdr, sig.length);
    header.set(plte, sig.length + ihdr.length);
    return header;
  }

  private static wrapChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length); // Length (big-endian)
    chunk[4] = type.charCodeAt(0);
    chunk[5] = type.charCodeAt(1);
    chunk[6] = type.charCodeAt(2);
    chunk[7] = type.charCodeAt(3);
    chunk.set(data, 8);
    // CRC-32 over type + data (same polynomial as ZIP)
    view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
    return chunk;
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
  // Ensure 4-byte alignment for Uint32Array view.  Decompressed chunk data
  // May have an arbitrary byteOffset.
  let words: Uint32Array;
  if (packed.byteOffset % 4 === 0) {
    words = new Uint32Array(packed.buffer, packed.byteOffset, packed.byteLength / 4);
  } else {
    const aligned = new ArrayBuffer(packed.byteLength);
    new Uint8Array(aligned).set(packed);
    words = new Uint32Array(aligned);
  }
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

// ---------------------------------------------------------------------------
//  State builder — produces .golt binary format (magic + version + JSON header
//  + deflate-raw compressed grid).  Compatible with the save / load-state flow.
// ---------------------------------------------------------------------------

async function buildGoltState(
  generation: number,
  cols: number,
  rows: number,
  grid: Uint32Array | number[],
  tribes: TribeInfo[],
  rules: unknown
): Promise<Uint8Array> {
  const MAGIC = new Uint8Array([
    0x47,
    0x6F,
    0x4C,
    0x54
  ]); // "GoLT"
  const textEncoder = new TextEncoder();
  const header = JSON.stringify({
    generation,
    cols,
    rows,
    tribes: tribes.map(t => ({id: t.id,
      color: t.color})),
    rules
  });
  const headerBytes = textEncoder.encode(header);
  const gridU32 = grid instanceof Uint32Array ? grid : new Uint32Array(grid);
  const gridBytes = new Uint8Array(gridU32.buffer, gridU32.byteOffset, gridU32.byteLength);

  // Compress grid with deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(gridBytes);
  writer.close();
  const compressedGrid = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  // Build: magic(4) + version(4) + headerLen(4) + header + compressed grid
  const preambleSize = 4 + 4 + 4 + headerBytes.byteLength;
  const total = preambleSize + compressedGrid.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint32(4, 1, true); // Version 1
  view.setUint32(8, headerBytes.byteLength, true);
  out.set(headerBytes, 12);
  out.set(compressedGrid, preambleSize);
  return out;
}

// ---------------------------------------------------------------------------
//  Main handler -- fully streaming, split-output aware
// ---------------------------------------------------------------------------

self.onmessage = async(e: MessageEvent<WorkerInput>) => {
  try {
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
    const needMetrics = opts.csv;
    const needFrameOutput = opts.png;

    // -- Preflight ---------------------------------------------------------
    mainProgress(0, 'Preflight');
    subProgress(0, '');

    let totalFrames = 0;

    if (hasRecording) {
      for (const c of rec.manifest.chunks) {
        totalFrames += c.blockCount;
      }
    }

    // -- Indexed PNG encoder ------------------------------------------------
    let pngEncoder: IndexedPngEncoder | null = null;
    if (hasRecording && opts.png) {
      pngEncoder = new IndexedPngEncoder(rec.cols, rec.rows, buildColorMap(tribes));
    }

    // -- MP4 encoder -------------------------------------------------------
    // VideoEncoder becomes unstable / memory-hungry beyond ~100 000 frames,
    // And the resulting MP4 can exceed browser memory.  Skip MP4 early when
    // The recording is too large.
    const MP4_MAX_FRAMES = 100_000;
    let mp4Encoder: Mp4StreamEncoder | null = null;
    let mp4Skipped = false;
    if (hasRecording && opts.mp4) {
      if (totalFrames > MP4_MAX_FRAMES) {
        mp4Skipped = true;
        subProgress(0, `MP4 skipped: ${totalFrames.toLocaleString()} frames exceeds the ${MP4_MAX_FRAMES.toLocaleString()}-frame limit`);
      } else {
        mainProgress(1, 'Initializing MP4 encoder');
        try {
          const mp4ImgData = new ImageData(1, 1);
          mp4Encoder = await createMp4StreamEncoder(rec.cols, rec.rows, tribes, opts.fps, mp4ImgData);
        } catch {
        // VideoEncoder not supported -- skip MP4.
        }
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

    // -- Process frames with dynamic PNG splitting -------------------------
    // PNG frames are collected into a StreamingZip. When the zip's running
    // Size exceeds PART_SIZE_LIMIT, it is finalized & emitted and a fresh
    // Zip is started.  Non-PNG content (CSV, MP4, states) goes into a
    // Separate summary zip when splits occur.

    let pngZip: StreamingZip | null = opts.png ? new StreamingZip() : null;
    let pngPartsEmitted = 0;

    function flushPngZip(): void {
      if (!pngZip || pngZip.entryCount === 0) {
        return;
      }
      pngPartsEmitted++;
      const buf = pngZip.finalize();
      const filename = `gol-export-part${String(pngPartsEmitted).padStart(2, '0')}.zip`;
      self.postMessage({
        type: 'done-part',
        buffer: buf,
        filename
      }, [buf] as never);
      pngZip = new StreamingZip();
    }

    let chunksProcessed = 0;
    const totalChunks = hasRecording ? rec.manifest.chunks.length : 0;
    let globalFrameIndex = 0;

    if (hasRecording) {
      if (!opfsDir) {
        const root = await navigator.storage.getDirectory();
        opfsDir = await root.getDirectoryHandle(OPFS_DIR);
      }

      for (let ci = 0; ci < totalChunks; ci++) {
        const chunkMeta = rec.manifest.chunks[ci]!;
        chunksProcessed++;
        const pct = PCT_CHUNKS_START + ((chunksProcessed / totalChunks) * (PCT_CHUNKS_END - PCT_CHUNKS_START));
        mainProgress(Math.round(pct), `Chunk ${chunksProcessed}/${totalChunks}`);

        subProgress(Math.round((globalFrameIndex / totalFrames) * 100), 'Loading chunk');

        // OPFS handles can become stale during very long exports (browser GC,
        // Storage pressure).  If reading fails, re-acquire the directory
        // Handle and retry once before giving up.
        let storedData: ArrayBuffer;
        try {
          const fileHandle = await opfsDir.getFileHandle(chunkMeta.filename);
          const blob = await fileHandle.getFile();
          storedData = await blob.arrayBuffer();
        } catch {
        // Re-acquire OPFS directory handle and retry.
          const root = await navigator.storage.getDirectory();
          opfsDir = await root.getDirectoryHandle(OPFS_DIR);
          const fileHandle = await opfsDir.getFileHandle(chunkMeta.filename);
          const blob = await fileHandle.getFile();
          storedData = await blob.arrayBuffer();
        }

        // The manifest codec may be stale if the compress worker raced ahead
        // And compressed the OPFS file before being terminated.  Instead of
        // Trusting the codec field, always try decompression when the manifest
        // Says raw-packed — deflate-raw will fail fast on genuinely raw data.
        let chunkData: Uint8Array;
        if (chunkMeta.codec === 'deflate-raw') {
          chunkData = new Uint8Array(await decompressChunk(storedData));
        } else {
          try {
            chunkData = new Uint8Array(await decompressChunk(storedData));
          } catch {
            chunkData = new Uint8Array(storedData);
          }
        }

        for (let fi = 0; fi < chunkMeta.blockCount; fi++) {
          const frameGen = chunkMeta.generations[fi] ?? (chunkMeta.generationStart + fi);
          globalFrameIndex++;

          if (fi % 50 === 0 || fi === chunkMeta.blockCount - 1) {
            subProgress(
              Math.round((globalFrameIndex / totalFrames) * 100),
              `Processing frame gen ${frameGen}`
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

          if (mp4Encoder) {
            try {
              mp4Encoder.encodeFrame(frame);
            } catch {
            // Frame encoding failed — discard MP4 for the rest of the export.
              mp4Encoder = null;
            }
          }

          if (pngEncoder && pngZip) {
            const pngData = await pngEncoder.encodeFrame(frame);
            pngZip.addEntry(`frames/${frameGen}.png`, pngData);

            // Dynamic split: flush when approaching size limit.
            if (pngZip.currentSize >= PART_SIZE_LIMIT) {
              flushPngZip();
            }
          }
        }
      }
    }

    // Flush remaining PNG data if multi-part is already in progress.
    if (pngPartsEmitted > 0 && pngZip && pngZip.entryCount > 0) {
      flushPngZip();
    }

    // -- Build summary / single zip ----------------------------------------
    // If PNG needed multiple parts, non-PNG content goes into a summary zip.
    // Otherwise everything merges into the single zip that already has PNGs.
    let summaryZip: StreamingZip;
    if (pngPartsEmitted > 0) {
      summaryZip = new StreamingZip();
    } else if (pngZip && pngZip.entryCount > 0) {
      summaryZip = pngZip;
    } else {
      summaryZip = new StreamingZip();
    }

    // Sub-progress for the summary phase: 0-100% across states/metrics/MP4/finalize.
    // Use monotonically increasing milestones.
    const SUB_STATES = 20;
    const SUB_METRICS = 40;
    const SUB_MP4 = 80;
    const SUB_FINALIZE = 95;

    // States: first and last generation frames saved as .golt binary files.
    if (opts.saves && hasRecording && firstFrame) {
      mainProgress(PCT_METRICS, 'Writing states');
      subProgress(SUB_STATES, 'Building first-gen state');

      // FirstFrame.packed is already in packed format (4 cells per u32) which
      // Matches what parseGoltFile expects on load.
      const firstU32 = new Uint32Array(
        firstFrame.packed.buffer.slice(
          firstFrame.packed.byteOffset,
          firstFrame.packed.byteOffset + firstFrame.packed.byteLength
        )
      );
      summaryZip.addEntry(
        `state-first-gen${firstFrame.gen}.golt`,
        await buildGoltState(firstFrame.gen, rec.cols, rec.rows, firstU32, tribes, rules)
      );

      // Use snapshot grid for the last-gen state — it's the current GPU state in native format.
      if (snapshot.generation !== firstFrame.gen) {
        subProgress(SUB_STATES + 10, 'Building last-gen state');
        summaryZip.addEntry(
          `state-last-gen${snapshot.generation}.golt`,
          await buildGoltState(snapshot.generation, snapshot.cols, snapshot.rows, snapshot.grid, tribes, rules)
        );
      }
    } else if (opts.saves) {
    // No recording -- save the current snapshot state.
      mainProgress(PCT_METRICS, 'Writing state');
      subProgress(SUB_STATES, 'Building snapshot state');
      summaryZip.addEntry(
        `state-gen${snapshot.generation}.golt`,
        await buildGoltState(snapshot.generation, snapshot.cols, snapshot.rows, snapshot.grid, tribes, rules)
      );
    }

    // Metrics.
    subProgress(SUB_METRICS, 'Writing metrics');
    if (needMetrics && allMetrics.length > 0) {
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(allMetrics)));
    } else if (needMetrics && metricsHistory.length > 0) {
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(metricsHistory)));
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
    const isMultiPart = pngPartsEmitted > 0;
    subProgress(SUB_FINALIZE, isMultiPart ? 'Building summary archive' : 'Building archive');
    const summaryBuf = summaryZip.finalize();
    const summaryFilename = isMultiPart ? 'gol-export-summary.zip' : 'gol-export.zip';
    self.postMessage({
      type: 'done-part',
      buffer: summaryBuf,
      filename: summaryFilename
    }, [summaryBuf] as never);

    mainProgress(100, 'Done');
    subProgress(100, 'Done');
    self.postMessage({type: 'done'});
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    self.postMessage({type: 'error',
      reason});
  }
};
