export function validateStoryExhibit(data) {
  const uniqueIds = (records, kind) => {
    const identifiers = new Set();
    for (const record of records) {
      if (!record.id || identifiers.has(record.id)) throw new Error(`Invalid or duplicate ${kind}: ${record.id}`);
      identifiers.add(record.id);
    }
    return identifiers;
  };
  const sourceIds = uniqueIds(data.sources, 'story source');
  const chapterIds = uniqueIds(data.chapters, 'story chapter');
  const materialIds = uniqueIds(data.materials, 'story material');
  const localImage = (image) => {
    if (image && !/^\.\/assets\/[a-z0-9-]+\.jpg$/.test(image)) throw new Error(`Invalid local story image: ${image}`);
  };
  const sourceReference = (identifier) => {
    if (!sourceIds.has(identifier)) throw new Error(`Unknown story source: ${identifier}`);
  };
  const actions = (entries = []) => {
    for (const action of entries) {
      if (!action.label || Boolean(action.chapter) === Boolean(action.source)) throw new Error('A story action needs exactly one destination.');
      if (action.chapter && !chapterIds.has(action.chapter)) throw new Error(`Unknown story chapter: ${action.chapter}`);
      if (action.source) {
        sourceReference(action.source);
        const source = data.sources.find((entry) => entry.id === action.source);
        if (action.resource && !['imageUrl', 'translationUrl'].includes(action.resource)) throw new Error(`Invalid story resource: ${action.resource}`);
        if (!source[action.resource || 'url']) throw new Error(`Missing story resource: ${action.source}`);
      }
    }
  };
  const quote = (entry) => {
    if (!entry) return;
    if (!entry.text || !entry.attribution) throw new Error('A story quotation requires text and attribution.');
    sourceReference(entry.source);
  };
  if (!data.readingOrder.length || new Set(data.readingOrder).size !== data.readingOrder.length) throw new Error('Invalid main story reading order.');
  for (const identifier of data.readingOrder) {
    if (!chapterIds.has(identifier) || data.chapters.find((chapter) => chapter.id === identifier).branch) throw new Error(`Invalid main story chapter: ${identifier}`);
  }
  for (const source of data.sources) {
    if (!source.url || !source.label || !source.type) throw new Error(`Incomplete story source: ${source.id}`);
    for (const resource of ['url', 'imageUrl', 'translationUrl', 'licenseUrl', 'reuseBasis']) {
      if (source[resource] && new URL(source[resource]).protocol !== 'https:') throw new Error(`Story sources require HTTPS: ${source.id}`);
    }
    localImage(source.localImage);
  }
  localImage(data.image);
  localImage(data.poster);
  if (!data.sources.some((source) => source.localImage === data.image)) throw new Error('The entry image requires a credited source.');
  const creditedImage = (record, kind) => {
    localImage(record.image);
    if (!record.image) return;
    sourceReference(record.imageSource);
    const source = data.sources.find((entry) => entry.id === record.imageSource);
    if (source.localImage !== record.image || !record.imageCaption || !record.imageCredit || !source.license) throw new Error(`Uncredited ${kind} image: ${record.id}`);
  };
  const sourcedText = (record, kind) => {
    if (!record.title && !record.label && !record.name) throw new Error(`Missing ${kind} title.`);
    if (!record.body || !record.sources?.length) throw new Error(`Missing ${kind} text or sources.`);
    record.sources.forEach(sourceReference);
  };
  for (const material of data.materials) {
    sourceReference(material.source);
    if (material.replaces) sourceReference(material.replaces);
    if (!material.rights || !material.credit) throw new Error(`Missing story credit or rights note: ${material.id}`);
    if (!['reference', 'photo', 'letter', 'relationships', 'household'].includes(material.presentation || 'reference')) throw new Error(`Unknown material presentation: ${material.id}`);
    creditedImage(material, 'material');
    if (material.presentation === 'photo' && !material.image) throw new Error(`Missing material photo: ${material.id}`);
    if (material.presentation === 'letter' && !data.sources.find((source) => source.id === material.source).licenseUrl) throw new Error(`Missing letter reuse terms: ${material.id}`);
    if (material.presentation === 'relationships') {
      if (!material.people?.length || !material.connections?.length || !material.events?.length) throw new Error(`Incomplete relationship card: ${material.id}`);
      const peopleIds = uniqueIds(material.people, 'story person');
      for (const person of material.people) {
        sourcedText(person, 'person');
        if (!person.role) throw new Error(`Missing person role: ${person.id}`);
      }
      for (const connection of material.connections) {
        if (!peopleIds.has(connection.from) || !peopleIds.has(connection.to) || connection.from === connection.to || !connection.label || !connection.sources?.length) throw new Error(`Invalid relationship connection: ${material.id}`);
        connection.sources.forEach(sourceReference);
      }
      for (const event of material.events) {
        sourcedText(event, 'event');
        if (!event.date) throw new Error(`Missing event date: ${material.id}`);
      }
    }
    if (material.presentation === 'household') {
      if (!material.sections?.length) throw new Error(`Missing household sections: ${material.id}`);
      material.sections.forEach((section) => sourcedText(section, 'household section'));
    }
    actions(material.actions);
  }
  for (const chapter of data.chapters) {
    if (!chapter.branch && !data.readingOrder.includes(chapter.id)) throw new Error(`Main chapter missing from reading order: ${chapter.id}`);
    creditedImage(chapter, 'chapter');
    chapter.sources.forEach(sourceReference);
    actions(chapter.actions);
    quote(chapter.quote);
    const views = chapter.views || [];
    uniqueIds(views, 'letter view');
    for (const view of [chapter, ...views]) {
      for (const identifier of view.materials || []) {
        if (!materialIds.has(identifier)) throw new Error(`Unknown story material: ${identifier}`);
        const material = data.materials.find((entry) => entry.id === identifier);
        if (material.presentation === 'letter' && (!view.quote || view.quote.source !== material.source)) throw new Error(`Missing or mismatched letter excerpt: ${identifier}`);
      }
      quote(view.quote);
    }
    for (const card of chapter.evidenceCards || []) card.sources.forEach(sourceReference);
  }
  for (const entry of data.timeline) entry.sources.forEach(sourceReference);
  return { chapters: chapterIds.size, mainChapters: data.readingOrder.length, materials: materialIds.size, sources: sourceIds.size };
}
