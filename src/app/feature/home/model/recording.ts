export interface ChunkMeta {
  chunkId: number;
  generationStart: number;
  generationEnd: number;
  blockCount: number;
  codec: string;
  uncompressedBytes: number;
  storedBytes: number;
  generations: number[];
  filename: string;
}

export interface RecordingManifest {
  chunks: ChunkMeta[];
  generationStart: number;
  generationEnd: number;
}
