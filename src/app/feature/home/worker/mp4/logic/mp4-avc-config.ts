import {AvcLevelCandidate, AvcProfileCandidate, SupportedMp4VideoConfig} from '../model/mp4-avc-types';
import {Mp4FrameExportOptions} from '../model/mp4-frame-export-types';
import {Mp4OutputSize} from '../model/mp4-types';

/**
 * AVC profile candidates ordered from highest quality to lowest.
 *
 * @type {readonly AvcProfileCandidate[]}
 */
const AVC_PROFILE_CANDIDATES: readonly AvcProfileCandidate[] = [
  {
    name: 'High',
    ppcc: '6400'
  },
  {
    name: 'Main',
    ppcc: '4D00'
  },
  {
    name: 'Constrained Baseline',
    ppcc: '42E0'
  },
  {
    name: 'Baseline',
    ppcc: '4200'
  }
] as const;

/**
 * AVC level candidates sorted lowest to highest.
 *
 * @type {readonly AvcLevelCandidate[]}
 */
const AVC_LEVEL_CANDIDATES: readonly AvcLevelCandidate[] = [
  {
    label: '3.1',
    hex: '1F',
    maxMacroblocksPerFrame: 3600,
    maxMacroblocksPerSecond: 108000
  },
  {
    label: '4.0',
    hex: '28',
    maxMacroblocksPerFrame: 8192,
    maxMacroblocksPerSecond: 245760
  },
  {
    label: '4.1',
    hex: '29',
    maxMacroblocksPerFrame: 8192,
    maxMacroblocksPerSecond: 245760
  },
  {
    label: '4.2',
    hex: '2A',
    maxMacroblocksPerFrame: 8704,
    maxMacroblocksPerSecond: 522240
  },
  {
    label: '5.0',
    hex: '32',
    maxMacroblocksPerFrame: 22080,
    maxMacroblocksPerSecond: 589824
  },
  {
    label: '5.1',
    hex: '33',
    maxMacroblocksPerFrame: 36864,
    maxMacroblocksPerSecond: 983040
  },
  {
    label: '5.2',
    hex: '34',
    maxMacroblocksPerFrame: 36864,
    maxMacroblocksPerSecond: 2073600
  },
  {
    label: '6.0',
    hex: '3C',
    maxMacroblocksPerFrame: 139264,
    maxMacroblocksPerSecond: 4177920
  },
  {
    label: '6.1',
    hex: '3D',
    maxMacroblocksPerFrame: 139264,
    maxMacroblocksPerSecond: 8355840
  },
  {
    label: '6.2',
    hex: '3E',
    maxMacroblocksPerFrame: 139264,
    maxMacroblocksPerSecond: 16711680
  }
] as const;

/**
 * Fallback MP4 output dimension alignment.
 *
 * @type {number}
 */
const MP4_SIZE_ALIGNMENT = 16;

/**
 * Minimum output pixel count considered worth encoding after reductions.
 *
 * @type {number}
 */
const MP4_MIN_OUTPUT_PIXELS = 128 * 128;

/**
 * Finds the largest supported AVC output size below the requested size.
 *
 * @async
 * @param {Mp4OutputSize} initialOutputSize largest candidate output size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<(SupportedMp4VideoConfig | null)>} largest supported config, if one exists.
 */
async function findLargestSupportedAvcConfig(initialOutputSize: Mp4OutputSize, options: Mp4FrameExportOptions): Promise<SupportedMp4VideoConfig | null> {
  let lowLongSideUnits = 1;
  let highLongSideUnits = Math.floor(Math.max(initialOutputSize.width, initialOutputSize.height) / MP4_SIZE_ALIGNMENT) - 1;
  let supported: SupportedMp4VideoConfig | null = null;
  let probes = 0;
  while (lowLongSideUnits <= highLongSideUnits) {
    const midpointUnits = Math.floor((lowLongSideUnits + highLongSideUnits) / 2);
    const candidateLongSide = midpointUnits * MP4_SIZE_ALIGNMENT;
    const candidateOutputSize = createFallbackMp4OutputSize(initialOutputSize, candidateLongSide);
    if (isSensibleMp4Size(candidateOutputSize)) {
      probes++;
      const candidate = await tryResolveSupportedAvcConfigForSize(candidateOutputSize, options);
      if (candidate) {
        supported = candidate;
        lowLongSideUnits = midpointUnits + 1;
      } else {
        highLongSideUnits = midpointUnits - 1;
      }
    } else {
      lowLongSideUnits = midpointUnits + 1;
    }
  }
  console.log('[GOLT] MP4 encoder size search completed', {
    requestedWidth: initialOutputSize.width,
    requestedHeight: initialOutputSize.height,
    selectedWidth: supported?.outputSize.width ?? null,
    selectedHeight: supported?.outputSize.height ?? null,
    probes
  });
  return supported;
}

/**
 * Tries to resolve one supported AVC config for the current output size.
 *
 * @async
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<(SupportedMp4VideoConfig | null)>} supported config, if one exists.
 */
async function tryResolveSupportedAvcConfigForSize(outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): Promise<SupportedMp4VideoConfig | null> {
  let supported: SupportedMp4VideoConfig | null = null;
  const levels = getAvcLevelsSupportingConfig(outputSize.width, outputSize.height, options.fps);
  for (const profile of AVC_PROFILE_CANDIDATES) {
    for (const level of levels) {
      const codec = `avc1.${profile.ppcc}${level.hex}`;
      const candidate = await probeAvcConfig(codec, profile, level, outputSize, options);
      if (candidate) {
        supported = candidate;
        break;
      }
    }
    if (supported) {
      break;
    }
  }
  return supported;
}

/**
 * Probes one generated AVC encoder config.
 *
 * @async
 * @param {string} codec avc codec string.
 * @param {AvcProfileCandidate} profile avc profile candidate.
 * @param {AvcLevelCandidate} level avc level candidate.
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<(SupportedMp4VideoConfig | null)>} supported config, if this codec is accepted.
 */
async function probeAvcConfig(codec: string, profile: AvcProfileCandidate, level: AvcLevelCandidate, outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): Promise<SupportedMp4VideoConfig | null> {
  let supported: SupportedMp4VideoConfig | null = null;
  const config = createAvcConfig(codec, outputSize, options);
  try {
    const result = await VideoEncoder.isConfigSupported(config);
    if (result.supported) {
      supported = {
        config: result.config ?? config,
        codec,
        profile: profile.name,
        level: level.label,
        outputSize
      };
    }
  } catch (error) {
    console.warn('[GOLT] MP4 AVC support check failed for codec candidate:', codec, error);
  }
  return supported;
}

/**
 * Gets AVC levels supporting the output dimensions and frame rate.
 *
 * @param {number} width output width.
 * @param {number} height output height.
 * @param {number} fps frames per second.
 * @returns {readonly AvcLevelCandidate[]} sufficient AVC levels.
 */
function getAvcLevelsSupportingConfig(width: number, height: number, fps: number): readonly AvcLevelCandidate[] {
  const macroblocksPerFrame = Math.ceil(width / 16) * Math.ceil(height / 16);
  const macroblocksPerSecond = macroblocksPerFrame * fps;
  return AVC_LEVEL_CANDIDATES.filter(level => macroblocksPerFrame <= level.maxMacroblocksPerFrame && macroblocksPerSecond <= level.maxMacroblocksPerSecond);
}

/**
 * Creates an aligned MP4 fallback candidate for a target long side.
 *
 * @param {Mp4OutputSize} size largest candidate output size.
 * @param {number} longSide target long-side dimension.
 * @returns {Mp4OutputSize} fallback output size.
 */
function createFallbackMp4OutputSize(size: Mp4OutputSize, longSide: number): Mp4OutputSize {
  const scale = longSide / Math.max(size.width, size.height);
  let width: number;
  let height: number;
  if (size.xClamped && !size.yClamped) {
    width = longSide;
    height = size.height;
  } else if (size.yClamped && !size.xClamped) {
    width = size.width;
    height = longSide;
  } else {
    width = Math.round(size.width * scale);
    height = Math.round(size.height * scale);
  }
  width = makeMultipleOf16Floor(Math.min(size.width, width));
  height = makeMultipleOf16Floor(Math.min(size.height, height));
  return {
    ...size,
    width,
    height,
    xScale: size.sourceCols / width,
    yScale: size.sourceRows / height
  };
}

/**
 * Checks whether an MP4 output size is still sensible.
 *
 * @param {Mp4OutputSize} size output size.
 * @returns {boolean} true when probing should continue.
 */
function isSensibleMp4Size(size: Mp4OutputSize): boolean {
  return size.width >= 2 && size.height >= 2 && size.width * size.height >= MP4_MIN_OUTPUT_PIXELS;
}

/**
 * Converts a dimension to a 16-aligned integer.
 *
 * @param {number} value dimension value.
 * @returns {number} aligned dimension value.
 */
function makeMultipleOf16Floor(value: number): number {
  const multiple = value - (value % MP4_SIZE_ALIGNMENT);
  return multiple >= MP4_SIZE_ALIGNMENT ? multiple : 2;
}

/**
 * Creates one AVC encoder config.
 *
 * @param {string} codec avc codec string.
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {VideoEncoderConfig} encoder config.
 */
function createAvcConfig(codec: string, outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): VideoEncoderConfig {
  return {
    codec,
    width: outputSize.width,
    height: outputSize.height,
    bitrate: options.bitrate,
    framerate: options.fps,
    avc: {
      format: 'avc'
    },
    hardwareAcceleration: 'prefer-hardware'
  };
}

/**
 * Checks that WebCodecs VideoEncoder exists.
 */
export function assertVideoEncoderAvailable(): void {
  if (typeof VideoEncoder === 'undefined') {
    console.error('[GOLT] MP4 export requires WebCodecs VideoEncoder, which is unavailable in this browser.');
    throw new Error('MP4 export requires WebCodecs VideoEncoder, which is unavailable in this browser.');
  }
}

/**
 * Resolves a supported H.264/AVC encoder config.
 *
 * @async
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<SupportedMp4VideoConfig>} supported config.
 */
export async function resolveSupportedAvcConfig(outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): Promise<SupportedMp4VideoConfig> {
  const initialOutputSize = outputSize;
  let supported = await tryResolveSupportedAvcConfigForSize(initialOutputSize, options);
  if (!supported) {
    console.warn('[GOLT] MP4 export unsupported at initial size; searching for largest supported output', {
      width: initialOutputSize.width,
      height: initialOutputSize.height,
      fps: options.fps,
      bitrate: options.bitrate
    });
    supported = await findLargestSupportedAvcConfig(initialOutputSize, options);
  }
  if (!supported) {
    const reason = 'H.264/AVC MP4 export is unsupported in this browser, even after reducing output size.';
    console.error('[GOLT] MP4 export unsupported:', {
      requestedWidth: initialOutputSize.width,
      requestedHeight: initialOutputSize.height,
      fps: options.fps,
      bitrate: options.bitrate
    });
    throw new Error(reason);
  }
  if (supported.outputSize.width !== initialOutputSize.width || supported.outputSize.height !== initialOutputSize.height) {
    console.warn('[GOLT] MP4 export size reduced for encoder support', {
      requestedWidth: initialOutputSize.width,
      requestedHeight: initialOutputSize.height,
      selectedWidth: supported.outputSize.width,
      selectedHeight: supported.outputSize.height,
      codec: supported.codec,
      profile: supported.profile,
      level: supported.level,
      fps: options.fps,
      bitrate: options.bitrate
    });
  }
  return supported;
}
