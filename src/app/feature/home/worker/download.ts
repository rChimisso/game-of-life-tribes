/* eslint-disable jsdoc/require-jsdoc */

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
  snapshot: {generation: number; cols: number; rows: number; grid: number[]};
  recording: {frames: Uint8Array[]; startGeneration: number; cols: number; rows: number} | null;
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
  meanClusterSize?: Record<string, number>;
  fps: number;
}

type WorkerInput = DownloadRequest;

// ---------------------------------------------------------------------------
//  ZIP creation (copied from zip.ts to keep worker self-contained)
// ---------------------------------------------------------------------------

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

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

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function createZip(entries: ZipEntry[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const fileNames = entries.map(e => encoder.encode(e.path));

  let localHeadersSize = 0;
  for (let i = 0; i < entries.length; i++) {
    localHeadersSize += 30 + fileNames[i]!.length + entries[i]!.data.length;
  }

  let centralDirSize = 0;
  for (let i = 0; i < entries.length; i++) {
    centralDirSize += 46 + fileNames[i]!.length;
  }

  const totalSize = localHeadersSize + centralDirSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const name = fileNames[i]!;
    const crc = crc32(entry.data);

    localOffsets.push(offset);

    writeU32(view, offset, 0x04034b50);
    writeU16(view, offset + 4, 20);
    writeU16(view, offset + 6, 0);
    writeU16(view, offset + 8, 0);
    writeU16(view, offset + 10, 0);
    writeU16(view, offset + 12, 0);
    writeU32(view, offset + 14, crc);
    writeU32(view, offset + 18, entry.data.length);
    writeU32(view, offset + 22, entry.data.length);
    writeU16(view, offset + 26, name.length);
    writeU16(view, offset + 28, 0);
    offset += 30;

    bytes.set(name, offset);
    offset += name.length;

    bytes.set(entry.data, offset);
    offset += entry.data.length;
  }

  const centralDirOffset = offset;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const name = fileNames[i]!;
    const crc = crc32(entry.data);

    writeU32(view, offset, 0x02014b50);
    writeU16(view, offset + 4, 20);
    writeU16(view, offset + 6, 20);
    writeU16(view, offset + 8, 0);
    writeU16(view, offset + 10, 0);
    writeU16(view, offset + 12, 0);
    writeU16(view, offset + 14, 0);
    writeU32(view, offset + 16, crc);
    writeU32(view, offset + 20, entry.data.length);
    writeU32(view, offset + 24, entry.data.length);
    writeU16(view, offset + 28, name.length);
    writeU16(view, offset + 30, 0);
    writeU16(view, offset + 32, 0);
    writeU16(view, offset + 34, 0);
    writeU16(view, offset + 36, 0);
    writeU32(view, offset + 38, 0);
    writeU32(view, offset + 42, localOffsets[i]!);
    offset += 46;

    bytes.set(name, offset);
    offset += name.length;
  }

  writeU32(view, offset, 0x06054b50);
  writeU16(view, offset + 4, 0);
  writeU16(view, offset + 6, 0);
  writeU16(view, offset + 8, entries.length);
  writeU16(view, offset + 10, entries.length);
  writeU32(view, offset + 12, centralDirSize);
  writeU32(view, offset + 16, centralDirOffset);
  writeU16(view, offset + 20, 0);

  return buffer;
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
  for (let y = 0; y < frameRows; y++) {
    for (let x = 0; x < frameCols; x++) {
      const self = frame[y * frameCols + x]!;
      if (frame[y * frameCols + ((x + 1) % frameCols)]! !== self) {
        boundaryLength++;
      }
      if (frame[((y + 1) % frameRows) * frameCols + x]! !== self) {
        boundaryLength++;
      }
    }
  }

  const visited = new Uint8Array(total);
  const clusterCounts = new Map<number, number[]>();
  for (let i = 0; i < total; i++) {
    if (visited[i]) {
      continue;
    }
    const tribe = frame[i]!;
    visited[i] = 1;
    let size = 0;
    const queue = [i];
    while (queue.length > 0) {
      const ci = queue.pop()!;
      size++;
      const cx = ci % frameCols;
      const cy = (ci - cx) / frameCols;
      const neighbors = [
        cy * frameCols + ((cx + 1) % frameCols),
        cy * frameCols + ((cx - 1 + frameCols) % frameCols),
        ((cy + 1) % frameRows) * frameCols + cx,
        ((cy - 1 + frameRows) % frameRows) * frameCols + cx
      ];
      for (const ni of neighbors) {
        if (!visited[ni] && frame[ni] === tribe) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }
    if (!clusterCounts.has(tribe)) {
      clusterCounts.set(tribe, []);
    }
    clusterCounts.get(tribe)!.push(size);
  }
  const meanClusterSize: Record<string, number> = {};
  for (const [tribeIdx, sizes] of clusterCounts) {
    if (tribeIdx < tribeList.length) {
      meanClusterSize[tribeList[tribeIdx]!.id] = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    }
  }

  return {
    type: 'metrics',
    generation,
    population,
    shannonEntropy,
    simpsonIndex: 1 - simpsonSum,
    boundaryLength,
    meanClusterSize,
    fps: 0
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

function renderFrameToCanvas(
  frame: Uint8Array,
  cols: number,
  rows: number,
  colorMap: number[][],
  ctx: OffscreenCanvasRenderingContext2D,
  targetW: number,
  targetH: number,
  scale: number
): void {
  const imageData = ctx.createImageData(targetW, targetH);
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
  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
//  CSV builder
// ---------------------------------------------------------------------------

function buildCsvFromMetrics(metrics: MetricEntry[]): string {
  const popKeys = new Set<string>();
  const clusterKeys = new Set<string>();
  for (const m of metrics) {
    for (const k of Object.keys(m.population)) {
      popKeys.add(k);
    }
    if (m.meanClusterSize) {
      for (const k of Object.keys(m.meanClusterSize)) {
        clusterKeys.add(k);
      }
    }
  }
  const popCols = [...popKeys];
  const clusterCols = [...clusterKeys];
  const header = [
    'generation',
    ...popCols.map(k => `pop_${k}`),
    'shannon_entropy',
    'simpson_index',
    'boundary_length',
    ...clusterCols.map(k => `cluster_${k}`)
  ].join(',');
  const rows = metrics.map(m => [
    m.generation,
    ...popCols.map(k => m.population[k] ?? 0),
    m.shannonEntropy,
    m.simpsonIndex,
    m.boundaryLength,
    ...clusterCols.map(k => m.meanClusterSize?.[k] ?? '')
  ].join(','));
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
//  MP4 generation
// ---------------------------------------------------------------------------

async function generateMp4(
  rec: DownloadRequest['recording'] & object,
  tribes: TribeInfo[],
  fps: number
): Promise<ArrayBuffer> {
  const {Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket} = await import('mediabunny');

  const {width: vw, height: vh, scale} = computeMediaDimensions(rec.cols, rec.rows, true);

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

  encoder.configure({
    codec: 'avc1.42001f',
    width: vw,
    height: vh,
    bitrate: 2_000_000
  });

  const colorMap = buildColorMap(tribes);
  const frameDuration = 1_000_000 / fps;

  const offscreen = new OffscreenCanvas(vw, vh);
  const ctx = offscreen.getContext('2d')!;

  for (let i = 0; i < rec.frames.length; i++) {
    renderFrameToCanvas(rec.frames[i]!, rec.cols, rec.rows, colorMap, ctx, vw, vh, scale);

    const videoFrame = new VideoFrame(offscreen, {
      timestamp: i * frameDuration,
      duration: frameDuration
    });
    encoder.encode(videoFrame);
    videoFrame.close();
  }

  await encoder.flush();
  encoder.close();
  await Promise.all(addPromises);
  await output.finalize();

  return target.buffer!;
}

// ---------------------------------------------------------------------------
//  PNG generation
// ---------------------------------------------------------------------------

async function generatePngEntries(
  rec: DownloadRequest['recording'] & object,
  tribes: TribeInfo[]
): Promise<ZipEntry[]> {
  const {width, height, scale} = computeMediaDimensions(rec.cols, rec.rows, false);
  const colorMap = buildColorMap(tribes);
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d')!;
  const digits = String(rec.frames.length).length;
  const entries: ZipEntry[] = [];

  for (let i = 0; i < rec.frames.length; i++) {
    renderFrameToCanvas(rec.frames[i]!, rec.cols, rec.rows, colorMap, ctx, width, height, scale);
    const blob = await offscreen.convertToBlob({type: 'image/png'});
    const data = new Uint8Array(await blob.arrayBuffer());
    const name = String(i + 1).padStart(digits, '0');
    entries.push({path: `frames/${name}.png`,
      data});
  }

  return entries;
}

// ---------------------------------------------------------------------------
//  Main handler
// ---------------------------------------------------------------------------

self.onmessage = async(e: MessageEvent<WorkerInput>) => {
  const msg = e.data;
  const {opts, snapshot, recording: rec, tribes, rules, metricsHistory} = msg;

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];

  // State JSON.
  const state = {
    version: 1,
    generation: snapshot.generation,
    cols: snapshot.cols,
    rows: snapshot.rows,
    tribes: [...tribes],
    rules,
    grid: snapshot.grid
  };
  entries.push({path: 'state.json',
    data: encoder.encode(JSON.stringify(state))});

  // Metrics.
  const hasFrames = rec !== null && rec.frames.length > 0;
  if (hasFrames && (opts.csv || opts.json)) {
    const deadId = tribes.find(t => t.id === 'dead')?.id ?? 'dead';
    const perFrameMetrics = rec.frames.map((frame, i) =>
      computeFrameMetrics(frame, rec.cols, rec.rows, tribes, deadId, rec.startGeneration + i));

    if (opts.json) {
      entries.push({path: 'metrics.json',
        data: encoder.encode(JSON.stringify(perFrameMetrics, null, 2))});
    }
    if (opts.csv) {
      entries.push({path: 'metrics.csv',
        data: encoder.encode(buildCsvFromMetrics(perFrameMetrics))});
    }
  } else if (opts.csv || opts.json) {
    if (opts.json && metricsHistory.length > 0) {
      entries.push({path: 'metrics.json',
        data: encoder.encode(JSON.stringify(metricsHistory, null, 2))});
    }
    if (opts.csv && metricsHistory.length > 0) {
      entries.push({path: 'metrics.csv',
        data: encoder.encode(buildCsvFromMetrics(metricsHistory))});
    }
  }

  // Raw frames.
  if (hasFrames && opts.frames) {
    const digits = String(rec.frames.length).length;
    const meta = JSON.stringify({
      cols: rec.cols,
      rows: rec.rows,
      startGeneration: rec.startGeneration,
      frameCount: rec.frames.length,
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
    entries.push({path: 'frames/metadata.json',
      data: encoder.encode(meta)});
    for (let i = 0; i < rec.frames.length; i++) {
      const name = String(i + 1).padStart(digits, '0');
      entries.push({path: `frames/${name}`,
        data: rec.frames[i]!});
    }
  }

  // MP4.
  if (hasFrames && opts.mp4) {
    try {
      const mp4Buffer = await generateMp4(rec, tribes, opts.fps);
      entries.push({path: 'recording.mp4',
        data: new Uint8Array(mp4Buffer)});
    } catch {
      // VideoEncoder not supported — skip MP4.
    }
  }

  // PNG.
  if (hasFrames && opts.png) {
    const pngEntries = await generatePngEntries(rec, tribes);
    entries.push(...pngEntries);
  }

  const zipBuffer = createZip(entries);
  self.postMessage({type: 'done',
    zip: zipBuffer}, {transfer: [zipBuffer]} as never);
};
