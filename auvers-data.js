export function validateAuvers(data, collection) {
  const chapterIds = ['arrival', 'people', 'surroundings', 'july', 'final-days'];
  if (data?.language !== 'en' || data.hall !== '07' || data.title !== 'Auvers: The Final Months'
      || data.years !== 'May–July 1890' || data.chapters?.length !== chapterIds.length) {
    throw new Error('Auvers needs five ordered chapters in Hall 07, May–July 1890');
  }
  const complete = (values) => values.every((value) => typeof value === 'string' && value.trim() && !/[㐀-鿿]/u.test(value));
  const sourceIds = new Set();
  for (const source of data.sources ?? []) {
    if (!complete([source.id, source.title, source.date, source.type, source.note, source.access])
        || sourceIds.has(source.id) || new URL(source.url).protocol !== 'https:') throw new Error('Invalid Auvers source record');
    sourceIds.add(source.id);
  }
  const checkSources = (entry) => {
    if (!entry.sourceIds?.length || entry.sourceIds.some((id) => !sourceIds.has(id))) throw new Error('Unresolved Auvers source reference');
  };
  const checkWork = (id) => {
    if (!collection.works[id]?.verified || collection.works[id].hall !== '07') throw new Error('Auvers must reuse a verified Hall 07 work');
  };
  for (const [index, chapter] of data.chapters.entries()) {
    if (chapter.id !== chapterIds[index] || !chapter.paragraphs?.length
        || !complete([chapter.title, chapter.subtitle, chapter.prompt, ...chapter.paragraphs]) || !Array.isArray(chapter.workIds)) {
      throw new Error('Invalid Auvers chapter or reading order');
    }
    checkSources(chapter);
    chapter.workIds.forEach(checkWork);
  }
  const final = data.finalDays;
  if (!final || !complete([final.contentNote, final.timelineTitle]) || final.timeline?.length !== 4
      || !final.contentNote.toLowerCase().includes('suicide and death')) throw new Error('The Final Days needs a content note and four dates');
  for (const [index, event] of final.timeline.entries()) {
    if (event.date !== String(27 + index) + ' July 1890' || !complete([event.title, event.text])) throw new Error('Invalid final-days chronology');
    checkSources(event);
  }
  for (const document of final.documents ?? []) {
    if (!document.paragraphs?.length || !complete([document.title, document.date, document.type, ...document.paragraphs])) throw new Error('Invalid contemporary document record');
    checkSources(document);
  }
  const manuscript = final.manuscript;
  if (!manuscript || !complete([manuscript.title, manuscript.subtitle, manuscript.recordTitle, manuscript.reference, manuscript.displayNote, ...manuscript.paragraphs])
      || manuscript.annotation?.length !== 3 || !manuscript.recordTitle.includes('23 July 1890') || !manuscript.reference.startsWith('RM25')) {
    throw new Error('The unsent letter needs its editorial date and a separate annotation explanation');
  }
  checkSources(manuscript);
  for (const note of manuscript.annotation) if (!complete([note.label, note.text])) throw new Error('Invalid manuscript annotation');
  const accounts = final.accounts;
  if (!complete([accounts.title, accounts.subtitle, accounts.intro]) || accounts.cards?.length !== 3) throw new Error('Three attributed account records are required');
  for (const card of accounts.cards) {
    if (!complete([card.id, card.title, card.type, card.who, card.when, card.argument, card.uses, card.limits, card.access, card.linkLabel])) throw new Error('Every account needs the same evidence questions and access status');
    checkSources(card);
  }
  if (new Set(accounts.cards.map((card) => card.id)).size !== 3) throw new Error('Duplicate account identifier');
  const paintings = final.paintings;
  if (!complete([paintings.title, paintings.subtitle, paintings.intro, paintings.prompt]) || paintings.cards?.length !== 2) throw new Error('The paintings comparison needs two separate works');
  for (const card of paintings.cards) {
    checkWork(card.workId);
    checkSources(card);
    if (!complete([card.heading, card.date, card.record, card.interpretation])) throw new Error('Paintings must separate dating and interpretation');
  }
  if (paintings.cards[0].workId !== 'vgm-s0149v1962' || paintings.cards[1].workId !== 'vgm-s0195v1962'
      || !paintings.cards[1].record.includes('probably')) throw new Error('Retain the qualified Tree Roots record and the Crows comparison');
  const wall = data.wall;
  if (![wall?.width, wall?.height, wall?.centerHeight, wall?.viewDistance].every((value) => Number.isFinite(value) && value > 0)
      || wall.position?.length !== 3 || wall.normal?.length !== 3 || ![...wall.position, ...wall.normal].every(Number.isFinite)
      || Math.abs(Math.hypot(...wall.normal) - 1) > 0.001 || !complete([wall.text, wall.invitation, data.ending?.title, data.ending?.text])) {
    throw new Error('Invalid flush Auvers reading wall or Afterlife transition');
  }
  return { chapters: data.chapters.length, dates: final.timeline.length, accounts: accounts.cards.length, sources: sourceIds.size };
}

