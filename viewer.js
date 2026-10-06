import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitPainting, locateWork, readingOrder, validateCollection } from './collection.js';
import { createCollectionTour } from './collection-tour.js?v=2026-10-02-full-collection-tour';
import { createStoryReader } from './story.js?v=2026-10-06-attachment-story';
import { addFirstHallTourStops, HIGHLIGHT_TOUR_SECONDS, retimeHighlightTour } from './highlight-route.js?v=2026-10-06-first-hall-flow';
import { createGalleryEntry } from './gallery-entry.js?v=2026-10-03-story-entry';
import { createOpeningFilm } from './opening-film.js?v=2026-10-06-film-tour-choices';
import { createVisitGuide } from './visit-guide.js?v=2026-10-06-film-intro-route';
import { createHallTexts, validateHallTexts, wallTextPose } from './hall-texts.js?v=2026-10-06-artwork-story-return';
import { afterlifePose, createAfterlifeExhibit, validateAfterlife } from './afterlife.js?v=2026-10-06-afterlife-encounters';
import { artworkDate, createArtworkCards } from './artwork-cards.js?v=2026-10-05-yellow-house-story';
import { createYellowHouseStory } from './yellow-house.js?v=2026-10-06-shared-studio';
import { validateYellowHouse, yellowHouseConnection } from './yellow-house-data.js';
import { validateAuvers } from './auvers-data.js';
import { mountLanguageSwitch, onLanguageChange, registerExhibitionTranslations, translate } from './i18n.js';
import { prepareGalleryRendering } from './render-preparation.js?v=2026-10-06-first-hall-flow';

mountLanguageSwitch();

const viewer = document.querySelector('#viewer');
const loading = document.querySelector('#loading');
const loadProgress = document.querySelector('#load-progress');
const error = document.querySelector('#error');
const card = document.querySelector('#art-card');
const immersive = document.querySelector('#art-immersive');
const immersiveClose = document.querySelector('#immersive-close');
const immersiveStoryBack = document.querySelector('#immersive-story-back');
const immersiveNavigation = document.querySelector('#immersive-navigation');
const immersivePrevious = document.querySelector('#immersive-previous');
const immersiveNext = document.querySelector('#immersive-next');
const immersivePosition = document.querySelector('#immersive-position');
const immersiveStatus = document.querySelector('#immersive-status');
const tourButton = document.querySelector('#tour-toggle');
const tourProgress = document.querySelector('#tour-progress');
const tourTime = document.querySelector('#tour-time');
const tourModeSelect = document.querySelector('#tour-mode');
const tourHold = document.querySelector('#tour-hold');
const tourStatus = document.querySelector('#tour-status');
const hallIntroToggle = document.querySelector('#hall-intro-toggle');
const previousArtwork = document.querySelector('#previous-artwork');
const nextArtwork = document.querySelector('#next-artwork');
const resetView = document.querySelector('#reset-view');
const viewResetStatus = document.querySelector('#view-reset-status');
const guidePosition = document.querySelector('#guide-position');
const masthead = document.querySelector('.masthead');
const toolbar = document.querySelector('.toolbar');
const catalogue = document.querySelector('#catalogue');
const catalogToggle = document.querySelector('#catalog-toggle');
const catalogSearch = document.querySelector('#catalog-search');
const chapterNav = document.querySelector('#chapter-nav');
const catalogContent = document.querySelector('#catalog-content');
const filmVideo = document.querySelector('#opening-film');
const wallControls = document.querySelector('#wall-controls');
const wallSelect = document.querySelector('#wall-set');
const wallStatus = document.querySelector('#wall-status');
const wallPrevious = document.querySelector('#wall-previous');
const wallNext = document.querySelector('#wall-next');
const storyButton = document.querySelector('#story-go');
const auversButton = document.querySelector('#auvers-go');
const storyControls = document.querySelector('#story-stop-controls');
const afterlifeButton = document.querySelector('#afterlife-go');
const afterlifeControls = document.querySelector('#afterlife-stop-controls');
const afterlifeInvitation = document.querySelector('#afterlife-invitation');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
viewer.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#edeae3');
scene.add(new THREE.HemisphereLight(0xffffff, 0xbab1a1, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-20, 22, 14);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(64, viewer.clientWidth / viewer.clientHeight, 0.08, 400);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const meshes = [];
const pickMeshes = [];
const artworkMeshes = new Map();
const keys = new Set();
const clock = new THREE.Clock();
const tour = { playing: false, seconds: 0 };
const totalSeconds = HIGHLIGHT_TOUR_SECONDS;
const layoutRevision = '2026-10-06-auvers-final-days';
const dolly = { remaining: 0 };
const activePointers = new Map();
let metadata = {};
let chapters = [];
let orderedRoute = null;
let guidedIndex = -1;
let focusMotion = null;
let currentChapter = '01';
let yaw = 0;
let pitch = 0;
let activeSlot = null;
let pinned = false;
let pinchDistance = null;
let gestureMoved = false;
let gestureHadPinch = false;
let pointerDownSlot = null;
let hideCardTimer = null;
let viewResetTimer = null;
let cardLayoutKey = '';
let cardLimits = {};
let filmScreen = null;
let filmPlaceholder = null;
let openingFilm = null;
let hallTexts = null;
let hallTextStation = null;
let afterlife = null;
let afterlifeData = null;
let yellowHouse = null;
let yellowHouseData = null;
let afterlifeStation = null;
let collectionCompletionShown = false;
let focusBeforeImmersive = null;
let immersiveReturnToStory = null;
let immersiveWorkId = null;
let immersiveBusy = false;
let immersiveRevision = 0;
let guideTransitionTimer = null;
let guideArrival = null;
let collectionFadeRevision = 0;
let galleryReady = false;
let tourMode = 'highlights';
let collection = null;
let workOrder = [];
let wallBusy = false;
let wallFailure = '';
const wallPages = new Map();
const frameParts = new Map();
const dynamicLabels = new Map();
let storyData = null;
let storyStationActive = false;
const artworkCards = createArtworkCards({
  onArtworkChange(entry) {
    immersiveWorkId = entry.collectionId ?? entry.id ?? null;
    updateImmersiveNavigation();
  },
  onExplore() {
    if (activeSlot) openImmersive(activeSlot, { storyFirst: true });
  },
  onVisit(id) {
    const returnToStory = immersiveReturnToStory;
    closeImmersive();
    return showCollectionWork(id, true, { returnToStory });
  },
  storyConnection(id) {
    return yellowHouseConnection(yellowHouseData, id);
  },
  onStory(id) {
    yellowHouse?.open(id);
  },
});
const story = createStoryReader({
  onOpen() {
    visitGuide.recordAction('early-life');
    leaveAfterlife();
    yellowHouse?.close();
    hallTexts?.close();
    filmVideo.pause();
    stopDolly();
    pauseTour();
    cancelGuideTransition();
    hideCard();
    closeImmersive();
    if (catalogue.classList.contains('open')) setCatalogueOpen(false);
    keys.clear();
    activePointers.clear();
    pinchDistance = null;
    gestureMoved = false;
    gestureHadPinch = false;
    pointerDownSlot = null;
  },
  onContinue: enterEarlyDrawings,
});
const collectionTour = createCollectionTour({
  order: () => workOrder,
  visit: visitCollectionTourWork,
  onChange(state) {
    updateTimeline();
    if (state.playing) collectionCompletionShown = false;
    if (state.phase === 'complete' && !collectionCompletionShown) {
      collectionCompletionShown = true;
      showAfterlifeInvitation();
    }
  },
});
const visitGuide = createVisitGuide({
  async onTour() {
    pauseTour();
    tourMode = 'highlights';
    tour.seconds = 0;
    updateTimeline();
    await toggleTour();
  },
  onFree() {
    pauseTour();
    cancelGuideTransition();
    stopDolly();
    focusMotion = null;
    updateTimeline();
  },
  onHelpOpen() {
    pauseTour();
    stopDolly();
    keys.clear();
  },
  onLayout: measureCardLimits,
});
const entry = createGalleryEntry({
  onBegin({ playFilm }) {
    returnToOpeningFilm();
    if (playFilm) openingFilm.open();
    else visitGuide.offerWelcome();
  },
});
const projectedCorner = new THREE.Vector3();

function updateWallControls() {
  if (storyStationActive || hallTextStation || afterlifeStation) {
    wallControls.hidden = true;
    return;
  }
  const hall = collection?.halls.find((item) => item.id === currentChapter);
  wallControls.hidden = !hall;
  if (!hall) return;
  wallControls.hidden = false;
  document.querySelector('#wall-hall').textContent = `Hall ${hall.id} · ${hall.pages.flat().length} works`;
  const page = wallPages.get(hall.id) ?? 0;
  wallSelect.replaceChildren(...hall.pages.map((works, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1} / ${hall.pages.length} · ${index === 0 ? 'Highlights' : 'Collection'} (${works.length})`;
    option.selected = index === page;
    return option;
  }));
  wallSelect.disabled = wallBusy;
  wallPrevious.disabled = wallBusy || page === 0;
  wallNext.disabled = wallBusy || page === hall.pages.length - 1;
  if (!wallBusy) wallStatus.textContent = wallFailure || `${hall.pages[page].length} works on these walls · Change sets to explore more`;
}

function updateText(element, text) {
  if (element.textContent === translate(text)) return false;
  element.textContent = text;
  return true;
}

function updateAttribute(element, name, value) {
  if (element.getAttribute(name) !== translate(value)) element.setAttribute(name, value);
}

function updateProperties(element, properties) {
  for (const [name, value] of Object.entries(properties)) {
    if (element[name] !== value) element[name] = value;
  }
}

function updateWorkPosition() {
  if (storyStationActive || hallTextStation || afterlifeStation) return;
  if (!collection || guidedIndex < 0) return;
  const artwork = orderedRoute.artworks[guidedIndex];
  const entry = metadata[artwork.slot];
  const index = workOrder.indexOf(entry?.collectionId);
  updateText(guidePosition, entry?.image ? `Hall ${artwork.chapter} · ${index + 1}/${workOrder.length} · ${entry.title}` : `Hall ${artwork.chapter} · End of wall set`);
  updateProperties(previousArtwork, { disabled: wallBusy || (index <= 0 && !storyData) });
  updateProperties(nextArtwork, { disabled: wallBusy });
  updateText(nextArtwork, index === workOrder.length - 1 ? 'Afterlife →' : 'Next →');
}

function labelFor(slot, entry, height) {
  const object = artworkMeshes.get(slot);
  let label = dynamicLabels.get(slot);
  if (!label) {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 200;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    label = new THREE.Mesh(new THREE.PlaneGeometry(3.1, .36), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
    label.userData.canvas = canvas;
    label.quaternion.copy(object.quaternion);
    scene.add(label);
    dynamicLabels.set(slot, label);
  }
  const context = label.userData.canvas.getContext('2d');
  context.clearRect(0, 0, 1536, 200);
  context.fillStyle = entry.hall === '05' ? '#eee8dc' : '#373a32';
  context.textAlign = 'center';
  context.font = '40px Georgia';
  context.fillText(translate(entry.title), 768, 64, 1490);
  context.font = '26px Georgia';
  context.fillText(translate([entry.location, entry.date, entry.fNumber || entry.museumId].filter(Boolean).join(' · ')), 768, 117, 1490);
  label.userData.localizedLabel = { entry, height };
  label.material.map.needsUpdate = true;
  label.position.copy(object.position).add(new THREE.Vector3(0, -height / 2 - .22, .02).applyQuaternion(object.quaternion));
  label.visible = true;
}

async function loadPaintingTexture(entry) {
  const texture = await new THREE.TextureLoader().loadAsync(entry.image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function sizeArtworkMount(slot, entry, texture, baseline) {
  const object = artworkMeshes.get(slot);
  const base = orderedRoute.artworks.find((artwork) => artwork.slot === slot);
  const dimensions = baseline && !entry.resizeMount
    ? { width: base.width, height: base.height }
    : fitPainting(texture.image.width / texture.image.height, base.displayBounds.width, base.displayBounds.height);
  object.scale.set(dimensions.width / base.width, dimensions.height / base.height, 1);
  const dynamicLabel = !baseline || entry.authoredCard || entry.resizeMount;
  for (const part of frameParts.get(slot)) {
    if (part.kind === 'label') {
      part.object.visible = !dynamicLabel;
      continue;
    }
    part.object.scale.copy(part.scale);
    part.object.scale.x *= (dimensions.width + part.border) / (base.width + part.border);
    part.object.scale.y *= (dimensions.height + part.border) / (base.height + part.border);
  }
  if (dynamicLabel) labelFor(slot, entry, dimensions.height);
}

async function switchWallSet(hallId, page, { automatic = false, preserveImmersive = false, isCurrent = () => true, beforeCommit } = {}) {
  const hall = collection?.halls.find((item) => item.id === hallId);
  if (!hall || !Number.isInteger(page) || page < 0 || page >= hall.pages.length || wallBusy) return false;
  if ((wallPages.get(hallId) ?? 0) === page) return true;
  stopDolly();
  if (!automatic) pauseTour();
  cancelGuideTransition({ preserveFade: automatic });
  hideCard();
  if (!preserveImmersive) closeImmersive();
  keys.clear();
  wallFailure = '';
  for (const pointerId of activePointers.keys()) {
    if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
  }
  activePointers.clear();
  wallBusy = true;
  previousArtwork.disabled = true;
  nextArtwork.disabled = true;
  updateTimeline();
  updateWallControls();
  wallStatus.textContent = 'Loading verified artwork images…';
  const loaded = [];
  try {
    const results = await Promise.allSettled(hall.pages[page].map(async (id) => {
      const entry = collection.works[id];
      loaded.push({ id, texture: await loadPaintingTexture(entry) });
    }));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    for (const slot of hall.slots) {
      if (!artworkMeshes.has(slot) || !frameParts.has(slot)) throw new Error(`Missing wall position ${slot}`);
    }
    if (isCurrent() && beforeCommit) await beforeCommit();
    if (!isCurrent()) {
      loaded.forEach((item) => item.texture.dispose());
      return false;
    }
    for (const [index, slot] of hall.slots.entries()) {
      const object = artworkMeshes.get(slot);
      const parts = frameParts.get(slot);
      const id = hall.pages[page][index];
      const entry = id && { ...collection.works[id], collectionId: id };
      object.visible = Boolean(entry);
      for (const part of parts) part.object.visible = Boolean(entry);
      if (dynamicLabels.has(slot)) dynamicLabels.get(slot).visible = false;
      if (!entry) { metadata[slot] = {}; continue; }
      const texture = loaded.find((item) => item.id === id).texture;
      const previous = object.material;
      previous.map?.dispose();
      previous.dispose();
      object.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false });
      sizeArtworkMount(slot, entry, texture, page === 0);
      metadata[slot] = entry;
    }
    wallPages.set(hallId, page);
    scene.updateMatrixWorld(true);
    return true;
  } catch (cause) {
    loaded.forEach((item) => item.texture.dispose());
    if (isCurrent()) {
      wallFailure = 'Images could not load. Wall set unchanged; please retry.';
      console.error(cause);
    }
    return false;
  } finally {
    wallBusy = false;
    updateTimeline();
    updateWallControls();
    updateWorkPosition();
    if (guidedIndex < 0) resetGuidedSelection();
    renderCatalogue();
  }
}

async function showCollectionWork(id, openCard = false, options = {}) {
  const location = collection && locateWork(collection, id);
  if (!location || wallBusy) return;
  const loaded = await switchWallSet(location.hall, location.page);
  if (!loaded) return;
  setCatalogueOpen(false);
  const index = orderedRoute.artworks.findIndex((item) => item.slot === location.slot);
  const arrived = await guideTo(index, openCard, options);
  updateWorkPosition();
  return arrived;
}

function browseCollection(direction) {
  if (wallBusy) return;
  if (afterlifeStation) {
    const section = afterlife.section(afterlifeStation);
    if (section && direction > 0) return guideToAfterlife(section.cardIds[0]);
    const index = afterlife.stories.findIndex((entry) => entry.id === (section?.cardIds[0] ?? afterlifeStation));
    if (direction < 0) return index < 0 ? showCollectionWork(workOrder.at(-1)) : guideToAfterlife(index === 0 ? 'overview' : afterlife.stories[index - 1].id);
    return index === afterlife.stories.length - 1 ? guideToHallText(hallTexts.entry('departure')) : guideToAfterlife(afterlife.stories[index + 1].id);
  }
  const filmStop = orderedRoute?.camera.openingFilmStop;
  const atOpeningFilm = Boolean(filmStop && tour.seconds >= filmStop.start && tour.seconds <= filmStop.end
    && !hallTextStation && !storyStationActive && !afterlifeStation);
  if (atOpeningFilm) {
    return direction > 0 ? guideToHallText(hallTexts.entry('01')) : guideToHallText(hallTexts.entry('arrival'));
  }
  if (hallTextStation) {
    const entry = hallTextStation;
    if (entry.id === 'arrival') return direction > 0 ? returnToOpeningFilm() : undefined;
    if (entry.id === 'departure') return direction < 0 ? guideToAfterlife(afterlife.stories.at(-1).id) : returnToOpeningFilm();
    if (entry.id === '08') return direction > 0 ? guideToAfterlife() : showCollectionWork(workOrder.at(-1));
    const hall = collection.halls.find((item) => item.id === entry.id);
    const firstIndex = workOrder.indexOf(hall.pages[0][0]);
    if (entry.id === '01') return direction > 0 ? guideToStory() : returnToOpeningFilm();
    if (direction > 0) return showCollectionWork(workOrder[firstIndex]);
    return firstIndex > 0 ? showCollectionWork(workOrder[firstIndex - 1]) : guideToHallText(hallTexts.entry('arrival'));
  }
  if (storyStationActive) {
    if (direction > 0) enterEarlyDrawings();
    else guideToHallText(hallTexts.entry('01'));
    return;
  }
  if (storyData && guidedIndex < 0 && currentChapter === '01' && direction > 0) {
    guideToStory();
    return;
  }
  if (!collection) {
    if (storyData && guidedIndex === 0 && direction < 0) return guideToStory();
    return guideTo(direction < 0 ? Math.max(0, guidedIndex - 1) : guidedIndex < 0 ? 0 : guidedIndex + 1);
  }
  const slot = guidedIndex >= 0 && orderedRoute.artworks[guidedIndex].slot;
  const index = workOrder.indexOf(metadata[slot]?.collectionId);
  if (storyData && index === 0 && direction < 0) {
    guideToStory();
    return;
  }
  const hall = collection.halls.find((item) => item.id === currentChapter);
  const first = hall?.pages[wallPages.get(currentChapter) ?? 0][0];
  const next = index === -1 ? Math.max(0, workOrder.indexOf(first)) : Math.max(0, Math.min(workOrder.length - 1, index + direction));
  if (afterlife && index === workOrder.length - 1 && direction > 0) return guideToAfterlife();
  if (hallTexts && direction > 0 && index >= 0 && collection.works[workOrder[next]].hall !== collection.works[workOrder[index]].hall) {
    return guideToHallText(hallTexts.entry(collection.works[workOrder[next]].hall));
  }
  showCollectionWork(workOrder[next]);
}

function guideToHallText(entry) {
  if (!entry || wallBusy || !orderedRoute) return;
  visitGuide.recordAction('navigate');
  if (entry.wall.exhibit === 'afterlife') return guideToAfterlife('overview');
  const pose = wallTextPose(entry);
  const location = pose.location.setY(orderedRoute.eyeHeight);
  const target = pose.position.setY(orderedRoute.eyeHeight);
  if (entry.id === 'departure' && viewer.clientWidth <= 600) {
    location.copy(target).addScaledVector(pose.normal, Math.min(3.7, entry.wall.viewDistance));
  }
  if (!insideGallery(location.x, location.z)) return;
  leaveAfterlife();
  hallTexts.close();
  story.close();
  yellowHouse?.close();
  filmVideo.pause();
  closeImmersive();
  if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  pauseTour();
  cancelGuideTransition();
  stopDolly();
  hideCard();
  keys.clear();
  setStoryStationActive(false);
  hallTextStation = entry;
  guidedIndex = -1;
  currentChapter = entry.id === 'arrival' ? '01' : entry.id === 'departure' ? '08' : entry.id;
  const targetYaw = Math.atan2(target.z - location.z, target.x - location.x);
  const yawDifference = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canGlide = camera.position.distanceTo(location) <= 10 && clearWalkingSegment(camera.position.toArray(), location.toArray());
  if (!reduced && canGlide) {
    focusMotion = {
      elapsed: 0, duration: 1.35, from: camera.position.clone(), to: location,
      yawFrom: yaw, yawTo: yaw + yawDifference, pitchFrom: pitch, pitchTo: 0, openSlot: null,
    };
  } else {
    const arrive = () => {
      guideTransitionTimer = null;
      viewFrom(location.toArray(), target.toArray());
      renderer.domElement.classList.remove('repositioning');
    };
    if (reduced) arrive();
    else {
      renderer.domElement.classList.add('repositioning');
      guideTransitionTimer = window.setTimeout(arrive, 150);
    }
  }
  const introduction = orderedRoute.camera.introductionStops?.find((stop) => stop.id === entry.id);
  tour.seconds = entry.id === 'arrival' ? 0 : ['departure', '08'].includes(entry.id) ? totalSeconds : introduction?.start ?? orderedRoute.artworks.find((artwork) => artwork.chapter === entry.id)?.routeTime ?? 0;
  guidePosition.textContent = entry.readerId === 'auvers:final-days' ? 'The Final Days · Reading Station' : entry.kind === 'hall' ? `Hall ${entry.id} · ${entry.title} · Introduction` : entry.label;
  previousArtwork.disabled = entry.id === 'arrival';
  nextArtwork.disabled = false;
  nextArtwork.textContent = entry.id === 'departure' ? 'Return to entrance →' : entry.id === '08' ? 'Explore Afterlife →' : entry.id === '01' ? 'Searching for a Place →' : entry.id === 'arrival' ? 'Opening film →' : 'View the artworks →';
  updateTimeline();
  updateWallControls();
  updateFilmControls();
  renderCatalogue();
}

function setStoryStationActive(active) {
  if (storyStationActive === active) return;
  storyStationActive = active;
  storyControls.hidden = !active;
  storyButton.setAttribute('aria-pressed', String(active));
  updateFilmControls();
  updateWallControls();
}

function enterEarlyDrawings() {
  if (wallBusy || !collection) return;
  const hall = collection.halls.find((entry) => entry.id === '01');
  showCollectionWork(hall.pages[0][0]);
}

function returnToOpeningFilm() {
  if (!orderedRoute || wallBusy) return;
  leaveAfterlife();
  story.close();
  yellowHouse?.close();
  closeImmersive();
  cancelGuideTransition();
  pauseTour();
  hideCard();
  keys.clear();
  tour.seconds = orderedRoute.camera.openingFilmTime ?? 9;
  positionOnRoute();
  resetGuidedSelection();
  guidePosition.textContent = 'Hall 01 · Opening film → Introduction → Searching for a Place → Early Works';
  updateTimeline();
  updateWallControls();
  updateFilmControls();
}

function guideToStory({ immediate = false } = {}) {
  if (!storyData || wallBusy) return;
  visitGuide.recordAction('navigate');
  leaveAfterlife();
  hallTexts?.close();
  hallTextStation = null;
  filmVideo.pause();
  story.close();
  yellowHouse?.close();
  closeImmersive();
  if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  stopDolly();
  pauseTour();
  cancelGuideTransition();
  hideCard();
  keys.clear();
  guidedIndex = -1;
  currentChapter = '01';
  const { position, target } = storyData.station;
  const targetYaw = Math.atan2(target[2] - position[2], target[0] - position[0]);
  const yawDifference = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canGlide = camera.position.distanceTo(new THREE.Vector3(...position)) <= 10
    && clearWalkingSegment(camera.position.toArray(), position);
  if (!immediate && !reduced && canGlide) {
    focusMotion = {
      elapsed: 0, duration: 1.35, from: camera.position.clone(), to: new THREE.Vector3(...position),
      yawFrom: yaw, yawTo: yaw + yawDifference, pitchFrom: pitch, pitchTo: 0, openSlot: null,
    };
  } else {
    const arrive = () => {
      guideTransitionTimer = null;
      viewFrom(position, target);
      renderer.domElement.classList.remove('repositioning');
    };
    if (immediate || reduced) arrive();
    else {
      renderer.domElement.classList.add('repositioning');
      guideTransitionTimer = window.setTimeout(arrive, 150);
    }
  }
  setStoryStationActive(true);
  guidePosition.textContent = 'Hall 01 · After the opening film · Searching for a Place';
  previousArtwork.disabled = false;
  nextArtwork.disabled = false;
  nextArtwork.textContent = 'Early Works →';
  tour.seconds = storyData.station.routeTime;
  updateTimeline();
  renderCatalogue();
}

storyButton.addEventListener('click', guideToStory);
auversButton.addEventListener('click', () => hallTexts.openAuvers());
document.querySelector('#story-explore').addEventListener('click', () => story.open());
document.querySelector('#story-enter-hall').addEventListener('click', enterEarlyDrawings);

function leaveAfterlife() {
  const wasAfterlifeView = viewer.classList.contains('afterlife-view');
  if (!afterlifeStation && !wasAfterlifeView && !afterlife?.isOpen() && afterlifeControls.hidden && afterlifeInvitation.hidden) return;
  afterlife?.close();
  afterlifeStation = null;
  viewer.classList.remove('afterlife-view');
  afterlifeControls.hidden = true;
  afterlifeInvitation.hidden = true;
  afterlifeButton.setAttribute('aria-pressed', 'false');
  if (wasAfterlifeView) measureCardLimits();
}

function showAfterlifeInvitation() {
  if (afterlife && !afterlifeStation && !entry.isOpen()) afterlifeInvitation.hidden = false;
}

function guideToAfterlife(id = 'overview') {
  if (!afterlife || wallBusy) return;
  visitGuide.recordAction('navigate');
  const { location, target } = afterlife.pose(id, orderedRoute.eyeHeight);
  if (!afterlifeData.cards.some((card) => card.id === id) && viewer.clientWidth <= 600) {
    location.copy(target).addScaledVector(new THREE.Vector3(...afterlifeData.wall.normal), Math.min(8.2, afterlifeData.wall.overviewDistance));
  }
  if (!insideGallery(location.x, location.z)) return;
  afterlife.close();
  hallTexts.close();
  hallTextStation = null;
  story.close();
  openingFilm.close();
  yellowHouse?.close();
  filmVideo.pause();
  closeImmersive();
  if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  pauseTour();
  stopDolly();
  cancelGuideTransition();
  hideCard();
  keys.clear();
  activePointers.clear();
  pinchDistance = null;
  gestureMoved = false;
  gestureHadPinch = false;
  pointerDownSlot = null;
  setStoryStationActive(false);
  guidedIndex = -1;
  currentChapter = '08';
  afterlifeStation = id;
  viewer.classList.add('afterlife-view');
  afterlifeControls.hidden = false;
  afterlifeInvitation.hidden = true;
  afterlifeButton.setAttribute('aria-pressed', 'true');
  const selected = afterlife.card(id);
  const section = afterlife.section(id);
  const index = afterlife.stories.findIndex((entry) => entry.id === id);
  document.querySelector('#afterlife-stop-title').textContent = selected ? `${String(index + 1).padStart(2, '0')} · ${selected.title}` : section?.title ?? 'Afterlife';
  document.querySelector('#afterlife-stop-note').textContent = selected ? `${selected.date} · ${selected.subtitle}` : section?.subtitle ?? afterlifeData.subtitle;
  document.querySelector('#afterlife-read').textContent = selected ? 'Read the Story →' : section ? 'Explore this Section →' : 'Explore Four Sections →';
  const targetYaw = Math.atan2(target.z - location.z, target.x - location.x);
  const yawDifference = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canGlide = camera.position.distanceTo(location) <= 10 && clearWalkingSegment(camera.position.toArray(), location.toArray());
  if (!reduced && canGlide) {
    focusMotion = { elapsed: 0, duration: 1.35, from: camera.position.clone(), to: location,
      yawFrom: yaw, yawTo: yaw + yawDifference, pitchFrom: pitch, pitchTo: 0, openSlot: null };
  } else {
    const arrive = () => {
      guideTransitionTimer = null;
      viewFrom(location.toArray(), target.toArray());
      renderer.domElement.classList.remove('repositioning');
    };
    if (reduced) arrive();
    else {
      renderer.domElement.classList.add('repositioning');
      guideTransitionTimer = window.setTimeout(arrive, 150);
    }
  }
  tour.seconds = totalSeconds;
  guidePosition.textContent = selected ? `Hall 08 · Afterlife · ${index + 1} / ${afterlife.stories.length} · ${selected.title}` : `Hall 08 · ${section?.title ?? 'Afterlife · What His Work Set in Motion'}`;
  previousArtwork.disabled = false;
  nextArtwork.disabled = false;
  nextArtwork.textContent = index === afterlife.stories.length - 1 ? 'As You Leave →' : selected ? 'Next story →' : 'First story →';
  updateTimeline();
  updateWallControls();
  updateFilmControls();
  measureCardLimits();
  renderCatalogue();
}

afterlifeButton.addEventListener('click', () => guideToAfterlife());
document.querySelector('#afterlife-continue').addEventListener('click', () => guideToAfterlife());
document.querySelector('#afterlife-dismiss').addEventListener('click', () => { afterlifeInvitation.hidden = true; });
document.querySelector('#afterlife-read').addEventListener('click', () => afterlife.open(afterlifeStation));
document.querySelector('#afterlife-wall-overview').addEventListener('click', () => guideToAfterlife());
document.querySelector('#afterlife-wall-sources').addEventListener('click', () => afterlife.open(afterlifeStation, { showSources: true }));
document.querySelector('#afterlife-wall-exit').addEventListener('click', () => guideToHallText(hallTexts.entry('departure')));

async function restoreHighlights() {
  if (wallBusy) return false;
  for (const hall of collection?.halls ?? []) {
    if ((wallPages.get(hall.id) ?? 0) && !await switchWallSet(hall.id, 0)) return false;
  }
  return true;
}

wallPrevious.addEventListener('click', () => switchWallSet(currentChapter, (wallPages.get(currentChapter) ?? 0) - 1));
wallNext.addEventListener('click', () => switchWallSet(currentChapter, (wallPages.get(currentChapter) ?? 0) + 1));
wallSelect.addEventListener('change', () => switchWallSet(currentChapter, Number(wallSelect.value)));

function measureCardLimits() {
  const viewerBounds = viewer.getBoundingClientRect();
  const headingBounds = masthead.getBoundingClientRect();
  cardLimits = {
    width: viewer.clientWidth,
    height: viewer.clientHeight,
    headingRight: headingBounds.right - viewerBounds.left,
    headingBottom: headingBounds.bottom - viewerBounds.top,
    bottom: toolbar.getBoundingClientRect().top - viewerBounds.top - 16,
  };
  cardLayoutKey = '';
  viewer.style.setProperty('--toolbar-height', `${toolbar.getBoundingClientRect().height}px`);
}

function artworkScreenBounds(object) {
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  const box = object.geometry.boundingBox;
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  camera.updateMatrixWorld();
  for (const horizontal of [box.min.x, box.max.x]) {
    for (const vertical of [box.min.y, box.max.y]) {
      for (const depth of [box.min.z, box.max.z]) {
        projectedCorner.set(horizontal, vertical, depth)
          .applyMatrix4(object.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        if (projectedCorner.z >= -camera.near || projectedCorner.z <= -camera.far) return null;
        projectedCorner.applyMatrix4(camera.projectionMatrix);
        const screenX = (projectedCorner.x + 1) * cardLimits.width / 2;
        const screenY = (1 - projectedCorner.y) * cardLimits.height / 2;
        bounds.left = Math.min(bounds.left, screenX);
        bounds.right = Math.max(bounds.right, screenX);
        bounds.top = Math.min(bounds.top, screenY);
        bounds.bottom = Math.max(bounds.bottom, screenY);
      }
    }
  }
  if (bounds.right < 0 || bounds.left > cardLimits.width || bounds.bottom < 0 || bounds.top > cardLimits.height) return null;
  return bounds;
}

function positionCard() {
  if (!activeSlot) return;
  const object = artworkMeshes.get(activeSlot);
  const bounds = object && artworkScreenBounds(object);
  if (!bounds) {
    hideCard();
    return;
  }
  const margin = 12;
  const gap = 18;
  const availableWidth = Math.max(1, cardLimits.width - margin * 2);
  const width = Math.min(260, availableWidth, Math.max(184, cardLimits.width - bounds.right - gap - margin));
  const left = THREE.MathUtils.clamp(bounds.right + gap, margin, Math.max(margin, cardLimits.width - width - margin));
  const topLimit = left < cardLimits.headingRight + margin ? cardLimits.headingBottom + margin : margin;
  const height = Math.min(Math.max(340, width * 1.54), Math.max(1, cardLimits.bottom - topLimit));
  const centerY = (Math.max(0, bounds.top) + Math.min(cardLimits.height, bounds.bottom)) / 2;
  const top = THREE.MathUtils.clamp(centerY - height / 2, topLimit, Math.max(topLimit, cardLimits.bottom - height));
  const layout = [left, top, width, height].map(Math.round);
  const layoutKey = layout.join(',');
  if (layoutKey === cardLayoutKey) return;
  cardLayoutKey = layoutKey;
  card.style.left = `${layout[0]}px`;
  card.style.top = `${layout[1]}px`;
  card.style.width = `${layout[2]}px`;
  card.style.height = `${layout[3]}px`;
  card.classList.toggle('compact', width < 230);
}

function cancelCardHide() {
  window.clearTimeout(hideCardTimer);
  hideCardTimer = null;
}

function scheduleCardHide() {
  if (pinned || !activeSlot || hideCardTimer !== null) return;
  hideCardTimer = window.setTimeout(() => {
    hideCardTimer = null;
    if (!pinned && !card.matches(':hover') && !card.contains(document.activeElement)) hideCard();
  }, 300);
}

function viewFrom(location, target) {
  stopDolly();
  camera.position.set(...location);
  const direction = new THREE.Vector3(...target).sub(camera.position).normalize();
  yaw = Math.atan2(direction.z, direction.x);
  pitch = Math.asin(direction.y);
  updateView();
}

function updateView() {
  const direction = new THREE.Vector3(
    Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  );
  camera.lookAt(camera.position.clone().add(direction));
}

viewFrom([-22.4, 2.7, 0], [-14, 2.7, 0]);

function timeLabel(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function updateTimeline() {
  const full = tourMode === 'collection';
  const state = collectionTour.state();
  updateProperties(tourModeSelect, { disabled: !galleryReady, value: tourMode });
  updateProperties(tourHold, { hidden: !full });
  const introduction = hallTextStation?.kind === 'hall' ? hallTextStation : null;
  const finalDays = introduction?.readerId === 'auvers:final-days';
  updateProperties(tourStatus, { hidden: !full && !introduction });
  const introductionLabel = finalDays ? 'Read The Final Days' : introduction ? 'Read this introduction' : 'Room introduction';
  updateText(hallIntroToggle, introductionLabel);
  updateProperties(tourButton, { disabled: !galleryReady || (wallBusy && !(full && state.playing)) });
  updateProperties(resetView, { disabled: !galleryReady || wallBusy });
  updateProperties(tourProgress, {
    disabled: !galleryReady || wallBusy, min: full ? '1' : '0',
    max: full ? String(Math.max(1, state.total)) : String(totalSeconds), step: full ? '1' : '0.1',
    value: full ? String(Math.max(1, state.index + 1)) : String(Math.round(tour.seconds * 10) / 10),
  });
  updateAttribute(tourProgress, 'aria-label', full ? 'Collection work number' : 'Tour progress in seconds');
  if (!full) {
    updateText(tourTime, `${timeLabel(tour.seconds)} / ${timeLabel(totalSeconds)}`);
    updateText(tourButton, tour.playing ? `Pause ${totalSeconds}-second tour` : `Play ${totalSeconds}-second tour`);
    updateAttribute(tourProgress, 'aria-valuetext', `${timeLabel(tour.seconds)} of ${timeLabel(totalSeconds)}`);
    if (introduction) {
      const readingStatus = tour.playing ? 'Pause to read, or continue with the story' : finalDays ? 'Reading station · Read at your own pace' : 'Introduction · Read at your own pace';
      const status = `Hall ${introduction.id} · ${introduction.title} · ${readingStatus}`;
      if (updateText(tourStatus, status)) measureCardLimits();
    }
    return;
  }
  updateText(tourTime, `${Math.max(0, state.index + 1)} / ${state.total}`);
  updateText(tourButton, state.playing ? 'Pause collection' : state.phase === 'error' ? 'Retry collection' : state.phase === 'complete' ? 'Replay collection' : state.index < 0 ? 'Play full collection' : 'Resume collection');
  const entry = collection?.works[workOrder[state.index]];
  updateAttribute(tourProgress, 'aria-valuetext', entry ? `Work ${state.index + 1} of ${state.total}: ${entry.title}` : 'Start of the full collection');
  let status = `${state.total} verified works · ${state.holdSeconds}s at each stop · Film and early-life stories remain optional`;
  if (state.phase === 'loading') status = 'Loading verified artwork images… The tour waits until the entire wall set is ready.';
  if (state.phase === 'moving') status = 'Moving to the next artwork at eye level…';
  if (state.phase === 'holding' && entry) status = `${state.playing ? `${Math.ceil(state.remaining)}s remaining` : 'Paused'} · Hall ${entry.hall} · ${entry.title}`;
  if (state.phase === 'paused') status = 'Paused during a transition · Resume to arrive at the same artwork';
  if (state.phase === 'complete') status = `Collection complete · All ${state.total} verified works visited`;
  if (state.phase === 'error') status = state.message;
  if (updateText(tourStatus, status)) measureCardLimits();
}

function resetGuidedSelection() {
  guidedIndex = -1;
  updateText(nextArtwork, 'Next →');
  updateText(guidePosition, 'Gallery-view route · Follow the left wall');
  updateProperties(previousArtwork, { disabled: true });
  updateProperties(nextArtwork, { disabled: wallBusy });
}

function synchronizeRouteSelection(chapter) {
  if (chapter === '00') {
    if (guidedIndex !== -1) resetGuidedSelection();
    return;
  }
  let closestIndex = -1;
  let closestTime = Infinity;
  orderedRoute.artworks.forEach((artwork, index) => {
    const difference = Math.abs(artwork.routeTime - tour.seconds);
    if (artwork.chapter === chapter && difference < closestTime) {
      closestIndex = index;
      closestTime = difference;
    }
  });
  if (closestIndex < 0) return;
  guidedIndex = closestIndex;
  updateWorkPosition();
}

function pauseTour() {
  tour.playing = false;
  const state = collectionTour.state();
  if (state.playing || state.phase === 'loading' || state.phase === 'moving') {
    collectionTour.pause();
    cancelGuideTransition();
  }
  updateTimeline();
}

function cancelGuideTransition({ preserveFade = false } = {}) {
  if (guideTransitionTimer !== null) window.clearTimeout(guideTransitionTimer);
  guideTransitionTimer = null;
  focusMotion = null;
  const arrival = guideArrival;
  guideArrival = null;
  arrival?.(false);
  renderer.domElement.classList.remove('repositioning');
  if (!preserveFade) {
    collectionFadeRevision += 1;
    renderer.domElement.classList.remove('collection-transition', 'collection-transitioning');
  }
}

function positionOnRoute() {
  if (!orderedRoute) return;
  leaveAfterlife();
  const introduction = orderedRoute.camera.introductionStops?.find((stop) => tour.seconds >= stop.start && tour.seconds <= stop.end);
  const filmStop = orderedRoute.camera.openingFilmStop;
  const atFilm = filmStop && tour.seconds >= filmStop.start && tour.seconds <= filmStop.end;
  const exhibitStop = orderedRoute.camera.exhibitStops?.find((stop) => tour.seconds >= stop.start && tour.seconds <= stop.end);
  hallTextStation = introduction ? hallTexts?.entry(introduction.id) ?? null : null;
  setStoryStationActive(exhibitStop?.kind === 'story');
  stopDolly();
  const waypoints = orderedRoute.camera.waypoints;
  let lower = 0;
  let upper = waypoints.length - 1;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (waypoints[middle].time < tour.seconds) lower = middle + 1;
    else upper = middle;
  }
  const index = lower;
  const following = waypoints[index] ?? waypoints.at(-1);
  const previous = waypoints[Math.max(0, index - 1)];
  const fraction = following.time === previous.time ? 0 : THREE.MathUtils.clamp(
    (tour.seconds - previous.time) / (following.time - previous.time), 0, 1,
  );
  const position = previous.position.map((value, axis) => THREE.MathUtils.lerp(value, following.position[axis], fraction));
  const previousYaw = Math.atan2(previous.target[2] - previous.position[2], previous.target[0] - previous.position[0]);
  const followingYaw = Math.atan2(following.target[2] - following.position[2], following.target[0] - following.position[0]);
  const turn = Math.atan2(Math.sin(followingYaw - previousYaw), Math.cos(followingYaw - previousYaw));
  camera.position.set(...position);
  yaw = previousYaw + turn * fraction;
  pitch = 0;
  updateView();
  const chapter = introduction?.id ?? (previous.chapter === '00' ? (tour.seconds > totalSeconds / 2 ? '07' : '01') : previous.chapter);
  if (chapter !== currentChapter) {
    currentChapter = chapter;
    renderCatalogue();
  }
  if (hallTextStation) {
    guidedIndex = -1;
    updateText(guidePosition, `Hall ${hallTextStation.id} · ${hallTextStation.title} · Introduction`);
    updateProperties(previousArtwork, { disabled: false });
    updateProperties(nextArtwork, { disabled: wallBusy });
    updateText(nextArtwork, hallTextStation.id === '01' ? 'Searching for a Place →' : 'View the artworks →');
  } else if (storyStationActive) {
    guidedIndex = -1;
    hideCard();
    updateText(guidePosition, 'Hall 01 · Searching for a Place · Explore His Early Life');
    updateProperties(previousArtwork, { disabled: false });
    updateProperties(nextArtwork, { disabled: wallBusy });
    updateText(nextArtwork, 'Early Works →');
  } else if (atFilm) {
    guidedIndex = -1;
    updateText(nextArtwork, 'Next →');
    updateProperties(nextArtwork, { disabled: wallBusy });
    updateText(guidePosition, 'Hall 01 · Opening film → Introduction → Searching for a Place → Early Works');
    updateProperties(previousArtwork, { disabled: false });
  } else {
    synchronizeRouteSelection(previous.chapter);
    updateText(nextArtwork, 'Next →');
  }
}

function updateFilmControls() {
  if (!orderedRoute || !openingFilm) return;
  const show = !storyStationActive && orderedRoute.walkableRegions.some((region) =>
    (region.chapter === '00' || region.chapter === '01') && polygonContains(camera.position.x, camera.position.z, region.polygon));
  openingFilm.update({ available: show && !hallTextStation && !afterlifeStation, blocked: entry.isOpen() || wallBusy || !immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen() || catalogue.classList.contains('open') });
}

function hideCard() {
  cancelCardHide();
  if (activeSlot === null && !pinned && card.inert && !card.classList.contains('visible')) return;
  activeSlot = null;
  pinned = false;
  cardLayoutKey = '';
  card.classList.remove('visible');
  card.inert = true;
  card.setAttribute('aria-hidden', 'true');
}

function showCard(slot) {
  if (!immersive.hidden) return;
  cancelCardHide();
  if (activeSlot === slot && card.classList.contains('visible')) return;
  activeSlot = slot;
  const entry = metadata[slot] ?? {};
  const stage = artworkMeshes.get(slot)?.userData.stage ?? slot.slice(0, 2);
  document.querySelector('#card-chapter').textContent = `Hall ${stage} · ${chapters.find((chapter) => chapter.id === stage)?.title ?? 'Works'}`;
  document.querySelector('#card-title').textContent = entry.title ?? 'Artwork details pending';
  document.querySelector('#card-date').textContent = artworkDate(entry) ?? 'Date and medium pending';
  document.querySelector('#card-body').textContent = entry.body ?? 'Further interpretation will be added here.';
  document.querySelector('#card-credit').textContent = entry.credit ?? 'Image credit pending';
  const sourceLink = document.querySelector('#card-source');
  sourceLink.hidden = !entry.source;
  if (entry.source) sourceLink.href = entry.source;
  artworkCards.renderHover(entry);
  card.querySelector('.card-content').scrollTop = 0;
  cardLayoutKey = '';
  positionCard();
  if (!activeSlot) return;
  card.classList.add('visible');
  card.setAttribute('aria-hidden', 'false');
  card.inert = false;
}

function openImmersive(slot, options = {}) {
  leaveAfterlife();
  story.close();
  yellowHouse?.close();
  const entry = metadata[slot];
  if (!entry?.image) return;
  visitGuide.recordAction('artwork');
  filmVideo.pause();
  stopDolly();
  pauseTour();
  hideCard();
  keys.clear();
  focusMotion = null;
  cancelGuideTransition();
  const alreadyOpen = !immersive.hidden;
  if (!alreadyOpen) {
    focusBeforeImmersive = document.activeElement;
    immersiveReturnToStory = options.returnToStory ?? null;
  }
  immersiveStoryBack.hidden = !immersiveReturnToStory;
  immersiveClose.setAttribute('aria-label', immersiveReturnToStory ? 'Return to the story' : 'Close immersive artwork view');
  artworkCards.open(entry, options);
  immersive.hidden = false;
  immersive.inert = false;
  immersive.setAttribute('aria-hidden', 'false');
  immersive.querySelector('.immersive-content').scrollTop = 0;
  if (!alreadyOpen) immersiveClose.focus();
}

function updateImmersiveNavigation(message = '') {
  const index = workOrder.indexOf(immersiveWorkId);
  immersiveNavigation.hidden = index < 0;
  immersivePrevious.disabled = immersiveBusy || index <= 0;
  immersiveNext.disabled = immersiveBusy || index < 0 || index >= workOrder.length - 1;
  immersivePosition.textContent = index < 0 ? '' : `${index + 1} / ${workOrder.length} · Hall ${collection.works[immersiveWorkId].hall}`;
  immersiveStatus.textContent = message || (immersiveBusy ? 'Loading artwork…' : 'Tour paused');
  immersive.setAttribute('aria-busy', String(immersiveBusy));
}

async function browseImmersive(direction) {
  if (immersive.hidden || immersiveBusy || wallBusy || ![-1, 1].includes(direction)) return false;
  const index = workOrder.indexOf(immersiveWorkId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= workOrder.length) return false;
  const location = locateWork(collection, workOrder[nextIndex]);
  const stationIndex = orderedRoute.artworks.findIndex((artwork) => artwork.slot === location.slot);
  if (stationIndex < 0) return false;
  const ticket = ++immersiveRevision;
  const isCurrent = () => ticket === immersiveRevision && !immersive.hidden;
  const focused = document.activeElement;
  let message = '';
  immersiveBusy = true;
  pauseTour();
  updateImmersiveNavigation();
  try {
    const loaded = await switchWallSet(location.hall, location.page, { preserveImmersive: true, isCurrent });
    if (!isCurrent()) return false;
    if (!loaded) {
      message = 'Artwork could not load. Please try again.';
      return false;
    }
    const arrived = await guideTo(stationIndex, false, { instant: true, preserveImmersive: true });
    if (!arrived || !isCurrent()) return false;
    openImmersive(location.slot);
    return true;
  } catch (cause) {
    if (isCurrent()) {
      message = 'Artwork could not load. Please try again.';
      console.error(cause);
    }
    return false;
  } finally {
    if (isCurrent()) {
      immersiveBusy = false;
      updateImmersiveNavigation(message);
      if (focused?.isConnected && immersive.contains(focused) && !focused.disabled) focused.focus();
      else immersiveClose.focus();
    }
  }
}

function closeImmersive({ restoreFocus = true } = {}) {
  if (immersive.hidden) return;
  immersiveRevision += 1;
  immersiveBusy = false;
  immersiveWorkId = null;
  immersiveReturnToStory = null;
  immersiveStoryBack.hidden = true;
  immersiveClose.setAttribute('aria-label', 'Close immersive artwork view');
  immersive.hidden = true;
  immersive.inert = true;
  immersive.setAttribute('aria-hidden', 'true');
  immersive.setAttribute('aria-busy', 'false');
  artworkCards.close();
  document.querySelector('#immersive-image').removeAttribute('src');
  if (restoreFocus && focusBeforeImmersive?.isConnected) focusBeforeImmersive.focus();
  focusBeforeImmersive = null;
}

function dismissImmersive() {
  const returnToStory = immersiveReturnToStory;
  closeImmersive({ restoreFocus: !returnToStory });
  returnToStory?.();
}

function setCatalogueOpen(open) {
  if (open && !chapters.length) return;
  if (open) {
    afterlife?.close();
    story.close();
    yellowHouse?.close();
    stopDolly();
    cancelGuideTransition();
    pauseTour();
    hideCard();
    closeImmersive();
  }
  catalogue.classList.toggle('open', open);
  catalogue.inert = !open;
  catalogue.setAttribute('aria-hidden', String(!open));
  catalogToggle.setAttribute('aria-expanded', String(open));
  if (open) catalogSearch.focus();
  else catalogToggle.focus();
}

function jumpToChapter(chapter) {
  if (hallTexts) return guideToHallText(hallTexts.entry(chapter.id));
  setCatalogueOpen(false);
  const index = orderedRoute.artworks.findIndex((item) => item.chapter === chapter.id);
  if (index !== -1) guideTo(index, false);
}

function jumpToArtwork(chapter, slot) {
  setCatalogueOpen(false);
  const index = orderedRoute.artworks.findIndex((item) => item.slot === slot);
  if (index !== -1) guideTo(index, true);
}

function artworkView(artwork) {
  let distance = artwork.viewDistance ?? 8.4;
  const lookAtHeight = orderedRoute.eyeHeight;
  const picture = artworkMeshes.get(artwork.slot);
  const pictureWidth = artwork.width * (picture?.scale.x ?? 1);
  const pictureHeight = artwork.height * (picture?.scale.y ?? 1);
  if (viewer.clientWidth <= 600) {
    const viewerTop = viewer.getBoundingClientRect().top;
    const safeTop = masthead.getBoundingClientRect().bottom - viewerTop + 16;
    const safeBottom = toolbar.getBoundingClientRect().top - viewerTop - 16;
    const safeHeight = Math.max(120, safeBottom - safeTop);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distance = Math.max(
      distance,
      (pictureHeight + 0.3) * viewer.clientHeight / (2 * tangent * safeHeight * 0.82),
      (pictureWidth + 0.3) / (2 * tangent * camera.aspect * 0.84),
    );
  }
  const extraDistance = distance - (artwork.viewDistance ?? 8.4);
  let location = [
    artwork.viewpoint[0] + artwork.normal[0] * extraDistance,
    orderedRoute.eyeHeight,
    artwork.viewpoint[2] + artwork.normal[2] * extraDistance,
  ];
  if (!insideGallery(location[0], location[2]) || !clearWalkingSegment(artwork.viewpoint, location)) {
    location = artwork.viewpoint;
  }
  const target = artwork.viewTarget
    ? [
      location[0] + artwork.viewTarget[0] - artwork.viewpoint[0],
      lookAtHeight,
      location[2] + artwork.viewTarget[2] - artwork.viewpoint[2],
    ]
    : [artwork.x, lookAtHeight, artwork.z];
  const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...location)).normalize();
  const targetYaw = Math.atan2(direction.z, direction.x);
  const targetPitch = Math.asin(direction.y);
  const yawDifference = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const travelDistance = camera.position.distanceTo(new THREE.Vector3(...location));
  return { location, target, targetYaw, targetPitch, yawDifference, travelDistance };
}

function canGlideTo(view, automatic = false) {
  return view.travelDistance <= 9 && (!automatic || Math.abs(view.yawDifference) < Math.PI / 3)
    && clearWalkingSegment(camera.position.toArray(), view.location);
}

async function visitCollectionTourWork(id, { isCurrent, onPhase }) {
  const location = locateWork(collection, id);
  if (!location || wallBusy || !isCurrent()) return false;
  const index = orderedRoute.artworks.findIndex((entry) => entry.slot === location.slot);
  if (index < 0) return false;
  story.close();
  yellowHouse?.close();
  closeImmersive();
  hideCard();
  stopDolly();
  cancelGuideTransition();
  keys.clear();
  filmVideo?.pause();
  const fadeRevision = ++collectionFadeRevision;
  const changedSet = (wallPages.get(location.hall) ?? 0) !== location.page;
  const faded = changedSet || currentChapter !== location.hall || !canGlideTo(artworkView(orderedRoute.artworks[index]), true);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let covered = false;
  const wait = () => new Promise((resolve) => window.setTimeout(resolve, 600));
  const cover = async () => {
    onPhase('moving');
    if (!reducedMotion) {
      renderer.domElement.classList.add('collection-transitioning', 'collection-transition');
      await wait();
    }
    covered = true;
  };
  try {
    const loaded = await switchWallSet(location.hall, location.page, {
      automatic: true, isCurrent, beforeCommit: faded ? cover : undefined,
    });
    if (!loaded || !isCurrent()) return false;
    if (faded && !covered) await cover();
    if (!isCurrent()) return false;
    onPhase('moving');
    const arrived = await guideTo(index, false, { automatic: true, instant: faded });
    if (!arrived || !isCurrent()) return false;
    if (faded && !reducedMotion) {
      renderer.domElement.classList.remove('collection-transition');
      await wait();
    }
    return isCurrent();
  } finally {
    if (fadeRevision === collectionFadeRevision) renderer.domElement.classList.remove('collection-transition', 'collection-transitioning');
  }
}

function guideTo(index, openCard = false, { automatic = false, instant = false, preserveImmersive = false, returnToStory = null } = {}) {
  if (!orderedRoute || wallBusy || index < 0 || index >= orderedRoute.artworks.length) return Promise.resolve(false);
  leaveAfterlife();
  hallTexts?.close();
  hallTextStation = null;
  story.close();
  yellowHouse?.close();
  setStoryStationActive(false);
  stopDolly();
  if (!preserveImmersive) closeImmersive();
  if (!automatic) pauseTour();
  hideCard();
  cancelGuideTransition({ preserveFade: automatic });
  const artwork = orderedRoute.artworks[index];
  guidedIndex = index;
  currentChapter = artwork.chapter;
  guidePosition.textContent = `Hall ${artwork.chapter} · ${String(index + 1).padStart(2, '0')}/${orderedRoute.artworks.length} · ${artwork.title}`;
  previousArtwork.disabled = index === 0 && !storyData;
  nextArtwork.disabled = index === orderedRoute.artworks.length - 1;
  updateWorkPosition();
  updateWallControls();
  if (!automatic && tourMode === 'collection') collectionTour.adopt(workOrder.indexOf(metadata[artwork.slot]?.collectionId));
  const view = artworkView(artwork);
  const { location, target, targetPitch, yawDifference, travelDistance } = view;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arrival = new Promise((resolve) => { guideArrival = resolve; });
  focusMotion = reducedMotion || instant || !canGlideTo(view, automatic) ? null : {
    elapsed: 0, duration: automatic ? THREE.MathUtils.clamp(travelDistance / 2 + Math.abs(yawDifference), 1.8, 4.5) : 1.1,
    from: camera.position.clone(), to: new THREE.Vector3(...location),
    yawFrom: yaw, yawTo: yaw + yawDifference, pitchFrom: pitch, pitchTo: targetPitch,
    openSlot: openCard ? artwork.slot : null,
    openOptions: { returnToStory },
  };
  if (!focusMotion) {
    const arrive = () => {
      guideTransitionTimer = null;
      viewFrom(location, target);
      renderer.domElement.classList.remove('repositioning');
      const finished = guideArrival;
      guideArrival = null;
      finished?.(true);
      if (openCard) openImmersive(artwork.slot, { returnToStory });
    };
    if (reducedMotion || openCard || instant) arrive();
    else {
      renderer.domElement.classList.add('repositioning');
      guideTransitionTimer = window.setTimeout(arrive, 150);
    }
  }
  tour.seconds = artwork.routeTime;
  updateTimeline();
  renderCatalogue();
  return arrival;
}

function renderCatalogue() {
  const search = catalogSearch.value.trim().toLocaleLowerCase();
  const matches = (...values) => values.some((value) => typeof value === 'string' && `${value} ${translate(value, 'zh')}`.toLocaleLowerCase().includes(search));
  chapterNav.replaceChildren();
  catalogContent.replaceChildren();
  for (const chapter of chapters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = chapter.id;
    button.title = chapter.title + ' · ' + chapter.years;
    button.setAttribute('aria-label', `Browse Hall ${chapter.id}: ${chapter.title}`);
    button.classList.toggle('selected', !search && chapter.id === currentChapter);
    button.addEventListener('click', () => {
      currentChapter = chapter.id;
      catalogSearch.value = '';
      renderCatalogue();
    });
    chapterNav.append(button);
  }

  let resultCount = 0;
  const afterlifeMatches = (entry) => matches(entry.title, entry.subtitle, entry.summary);
  const afterlifeChapterMatch = search && matches(afterlifeData?.title, afterlifeData?.subtitle);
  if (afterlife && (!search || afterlifeChapterMatch || afterlifeData.sections.some(afterlifeMatches) || afterlife.stories.some(afterlifeMatches))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '08';
    button.title = 'Afterlife · 1890 onward';
    button.setAttribute('aria-label', 'Browse Hall 08: Afterlife');
    button.classList.toggle('selected', !search && currentChapter === '08');
    button.addEventListener('click', () => {
      currentChapter = '08';
      catalogSearch.value = '';
      renderCatalogue();
    });
    chapterNav.append(button);
    if (search || currentChapter === '08') {
      const section = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = '08 · Afterlife';
      const intro = document.createElement('p');
      intro.className = 'catalog-intro';
      intro.textContent = `${afterlifeData.subtitle}. An independent epilogue gallery beyond Auvers.`;
      const enter = document.createElement('button');
      enter.type = 'button';
      enter.className = 'catalog-jump';
      enter.textContent = 'Enter Hall 08 →';
      enter.addEventListener('click', () => guideToAfterlife());
      const readIntro = document.createElement('button');
      readIntro.type = 'button';
      readIntro.className = 'catalog-jump';
      readIntro.textContent = 'Read introduction →';
      readIntro.addEventListener('click', () => hallTexts.open('08'));
      section.append(heading, intro, enter, readIntro);
      for (const chapter of afterlifeData.sections) {
        const chapterMatch = !search || afterlifeChapterMatch || afterlifeMatches(chapter);
        const cards = chapter.cardIds.map((id) => afterlife.card(id)).filter((card) => chapterMatch || afterlifeMatches(card));
        if (!cards.length) continue;
        const label = document.createElement('h4');
        label.textContent = chapter.title;
        const follow = document.createElement('button');
        follow.type = 'button';
        follow.className = 'catalog-jump';
        follow.textContent = `Explore ${chapter.subtitle} →`;
        follow.addEventListener('click', () => afterlife.open(chapter.id));
        section.append(label, follow);
        for (const card of cards) {
          const locate = document.createElement('button');
          locate.type = 'button';
          locate.className = 'catalog-jump';
          locate.textContent = `${card.title} →`;
          locate.addEventListener('click', () => afterlifeData.cards.includes(card) ? guideToAfterlife(card.id) : afterlife.open(card.id));
          section.append(locate);
          resultCount += 1;
        }
      }
      catalogContent.append(section);
    }
  }
  const visibleChapters = search ? chapters : chapters.filter((chapter) => chapter.id === currentChapter);
  for (const chapter of visibleChapters) {
    const chapterMatch = search && matches(chapter.title, chapter.years, chapter.intro);
    const groups = chapter.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const work = collection?.works[item.workId];
        return work?.authoredCard ? { ...item, ...work } : item;
      }).filter((item) => !search || chapterMatch || matches(group.title)
        || matches(...(typeof item === 'string' ? [item] : [item.title, ...(item.aliases ?? []), item.date, item.fNumber, item.museumId, item.institution]))),
    })).filter((group) => group.items.length);
    if (!groups.length) continue;
    resultCount += groups.reduce((count, group) => count + group.items.length, 0);
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = chapter.id + ' · ' + chapter.title;
    const years = document.createElement('span');
    years.className = 'catalog-years';
    years.textContent = chapter.years;
    const intro = document.createElement('p');
    intro.className = 'catalog-intro';
    intro.textContent = chapter.intro;
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'catalog-jump';
    jump.textContent = `Enter Hall ${chapter.id}`;
    jump.addEventListener('click', () => jumpToChapter(chapter));
    const actions = document.createElement('div');
    actions.className = 'catalog-actions';
    const readIntro = document.createElement('button');
    readIntro.type = 'button';
    readIntro.className = 'catalog-jump';
    readIntro.textContent = 'Read introduction';
    readIntro.addEventListener('click', () => hallTexts?.open(chapter.id));
    actions.append(jump, readIntro);
    if (['04', '05'].includes(chapter.id) && yellowHouse) {
      const follow = document.createElement('button');
      follow.type = 'button';
      follow.className = 'catalog-jump';
      follow.textContent = chapter.id === '04' ? 'A Room for Gauguin →' : 'The Yellow House story →';
      follow.addEventListener('click', () => yellowHouse.open(chapter.id === '04' ? 'overview' : 'staying-or-leaving'));
      actions.append(follow);
    }
    if (chapter.id === '07' && hallTexts) {
      for (const [id, label] of [['arrival', 'Life in Auvers →'], ['final-days', 'The Final Days →']]) {
        const narrative = document.createElement('button');
        narrative.type = 'button';
        narrative.className = 'catalog-jump';
        narrative.textContent = label;
        narrative.addEventListener('click', () => hallTexts.openAuvers(id));
        actions.append(narrative);
      }
    }
    section.append(heading, years, intro, actions);
    for (const group of groups) {
      const wrapper = document.createElement('div');
      wrapper.className = 'catalog-group';
      const title = document.createElement('h4');
      title.textContent = group.title;
      const list = document.createElement('ul');
      for (const item of group.items) {
        const row = document.createElement('li');
        row.className = 'catalog-item';
        const name = typeof item === 'string' ? item : item.title;
        const location = item.workId && collection && locateWork(collection, item.workId);
        const mounted = Boolean(location) || (typeof item !== 'string' && item.slot && metadata[item.slot]?.image);
        if (mounted) {
          const link = document.createElement('button');
          link.type = 'button';
          link.textContent = name;
          link.addEventListener('click', () => location ? showCollectionWork(item.workId, true) : jumpToArtwork(chapter, item.slot));
          row.append(link);
          if (location) {
            const details = document.createElement('small');
            details.className = 'catalog-work-details';
            details.textContent = [item.date, item.fNumber || item.museumId, item.institution].filter(Boolean).join(' · ');
            row.append(details);
          }
        } else {
          row.append(document.createTextNode(name));
        }
        const badge = document.createElement('span');
        badge.className = 'catalog-badge';
        badge.textContent = location
          ? `${(wallPages.get(location.hall) ?? 0) === location.page ? 'On these walls' : 'View wall set'} ${location.page + 1} ↗`
          : mounted ? 'On view ↗' : 'Research lead · not installed';
        row.append(badge);
        list.append(row);
      }
      wrapper.append(title, list);
      section.append(wrapper);
    }
    catalogContent.append(section);
  }
  if (!resultCount) {
    const empty = document.createElement('p');
    empty.className = 'catalog-empty';
    empty.textContent = 'No matching entry. Try another title or keyword.';
    catalogContent.append(empty);
  }
  catalogContent.scrollTop = 0;
  updateWallControls();
}

catalogToggle.addEventListener('click', () => { visitGuide.recordAction('navigate'); setCatalogueOpen(!catalogue.classList.contains('open')); });
document.querySelector('#catalog-close').addEventListener('click', () => setCatalogueOpen(false));
catalogSearch.addEventListener('input', renderCatalogue);
onLanguageChange(() => {
  for (const [slot, label] of dynamicLabels) {
    const saved = label.userData.localizedLabel;
    if (saved) {
      const visible = label.visible;
      labelFor(slot, saved.entry, saved.height);
      label.visible = visible;
    }
  }
});

function pickArtwork(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const visible = pickMeshes.filter((object) => {
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
  });
  const first = raycaster.intersectObjects(visible, false)[0];
  if (first?.object.userData.film_screen || first?.object.userData.film_entry) return 'film:opening';
  if (first?.object.userData.story_exhibit) return `story:${first.object.userData.story_exhibit}`;
  if (first?.object.userData.hall_text) return `intro:${first.object.userData.hall_text}`;
  if (first?.object.userData.afterlife_card) return `afterlife:${first.object.userData.afterlife_card}`;
  if (first?.object.userData.yellow_house_story) return `yellow-house:${first.object.userData.yellow_house_story}`;
  return first?.object.userData.artwork_slot ?? null;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  if (wallBusy || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen()) return;
  if (catalogue.classList.contains('open')) return;
  const tracked = activePointers.get(event.pointerId);
  if (tracked) {
    const dx = event.clientX - tracked.x;
    const dy = event.clientY - tracked.y;
    tracked.x = event.clientX;
    tracked.y = event.clientY;
    if (activePointers.size >= 2) {
      const distance = pointerSpan();
      if (pinchDistance > 0 && distance > 0) queueDolly(Math.log(distance / pinchDistance) * 8);
      pinchDistance = distance;
      return;
    }
    if (gestureHadPinch) return;
    gestureMoved ||= Math.hypot(tracked.x - tracked.startX, tracked.y - tracked.startY) > 6;
    if (gestureMoved) {
      yaw += dx * 0.0035;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.0035, -0.85, 0.85);
      updateView();
    }
    return;
  }
  if (pinned) return;
  const slot = pickArtwork(event);
  renderer.domElement.style.cursor = slot ? 'pointer' : 'grab';
  if (viewer.clientWidth <= 600 || event.pointerType === 'touch') {
    hideCard();
    return;
  }
  if (slot) {
    if (tour.playing) pauseTour();
    if (slot.startsWith('story:') || slot.startsWith('film:') || slot.startsWith('intro:') || slot.startsWith('afterlife:') || slot.startsWith('yellow-house:')) hideCard();
    else showCard(slot);
  } else {
    scheduleCardHide();
  }
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || entry.isOpen() || !orderedRoute || wallBusy || !immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen()) return;
  if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  stopDolly();
  hideCard();
  pauseTour();
  cancelGuideTransition();
  activePointers.set(event.pointerId, {
    x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
  });
  if (activePointers.size === 1) {
    gestureMoved = false;
    gestureHadPinch = false;
    pointerDownSlot = pickArtwork(event);
  } else {
    gestureMoved = true;
    gestureHadPinch = true;
    pointerDownSlot = null;
    pinchDistance = pointerSpan();
  }
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = 'grabbing';
});

function pointerSpan() {
  const [first, second] = [...activePointers.values()];
  return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : null;
}

function finishPointer(event, cancelled = false) {
  const tracked = activePointers.get(event.pointerId);
  if (!tracked) return;
  const tapped = !cancelled && !gestureMoved && !gestureHadPinch && activePointers.size === 1
    && Math.hypot(event.clientX - tracked.startX, event.clientY - tracked.startY) <= 6;
  if (!cancelled && (gestureMoved || gestureHadPinch)) visitGuide.recordAction('move');
  const slot = tapped ? pickArtwork(event) : null;
  const openSlot = slot && slot === pointerDownSlot ? slot : null;
  activePointers.delete(event.pointerId);
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  pinchDistance = pointerSpan();
  if (!activePointers.size) {
    gestureMoved = false;
    gestureHadPinch = false;
    pointerDownSlot = null;
    renderer.domElement.style.cursor = 'grab';
  }
  if (cancelled) stopDolly();
  if (openSlot === 'film:opening') openingFilm?.open();
  else if (openSlot?.startsWith('intro:')) hallTexts?.open(openSlot.slice(6));
  else if (openSlot?.startsWith('story:')) story.open();
  else if (openSlot === 'afterlife:overview') guideToAfterlife();
  else if (openSlot?.startsWith('afterlife:')) afterlife.open(openSlot.slice(10));
  else if (openSlot?.startsWith('yellow-house:')) yellowHouse.open(openSlot.slice(13));
  else if (openSlot) openImmersive(openSlot);
}

renderer.domElement.addEventListener('pointerup', (event) => finishPointer(event));
renderer.domElement.addEventListener('pointercancel', (event) => finishPointer(event, true));
renderer.domElement.addEventListener('lostpointercapture', (event) => finishPointer(event, true));

renderer.domElement.addEventListener('wheel', (event) => {
  if (!orderedRoute || wallBusy || !immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen() || catalogue.classList.contains('open') || event.deltaY === 0) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewer.clientHeight : 1;
  queueDolly(-event.deltaY * unit * (event.ctrlKey ? 0.025 : 0.008));
}, { passive: false });

renderer.domElement.addEventListener('pointerleave', () => {
  scheduleCardHide();
});

card.addEventListener('pointerenter', cancelCardHide);
card.addEventListener('pointerleave', scheduleCardHide);
card.addEventListener('focusin', cancelCardHide);
card.addEventListener('focusout', scheduleCardHide);
document.querySelector('#card-close').addEventListener('click', hideCard);
immersiveClose.addEventListener('click', dismissImmersive);
immersiveStoryBack.addEventListener('click', dismissImmersive);
immersivePrevious.addEventListener('click', () => browseImmersive(-1));
immersiveNext.addEventListener('click', () => browseImmersive(1));
immersive.addEventListener('click', (event) => {
  if (event.target === immersive) dismissImmersive();
});
async function toggleTour() {
  const wasPlaying = tourMode === 'collection' ? collectionTour.state().playing : tour.playing;
  visitGuide.recordAction(wasPlaying ? 'tour-pause' : 'begin-tour');
  if (tourMode === 'collection' && collectionTour.state().playing) {
    pauseTour();
    return;
  }
  if (wallBusy) return;
  filmVideo.pause();
  leaveAfterlife();
  yellowHouse?.close();
  if (tourMode === 'collection') {
    if (['loading', 'moving'].includes(collectionTour.state().phase)) {
      await collectionTour.play();
      return;
    }
    tour.playing = false;
    story.close();
    closeImmersive();
    hideCard();
    stopDolly();
    cancelGuideTransition();
    const state = collectionTour.state();
    if (state.phase === 'holding') {
      const id = workOrder[state.index];
      const location = locateWork(collection, id);
      const station = orderedRoute.artworks.find((entry) => entry.slot === location.slot);
      const view = artworkView(station);
      const moved = metadata[location.slot]?.collectionId !== id || view.travelDistance > 0.05 || Math.abs(view.yawDifference) > 0.01 || Math.abs(pitch) > 0.01 || storyStationActive || currentChapter !== station.chapter;
      if (moved && !await collectionTour.seek(state.index)) return;
    }
    if (tourMode === 'collection') await collectionTour.play();
    return;
  }
  if (!tour.playing && collection?.halls.some((hall) => wallPages.get(hall.id)) && !await restoreHighlights()) return;
  story.close();
  stopDolly();
  cancelGuideTransition();
  if (tour.seconds >= totalSeconds) tour.seconds = 0;
  focusMotion = null;
  hideCard();
  closeImmersive();
  tour.playing = !tour.playing;
  if (tour.playing) {
    resetGuidedSelection();
    positionOnRoute();
  }
  updateTimeline();
}
tourButton.addEventListener('click', toggleTour);

tourModeSelect.addEventListener('change', () => {
  visitGuide.recordAction('navigate');
  const mode = tourModeSelect.value;
  pauseTour();
  cancelGuideTransition();
  stopDolly();
  tourMode = mode === 'collection' ? 'collection' : 'highlights';
  updateTimeline();
  measureCardLimits();
});

tourHold.addEventListener('change', () => collectionTour.setHold(Number(tourHold.value)));

tourProgress.addEventListener('input', async () => {
  if (wallBusy) return;
  visitGuide.recordAction('navigate');
  leaveAfterlife();
  filmVideo.pause();
  const value = Number(tourProgress.value);
  story.close();
  yellowHouse?.close();
  closeImmersive();
  cancelGuideTransition();
  pauseTour();
  hideCard();
  if (tourMode === 'collection') {
    await collectionTour.seek(value - 1);
    return;
  }
  focusMotion = null;
  tour.seconds = value;
  resetGuidedSelection();
  positionOnRoute();
  updateTimeline();
});

previousArtwork.addEventListener('click', () => { visitGuide.recordAction('navigate'); browseCollection(-1); });
nextArtwork.addEventListener('click', () => { visitGuide.recordAction('navigate'); browseCollection(1); });

function showViewResetFeedback(route = false) {
  window.clearTimeout(viewResetTimer);
  viewResetStatus.textContent = translate(route ? 'Route view restored · Tour paused' : 'Restoring the front view · Tour paused');
  viewResetStatus.hidden = false;
  viewResetTimer = window.setTimeout(() => { viewResetStatus.hidden = true; }, 3200);
}

resetView.addEventListener('click', async () => {
  if (!galleryReady || wallBusy) return;
  visitGuide.recordAction('navigate');
  const afterlifeId = afterlifeStation;
  const introduction = hallTextStation;
  const atStory = storyStationActive;
  const artworkIndex = guidedIndex;
  const filmStop = orderedRoute.camera.openingFilmStop;
  const atFilm = filmStop && tour.seconds >= filmStop.start && tour.seconds <= filmStop.end;
  const collectionIndex = collectionTour.state().index;
  openingFilm?.close();
  filmVideo.pause();
  hallTexts?.close();
  afterlife?.close();
  story.close();
  yellowHouse?.close();
  pauseTour();
  cancelGuideTransition();
  stopDolly();
  keys.clear();
  hideCard();
  closeImmersive();
  let restored;
  if (afterlifeId) {
    guideToAfterlife(afterlifeId);
  } else if (introduction) {
    guideToHallText(introduction);
  } else if (atStory) {
    guideToStory();
  } else if (atFilm) {
    returnToOpeningFilm();
  } else if (artworkIndex >= 0) {
    restored = await guideTo(artworkIndex);
  } else if (tourMode === 'collection' && collectionIndex >= 0) {
    restored = await collectionTour.seek(collectionIndex);
  } else {
    positionOnRoute();
    updateTimeline();
    showViewResetFeedback(true);
    return;
  }
  if (restored !== false) showViewResetFeedback();
});

window.addEventListener('keydown', (event) => {
  if (visitGuide.isHelpOpen()) return;
  if (entry.isOpen()) return;
  if (openingFilm?.isOpen()) return;
  if (hallTexts?.isOpen()) return;
  if (afterlife?.isOpen()) return;
  if (yellowHouse?.isOpen()) return;
  if (story.isOpen()) return;
  if (!immersive.hidden) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissImmersive();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!event.target.matches('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault();
        browseImmersive(event.key === 'ArrowLeft' ? -1 : 1);
      }
    } else if (event.key === 'Tab') {
      const controls = [...immersive.querySelectorAll('button:not(:disabled), a[href], summary')].filter((element) => element.getClientRects().length);
      const current = controls.indexOf(document.activeElement);
      if (current === -1 || (event.shiftKey && current === 0) || (!event.shiftKey && current === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
      }
    }
    return;
  }
  if (event.key === 'Escape') {
    closeImmersive();
    hideCard();
    if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  }
  if (event.target.matches('input, textarea, select') || wallBusy) return;
  if (event.code === 'Space' && event.target === document.body) {
    event.preventDefault();
    tourButton.click();
  }
  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
    event.preventDefault();
    if (event.code === 'ArrowRight') nextArtwork.click();
    else if (guidedIndex < 0 && !hallTextStation && !afterlifeStation) browseCollection(1);
    else previousArtwork.click();
  }
  if (/^Key[WASD]$/.test(event.code)) keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => {
  if (tourMode === 'collection') pauseTour();
  keys.clear();
  stopDolly();
  activePointers.clear();
  pinchDistance = null;
  gestureMoved = false;
  gestureHadPinch = false;
  pointerDownSlot = null;
  renderer.domElement.style.cursor = 'grab';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTour();
});

function stopDolly() {
  dolly.remaining = 0;
}

function queueDolly(distance) {
  if (!orderedRoute || entry.isOpen() || visitGuide.isHelpOpen() || wallBusy || !immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen() || catalogue.classList.contains('open')
      || !Number.isFinite(distance) || distance === 0) return;
  visitGuide.recordAction('move');
  if (tour.playing || collectionTour.state().playing) pauseTour();
  cancelGuideTransition();
  hideCard();
  dolly.remaining = THREE.MathUtils.clamp(dolly.remaining + distance, -8, 8);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    translateDolly(dolly.remaining);
    stopDolly();
  }
}

function translateDolly(distance) {
  const steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.15));
  const step = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(distance / steps);
  const candidate = camera.position.clone();
  let blocked = false;
  for (let index = 0; index < steps; index += 1) {
    candidate.copy(camera.position).add(step);
    if (!insideGallery(candidate.x, candidate.z)) {
      blocked = true;
      break;
    }
    camera.position.copy(candidate);
  }
  camera.position.y = orderedRoute.eyeHeight;
  updateWalkingChapter();
  updateView();
  return !blocked;
}

function updateDolly(delta) {
  if (!orderedRoute || !dolly.remaining) return;
  if (!immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen() || catalogue.classList.contains('open')) {
    stopDolly();
    return;
  }
  const elapsed = Math.min(delta, 0.05);
  const distance = Math.sign(dolly.remaining) * Math.min(
    Math.abs(dolly.remaining) * (1 - Math.exp(-10 * elapsed)), 4 * elapsed,
  );
  const clear = translateDolly(distance);
  dolly.remaining -= distance;
  if (!clear || Math.abs(dolly.remaining) < 0.0005) stopDolly();
}

function moveFreely(delta) {
  if (!keys.size || entry.isOpen() || !orderedRoute || wallBusy || !immersive.hidden || story.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen()) return;
  const forward = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const right = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const direction = new THREE.Vector3();
  if (keys.has('KeyW')) direction.add(forward);
  if (keys.has('KeyS')) direction.sub(forward);
  if (keys.has('KeyD')) direction.add(right);
  if (keys.has('KeyA')) direction.sub(right);
  if (direction.lengthSq() === 0) return;
  visitGuide.recordAction('move');
  if (hallTextStation || afterlifeStation) {
    leaveAfterlife();
    hallTextStation = null;
    resetGuidedSelection();
    updateWallControls();
  }
  stopDolly();
  if (tour.playing || collectionTour.state().playing) pauseTour();
  focusMotion = null;
  cancelGuideTransition();
  const step = direction.normalize().multiplyScalar(Math.min(delta, 0.05) * 4);
  const candidate = camera.position.clone().add(step);
  if (insideGallery(candidate.x, camera.position.z)) camera.position.x = candidate.x;
  if (insideGallery(camera.position.x, candidate.z)) camera.position.z = candidate.z;
  camera.position.y = orderedRoute.eyeHeight;
  updateWalkingChapter();
  updateView();
}

function updateWalkingChapter() {
  const region = orderedRoute.walkableRegions.find((entry) =>
    entry.chapter !== '00' && polygonContains(camera.position.x, camera.position.z, entry.polygon));
  if (region && region.chapter !== currentChapter) {
    currentChapter = region.chapter;
    renderCatalogue();
  }
}

function polygonContains(horizontal, depth, polygon) {
  let contained = false;
  let previous = polygon.at(-1);
  for (const following of polygon) {
    if ((following[1] > depth) !== (previous[1] > depth)) {
      const crossing = (previous[0] - following[0]) * (depth - following[1]) /
        (previous[1] - following[1]) + following[0];
      if (horizontal < crossing) contained = !contained;
    }
    previous = following;
  }
  return contained;
}

function segmentDistance(horizontal, depth, start, end) {
  const directionX = end[0] - start[0];
  const directionZ = end[1] - start[1];
  const squared = directionX * directionX + directionZ * directionZ;
  const fraction = squared ? THREE.MathUtils.clamp(
    ((horizontal - start[0]) * directionX + (depth - start[1]) * directionZ) / squared, 0, 1,
  ) : 0;
  return Math.hypot(horizontal - start[0] - fraction * directionX, depth - start[1] - fraction * directionZ);
}

function insideGallery(x, z) {
  if (!orderedRoute.walkableRegions.some((region) => polygonContains(x, z, region.polygon))) return false;
  const clearance = orderedRoute.playerRadius;
  return !orderedRoute.obstacles.some((obstacle) => {
    if (obstacle.type === 'circle') {
      return Math.hypot(x - obstacle.center[0], z - obstacle.center[1]) < obstacle.radius + clearance;
    }
    const polygon = obstacle.polygon;
    if (!obstacle.bounds) obstacle.bounds = [
      Math.min(...polygon.map((point) => point[0])), Math.min(...polygon.map((point) => point[1])),
      Math.max(...polygon.map((point) => point[0])), Math.max(...polygon.map((point) => point[1])),
    ];
    const bounds = obstacle.bounds;
    if (x < bounds[0] - clearance || x > bounds[2] + clearance || z < bounds[1] - clearance || z > bounds[3] + clearance) return false;
    return polygonContains(x, z, polygon) || polygon.some((start, index) =>
      segmentDistance(x, z, start, polygon[(index + 1) % polygon.length]) < clearance);
  });
}

function clearWalkingSegment(start, end) {
  const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[2] - start[2]) / 0.25));
  for (let index = 0; index <= steps; index += 1) {
    const fraction = index / steps;
    if (!insideGallery(THREE.MathUtils.lerp(start[0], end[0], fraction), THREE.MathUtils.lerp(start[2], end[2], fraction))) return false;
  }
  return true;
}

function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();
  const filmStop = orderedRoute?.camera.openingFilmStop;
  visitGuide.update({
    ready: galleryReady,
    blocked: entry.isOpen() || openingFilm?.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen() || story.isOpen() || !immersive.hidden || catalogue.classList.contains('open'),
    playing: tourMode === 'collection' ? collectionTour.state().playing : tour.playing,
    mode: tourMode, chapter: currentChapter, story: storyStationActive, afterlife: Boolean(afterlifeStation),
    introduction: hallTextStation?.kind === 'hall', artwork: guidedIndex >= 0,
    atFilm: Boolean(filmStop && tour.seconds >= filmStop.start && tour.seconds <= filmStop.end),
  });
  if (visitGuide.isHelpOpen() || openingFilm?.isOpen() || hallTexts?.isOpen() || afterlife?.isOpen() || yellowHouse?.isOpen()) return;
  if (tour.playing) {
    tour.seconds = Math.min(totalSeconds, tour.seconds + delta);
    positionOnRoute();
    if (tour.seconds >= totalSeconds) {
      pauseTour();
      showAfterlifeInvitation();
    }
    updateTimeline();
  }
  if (focusMotion) {
    focusMotion.elapsed = Math.min(focusMotion.duration, focusMotion.elapsed + (tourMode === 'collection' ? Math.min(delta, 0.05) : delta));
    const progress = focusMotion.elapsed / focusMotion.duration;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.copy(focusMotion.from).lerp(focusMotion.to, eased);
    yaw = THREE.MathUtils.lerp(focusMotion.yawFrom, focusMotion.yawTo, eased);
    pitch = THREE.MathUtils.lerp(focusMotion.pitchFrom, focusMotion.pitchTo, eased);
    updateView();
    if (progress >= 1) {
      const { openSlot, openOptions } = focusMotion;
      focusMotion = null;
      const arrival = guideArrival;
      guideArrival = null;
      arrival?.(true);
      if (openSlot) openImmersive(openSlot, openOptions);
    }
  }
  if (tourMode === 'collection') collectionTour.tick(delta);
  moveFreely(delta);
  updateDolly(delta);
  updateFilmControls();
  renderer.render(scene, camera);
  positionCard();
}

function updateCameraFraming() {
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  const verticalFov = orderedRoute?.camera.verticalFov ?? 64;
  const tangent = Math.tan(THREE.MathUtils.degToRad(verticalFov / 2));
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tangent * Math.max(1, (16 / 9) / camera.aspect)));
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  updateCameraFraming();
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  measureCardLimits();
  positionCard();
});

async function loadGallery() {
  let storyLayout;
  let hallTextData;
  let authoredCards;
  let auversData;
  [metadata, chapters, orderedRoute, collection, storyData, storyLayout, hallTextData, authoredCards, afterlifeData, yellowHouseData, auversData] = await Promise.all([
    `./data/artworks_en.json?v=${layoutRevision}`, `./data/chapters_en.json?v=${layoutRevision}`, `./data/ordered_route_v28.json?v=${layoutRevision}`, `./data/collection_en.json?v=${layoutRevision}`,
    `./data/story_exhibit_en.json?v=${layoutRevision}`, `./data/story_transition_layout.json?v=${layoutRevision}`,
    `./data/hall_introductions_en.json?v=${layoutRevision}`,
    `./data/artwork_cards_en.json?v=${layoutRevision}`,
    `./data/afterlife_en.json?v=${layoutRevision}`,
    `./data/yellow_house_en.json?v=${layoutRevision}`,
    `./data/auvers_en.json?v=${layoutRevision}`,
  ].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return response.json();
  }));
  validateCollection(collection);
  validateHallTexts(hallTextData);
  validateAfterlife(afterlifeData);
  validateYellowHouse(yellowHouseData, collection);
  validateAuvers(auversData, collection);
  registerExhibitionTranslations({ hallTexts: hallTextData, story: storyData, afterlife: afterlifeData, yellowHouse: yellowHouseData, auvers: auversData, artworkCards: authoredCards, chapters });
  orderedRoute = retimeHighlightTour(addFirstHallTourStops(orderedRoute, storyData.station), totalSeconds);
  storyData.station.routeTime = orderedRoute.camera.exhibitStops.find((stop) => stop.kind === 'story').start;
  for (const chapter of chapters) {
    const listed = new Set(chapter.groups.flatMap((group) => group.items.map((item) => item.workId).filter(Boolean)));
    const hall = collection.halls.find((entry) => entry.id === chapter.id);
    for (const id of hall?.pages.flat() ?? []) {
      if (listed.has(id)) continue;
      const work = collection.works[id];
      let group = chapter.groups.find((entry) => entry.title === work.group);
      if (!group) {
        group = { title: work.group ?? 'Additional Collection Works', items: [] };
        chapter.groups.push(group);
      }
      group.items.push({ ...work, workId: id });
      listed.add(id);
    }
  }
  artworkCards.setData(authoredCards, collection, chapters);
  story.setData(storyData);
  orderedRoute.walkableRegions.push(...storyLayout.walkableRegions);
  orderedRoute.obstacles.push(...storyLayout.obstacles);
  for (const entry of [hallTextData.arrival, ...hallTextData.halls, hallTextData.departure]) {
    const wing = entry.wall.wing;
    if (wing) {
      const [horizontal, , depth] = wing.position;
      orderedRoute.obstacles.push({ type: 'polygon', name: `Hall ${entry.id} introduction entry wing`, polygon: [
        [horizontal - wing.width / 2, depth - wing.depth / 2], [horizontal + wing.width / 2, depth - wing.depth / 2],
        [horizontal + wing.width / 2, depth + wing.depth / 2], [horizontal - wing.width / 2, depth + wing.depth / 2],
      ] });
    }
    const pose = wallTextPose(entry);
    if (!insideGallery(pose.location.x, pose.location.z)) throw new Error(`The ${entry.id} introduction viewpoint is not walkable`);
  }
  const finalDaysPose = wallTextPose({ wall: auversData.wall });
  if (!insideGallery(finalDaysPose.location.x, finalDaysPose.location.z)) throw new Error('The final-days reading viewpoint is not walkable');
  if (!insideGallery(storyData.station.position[0], storyData.station.position[2])) throw new Error('The London story viewpoint is not walkable');
  for (const id of ['overview', ...afterlifeData.cards.map((entry) => entry.id)]) {
    const { location } = afterlifePose(afterlifeData, id, orderedRoute.eyeHeight);
    if (!insideGallery(location.x, location.z)) throw new Error(`The Afterlife ${id} viewpoint is not walkable`);
  }
  workOrder = readingOrder(collection);
  for (const hall of collection.halls) {
    wallPages.set(hall.id, 0);
    hall.pages[0].forEach((id, index) => { metadata[hall.slots[index]] = { ...collection.works[id], collectionId: id }; });
  }
  updateCameraFraming();
  const gltf = await new GLTFLoader().loadAsync(`./assets/gallery_v29.glb?v=${layoutRevision}`, (event) => {
    if (event.total) loadProgress.textContent = `${Math.floor((event.loaded / event.total) * 100)}%`;
  });
  const curatedSlots = new Set(Object.entries(metadata).filter(([, entry]) => entry.image).map(([slot]) => slot));
  gltf.scene.traverse((object) => {
    if (object.isMesh) {
      const surfaces = Array.isArray(object.material) ? object.material : [object.material];
      if (surfaces.some((surface) => !surface.transparent || surface.opacity >= 0.5)) pickMeshes.push(object);
    }
    if (object.isMesh && object.userData.artwork_slot) {
      const slot = object.userData.artwork_slot;
      if (!curatedSlots.has(slot)) throw new Error(`Missing artwork data for ${slot}`);
      meshes.push(object);
      artworkMeshes.set(slot, object);
    }
    if (object.isMesh && object.userData.film_screen) filmScreen = object;
    if (object.userData.film_placeholder) filmPlaceholder = object;
    if (object.isMesh) {
      const sourceName = gltf.parser.json.nodes[gltf.parser.associations.get(object)?.nodes]?.name ?? object.name;
      if (['07 | Afterlife archive title', '07 | Afterlife archive explanation'].some((name) => sourceName === name || object.name === THREE.PropertyBinding.sanitizeNodeName(name))) object.visible = false;
      const base = orderedRoute.artworks.find((artwork) => [' | Adaptive oak frame', ' | Narrow ivory reveal', ' | English label'].some((suffix) => sourceName === artwork.slot + suffix || object.name === THREE.PropertyBinding.sanitizeNodeName(artwork.slot + suffix)));
      if (base) {
        object.geometry.computeBoundingBox();
        const width = object.geometry.boundingBox.max.x - object.geometry.boundingBox.min.x;
        const kind = sourceName.endsWith('English label') || object.name.endsWith('English_label') ? 'label' : sourceName.endsWith('ivory reveal') || object.name.endsWith('ivory_reveal') ? 'reveal' : 'frame';
        if (!frameParts.has(base.slot)) frameParts.set(base.slot, []);
        frameParts.get(base.slot).push({ object, kind, scale: object.scale.clone(), border: width - base.width });
      }
    }
  });
  if (artworkMeshes.size !== orderedRoute.artworks.length || artworkMeshes.size !== curatedSlots.size) {
    throw new Error(`Loaded ${artworkMeshes.size} of ${orderedRoute.artworks.length} ordered works`);
  }
  if (orderedRoute.artworks.some((entry) => !artworkMeshes.has(entry.slot))) {
    throw new Error('The gallery route and artwork numbers do not match');
  }
  if (orderedRoute.artworks.some((entry) => frameParts.get(entry.slot)?.length !== 3)) throw new Error('Adaptive artwork frames are incomplete');
  await Promise.all(Object.entries(metadata).filter(([, entry]) => entry.image).map(async ([slot, entry]) => {
    const object = artworkMeshes.get(slot);
    if (!object) throw new Error(`Could not find artwork position ${slot}`);
    const texture = await new THREE.TextureLoader().loadAsync(entry.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    texture.needsUpdate = true;
    object.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false });
    sizeArtworkMount(slot, entry, texture, true);
  }));
  scene.add(gltf.scene);
  const narrative = await new GLTFLoader().loadAsync(storyData.model);
  let storySurface = null;
  narrative.scene.traverse((object) => {
    if (!object.isMesh) return;
    pickMeshes.push(object);
    if (object.userData.story_exhibit === storyData.id) storySurface = object;
  });
  if (!storySurface) throw new Error('The London story display is missing');
  const storyTexture = await new THREE.TextureLoader().loadAsync(storyData.poster);
  storyTexture.colorSpace = THREE.SRGBColorSpace;
  storyTexture.flipY = false;
  storyTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  storySurface.material = new THREE.MeshBasicMaterial({ map: storyTexture, side: THREE.FrontSide, toneMapped: false });
  scene.add(narrative.scene);
  if (!filmScreen) throw new Error('The opening film screen is missing');
  openingFilm = createOpeningFilm({
    viewer, renderer, scene, camera, screen: filmScreen, placeholder: filmPlaceholder, pickMeshes,
    onReturn: () => visitGuide.offerWelcome(),
    onTour: () => visitGuide.startTour(),
    async onCollection() {
      pauseTour();
      cancelGuideTransition();
      stopDolly();
      tourMode = 'collection';
      collectionTour.adopt(-1);
      updateTimeline();
      measureCardLimits();
      await toggleTour();
    },
    onExplore() { guideToStory({ immediate: true }); story.open(); },
    onWorks() { visitGuide.recordAction('navigate'); enterEarlyDrawings(); },
    onOpen() {
      leaveAfterlife();
      hallTexts?.close();
      story.close();
      yellowHouse?.close();
      closeImmersive();
      if (catalogue.classList.contains('open')) setCatalogueOpen(false);
      pauseTour();
      cancelGuideTransition();
      stopDolly();
      hideCard();
      keys.clear();
      focusMotion = null;
      for (const pointerId of activePointers.keys()) {
        if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
      }
      activePointers.clear();
      pinchDistance = null;
      gestureMoved = false;
      gestureHadPinch = false;
      pointerDownSlot = null;
      returnToOpeningFilm();
    },
  });
  openingFilm.setSource('./assets/van-gogh-early-years.mp4?v=2026-10-02-v5', 'The Early Years');
  hallTexts = createHallTexts({
    data: hallTextData, auversData, collection, scene, renderer, pickMeshes,
    currentChapter: () => hallTextStation?.readerId ?? hallTextStation?.id ?? (guidedIndex < 0 && !storyStationActive && tour.seconds < 5 ? 'arrival' : currentChapter),
    onLocate: guideToHallText,
    onStory: (id) => yellowHouse.open(id),
    onAfterlife: () => afterlife.open('overview'),
    onContinueAfterlife: () => guideToAfterlife(),
    onArtwork: (id, returnToStory) => showCollectionWork(id, true, { returnToStory }),
    onOpen() {
      visitGuide.recordAction('introduction');
      afterlife?.close();
      yellowHouse?.close();
      filmVideo.pause();
      openingFilm.close();
      story.close();
      closeImmersive();
      if (catalogue.classList.contains('open')) setCatalogueOpen(false);
      pauseTour();
      cancelGuideTransition();
      stopDolly();
      hideCard();
      keys.clear();
      focusMotion = null;
      for (const pointerId of activePointers.keys()) {
        if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
      }
      activePointers.clear();
      pinchDistance = null;
      gestureMoved = false;
      gestureHadPinch = false;
      pointerDownSlot = null;
    },
  });
  afterlife = await createAfterlifeExhibit({
    data: afterlifeData, collection, scene, renderer, pickMeshes,
    onLocate: guideToAfterlife,
    onExit: () => guideToHallText(hallTexts.entry('departure')),
    onAlmond: (id) => showCollectionWork(id, true),
    onArtwork: (id) => showCollectionWork(id, true),
    onLondon() { guideToStory({ immediate: true }); story.open('london'); },
    onOpen() {
      visitGuide.recordAction('afterlife');
      hallTexts.close();
      yellowHouse?.close();
      openingFilm.close();
      filmVideo.pause();
      story.close();
      closeImmersive();
      if (catalogue.classList.contains('open')) setCatalogueOpen(false);
      pauseTour();
      cancelGuideTransition();
      stopDolly();
      hideCard();
      keys.clear();
      focusMotion = null;
      for (const pointerId of activePointers.keys()) {
        if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
      }
      activePointers.clear();
      pinchDistance = null;
      gestureMoved = false;
      gestureHadPinch = false;
      pointerDownSlot = null;
      afterlifeInvitation.hidden = true;
    },
  });
  yellowHouse = createYellowHouseStory({
    data: yellowHouseData, collection, hallData: hallTextData, scene, renderer, pickMeshes,
    onArtwork: (id) => showCollectionWork(id, true),
    onContinue: (id) => guideToHallText(hallTexts.entry(id)),
    onOpen() {
      visitGuide.recordAction('yellow-house');
      leaveAfterlife();
      hallTexts.close();
      openingFilm.close();
      filmVideo.pause();
      story.close();
      closeImmersive();
      if (catalogue.classList.contains('open')) setCatalogueOpen(false);
      pauseTour();
      cancelGuideTransition();
      stopDolly();
      hideCard();
      keys.clear();
      focusMotion = null;
      for (const pointerId of activePointers.keys()) {
        if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
      }
      activePointers.clear();
      pinchDistance = null;
      gestureMoved = false;
      gestureHadPinch = false;
      pointerDownSlot = null;
      afterlifeInvitation.hidden = true;
    },
  });
  scene.updateMatrixWorld(true);
  updateText(loadProgress, 'Preparing display…');
  await prepareGalleryRendering(renderer, scene, camera);
  const itemCount = chapters.reduce((total, chapter) => total + chapter.groups.reduce((count, group) => count + group.items.length, 0), 0);
  document.querySelector('#exhibit-status').textContent = `${workOrder.length} verified works · ${curatedSlots.size} highlight positions · Switchable wall sets`;
  document.querySelector('#catalog-count').textContent = `Eight halls · ${workOrder.length} installed works · ${itemCount - workOrder.length} research leads`;
  renderCatalogue();
  loading.hidden = true;
  galleryReady = true;
  entry.setReady();
  tourButton.disabled = false;
  nextArtwork.disabled = false;
  resetView.disabled = false;
  storyButton.disabled = false;
  auversButton.disabled = false;
  afterlifeButton.disabled = false;
  document.querySelector('#yellow-house-go').disabled = false;
  positionOnRoute();
  updateTimeline();
  measureCardLimits();
}

measureCardLimits();
updateTimeline();
render();
loadGallery().catch((cause) => {
  entry.fail();
  loading.hidden = true;
  error.textContent = `Gallery could not load: ${cause.message}. Start with npm start rather than opening this HTML file directly.`;
  error.hidden = false;
  console.error(cause);
});
