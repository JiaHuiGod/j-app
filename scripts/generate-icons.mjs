import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(projectRoot, 'public/favicon.svg');
const outputDirectory = path.join(projectRoot, 'resources');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICNS_ENTRIES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

async function renderPng(svg, size) {
  const density = Math.max(72, Math.ceil((size / 64) * 72));

  return sharp(svg, { density })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function createIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  const entries = [];
  const payloads = [];
  let offset = header.length + frames.length * 16;

  for (const { size, data } of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    payloads.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...payloads]);
}

function createIcns(entries) {
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');

  const chunks = [];
  let totalLength = header.length;

  for (const [type, data] of entries) {
    const entryHeader = Buffer.alloc(8);
    entryHeader.write(type, 0, 'ascii');
    entryHeader.writeUInt32BE(data.length + entryHeader.length, 4);
    chunks.push(entryHeader, data);
    totalLength += entryHeader.length + data.length;
  }

  header.writeUInt32BE(totalLength, 4);
  return Buffer.concat([header, ...chunks]);
}

const svg = await readFile(source);
await mkdir(outputDirectory, { recursive: true });

const png = await renderPng(svg, 512);
await writeFile(path.join(outputDirectory, 'icon.png'), png);

const icoFrames = await Promise.all(
  ICO_SIZES.map(async (size) => ({
    size,
    data: await renderPng(svg, size),
  })),
);
await writeFile(path.join(outputDirectory, 'icon.ico'), createIco(icoFrames));

const icnsEntries = await Promise.all(
  ICNS_ENTRIES.map(async ([type, size]) => [type, await renderPng(svg, size)]),
);
await writeFile(
  path.join(outputDirectory, 'icon.icns'),
  createIcns(icnsEntries),
);

console.log(
  `Generated icon.png (512), icon.ico (${ICO_SIZES.join(', ')}) and icon.icns (${ICNS_ENTRIES.length} entries).`,
);
