import { storyChapterGroup, storySourceChapter, validateStoryExhibit } from './story-data.js?v=2026-10-06-drawing-story';

export function createStoryReader({ onOpen, onContinue }) {
  const dialog = document.querySelector('#story-reader');
  const tabs = document.querySelector('#story-chapters');
  const groups = document.querySelector('#story-groups');
  const content = document.querySelector('#story-chapter');
  const previous = document.querySelector('#story-previous');
  const next = document.querySelector('#story-next');
  const progress = document.querySelector('#story-progress');
  const closeButton = document.querySelector('#story-close');
  const timeline = document.querySelector('#story-timeline-list');
  const timelineTitle = document.querySelector('#story-timeline-title');
  const viewTabs = document.querySelector('#story-view-tabs');
  const imageDialog = document.querySelector('#story-image-dialog');
  const imageButton = document.querySelector('#story-image-button');
  const topics = document.querySelector('#story-topics');
  const topicPanel = document.querySelector('#story-topic-panel');
  const resourceDialog = document.querySelector('#story-resource-dialog');
  const resourceBody = document.querySelector('#story-resource-body');
  const topicNext = document.querySelector('#story-topic-next');
  const selectedViews = new Map();
  const selectedChapters = new Map();
  const selectedGroupChapters = new Map();
  let data = null;
  let chapterIndex = 0;
  let topicIndex = 0;
  let focusBefore = null;
  let imageFocusBefore = null;
  let resourceFocusBefore = null;

  const element = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  };
  const paragraphs = (texts) => texts.map((text) => element('p', '', text));
  const sourceById = (identifier) => data.sources.find((source) => source.id === identifier);

  function householdPeople(people) {
    const list = element('dl', 'story-scene-people');
    list.setAttribute('aria-label', 'The household at Hackford Road');
    list.append(...people.map((person) => {
      const item = element('div');
      item.append(element('dt', '', person.name), element('dd', '', person.role));
      return item;
    }));
    return list;
  }

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
    if (destination < 0) return;
    if (data.chapters[destination].branch) { openResource(identifier); return; }
    topicIndex = data.topics.findIndex((topic) => topic.chapters.includes(identifier));
    renderChapter(destination, focusTab);
  }

  function selectTopic(index, focusTab = false) {
    const topic = data.topics[index];
    navigateChapter(selectedChapters.get(topic.id) || topic.chapters[0]);
    if (focusTab) topics.children[index].focus({ preventScroll: true });
  }

  function selectGroup(index, focusTab = false) {
    const topic = data.topics[topicIndex];
    const group = topic.groups[index];
    navigateChapter(selectedGroupChapters.get(`${topic.id}:${group.id}`) || group.chapters[0]);
    if (focusTab) groups.children[index].focus({ preventScroll: true });
  }

  function renderIntroduction(topic, chapter) {
    const introduction = document.querySelector('#story-topic-intro');
    introduction.hidden = !topic.introduction || chapter.id !== topic.chapters[0];
    introduction.classList.toggle('story-topic-entry', Boolean(topic.introduction?.entry));
    introduction.replaceChildren();
    if (introduction.hidden) return;
    const copy = element('div', 'story-topic-entry-copy');
    copy.append(element('h4', '', topic.introduction.title), ...paragraphs(topic.introduction.paragraphs));
    if (topic.introduction.entry) {
      const visual = element('div', 'story-topic-entry-visual');
      visual.append(imageFigure(topic), element('p', 'story-image-credit', topic.imageCredit));
      const actions = element('div', 'story-entry-actions');
      const read = element('button', 'story-entry-read', 'Read the Story →');
      read.type = 'button';
      read.addEventListener('click', () => {
        const scroll = document.querySelector('#story-scroll');
        const target = groups.hidden ? content : groups;
        scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20;
        const title = document.querySelector('#story-chapter-title');
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      });
      const works = element('button', 'story-entry-works', 'Explore the Early Works →');
      works.type = 'button';
      works.addEventListener('click', () => { close(); onContinue(); });
      actions.append(read, works);
      copy.append(actions);
      introduction.append(visual);
    }
    introduction.append(copy);
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
    button.append(image, element('span', '', 'Look closer'));
    button.addEventListener('click', () => openImage(record, button));
    figure.append(button, element('figcaption', '', record.imageCaption));
    return figure;
  }

  function relationshipCard(material) {
    const section = element('section', 'story-relationships');
    section.classList.toggle('story-support', material.presentation === 'support');
    const people = element('div', 'story-people');
    people.setAttribute('role', 'group');
    people.setAttribute('aria-label', material.presentation === 'support' ? 'Choose an early artistic contact' : 'Choose a person at Hackford Road');
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
    if (material.presentation === 'support') {
      section.append(people, detail);
      return section;
    }
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
    if (['relationships', 'support'].includes(material.presentation)) card.append(relationshipCard(material));
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

  function narrativeScene(scene, index) {
    const section = element('section', 'story-scene');
    section.dataset.scene = scene.id;
    const heading = element('header', 'story-scene-heading');
    const title = element('h4', '', scene.title);
    title.id = 'story-scene-' + scene.id;
    section.setAttribute('aria-labelledby', title.id);
    const titles = element('div');
    titles.append(title, element('p', 'story-scene-subtitle', scene.subtitle));
    if (scene.label) titles.append(element('p', 'story-scene-label', scene.label));
    heading.append(element('span', 'story-scene-number', String(index + 1).padStart(2, '0')), titles);
    const body = element('div', 'story-scene-body');
    const copy = element('div', 'story-scene-copy');
    copy.append(...paragraphs(scene.paragraphs));
    if (scene.people) copy.append(householdPeople(scene.people));
    if (scene.materialNote) copy.append(element('p', 'story-scene-material-note', scene.materialNote));
    body.append(copy);
    if (scene.image) {
      const visual = element('div', 'story-scene-visuals');
      visual.append(imageFigure(scene), element('p', 'story-image-credit', scene.imageCredit));
      body.prepend(visual);
      body.classList.add('story-scene-paired');
    }
    if (scene.record) {
      const record = element('aside', 'story-scene-record');
      record.append(element('p', 'story-scene-record-label', scene.record.label), element('p', 'story-scene-record-date', scene.record.date), element('h5', '', scene.record.title));
      if (scene.record.flow) {
        const flow = element('ol', 'story-correspondence-flow');
        flow.setAttribute('aria-label', 'Correspondence between siblings');
        flow.append(...scene.record.flow.map((name) => element('li', '', name)));
        record.append(flow);
      }
      record.append(element('p', '', scene.record.body));
      body.prepend(record);
      body.classList.add('story-scene-paired');
    }
    if (scene.visuals?.length) {
      const visuals = element('div', 'story-scene-visuals');
      visuals.append(...scene.visuals.map((visual) => materialCard(visual.material, visual.quote)));
      if (scene.visuals.length === 1) body.prepend(visuals);
      else body.append(visuals);
      body.classList.toggle('story-scene-paired', scene.visuals.length === 1);
      visuals.classList.toggle('story-scene-letter-pair', scene.visuals.length > 1);
    }
    if (scene.addresses) {
      const addresses = element('figure', 'story-scene-addresses');
      const list = element('ol');
      list.setAttribute('aria-label', 'The change of address');
      list.append(...scene.addresses.map((address) => {
        const item = element('li');
        item.append(element('strong', '', address.name), element('span', '', address.detail));
        return item;
      }));
      addresses.append(list, element('figcaption', '', scene.addressCaption));
      body.append(addresses);
      body.classList.add('story-scene-paired');
    }
    const links = element('div', 'story-scene-links');
    links.append(...scene.actions.map(actionNode));
    section.append(heading, body, links);
    return section;
  }

  function renderNarrative(chapter) {
    const container = document.querySelector('#story-narrative');
    container.hidden = !chapter.scenes;
    container.replaceChildren();
    if (!chapter.scenes) return;
    const scenes = chapter.scenes.map(narrativeScene);
    const jumpTo = (index) => {
      const scroll = document.querySelector('#story-scroll');
      scroll.scrollTop += scenes[index].getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20;
      const title = scenes[index].querySelector('h4');
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    };
    const actions = element('div', 'story-entry-actions');
    const begin = element('button', 'story-entry-read', 'Begin the Story →');
    begin.type = 'button';
    begin.addEventListener('click', () => jumpTo(0));
    actions.append(begin, actionNode({ label: 'Sources & Versions', chapter: chapter.sourceChapter }));
    const navigation = element('nav', 'story-scene-navigation');
    navigation.setAttribute('aria-label', 'Six moments in the London story');
    navigation.append(...chapter.scenes.map((scene, index) => {
      const button = element('button', 'story-scene-jump');
      button.type = 'button';
      button.setAttribute('aria-controls', 'story-scene-' + scene.id);
      button.append(element('span', '', String(index + 1).padStart(2, '0')), element('strong', '', scene.title));
      button.addEventListener('click', () => jumpTo(index));
      return button;
    }));
    const comparison = element('section', 'story-narrative-sources');
    comparison.append(element('h4', '', chapter.comparison.title), element('p', '', chapter.comparison.subtitle), actionNode({ label: 'Explore Sources & Versions', chapter: chapter.comparison.chapter }));
    const closing = element('section', 'story-narrative-closing');
    closing.append(element('h4', '', chapter.closing.title), ...paragraphs(chapter.closing.paragraphs), actionNode(chapter.closing.action));
    container.append(actions, navigation, ...scenes, comparison, closing);
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

  function evidenceCard(card, index, scope = 'story') {
    const details = element('details', 'story-evidence-card');
    details.id = `${scope}-evidence-${card.id}`;
    details.name = `${scope}-evidence`;
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

  function renderChapter(index, focusTab = false, scrollToReading = true) {
    chapterIndex = Math.max(0, Math.min(data.chapters.length - 1, index));
    const chapter = data.chapters[chapterIndex];
    const topic = data.topics[topicIndex];
    selectedChapters.set(topic.id, chapter.id);
    const group = storyChapterGroup(topic, chapter.id);
    if (group) selectedGroupChapters.set(`${topic.id}:${group.id}`, chapter.id);
    [...topics.children].forEach((button, position) => {
      button.setAttribute('aria-selected', String(position === topicIndex));
      button.tabIndex = position === topicIndex ? 0 : -1;
    });
    topicPanel.setAttribute('aria-labelledby', `story-topic-${topic.id}`);
    document.querySelector('#story-topic-title').textContent = topic.title;
    document.querySelector('#story-topic-subtitle').textContent = topic.subtitle;
    document.querySelector('#story-location').textContent = topic.location;
    renderIntroduction(topic, chapter);
    groups.hidden = !topic.groups;
    groups.replaceChildren(...(topic.groups || []).map((entry, position) => {
      const button = element('button', 'story-group-button');
      button.type = 'button';
      button.dataset.group = entry.id;
      button.setAttribute('aria-pressed', String(entry.id === group?.id));
      button.setAttribute('aria-controls', 'story-chapters');
      button.append(element('span', 'story-group-number', String(position + 1).padStart(2, '0')), element('strong', '', entry.title));
      button.addEventListener('click', () => selectGroup(position));
      return button;
    }));
    const visibleChapters = group?.chapters || topic.chapters;
    tabs.hidden = visibleChapters.length === 1;
    tabs.setAttribute('aria-label', `${topic.title} chapters`);
    tabs.replaceChildren(...visibleChapters.map((identifier) => {
      const record = data.chapters.find((entry) => entry.id === identifier);
      const position = topic.chapters.indexOf(identifier);
      const button = element('button', '', `${String(position + 1).padStart(2, '0')} · ${record.title}`);
      button.type = 'button';
      button.id = `story-tab-${identifier}`;
      button.dataset.chapter = identifier;
      button.title = record.focus;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'story-chapter');
      button.addEventListener('click', () => navigateChapter(identifier));
      return button;
    }));
    const buttons = [...tabs.children];
    buttons.forEach((button, position) => {
      button.setAttribute('aria-selected', String(visibleChapters[position] === chapter.id));
      button.tabIndex = visibleChapters[position] === chapter.id ? 0 : -1;
    });
    content.setAttribute('aria-labelledby', tabs.hidden ? 'story-chapter-title' : `story-tab-${chapter.id}`);
    const image = document.querySelector('#story-image');
    document.querySelector('#story-figure').hidden = !chapter.image;
    if (chapter.image) image.src = chapter.image;
    else image.removeAttribute('src');
    image.alt = chapter.imageCaption || '';
    imageButton.setAttribute('aria-label', `Enlarge ${chapter.title} image`);
    document.querySelector('#story-image-caption').textContent = chapter.imageCaption || '';
    document.querySelector('#story-image-credit').textContent = chapter.imageCredit || '';
    document.querySelector('#story-kicker').textContent = chapter.kicker;
    document.querySelector('#story-chapter-title').textContent = chapter.title;
    document.querySelector('#story-chapter-subtitle').textContent = chapter.subtitle;
    document.querySelector('#story-chapter-focus').textContent = chapter.focus;
    document.querySelector('#story-paragraphs').replaceChildren(...paragraphs(chapter.paragraphs));
    document.querySelector('#story-household').replaceChildren(...(chapter.people ? [householdPeople(chapter.people)] : []));
    content.classList.toggle('story-narrative-layout', Boolean(chapter.scenes));
    renderNarrative(chapter);
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
    document.querySelector('#story-evidence-cards').replaceChildren(...(chapter.evidenceCards || []).map((card, position) => evidenceCard(card, position)));
    const assessment = document.querySelector('#story-assessment');
    assessment.hidden = !chapter.assessment;
    assessment.replaceChildren(...(chapter.assessment ? [element('span', 'story-assessment-label eyebrow', chapter.assessment.label), ...chapter.assessment.items.map((item) => {
      const section = element('section');
      section.append(element('h4', '', item.title), ...paragraphs(item.paragraphs));
      return section;
    })] : []));
    document.querySelector('#story-question').textContent = chapter.prompt;
    document.querySelector('#story-question').hidden = !chapter.prompt;
    document.querySelector('#story-actions').replaceChildren(...(chapter.actions || []).map(actionNode));
    document.querySelector('#story-evidence').textContent = chapter.evidence;
    document.querySelector('#story-evidence').parentElement.hidden = !chapter.evidence;
    document.querySelector('#story-view-sources').hidden = Boolean(chapter.scenes);
    document.querySelector('#story-source-details').hidden = Boolean(chapter.scenes);
    document.querySelector('#story-sources').replaceChildren(...chapter.sources.map((identifier) => sourceLink(sourceById(identifier))));
    document.querySelector('#story-source-details').open = false;
    document.querySelector('#story-evidence-label').textContent = chapter.interpretation ? 'INTERPRETATION · NOT A DOCUMENTED SCENE' : 'A NOTE ON THE EVIDENCE';
    const mainIndex = data.readingOrder.indexOf(chapter.id);
    previous.disabled = mainIndex <= 0;
    next.disabled = mainIndex === data.readingOrder.length - 1;
    const nextChapter = data.chapters.find((entry) => entry.id === data.readingOrder[mainIndex + 1]);
    next.textContent = nextChapter ? `${nextChapter.title} →` : 'Next';
    next.setAttribute('aria-label', nextChapter ? `Next: ${nextChapter.title}` : 'Last chapter');
    next.hidden = !nextChapter;
    progress.textContent = `${topic.title} · ${topic.chapters.indexOf(chapter.id) + 1} / ${topic.chapters.length}`;
    topicNext.textContent = topicIndex < data.topics.length - 1 ? `Continue to ${data.topics[topicIndex + 1].title} →` : 'Enter the Early Works →';
    topicNext.hidden = Boolean(nextChapter);
    document.querySelector('#story-continue').hidden = Boolean(chapter.scenes) || topicIndex === data.topics.length - 1;
    content.classList.toggle('story-single-chapter', topic.chapters.length === 1);
    content.classList.toggle('story-mining-layout', topic.id === 'miners');
    content.classList.toggle('story-drawing-layout', topic.id === 'drawing');
    const scroll = document.querySelector('#story-scroll');
    if (scrollToReading) scroll.scrollTop += topicPanel.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20;
    else scroll.scrollTop = 0;
    if (focusTab) (tabs.hidden ? (group ? groups.children[topic.groups.indexOf(group)] : topics.children[topicIndex]) : buttons[visibleChapters.indexOf(chapter.id)]).focus({ preventScroll: true });
  }

  function openResource(identifier, trigger = document.activeElement) {
    const chapter = data.chapters.find((entry) => entry.id === identifier && entry.branch);
    if (!chapter) return;
    if (!resourceDialog.open) resourceFocusBefore = trigger;
    document.querySelector('#story-resource-kicker').textContent = chapter.kicker;
    document.querySelector('#story-resource-title').textContent = chapter.title;
    resourceBody.replaceChildren(element('h4', '', chapter.subtitle), ...paragraphs(chapter.paragraphs));
    if (chapter.image) resourceBody.append(imageFigure(chapter));
    for (const section of chapter.sections || []) resourceBody.append(element('h4', '', section.title), ...paragraphs(section.paragraphs));
    const materials = (chapter.materials || []).map((id) => materialCard(id, chapter.quote));
    if (chapter.quote && !materials.some((card) => card.querySelector('.story-letter-excerpt'))) resourceBody.append(quotation(chapter.quote));
    resourceBody.append(...(chapter.evidenceCards || []).map((card, position) => evidenceCard(card, position, 'resource')));
    resourceBody.append(...materials);
    const actions = element('div', 'story-material-actions');
    actions.append(...(chapter.actions || []).map(actionNode));
    resourceBody.append(actions, element('p', 'story-evidence-note', chapter.evidence));
    const list = element('ul', 'story-sources');
    const identifiers = [...new Set([...chapter.sources, ...(identifier === storySourceChapter(data, data.topics[topicIndex].id, data.chapters[chapterIndex].id) ? data.chapters[chapterIndex].sources : [])])];
    list.append(...identifiers.map((id) => sourceLink(sourceById(id))));
    resourceBody.append(element('h4', '', 'Sources for this reading'), list);
    resourceBody.scrollTop = 0;
    if (!resourceDialog.open) resourceDialog.showModal();
    document.querySelector('#story-resource-close').focus({ preventScroll: true });
  }

  function closeResource() {
    if (!resourceDialog.open) return;
    closeImage();
    resourceDialog.close();
    if (resourceFocusBefore?.isConnected) resourceFocusBefore.focus({ preventScroll: true });
    resourceFocusBefore = null;
  }

  function closeImage() {
    if (!imageDialog.open) return;
    imageDialog.close();
    if (imageFocusBefore?.isConnected) imageFocusBefore.focus({ preventScroll: true });
    imageFocusBefore = null;
  }

  function close() {
    if (!dialog.open) return;
    closeImage();
    closeResource();
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

  topics.addEventListener('keydown', (event) => tabKey(event, topics.children, topicIndex, selectTopic));
  groups.addEventListener('keydown', (event) => tabKey(event, groups.children, data.topics[topicIndex].groups.indexOf(storyChapterGroup(data.topics[topicIndex], data.chapters[chapterIndex].id)), selectGroup));
  tabs.addEventListener('keydown', (event) => tabKey(event, tabs.children, [...tabs.children].findIndex((button) => button.dataset.chapter === data.chapters[chapterIndex].id), (index, focusTab) => navigateChapter(tabs.children[index].dataset.chapter, focusTab)));
  viewTabs.addEventListener('keydown', (event) => tabKey(event, viewTabs.children, selectedViews.get(data.chapters[chapterIndex].id) || 0, renderView));
  previous.addEventListener('click', () => navigateChapter(data.readingOrder[data.readingOrder.indexOf(data.chapters[chapterIndex].id) - 1]));
  next.addEventListener('click', () => navigateChapter(data.readingOrder[data.readingOrder.indexOf(data.chapters[chapterIndex].id) + 1]));
  topicNext.addEventListener('click', () => {
    if (topicIndex < data.topics.length - 1) { selectTopic(topicIndex + 1, true); return; }
    close();
    onContinue();
  });
  closeButton.addEventListener('click', close);
  dialog.addEventListener('keydown', (event) => {
    if (imageDialog.open || resourceDialog.open || event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], summary, [tabindex="0"]')]
      .filter((entry) => entry.getClientRects().length > 0);
    const destination = event.shiftKey && document.activeElement === focusable[0] ? focusable.at(-1)
      : !event.shiftKey && document.activeElement === focusable.at(-1) ? focusable[0] : null;
    if (destination) {
      event.preventDefault();
      destination.focus();
    }
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!imageDialog.open && !resourceDialog.open) close(); });
  dialog.addEventListener('click', (event) => {
    if (imageDialog.open || resourceDialog.open || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  function openImage(record, trigger) {
    imageFocusBefore = trigger;
    document.querySelector('#story-enlarged-image').src = record.image;
    document.querySelector('#story-enlarged-image').alt = record.imageCaption;
    document.querySelector('#story-enlarged-caption').textContent = record.imageCaption;
    document.querySelector('#story-enlarged-credit').textContent = record.imageCredit || record.credit;
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
  const openSources = () => openResource(storySourceChapter(data, data.topics[topicIndex].id, data.chapters[chapterIndex].id));
  document.querySelector('#story-view-sources').addEventListener('click', openSources);
  document.querySelector('#story-fixed-sources').addEventListener('click', openSources);
  document.querySelector('#story-resource-close').addEventListener('click', closeResource);
  document.querySelector('#story-resource-back').addEventListener('click', closeResource);
  resourceDialog.addEventListener('cancel', (event) => { event.preventDefault(); event.stopPropagation(); if (!imageDialog.open) closeResource(); });
  resourceDialog.addEventListener('click', (event) => {
    if (event.target !== resourceDialog || imageDialog.open) return;
    const bounds = resourceDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeResource();
  });
  resourceDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || imageDialog.open) return;
    event.stopPropagation();
    const focusable = [...resourceDialog.querySelectorAll('button:not([disabled]), a[href], summary')].filter((entry) => entry.getClientRects().length);
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  });
  document.querySelector('#story-continue').addEventListener('click', () => { close(); onContinue(); });

  return {
    setData(value) {
      validateStoryExhibit(value);
      data = value;
      document.querySelector('#story-title').textContent = data.title;
      document.querySelector('#story-years').textContent = data.subtitle;
      timelineTitle.textContent = data.timelineTitle;
      document.querySelector('#story-intro').replaceChildren(...paragraphs([data.intro, data.wallText]));
      selectedChapters.clear();
      selectedGroupChapters.clear();
      selectedViews.clear();
      topicIndex = 0;
      topics.replaceChildren(...data.topics.map((topic, index) => {
        const button = element('button', 'story-topic-card');
        button.type = 'button';
        button.id = `story-topic-${topic.id}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'story-topic-panel');
        const image = element('img');
        image.src = topic.image;
        image.alt = topic.imageCaption;
        image.decoding = 'async';
        button.append(image, element('strong', '', topic.title), element('span', 'story-topic-summary', topic.summary), element('small', '', topic.imageCredit), element('span', 'story-topic-read', 'Read the story →'));
        button.addEventListener('click', () => selectTopic(index));
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
      renderChapter(0, false, false);
    },
    open(topicId) {
      if (!data || dialog.open) return;
      focusBefore = document.activeElement;
      onOpen();
      const selectedTopic = data.topics.findIndex((topic) => topic.id === topicId);
      if (selectedTopic >= 0) selectTopic(selectedTopic);
      document.querySelector('.story-timeline').open = false;
      dialog.showModal();
      closeButton.focus();
    },
    close,
    isOpen: () => dialog.open,
  };
}
