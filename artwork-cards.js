import { currentLanguage, onLanguageChange } from './i18n.js';

function validateNarrative(narrative, id) {
  if (!narrative.body || !narrative.evidence || narrative.stories?.length !== 3) throw new Error(`Incomplete artwork story: ${id}`);
  for (const chapter of narrative.stories) {
    if (!chapter.title || !chapter.body || !chapter.tag || !chapter.prompt || !chapter.sources?.length) throw new Error(`Incomplete story chapter: ${id}`);
  }
  for (const source of [...narrative.sources, ...narrative.stories.flatMap((chapter) => chapter.sources)]) {
    if (!source.label || new URL(source.url).protocol !== 'https:') throw new Error(`Invalid artwork source: ${id}`);
  }
}

export function validateArtworkCards(data, collection) {
  if (!data?.cards || !data.version) throw new Error('Missing authored artwork cards');
  for (const [id, card] of Object.entries(data.cards)) {
    const work = collection.works[id];
    if (!work || work.body !== card.body || work.title !== card.title || work.date !== card.date) throw new Error(`Artwork label and collection disagree: ${id}`);
    validateNarrative(card, id);
    if (/[\u3400-\u9fff]/u.test(JSON.stringify(card))) throw new Error(`Artwork copy must be English: ${id}`);
    if (card.quote && (!card.quote.source.label || new URL(card.quote.source.url).protocol !== 'https:')) throw new Error(`Invalid artwork quotation source: ${id}`);
    if (card.seriesReading) {
      const series = card.seriesReading;
      if (!series.title) throw new Error(`Missing series title: ${id}`);
      validateNarrative(series, `${id}:series`);
      if (series.arrangement) {
        const arrangement = series.arrangement;
        if (arrangement.ids?.length !== 3 || new Set(arrangement.ids).size !== 3 || !arrangement.ids.includes(id) || !arrangement.label || !arrangement.note || !arrangement.sources?.length) throw new Error(`Incomplete series arrangement: ${id}`);
        for (const workId of arrangement.ids) if (!collection.works[workId]?.image) throw new Error(`Missing series arrangement image: ${workId}`);
        for (const source of arrangement.sources) if (!source.label || new URL(source.url).protocol !== 'https:') throw new Error(`Invalid series arrangement source: ${id}`);
      }
    }
    for (const related of card.related) {
      if (!collection.works[related.id] || !['read', 'visit', 'compare'].includes(related.mode)) throw new Error(`Invalid related artwork: ${id}`);
      if (related.label === 'View the Other Side' && card.physicalObjectId !== data.cards[related.id]?.physicalObjectId) throw new Error(`Incorrect two-sided canvas: ${id}`);
    }
  }
  return Object.keys(data.cards).length;
}

export function artworkDate(entry) {
  return entry.authoredCard ? [entry.location, entry.date].filter(Boolean).join(', ') + ` · ${entry.medium}` : entry.date;
}

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function sourceLinks(container, sources) {
  const list = document.createElement('ul');
  list.className = 'artwork-source-list';
  for (const source of sources) {
    const item = document.createElement('li');
    const link = textElement('a', `${source.label} ↗`);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    if (source.kind) item.append(textElement('small', source.kind));
    list.append(item);
  }
  container.replaceChildren(list);
}

function showQuote(container, quote) {
  container.replaceChildren();
  container.hidden = !quote;
  if (!quote) return;
  container.append(textElement('p', quote.text), textElement('cite', quote.attribution));
}

export function createArtworkCards({ onExplore, onVisit, onArtworkChange = () => {}, storyConnection = () => null, onStory = () => {} }) {
  const select = (id) => document.getElementById(id);
  const dialog = select('art-immersive');
  const figure = dialog.querySelector('.immersive-figure');
  const content = dialog.querySelector('.immersive-content');
  const overview = select('artwork-overview');
  const explore = select('artwork-explore');
  const reader = select('artwork-story-reader');
  const navigation = select('artwork-story-nav');
  const image = select('immersive-image');
  const imageStage = select('artwork-image-stage');
  const comparison = select('artwork-comparison');
  const comparisonDetails = select('artwork-comparison-details');
  const comparisonCredits = select('artwork-comparison-credits');
  const zoomButton = select('artwork-zoom');
  const back = select('artwork-reader-back');
  const surrounds = select('artwork-surround');
  let data = { cards: {} };
  let collection = null;
  let chapters = [];
  let active = null;
  let chapterIndex = 0;
  let storyOpen = false;
  let zoomed = false;
  let comparedId = null;
  const history = [];

  function currentCard() {
    return data.cards[active?.collectionId ?? active?.id];
  }

  function updateLanguageNotice() {
    select('artwork-language-note').hidden = currentLanguage() !== 'zh' || !currentCard();
  }

  onLanguageChange(updateLanguageNotice);

  function setSurround(surround) {
    figure.dataset.surround = surround;
    for (const button of select('artwork-surround-options').children) button.setAttribute('aria-pressed', String(button.dataset.surround === surround));
  }

  function resetImage() {
    zoomed = false;
    comparedId = null;
    image.style.transform = '';
    image.style.transformOrigin = '';
    imageStage.classList.remove('is-zoomed');
    imageStage.hidden = false;
    comparison.hidden = true;
    comparison.replaceChildren();
    delete comparison.dataset.layout;
    comparisonDetails.hidden = true;
    comparisonDetails.open = false;
    comparisonCredits.replaceChildren();
    select('immersive-caption').textContent = active?.title ?? '';
    surrounds.hidden = true;
    zoomButton.hidden = false;
    zoomButton.textContent = 'Look Closely +';
    zoomButton.setAttribute('aria-pressed', 'false');
    setSurround('neutral');
  }

  function renderChapter(index) {
    const card = currentCard();
    if (!card) return;
    chapterIndex = index;
    const chapter = card.stories[index];
    for (const [position, button] of [...navigation.children].entries()) button.setAttribute('aria-pressed', String(position === index));
    select('artwork-story-tag').textContent = chapter.tag;
    select('artwork-story-title').textContent = chapter.title;
    select('artwork-story-body').textContent = chapter.body;
    select('artwork-looking-prompt').textContent = chapter.prompt;
    select('artwork-story-note').hidden = !chapter.note;
    select('artwork-story-note').textContent = chapter.note ?? '';
    select('artwork-story-position').textContent = `${index + 1} / ${card.stories.length}`;
    select('artwork-story-previous').disabled = index === 0;
    select('artwork-story-next').disabled = index === card.stories.length - 1;
    sourceLinks(select('artwork-story-sources'), chapter.sources);
    surrounds.hidden = !card.surroundDemo || !storyOpen || index !== 2;
    if (surrounds.hidden) setSurround('neutral');
  }

  function setStoryOpen(open) {
    storyOpen = open && Boolean(currentCard());
    overview.hidden = storyOpen;
    reader.hidden = !storyOpen;
    explore.setAttribute('aria-expanded', String(storyOpen));
    explore.textContent = storyOpen ? 'Read the Main Label ←' : 'Explore the Story →';
    if (currentCard()) renderChapter(chapterIndex);
  }

  function renderDetails(card, entry) {
    renderSeries(card?.seriesReading);
    const details = select('artwork-details');
    details.hidden = !card;
    details.open = false;
    if (!card) return;
    const fields = [
      ['Artist', 'Vincent van Gogh'], ['Title', card.title], ['Catalogue Title', card.catalogueTitle !== card.title ? card.catalogueTitle : null], ['Place & Date', [card.location, card.date].filter(Boolean).join(', ')],
      ['Medium', card.medium], ['Dimensions', card.dimensions], ['Collection', card.institution],
      ['Collection Credit', card.collectionCredit], ['Object Number', card.museumId],
      ['Catalogue Numbers', [card.fNumber, card.jhNumber].filter(Boolean).join(' / ')],
      ['Image Credit', entry.credit], ['Image Rights Record', entry.license],
    ];
    if (card.physicalObjectId) fields.push(['Painted Support', 'Two painted surfaces of one canvas; each retains its own object number.']);
    select('artwork-detail-fields').replaceChildren(...fields.filter(([, value]) => value).flatMap(([label, value]) => [textElement('dt', label), textElement('dd', value)]));
    select('artwork-evidence').replaceChildren(...[card.evidence, ...card.notes].map((note) => textElement('p', note)));
    const reading = select('artwork-related-reading');
    reading.replaceChildren();
    if (card.relatedReading) {
      const links = document.createElement('div');
      sourceLinks(links, card.relatedReading.sources);
      reading.append(textElement('h3', card.relatedReading.title), textElement('p', card.relatedReading.body), links);
    }
    const sources = [...card.sources];
    if (entry.imageSource && !sources.some((source) => source.url === entry.imageSource)) sources.push({ label: 'Image file and rights record', url: entry.imageSource, kind: entry.credit });
    sourceLinks(select('artwork-sources'), sources);
  }

  function renderSeries(series) {
    const reading = select('artwork-series-reading');
    reading.hidden = !series;
    reading.open = false;
    reading.replaceChildren();
    if (!series) return;
    reading.append(textElement('summary', `Explore ${series.title}`), textElement('h3', series.labelTitle), textElement('p', series.body, 'immersive-body'));
    if (series.arrangement) {
      const button = textElement('button', `${series.arrangement.label} ↔`, 'artwork-action');
      button.type = 'button';
      button.addEventListener('click', () => {
        if (comparedId === 'series-arrangement') return resetImage();
        resetImage();
        comparedId = 'series-arrangement';
        comparison.dataset.layout = 'triptych';
        showComparison(series.arrangement.ids.map((id) => collection.works[id]), series.arrangement.note);
      });
      const links = document.createElement('div');
      sourceLinks(links, series.arrangement.sources);
      reading.append(button, textElement('p', series.arrangement.note, 'artwork-evidence'), links);
    }
    for (const [index, chapter] of series.stories.entries()) {
      const panel = document.createElement('details');
      panel.className = 'artwork-series-chapter';
      const prompt = document.createElement('div');
      prompt.className = 'artwork-looking-prompt';
      prompt.append(textElement('span', 'LOOKING PROMPT', 'eyebrow'), textElement('p', chapter.prompt));
      const links = document.createElement('div');
      sourceLinks(links, chapter.sources);
      panel.append(textElement('summary', `${String(index + 1).padStart(2, '0')} · ${chapter.title}`), textElement('span', chapter.tag, 'artwork-story-tag'), textElement('p', chapter.body, 'immersive-body'), prompt);
      if (chapter.note) panel.append(textElement('p', chapter.note, 'artwork-evidence'));
      panel.append(links);
      reading.append(panel);
    }
    const links = document.createElement('div');
    sourceLinks(links, series.sources);
    reading.append(textElement('h3', 'Evidence & Interpretation'), textElement('p', series.evidence, 'artwork-evidence'), textElement('h3', 'Series Sources'), links);
  }

  function showComparison(entries, caption) {
    comparisonCredits.append(textElement('p', caption, 'artwork-evidence'));
    for (const [index, entry] of entries.entries()) {
      const frame = document.createElement('figure');
      const imagePane = textElement('div', '', 'artwork-comparison-image');
      const artwork = document.createElement('img');
      artwork.src = entry.image;
      artwork.alt = entry.title;
      imagePane.append(artwork);
      const label = textElement('figcaption', entry.title);
      label.title = entry.title;
      const credit = textElement('article', '', 'artwork-comparison-credit');
      credit.append(textElement('h4', `${String(index + 1).padStart(2, '0')} · ${entry.title}`));
      credit.append(textElement('p', `${entry.institution ?? ''} · ${entry.museumId ?? entry.fNumber ?? ''}`));
      credit.append(textElement('small', entry.credit ?? ''));
      const source = textElement('a', 'Image and rights record ↗');
      source.href = entry.imageSource ?? entry.source;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      credit.append(source);
      comparisonCredits.append(credit);
      frame.append(imagePane, label);
      comparison.append(frame);
    }
    imageStage.hidden = true;
    comparison.hidden = false;
    comparisonDetails.hidden = false;
    zoomButton.hidden = true;
    select('immersive-caption').textContent = comparison.dataset.layout === 'triptych' ? 'Illustrative proposal · Not a historical installation · Not to scale' : caption;
  }

  function compareWith(id) {
    if (comparedId === id) {
      resetImage();
      return;
    }
    resetImage();
    comparedId = id;
    showComparison([active, collection.works[id]], 'Two distinct works · Images fitted for comparison, not shown at physical scale');
  }

  function renderRelated(card) {
    const container = select('artwork-related');
    container.replaceChildren();
    container.hidden = !card?.related.length;
    for (const relation of card?.related ?? []) {
      const button = textElement('button', `${relation.label} ${relation.mode === 'visit' ? '→' : '↔'}`, 'artwork-action');
      button.type = 'button';
      button.title = relation.relation;
      button.addEventListener('click', () => {
        if (relation.mode === 'visit') return onVisit(relation.id);
        if (relation.mode === 'compare') return compareWith(relation.id);
        history.push({ entry: active, chapterIndex, storyOpen });
        render({ ...collection.works[relation.id], collectionId: relation.id });
      });
      container.append(button, textElement('p', relation.relation));
    }
  }

  function render(entry, { storyFirst = false, initialChapter = 0 } = {}) {
    active = entry;
    chapterIndex = initialChapter;
    const card = currentCard();
    resetImage();
    updateLanguageNotice();
    const chapter = chapters.find((item) => item.id === entry.hall);
    image.src = entry.image;
    image.alt = entry.title;
    select('immersive-caption').textContent = entry.title;
    select('immersive-chapter').textContent = `HALL ${entry.hall ?? ''} · ${chapter?.title ?? 'Works'}`;
    select('immersive-title').textContent = entry.title;
    select('immersive-date').textContent = artworkDate(entry);
    select('immersive-body').textContent = card?.body ?? entry.body;
    select('immersive-credit').textContent = entry.credit;
    const source = select('immersive-source');
    source.hidden = Boolean(card) || !entry.source;
    if (entry.source) source.href = entry.source;
    select('artwork-label-title').textContent = card?.labelTitle ?? '';
    select('artwork-label-title').hidden = !card?.labelTitle;
    showQuote(select('artwork-quote'), card?.quote);
    explore.hidden = !card;
    navigation.replaceChildren(...(card?.stories ?? []).map((story, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.append(textElement('span', String(index + 1).padStart(2, '0')), textElement('span', story.title));
      button.addEventListener('click', () => renderChapter(index));
      return button;
    }));
    setStoryOpen(storyFirst);
    renderDetails(card, entry);
    renderRelated(card);
    const connection = storyConnection(entry.collectionId ?? entry.id);
    const storyLink = select('artwork-yellow-house');
    storyLink.hidden = !connection;
    if (connection) {
      select('artwork-yellow-house-label').textContent = connection.label;
      select('artwork-yellow-house-open').onclick = () => onStory(connection.chapterId);
    }
    back.hidden = !history.length;
    back.textContent = history.length ? `← Back to ${history.at(-1).entry.title}` : '';
    content.scrollTop = 0;
    onArtworkChange(entry);
  }

  select('card-explore').addEventListener('click', onExplore);
  explore.addEventListener('click', () => setStoryOpen(!storyOpen));
  select('artwork-story-previous').addEventListener('click', () => renderChapter(chapterIndex - 1));
  select('artwork-story-next').addEventListener('click', () => renderChapter(chapterIndex + 1));
  for (const id of ['artwork-story-previous', 'artwork-story-next']) select(id).addEventListener('click', () => navigation.scrollIntoView({ block: 'start' }));
  back.addEventListener('click', () => {
    const previous = history.pop();
    if (previous) render(previous.entry, { storyFirst: previous.storyOpen, initialChapter: previous.chapterIndex });
  });
  zoomButton.addEventListener('click', () => {
    zoomed = !zoomed;
    image.style.transform = zoomed ? 'scale(2)' : '';
    image.style.transformOrigin = '50% 50%';
    imageStage.classList.toggle('is-zoomed', zoomed);
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.textContent = zoomed ? 'Show the Whole Artwork −' : 'Look Closely +';
  });
  imageStage.addEventListener('click', (event) => {
    if (!zoomed) return;
    const bounds = imageStage.getBoundingClientRect();
    const horizontal = Math.min(100, Math.max(0, (event.clientX - bounds.left) / bounds.width * 100));
    const vertical = Math.min(100, Math.max(0, (event.clientY - bounds.top) / bounds.height * 100));
    image.style.transformOrigin = `${horizontal}% ${vertical}%`;
  });
  for (const [key, label] of [['neutral', 'Neutral'], ['dark', 'Dark'], ['wheat', 'Wheat Gold']]) {
    const button = textElement('button', label);
    button.type = 'button';
    button.dataset.surround = key;
    button.setAttribute('aria-pressed', String(key === 'neutral'));
    button.addEventListener('click', () => {
      setSurround(key);
    });
    select('artwork-surround-options').append(button);
  }

  return {
    setData(value, works, hallChapters) {
      validateArtworkCards(value, works);
      data = value;
      collection = works;
      chapters = hallChapters;
    },
    renderHover(entry) {
      const card = data.cards[entry.collectionId ?? entry.id];
      select('card-label-title').textContent = card?.labelTitle ?? '';
      select('card-label-title').hidden = !card?.labelTitle;
      select('card-explore').hidden = !card;
      showQuote(select('card-quote'), card?.quote);
    },
    open(entry, options) {
      history.length = 0;
      render(entry, options);
    },
    close() {
      active = null;
      history.length = 0;
      resetImage();
    },
  };
}
