import { copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(root, 'dist');
const artworks = JSON.parse(await readFile(path.join(root, 'data/artworks_en.json'), 'utf8'));
const images = [...new Set(Object.values(artworks).map((artwork) => artwork.image))];
const siteFiles = [
  'style.css',
  'viewer.js',
  'data/artworks_en.json',
  'data/chapters_en.json',
  'data/ordered_route_v16.json',
  'assets/gallery_v16.glb',
  ...images,
];
const threeFiles = [
  'build/three.module.js',
  'build/three.core.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/utils/BufferGeometryUtils.js',
  'LICENSE',
];
const copies = [
  ...siteFiles.map((file) => ({ source: file, target: file })),
  ...threeFiles.map((file) => ({
    source: `node_modules/three/${file}`,
    target: `vendor/three/${file}`,
  })),
];

function inside(directory, file) {
  if (typeof file !== 'string' || path.isAbsolute(file)) {
    throw new Error(`Expected a relative resource path: ${file}`);
  }
  const resolved = path.resolve(directory, file);
  const relative = path.relative(directory, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Resource is outside its allowed directory: ${file}`);
  }
  return resolved;
}

for (const image of images) {
  if (typeof image !== 'string' || !/^\.\/assets\/[a-z0-9-]+\.jpg$/.test(image)) {
    throw new Error(`Unexpected artwork image path: ${image}`);
  }
}

const html = await readFile(path.join(root, 'index.html'), 'utf8');
const productionHtml = html.replaceAll('./node_modules/three/', './vendor/three/');
if (productionHtml === html || productionHtml.includes('./node_modules/')) {
  throw new Error('The production import map could not be generated.');
}

let totalBytes = Buffer.byteLength(productionHtml);
for (const copy of copies) {
  const source = inside(root, copy.source);
  const resolvedSource = await realpath(source);
  inside(root, path.relative(root, resolvedSource));
  const details = await stat(source);
  if (!details.isFile()) {
    throw new Error(`Resource is not a file: ${copy.source}`);
  }
  inside(destination, copy.target);
  totalBytes += details.size;
}

if (path.dirname(destination) !== root || path.basename(destination) !== 'dist') {
  throw new Error('Refusing to clear a build directory outside this project.');
}
try {
  if (await realpath(destination) !== destination) {
    throw new Error('Refusing to clear a linked build directory.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const copy of copies) {
  const target = inside(destination, copy.target);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(inside(root, copy.source), target);
}
await writeFile(path.join(destination, 'index.html'), productionHtml);
await writeFile(path.join(destination, '.nojekyll'), '');

console.log(`Static gallery ready: ${destination}`);
console.log(`${Object.keys(artworks).length} artwork records; ${images.length} images; ${copies.length + 2} files; ${(totalBytes / 1024 / 1024).toFixed(1)} MiB.`);
