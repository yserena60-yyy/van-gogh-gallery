import * as THREE from 'three';
import { wallGeometry } from './hall-texts.js?v=2026-10-05-yellow-house-story';
import { validateYellowHouse } from './yellow-house-data.js?v=2026-10-06-shared-studio';

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, action, className) {
  const element = textElement('button', text, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

export function createYellowHouseStory({ data, collection, hallData, scene, renderer, pickMeshes, onOpen, onArtwork, onContinue }) {
  validateYellowHouse(data, collection);
  const select = (id) => document.getElementById(`yellow-house-${id}`);
  const dialog = select('reader');
  const navigation = select('chapters');
  const scroll = select('scroll');
  const content = select('content');
  const sourcePanel = select('sources');
  const sourcesToggle = select('sources-toggle');
  const previous = select('previous');
  const next = select('next');
  const bySource = new Map(data.sources.map((source) => [source.id, source]));
  const byChapter = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
  const byMedia = new Map((data.media ?? []).map((media) => [media.id, media]));
  const positions = new Map();
  const readingSelections = new Map();
  const hotspotSelections = new Map();
  const observationSelections = new Map();
  const enlargedImages = new Set();
  let selectedId = 'overview';
  let focusBefore = null;
  let sourceReturnScroll = 0;
  let sourcesOpen = false;
  select('title').textContent = data.title;
  select('subtitle').textContent = data.subtitle;
  select('eyebrow').textContent = data.eyebrow;

  function sourceLinks(ids, detailed = false, linkLabel = null) {
    const list = document.createElement('ul');
    list.className = 'yellow-house-source-links';
    for (const id of ids) {
      const source = bySource.get(id);
      const item = document.createElement('li');
      const link = textElement('a', `${linkLabel ?? source.title} ↗`);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (detailed) item.append(textElement('span', source.type, 'eyebrow'));
      item.append(link);
      if (detailed) item.append(textElement('p', source.date, 'yellow-house-date'), textElement('p', source.note));
      list.append(item);
    }
    return list;
  }

  function paragraphNodes(values) {
    return values.map((value) => textElement('p', value));
  }

  function artworkImage(work) {
    const image = document.createElement('img');
    [image.width, image.height] = data.imageSizes[work.id];
    image.src = work.image;
    image.alt = work.title;
    image.decoding = 'async';
    return image;
  }

  function visitArtwork(id) {
    close();
    onArtwork(id);
  }

  function artworkLinks(ids) {
    const container = document.createElement('section');
    container.className = 'yellow-house-artworks';
    for (const id of ids) {
      const work = collection.works[id];
      const link = button('', () => visitArtwork(id), 'yellow-house-artwork-link');
      const caption = textElement('span', '');
      caption.append(textElement('span', work.date), document.createTextNode(' · '), textElement('span', 'Open artwork + story →'));
      link.append(artworkImage(work), textElement('strong', work.title), caption);
      container.append(link);
    }
    return container;
  }

  function recoveryFigure(chapter) {
    const work = collection.works[chapter.focusWorkId];
    const figure = document.createElement('figure');
    figure.className = 'yellow-house-recovery';
    const stage = document.createElement('div');
    stage.className = 'yellow-house-image-stage';
    stage.append(artworkImage(work));
    const caption = document.createElement('figcaption');
    caption.append(textElement('strong', work.title), textElement('span', work.date), textElement('small', work.credit));
    const choices = document.createElement('div');
    choices.className = 'yellow-house-hotspot-choices';
    const note = document.createElement('div');
    note.className = 'yellow-house-hotspot-note';
    note.id = 'yellow-house-hotspot-note';
    note.setAttribute('aria-live', 'polite');
    const controls = [];
    function choose(hotspot) {
      hotspotSelections.set(chapter.id, hotspot.id);
      note.replaceChildren(textElement('h4', hotspot.label), textElement('p', hotspot.text));
      for (const control of controls) control.button.setAttribute('aria-pressed', String(control.id === hotspot.id));
    }
    chapter.hotspots.forEach((hotspot, index) => {
      const dot = button(String(index + 1), () => choose(hotspot), 'yellow-house-hotspot');
      dot.style.left = `${hotspot.x}%`;
      dot.style.top = `${hotspot.y}%`;
      dot.setAttribute('aria-label', hotspot.label);
      dot.setAttribute('aria-controls', note.id);
      const choice = button(`${index + 1} · ${hotspot.label}`, () => choose(hotspot));
      choice.setAttribute('aria-controls', note.id);
      controls.push({ id: hotspot.id, button: dot }, { id: hotspot.id, button: choice });
      stage.append(dot);
      choices.append(choice);
    });
    choose(chapter.hotspots.find((hotspot) => hotspot.id === hotspotSelections.get(chapter.id)) ?? chapter.hotspots[0]);
    figure.append(stage, caption, choices, note, button('Open the Artwork + Its Story →', () => visitArtwork(work.id), 'yellow-house-text-button'));
    return figure;
  }

  function peopleCards(people, relationship = false) {
    const container = document.createElement('div');
    container.className = relationship ? 'yellow-house-people yellow-house-people--relationship' : 'yellow-house-people';
    for (const person of people) {
      const item = document.createElement('section');
      item.append(textElement('h4', person.name), textElement('span', person.role, 'yellow-house-date'), textElement('p', person.text));
      container.append(item);
    }
    return container;
  }

  function readingFigures(chapter, reading) {
    const container = document.createElement('div');
    container.className = 'yellow-house-figures';
    if (reading.figures.length === 1) container.classList.add('yellow-house-figures--single');
    const figures = [];
    for (const reference of reading.figures) {
      const work = reference.workId ? collection.works[reference.workId] : byMedia.get(reference.mediaId);
      const key = chapter.id + '/' + reading.id + '/' + (reference.workId ?? reference.mediaId);
      const figure = document.createElement('figure');
      figure.className = 'yellow-house-reading-figure';
      const image = document.createElement('img');
      [image.width, image.height] = reference.workId ? data.imageSizes[reference.workId] : work.pixels;
      image.src = work.image;
      image.alt = (work.creator ?? 'Vincent van Gogh') + ' · ' + work.title;
      image.decoding = 'async';
      image.loading = 'lazy';
      const stage = button('', () => {
        if (enlargedImages.has(key)) enlargedImages.delete(key);
        else enlargedImages.add(key);
        updateEnlargement();
      }, 'yellow-house-media-stage');
      const icon = textElement('span', '↗', 'yellow-house-enlarge-icon');
      icon.setAttribute('aria-hidden', 'true');
      stage.append(image, icon);
      figures.push({ figure, stage, key, title: work.title });
      const caption = document.createElement('figcaption');
      caption.append(textElement('span', work.creator ?? 'Vincent van Gogh', 'yellow-house-figure-creator'), textElement('strong', work.title), textElement('span', work.date, 'yellow-house-date'), textElement('span', [work.medium, work.dimensions].filter(Boolean).join(' · ')), textElement('span', [work.institution, work.accession ?? work.museumId].filter(Boolean).join(' · ')), textElement('small', work.credit));
      const links = document.createElement('div');
      links.className = 'yellow-house-figure-links';
      for (const [label, url] of [['Catalogue record ↗', reference.workId ? work.source : bySource.get(work.sourceId).url], ['Image record & rights ↗', work.rightsUrl ?? work.imageSource]]) {
        const link = textElement('a', label);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      }
      caption.append(textElement('small', work.rights ?? work.license), links);
      figure.append(stage, caption);
      container.append(figure);
    }
    function updateEnlargement() {
      container.classList.toggle('has-enlarged-figure', figures.some((entry) => enlargedImages.has(entry.key)));
      for (const entry of figures) {
        const expanded = enlargedImages.has(entry.key);
        entry.figure.classList.toggle('is-enlarged', expanded);
        entry.stage.setAttribute('aria-expanded', String(expanded));
        entry.stage.setAttribute('aria-label', (expanded ? 'Reduce ' : 'Enlarge ') + entry.title + ' image');
        entry.stage.title = expanded ? 'Reduce image' : 'Enlarge image';
      }
    }
    updateEnlargement();
    return container;
  }

  function observationControls(chapter, reading) {
    const section = document.createElement('section');
    section.className = 'yellow-house-observations';
    section.append(textElement('span', reading.observationsLabel, 'eyebrow'));
    const choices = document.createElement('div');
    choices.className = 'yellow-house-observation-choices';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', reading.observationsLabel);
    const note = document.createElement('div');
    note.id = 'yellow-house-observation-' + chapter.id + '-' + reading.id;
    note.className = 'yellow-house-observation-note';
    note.setAttribute('aria-live', 'polite');
    const key = chapter.id + '/' + reading.id;
    const controls = [];
    function choose(observation) {
      observationSelections.set(key, observation.id);
      note.replaceChildren(textElement('h4', observation.label), textElement('p', observation.text));
      for (const control of controls) control.button.setAttribute('aria-pressed', String(control.id === observation.id));
    }
    for (const observation of reading.observations) {
      const control = button(observation.label, () => choose(observation));
      control.dataset.observation = observation.id;
      control.setAttribute('aria-controls', note.id);
      controls.push({ id: observation.id, button: control });
      choices.append(control);
    }
    choose(reading.observations.find((observation) => observation.id === observationSelections.get(key)) ?? reading.observations[0]);
    section.append(choices, note);
    return section;
  }

  function readings(chapter) {
    const section = document.createElement('section');
    section.className = 'yellow-house-readings';
    section.append(textElement('span', chapter.readingsLabel ?? 'LETTERS & DOCUMENTS · READ FURTHER', 'eyebrow'));
    const tabbed = chapter.readingMode === 'tabs';
    const choices = document.createElement('div');
    choices.className = 'yellow-house-reading-choices';
    if (tabbed) {
      choices.classList.add('yellow-house-reading-tabs');
      choices.setAttribute('role', 'tablist');
      choices.setAttribute('aria-label', chapter.readingsLabel);
    }
    const panel = document.createElement('div');
    panel.id = 'yellow-house-reading-panel';
    panel.className = 'yellow-house-reading-panel';
    if (tabbed) {
      panel.classList.add('yellow-house-reading-panel--tabs');
      panel.setAttribute('role', 'tabpanel');
      panel.tabIndex = 0;
    }
    const controls = [];
    function choose(reading) {
      readingSelections.set(chapter.id, reading?.id ?? null);
      panel.hidden = !reading;
      panel.replaceChildren();
      for (const control of controls) {
        const active = control.id === reading?.id;
        if (tabbed) {
          control.button.setAttribute('aria-selected', String(active));
          control.button.tabIndex = active ? 0 : -1;
          if (active) panel.setAttribute('aria-labelledby', control.button.id);
        } else {
          control.button.setAttribute('aria-expanded', String(active));
          control.button.setAttribute('aria-pressed', String(active));
        }
      }
      if (!reading) return;
      panel.append(textElement('span', reading.badge ?? 'EDITORIAL READING · NOT A TRANSCRIPT OR FACSIMILE', 'eyebrow'), textElement('h4', reading.title), textElement('p', reading.date, 'yellow-house-date'), ...paragraphNodes(reading.paragraphs));
      if (reading.people) panel.append(textElement('span', reading.peopleLabel, 'eyebrow yellow-house-reading-label'), peopleCards(reading.people, true));
      if (reading.figures) {
        if (reading.figuresLabel) panel.append(textElement('span', reading.figuresLabel, 'eyebrow yellow-house-reading-label'));
        const figures = readingFigures(chapter, reading);
        if (reading.observations) {
          const layout = document.createElement('div');
          layout.className = 'yellow-house-observation-layout';
          layout.append(figures, observationControls(chapter, reading));
          panel.append(layout);
        } else panel.append(figures);
      }
      if (reading.evidenceId) panel.append(button(reading.evidenceLabel, () => openSources(reading.evidenceId), 'yellow-house-text-button'));
      panel.append(textElement('span', 'Sources for this reading', 'eyebrow yellow-house-reading-label'), sourceLinks(reading.sources));
    }
    for (const [index, reading] of chapter.readings.entries()) {
      const control = button(tabbed ? '' : reading.label + ' +', () => choose(!tabbed && readingSelections.get(chapter.id) === reading.id ? null : reading));
      control.dataset.reading = reading.id;
      control.setAttribute('aria-controls', panel.id);
      if (tabbed) {
        control.id = 'yellow-house-reading-tab-' + reading.id;
        control.setAttribute('role', 'tab');
        const number = textElement('span', String(index + 1).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        control.append(number, textElement('span', reading.label));
        control.addEventListener('keydown', (event) => {
          const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
          let target;
          if (event.key === 'Home') target = 0;
          else if (event.key === 'End') target = controls.length - 1;
          else if (event.key in steps) target = (index + steps[event.key] + controls.length) % controls.length;
          else return;
          event.preventDefault();
          event.stopPropagation();
          choose(chapter.readings[target]);
          controls[target].button.focus({ preventScroll: true });
        });
      }
      controls.push({ id: reading.id, button: control });
      choices.append(control);
    }
    const selectedReading = readingSelections.has(chapter.id) ? readingSelections.get(chapter.id) : chapter.defaultReading;
    choose(chapter.readings.find((reading) => reading.id === selectedReading) ?? (tabbed ? chapter.readings[0] : null));
    section.append(choices, panel);
    return section;
  }

  function renderSources() {
    const chapter = byChapter.get(selectedId);
    const reading = chapter?.readings.find((entry) => entry.id === readingSelections.get(chapter.id));
    const context = reading ? 'For this reading · ' + reading.label : chapter ? 'For this chapter · ' + chapter.label : 'For the entrance';
    sourcePanel.replaceChildren(textElement('span', 'READ THE RECORD · RECOGNISE THE DIFFERENCES', 'eyebrow'), textElement('h3', 'Sources & Versions'), textElement('p', 'Letters and institutional records, later memories and researchers’ hypotheses do not speak from the same position. Read their dates, authors and evidential limits alongside the story.'), textElement('h4', context), sourceLinks(reading?.sources ?? chapter?.sources ?? data.entry.sources, true), textElement('h4', 'Memories, Documents and Later Research'));
    for (const evidence of data.evidence) {
      const details = document.createElement('details');
      details.className = 'yellow-house-evidence';
      details.dataset.kind = evidence.kind;
      details.dataset.evidence = evidence.id;
      const summary = document.createElement('summary');
      summary.append(textElement('span', evidence.badge, 'eyebrow'), textElement('strong', evidence.title), textElement('span', evidence.subtitle));
      details.append(summary, ...paragraphNodes(evidence.paragraphs));
      if (evidence.contentNote) details.append(textElement('p', evidence.contentNote, 'yellow-house-content-note'));
      details.append(sourceLinks(evidence.sources, true, evidence.linkLabel));
      sourcePanel.append(details);
    }
    const allSources = document.createElement('details');
    allSources.className = 'yellow-house-evidence';
    allSources.append(textElement('summary', `All source records · ${data.sources.length}`), sourceLinks(data.sources.map((source) => source.id), true));
    sourcePanel.append(allSources, textElement('p', data.mediaNote, 'yellow-house-media-note'));
  }

  function renderContent() {
    content.replaceChildren();
    const chapter = byChapter.get(selectedId);
    if (!chapter) {
      const layout = document.createElement('div');
      layout.className = 'yellow-house-overview-layout';
      const copy = document.createElement('div');
      copy.append(textElement('span', 'A SHARED HOME · AN UNFINISHED HOPE', 'eyebrow'), textElement('h3', data.entry.title), textElement('p', data.entry.paragraph, 'yellow-house-lead'), textElement('p', data.contentNote, 'yellow-house-content-note'), button('Skip to Returning to Work →', () => show(data.skipChapter), 'yellow-house-text-button'), ...paragraphNodes(data.introduction));
      const work = collection.works[data.entry.workId];
      const figure = document.createElement('figure');
      figure.className = 'yellow-house-overview-image';
      figure.append(artworkImage(work), textElement('figcaption', `${work.title} · ${work.date}`), textElement('p', work.credit, 'yellow-house-image-credit'), button('Open the Yellow House Artwork →', () => visitArtwork(work.id), 'yellow-house-text-button'));
      layout.append(copy, figure);
      content.append(layout);
    } else {
      const index = data.chapters.indexOf(chapter);
      content.append(textElement('span', `${String(index + 1).padStart(2, '0')} / ${chapter.label} · HALL ${chapter.hall}`, 'eyebrow'), textElement('h3', chapter.title), textElement('p', chapter.date, 'yellow-house-date'));
      const layout = document.createElement('div');
      layout.className = chapter.hotspots ? 'yellow-house-recovery-layout' : 'yellow-house-chapter-copy';
      const copy = document.createElement('div');
      copy.append(...paragraphNodes(chapter.paragraphs));
      if (chapter.skipChapter) copy.append(button(chapter.skipLabel, () => show(chapter.skipChapter), 'yellow-house-text-button'));
      if (chapter.timeline) {
        const timeline = document.createElement('div');
        timeline.className = 'yellow-house-timeline';
        for (const event of chapter.timeline) {
          const item = document.createElement('div');
          item.append(textElement('span', event.label, 'eyebrow'), textElement('strong', event.date));
          timeline.append(item);
        }
        copy.append(timeline);
      }
      if (chapter.readingMode !== 'tabs') copy.append(sourceLinks(chapter.sources));
      if (chapter.hotspots) layout.append(recoveryFigure(chapter), copy);
      else layout.append(copy);
      content.append(layout);
      if (chapter.people) content.append(peopleCards(chapter.people));
      if (chapter.readings.length) content.append(readings(chapter));
      const illustratedWorks = new Set(chapter.readings.flatMap((reading) => (reading.figures ?? []).map((figure) => figure.workId)));
      const linkedWorks = chapter.workIds.filter((id) => !illustratedWorks.has(id));
      if (!chapter.hotspots && linkedWorks.length) content.append(textElement('h4', 'Works Connected to This Chapter'), artworkLinks(linkedWorks));
    }
  }

  function show(id) {
    if (id !== 'overview' && !byChapter.has(id)) return;
    if (dialog.open) positions.set(selectedId, sourcesOpen ? sourceReturnScroll : scroll.scrollTop);
    selectedId = id;
    sourcesOpen = false;
    sourcePanel.hidden = true;
    content.hidden = false;
    sourcesToggle.setAttribute('aria-expanded', 'false');
    renderContent();
    renderSources();
    for (const control of navigation.children) {
      const active = control.dataset.chapter === id;
      control.classList.toggle('selected', active);
      if (active) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    }
    const index = data.chapters.findIndex((chapter) => chapter.id === id);
    previous.disabled = index < 0;
    previous.textContent = index === 0 ? '← Overview' : '← Previous';
    next.textContent = index === data.chapters.length - 1 ? 'Continue to Saint-Rémy →' : index < 0 ? 'Continue →' : 'Next Chapter →';
    select('position').textContent = index < 0 ? 'A Room for Gauguin' : `${String(index + 1).padStart(2, '0')} / ${String(data.chapters.length).padStart(2, '0')}`;
    scroll.scrollTop = positions.get(id) ?? 0;
    if (dialog.open) navigation.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function close() {
    if (!dialog.open) return;
    positions.set(selectedId, sourcesOpen ? sourceReturnScroll : scroll.scrollTop);
    dialog.close();
    if (focusBefore?.isConnected && focusBefore.getClientRects().length && !focusBefore.disabled && !focusBefore.closest('[inert]')) focusBefore.focus({ preventScroll: true });
    else renderer.domElement.focus({ preventScroll: true });
  }

  function open(id = selectedId) {
    if (id !== 'overview' && !byChapter.has(id)) return;
    if (dialog.open) { show(id); return; }
    focusBefore = document.activeElement;
    onOpen();
    show(id);
    dialog.showModal();
    scroll.scrollTop = positions.get(id) ?? 0;
    navigation.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    select('close').focus({ preventScroll: true });
  }

  navigation.append(button('Overview · A Room for Gauguin', () => show('overview')));
  navigation.lastElementChild.dataset.chapter = 'overview';
  data.chapters.forEach((chapter, index) => {
    const control = button('', () => show(chapter.id));
    control.dataset.chapter = chapter.id;
    control.append(textElement('span', String(index + 1).padStart(2, '0')), textElement('span', chapter.label));
    navigation.append(control);
  });
  previous.addEventListener('click', () => {
    const index = data.chapters.findIndex((chapter) => chapter.id === selectedId);
    show(index <= 0 ? 'overview' : data.chapters[index - 1].id);
  });
  next.addEventListener('click', () => {
    const index = data.chapters.findIndex((chapter) => chapter.id === selectedId);
    if (index === data.chapters.length - 1) { close(); onContinue(data.continueToHall); }
    else show(data.chapters[index + 1].id);
  });
  function setSources(open) {
    if (open && !sourcesOpen) sourceReturnScroll = scroll.scrollTop;
    sourcesOpen = open;
    sourcePanel.hidden = !sourcesOpen;
    content.hidden = sourcesOpen;
    sourcesToggle.setAttribute('aria-expanded', String(sourcesOpen));
    scroll.scrollTop = sourcesOpen ? 0 : sourceReturnScroll;
  }
  function openSources(evidenceId) {
    renderSources();
    setSources(true);
    const evidence = sourcePanel.querySelector('[data-evidence="' + evidenceId + '"]');
    if (evidence) {
      evidence.open = true;
      evidence.scrollIntoView({ block: 'start' });
      evidence.querySelector('summary').focus({ preventScroll: true });
    }
  }
  sourcesToggle.addEventListener('click', () => {
    if (!sourcesOpen) renderSources();
    setSources(!sourcesOpen);
  });
  select('close').addEventListener('click', close);
  select('back').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); event.stopPropagation(); close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  document.getElementById('yellow-house-go').addEventListener('click', () => open());

  for (const id of ['04', '05']) {
    const entry = hallData.halls.find((hall) => hall.id === id);
    const wall = { ...entry.wall, width: 2.9, height: 0.66, centerHeight: 0.74 };
    if (wall.position) wall.position = [wall.position[0], wall.centerHeight, wall.position[2]];
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = Math.round(canvas.width * wall.height / wall.width);
    const context = canvas.getContext('2d');
    context.textBaseline = 'top';
    context.fillStyle = wall.theme === 'dark' ? '#ece2c7' : '#625139';
    context.font = '110px Georgia, serif';
    context.fillText(id === '04' ? data.entry.title : 'Hope, Crisis & Recovery', 60, 55);
    context.font = '58px "Segoe UI", sans-serif';
    context.fillText('Follow the Yellow House story  →', 60, 237);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.015, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mesh = new THREE.Mesh(wallGeometry({ wall }), material);
    mesh.name = `Hall ${id} Yellow House story entrance`;
    mesh.userData.yellow_house_story = id === '04' ? 'overview' : 'staying-or-leaving';
    mesh.renderOrder = 1;
    scene.add(mesh);
    pickMeshes.push(mesh);
  }
  renderContent();
  return { open, close, isOpen: () => dialog.open };
}
