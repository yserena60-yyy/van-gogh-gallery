import * as THREE from 'three';
import { onLanguageChange, translate, wrapText } from './i18n.js';

export function validateAfterlife(data) {
  if (data?.language !== 'en' || data.id !== 'afterlife' || data.cards?.length !== 5 || data.intro?.length !== 3
      || data.sections?.length !== 4 || data.responses?.length !== 5) {
    throw new Error('Afterlife requires five archival cards, four sections, five responses and a complete introduction');
  }
  const stories = [...data.cards, ...data.responses];
  const identifiers = new Set(stories.map((card) => card.id));
  const sectionIds = new Set(data.sections.map((section) => section.id));
  const sourceIds = new Set(data.sources?.map((source) => source.id));
  if (identifiers.size !== stories.length || sectionIds.size !== 4 || sourceIds.size !== data.sources?.length
      || [...identifiers, ...sectionIds, ...sourceIds].some((id) => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))
      || identifiers.has('overview') || sectionIds.has('overview') || [...sectionIds].some((id) => identifiers.has(id))) {
    throw new Error('Afterlife identifiers must be unique');
  }
  const https = (url) => new URL(url).protocol === 'https:';
  const english = (text) => typeof text === 'string' && text.trim() && !/[\u3400-\u9fff]/u.test(text);
  if (![data.title, data.subtitle, data.years, data.question, ...data.intro].every(english)) throw new Error('Afterlife introduction must be complete English text');
  const orderedIds = data.sections.flatMap((section) => section.cardIds ?? []);
  if (orderedIds.length !== stories.length || new Set(orderedIds).size !== stories.length
      || orderedIds.some((id) => !identifiers.has(id))
      || data.sections.some((section) => ![section.title, section.subtitle, section.summary].every(english) || !Array.isArray(section.cardIds) || !section.cardIds.length)
      || data.sections[0].cardIds.join('|') !== data.cards.map((card) => card.id).join('|')
      || stories.filter((card) => card.closingReflection).length !== 1
      || !stories.find((card) => card.id === orderedIds.at(-1))?.closingReflection) {
    throw new Error('The four Afterlife sections must cover each story once and finish with the closing question');
  }
  for (const card of stories) {
    if (![card.title, card.subtitle, card.date, card.summary, card.imageRights, ...(card.paragraphs ?? [])].every(english)
        || !card.id || !Array.isArray(card.paragraphs) || card.paragraphs.length < 3 || !Array.isArray(card.sourceIds)
        || (!card.sourceIds.length && !card.closingReflection) || !card.sourceIds.every((id) => sourceIds.has(id))
        || card.connections?.some((connection) => !identifiers.has(connection.cardId))
        || (card.document && !https(card.document.url))) throw new Error(`Incomplete Afterlife story: ${card.id}`);
    if (card.image) {
      if (!/^\.\/assets\/[a-z0-9-]+\.jpg$/.test(card.image) || !https(card.imageRecord)
          || ![card.alt, card.caption, card.credit].every(english)) throw new Error(`Incomplete Afterlife image: ${card.id}`);
    } else if (!card.graphic || !['colour', 'cinema', 'reflection'].includes(card.graphic.kind)
        || ![card.graphic.label, card.graphic.title, card.graphic.detail].every(english)) {
      throw new Error(`Afterlife story needs an image or an original navigation graphic: ${card.id}`);
    }
    if (data.cards.includes(card) && !card.image) throw new Error(`The archival card image must be retained: ${card.id}`);
    if (data.responses.includes(card) && !english(card.typeLabel)) throw new Error(`Afterlife response needs its evidence type: ${card.id}`);
  }
  for (const source of data.sources) {
    if (![source.title, source.kind, source.note].every(english) || !https(source.url)) throw new Error(`Invalid Afterlife source: ${source.id}`);
  }
  const wall = data.wall;
  if (wall.position?.length !== 3 || wall.normal?.length !== 3 || ![...wall.position, ...wall.normal].every(Number.isFinite)
      || Math.abs(Math.hypot(...wall.normal) - 1) > 0.001 || wall.normal[1] !== 0
      || !['inset', 'cardWidth', 'cardHeight', 'spacing', 'centerHeight', 'headerWidth', 'headerHeight', 'headerCenterHeight', 'overviewDistance', 'readingDistance']
        .every((key) => Number.isFinite(wall[key]) && wall[key] > 0)
      || wall.spacing <= wall.cardWidth) throw new Error('Invalid Afterlife wall layout');
  if (wall.cardPlacements?.length !== data.cards.length || wall.cardPlacements.some((placement) =>
    placement.position?.length !== 3 || placement.normal?.length !== 3
      || ![...placement.position, ...placement.normal].every(Number.isFinite)
      || Math.abs(Math.hypot(...placement.normal) - 1) > 0.001 || placement.normal[1] !== 0)) {
    throw new Error('Each Afterlife card requires its own verified wall position');
  }
  if (!data.reflection?.examples?.length || data.reflection.examples.some((example) => !https(example.url))) throw new Error('Afterlife reflection sources are incomplete');
  return data.cards.length;
}

export function afterlifeReadingOrder(data) {
  const byId = new Map([...data.cards, ...data.responses].map((card) => [card.id, card]));
  return data.sections.flatMap((section) => section.cardIds.map((id) => byId.get(id)));
}

export function afterlifePose(data, id = 'overview', eyeHeight = 1.85) {
  const index = data.cards.findIndex((card) => card.id === id);
  if (id !== 'overview' && index < 0 && !data.responses.some((card) => card.id === id) && !data.sections.some((section) => section.id === id)) {
    throw new Error(`Unknown Afterlife viewpoint: ${id}`);
  }
  const placement = index < 0 ? data.wall : data.wall.cardPlacements[index];
  const normal = new THREE.Vector3(...placement.normal);
  const target = new THREE.Vector3(...placement.position).addScaledVector(normal, data.wall.inset);
  target.y = eyeHeight;
  const location = target.clone().addScaledVector(normal, index < 0 ? data.wall.overviewDistance : data.wall.readingDistance);
  return { location, target, index };
}

function linesFor(context, text, width) {
  return wrapText(context, text, width);
}

function drawText(context, text, horizontal, top, width, lineHeight) {
  let cursor = top;
  for (const line of linesFor(context, text, width)) {
    context.fillText(line, horizontal, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function canvasTexture(canvas, renderer) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

async function cardTexture(card, index, data, renderer, cachedImage) {
  const image = cachedImage ?? new Image();
  if (!cachedImage) { image.src = card.image; await image.decode(); }
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = Math.round(canvas.width * data.wall.cardHeight / data.wall.cardWidth);
  const context = canvas.getContext('2d');
  const padding = 100;
  const width = canvas.width - padding * 2;
  context.textBaseline = 'top';
  context.fillStyle = '#fbfaf5';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e4e9de';
  context.fillRect(0, 0, canvas.width, 24);
  context.fillStyle = '#69765e';
  context.font = '500 63px "Segoe UI", sans-serif';
  context.fillText(translate(`AFTERLIFE / ${String(index + 1).padStart(2, '0')}`), padding, 100);
  context.fillStyle = '#3e4c36';
  context.font = '94px Georgia, serif';
  context.fillText(translate(card.date), padding, 210);
  let titleSize = 104;
  do {
    context.font = `${titleSize}px Georgia, serif`;
    if (linesFor(context, card.title, width).length * titleSize * 1.18 <= 345) break;
    titleSize -= 2;
  } while (titleSize >= 84);
  context.fillStyle = '#2f362d';
  drawText(context, card.title, padding, 367, width, titleSize * 1.18);
  const imageTop = 765;
  const imageHeight = 735;
  context.fillStyle = '#eeeae1';
  context.fillRect(padding, imageTop, width, imageHeight);
  const scale = Math.min((width - 30) / image.naturalWidth, (imageHeight - 30) / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(image, padding + (width - drawnWidth) / 2, imageTop + (imageHeight - drawnHeight) / 2, drawnWidth, drawnHeight);
  context.fillStyle = '#42493e';
  let summarySize = 70;
  do {
    context.font = `${summarySize}px "Segoe UI", sans-serif`;
    if (linesFor(context, card.summary, width).length * summarySize * 1.35 <= 490) break;
    summarySize -= 2;
  } while (summarySize >= 58);
  const bottom = drawText(context, card.summary, padding, 1575, width, summarySize * 1.35);
  if (bottom > canvas.height - 285) throw new Error(`Afterlife card would overflow: ${card.id}`);
  const buttonTop = canvas.height - 224;
  context.fillStyle = '#e4e9de';
  context.fillRect(padding, buttonTop, width, 126);
  context.font = '500 70px "Segoe UI", sans-serif';
  context.fillStyle = '#34462d';
  context.fillText(translate('Read the Story  →'), padding + 46, buttonTop + 25);
  return canvasTexture(canvas, renderer);
}

function headerTexture(data, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = Math.round(canvas.width * data.wall.headerHeight / data.wall.headerWidth);
  const context = canvas.getContext('2d');
  context.textBaseline = 'top';
  context.fillStyle = '#303b2d';
  context.font = '48px "Segoe UI", sans-serif';
  context.fillText(translate('CHAPTER 08 / INTRODUCTION'), 30, 15);
  context.font = '190px Georgia, serif';
  context.fillText(translate(data.title), 30, 88);
  context.fillStyle = '#68765b';
  context.font = '72px "Segoe UI", sans-serif';
  context.textAlign = 'right';
  context.fillText(translate(data.years.toUpperCase()), canvas.width - 30, 182);
  context.textAlign = 'left';
  context.font = '87px Georgia, serif';
  context.fillStyle = '#424c3c';
  context.fillText(translate(data.subtitle), 30, 300);
  context.fillStyle = '#626b5c';
  let bodySize = 56;
  const sectionTop = canvas.height - 190;
  do {
    context.font = `${bodySize}px "Segoe UI", sans-serif`;
    if (linesFor(context, data.intro[0], canvas.width - 60).length * bodySize * 1.35 <= sectionTop - 430) break;
    bodySize -= 2;
  } while (bodySize >= 44);
  if (drawText(context, data.intro[0], 30, 410, canvas.width - 60, bodySize * 1.35) > sectionTop - 15) throw new Error('Afterlife header introduction would overflow');
  const columnWidth = (canvas.width - 60) / data.sections.length;
  for (const [index, section] of data.sections.entries()) {
    const left = 30 + index * columnWidth;
    context.font = '32px "Segoe UI", sans-serif';
    context.fillStyle = '#68765b';
    context.fillText(String(index + 1).padStart(2, '0'), left, sectionTop);
    context.font = '43px Georgia, serif';
    context.fillStyle = '#303b2d';
    if (drawText(context, section.title, left, sectionTop + 49, columnWidth - 30, 51) > canvas.height - 62) throw new Error('Afterlife section heading would overflow');
  }
  context.font = '39px "Segoe UI", sans-serif';
  context.fillText(translate('Read the introduction + explore four sections  →'), 30, canvas.height - 46);
  return canvasTexture(canvas, renderer);
}

function externalLink(label, url) {
  const link = document.createElement('a');
  link.textContent = label;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export async function createAfterlifeExhibit({ data, scene, renderer, pickMeshes, onOpen, onLocate, onExit, onAlmond, onLondon, onArtwork }) {
  validateAfterlife(data);
  const group = new THREE.Group();
  group.name = 'Hall 08 · Afterlife · independent epilogue gallery';
  const normal = new THREE.Vector3(...data.wall.normal);
  const images = await Promise.all(data.cards.map(async (card) => { const image = new Image(); image.src = card.image; await image.decode(); return image; }));
  const textures = await Promise.all(data.cards.map((card, index) => cardTexture(card, index, data, renderer, images[index])));
  const archiveMaterials = [];
  for (const [index, card] of data.cards.entries()) {
    const placement = data.wall.cardPlacements[index];
    const cardNormal = new THREE.Vector3(...placement.normal);
    const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), cardNormal);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(data.wall.cardWidth + 0.035, data.wall.cardHeight + 0.035, 0.065),
      new THREE.MeshStandardMaterial({ color: '#e8e9df', roughness: 0.95 }));
    backing.position.set(...placement.position).addScaledVector(cardNormal, data.wall.inset);
    backing.position.y = data.wall.centerHeight;
    backing.quaternion.copy(orientation);
    backing.userData.afterlife_card = card.id;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(data.wall.cardWidth, data.wall.cardHeight),
      new THREE.MeshBasicMaterial({ map: textures[index], toneMapped: false }));
    mesh.name = `Afterlife ${index + 1} · ${card.title}`;
    mesh.position.copy(backing.position).addScaledVector(cardNormal, 0.036);
    mesh.quaternion.copy(orientation);
    mesh.userData.afterlife_card = card.id;
    archiveMaterials.push(mesh.material);
    group.add(backing, mesh);
    pickMeshes.push(backing, mesh);
  }
  const header = new THREE.Mesh(new THREE.PlaneGeometry(data.wall.headerWidth, data.wall.headerHeight),
    new THREE.MeshBasicMaterial({ map: headerTexture(data, renderer), transparent: true, depthWrite: false, toneMapped: false }));
  header.name = 'Afterlife introduction · 1890 onward';
  header.position.set(...data.wall.position).addScaledVector(normal, data.wall.inset + 0.038);
  header.position.y = data.wall.headerCenterHeight;
  header.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  header.userData.afterlife_card = 'overview';
  group.add(header);
  pickMeshes.push(header);
  scene.add(group);
  let textureRevision = 0;
  onLanguageChange(async () => {
    const revision = ++textureRevision;
    const replacements = await Promise.all(data.cards.map((card, index) => cardTexture(card, index, data, renderer, images[index])));
    if (revision !== textureRevision) { replacements.forEach((texture) => texture.dispose()); return; }
    for (const [index, material] of archiveMaterials.entries()) {
      material.map.dispose();
      material.map = replacements[index];
    }
    header.material.map.dispose();
    header.material.map = headerTexture(data, renderer);
  });

  const dialog = document.querySelector('#afterlife-reader');
  const navigation = document.querySelector('#afterlife-chapters');
  const storyNavigation = document.querySelector('#afterlife-stories');
  const overview = document.querySelector('#afterlife-overview');
  const layout = document.querySelector('#afterlife-layout');
  const introduction = document.querySelector('#afterlife-introduction');
  const scroll = document.querySelector('#afterlife-scroll');
  const title = document.querySelector('#afterlife-title');
  const body = document.querySelector('#afterlife-copy');
  const sources = document.querySelector('#afterlife-sources');
  const sourcesToggle = document.querySelector('#afterlife-sources-toggle');
  const image = document.querySelector('#afterlife-image');
  const imageButton = document.querySelector('#afterlife-image-zoom');
  const visual = document.querySelector('#afterlife-visual');
  const previous = document.querySelector('#afterlife-previous');
  const next = document.querySelector('#afterlife-next');
  const stories = afterlifeReadingOrder(data);
  const byId = new Map(stories.map((card) => [card.id, card]));
  const bySection = new Map(data.sections.map((section) => [section.id, section]));
  const sectionFor = new Map(data.sections.flatMap((section) => section.cardIds.map((id) => [id, section])));
  const bySource = new Map(data.sources.map((source) => [source.id, source]));
  let selected = null;
  let focusBefore = null;

  navigation.replaceChildren(...data.sections.map((section, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sectionId = section.id;
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.textContent = section.title;
    button.append(number, label);
    button.addEventListener('click', () => show(byId.get(section.cardIds[0])));
    return button;
  }));
  function graphicFor(graphic) {
    const panel = document.createElement('div');
    panel.className = 'afterlife-graphic';
    panel.dataset.kind = graphic.kind;
    const label = document.createElement('span');
    label.className = 'eyebrow';
    label.textContent = graphic.label;
    const heading = document.createElement('p');
    heading.textContent = graphic.title;
    const detail = document.createElement('span');
    detail.textContent = graphic.detail;
    panel.append(label, heading, detail);
    return panel;
  }
  const overviewLead = document.createElement('p');
  overviewLead.className = 'afterlife-overview-lead';
  overviewLead.textContent = data.intro[0];
  const overviewGrid = document.createElement('div');
  overviewGrid.className = 'afterlife-overview-grid';
  overviewGrid.replaceChildren(...data.sections.map((section, index) => {
    const first = byId.get(section.cardIds[0]);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'afterlife-section-entry';
    button.dataset.sectionId = section.id;
    if (first.image) {
      const thumbnail = document.createElement('img');
      thumbnail.src = first.image;
      thumbnail.alt = first.alt;
      button.append(thumbnail);
    } else button.append(graphicFor(first.graphic));
    const number = document.createElement('span');
    number.className = 'eyebrow';
    number.textContent = `${String(index + 1).padStart(2, '0')} · ${section.subtitle}`;
    const heading = document.createElement('strong');
    heading.textContent = section.title;
    const summary = document.createElement('span');
    summary.className = 'afterlife-section-summary';
    summary.textContent = section.summary;
    const invitation = document.createElement('span');
    invitation.className = 'afterlife-section-invitation';
    invitation.textContent = 'Explore this section →';
    button.append(number, heading, summary, invitation);
    button.addEventListener('click', () => show(first));
    return button;
  }));
  overview.replaceChildren(overviewLead, overviewGrid);
  document.querySelector('#afterlife-question').textContent = data.question;
  document.querySelector('#afterlife-intro').replaceChildren(...data.intro.map((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));

  function show(card) {
    selected = card ?? null;
    const index = stories.indexOf(selected);
    const section = sectionFor.get(selected?.id);
    const sectionIndex = data.sections.indexOf(section);
    const storyIndex = section?.cardIds.indexOf(selected.id) ?? -1;
    for (const button of navigation.querySelectorAll('button')) {
      button.setAttribute('aria-current', button.dataset.sectionId === section?.id ? 'step' : 'false');
    }
    overview.hidden = Boolean(selected);
    layout.hidden = !selected;
    introduction.hidden = !selected;
    introduction.open = false;
    document.querySelector('#afterlife-overview-toggle').disabled = !selected;
    storyNavigation.hidden = !selected;
    storyNavigation.setAttribute('aria-label', section ? `Stories in ${section.title}` : 'Afterlife stories');
    storyNavigation.replaceChildren(...(section?.cardIds ?? []).map((id, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${String(position + 1).padStart(2, '0')} · ${byId.get(id).title}`;
      button.setAttribute('aria-current', id === selected.id ? 'step' : 'false');
      button.addEventListener('click', () => show(byId.get(id)));
      return button;
    }));
    document.querySelector('#afterlife-dates').textContent = selected
      ? `${String(sectionIndex + 1).padStart(2, '0')} · ${section.subtitle} / ${selected.date}`
      : `HALL 08 · ${data.years}`;
    title.textContent = selected?.title ?? data.title;
    document.querySelector('#afterlife-subtitle').textContent = selected?.subtitle ?? data.subtitle;
    document.querySelector('#afterlife-evidence-type').textContent = selected?.typeLabel ?? (selected ? 'Historical material · Family, exhibitions and letters' : 'Four ways to follow the work into other lives');
    imageButton.hidden = !selected?.image;
    if (selected?.image) {
      image.src = selected.image;
      image.alt = selected.alt;
    } else {
      image.removeAttribute('src');
      image.alt = '';
    }
    const graphic = document.querySelector('#afterlife-graphic');
    graphic.hidden = !selected?.graphic;
    graphic.replaceChildren(...(selected?.graphic ? [graphicFor(selected.graphic)] : []));
    document.querySelector('#afterlife-caption').textContent = selected?.caption ?? (selected?.graphic ? 'Original navigation graphic, not a reproduction of the later work.' : '');
    document.querySelector('#afterlife-credit').textContent = selected?.credit ?? '';
    const imageRecord = document.querySelector('#afterlife-image-record');
    imageRecord.hidden = !selected?.image;
    imageRecord.replaceChildren(...(selected?.image ? [externalLink('Image record & rights ↗', selected.imageRecord)] : []));
    visual.classList.remove('enlarged');
    imageButton.setAttribute('aria-pressed', 'false');
    imageButton.setAttribute('aria-label', 'Enlarge the photograph or document');
    document.querySelector('#afterlife-zoom-label').textContent = 'Enlarge image +';
    body.replaceChildren(...(selected?.paragraphs ?? []).map((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    const people = document.querySelector('#afterlife-people');
    people.hidden = !selected?.people;
    people.replaceChildren(...(selected?.people ?? []).map((person) => {
      const block = document.createElement('section');
      const heading = document.createElement('h4');
      heading.textContent = person.name;
      const description = document.createElement('p');
      description.textContent = person.description;
      block.append(heading, description);
      return block;
    }));
    const connections = document.querySelector('#afterlife-connections');
    connections.replaceChildren(...(selected?.connections ?? []).map((connection) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = connection.label;
      button.addEventListener('click', () => show(byId.get(connection.cardId)));
      return button;
    }));
    const milestones = document.querySelector('#afterlife-milestones');
    milestones.hidden = !selected?.milestones;
    milestones.replaceChildren(...(selected?.milestones ?? []).map((milestone) => {
      const row = document.createElement('li');
      const date = document.createElement('strong');
      date.textContent = milestone.date;
      const text = document.createElement('span');
      text.textContent = milestone.text;
      row.append(date, text);
      return row;
    }));
    const documentEntry = document.querySelector('#afterlife-document');
    documentEntry.hidden = !selected?.document;
    documentEntry.replaceChildren();
    if (selected?.document) {
      const note = document.createElement('p');
      note.textContent = selected.document.note;
      documentEntry.append(externalLink(selected.document.label, selected.document.url), note);
    }
    document.querySelector('#afterlife-almond').hidden = selected?.id !== 'child-collection-museum';
    document.querySelector('#afterlife-artwork').hidden = !selected?.artworkId;
    sources.hidden = true;
    sourcesToggle.setAttribute('aria-expanded', 'false');
    const sourceIds = selected ? selected.sourceIds : data.sources.map((source) => source.id);
    document.querySelector('#afterlife-source-list').replaceChildren(...sourceIds.map((id) => {
      const source = bySource.get(id);
      const item = document.createElement('li');
      const kind = document.createElement('span');
      kind.className = 'eyebrow';
      kind.textContent = source.kind;
      const note = document.createElement('p');
      note.textContent = source.note;
      item.append(kind, externalLink(`${source.title} ↗`, source.url), note);
      return item;
    }));
    document.querySelector('#afterlife-rights').textContent = selected?.imageRights ?? 'Historical images retain their credits and public-domain records. Later paintings, music and film remain at official source entries; no protected media loads automatically. Personal responses are distinguished from biography.';
    document.querySelector('#afterlife-back').textContent = selected && data.cards.includes(selected) ? 'View this card on the wall' : 'Back to Afterlife gallery';
    previous.disabled = !selected;
    previous.textContent = index === 0 ? '← Four sections' : '← Previous story';
    const crossesSection = selected && sectionFor.get(stories[index + 1]?.id)?.id !== section.id;
    next.textContent = !selected ? 'Begin with the Collection →' : index === stories.length - 1 ? 'As You Leave →' : crossesSection ? 'Continue to next section →' : 'Next story →';
    next.setAttribute('aria-label', crossesSection && index < stories.length - 1 ? `Continue to ${sectionFor.get(stories[index + 1].id).title}` : next.textContent);
    document.querySelector('#afterlife-position').textContent = selected ? `Section ${sectionIndex + 1} / 4 · Story ${storyIndex + 1} / ${section.cardIds.length}` : '4 sections · Choose your own depth';
    scroll.scrollTop = 0;
  }

  const reflection = document.querySelector('#afterlife-reflection');
  const reflectionIntro = document.createElement('p');
  reflectionIntro.textContent = data.reflection.intro;
  reflection.append(reflectionIntro);
  for (const example of data.reflection.examples) {
    const block = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = example.title;
    const kind = document.createElement('span');
    kind.className = 'eyebrow';
    kind.textContent = example.kind;
    const description = document.createElement('p');
    description.textContent = example.description;
    block.append(heading, kind, description, externalLink('Read the source ↗', example.url));
    reflection.append(block);
  }
  const london = document.createElement('button');
  london.type = 'button';
  london.textContent = 'Revisit the London story & its sources →';
  london.addEventListener('click', () => { close(); onLondon(); });
  reflection.append(london);

  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (focusBefore?.isConnected && !focusBefore.closest('[inert]')) focusBefore.focus({ preventScroll: true });
    else renderer.domElement.focus({ preventScroll: true });
  }

  function revealSources() {
    sources.hidden = false;
    sourcesToggle.setAttribute('aria-expanded', 'true');
    document.querySelector('#afterlife-sources-title').focus({ preventScroll: true });
    sources.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function open(id = selected?.id ?? 'overview', { showSources = false } = {}) {
    const section = bySection.get(id);
    const card = byId.get(section ? section.cardIds[0] : id);
    if (!dialog.open) {
      focusBefore = document.activeElement;
      onOpen();
      show(card);
      dialog.showModal();
      document.querySelector('#afterlife-close').focus();
    } else show(card);
    if (showSources) revealSources();
  }

  function advance(direction) {
    const index = stories.indexOf(selected) + direction;
    if (index >= stories.length) { close(); onExit(); }
    else show(index >= 0 ? stories[index] : null);
  }
  previous.addEventListener('click', () => advance(-1));
  next.addEventListener('click', () => advance(1));
  imageButton.addEventListener('click', () => {
    if (!selected?.image) return;
    const enlarged = visual.classList.toggle('enlarged');
    imageButton.setAttribute('aria-pressed', String(enlarged));
    imageButton.setAttribute('aria-label', enlarged ? 'Reduce the photograph or document' : 'Enlarge the photograph or document');
    document.querySelector('#afterlife-zoom-label').textContent = enlarged ? 'Reduce image −' : 'Enlarge image +';
  });
  sourcesToggle.addEventListener('click', () => {
    if (sources.hidden) revealSources();
    else { sources.hidden = true; sourcesToggle.setAttribute('aria-expanded', 'false'); }
  });
  document.querySelector('#afterlife-close').addEventListener('click', close);
  document.querySelector('#afterlife-overview-toggle').addEventListener('click', () => show(null));
  document.querySelector('#afterlife-back').addEventListener('click', () => { close(); onLocate(selected?.id ?? 'overview'); });
  document.querySelector('#afterlife-exit').addEventListener('click', () => { close(); onExit(); });
  document.querySelector('#afterlife-almond').addEventListener('click', () => { close(); onAlmond(data.almondBlossomId); });
  document.querySelector('#afterlife-artwork').addEventListener('click', () => { const id = selected?.artworkId; if (id) { close(); onArtwork(id); } });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); event.stopPropagation(); close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      advance(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  return { open, close, isOpen: () => dialog.open, card: (id) => byId.get(id), section: (id) => bySection.get(id),
    stories, pose: (id, eyeHeight) => afterlifePose(data, id, eyeHeight) };
}
