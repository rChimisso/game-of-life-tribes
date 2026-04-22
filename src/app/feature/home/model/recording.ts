import {GridFormatMetadata} from './grid-format';

export interface ChunkMeta {
  chunkId: number;
  generationStart: number;
  generationEnd: number;
  blockCount: number;
  codec: string;
  uncompressedBytes: number;
  storedBytes: number;
  gridFormat: GridFormatMetadata;
  generations: number[];
  filename: string;
}

export interface RecordingManifest {
  chunks: ChunkMeta[];
  generationStart: number;
  generationEnd: number;
  gridFormat: GridFormatMetadata;
}
