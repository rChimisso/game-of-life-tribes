import {GridFormatMetadata} from '../model/grid-format';
import {RecordingManifest} from '../model/recording';
import {DEAD_TRIBE_ID} from '../model/rule';
import {buildGoltStateFile} from '../util/golt-file';
import {alignPackedBytesToWords, gridByteSize, gridFormatFromMetadata, unpackPackedBytesToFrame} from '../util/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface TribeInfo {
  id: string;
  color: string;
}

interface DownloadRequest {
  type: 'download';
  opts: {
    metrics: boolean;
    mp4: boolean;
    png: boolean;
    saves: boolean;
    fps: number;
    bitrate: number;
    frameRange: {startFrame: number; endFrame: number} | null;
  };
  snapshot: Grid & {generation: number; grid: Uint32Array | number[]; gridFormat: GridFormatMetadata};
  recording: (Grid & {manifest: RecordingManifest}) | null;
  tribes: TribeInfo[];
  rules: unknown;
  metricsHistory: MetricEntry[];
}

interface MetricEntry {
  type: 'metrics';
  generation: number;
  population: Record<string, number>;
  populationDelta?: Record<string, number>;
  aliveCells: number;
  deadCells: number;
  occupancy: number;
  shannonEntropy: number;
  simpsonIndex: number;
  sameStateContactEdges: number;
  crossStateContactEdges: number;
  sameStateContactFraction: number;
  crossStateContactFraction: number;
  changedCells: number | null;
  changedFraction: number | null;
  births: number | null;
  deaths: number | null;
  tribeSwitches: number | null;
  netGrowth: number | null;
  frontierLength?: Record<string, number>;
  extinctionTime?: Record<string, number | null>;
  fps?: number;
}

interface AttractorEpisode {
  periodicOrbitReached: boolean;
  attractorClass: 'fixed' | 'periodic';
  startGeneration: number;
  firstRepeatGeneration: number;
  endGeneration: number;
  transientLength: number;
  orbitPeriodLength: number;
  exact: boolean;
}

interface PendingAttractorFrame {
  generation: number;
  frame: Uint8Array;
}

interface ActiveAttractor {
  startGeneration: number;
  firstRepeatGeneration: number;
  orbitPeriodLength: number;
  orbitFrames: Uint8Array[];
  lastMatchingGeneration: number;
  exact: boolean;
}

interface AttractorTracker {
  generationStart: number | null;
  lastGeneration: number | null;
  generationGapCount: number;
  candidatesByHash: Map<number, number[]>;
  pendingFrames: PendingAttractorFrame[];
  active: ActiveAttractor | null;
  attractors: AttractorEpisode[];
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
  for (const value of data) {
    crc = crcTable[(crc ^ value) & 0xff]! ^ (crc >>> 8);
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

  public get currentSize(): number {
    return this.offset;
  }

  public get entryCount(): number {
    return this.records.length;
  }

  public addEntry(path: string, data: Uint8Array): void {
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

  public finalize(): ArrayBuffer {
    const centralDirOffset = this.offset;
    let centralDirSize = 0;
    const entryCount = this.records.length;

    // Determine whether ZIP64 extensions are needed.
    const needZip64Eocd = entryCount > 0xFFFF || centralDirOffset > 0xFFFFFFFF;

    for (const rec of this.records) {
      const zip64Entry = rec.localOffset > 0xFFFFFFFF;
      const extraLen = zip64Entry ? 12 : 0; // Header(2) + size(2) + offset(8)
      const entry = new Uint8Array(46 + rec.nameBytes.length + extraLen);
      const ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true);
      ev.setUint16(4, zip64Entry ? 45 : 20, true); // Version made by
      ev.setUint16(6, zip64Entry ? 45 : 20, true); // Version needed
      ev.setUint16(8, 0, true);
      ev.setUint16(10, 0, true);
      ev.setUint16(12, 0, true);
      ev.setUint16(14, 0, true);
      ev.setUint32(16, rec.crc, true);
      ev.setUint32(20, rec.size, true);
      ev.setUint32(24, rec.size, true);
      ev.setUint16(28, rec.nameBytes.length, true);
      ev.setUint16(30, extraLen, true); // Extra field length
      ev.setUint16(32, 0, true);
      ev.setUint16(34, 0, true);
      ev.setUint16(36, 0, true);
      ev.setUint32(38, 0, true);
      if (zip64Entry) {
        ev.setUint32(42, 0xFFFFFFFF, true); // Sentinel
        entry.set(rec.nameBytes, 46);
        // ZIP64 extra field: 0x0001 tag + 8-byte relative header offset
        const xOff = 46 + rec.nameBytes.length;
        ev.setUint16(xOff, 0x0001, true);
        ev.setUint16(xOff + 2, 8, true);
        ev.setUint32(xOff + 4, rec.localOffset % 0x100000000, true);
        ev.setUint32(xOff + 8, Math.floor(rec.localOffset / 0x100000000), true);
      } else {
        ev.setUint32(42, rec.localOffset, true);
        entry.set(rec.nameBytes, 46);
      }

      this.chunks.push(entry);
      centralDirSize += entry.length;
    }

    if (needZip64Eocd) {
      // ZIP64 End of Central Directory Record (56 bytes)
      const z64Eocd = new Uint8Array(56);
      const zv = new DataView(z64Eocd.buffer);
      zv.setUint32(0, 0x06064b50, true); // Signature
      zv.setUint32(4, 44, true); // Size of remaining record
      zv.setUint32(8, 0, true);
      zv.setUint16(12, 45, true); // Version made by
      zv.setUint16(14, 45, true); // Version needed
      zv.setUint32(16, 0, true); // Disk number
      zv.setUint32(20, 0, true); // Disk with central dir
      zv.setUint32(24, entryCount % 0x100000000, true); // Entries on disk (lo)
      zv.setUint32(28, Math.floor(entryCount / 0x100000000), true);
      zv.setUint32(32, entryCount % 0x100000000, true); // Total entries (lo)
      zv.setUint32(36, Math.floor(entryCount / 0x100000000), true);
      zv.setUint32(40, centralDirSize % 0x100000000, true); // Central dir size (lo)
      zv.setUint32(44, Math.floor(centralDirSize / 0x100000000), true);
      zv.setUint32(48, centralDirOffset % 0x100000000, true); // Central dir offset (lo)
      zv.setUint32(52, Math.floor(centralDirOffset / 0x100000000), true);
      this.chunks.push(z64Eocd);

      // ZIP64 End of Central Directory Locator (20 bytes)
      const z64Loc = new Uint8Array(20);
      const lv = new DataView(z64Loc.buffer);
      lv.setUint32(0, 0x07064b50, true); // Signature
      lv.setUint32(4, 0, true); // Disk with ZIP64 EOCD
      const z64EocdOffset = centralDirOffset + centralDirSize;
      lv.setUint32(8, z64EocdOffset % 0x100000000, true);
      lv.setUint32(12, Math.floor(z64EocdOffset / 0x100000000), true);
      lv.setUint32(16, 1, true); // Total disks
      this.chunks.push(z64Loc);
    }

    // End of central directory (standard EOCD — sentinels when ZIP64)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    if (needZip64Eocd) {
      ev.setUint16(8, 0xFFFF, true);
      ev.setUint16(10, 0xFFFF, true);
      ev.setUint32(12, 0xFFFFFFFF, true);
      ev.setUint32(16, 0xFFFFFFFF, true);
    } else {
      ev.setUint16(8, entryCount, true);
      ev.setUint16(10, entryCount, true);
      ev.setUint32(12, centralDirSize, true);
      ev.setUint32(16, centralDirOffset, true);
    }
    ev.setUint16(20, 0, true);
    this.chunks.push(eocd);

    let totalSize = this.offset + centralDirSize + 22;
    if (needZip64Eocd) {
      totalSize += 56 + 20; // ZIP64 EOCD + Locator
    }
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
  generation: number,
  previous: {generation: number; frame: Uint8Array; population: Record<string, number>; aliveCells: number} | null
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
  const deadCells = deadIdx >= 0 ? counts[deadIdx]! : 0;

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

  let crossStateContactEdges = 0;
  const frontierCounts = new Array<number>(tribeList.length).fill(0);
  for (let y = 0; y < frameRows; y++) {
    for (let x = 0; x < frameCols; x++) {
      const selfTribe = frame[y * frameCols + x]!;
      const right = frame[y * frameCols + ((x + 1) % frameCols)]!;
      if (right !== selfTribe) {
        crossStateContactEdges++;
        frontierCounts[selfTribe]!++;
      }
      const bottom = frame[((y + 1) % frameRows) * frameCols + x]!;
      if (bottom !== selfTribe) {
        crossStateContactEdges++;
        frontierCounts[selfTribe]!++;
      }
    }
  }
  const totalContactEdges = total * 2;
  const sameStateContactEdges = Math.max(0, totalContactEdges - crossStateContactEdges);

  const exactTransition = !!previous && generation - previous.generation === 1;
  const populationDelta: Record<string, number> = {};
  if (previous) {
    for (const tribe of tribeList) {
      populationDelta[tribe.id] = (population[tribe.id] ?? 0) - (previous.population[tribe.id] ?? 0);
    }
  }

  let changedCellsBetweenFrames: number | null = null;
  let births: number | null = null;
  let deaths: number | null = null;
  let tribeSwitches: number | null = null;
  if (previous) {
    changedCellsBetweenFrames = 0;
    births = 0;
    deaths = 0;
    tribeSwitches = 0;
    for (let i = 0; i < total; i++) {
      const prevTribe = previous.frame[i]!;
      const tribe = frame[i]!;
      if (prevTribe !== tribe) {
        changedCellsBetweenFrames++;
        if (prevTribe === deadIdx && tribe !== deadIdx) {
          births++;
        } else if (prevTribe !== deadIdx && tribe === deadIdx) {
          deaths++;
        } else if (prevTribe !== deadIdx && tribe !== deadIdx) {
          tribeSwitches++;
        }
      }
    }
  }
  const changedFraction = previous && total > 0 ? changedCellsBetweenFrames! / total : null;

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
    populationDelta: previous ? populationDelta : undefined,
    aliveCells: totalAlive,
    deadCells,
    occupancy: total > 0 ? totalAlive / total : 0,
    shannonEntropy,
    simpsonIndex: 1 - simpsonSum,
    sameStateContactEdges,
    crossStateContactEdges,
    sameStateContactFraction: totalContactEdges > 0 ? sameStateContactEdges / totalContactEdges : 0,
    crossStateContactFraction: totalContactEdges > 0 ? crossStateContactEdges / totalContactEdges : 0,
    changedCells: exactTransition ? changedCellsBetweenFrames : null,
    changedFraction: exactTransition ? changedFraction : null,
    births: exactTransition ? births : null,
    deaths: exactTransition ? deaths : null,
    tribeSwitches: exactTransition ? tribeSwitches : null,
    netGrowth: previous ? totalAlive - previous.aliveCells : null,
    frontierLength
  };
}

function createAttractorTracker(): AttractorTracker {
  return {
    generationStart: null,
    lastGeneration: null,
    generationGapCount: 0,
    candidatesByHash: new Map(),
    pendingFrames: [],
    active: null,
    attractors: []
  };
}

function framesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function resetAttractorCandidates(tracker: AttractorTracker): void {
  tracker.candidatesByHash = new Map();
  tracker.pendingFrames = [];
}

function addAttractorCandidate(tracker: AttractorTracker, frame: Uint8Array, generation: number, hash: number): void {
  const index = tracker.pendingFrames.length;
  tracker.pendingFrames.push({generation, frame});
  const candidates = tracker.candidatesByHash.get(hash) ?? [];
  candidates.push(index);
  tracker.candidatesByHash.set(hash, candidates);
}

function expectedAttractorPhase(active: ActiveAttractor, generation: number): number {
  return (generation - active.startGeneration) % active.orbitPeriodLength;
}

function activeAttractorMatches(active: ActiveAttractor, frame: Uint8Array, generation: number): boolean {
  const phase = expectedAttractorPhase(active, generation);
  return phase >= 0 && framesEqual(active.orbitFrames[phase]!, frame);
}

function finalizeActiveAttractor(tracker: AttractorTracker): void {
  const {active} = tracker;
  if (!active) {
    return;
  }

  const previousAttractor = tracker.attractors[tracker.attractors.length - 1] ?? null;
  tracker.attractors.push({
    periodicOrbitReached: active.orbitPeriodLength > 1,
    attractorClass: active.orbitPeriodLength === 1 ? 'fixed' : 'periodic',
    startGeneration: active.startGeneration,
    firstRepeatGeneration: active.firstRepeatGeneration,
    endGeneration: active.lastMatchingGeneration,
    transientLength: previousAttractor ?
      active.startGeneration - previousAttractor.endGeneration :
      active.startGeneration,
    orbitPeriodLength: active.orbitPeriodLength,
    exact: active.exact
  });
  tracker.active = null;
}

function detectAttractor(tracker: AttractorTracker, frame: Uint8Array, generation: number, hash: number): boolean {
  const candidates = tracker.candidatesByHash.get(hash) ?? [];
  for (const candidateIndex of candidates) {
    const candidate = tracker.pendingFrames[candidateIndex];
    if (!candidate || !framesEqual(candidate.frame, frame)) {
      continue;
    }

    const period = generation - candidate.generation;
    const orbitFrames = tracker.pendingFrames.slice(candidateIndex).map(entry => entry.frame);
    if (period <= 0 || period !== orbitFrames.length) {
      continue;
    }

    tracker.active = {
      startGeneration: candidate.generation,
      firstRepeatGeneration: generation,
      orbitPeriodLength: period,
      orbitFrames,
      lastMatchingGeneration: generation,
      exact: true
    };
    resetAttractorCandidates(tracker);
    return true;
  }

  return false;
}

function updateAttractorTracker(tracker: AttractorTracker, frame: Uint8Array, generation: number): void {
  if (tracker.generationStart === null) {
    tracker.generationStart = generation;
  }
  const gapAfterLastFrame = tracker.lastGeneration !== null && generation - tracker.lastGeneration !== 1;
  if (gapAfterLastFrame) {
    tracker.generationGapCount++;
  }

  if (tracker.active) {
    if (activeAttractorMatches(tracker.active, frame, generation)) {
      tracker.active.lastMatchingGeneration = generation;
      if (gapAfterLastFrame) {
        tracker.active.exact = false;
      }
      tracker.lastGeneration = generation;
      return;
    }

    finalizeActiveAttractor(tracker);
    resetAttractorCandidates(tracker);
  } else if (gapAfterLastFrame) {
    resetAttractorCandidates(tracker);
  }

  const hash = crc32(frame);
  if (!detectAttractor(tracker, frame, generation, hash)) {
    addAttractorCandidate(tracker, frame, generation, hash);
  }
  tracker.lastGeneration = generation;
}

// ---------------------------------------------------------------------------
//  Media helpers
// ---------------------------------------------------------------------------

function computeMediaDimensions(cols: number, rows: number, evenRequired: boolean): {width: number; height: number; scale: number} {
  const maxDim = 4096;
  const minDim = 480;
  const maxSide = Math.max(cols, rows);
  let scale: number;
  if (maxSide <= minDim) {
    scale = Math.max(1, Math.floor(minDim / maxSide));
  } else if (maxSide > maxDim) {
    scale = maxDim / maxSide;
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
//  Reused across every frame.  Bit depth is chosen adaptively (1/2/4/8)
//  Based on palette size, and each row is filtered with the PNG filter
//  That yields the smallest sum-of-absolute-values heuristic.
// ---------------------------------------------------------------------------

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

/**
 * Apply one of the 5 PNG row filters and return the minimum-sum heuristic.
 *
 * @param type
 * @param raw
 * @param prev
 * @param len
 * @param out
 * @param bestSoFar
 */
function applyRowFilter(type: number, raw: Uint8Array, prev: Uint8Array, len: number, out: Uint8Array, bestSoFar: number): number {
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const r = raw[i]!;
    let v: number;
    switch (type) {
      case 1: // Sub
        v = (r - (i > 0 ? raw[i - 1]! : 0)) & 0xFF;
        break;
      case 2: // Up
        v = (r - prev[i]!) & 0xFF;
        break;
      case 3: // Average
        v = (r - (((i > 0 ? raw[i - 1]! : 0) + prev[i]!) >>> 1)) & 0xFF;
        break;
      case 4: // Paeth
        v = (r - paethPredictor(i > 0 ? raw[i - 1]! : 0, prev[i]!, i > 0 ? prev[i - 1]! : 0)) & 0xFF;
        break;
      default: // None
        v = r;
    }
    out[i] = v;
    sum += v < 128 ? v : 256 - v;
    if (sum >= bestSoFar) {
      return sum;
    }
  }
  return sum;
}

/**
 * Pack one row of 8-bit palette indices into the target bit depth (MSB-first).
 *
 * @param src
 * @param srcOffset
 * @param cols
 * @param bitDepth
 * @param out
 */
function packRow(src: Uint8Array, srcOffset: number, cols: number, bitDepth: number, out: Uint8Array): void {
  if (bitDepth === 8) {
    out.set(src.subarray(srcOffset, srcOffset + cols));
    return;
  }
  out.fill(0);
  const ppb = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  for (let x = 0; x < cols; x++) {
    const byteIdx = (x / ppb) | 0;
    const shift = 8 - bitDepth - (x % ppb) * bitDepth;
    out[byteIdx] |= (src[srcOffset + x]! & mask) << shift;
  }
}

class IndexedPngEncoder {
  private readonly header: Uint8Array;

  private readonly iend: Uint8Array;

  private readonly cols: number;

  private readonly rows: number;

  private readonly rowBytes: number;

  private readonly rowStride: number;

  private readonly bitDepth: number;

  /**
   * Approximate memory used per concurrent encodeFrame call.
   */
  public get frameMemoryBytes(): number {
    return this.rows * this.rowStride;
  }

  public constructor(cols: number, rows: number, palette: number[][]) {
    this.cols = cols;
    this.rows = rows;

    const n = palette.length;
    if (n <= 2) {
      this.bitDepth = 1;
    } else if (n <= 4) {
      this.bitDepth = 2;
    } else if (n <= 16) {
      this.bitDepth = 4;
    } else {
      this.bitDepth = 8;
    }

    this.rowBytes = Math.ceil((cols * this.bitDepth) / 8);
    this.rowStride = 1 + this.rowBytes;

    this.header = IndexedPngEncoder.buildHeader(cols, rows, palette, this.bitDepth);
    this.iend = IndexedPngEncoder.wrapChunk('IEND', new Uint8Array(0));
  }

  /**
   * Safe for concurrent calls — all working buffers are allocated per call.
   *
   * @param frame
   */
  public async encodeFrame(frame: Uint8Array): Promise<Uint8Array> {
    const {cols, rows, rowBytes, rowStride, bitDepth} = this;
    const filtered = new Uint8Array(rows * rowStride);
    const needsPack = bitDepth !== 8;
    const packedRow = needsPack ? new Uint8Array(rowBytes) : null;
    const prevRow = new Uint8Array(rowBytes);
    const candidates = Array.from({length: 5}, () => new Uint8Array(rowBytes));

    for (let y = 0; y < rows; y++) {
      let rawRow: Uint8Array;
      if (needsPack) {
        packRow(frame, y * cols, cols, bitDepth, packedRow!);
        rawRow = packedRow!;
      } else {
        rawRow = frame.subarray(y * cols, y * cols + cols);
      }

      // Try all 5 PNG filters, pick the one with the smallest heuristic sum.
      // Early-termination: once a filter's running sum exceeds the current
      // Best it cannot win, so applyRowFilter bails out immediately.
      let bestFilter = 0;
      let bestSum = Infinity;
      for (let f = 0; f < 5; f++) {
        const sum = applyRowFilter(f, rawRow, prevRow, rowBytes, candidates[f]!, bestSum);
        if (sum < bestSum) {
          bestSum = sum;
          bestFilter = f;
        }
      }

      const offset = y * rowStride;
      filtered[offset] = bestFilter;
      filtered.set(candidates[bestFilter]!, offset + 1);
      prevRow.set(rawRow);
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

  private static buildHeader(cols: number, rows: number, palette: number[][], bitDepth: number): Uint8Array {
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

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, cols);
    ihdrView.setUint32(4, rows);
    ihdrData[8] = bitDepth; // Bit depth (1, 2, 4, or 8)
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
    ...popCols,
    ...popCols.map(k => `delta_${k}`),
    'alive_cells',
    'dead_cells',
    'occupancy',
    'shannon_entropy',
    'simpson_index',
    'same_state_contact_edges',
    'cross_state_contact_edges',
    'same_state_contact_fraction',
    'cross_state_contact_fraction',
    'changed_cells',
    'changed_fraction',
    'births',
    'deaths',
    'tribe_switches',
    'net_growth',
    ...frCols.map(k => `frontier_${k}`)
  ].join(',');
  const rows = metrics.map(m => [
    m.generation,
    ...popCols.map(k => m.population[k] ?? 0),
    ...popCols.map(k => m.populationDelta?.[k] ?? ''),
    m.aliveCells,
    m.deadCells,
    m.occupancy,
    m.shannonEntropy,
    m.simpsonIndex,
    m.sameStateContactEdges,
    m.crossStateContactEdges,
    m.sameStateContactFraction,
    m.crossStateContactFraction,
    csvValue(m.changedCells),
    csvValue(m.changedFraction),
    csvValue(m.births),
    csvValue(m.deaths),
    csvValue(m.tribeSwitches),
    csvValue(m.netGrowth),
    ...frCols.map(k => m.frontierLength?.[k] ?? 0)
  ].join(','));
  return [header, ...rows].join('\n');
}

function csvValue(value: number | null | undefined): string | number {
  return value ?? '';
}

function buildMetricsJson(metrics: MetricEntry[], metadata: {
  cols: number;
  rows: number;
  selectedStartFrame: number;
  selectedEndFrame: number;
  selectedFrameCount: number;
  generationGapCount: number;
  attractors: AttractorEpisode[];
}): string {
  const first = metrics[0] ?? null;
  const last = metrics[metrics.length - 1] ?? null;
  return JSON.stringify({
    generationStart: first?.generation ?? null,
    generationEnd: last?.generation ?? null,
    frameCount: metrics.length,
    cols: metadata.cols,
    rows: metadata.rows,
    selectedStartFrame: metadata.selectedStartFrame,
    selectedEndFrame: metadata.selectedEndFrame,
    selectedFrameCount: metadata.selectedFrameCount,
    generationGapCount: metadata.generationGapCount,
    attractors: metadata.attractors
  }, null, 2);
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
    } catch (e) {
      console.warn('Codec not supported:', codec, e);
    }
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
      } catch (e) {
        console.warn('Codec not supported at resolution:', codec, w, h, e);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
//  Streaming MP4 encoder
// ---------------------------------------------------------------------------

interface Mp4StreamEncoder {
  encodeFrame(frame: Uint8Array): Promise<void>;
  finalize(): Promise<ArrayBuffer | null>;
}

async function createMp4StreamEncoder(
  cols: number,
  rows: number,
  tribes: TribeInfo[],
  fps: number,
  bitrate: number,
  sharedImageData: ImageData
): Promise<Mp4StreamEncoder | null> {
  const {Output: outputCtor, Mp4OutputFormat: mp4OutputFormatCtor, BufferTarget: bufferTargetCtor, EncodedVideoPacketSource: encodedVideoPacketSourceCtor, EncodedPacket: encodedPacketCtor} = await import('mediabunny');

  const {width: idealW, height: idealH} = computeMediaDimensions(cols, rows, true);
  const found = await findVideoConfig(idealW, idealH, bitrate);
  if (!found) {
    return null;
  }

  const {config, width: vw, height: vh} = found;
  const renderScale = vw / cols;

  const target = new bufferTargetCtor();
  const output = new outputCtor({format: new mp4OutputFormatCtor({fastStart: 'in-memory'}), target});

  const videoSource = new encodedVideoPacketSourceCtor('avc');
  output.addVideoTrack(videoSource, {frameRate: fps});
  await output.start();

  const addPromises: Promise<void>[] = [];
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      addPromises.push(videoSource.add(encodedPacketCtor.fromEncodedChunk(chunk), meta));
    },
    error: e => console.error('VideoEncoder error', e)
  });

  encoder.configure(config);

  const colorMap = buildColorMap(tribes);
  const duration = 1_000_000 / fps;

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
    async encodeFrame(frame: Uint8Array): Promise<void> {
      renderFrameToImageData(frame, cols, rows, colorMap, mp4ImageData, vw, vh, renderScale);
      ctx.putImageData(mp4ImageData, 0, 0);
      const videoFrame = new VideoFrame(offscreen, {timestamp: frameIndex * duration, duration});
      encoder.encode(videoFrame);
      videoFrame.close();
      frameIndex++;
      // Backpressure: wait for the encoder to drain when the queue is too deep.
      if (encoder.encodeQueueSize > 10) {
        await new Promise<void>(resolve => (encoder.ondequeue = () => resolve()));
      }
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

function unpackGridToFrame(packed: Uint8Array, grid: Grid, gridFormat: GridFormatMetadata): Uint8Array {
  return unpackPackedBytesToFrame(packed, grid, gridFormatFromMetadata(gridFormat));
}

const OPFS_DIR = 'gol-recording';
const RAW_DEFLATE_CODEC = 'deflate-raw';

// ---------------------------------------------------------------------------
//  Chunk decompression (deflate-raw via DecompressionStream API)
// ---------------------------------------------------------------------------

async function decompressChunk(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream(RAW_DEFLATE_CODEC);
  const decompressed = new Blob([compressed]).stream().pipeThrough(ds);
  return new Response(decompressed).arrayBuffer();
}

// ---------------------------------------------------------------------------
//  Preflight estimation
// ---------------------------------------------------------------------------

const PART_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

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
    const needMetrics = opts.metrics;

    // -- Preflight ---------------------------------------------------------
    mainProgress(0, 'Preflight');
    subProgress(0, '');

    let totalFrames = 0;

    if (hasRecording) {
      for (const c of rec.manifest.chunks) {
        totalFrames += c.blockCount;
      }
    }
    const selectedStartIndex = opts.frameRange && totalFrames > 0 ?
      Math.max(0, Math.min(totalFrames - 1, opts.frameRange.startFrame - 1)) :
      0;
    const selectedEndIndex = opts.frameRange && totalFrames > 0 ?
      Math.max(selectedStartIndex, Math.min(totalFrames - 1, opts.frameRange.endFrame - 1)) :
      Math.max(0, totalFrames - 1);
    const selectedFrameCount = totalFrames > 0 ? selectedEndIndex - selectedStartIndex + 1 : 0;

    interface ChunkGlobalRange {chunkMeta: RecordingManifest['chunks'][number]; startIndex: number; endIndex: number}
    const chunkGlobalRanges: ChunkGlobalRange[] = [];
    if (hasRecording) {
      let nextStart = 0;
      for (const chunkMeta of rec.manifest.chunks) {
        const startIndex = nextStart;
        const endIndex = startIndex + chunkMeta.blockCount - 1;
        chunkGlobalRanges.push({
          chunkMeta,
          startIndex,
          endIndex
        });
        nextStart = endIndex + 1;
      }
    }
    const chunksToProcess = chunkGlobalRanges.filter(range =>
      selectedFrameCount > 0 && range.endIndex >= selectedStartIndex && range.startIndex <= selectedEndIndex).length;

    // -- Indexed PNG encoder ------------------------------------------------
    let pngEncoder: IndexedPngEncoder | null = null;
    if (hasRecording && opts.png) {
      pngEncoder = new IndexedPngEncoder(rec.cols, rec.rows, buildColorMap(tribes));
    }

    // -- MP4 encoder -------------------------------------------------------
    let mp4Encoder: Mp4StreamEncoder | null = null;
    if (hasRecording && opts.mp4) {
      mainProgress(1, 'Initializing MP4 encoder');
      try {
        const mp4ImgData = new ImageData(1, 1);
        mp4Encoder = await createMp4StreamEncoder(rec.cols, rec.rows, tribes, opts.fps, opts.bitrate, mp4ImgData);
      } catch (error) {
        console.warn('VideoEncoder not supported, skipping MP4:', error);
      }
    }

    // -- Metrics accumulator -----------------------------------------------
    const allMetrics: MetricEntry[] = [];
    const deadId = hasRecording ? tribes.find(t => t.id === DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID : DEAD_TRIBE_ID;
    let previousMetricFrame: {generation: number; frame: Uint8Array; population: Record<string, number>; aliveCells: number} | null = null;
    const attractorTracker = createAttractorTracker();

    // OPFS dir handle (opened once).
    let opfsDir: FileSystemDirectoryHandle | null = null;
    // Track first and last frame for state snapshots.
    let firstFrame: {gen: number; packed: Uint8Array; gridFormat: GridFormatMetadata} | null = null;

    // Progress budget: chunks 2-82%, metrics 85%, MP4 90%, finalize 95%.
    const chunkProgressStart = 2;
    const chunkProgressEnd = 82;
    const metricsProgress = 85;
    const mp4Progress = 90;
    const finalizeProgress = 95;

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
      }, [buf]);
      pngZip = new StreamingZip();
    }

    let chunksProcessed = 0;
    let selectedFramesProcessed = 0;

    if (hasRecording) {
      if (!opfsDir) {
        const root = await navigator.storage.getDirectory();
        opfsDir = await root.getDirectoryHandle(OPFS_DIR);
      }

      for (const chunkRange of chunkGlobalRanges) {
        const {chunkMeta, startIndex: chunkStartIndex, endIndex: chunkEndIndex} = chunkRange;
        const chunkInSelection = selectedFrameCount > 0 && chunkEndIndex >= selectedStartIndex && chunkStartIndex <= selectedEndIndex;
        if (!chunkInSelection) {
          continue;
        }
        const chunkGridFormat = gridFormatFromMetadata(chunkMeta.gridFormat);
        const chunkFrameByteSz = gridByteSize(rec, chunkGridFormat);
        chunksProcessed++;
        const pct = chunkProgressStart + ((chunksProcessed / Math.max(1, chunksToProcess)) * (chunkProgressEnd - chunkProgressStart));
        mainProgress(Math.round(pct), `Chunk ${chunksProcessed}/${Math.max(1, chunksToProcess)}`);

        subProgress(selectedFrameCount > 0 ? Math.round((selectedFramesProcessed / selectedFrameCount) * 100) : 0, 'Loading chunk');

        // OPFS handles can become stale during very long exports (browser GC,
        // Storage pressure).  If reading fails, re-acquire the directory
        // Handle and retry once before giving up.
        let storedData: ArrayBuffer;
        try {
          const fileHandle = await opfsDir.getFileHandle(chunkMeta.filename);
          const blob = await fileHandle.getFile();
          storedData = await blob.arrayBuffer();
        } catch (error) {
          console.warn('OPFS read failed, re-acquiring handle:', error);
          // Re-acquire OPFS directory handle and retry.
          const root = await navigator.storage.getDirectory();
          opfsDir = await root.getDirectoryHandle(OPFS_DIR);
          const fileHandle = await opfsDir.getFileHandle(chunkMeta.filename);
          const blob = await fileHandle.getFile();
          storedData = await blob.arrayBuffer();
        }

        // Use the recorded codec to decide whether OPFS data needs decompression.
        let chunkData: Uint8Array;
        if (chunkMeta.codec === 'deflate-raw') {
          chunkData = new Uint8Array(await decompressChunk(storedData));
        } else {
          chunkData = new Uint8Array(storedData);
        }

        // Process frames in batches: sequential work (unpack, metrics, MP4)
        // Runs per-frame, then PNG encoding runs in parallel across the batch.
        // Batch size scales down for large grids to cap parallel memory usage.
        const maxParallelMem = 512 * 1024 * 1024; // 512 MB
        const pngBatchSize = pngEncoder ?
          Math.max(1, Math.min(64, Math.floor(maxParallelMem / pngEncoder.frameMemoryBytes))) :
          64;
        for (let batchStart = 0; batchStart < chunkMeta.blockCount; batchStart += pngBatchSize) {
          const batchEnd = Math.min(batchStart + pngBatchSize, chunkMeta.blockCount);
          const selectedBatchStart = Math.max(batchStart, selectedStartIndex - chunkStartIndex);
          const selectedBatchEnd = Math.min(batchEnd - 1, selectedEndIndex - chunkStartIndex);
          if (selectedBatchStart > selectedBatchEnd) {
            continue;
          }

          const pngFramesBatch: {gen: number; frame: Uint8Array}[] = [];

          const batchFirstGen = chunkMeta.generations[selectedBatchStart] ?? (chunkMeta.generationStart + selectedBatchStart);
          const batchLastGen = chunkMeta.generations[selectedBatchEnd] ?? (chunkMeta.generationStart + selectedBatchEnd);
          subProgress(
            selectedFrameCount > 0 ? Math.round((selectedFramesProcessed / selectedFrameCount) * 100) : 0,
            `Processing frames gen ${batchFirstGen}–${batchLastGen}`
          );

          for (let fi = selectedBatchStart; fi <= selectedBatchEnd; fi++) {
            const frameGen = chunkMeta.generations[fi] ?? (chunkMeta.generationStart + fi);
            const frameGlobalIndex = chunkStartIndex + fi;
            selectedFramesProcessed++;

            const byteOff = fi * chunkFrameByteSz;
            const packed = chunkData.subarray(byteOff, byteOff + chunkFrameByteSz);
            const frame = unpackGridToFrame(packed, rec, chunkMeta.gridFormat);

            // Capture the first selected frame exactly once.
            if (!firstFrame && frameGlobalIndex === selectedStartIndex) {
              firstFrame = {
                gen: frameGen,
                packed: new Uint8Array(packed),
                gridFormat: chunkMeta.gridFormat
              };
            }

            if (needMetrics) {
              const metrics = computeFrameMetrics(frame, rec.cols, rec.rows, tribes, deadId, frameGen, previousMetricFrame);
              updateAttractorTracker(attractorTracker, frame, frameGen);
              allMetrics.push(metrics);
              previousMetricFrame = {
                generation: frameGen,
                frame,
                population: metrics.population,
                aliveCells: metrics.aliveCells
              };
            }

            if (mp4Encoder) {
              try {
                await mp4Encoder.encodeFrame(frame);
              } catch (error) {
              // Frame encoding failed — discard MP4 for the rest of the export.
                console.warn('MP4 frame encoding failed, disabling MP4:', error);
                mp4Encoder = null;
              }
            }

            if (pngEncoder && pngZip) {
              pngFramesBatch.push({gen: frameGen, frame});
            }
          }

          // Encode PNG frames in parallel within this batch.
          if (pngEncoder && pngZip && pngFramesBatch.length > 0) {
            const pngResults = await Promise.all(pngFramesBatch.map(w => pngEncoder.encodeFrame(w.frame)));
            for (let j = 0; j < pngResults.length; j++) {
              pngZip.addEntry(`frames/${pngFramesBatch[j]!.gen}.png`, pngResults[j]!);
            }
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
    const subStates = 20;
    const subMetrics = 40;
    const subMp4 = 80;
    const subFinalize = 95;

    // States: first and last generation frames saved as .golt binary files.
    if (opts.saves && hasRecording && firstFrame) {
      mainProgress(metricsProgress, 'Writing states');
      subProgress(subStates, 'Building first-gen state');

      // FirstFrame.packed is in the recording's native packed format.
      // Reuse the underlying bytes without an extra copy when alignment allows.
      const firstU32 = alignPackedBytesToWords(firstFrame.packed);
      summaryZip.addEntry(
        `state-first-gen${firstFrame.gen}.golt`,
        await buildGoltStateFile({
          generation: firstFrame.gen,
          cols: rec.cols,
          rows: rec.rows,
          grid: firstU32,
          gridFormat: firstFrame.gridFormat,
          tribes,
          rules
        })
      );

      // Use snapshot grid for the last-gen state — it's the current GPU state in native format.
      if (snapshot.generation !== firstFrame.gen) {
        subProgress(subStates + 10, 'Building last-gen state');
        summaryZip.addEntry(
          `state-last-gen${snapshot.generation}.golt`,
          await buildGoltStateFile({
            generation: snapshot.generation,
            cols: snapshot.cols,
            rows: snapshot.rows,
            grid: snapshot.grid,
            gridFormat: snapshot.gridFormat,
            tribes,
            rules
          })
        );
      }
    } else if (opts.saves) {
    // No recording -- save the current snapshot state.
      mainProgress(metricsProgress, 'Writing state');
      subProgress(subStates, 'Building snapshot state');
      summaryZip.addEntry(
        `state-gen${snapshot.generation}.golt`,
        await buildGoltStateFile({
          generation: snapshot.generation,
          cols: snapshot.cols,
          rows: snapshot.rows,
          grid: snapshot.grid,
          gridFormat: snapshot.gridFormat,
          tribes,
          rules
        })
      );
    }

    // Metrics.
    subProgress(subMetrics, 'Writing metrics');
    if (needMetrics && allMetrics.length > 0) {
      finalizeActiveAttractor(attractorTracker);
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(allMetrics)));
      summaryZip.addEntry('metrics.json', textEncoder.encode(buildMetricsJson(allMetrics, {
        cols: rec.cols,
        rows: rec.rows,
        selectedStartFrame: selectedStartIndex + 1,
        selectedEndFrame: selectedEndIndex + 1,
        selectedFrameCount,
        generationGapCount: attractorTracker.generationGapCount,
        attractors: attractorTracker.attractors
      })));
    } else if (needMetrics && metricsHistory.length > 0) {
      summaryZip.addEntry('metrics.csv', textEncoder.encode(buildCsvFromMetrics(metricsHistory)));
      summaryZip.addEntry('metrics.json', textEncoder.encode(buildMetricsJson(metricsHistory, {
        cols: snapshot.cols,
        rows: snapshot.rows,
        selectedStartFrame: 1,
        selectedEndFrame: metricsHistory.length,
        selectedFrameCount: metricsHistory.length,
        generationGapCount: metricsHistory.filter((m, i) => i > 0 && m.generation - metricsHistory[i - 1]!.generation !== 1).length,
        attractors: []
      })));
    }

    // MP4.
    if (mp4Encoder) {
      mainProgress(mp4Progress, 'Finalizing MP4');
      subProgress(subMp4, 'Encoding MP4');
      try {
        const mp4Buffer = await mp4Encoder.finalize();
        if (mp4Buffer) {
          summaryZip.addEntry('recording.mp4', new Uint8Array(mp4Buffer));
        }
      } catch (error) {
        console.warn('MP4 encoder finalization failed:', error);
      }
    }

    // Finalize summary zip.
    mainProgress(finalizeProgress, 'Building final archive');
    const isMultiPart = pngPartsEmitted > 0;
    subProgress(subFinalize, isMultiPart ? 'Building summary archive' : 'Building archive');
    const summaryBuf = summaryZip.finalize();
    const summaryFilename = isMultiPart ? 'gol-export-summary.zip' : 'gol-export.zip';
    self.postMessage({
      type: 'done-part',
      buffer: summaryBuf,
      filename: summaryFilename
    }, [summaryBuf]);

    mainProgress(100, 'Done');
    subProgress(100, 'Done');
    self.postMessage({type: 'done'});
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    self.postMessage({type: 'error', reason});
  }
};
