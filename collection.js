export function fitPainting(aspect, maximumWidth = 3.65, maximumHeight = 2.8, area = 6.65) {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Invalid painting aspect ratio');
  const width = Math.sqrt(area * aspect);
  const height = width / aspect;
  const scale = Math.min(1, maximumWidth / width, maximumHeight / height);
  return { width: width * scale, height: height * scale };
}

export function locateWork(collection, id) {
  for (const hall of collection.halls) {
    for (const [page, works] of hall.pages.entries()) {
      const index = works.indexOf(id);
      if (index !== -1) return { hall: hall.id, page, slot: hall.slots[index] };
    }
  }
  return null;
}

export function readingOrder(collection) {
  return collection.halls.flatMap((hall) => hall.pages.flat());
}

export function validateCollection(collection) {
  const seen = new Set();
  for (const hall of collection.halls) {
    if (!hall.slots.length || !hall.pages.length) throw new Error(`No wall sets in Hall ${hall.id}`);
    for (const page of hall.pages) {
      if (!page.length || page.length > hall.slots.length) throw new Error(`Invalid wall set in Hall ${hall.id}`);
      for (const id of page) {
        if (seen.has(id)) throw new Error(`Work installed twice: ${id}`);
        seen.add(id);
        const work = collection.works[id];
        if (!work?.image || !work.source || work.hall !== hall.id) throw new Error(`Incomplete work: ${id}`);
      }
    }
  }
  if (seen.size !== Object.keys(collection.works).length) throw new Error('Some works are not installed');
  return seen.size;
}
