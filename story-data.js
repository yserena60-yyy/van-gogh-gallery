export function storySourceChapter(data, topicId, chapterId) {
  return data.chapters.find((chapter) => chapter.id === chapterId)?.sourceChapter || data.topics.find((topic) => topic.id === topicId)?.sourceChapter || 'sources';
}

export function storyChapterGroup(topic, chapterId) {
  return topic.groups?.find((group) => group.chapters.includes(chapterId)) || null;
}

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
  const household = (people = []) => {
    for (const person of people) {
      if (!person.name || !person.role) throw new Error('Incomplete household person.');
    }
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
  const topicIds = uniqueIds(data.topics, 'story topic');
  const topicChapters = [];
  for (const topic of data.topics) {
    if (!topic.title || !topic.subtitle || !topic.summary || !topic.location || !topic.chapters?.length) throw new Error(`Incomplete story topic: ${topic.id}`);
    if (topic.sourceChapter && !data.chapters.some((chapter) => chapter.id === topic.sourceChapter && chapter.branch)) throw new Error(`Invalid topic source chapter: ${topic.id}`);
    if (topic.introduction) {
      if (!topic.introduction.title || !topic.introduction.paragraphs?.length || topic.introduction.paragraphs.some((text) => !text?.trim()) || !topic.introduction.sources?.length) throw new Error(`Incomplete topic introduction: ${topic.id}`);
      if (topic.introduction.entry !== undefined && typeof topic.introduction.entry !== 'boolean') throw new Error(`Invalid topic entrance: ${topic.id}`);
      if (topic.introduction.entry && !topic.image) throw new Error(`Missing topic entrance image: ${topic.id}`);
      topic.introduction.sources.forEach(sourceReference);
    }
    if (topic.groups) {
      if (!Array.isArray(topic.groups) || !topic.groups.length) throw new Error(`Missing topic groups: ${topic.id}`);
      uniqueIds(topic.groups, 'story group');
      for (const group of topic.groups) {
        if (!group.title || !Array.isArray(group.chapters) || !group.chapters.length) throw new Error(`Incomplete topic group: ${group.id}`);
      }
      if (topic.groups.flatMap((group) => group.chapters).join('|') !== topic.chapters.join('|')) throw new Error(`Groups must cover the topic chapters in order: ${topic.id}`);
    }
    creditedImage(topic, 'topic');
    for (const identifier of topic.chapters) {
      if (!data.readingOrder.includes(identifier)) throw new Error(`Invalid topic chapter: ${identifier}`);
      topicChapters.push(identifier);
    }
  }
  if (topicChapters.join('|') !== data.readingOrder.join('|')) throw new Error('Topics must cover the main reading order exactly once.');
  for (const material of data.materials) {
    sourceReference(material.source);
    if (material.replaces) sourceReference(material.replaces);
    if (!material.rights || !material.credit) throw new Error(`Missing story credit or rights note: ${material.id}`);
    if (!['reference', 'photo', 'letter', 'relationships', 'household', 'support'].includes(material.presentation || 'reference')) throw new Error(`Unknown material presentation: ${material.id}`);
    creditedImage(material, 'material');
    if (material.presentation === 'photo' && !material.image) throw new Error(`Missing material photo: ${material.id}`);
    if (material.presentation === 'letter' && !data.sources.find((source) => source.id === material.source).licenseUrl) throw new Error(`Missing letter reuse terms: ${material.id}`);
    if (['relationships', 'support'].includes(material.presentation)) {
      if (!material.people?.length) throw new Error(`Missing people in material: ${material.id}`);
      const peopleIds = uniqueIds(material.people, 'story person');
      for (const person of material.people) {
        sourcedText(person, 'person');
        if (!person.role) throw new Error(`Missing person role: ${person.id}`);
      }
      if (material.presentation === 'relationships' && (!material.connections?.length || !material.events?.length)) throw new Error(`Incomplete relationship card: ${material.id}`);
      for (const connection of material.connections || []) {
        if (!peopleIds.has(connection.from) || !peopleIds.has(connection.to) || connection.from === connection.to || !connection.label || !connection.sources?.length) throw new Error(`Invalid relationship connection: ${material.id}`);
        connection.sources.forEach(sourceReference);
      }
      for (const event of material.events || []) {
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
  const mainText = new Map();
  const sceneIds = new Set();
  for (const chapter of data.chapters) {
    if (chapter.sourceChapter && !data.chapters.some((entry) => entry.id === chapter.sourceChapter && entry.branch)) throw new Error(`Invalid chapter source branch: ${chapter.id}`);
    if (!chapter.branch && !data.readingOrder.includes(chapter.id)) throw new Error(`Main chapter missing from reading order: ${chapter.id}`);
    if (!chapter.branch) {
      if (!chapter.focus?.trim()) throw new Error(`Missing chapter focus: ${chapter.id}`);
      const texts = [chapter, ...(chapter.views || []), ...(chapter.sections || []), ...(chapter.scenes || []), ...(chapter.assessment?.items || [])].flatMap((entry) => entry.paragraphs || []);
      for (const text of texts) {
        const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
        if (mainText.has(normalized)) throw new Error(`Repeated story paragraph: ${mainText.get(normalized)} / ${chapter.id}`);
        mainText.set(normalized, chapter.id);
      }
    }
    household(chapter.people);
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
    if (chapter.assessment) {
      if (!chapter.assessment.label || !chapter.assessment.items?.length) throw new Error(`Incomplete report assessment: ${chapter.id}`);
      uniqueIds(chapter.assessment.items, 'report assessment');
      for (const item of chapter.assessment.items) {
        if (!item.title || !item.paragraphs?.length || item.paragraphs.some((text) => !text?.trim()) || !item.sources?.length) throw new Error(`Incomplete assessment item: ${item.id}`);
        item.sources.forEach(sourceReference);
      }
    }
    if (chapter.scenes) {
      uniqueIds(chapter.scenes, 'narrative scene');
      for (const scene of chapter.scenes) {
        if (sceneIds.has(scene.id)) throw new Error(`Repeated narrative scene across chapters: ${scene.id}`);
        sceneIds.add(scene.id);
        if (!scene.title || !scene.subtitle || !scene.paragraphs?.length || scene.paragraphs.some((text) => !text) || !scene.sources?.length || !scene.actions?.length) throw new Error('Incomplete narrative scene: ' + scene.id);
        scene.sources.forEach(sourceReference);
        actions(scene.actions);
        household(scene.people);
        creditedImage(scene, 'narrative scene');
        if (scene.record) {
          if (['label', 'date', 'title', 'body'].some((field) => !scene.record[field]?.trim())) throw new Error(`Incomplete narrative record: ${scene.id}`);
          if (scene.record.flow && (scene.record.flow.length < 2 || scene.record.flow.some((name) => !name?.trim()))) throw new Error(`Incomplete correspondence guide: ${scene.id}`);
        }
        for (const visual of scene.visuals || []) {
          if (!materialIds.has(visual.material)) throw new Error('Unknown narrative material: ' + visual.material);
          quote(visual.quote);
          const material = data.materials.find((entry) => entry.id === visual.material);
          if (material.presentation === 'letter' && (!visual.quote || visual.quote.source !== material.source)) throw new Error('Missing or mismatched narrative letter excerpt: ' + visual.material);
        }
        if (scene.addresses && (scene.addresses.length !== 2 || !scene.addressCaption || scene.addresses.some((address) => !address.name || !address.detail))) throw new Error('Incomplete narrative address change.');
      }
      const comparison = chapter.comparison;
      if (!comparison?.title || !comparison.subtitle || !comparison.chapter || comparison.chapter !== chapter.sourceChapter) throw new Error('Incomplete narrative source comparison.');
      if (!chapter.closing?.title || !chapter.closing.paragraphs?.length || !chapter.closing.action) throw new Error('Incomplete narrative continuation.');
      actions([chapter.closing.action]);
    }
  }
  for (const entry of data.timeline) entry.sources.forEach(sourceReference);
  return { topics: topicIds.size, chapters: chapterIds.size, mainChapters: data.readingOrder.length, materials: materialIds.size, sources: sourceIds.size };
}
