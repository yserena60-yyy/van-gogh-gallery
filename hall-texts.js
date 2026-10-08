import * as THREE from 'three';
import { onLanguageChange, translate, wrapText } from './i18n.js';
import { createAuversReader } from './auvers.js?v=2026-10-06-auvers-final-days';

export function validateHallTexts(data) {
  if (data?.language !== 'en' || data.halls?.length !== 8) throw new Error('Eight English hall introductions are required');
  const entries = [data.arrival, ...data.halls, data.departure];
  const identifiers = new Set();
  for (const [index, entry] of entries.entries()) {
    if (!entry || identifiers.has(entry.id) || !entry.paragraphs?.length
        || entry.paragraphs.some((paragraph) => typeof paragraph !== 'string' || !paragraph.trim() || /[\u3400-\u9fff]/u.test(paragraph))) {
      throw new Error('Wall-text identifiers and English paragraphs must be complete');
    }
    identifiers.add(entry.id);
    if (index > 0 && index <= data.halls.length && (entry.id !== String(index).padStart(2, '0') || !entry.title || !entry.years || !entry.sources?.length)) {
      throw new Error(`Hall ${index} needs a title, dates and sources`);
    }
    const wall = entry.wall;
    if (wall?.exhibit && (wall.exhibit !== 'afterlife' || entry.id !== '08')) throw new Error('Only Hall 08 can share the Afterlife exhibit introduction');
    if (![wall?.width, wall?.height, wall?.centerHeight, wall?.viewDistance].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`Invalid wall dimensions for ${entry.id}`);
    }
    if (wall.path) {
      if (wall.path.points?.length !== 4 || !wall.path.points.every((point) => point.length === 2 && point.every(Number.isFinite))
          || ![wall.path.at, wall.path.inset, wall.path.side].every(Number.isFinite)
          || wall.path.at < 0 || wall.path.at > 1 || ![-1, 1].includes(wall.path.side)) throw new Error(`Invalid wall path for ${entry.id}`);
    } else if (wall.curve) {
      if (![...wall.curve.center, ...wall.curve.radii, wall.curve.angle, wall.curve.inset].every(Number.isFinite)
          || wall.curve.radii.some((radius) => radius <= 0)) throw new Error(`Invalid curved wall for ${entry.id}`);
    } else if (!wall.position?.every(Number.isFinite) || wall.position.length !== 3
        || !wall.normal?.every(Number.isFinite) || wall.normal.length !== 3 || Math.abs(Math.hypot(...wall.normal) - 1) > 0.001) {
      throw new Error(`Invalid wall position for ${entry.id}`);
    }
    for (const source of entry.sources ?? []) {
      if (!source.title || !source.note || new URL(source.url).protocol !== 'https:') throw new Error(`Invalid introduction source for ${entry.id}`);
    }
    if (entry.tourLead && (typeof entry.tourLead !== 'string' || /[\u3400-\u9fff]/u.test(entry.tourLead))) throw new Error(`Invalid tour introduction for ${entry.id}`);
  }
  if (data.arrival.paragraphs.join('\n') !== 'We know who he would become.\nAs you enter, set that knowledge aside.'
      || data.departure.paragraphs.join('\n') !== 'We know who he became.\nAs you leave, what stays with you\nfrom Vincent’s life?') {
    throw new Error('The paired entrance and exit statements must retain the approved wording');
  }
  return entries.length;
}

function pathPose(wall, horizontal = 0) {
  const { points, at, inset, side } = wall.path;
  const samples = [];
  let length = 0;
  for (let index = 0; index <= 200; index += 1) {
    const fraction = index / 200;
    const inverse = 1 - fraction;
    const weights = [inverse ** 3, 3 * inverse ** 2 * fraction, 3 * inverse * fraction ** 2, fraction ** 3];
    const point = new THREE.Vector3(points.reduce((sum, value, axis) => sum + value[0] * weights[axis], 0), wall.centerHeight,
      points.reduce((sum, value, axis) => sum + value[1] * weights[axis], 0));
    if (index) length += point.distanceTo(samples[index - 1].point);
    samples.push({ point, distance: length });
  }
  const distance = THREE.MathUtils.clamp(at * length + horizontal * side, 0, length);
  const index = Math.max(1, samples.findIndex((sample) => sample.distance >= distance));
  const previous = samples[index - 1];
  const next = samples[index];
  const tangent = next.point.clone().sub(previous.point).normalize();
  const normal = new THREE.Vector3(-tangent.z * side, 0, tangent.x * side);
  const position = previous.point.clone().lerp(next.point, (distance - previous.distance) / (next.distance - previous.distance)).addScaledVector(normal, inset);
  return { position, normal };
}

export function wallTextPose(entry) {
  const wall = entry.wall;
  let position;
  let normal;
  if (wall.path) {
    ({ position, normal } = pathPose(wall));
  } else if (wall.curve) {
    const { center, radii, angle, inset } = wall.curve;
    const radians = THREE.MathUtils.degToRad(angle);
    normal = new THREE.Vector3(-Math.cos(radians) / radii[0], 0, -Math.sin(radians) / radii[1]).normalize();
    position = new THREE.Vector3(center[0] + radii[0] * Math.cos(radians), wall.centerHeight, center[1] + radii[1] * Math.sin(radians));
    position.addScaledVector(normal, inset);
  } else {
    position = new THREE.Vector3(...wall.position);
    normal = new THREE.Vector3(...wall.normal).normalize();
  }
  return { position, normal, location: position.clone().addScaledVector(normal, wall.viewDistance) };
}

function linesFor(context, text, width) {
  return wrapText(context, text, width);
}

function wallTexture(entry, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round(canvas.width * entry.wall.height / entry.wall.width);
  const context = canvas.getContext('2d');
  const padding = 120;
  const available = canvas.width - padding * 2;
  const dark = entry.wall.theme === 'dark';
  const ink = dark ? '#f1ece2' : '#353a35';
  const secondary = dark ? '#c8ba9e' : '#786e5a';
  context.textBaseline = 'top';
  const line = (height) => {
    context.fillStyle = secondary;
    context.fillRect(padding, height, 190, 3);
  };
  let cursor;
  if (entry.kind === 'statement') {
    const blocks = entry.paragraphs.map((paragraph, index) => {
      const size = Math.round((index === 0 ? 0.32 : 0.28) * canvas.width / entry.wall.width);
      context.font = `${size}px Georgia, serif`;
      return { size, lines: linesFor(context, paragraph, available), lineHeight: size * 1.4 };
    });
    const gap = canvas.height * 0.09;
    const totalHeight = blocks.reduce((height, block) => height + block.lines.length * block.lineHeight, 0) + gap;
    cursor = Math.max(30, (canvas.height - totalHeight) / 2);
    context.textAlign = entry.wall.align === 'center' ? 'center' : 'left';
    for (const [index, block] of blocks.entries()) {
      context.font = `${block.size}px Georgia, serif`;
      context.fillStyle = ink;
      for (const text of block.lines) {
        context.fillText(text, entry.wall.align === 'center' ? canvas.width / 2 : padding, cursor);
        cursor += block.lineHeight;
      }
      if (index === 0) cursor += gap;
    }
  } else {
    context.font = '128px Georgia, serif';
    const title = linesFor(context, entry.title, available);
    let size = 82;
    let body;
    let totalHeight;
    do {
      context.font = `${size}px Georgia, serif`;
      body = linesFor(context, entry.tourLead ?? entry.paragraphs[0], available);
      totalHeight = 110 + title.length * 153 + 171 + body.length * size * 1.45 + 200;
      if (totalHeight <= canvas.height - 130) break;
      size -= 2;
    } while (size >= 60);
    if (totalHeight > canvas.height - 100) throw new Error(`Wall text would overflow in Hall ${entry.id}`);
    cursor = (canvas.height - totalHeight) / 2;
    context.font = '500 46px "Segoe UI", sans-serif';
    context.fillStyle = secondary;
    context.fillText(translate(entry.eyebrow ?? `CHAPTER ${entry.id}  /  INTRODUCTION`), padding, cursor);
    cursor += 110;
    context.font = '128px Georgia, serif';
    context.fillStyle = ink;
    for (const text of title) {
      context.fillText(text, padding, cursor);
      cursor += 153;
    }
    context.font = '54px "Segoe UI", sans-serif';
    context.fillStyle = secondary;
    context.fillText(translate(entry.years), padding, cursor + 13);
    line(cursor + 110);
    cursor += 171;
    context.font = `${size}px Georgia, serif`;
    context.fillStyle = ink;
    for (const text of body) {
      context.fillText(text, padding, cursor);
      cursor += size * 1.45;
    }
    context.font = '500 64px "Segoe UI", sans-serif';
    const invitation = entry.invitation ?? 'Read the introduction + sources  →';
    context.fillStyle = ink;
    context.fillText(translate(invitation), padding, cursor + 115);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

export function wallGeometry(entry) {
  const wall = entry.wall;
  const pose = wallTextPose(entry);
  const tangent = new THREE.Vector3(pose.normal.z, 0, -pose.normal.x);
  const positions = [];
  const coordinates = [];
  const indices = [];
  const segments = wall.curve || wall.path ? 64 : 1;
  for (let index = 0; index <= segments; index += 1) {
    const fraction = index / segments;
    const horizontal = (fraction - 0.5) * wall.width;
    let point = pose.position.clone().addScaledVector(tangent, horizontal);
    if (wall.path) {
      point = pathPose(wall, horizontal).position;
    } else if (wall.curve) {
      const { center, radii, angle, inset } = wall.curve;
      const middle = THREE.MathUtils.degToRad(angle);
      const speed = Math.hypot(radii[0] * Math.sin(middle), radii[1] * Math.cos(middle));
      const radians = middle + horizontal / speed;
      const normal = new THREE.Vector3(-Math.cos(radians) / radii[0], 0, -Math.sin(radians) / radii[1]).normalize();
      point = new THREE.Vector3(center[0] + radii[0] * Math.cos(radians), wall.centerHeight, center[1] + radii[1] * Math.sin(radians)).addScaledVector(normal, inset);
    }
    positions.push(point.x, point.y - wall.height / 2, point.z, point.x, point.y + wall.height / 2, point.z);
    coordinates.push(fraction, 0, fraction, 1);
    if (index < segments) {
      const corner = index * 2;
      indices.push(corner, corner + 2, corner + 3, corner, corner + 3, corner + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createHallTexts({ data, auversData, collection, scene, renderer, pickMeshes, onOpen, onLocate, currentChapter, onStory = () => {}, onAfterlife = () => {}, onContinueAfterlife = onAfterlife, onArtwork = () => {}, onReturn = () => {} }) {
  validateHallTexts(data);
  const entries = [...data.halls, data.departure];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const finalEntry = {
    id: '07', kind: 'hall', chapter: '07', readerId: 'auvers:final-days',
    title: 'The Final Days', years: '27–30 July 1890', eyebrow: 'HALL 07  /  THE FINAL DAYS',
    tourLead: auversData.wall.text, paragraphs: [auversData.wall.text],
    invitation: auversData.wall.invitation, wall: auversData.wall,
  };
  byId.set(finalEntry.readerId, finalEntry);
  const dialog = document.querySelector('#hall-reader');
  const select = document.querySelector('#hall-reader-select');
  const title = document.querySelector('#hall-reader-title');
  const years = document.querySelector('#hall-reader-years');
  const body = document.querySelector('#hall-reader-copy');
  const sources = document.querySelector('#hall-reader-sources');
  const sourceList = document.querySelector('#hall-reader-source-list');
  const research = document.querySelector('#hall-reader-research');
  const toggle = document.querySelector('#hall-intro-toggle');
  let selected = null;
  let focusBefore = null;
  const textMaterials = [];
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.kind === 'hall' ? `${entry.id} · ${entry.title}` : entry.label;
    select.append(option);
  }
  for (const entry of [...entries, finalEntry]) {
    if (entry.wall.exhibit === 'afterlife') continue;
    if (entry.wall.wing) {
      const wing = entry.wall.wing;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wing.width, wing.height, wing.depth), new THREE.MeshStandardMaterial({ color: '#f1eee6', roughness: 0.92 }));
      mesh.name = `Hall ${entry.id} introduction entry wing`;
      mesh.position.set(...wing.position);
      scene.add(mesh);
      pickMeshes.push(mesh);
    }
    const material = new THREE.MeshBasicMaterial({
      map: wallTexture(entry, renderer), transparent: true, alphaTest: 0.015,
      depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(wallGeometry(entry), material);
    textMaterials.push({ entry, material });
    mesh.name = entry.readerId ? 'Hall 07 final-days reading plaque' : `Wall introduction ${entry.id}`;
    mesh.userData.hall_text = entry.readerId ?? entry.id;
    mesh.renderOrder = 1;
    scene.add(mesh);
    pickMeshes.push(mesh);
  }
  const scroll = document.querySelector('.hall-reader-scroll');
  const introduction = document.querySelector('#hall-reader-introduction');
  const auversActions = document.querySelector('#hall-reader-auvers-actions');
  const exploreAuvers = document.querySelector('#hall-reader-explore-auvers');
  const finalDays = document.querySelector('#hall-reader-final-days');
  const auversControls = ['previous', 'position', 'next'].map((id) => document.getElementById('auvers-' + id));
  const auvers = createAuversReader({
    data: auversData, collection, scroll,
    onChapter: (id) => {
      selected = id === 'final-days' ? finalEntry : byId.get('07');
      document.querySelector('#hall-reader-locate').textContent = id === 'final-days' ? 'View the Final Days wall →' : 'View this wall →';
    },
    onIntroduction: () => show(byId.get('07')),
    onArtwork: openAuversArtwork,
    onAfterlife: () => { close(); onContinueAfterlife(); },
  });
  function openAuversArtwork(id) {
    const returnScroll = scroll.scrollTop;
    const returnFocus = document.activeElement;
    const galleryFocus = focusBefore;
    close();
    onArtwork(id, () => {
      onOpen();
      focusBefore = galleryFocus;
      if (!dialog.open) dialog.showModal();
      scroll.scrollTop = returnScroll;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      else document.querySelector('#auvers-content').focus({ preventScroll: true });
    });
  }
  function show(entry) {
    auvers.hide();
    document.querySelector('#hall-reader-locate').textContent = 'View this wall →';
    dialog.classList.remove('hall-reader--auvers');
    document.querySelector('#hall-reader-close').setAttribute('aria-label', 'Close introduction and return to the gallery');
    introduction.hidden = false;
    auversActions.hidden = true;
    auversControls.forEach((element) => { element.hidden = true; });
    exploreAuvers.hidden = entry.id !== '07';
    finalDays.hidden = entry.id !== '07';
    selected = entry;
    document.querySelector('#hall-reader-return').hidden = entry.id !== 'departure';
    select.value = entry.id;
    const storyButton = document.querySelector('#hall-reader-story');
    storyButton.hidden = !['04', '05'].includes(entry.id);
    storyButton.textContent = entry.id === '04' ? 'A Room for Gauguin →' : 'The Yellow House · Follow the Story →';
    const afterlifeButton = document.querySelector('#hall-reader-afterlife');
    afterlifeButton.hidden = entry.id !== '08';
    afterlifeButton.textContent = 'Explore the Four Sections →';
    title.textContent = entry.kind === 'hall' ? entry.title : entry.label;
    years.textContent = entry.years ?? 'A Life Behind the Name';
    const subtitle = document.querySelector('#hall-reader-subtitle');
    subtitle.textContent = entry.subtitle ?? '';
    subtitle.hidden = !entry.subtitle;
    document.querySelector('#hall-reader-eyebrow').textContent = entry.kind === 'hall' ? `HALL ${entry.id} · INTRODUCTION` : 'VINCENT VAN GOGH · A LIFE BEHIND THE NAME';
    body.classList.toggle('hall-reader-statement', entry.kind === 'statement');
    body.replaceChildren(...entry.paragraphs.map((paragraph) => {
      const element = document.createElement('p');
      element.textContent = paragraph;
      return element;
    }));
    sources.hidden = !entry.sources?.length;
    sources.open = false;
    sourceList.replaceChildren(...(entry.sources ?? []).map((source) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.textContent = `${source.title} ↗`;
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const note = document.createElement('p');
      note.textContent = source.note;
      item.append(link, note);
      return item;
    }));
    research.hidden = !entry.researchNote;
    research.textContent = entry.researchNote ?? '';
    scroll.scrollTop = 0;
  }
  function openAuvers(id = 'arrival') {
    if (!auversData.chapters.some((chapter) => chapter.id === id)) return;
    if (!dialog.open) {
      focusBefore = document.activeElement;
      onOpen();
    }
    const entry = byId.get('07');
    select.value = entry.id;
    title.textContent = entry.title;
    years.textContent = entry.years;
    document.querySelector('#hall-reader-eyebrow').textContent = auversData.eyebrow;
    document.querySelector('#hall-reader-close').setAttribute('aria-label', 'Close Auvers story and return to the gallery');
    document.querySelector('#hall-reader-subtitle').hidden = true;
    introduction.hidden = true;
    dialog.classList.add('hall-reader--auvers');
    auversActions.hidden = false;
    exploreAuvers.hidden = true;
    finalDays.hidden = true;
    document.querySelector('#hall-reader-story').hidden = true;
    document.querySelector('#hall-reader-afterlife').hidden = true;
    document.querySelector('#hall-reader-return').hidden = true;
    auversControls.forEach((element) => { element.hidden = false; });
    auvers.show(id);
    if (!dialog.open) dialog.showModal();
    document.querySelector('#auvers-content').focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open) return;
    auvers.remember();
    dialog.close();
    if (focusBefore?.isConnected && !focusBefore.closest('[inert]')) focusBefore.focus({ preventScroll: true });
    else renderer.domElement.focus({ preventScroll: true });
  }
  function open(id = currentChapter()) {
    if (id === finalEntry.readerId) { openAuvers('final-days'); return; }
    const entry = byId.get(id === 'arrival' ? '01' : id);
    if (!entry) return;
    if (!dialog.open) {
      focusBefore = document.activeElement;
      onOpen();
      show(entry);
      dialog.showModal();
      document.querySelector('#hall-reader-close').focus();
    } else show(entry);
  }
  toggle.addEventListener('click', () => open());
  select.addEventListener('change', () => open(select.value));
  exploreAuvers.addEventListener('click', () => openAuvers());
  finalDays.addEventListener('click', () => openAuvers('final-days'));
  document.querySelector('#hall-reader-close').addEventListener('click', close);
  document.querySelector('#hall-reader-back').addEventListener('click', close);
  document.querySelector('#hall-reader-story').addEventListener('click', () => { const id = selected.id; close(); onStory(id === '04' ? 'overview' : 'staying-or-leaving'); });
  document.querySelector('#hall-reader-afterlife').addEventListener('click', () => { close(); onAfterlife(); });
  document.querySelector('#hall-reader-return').addEventListener('click', () => { close(); onReturn(); });
  document.querySelector('#hall-reader-locate').addEventListener('click', () => { const entry = selected; close(); onLocate(entry); });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); event.stopPropagation(); close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  toggle.disabled = false;
  onLanguageChange(() => {
    for (const { entry, material } of textMaterials) {
      const previous = material.map;
      material.map = wallTexture(entry, renderer);
      previous.dispose();
    }
  });
  return { open, openAuvers, close, isOpen: () => dialog.open, entry: (id) => byId.get(id) };
}
