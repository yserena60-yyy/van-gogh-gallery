function requiredText(value, location) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Yellow House: missing text at ${location}`);
}

function paragraphs(values, location) {
  if (!Array.isArray(values) || !values.length) throw new Error(`Yellow House: missing paragraphs at ${location}`);
  values.forEach((value, index) => requiredText(value, `${location}.${index}`));
}

function uniqueIds(entries, location) {
  if (!Array.isArray(entries)) throw new Error(`Yellow House: missing ${location}`);
  const ids = new Set();
  for (const entry of entries) {
    requiredText(entry.id, `${location}.id`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error(`Yellow House: invalid ${location} id ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Yellow House: duplicate ${location} id ${entry.id}`);
    ids.add(entry.id);
  }
  return ids;
}

function httpsUrl(value, location) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Yellow House: invalid URL at ' + location); }
  if (url.protocol !== 'https:') throw new Error('Yellow House: non-HTTPS URL at ' + location);
}

function imageDimensions(values, location) {
  if (!Array.isArray(values) || values.length !== 2 || !values.every((value) => Number.isInteger(value) && value > 0)) throw new Error('Yellow House: invalid image dimensions ' + location);
}

function peopleRecords(values, location) {
  if (!Array.isArray(values) || !values.length) throw new Error('Yellow House: invalid people at ' + location);
  for (const person of values) {
    for (const field of ['name', 'role', 'text']) requiredText(person[field], location + '.' + field);
  }
}

export function yellowHouseConnection(data, workId) {
  return data?.workConnections.find((entry) => entry.workId === workId) ?? null;
}

export function validateYellowHouse(data, collection) {
  if (data?.schemaVersion !== 1) throw new Error('Yellow House: unsupported schema');
  for (const field of ['title', 'subtitle', 'eyebrow', 'contentNote', 'mediaNote']) requiredText(data[field], field);
  paragraphs(data.introduction, 'introduction');
  const sourceIds = uniqueIds(data.sources, 'sources');
  const chapterIds = uniqueIds(data.chapters, 'chapters');
  const evidenceIds = uniqueIds(data.evidence, 'evidence');
  const mediaIds = uniqueIds(data.media ?? [], 'media');
  if (!['a-place-for-two', 'working-side-by-side', 'staying-or-leaving', '23-december', 'care-and-concern', 'returning-to-work', 'seeking-care'].every((id) => chapterIds.has(id))) throw new Error('Yellow House: missing core chapter');
  if (!chapterIds.has(data.skipChapter) || data.continueToHall !== '06') throw new Error('Yellow House: invalid recovery or Saint-Rémy navigation');
  const referenceSources = (values, location) => {
    if (!Array.isArray(values) || !values.length || values.some((id) => !sourceIds.has(id))) throw new Error(`Yellow House: invalid sources at ${location}`);
  };
  const referenceWork = (id) => {
    const work = collection?.works[id];
    if (!work || !/^\.\/assets\/[a-z0-9-]+\.jpg$/.test(work.image)) throw new Error(`Yellow House: unknown or invalid artwork ${id}`);
    imageDimensions(data.imageSizes?.[id], id);
  };
  for (const source of data.sources) {
    for (const field of ['title', 'date', 'type', 'note']) requiredText(source[field], `sources.${source.id}.${field}`);
    httpsUrl(source.url, 'sources.' + source.id);
  }
  for (const media of data.media ?? []) {
    for (const field of ['title', 'creator', 'date', 'medium', 'dimensions', 'institution', 'accession', 'credit', 'rights']) requiredText(media[field], 'media.' + media.id + '.' + field);
    if (!/^\.\/assets\/[a-z0-9-]+\.jpg$/.test(media.image)) throw new Error('Yellow House: invalid media image ' + media.id);
    imageDimensions(media.pixels, 'media.' + media.id);
    if (!sourceIds.has(media.sourceId)) throw new Error('Yellow House: invalid media source ' + media.id);
    httpsUrl(media.rightsUrl, 'media.' + media.id + '.rightsUrl');
  }
  requiredText(data.entry?.title, 'entry.title');
  requiredText(data.entry?.paragraph, 'entry.paragraph');
  referenceWork(data.entry.workId);
  referenceSources(data.entry.sources, 'entry');
  for (const chapter of data.chapters) {
    for (const field of ['label', 'title', 'date']) requiredText(chapter[field], `chapters.${chapter.id}.${field}`);
    if (!['04', '05', '06'].includes(chapter.hall)) throw new Error(`Yellow House: invalid hall ${chapter.id}`);
    paragraphs(chapter.paragraphs, chapter.id);
    referenceSources(chapter.sources, chapter.id);
    if (chapter.readingsLabel !== undefined) requiredText(chapter.readingsLabel, `${chapter.id}.readingsLabel`);
    if (chapter.skipChapter !== undefined) {
      if (!chapterIds.has(chapter.skipChapter) || chapter.skipChapter === chapter.id) throw new Error(`Yellow House: invalid chapter skip at ${chapter.id}`);
      requiredText(chapter.skipLabel, `${chapter.id}.skipLabel`);
    }
    if (!Array.isArray(chapter.workIds)) throw new Error(`Yellow House: invalid works ${chapter.id}`);
    chapter.workIds.forEach(referenceWork);
    const readingIds = uniqueIds(chapter.readings, `${chapter.id}.readings`);
    if (chapter.defaultReading !== undefined && !readingIds.has(chapter.defaultReading)) throw new Error(`Yellow House: invalid default reading at ${chapter.id}`);
    if (chapter.readingMode !== undefined) {
      if (chapter.readingMode !== 'tabs') throw new Error('Yellow House: invalid reading mode at ' + chapter.id);
      if (!readingIds.size || !readingIds.has(chapter.defaultReading)) throw new Error('Yellow House: tabs require a default reading at ' + chapter.id);
      requiredText(chapter.readingsLabel, chapter.id + '.readingsLabel');
    }
    for (const reading of chapter.readings) {
      for (const field of ['label', 'title', 'date']) requiredText(reading[field], `${chapter.id}.${reading.id}.${field}`);
      paragraphs(reading.paragraphs, reading.id);
      referenceSources(reading.sources, reading.id);
      if (reading.badge !== undefined) requiredText(reading.badge, `${chapter.id}.${reading.id}.badge`);
      if (reading.people !== undefined) {
        peopleRecords(reading.people, chapter.id + '.' + reading.id + '.people');
        requiredText(reading.peopleLabel, reading.id + '.peopleLabel');
      }
      if (reading.figuresLabel !== undefined) requiredText(reading.figuresLabel, reading.id + '.figuresLabel');
      if (reading.figures !== undefined) {
        if (!Array.isArray(reading.figures) || !reading.figures.length) throw new Error('Yellow House: invalid reading figures at ' + reading.id);
        const references = new Set();
        for (const figure of reading.figures) {
          if (!figure || Boolean(figure.workId) === Boolean(figure.mediaId)) throw new Error('Yellow House: figure requires one artwork or media reference at ' + reading.id);
          const key = figure.workId ? 'work:' + figure.workId : 'media:' + figure.mediaId;
          if (references.has(key)) throw new Error('Yellow House: duplicate reading figure at ' + reading.id);
          references.add(key);
          if (figure.workId) {
            referenceWork(figure.workId);
            if (!chapter.workIds.includes(figure.workId)) throw new Error('Yellow House: figure artwork is not connected at ' + reading.id);
          } else if (!mediaIds.has(figure.mediaId)) throw new Error('Yellow House: unknown reading media at ' + reading.id);
        }
      }
      if (reading.observations !== undefined) {
        const observations = uniqueIds(reading.observations, reading.id + '.observations');
        if (!observations.size || reading.figures?.length !== 1) throw new Error('Yellow House: observations require one focus image at ' + reading.id);
        requiredText(reading.observationsLabel, reading.id + '.observationsLabel');
        for (const observation of reading.observations) {
          requiredText(observation.label, reading.id + '.' + observation.id + '.label');
          requiredText(observation.text, reading.id + '.' + observation.id + '.text');
        }
      }
      if (reading.evidenceId !== undefined) {
        if (!evidenceIds.has(reading.evidenceId)) throw new Error('Yellow House: unknown reading evidence at ' + reading.id);
        requiredText(reading.evidenceLabel, reading.id + '.evidenceLabel');
      }
    }
    if (chapter.people !== undefined) peopleRecords(chapter.people, chapter.id + '.people');
    for (const event of chapter.timeline ?? []) {
      requiredText(event.label, `${chapter.id}.timeline.label`);
      requiredText(event.date, `${chapter.id}.timeline.date`);
    }
    if (chapter.hotspots) {
      referenceWork(chapter.focusWorkId);
      if (!chapter.workIds.includes(chapter.focusWorkId)) throw new Error('Yellow House: focus artwork is not connected');
      uniqueIds(chapter.hotspots, 'hotspots');
      if (chapter.hotspots.length !== 3 || chapter.focusWorkId !== 'highlight-30') throw new Error('Yellow House: recovery requires the Courtauld work and three hotspots');
      for (const hotspot of chapter.hotspots) {
        requiredText(hotspot.label, `hotspots.${hotspot.id}.label`);
        requiredText(hotspot.text, `hotspots.${hotspot.id}.text`);
        if (![hotspot.x, hotspot.y].every((value) => Number.isFinite(value) && value > 0 && value < 100)) throw new Error(`Yellow House: invalid hotspot ${hotspot.id}`);
      }
    }
  }
  const connected = new Set();
  if (!Array.isArray(data.workConnections)) throw new Error('Yellow House: missing work connections');
  for (const connection of data.workConnections) {
    referenceWork(connection.workId);
    requiredText(connection.label, 'workConnections.label');
    if (connected.has(connection.workId) || !chapterIds.has(connection.chapterId)) throw new Error('Yellow House: duplicate work or unknown story connection');
    const chapter = data.chapters.find((entry) => entry.id === connection.chapterId);
    if (!chapter.workIds.includes(connection.workId)) throw new Error('Yellow House: artwork connection does not match chapter');
    connected.add(connection.workId);
  }
  for (const evidence of data.evidence) {
    for (const field of ['title', 'subtitle', 'badge']) requiredText(evidence[field], `evidence.${evidence.id}.${field}`);
    if (!['recollection', 'retrospective-document', 'later-research', 'disputed-hypothesis', 'institutional-summary'].includes(evidence.kind)) throw new Error(`Yellow House: unlabelled evidence ${evidence.id}`);
    paragraphs(evidence.paragraphs, evidence.id);
    referenceSources(evidence.sources, evidence.id);
  }
  return { chapters: data.chapters.length, sources: data.sources.length, connections: connected.size, evidence: data.evidence.length };
}
