import {Mp4OutputSize} from './mp4-types';

/**
 * AVC profile candidate.
 *
 * @interface AvcProfileCandidate
 * @typedef {AvcProfileCandidate}
 */
export interface AvcProfileCandidate {
  /**
   * Profile display name.
   *
   * @type {string}
   */
  name: string;
  /**
   * Profile and constraint bytes.
   *
   * @type {string}
   */
  ppcc: string;
}

/**
 * AVC level candidate.
 *
 * @interface AvcLevelCandidate
 * @typedef {AvcLevelCandidate}
 */
export interface AvcLevelCandidate {
  /**
   * Level display label.
   *
   * @type {string}
   */
  label: string;
  /**
   * Level hex byte.
   *
   * @type {string}
   */
  hex: string;
  /**
   * Maximum macroblocks per frame.
   *
   * @type {number}
   */
  maxMacroblocksPerFrame: number;
  /**
   * Maximum macroblocks per second.
   *
   * @type {number}
   */
  maxMacroblocksPerSecond: number;
}

/**
 * Supported VideoEncoder config result.
 *
 * @interface SupportedMp4VideoConfig
 * @typedef {SupportedMp4VideoConfig}
 */
export interface SupportedMp4VideoConfig {
  /**
   * Supported WebCodecs encoder config.
   *
   * @type {VideoEncoderConfig}
   */
  config: VideoEncoderConfig;
  /**
   * Codec string accepted by the browser.
   *
   * @type {string}
   */
  codec: string;
  /**
   * Selected AVC profile.
   *
   * @type {string}
   */
  profile: string;
  /**
   * Selected AVC level.
   *
   * @type {string}
   */
  level: string;
  /**
   * Selected output size.
   *
   * @type {Mp4OutputSize}
   */
  outputSize: Mp4OutputSize;
}
