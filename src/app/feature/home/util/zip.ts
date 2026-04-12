/* eslint-disable jsdoc/require-jsdoc */

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

// CRC-32 lookup table.
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

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const fileNames = entries.map(e => encoder.encode(e.path));

  // Calculate sizes.
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

  // Write local file headers + data.
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const name = fileNames[i]!;
    const crc = crc32(entry.data);

    localOffsets.push(offset);

    writeU32(view, offset, 0x04034b50); // Local file header signature
    writeU16(view, offset + 4, 20); // Version needed
    writeU16(view, offset + 6, 0); // Flags
    writeU16(view, offset + 8, 0); // Compression (stored)
    writeU16(view, offset + 10, 0); // Last mod time
    writeU16(view, offset + 12, 0); // Last mod date
    writeU32(view, offset + 14, crc); // CRC-32
    writeU32(view, offset + 18, entry.data.length); // Compressed size
    writeU32(view, offset + 22, entry.data.length); // Uncompressed size
    writeU16(view, offset + 26, name.length); // Filename length
    writeU16(view, offset + 28, 0); // Extra field length
    offset += 30;

    bytes.set(name, offset);
    offset += name.length;

    bytes.set(entry.data, offset);
    offset += entry.data.length;
  }

  // Write central directory.
  const centralDirOffset = offset;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const name = fileNames[i]!;
    const crc = crc32(entry.data);

    writeU32(view, offset, 0x02014b50); // Central directory signature
    writeU16(view, offset + 4, 20); // Version made by
    writeU16(view, offset + 6, 20); // Version needed
    writeU16(view, offset + 8, 0); // Flags
    writeU16(view, offset + 10, 0); // Compression
    writeU16(view, offset + 12, 0); // Last mod time
    writeU16(view, offset + 14, 0); // Last mod date
    writeU32(view, offset + 16, crc); // CRC-32
    writeU32(view, offset + 20, entry.data.length); // Compressed size
    writeU32(view, offset + 24, entry.data.length); // Uncompressed size
    writeU16(view, offset + 28, name.length); // Filename length
    writeU16(view, offset + 30, 0); // Extra field length
    writeU16(view, offset + 32, 0); // File comment length
    writeU16(view, offset + 34, 0); // Disk number start
    writeU16(view, offset + 36, 0); // Internal file attributes
    writeU32(view, offset + 38, 0); // External file attributes
    writeU32(view, offset + 42, localOffsets[i]!); // Relative offset
    offset += 46;

    bytes.set(name, offset);
    offset += name.length;
  }

  // End of central directory.
  writeU32(view, offset, 0x06054b50); // EOCD signature
  writeU16(view, offset + 4, 0); // Disk number
  writeU16(view, offset + 6, 0); // Central directory start disk
  writeU16(view, offset + 8, entries.length); // Entries on this disk
  writeU16(view, offset + 10, entries.length); // Total entries
  writeU32(view, offset + 12, centralDirSize); // Central directory size
  writeU32(view, offset + 16, centralDirOffset); // Central directory offset
  writeU16(view, offset + 20, 0); // Comment length

  return new Blob([buffer], {type: 'application/zip'});
}
