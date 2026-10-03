export function validateArtworkCards(data, collection) {
  if (!data?.cards || !data.version) throw new Error('Missing authored artwork cards');
  for (const [id, card] of Object.entries(data.cards)) {
    const work = collection.works[id];
    if (!work || work.body !== card.body || work.title !== card.title || work.date !== card.date) throw new Error(`Artwork label and collection disagree: ${id}`);
    if (!card.body || !card.evidence || card.stories?.length !== 3) throw new Error(`Incomplete artwork story: ${id}`);
    if (/[\u3400-\u9fff]/u.test(JSON.stringify(card))) throw new Error(`Artwork copy must be English: ${id}`);
    for (const chapter of card.stories) {
      if (!chapter.title || !chapter.body || !chapter.tag || !chapter.prompt || !chapter.sources.length) throw new Error(`Incomplete story chapter: ${id}`);
    }
    for (const source of [...card.sources, ...card.stories.flatMap((chapter) => chapter.sources), ...(card.quote ? [card.quote.source] : [])]) {
      if (!source.label || new URL(source.url).protocol !== 'https:') throw new Error(`Invalid artwork source: ${id}`);
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

export function createArtworkCards({ onExplore, onVisit, onArtworkChange = () => {} }) {
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
    const details = select('artwork-details');
    details.hidden = !card;
    details.open = false;
    if (!card) return;
    const fields = [
      ['Artist', 'Vincent van Gogh'], ['Title', card.title], ['Place & Date', [card.location, card.date].filter(Boolean).join(', ')],
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

  function compareWith(id) {
    if (comparedId === id) {
      resetImage();
      return;
    }
    resetImage();
    comparedId = id;
    const other = collection.works[id];
    for (const entry of [active, other]) {
      const frame = document.createElement('figure');
      const artwork = document.createElement('img');
      artwork.src = entry.image;
      artwork.alt = entry.title;
      frame.append(artwork, textElement('figcaption', `${entry.title} · ${entry.museumId ?? entry.fNumber ?? ''}`));
      comparison.append(frame);
    }
    imageStage.hidden = true;
    comparison.hidden = false;
    zoomButton.hidden = true;
    select('immersive-caption').textContent = 'Two distinct works · Images fitted for comparison, not shown at physical scale';
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
