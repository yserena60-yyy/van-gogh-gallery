import { validateAuvers } from './auvers-data.js';

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, action, className = 'auvers-action') {
  const element = textElement('button', text, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

export function createAuversReader({ data, collection, scroll, onArtwork, onAfterlife, onIntroduction, onChapter = () => {} }) {
  validateAuvers(data, collection);
  const select = (id) => document.getElementById('auvers-' + id);
  const root = select('reader');
  const navigation = select('chapters');
  const content = select('content');
  const sourcePanel = select('sources');
  const sourceToggle = select('sources-toggle');
  const previous = select('previous');
  const next = select('next');
  const bySource = new Map(data.sources.map((source) => [source.id, source]));
  const byChapter = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
  const chapterButtons = new Map();
  const positions = new Map();
  const views = [['days', 'Sequence of the Days'], ['documents', 'Documents'], ['accounts', 'Accounts'], ['paintings', 'Last Paintings']];
  let selectedId = 'arrival';
  let selectedView = 'days';
  let sourcesOpen = false;
  let annotationOpen = false;
  let sourceReturnScroll = 0;
  let sourceReturnFocus = null;
  select('reading-note').textContent = data.readingNote;

  function positionKey() {
    return selectedId + '/' + (selectedId === 'final-days' ? selectedView : 'chapter');
  }

  function remember() {
    if (!root.hidden) positions.set(positionKey(), sourcesOpen ? sourceReturnScroll : scroll.scrollTop);
  }

  function sourceLinks(ids, label = null) {
    const list = document.createElement('ul');
    list.className = 'auvers-source-links';
    for (const id of ids) {
      const source = bySource.get(id);
      const item = document.createElement('li');
      const link = textElement('a', (label ?? source.title) + ' ↗');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      list.append(item);
    }
    return list;
  }

  function paragraphNodes(values) {
    return values.map((value) => textElement('p', value));
  }

  function artworkCard(id) {
    const work = collection.works[id];
    const article = document.createElement('article');
    article.className = 'auvers-artwork';
    const figure = document.createElement('figure');
    const openImage = button('', () => onArtwork(id), 'auvers-image-button');
    openImage.setAttribute('aria-label', 'Enlarge ' + work.title);
    const image = document.createElement('img');
    image.src = work.image;
    image.alt = work.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    openImage.append(image);
    figure.append(openImage, textElement('figcaption', work.credit));
    article.append(figure, textElement('h4', work.title), textElement('p', work.date, 'auvers-date'),
      button('Open artwork + story →', () => onArtwork(id)));
    return article;
  }

  function artworkGrid(ids) {
    const grid = document.createElement('div');
    grid.className = 'auvers-artworks';
    grid.append(...ids.map(artworkCard));
    return grid;
  }

  function note() {
    const element = document.createElement('aside');
    element.className = 'auvers-content-note';
    element.append(textElement('p', data.finalDays.contentNote),
      button('Skip this section · Continue to Afterlife →', onAfterlife, 'auvers-text-button'));
    return element;
  }

  function ending() {
    const element = document.createElement('section');
    element.className = 'auvers-ending';
    element.append(textElement('h3', data.ending.title), textElement('p', data.ending.text),
      button('Continue to Afterlife →', onAfterlife, 'auvers-action auvers-action-primary'));
    return element;
  }

  function timeline() {
    const final = data.finalDays;
    const fragment = document.createDocumentFragment();
    fragment.append(textElement('h3', final.timelineTitle));
    const list = document.createElement('ol');
    list.className = 'auvers-timeline';
    for (const event of final.timeline) {
      const item = document.createElement('li');
      item.append(textElement('p', event.date, 'auvers-date'), textElement('h4', event.title),
        textElement('p', event.text));
      list.append(item);
    }
    const actions = document.createElement('div');
    actions.className = 'auvers-actions';
    actions.append(button('Read the Contemporary Documents →', () => show('final-days', 'documents')),
      button('Compare Later Accounts →', () => show('final-days', 'accounts')),
      button('Reading the Last Paintings →', () => show('final-days', 'paintings')));
    fragment.append(list, sourceLinks(['museum-last-days']), actions, ending());
    return fragment;
  }

  function documents() {
    const final = data.finalDays;
    const manuscript = final.manuscript;
    const fragment = document.createDocumentFragment();
    const record = document.createElement('section');
    record.className = 'auvers-document';
    record.append(textElement('span', manuscript.reference, 'eyebrow'), textElement('h3', manuscript.title),
      textElement('p', manuscript.subtitle, 'auvers-subtitle'), textElement('h4', manuscript.recordTitle),
      ...paragraphNodes(manuscript.paragraphs));
    const annotation = document.createElement('details');
    annotation.className = 'auvers-annotation';
    annotation.open = annotationOpen;
    annotation.append(textElement('summary', 'View Theo’s annotation explanation'), textElement('h4', manuscript.annotationTitle));
    const notes = document.createElement('dl');
    for (const item of manuscript.annotation) notes.append(textElement('dt', item.label), textElement('dd', item.text));
    annotation.append(notes);
    annotation.addEventListener('toggle', () => { annotationOpen = annotation.open; });
    record.append(annotation, textElement('p', manuscript.displayNote, 'auvers-access'), sourceLinks(manuscript.sourceIds));
    fragment.append(record);
    for (const documentRecord of final.documents) {
      const item = document.createElement('section');
      item.className = 'auvers-document';
      item.append(textElement('span', documentRecord.type, 'eyebrow'), textElement('h3', documentRecord.title),
        textElement('p', documentRecord.date, 'auvers-date'), ...paragraphNodes(documentRecord.paragraphs), sourceLinks(documentRecord.sourceIds));
      fragment.append(item);
    }
    fragment.append(button('Compare Later Accounts →', () => show('final-days', 'accounts')), ending());
    return fragment;
  }

  function accounts() {
    const dataAccounts = data.finalDays.accounts;
    const fragment = document.createDocumentFragment();
    fragment.append(textElement('h3', dataAccounts.title), textElement('p', dataAccounts.subtitle, 'auvers-subtitle'),
      textElement('p', dataAccounts.intro, 'auvers-evidence-note'));
    const grid = document.createElement('div');
    grid.className = 'auvers-accounts';
    const fields = [['who', 'Who proposed it?'], ['when', 'When?'], ['argument', 'What does it argue?'],
      ['uses', 'What sources does it use?'], ['limits', 'What remains unresolved?'], ['access', 'Access & checking']];
    for (const card of dataAccounts.cards) {
      const article = document.createElement('article');
      article.className = 'auvers-account';
      article.append(textElement('span', card.type, 'eyebrow'), textElement('h4', card.title));
      const details = document.createElement('dl');
      for (const [field, label] of fields) details.append(textElement('dt', label), textElement('dd', card[field]));
      article.append(details, sourceLinks(card.sourceIds, card.linkLabel));
      grid.append(article);
    }
    fragment.append(grid, button('Reading the Last Paintings →', () => show('final-days', 'paintings')), ending());
    return fragment;
  }

  function paintings() {
    const dataPaintings = data.finalDays.paintings;
    const fragment = document.createDocumentFragment();
    fragment.append(textElement('h3', dataPaintings.title), textElement('p', dataPaintings.subtitle, 'auvers-subtitle'), textElement('p', dataPaintings.intro));
    const grid = document.createElement('div');
    grid.className = 'auvers-paintings';
    for (const card of dataPaintings.cards) {
      const article = artworkCard(card.workId);
      article.append(textElement('h5', 'Dating & order'), textElement('p', card.record),
        textElement('h5', 'Later interpretations'), textElement('p', card.interpretation), sourceLinks(card.sourceIds));
      grid.append(article);
    }
    fragment.append(grid, textElement('p', dataPaintings.prompt, 'auvers-prompt'), ending());
    return fragment;
  }

  function updateNavigation() {
    const index = data.chapters.findIndex((chapter) => chapter.id === selectedId);
    for (const [id, element] of chapterButtons) {
      if (id === selectedId) element.setAttribute('aria-current', 'step');
      else element.removeAttribute('aria-current');
    }
    previous.disabled = index === 0;
    next.disabled = index === data.chapters.length - 1;
    select('position').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(data.chapters.length).padStart(2, '0');
  }

  function show(id = 'arrival', view = 'days') {
    if (!byChapter.has(id) || !views.some(([key]) => key === view)) return;
    remember();
    const moveFocus = !root.hidden;
    selectedId = id;
    selectedView = view;
    onChapter(id);
    sourcesOpen = false;
    sourceToggle.setAttribute('aria-expanded', 'false');
    sourceToggle.textContent = 'Sources & Versions';
    sourcePanel.hidden = true;
    content.hidden = false;
    root.hidden = false;
    const chapter = byChapter.get(id);
    const index = data.chapters.indexOf(chapter);
    content.replaceChildren(textElement('span', '0' + (index + 1), 'eyebrow'), textElement('h3', chapter.title),
      textElement('p', chapter.subtitle, 'auvers-subtitle'));
    if (id === 'final-days') {
      content.append(note());
      const tabs = document.createElement('nav');
      tabs.className = 'auvers-tabs';
      tabs.setAttribute('aria-label', 'The Final Days');
      for (const [key, label] of views) {
        const tab = button(label, () => show('final-days', key), 'auvers-tab');
        tab.setAttribute('aria-pressed', String(key === view));
        tabs.append(tab);
      }
      content.append(tabs);
      if (view === 'days') content.append(...paragraphNodes(chapter.paragraphs), timeline());
      if (view === 'documents') content.append(documents());
      if (view === 'accounts') content.append(accounts());
      if (view === 'paintings') content.append(paintings());
    } else {
      content.append(...paragraphNodes(chapter.paragraphs), artworkGrid(chapter.workIds), textElement('p', chapter.prompt, 'auvers-prompt'));
    }
    content.append(sourceLinks(chapter.sourceIds));
    updateNavigation();
    scroll.scrollTop = positions.get(positionKey()) ?? 0;
    if (moveFocus) content.focus({ preventScroll: true });
  }

  function toggleSources(force) {
    const open = force ?? !sourcesOpen;
    if (open === sourcesOpen) return;
    if (open) {
      sourceReturnScroll = scroll.scrollTop;
      sourceReturnFocus = document.activeElement;
      sourcePanel.replaceChildren(textElement('h3', 'Sources & Versions'),
        textElement('p', 'Letters, object records and later accounts', 'auvers-subtitle'),
        button('Return to the Story →', () => toggleSources(false)));
      const current = byChapter.get(selectedId);
      sourcePanel.append(textElement('h4', 'Read the sources for this chapter'), sourceLinks(current.sourceIds), textElement('h4', 'All Auvers sources'));
      for (const source of data.sources) {
        const item = document.createElement('section');
        item.className = 'auvers-source-record';
        item.append(textElement('span', source.type, 'eyebrow'), textElement('h4', source.title),
          textElement('p', source.date, 'auvers-date'), textElement('p', source.note),
          textElement('p', source.access, 'auvers-access'), sourceLinks([source.id]));
        sourcePanel.append(item);
      }
      sourcePanel.append(button('Return to the Story →', () => toggleSources(false)));
    }
    sourcesOpen = open;
    sourcePanel.hidden = !open;
    content.hidden = open;
    sourceToggle.setAttribute('aria-expanded', String(open));
    sourceToggle.textContent = open ? 'Return to the Story →' : 'Sources & Versions';
    scroll.scrollTop = open ? 0 : sourceReturnScroll;
    if (open) sourcePanel.focus({ preventScroll: true });
    else if (sourceReturnFocus?.isConnected && !sourceReturnFocus.closest('[hidden]')) sourceReturnFocus.focus({ preventScroll: true });
    else content.focus({ preventScroll: true });
  }

  function hide() {
    remember();
    root.hidden = true;
  }

  for (const [index, chapter] of data.chapters.entries()) {
    const element = button('', () => show(chapter.id), 'auvers-chapter');
    element.append(textElement('span', String(index + 1).padStart(2, '0'), 'auvers-chapter-number'), textElement('span', chapter.title));
    navigation.append(element);
    chapterButtons.set(chapter.id, element);
  }
  select('introduction').addEventListener('click', () => { hide(); onIntroduction(); });
  sourceToggle.addEventListener('click', () => toggleSources());
  previous.addEventListener('click', () => {
    const index = data.chapters.findIndex((chapter) => chapter.id === selectedId);
    if (index > 0) show(data.chapters[index - 1].id);
  });
  next.addEventListener('click', () => {
    const index = data.chapters.findIndex((chapter) => chapter.id === selectedId);
    if (index < data.chapters.length - 1) show(data.chapters[index + 1].id);
  });
  return { show, hide, remember };
}
