import { validateStoryExhibit } from './story-data.js';

export function createStoryReader({ onOpen, onContinue }) {
  const dialog = document.querySelector('#story-reader');
  const tabs = document.querySelector('#story-chapters');
  const content = document.querySelector('#story-chapter');
  const previous = document.querySelector('#story-previous');
  const next = document.querySelector('#story-next');
  const progress = document.querySelector('#story-progress');
  const closeButton = document.querySelector('#story-close');
  const timeline = document.querySelector('#story-timeline-list');
  const viewTabs = document.querySelector('#story-view-tabs');
  const imageDialog = document.querySelector('#story-image-dialog');
  const imageButton = document.querySelector('#story-image-button');
  const returnButton = document.querySelector('#story-branch-return');
  const selectedViews = new Map();
  let data = null;
  let chapterIndex = 0;
  let branchOrigin = null;
  let focusBefore = null;
  let imageFocusBefore = null;

  const element = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  };
  const paragraphs = (texts) => texts.map((text) => element('p', '', text));
  const sourceById = (identifier) => data.sources.find((source) => source.id === identifier);

  function externalLink(source, label, resource = 'url') {
    const link = element('a', 'story-resource-link', `${label} ↗`);
    link.href = source[resource];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function sourceLink(source) {
    const item = element('li');
    item.append(externalLink(source, source.label), element('span', '', source.type));
    if (source.licenseUrl) item.append(externalLink({ url: source.licenseUrl }, `${source.license} licence`));
    return item;
  }

  function navigateChapter(identifier, focusTab = false) {
    const destination = data.chapters.findIndex((chapter) => chapter.id === identifier);
    if (data.chapters[destination].branch && !data.chapters[chapterIndex].branch) branchOrigin = data.chapters[chapterIndex].id;
    renderChapter(destination, focusTab);
  }

  function actionNode(action) {
    if (action.source) return externalLink(sourceById(action.source), action.label, action.resource || 'url');
    const button = element('button', 'story-branch-button');
    button.type = 'button';
    button.append(element('span', '', `${action.label} →`));
    if (action.description) button.append(element('small', '', action.description));
    button.addEventListener('click', () => navigateChapter(action.chapter, true));
    return button;
  }

  function quotation(quote, className = 'story-quote') {
    const block = element('blockquote', className);
    block.append(element('p', '', `“${quote.text}”`));
    const attribution = element('footer');
    attribution.append(externalLink(sourceById(quote.source), quote.attribution));
    block.append(attribution);
    return block;
  }

  function imageFigure(record) {
    const figure = element('figure', 'story-material-photo');
    const button = element('button', 'story-image-button');
    button.type = 'button';
    button.setAttribute('aria-label', `Enlarge ${record.title}`);
    const image = element('img');
    image.src = record.image;
    image.alt = record.imageCaption;
    image.decoding = 'async';
    button.append(image, element('span', '', 'Enlarge photograph'));
    button.addEventListener('click', () => openImage(record, button));
    figure.append(button, element('figcaption', '', record.imageCaption));
    return figure;
  }

  function relationshipCard(material) {
    const section = element('section', 'story-relationships');
    const people = element('div', 'story-people');
    people.setAttribute('role', 'group');
    people.setAttribute('aria-label', 'Choose a person at Hackford Road');
    const detail = element('div', 'story-person-detail');
    detail.id = `story-person-detail-${material.id}`;
    detail.setAttribute('aria-live', 'polite');
    const selectPerson = (person) => {
      [...people.children].forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.person === person.id)));
      const sources = element('ul', 'story-sources');
      sources.append(...person.sources.map((identifier) => sourceLink(sourceById(identifier))));
      detail.replaceChildren(element('h5', '', person.name), element('p', '', person.body), sources);
    };
    people.append(...material.people.map((person) => {
      const button = element('button', 'story-person');
      button.type = 'button';
      button.dataset.person = person.id;
      button.setAttribute('aria-controls', detail.id);
      button.append(element('strong', '', person.name), element('small', '', person.role));
      button.addEventListener('click', () => selectPerson(person));
      return button;
    }));
    selectPerson(material.people[0]);
    const connections = element('ul', 'story-connections');
    connections.setAttribute('aria-label', 'Documented household and family ties');
    connections.append(...material.connections.map((connection) => {
      const from = material.people.find((person) => person.id === connection.from);
      const to = material.people.find((person) => person.id === connection.to);
      const item = element('li');
      item.append(element('strong', '', connection.label), element('span', '', `${from.name} — ${to.name}`));
      return item;
    }));
    const events = element('ol', 'story-evidence-timeline');
    events.setAttribute('aria-label', 'Evidence timeline');
    events.append(...material.events.map((event) => {
      const item = element('li');
      item.append(element('time', '', event.date), element('strong', '', event.label), element('p', '', event.body));
      item.append(...event.sources.map((identifier) => externalLink(sourceById(identifier), 'Source')));
      return item;
    }));
    section.append(people, detail, element('h5', '', 'Household & Family Ties'), connections, element('h5', '', 'What the Record Shows'), events);
    return section;
  }

  function materialCard(identifier, quote) {
    const material = data.materials.find((entry) => entry.id === identifier);
    const card = element('article', 'story-material');
    card.dataset.material = material.id;
    card.append(element('span', 'eyebrow', material.kind), element('h4', '', material.title), element('p', '', material.caption));
    if (material.presentation === 'photo') card.append(imageFigure(material));
    if (material.presentation === 'letter') {
      const sheet = element('section', 'story-letter-sheet');
      sheet.append(element('span', 'story-transcription-label', 'TYPESET EXCERPT · NOT A MANUSCRIPT'), quotation(quote, 'story-letter-excerpt'));
      card.append(sheet);
    }
    if (material.presentation === 'relationships') card.append(relationshipCard(material));
    if (material.presentation === 'household') {
      const sections = element('div', 'story-household');
      sections.append(...material.sections.map((entry, index) => {
        const section = element('section');
        section.append(element('span', 'story-household-number', String(index + 1).padStart(2, '0')), element('h5', '', entry.title), element('p', '', entry.body));
        return section;
      }));
      card.append(sections);
    }
    card.append(element('p', 'story-image-credit', material.credit));
    const source = sourceById(material.source);
    if (source.licenseUrl) card.append(externalLink({ url: source.licenseUrl }, source.license));
    const actions = element('div', 'story-material-actions');
    actions.append(...material.actions.map(actionNode));
    const rights = element('details', 'story-rights');
    rights.append(element('summary', '', 'Reuse & presentation notes'), element('p', '', material.rights));
    if (source.reuseBasis) rights.append(externalLink({ url: source.reuseBasis }, 'Translation reuse terms'));
    card.append(actions, rights);
    return card;
  }

  function renderQuote(quote) {
    const container = document.querySelector('#story-quotes');
    container.replaceChildren();
    if (!quote) return;
    container.append(quotation(quote));
  }

  function renderMaterials(view) {
    const container = document.querySelector('#story-materials');
    container.replaceChildren(...(view.materials || []).map((identifier) => materialCard(identifier, view.quote)));
    renderQuote(container.querySelector('.story-letter-excerpt') ? null : view.quote);
  }

  function renderView(index, focusTab = false) {
    const chapter = data.chapters[chapterIndex];
    const view = chapter.views[index];
    selectedViews.set(chapter.id, index);
    [...viewTabs.children].forEach((button, position) => {
      button.setAttribute('aria-selected', String(position === index));
      button.tabIndex = position === index ? 0 : -1;
    });
    document.querySelector('#story-view-panel').setAttribute('aria-labelledby', `story-view-${view.id}`);
    document.querySelector('#story-view-title').textContent = view.title;
    document.querySelector('#story-view-paragraphs').replaceChildren(...paragraphs(view.paragraphs));
    renderMaterials(view);
    if (focusTab) viewTabs.children[index].focus();
  }

  function evidenceCard(card, index) {
    const details = element('details', 'story-evidence-card');
    details.id = `story-evidence-${card.id}`;
    details.name = 'london-evidence';
    const summary = element('summary');
    const heading = element('span', 'story-evidence-heading');
    heading.append(element('strong', '', card.title), element('small', '', card.label));
    summary.append(element('span', 'story-evidence-number', String(index + 1).padStart(2, '0')), heading);
    const body = element('div', 'story-evidence-body');
    body.append(...paragraphs(card.paragraphs));
    const sources = element('ul', 'story-sources');
    sources.append(...card.sources.map((identifier) => sourceLink(sourceById(identifier))));
    body.append(sources);
    details.append(summary, body);
    return details;
  }

  function renderChapter(index, focusTab = false) {
    chapterIndex = Math.max(0, Math.min(data.chapters.length - 1, index));
    const chapter = data.chapters[chapterIndex];
    const buttons = [...tabs.children];
    buttons.forEach((button, position) => {
      button.setAttribute('aria-selected', String(position === chapterIndex));
      button.tabIndex = position === chapterIndex ? 0 : -1;
    });
    content.setAttribute('aria-labelledby', `story-tab-${chapter.id}`);
    const image = document.querySelector('#story-image');
    document.querySelector('#story-figure').hidden = !chapter.image;
    if (chapter.image) image.src = chapter.image;
    else image.removeAttribute('src');
    image.alt = chapter.imageCaption || '';
    document.querySelector('#story-image-caption').textContent = chapter.imageCaption || '';
    document.querySelector('#story-image-credit').textContent = chapter.imageCredit || '';
    document.querySelector('#story-kicker').textContent = chapter.kicker;
    document.querySelector('#story-chapter-title').textContent = chapter.title;
    document.querySelector('#story-chapter-subtitle').textContent = chapter.subtitle;
    document.querySelector('#story-paragraphs').replaceChildren(...paragraphs(chapter.paragraphs));
    const expanded = document.querySelector('#story-expanded');
    expanded.hidden = !chapter.sections?.length;
    expanded.open = false;
    document.querySelector('#story-expanded-sections').replaceChildren(...(chapter.sections || []).map((section) => {
      const body = element('section');
      body.append(element('h4', '', section.title), ...paragraphs(section.paragraphs));
      return body;
    }));
    viewTabs.hidden = !chapter.views;
    document.querySelector('#story-view-panel').hidden = !chapter.views;
    viewTabs.replaceChildren(...(chapter.views || []).map((view, position) => {
      const button = element('button', '', view.label);
      button.type = 'button';
      button.id = `story-view-${view.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'story-view-panel');
      button.addEventListener('click', () => renderView(position));
      return button;
    }));
    if (chapter.views) renderView(selectedViews.get(chapter.id) || 0);
    else {
      renderMaterials(chapter);
    }
    document.querySelector('#story-evidence-cards').replaceChildren(...(chapter.evidenceCards || []).map(evidenceCard));
    document.querySelector('#story-question').textContent = chapter.prompt;
    document.querySelector('#story-actions').replaceChildren(...(chapter.actions || []).map(actionNode));
    document.querySelector('#story-evidence').textContent = chapter.evidence;
    document.querySelector('#story-sources').replaceChildren(...chapter.sources.map((identifier) => sourceLink(sourceById(identifier))));
    document.querySelector('#story-source-details').open = false;
    document.querySelector('#story-view-sources').hidden = chapter.id === 'sources';
    document.querySelector('#story-evidence-label').textContent = chapter.interpretation ? 'INTERPRETATION · NOT A DOCUMENTED SCENE' : 'A NOTE ON THE EVIDENCE';
    const mainIndex = data.readingOrder.indexOf(chapter.id);
    previous.disabled = mainIndex <= 0;
    next.disabled = mainIndex === data.readingOrder.length - 1;
    previous.hidden = Boolean(chapter.branch);
    next.hidden = Boolean(chapter.branch);
    returnButton.hidden = !chapter.branch;
    const origin = data.chapters.find((entry) => entry.id === branchOrigin) || data.chapters[0];
    returnButton.textContent = `← Back to ${origin.title}`;
    progress.textContent = chapter.branch ? 'Optional branch' : `${mainIndex + 1} / ${data.readingOrder.length}`;
    document.querySelector('#story-scroll').scrollTop = 0;
    if (focusTab) buttons[chapterIndex].focus();
  }

  function closeImage() {
    if (!imageDialog.open) return;
    imageDialog.close();
    if (imageFocusBefore?.isConnected) imageFocusBefore.focus();
    imageFocusBefore = null;
  }

  function close() {
    if (!dialog.open) return;
    closeImage();
    dialog.close();
    if (focusBefore?.isConnected && !focusBefore.disabled) focusBefore.focus();
    focusBefore = null;
  }

  function tabKey(event, buttons, activeIndex, select) {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (activeIndex + offset + buttons.length) % buttons.length;
    select(index, true);
  }

  tabs.addEventListener('keydown', (event) => tabKey(event, tabs.children, chapterIndex, (index, focusTab) => navigateChapter(data.chapters[index].id, focusTab)));
  viewTabs.addEventListener('keydown', (event) => tabKey(event, viewTabs.children, selectedViews.get(data.chapters[chapterIndex].id) || 0, renderView));
  previous.addEventListener('click', () => navigateChapter(data.readingOrder[data.readingOrder.indexOf(data.chapters[chapterIndex].id) - 1]));
  next.addEventListener('click', () => navigateChapter(data.readingOrder[data.readingOrder.indexOf(data.chapters[chapterIndex].id) + 1]));
  returnButton.addEventListener('click', () => navigateChapter(branchOrigin || data.readingOrder[0], true));
  closeButton.addEventListener('click', close);
  dialog.addEventListener('keydown', (event) => {
    if (imageDialog.open || event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], summary, [tabindex="0"]')]
      .filter((entry) => entry.getClientRects().length > 0);
    const destination = event.shiftKey && document.activeElement === focusable[0] ? focusable.at(-1)
      : !event.shiftKey && document.activeElement === focusable.at(-1) ? focusable[0] : null;
    if (destination) {
      event.preventDefault();
      destination.focus();
    }
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!imageDialog.open) close(); });
  dialog.addEventListener('click', (event) => {
    if (imageDialog.open || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  function openImage(record, trigger) {
    imageFocusBefore = trigger;
    document.querySelector('#story-enlarged-image').src = record.image;
    document.querySelector('#story-enlarged-image').alt = record.imageCaption;
    document.querySelector('#story-enlarged-caption').textContent = record.imageCaption;
    document.querySelector('#story-enlarged-credit').textContent = record.imageCredit;
    const source = sourceById(record.imageSource);
    const links = document.querySelector('#story-enlarged-source');
    links.replaceChildren(externalLink(source, 'View the original image and credit'));
    if (source.licenseUrl) links.append(externalLink({ url: source.licenseUrl }, source.license));
    imageDialog.showModal();
    document.querySelector('#story-image-close').focus();
  }
  imageButton.addEventListener('click', () => openImage(data.chapters[chapterIndex], imageButton));
  document.querySelector('#story-image-close').addEventListener('click', closeImage);
  imageDialog.addEventListener('cancel', (event) => { event.preventDefault(); event.stopPropagation(); closeImage(); });
  imageDialog.addEventListener('click', (event) => {
    if (event.target !== imageDialog) return;
    const bounds = imageDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeImage();
  });
  imageDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...imageDialog.querySelectorAll('button, a[href]')].filter((entry) => entry.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.querySelector('#story-view-sources').addEventListener('click', () => navigateChapter('sources', true));
  document.querySelector('#story-continue').addEventListener('click', () => { close(); onContinue(); });

  return {
    setData(value) {
      validateStoryExhibit(value);
      data = value;
      document.querySelector('#story-title').textContent = data.title;
      document.querySelector('#story-years').textContent = data.subtitle;
      document.querySelector('#story-location').textContent = '87 HACKFORD ROAD · LONDON';
      tabs.replaceChildren(...data.chapters.map((chapter) => {
        const button = element('button', chapter.branch ? 'story-optional-tab' : '', chapter.title);
        button.type = 'button';
        button.id = `story-tab-${chapter.id}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'story-chapter');
        if (chapter.branch) button.append(element('small', '', 'Optional branch'));
        button.addEventListener('click', () => navigateChapter(chapter.id));
        return button;
      }));
      timeline.replaceChildren(...data.timeline.map((entry) => {
        const item = element('li');
        item.append(element('span', 'story-timeline-date', entry.date), element('h4', '', entry.title), element('span', 'story-timeline-place', entry.place), element('p', '', entry.body));
        const sources = element('ul', 'story-sources');
        sources.append(...entry.sources.map((identifier) => sourceLink(sourceById(identifier))));
        item.append(sources);
        return item;
      }));
      renderChapter(0);
    },
    open() {
      if (!data || dialog.open) return;
      focusBefore = document.activeElement;
      onOpen();
      branchOrigin = null;
      document.querySelector('.story-timeline').open = false;
      renderChapter(0);
      dialog.showModal();
      closeButton.focus();
    },
    close,
    isOpen: () => dialog.open,
  };
}
