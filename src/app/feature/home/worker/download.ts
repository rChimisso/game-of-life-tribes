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
  snapshot: {generation: number; cols: number; rows: number; grid: Uint32Array | number[]};
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
  frontierLength?: Record<string, number>;
  extinctionTime?: Record<string, number | null>;
  fps?: number;
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

// Parallel metrics using inline blob sub-workers.
const METRICS_WORKER_SCRIPT = `
self.onmessage = function(e) {
  var d = e.data;
  var results = [];
  for (var fi = 0; fi < d.frameCount; fi++) {
    var frame = new Uint8Array(d.buffer, d.offsets[fi], d.frameSize);
    var total = d.cols * d.rows;
    var counts = new Array(d.tribeCount).fill(0);
    for (var i = 0; i < total; i++) counts[frame[i]]++;
    var population = {};
    var totalAlive = 0;
    for (var t = 0; t < d.tribeCount; t++) {
      population[d.tribeIds[t]] = counts[t];
      if (t !== d.deadIdx) totalAlive += counts[t];
    }
    var shannonEntropy = 0, simpsonSum = 0;
    if (totalAlive > 0) {
      for (var t = 0; t < d.tribeCount; t++) {
        if (t === d.deadIdx) continue;
        var p = counts[t] / totalAlive;
        if (p > 0) { shannonEntropy -= p * Math.log2(p); simpsonSum += p * p; }
      }
    }
    var boundaryLength = 0;
    var frontierCounts = new Array(d.tribeCount).fill(0);
    for (var y = 0; y < d.rows; y++) {
      for (var x = 0; x < d.cols; x++) {
        var selfTribe = frame[y * d.cols + x];
        var right = frame[y * d.cols + ((x + 1) % d.cols)];
        if (right !== selfTribe) { boundaryLength++; frontierCounts[selfTribe]++; }
        var bottom = frame[((y + 1) % d.rows) * d.cols + x];
        if (bottom !== selfTribe) { boundaryLength++; frontierCounts[selfTribe]++; }
      }
    }
    var frontierLength = {};
    for (var t = 0; t < d.tribeCount; t++) {
      if (t !== d.deadIdx) frontierLength[d.tribeIds[t]] = frontierCounts[t];
    }
    results.push({
      type: 'metrics',
      generation: d.startGen + d.globalOffset + fi,
      population: population,
      shannonEntropy: shannonEntropy,
      simpsonIndex: 1 - simpsonSum,
      boundaryLength: boundaryLength,
      frontierLength: frontierLength
    });
  }
  self.postMessage({results: results});
};
`;

function computeMetricsParallel(
  frames: Uint8Array[],
  frameCols: number,
  frameRows: number,
  tribeList: readonly TribeInfo[],
  deadId: string,
  startGeneration: number
): Promise<MetricEntry[]> {
  const frameCount = frames.length;
  if (frameCount === 0) {
    return Promise.resolve([]);
  }

  const workerCount = Math.min(
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    8,
    frameCount
  );

  // For small frame counts, compute sequentially.
  if (workerCount <= 1 || frameCount <= 4) {
    return Promise.resolve(
      frames.map((f, i) => computeFrameMetrics(f, frameCols, frameRows, tribeList, deadId, startGeneration + i))
    );
  }

  const frameSize = frameCols * frameRows;
  const deadIdx = tribeList.findIndex(t => t.id === deadId);
  const tribeIds = tribeList.map(t => t.id);

  // Distribute frames across workers.
  const chunkSize = Math.ceil(frameCount / workerCount);
  const blobUrl = URL.createObjectURL(new Blob([METRICS_WORKER_SCRIPT], {type: 'application/javascript'}));

  const promises: Promise<MetricEntry[]>[] = [];
  for (let w = 0; w < workerCount; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, frameCount);
    if (start >= end) {
      break;
    }

    // Pack frames into a single SharedArrayBuffer-like contiguous buffer.
    const count = end - start;
    const totalBytes = count * frameSize;
    const buffer = new ArrayBuffer(totalBytes);
    const view = new Uint8Array(buffer);
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) {
      const offset = i * frameSize;
      offsets.push(offset);
      view.set(frames[start + i]!, offset);
    }

    promises.push(new Promise<MetricEntry[]>((resolve, reject) => {
      const worker = new Worker(blobUrl);
      worker.onmessage = (e: MessageEvent) => {
        resolve(e.data.results as MetricEntry[]);
        worker.terminate();
      };
      worker.onerror = e => {
        reject(e);
        worker.terminate();
      };
      worker.postMessage({
        buffer,
        offsets,
        frameSize,
        frameCount: count,
        cols: frameCols,
        rows: frameRows,
        tribeCount: tribeList.length,
        tribeIds,
        deadIdx,
        startGen: startGeneration,
        globalOffset: start
      }, [buffer]);
    }));
  }

  return Promise.all(promises).then(chunks => {
    URL.revokeObjectURL(blobUrl);
    return chunks.flat();
  });
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

// AVC codec strings from highest to lowest level (High profile).
const AVC_CODECS = [
  'avc1.64003D', // High 6.1
  'avc1.64003C', // High 6.0
  'avc1.640034', // High 5.2
  'avc1.640033', // High 5.1
  'avc1.640032', // High 5.0
  'avc1.640029', // High 4.1
  'avc1.640028', // High 4.0
  'avc1.64001F', // High 3.1
  'avc1.4D0029', // Main 4.1
  'avc1.4D0028', // Main 4.0
  'avc1.42001F' // Baseline 3.1
];

async function findVideoConfig(
  targetW: number,
  targetH: number,
  bitrate: number
): Promise<{config: VideoEncoderConfig; width: number; height: number} | null> {
  // Try each codec at the target resolution.
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

  // Downscale by integer divisors until a codec works.
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

async function generateMp4(
  rec: DownloadRequest['recording'] & object,
  tribes: TribeInfo[],
  fps: number
): Promise<ArrayBuffer | null> {
  const {Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket} = await import('mediabunny');

  const {width: idealW, height: idealH} = computeMediaDimensions(rec.cols, rec.rows, true);

  const found = await findVideoConfig(idealW, idealH, 2_000_000);
  if (!found) {
    return null;
  }

  const {config, width: vw, height: vh} = found;
  const renderScale = vw / rec.cols;

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

  for (let i = 0; i < rec.frames.length; i++) {
    renderFrameToCanvas(rec.frames[i]!, rec.cols, rec.rows, colorMap, ctx, vw, vh, renderScale);

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
//  PNG generation (parallelized with concurrent canvases)
// ---------------------------------------------------------------------------

async function generatePngEntries(
  rec: DownloadRequest['recording'] & object,
  tribes: TribeInfo[],
  onProgress?: (done: number, total: number) => void
): Promise<ZipEntry[]> {
  const {width, height, scale} = computeMediaDimensions(rec.cols, rec.rows, false);
  const colorMap = buildColorMap(tribes);
  const concurrency = Math.min(typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4, 8, rec.frames.length);
  const digits = String(Math.max(0, rec.frames.length - 1)).length;
  const entries: ZipEntry[] = new Array(rec.frames.length);

  // Create a pool of canvases to avoid re-creating per batch.
  const canvases = Array.from({length: concurrency}, () => new OffscreenCanvas(width, height));
  let completed = 0;

  for (let batch = 0; batch < rec.frames.length; batch += concurrency) {
    const batchEnd = Math.min(batch + concurrency, rec.frames.length);
    const promises: Promise<void>[] = [];

    for (let i = batch; i < batchEnd; i++) {
      const ci = i - batch;
      const canvas = canvases[ci]!;
      const ctx = canvas.getContext('2d')!;
      renderFrameToCanvas(rec.frames[i]!, rec.cols, rec.rows, colorMap, ctx, width, height, scale);

      const frameIdx = i;
      promises.push(
        canvas.convertToBlob({type: 'image/png'}).then(async blob => {
          const data = new Uint8Array(await blob.arrayBuffer());
          const name = String(frameIdx).padStart(digits, '0');
          entries[frameIdx] = {path: `frames/${name}.png`,
            data};
          completed++;
          onProgress?.(completed, rec.frames.length);
        })
      );
    }

    await Promise.all(promises);
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

  const progress = (percent: number, status = '') => self.postMessage({
    type: 'progress',
    percent,
    status
  });

  progress(2, 'Preparing state');

  // State JSON — convert Uint32Array to regular array for JSON serialization.
  const gridArray = snapshot.grid instanceof Uint32Array ? Array.from(snapshot.grid) : snapshot.grid;
  const state = {
    version: 1,
    generation: snapshot.generation,
    cols: snapshot.cols,
    rows: snapshot.rows,
    tribes: [...tribes],
    rules,
    grid: gridArray
  };
  entries.push({path: 'state.json',
    data: encoder.encode(JSON.stringify(state))});

  progress(5, 'Computing metrics');

  // Metrics (parallelized across sub-workers).
  const hasFrames = rec !== null && rec.frames.length > 0;
  if (hasFrames && (opts.csv || opts.json)) {
    const deadId = tribes.find(t => t.id === 'dead')?.id ?? 'dead';
    const perFrameMetrics = await computeMetricsParallel(rec.frames, rec.cols, rec.rows, tribes, deadId, rec.startGeneration);

    const cleanMetrics = perFrameMetrics.map(({type: _t, fps: _f, ...rest}) => rest);
    if (opts.json) {
      entries.push({path: 'metrics.json',
        data: encoder.encode(JSON.stringify(cleanMetrics, null, 2))});
    }
    if (opts.csv) {
      entries.push({path: 'metrics.csv',
        data: encoder.encode(buildCsvFromMetrics(perFrameMetrics))});
    }
  } else if (opts.csv || opts.json) {
    const cleanHistory = metricsHistory.map(({type: _t, fps: _f, ...rest}) => rest);
    if (opts.json && cleanHistory.length > 0) {
      entries.push({path: 'metrics.json',
        data: encoder.encode(JSON.stringify(cleanHistory, null, 2))});
    }
    if (opts.csv && metricsHistory.length > 0) {
      entries.push({path: 'metrics.csv',
        data: encoder.encode(buildCsvFromMetrics(metricsHistory))});
    }
  }

  progress(15, 'Packing raw frames');

  // Raw frames.
  if (hasFrames && opts.frames) {
    const digits = String(Math.max(0, rec.frames.length - 1)).length;
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
      const name = String(i).padStart(digits, '0');
      entries.push({path: `frames/${name}`,
        data: rec.frames[i]!});
    }
  }

  progress(25, 'Encoding MP4');

  // MP4.
  if (hasFrames && opts.mp4) {
    try {
      progress(30, 'Encoding MP4');
      const mp4Buffer = await generateMp4(rec, tribes, opts.fps);
      if (mp4Buffer) {
        entries.push({path: 'recording.mp4',
          data: new Uint8Array(mp4Buffer)});
      }
    } catch {
      // VideoEncoder not supported — skip MP4.
    }
  }

  progress(65, 'Rendering PNGs');

  // PNG (parallelized with concurrent canvases).
  if (hasFrames && opts.png) {
    const pngEntries = await generatePngEntries(rec, tribes, (done, total) => {
      const pct = 65 + Math.round((done / total) * 25);
      progress(pct, `Rendering PNGs (${done}/${total})`);
    });
    entries.push(...pngEntries);
  }

  progress(90, 'Building ZIP');

  const zipBuffer = createZip(entries);
  progress(100, 'Done');
  self.postMessage({type: 'done',
    zip: zipBuffer}, [zipBuffer] as never);
};
