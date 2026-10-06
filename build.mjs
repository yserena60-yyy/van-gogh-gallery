import { copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCollection } from './collection.js';
import { validateStoryExhibit } from './story-data.js';
import { assembleMedia } from './assemble-media.mjs';
import { validateHallTexts } from './hall-texts.js';
import { validateArtworkCards } from './artwork-cards.js';
import { validateAfterlife } from './afterlife.js';
import { addFirstHallTourStops, HIGHLIGHT_TOUR_SECONDS, retimeHighlightTour } from './highlight-route.js';
import { validateYellowHouse } from './yellow-house-data.js';

const root = path.dirname(fileURLToPath(import.meta.url));
await assembleMedia(root);
const destination = path.resolve(root, 'dist');
const artworks = JSON.parse(await readFile(path.join(root, 'data/artworks_en.json'), 'utf8'));
const collection = JSON.parse(await readFile(path.join(root, 'data/collection_en.json'), 'utf8'));
const installedCount = validateCollection(collection);
const artworkCards = JSON.parse(await readFile(path.join(root, 'data/artwork_cards_en.json'), 'utf8'));
const artworkCardCount = validateArtworkCards(artworkCards, collection);
const artworkChapterCount = Object.values(artworkCards.cards).reduce((count, card) => count + card.stories.length, 0);
const artworkSeriesChapterCount = Object.values(artworkCards.cards).reduce((count, card) => count + (card.seriesReading?.stories.length ?? 0), 0);
const story = JSON.parse(await readFile(path.join(root, 'data/story_exhibit_en.json'), 'utf8'));
const storyCounts = validateStoryExhibit(story);
const highlightRoute = retimeHighlightTour(addFirstHallTourStops(JSON.parse(await readFile(path.join(root, 'data/ordered_route_v28.json'), 'utf8')), story.station));
if (highlightRoute.duration !== HIGHLIGHT_TOUR_SECONDS || highlightRoute.camera.waypoints.at(-1).time !== HIGHLIGHT_TOUR_SECONDS || highlightRoute.camera.exhibitStops.length !== 2) throw new Error('Invalid Highlights tour duration or first-hall stops.');
const wallTexts = JSON.parse(await readFile(path.join(root, 'data/hall_introductions_en.json'), 'utf8'));
const wallTextCount = validateHallTexts(wallTexts);
const afterlife = JSON.parse(await readFile(path.join(root, 'data/afterlife_en.json'), 'utf8'));
const afterlifeCount = validateAfterlife(afterlife);
const yellowHouse = JSON.parse(await readFile(path.join(root, 'data/yellow_house_en.json'), 'utf8'));
const yellowHouseCount = validateYellowHouse(yellowHouse, collection);
const yellowHouseImages = (yellowHouse.media ?? []).map((media) => media.image);
const storyImages = [...new Set([story.image, story.poster, ...story.topics.map((topic) => topic.image), ...story.chapters.map((chapter) => chapter.image), ...story.materials.map((material) => material.image), ...story.sources.map((source) => source.localImage)].filter(Boolean))];
const images = [...new Set([...Object.values(artworks), ...Object.values(collection.works)].map((artwork) => artwork.image))];
const siteFiles = [
  'style.css',
  'viewer.js',
  'i18n.js',
  'visit-guide.js',
  'locale-zh-visit.js',
  'locale-zh.js',
  'locale-zh-miners.js',
  'locale-zh-drawing.js',
  'locale-zh-attachment.js',
  'locale-zh-yellow-house.js',
  'locale-zh-titles.js',
  'locale-zh-artwork-labels.js',
  'gallery-entry.js',
  'artwork-cards.js',
  'data/artwork_cards_en.json',
  'opening-film.js',
  'hall-texts.js',
  'data/hall_introductions_en.json',
  'afterlife.js',
  'data/afterlife_en.json',
  'yellow-house.js',
  'yellow-house-data.js',
  'data/yellow_house_en.json',
  ...yellowHouseImages,
  ...new Set([...afterlife.cards, ...afterlife.responses].map((card) => card.image).filter((image) => image && !images.includes(image))),
  'collection.js',
  'collection-tour.js',
  'highlight-route.js',
  'story.js',
  'story-data.js',
  'data/story_exhibit_en.json',
  'data/story_image_credits.json',
  'data/story_source_audit.json',
  'data/story_transition_layout.json',
  'data/film_credits.json',
  story.model.split('?')[0].replace(/^\.\//, ''),
  ...storyImages,
  'data/artworks_en.json',
  'data/chapters_en.json',
  'data/ordered_route_v28.json',
  'data/collection_en.json',
  'data/collection_audit.json',
  'assets/gallery_v28.glb',
  'assets/van-gogh-early-years.mp4',
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
console.log(`Authored artwork cards: ${artworkCardCount} main labels, ${artworkChapterCount} story chapters and ${artworkSeriesChapterCount} optional series chapters, with details, looking prompts and source records.`);
console.log(`Wall texts: ${wallTextCount - 1} physical reading locations, with the entrance reflection presented in the interactive opening.`);
console.log(`Afterlife: ${afterlifeCount} physical archival cards, ${afterlife.sections.length} reading sections and ${afterlife.responses.length} digital responses in independent Hall 08. Visitor reflections stay in local browser storage only.`);
console.log(`Yellow House: ${yellowHouseCount.chapters} chapters, ${yellowHouseCount.connections} artwork connections, ${yellowHouseCount.evidence} optional evidence comparisons and ${yellowHouseCount.sources} source records across Halls 04–06.`);
console.log(`Early life: ${storyCounts.topics} topics, ${storyCounts.mainChapters} main chapters, ${storyCounts.chapters - storyCounts.mainChapters} optional branches, ${storyCounts.materials} materials and ${storyCounts.sources} credited source records.`);
console.log(`${installedCount} installed works; ${Object.keys(artworks).length} highlight positions; ${images.length} images; ${copies.length + 2} files; ${(totalBytes / 1024 / 1024).toFixed(1)} MiB.`);
