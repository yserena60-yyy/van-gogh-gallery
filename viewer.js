import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const viewer = document.querySelector('#viewer');
const loading = document.querySelector('#loading');
const loadProgress = document.querySelector('#load-progress');
const error = document.querySelector('#error');
const card = document.querySelector('#art-card');
const immersive = document.querySelector('#art-immersive');
const immersiveClose = document.querySelector('#immersive-close');
const tourButton = document.querySelector('#tour-toggle');
const tourProgress = document.querySelector('#tour-progress');
const tourTime = document.querySelector('#tour-time');
const previousArtwork = document.querySelector('#previous-artwork');
const nextArtwork = document.querySelector('#next-artwork');
const guidePosition = document.querySelector('#guide-position');
const masthead = document.querySelector('.masthead');
const toolbar = document.querySelector('.toolbar');
const catalogue = document.querySelector('#catalogue');
const catalogToggle = document.querySelector('#catalog-toggle');
const catalogSearch = document.querySelector('#catalog-search');
const chapterNav = document.querySelector('#chapter-nav');
const catalogContent = document.querySelector('#catalog-content');
const filmInput = document.querySelector('#film-input');
const filmToggle = document.querySelector('#film-toggle');
const filmStatus = document.querySelector('#film-status');
const filmControls = document.querySelector('.film-controls');

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
const totalSeconds = 90;
const layoutRevision = '2026-09-30-cinema-paris';
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
let dragging = false;
let previousPointer = null;
let hideCardTimer = null;
let cardLayoutKey = '';
let cardLimits = {};
let filmScreen = null;
let filmPlaceholder = null;
let filmVideo = null;
let filmUrl = null;
let focusBeforeImmersive = null;
let guideTransitionTimer = null;
const projectedCorner = new THREE.Vector3();

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
  tourProgress.value = String(tour.seconds);
  tourTime.textContent = `${timeLabel(tour.seconds)} / 01:30`;
  tourButton.textContent = tour.playing ? 'Pause tour' : 'Play 90-second tour';
}

function resetGuidedSelection() {
  guidedIndex = -1;
  guidePosition.textContent = 'Gallery-view route · Follow the left wall';
  previousArtwork.disabled = true;
  nextArtwork.disabled = false;
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
  if (closestIndex < 0 || closestIndex === guidedIndex) return;
  guidedIndex = closestIndex;
  const artwork = orderedRoute.artworks[guidedIndex];
  guidePosition.textContent = `Hall ${artwork.chapter} · ${String(guidedIndex + 1).padStart(2, '0')}/${orderedRoute.artworks.length} · ${artwork.title}`;
  previousArtwork.disabled = guidedIndex === 0;
  nextArtwork.disabled = guidedIndex === orderedRoute.artworks.length - 1;
}

function pauseTour() {
  tour.playing = false;
  updateTimeline();
}

function cancelGuideTransition() {
  if (guideTransitionTimer !== null) window.clearTimeout(guideTransitionTimer);
  guideTransitionTimer = null;
  focusMotion = null;
  renderer.domElement.classList.remove('repositioning');
}

function positionOnRoute() {
  if (!orderedRoute) return;
  const waypoints = orderedRoute.camera.waypoints;
  const index = Math.max(0, waypoints.findIndex((point) => point.time >= tour.seconds));
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
  const chapter = previous.chapter === '00' ? (tour.seconds > totalSeconds / 2 ? '07' : '01') : previous.chapter;
  if (chapter !== currentChapter) {
    currentChapter = chapter;
    renderCatalogue();
  }
  synchronizeRouteSelection(previous.chapter);
}

function updateFilmControls() {
  if (!orderedRoute) return;
  const show = orderedRoute.walkableRegions.some((region) =>
    (region.chapter === '00' || region.chapter === '01') && polygonContains(camera.position.x, camera.position.z, region.polygon));
  if (filmControls.hidden === !show) return;
  filmControls.hidden = !show;
  if (!show && filmVideo && !filmVideo.paused) {
    filmVideo.pause();
    filmToggle.textContent = 'Play film';
  }
}

function hideCard() {
  cancelCardHide();
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
  document.querySelector('#card-date').textContent = entry.date ?? 'Date and medium pending';
  document.querySelector('#card-body').textContent = entry.body ?? 'Further interpretation will be added here.';
  document.querySelector('#card-credit').textContent = entry.credit ?? 'Image credit pending';
  const sourceLink = document.querySelector('#card-source');
  sourceLink.hidden = !entry.source;
  if (entry.source) sourceLink.href = entry.source;
  card.querySelector('.card-content').scrollTop = 0;
  cardLayoutKey = '';
  positionCard();
  if (!activeSlot) return;
  card.classList.add('visible');
  card.setAttribute('aria-hidden', 'false');
  card.inert = false;
}

function openImmersive(slot) {
  const entry = metadata[slot];
  if (!entry?.image) return;
  pauseTour();
  hideCard();
  keys.clear();
  focusMotion = null;
  cancelGuideTransition();
  focusBeforeImmersive = document.activeElement;
  const artwork = orderedRoute.artworks.find((item) => item.slot === slot);
  const chapter = chapters.find((item) => item.id === artwork?.chapter);
  const image = document.querySelector('#immersive-image');
  image.src = entry.image;
  image.alt = entry.title;
  document.querySelector('#immersive-caption').textContent = entry.title;
  document.querySelector('#immersive-chapter').textContent = `HALL ${chapter?.id ?? ''} · ${chapter?.title ?? 'Works'}`;
  document.querySelector('#immersive-title').textContent = entry.title;
  document.querySelector('#immersive-date').textContent = entry.date;
  document.querySelector('#immersive-body').textContent = entry.body;
  document.querySelector('#immersive-credit').textContent = entry.credit;
  const link = document.querySelector('#immersive-source');
  link.hidden = !entry.source;
  if (entry.source) link.href = entry.source;
  immersive.hidden = false;
  immersive.inert = false;
  immersive.setAttribute('aria-hidden', 'false');
  immersive.querySelector('.immersive-content').scrollTop = 0;
  immersiveClose.focus();
}

function closeImmersive() {
  if (immersive.hidden) return;
  immersive.hidden = true;
  immersive.inert = true;
  immersive.setAttribute('aria-hidden', 'true');
  document.querySelector('#immersive-image').removeAttribute('src');
  if (focusBeforeImmersive?.isConnected) focusBeforeImmersive.focus();
  focusBeforeImmersive = null;
}

function setCatalogueOpen(open) {
  if (open && !chapters.length) return;
  if (open) {
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
  setCatalogueOpen(false);
  const index = orderedRoute.artworks.findIndex((item) => item.chapter === chapter.id);
  if (index !== -1) guideTo(index, false);
}

function jumpToArtwork(chapter, slot) {
  setCatalogueOpen(false);
  const index = orderedRoute.artworks.findIndex((item) => item.slot === slot);
  if (index !== -1) guideTo(index, true);
}

function guideTo(index, openCard = false) {
  if (!orderedRoute || index < 0 || index >= orderedRoute.artworks.length) return;
  closeImmersive();
  pauseTour();
  hideCard();
  cancelGuideTransition();
  const showOnArrival = openCard;
  const artwork = orderedRoute.artworks[index];
  guidedIndex = index;
  currentChapter = artwork.chapter;
  guidePosition.textContent = `Hall ${artwork.chapter} · ${String(index + 1).padStart(2, '0')}/${orderedRoute.artworks.length} · ${artwork.title}`;
  previousArtwork.disabled = index === 0;
  nextArtwork.disabled = index === orderedRoute.artworks.length - 1;
  let distance = artwork.viewDistance ?? 8.4;
  const lookAtHeight = orderedRoute.eyeHeight;
  if (viewer.clientWidth <= 600) {
    const viewerTop = viewer.getBoundingClientRect().top;
    const safeTop = masthead.getBoundingClientRect().bottom - viewerTop + 16;
    const safeBottom = toolbar.getBoundingClientRect().top - viewerTop - 16;
    const safeHeight = Math.max(120, safeBottom - safeTop);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distance = Math.max(
      distance,
      (artwork.height + 0.3) * viewer.clientHeight / (2 * tangent * safeHeight * 0.82),
      (artwork.width + 0.3) / (2 * tangent * camera.aspect * 0.84),
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const travelDistance = camera.position.distanceTo(new THREE.Vector3(...location));
  const canGlide = travelDistance <= 9 && clearWalkingSegment(camera.position.toArray(), location);
  focusMotion = reducedMotion || !canGlide ? null : {
    elapsed: 0, duration: 1.1, from: camera.position.clone(), to: new THREE.Vector3(...location),
    yawFrom: yaw, yawTo: yaw + yawDifference, pitchFrom: pitch, pitchTo: targetPitch,
    openSlot: showOnArrival ? artwork.slot : null,
  };
  if (!focusMotion) {
    const arrive = () => {
      guideTransitionTimer = null;
      viewFrom(location, target);
      renderer.domElement.classList.remove('repositioning');
      if (showOnArrival) openImmersive(artwork.slot);
    };
    if (reducedMotion || showOnArrival) arrive();
    else {
      renderer.domElement.classList.add('repositioning');
      guideTransitionTimer = window.setTimeout(arrive, 150);
    }
  }
  tour.seconds = artwork.routeTime;
  updateTimeline();
  renderCatalogue();
}

function renderCatalogue() {
  const search = catalogSearch.value.trim().toLocaleLowerCase();
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
  const visibleChapters = search ? chapters : chapters.filter((chapter) => chapter.id === currentChapter);
  for (const chapter of visibleChapters) {
    const chapterMatch = search && (chapter.title + ' ' + chapter.years + ' ' + chapter.intro).toLocaleLowerCase().includes(search);
    const groups = chapter.groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !search || chapterMatch || group.title.toLocaleLowerCase().includes(search)
        || (typeof item === 'string' ? item : item.title).toLocaleLowerCase().includes(search)),
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
    section.append(heading, years, intro, jump);
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
        const mounted = typeof item !== 'string' && item.slot && metadata[item.slot]?.image;
        if (mounted) {
          const link = document.createElement('button');
          link.type = 'button';
          link.textContent = name;
          link.addEventListener('click', () => jumpToArtwork(chapter, item.slot));
          row.append(link);
        } else {
          row.append(document.createTextNode(name));
        }
        const badge = document.createElement('span');
        badge.className = 'catalog-badge';
        badge.textContent = mounted ? 'On view ↗' : 'Archive / image to be added';
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
}

catalogToggle.addEventListener('click', () => setCatalogueOpen(!catalogue.classList.contains('open')));
document.querySelector('#catalog-close').addEventListener('click', () => setCatalogueOpen(false));
catalogSearch.addEventListener('input', renderCatalogue);

filmInput.addEventListener('change', () => {
  const file = filmInput.files?.[0];
  if (!file || !filmScreen) return;
  if (filmVideo) {
    filmVideo.pause();
    filmVideo.removeAttribute('src');
    filmVideo.load();
  }
  if (filmUrl) URL.revokeObjectURL(filmUrl);
  filmUrl = URL.createObjectURL(file);
  filmVideo = document.createElement('video');
  filmVideo.src = filmUrl;
  filmVideo.preload = 'metadata';
  filmVideo.playsInline = true;
  filmVideo.addEventListener('ended', () => { filmToggle.textContent = 'Play film'; });
  const texture = new THREE.VideoTexture(filmVideo);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  if (filmScreen.material.map) filmScreen.material.map.dispose();
  filmScreen.material.dispose();
  filmScreen.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  if (filmPlaceholder) filmPlaceholder.visible = false;
  filmStatus.textContent = 'Film ready';
  filmToggle.textContent = 'Play film';
  filmToggle.hidden = false;
});

filmToggle.addEventListener('click', async () => {
  if (!filmVideo) return;
  if (!filmVideo.paused) {
    filmVideo.pause();
    filmToggle.textContent = 'Play film';
    return;
  }
  try {
    await filmVideo.play();
    filmToggle.textContent = 'Pause film';
  } catch (cause) {
    filmStatus.textContent = 'Film could not play. Try MP4 or WebM.';
    console.error(cause);
  }
});

window.addEventListener('beforeunload', () => {
  if (filmUrl) URL.revokeObjectURL(filmUrl);
});

function pickArtwork(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const first = raycaster.intersectObjects(pickMeshes, false)[0];
  return first?.object.userData.artwork_slot ?? null;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  if (catalogue.classList.contains('open')) return;
  if (dragging && previousPointer) {
    const dx = event.clientX - previousPointer.x;
    const dy = event.clientY - previousPointer.y;
    yaw += dx * 0.0035;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0035, -0.85, 0.85);
    updateView();
    previousPointer = { x: event.clientX, y: event.clientY };
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
    showCard(slot);
  } else {
    scheduleCardHide();
  }
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  const slot = pickArtwork(event);
  if (slot) {
    pauseTour();
    openImmersive(slot);
    return;
  }
  hideCard();
  pauseTour();
  cancelGuideTransition();
  dragging = true;
  previousPointer = { x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = 'grabbing';
});

renderer.domElement.addEventListener('pointerup', (event) => {
  dragging = false;
  previousPointer = null;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  renderer.domElement.style.cursor = 'grab';
});

renderer.domElement.addEventListener('pointerleave', () => {
  scheduleCardHide();
});

card.addEventListener('pointerenter', cancelCardHide);
card.addEventListener('pointerleave', scheduleCardHide);
card.addEventListener('focusin', cancelCardHide);
card.addEventListener('focusout', scheduleCardHide);
document.querySelector('#card-close').addEventListener('click', hideCard);
immersiveClose.addEventListener('click', closeImmersive);
immersive.addEventListener('click', (event) => {
  if (event.target === immersive) closeImmersive();
});
tourButton.addEventListener('click', () => {
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
});

tourProgress.addEventListener('input', () => {
  cancelGuideTransition();
  const seconds = Number(tourProgress.value);
  pauseTour();
  hideCard();
  focusMotion = null;
  tour.seconds = seconds;
  resetGuidedSelection();
  positionOnRoute();
  updateTimeline();
});

previousArtwork.addEventListener('click', () => guideTo(Math.max(0, guidedIndex - 1)));
nextArtwork.addEventListener('click', () => guideTo(guidedIndex < 0 ? 0 : guidedIndex + 1));

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeImmersive();
    hideCard();
    if (catalogue.classList.contains('open')) setCatalogueOpen(false);
  }
  if (event.target.matches('input, textarea')) return;
  if (event.code === 'Space' && event.target === document.body) {
    event.preventDefault();
    tourButton.click();
  }
  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
    event.preventDefault();
    if (event.code === 'ArrowRight') nextArtwork.click();
    else if (guidedIndex < 0) guideTo(0);
    else previousArtwork.click();
  }
  if (/^Key[WASD]$/.test(event.code)) keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

function moveFreely(delta) {
  if (!keys.size || !orderedRoute || !immersive.hidden) return;
  const forward = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const right = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const direction = new THREE.Vector3();
  if (keys.has('KeyW')) direction.add(forward);
  if (keys.has('KeyS')) direction.sub(forward);
  if (keys.has('KeyD')) direction.add(right);
  if (keys.has('KeyA')) direction.sub(right);
  if (direction.lengthSq() === 0) return;
  if (tour.playing) pauseTour();
  focusMotion = null;
  cancelGuideTransition();
  const step = direction.normalize().multiplyScalar(Math.min(delta, 0.05) * 4);
  const candidate = camera.position.clone().add(step);
  if (insideGallery(candidate.x, camera.position.z)) camera.position.x = candidate.x;
  if (insideGallery(camera.position.x, candidate.z)) camera.position.z = candidate.z;
  camera.position.y = orderedRoute.eyeHeight;
  const region = orderedRoute.walkableRegions.find((entry) =>
    entry.chapter !== '00' && polygonContains(camera.position.x, camera.position.z, entry.polygon));
  if (region && region.chapter !== currentChapter) {
    currentChapter = region.chapter;
    renderCatalogue();
  }
  updateView();
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
  if (tour.playing) {
    tour.seconds = Math.min(totalSeconds, tour.seconds + delta);
    positionOnRoute();
    if (tour.seconds >= totalSeconds) pauseTour();
    updateTimeline();
  }
  if (focusMotion) {
    focusMotion.elapsed = Math.min(focusMotion.duration, focusMotion.elapsed + delta);
    const progress = focusMotion.elapsed / focusMotion.duration;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.copy(focusMotion.from).lerp(focusMotion.to, eased);
    yaw = THREE.MathUtils.lerp(focusMotion.yawFrom, focusMotion.yawTo, eased);
    pitch = THREE.MathUtils.lerp(focusMotion.pitchFrom, focusMotion.pitchTo, eased);
    updateView();
    if (progress >= 1) {
      const openSlot = focusMotion.openSlot;
      focusMotion = null;
      if (openSlot) openImmersive(openSlot);
    }
  }
  moveFreely(delta);
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
  [metadata, chapters, orderedRoute] = await Promise.all([
    './data/artworks_en.json', './data/chapters_en.json', `./data/ordered_route_v16.json?v=${layoutRevision}`,
  ].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return response.json();
  }));
  updateCameraFraming();
  const gltf = await new GLTFLoader().loadAsync(`./assets/gallery_v16.glb?v=${layoutRevision}`, (event) => {
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
  });
  if (artworkMeshes.size !== orderedRoute.artworks.length || artworkMeshes.size !== curatedSlots.size) {
    throw new Error(`Loaded ${artworkMeshes.size} of ${orderedRoute.artworks.length} ordered works`);
  }
  if (orderedRoute.artworks.some((entry) => !artworkMeshes.has(entry.slot))) {
    throw new Error('The gallery route and artwork numbers do not match');
  }
  await Promise.all(Object.entries(metadata).filter(([, entry]) => entry.image).map(async ([slot, entry]) => {
    const object = artworkMeshes.get(slot);
    if (!object) throw new Error(`Could not find artwork position ${slot}`);
    const texture = await new THREE.TextureLoader().loadAsync(entry.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    texture.needsUpdate = true;
    object.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false });
  }));
  scene.add(gltf.scene);
  scene.updateMatrixWorld(true);
  const itemCount = chapters.reduce((total, chapter) => total + chapter.groups.reduce((count, group) => count + group.items.length, 0), 0);
  document.querySelector('#exhibit-status').textContent = `${curatedSlots.size} documented images on view · More series in the catalogue`;
  document.querySelector('#catalog-count').textContent = `Seven halls · ${curatedSlots.size} images on view · ${itemCount} catalogue entries`;
  renderCatalogue();
  loading.hidden = true;
  tourButton.disabled = false;
  nextArtwork.disabled = false;
  positionOnRoute();
}

measureCardLimits();
updateTimeline();
render();
loadGallery().catch((cause) => {
  loading.hidden = true;
  error.textContent = `Gallery could not load: ${cause.message}. Start with npm start rather than opening this HTML file directly.`;
  error.hidden = false;
  console.error(cause);
});
