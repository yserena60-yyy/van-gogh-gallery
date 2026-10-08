export const HIGHLIGHT_TOUR_SECONDS = 180;
export const FIRST_HALL_TOUR_SECONDS = 32;

export function addFirstHallTourStops(route, station, holdSeconds = 2.6) {
  const camera = route.camera;
  const waypoints = camera.waypoints;
  const duration = waypoints.at(-1).time;
  const artwork = route.artworks.find((entry) => entry.chapter === '01' && entry.title === 'Road in Etten');
  if (!artwork || !Number.isFinite(holdSeconds) || holdSeconds <= 0) throw new Error('Invalid first-hall tour stops.');
  const stops = [
    { id: 'early-life', kind: 'story', title: 'Searching for a Place', time: station.routeTime },
    { id: 'early-drawing', kind: 'artwork', title: artwork.title, slot: artwork.slot, time: artwork.routeTime },
  ];
  const protectedStops = [
    { start: 0, end: camera.openingHoldSeconds },
    camera.openingFilmStop,
    ...camera.introductionStops,
  ];
  const protectedDuration = protectedStops.reduce((total, stop) => total + stop.end - stop.start, 0);
  const movingDuration = duration - protectedDuration;
  const movingScale = (movingDuration - stops.length * holdSeconds) / movingDuration;
  if (movingScale <= 0) throw new Error('Insufficient moving time for the first-hall tour stops.');
  for (const stop of stops) {
    const pose = waypoints.find((point) => Math.abs(point.time - stop.time) < 0.000001);
    if (!pose || protectedStops.some((entry) => stop.time >= entry.start && stop.time <= entry.end)) throw new Error('Invalid viewing station: ' + stop.id);
    stop.pose = pose;
  }
  const retime = (time) => {
    const held = protectedStops.reduce((total, stop) => total + Math.max(0, Math.min(time, stop.end) - stop.start), 0);
    const added = stops.filter((stop) => stop.time < time).length * holdSeconds;
    return held + (time - held) * movingScale + added;
  };
  const exhibitStops = stops.map((stop) => ({
    id: stop.id, kind: stop.kind, title: stop.title, slot: stop.slot,
    start: retime(stop.time), end: retime(stop.time) + holdSeconds,
    position: [...stop.pose.position], target: [...stop.pose.target],
  }));
  const newWaypoints = waypoints.map((point) => ({ ...point, time: retime(point.time) }));
  newWaypoints.push(...stops.map((stop, index) => ({ ...stop.pose, time: exhibitStops[index].end })));
  newWaypoints.sort((first, second) => first.time - second.time);
  newWaypoints.at(-1).time = duration;
  const retimeStop = (stop) => ({ ...stop, start: retime(stop.start), end: retime(stop.end) });
  return {
    ...route,
    camera: {
      ...camera,
      waypoints: newWaypoints,
      introductionStops: camera.introductionStops.map(retimeStop),
      openingFilmStop: retimeStop(camera.openingFilmStop),
      openingFilmTime: retime(camera.openingFilmTime),
      exhibitStops,
    },
    artworks: route.artworks.map((entry) => {
      const stop = exhibitStops.find((item) => item.slot === entry.slot);
      return { ...entry, approachTime: retime(entry.approachTime), routeTime: stop ? (stop.start + stop.end) / 2 : retime(entry.routeTime) };
    }),
  };
}

export function addAfterlifeTourSegment(route, afterlife, auvers) {
  const lastArtwork = route.artworks.at(-1);
  const wall = afterlife?.wall;
  const readingWall = auvers?.wall;
  const sourceWaypoints = route.camera.waypoints;
  const viewingPosition = lastArtwork?.tourViewpoint ?? lastArtwork?.viewpoint;
  const viewingTarget = lastArtwork?.tourViewTarget ?? lastArtwork?.viewTarget;
  if (lastArtwork?.chapter !== '07' || !Number.isFinite(lastArtwork.routeTime) || lastArtwork.routeTime <= 0 || lastArtwork.routeTime >= route.duration
    || afterlife?.gallery !== '08' || wall.position?.length !== 3 || wall.normal?.length !== 3
    || !Number.isFinite(wall.overviewDistance) || wall.overviewDistance <= 0
    || !Array.isArray(afterlife.arrivalPath) || afterlife.arrivalPath.length < 2
    || afterlife.arrivalPath.some((point) => point.length !== 3 || !point.every(Number.isFinite))
    || [viewingPosition, viewingTarget, lastArtwork.approach, readingWall?.position, readingWall?.normal].some((point) => point?.length !== 3 || !point.every(Number.isFinite))
    || !Number.isFinite(readingWall.viewDistance) || readingWall.viewDistance <= 0
    || Math.abs(Math.hypot(...readingWall.normal) - 1) > 0.001) throw new Error('Invalid Afterlife tour segment.');
  const distance = (first, second) => Math.hypot(first[0] - second[0], first[2] - second[2]);
  const precedingTime = route.artworks.at(-2)?.routeTime ?? 0;
  const candidates = sourceWaypoints.filter((point) => point.time > precedingTime && point.time < lastArtwork.routeTime);
  if (!candidates.length) throw new Error('The final artwork must lie within the Highlights route.');
  const splice = candidates.reduce((nearest, point) => distance(point.position, lastArtwork.approach) < distance(nearest.position, lastArtwork.approach) ? point : nearest);
  const waypoints = sourceWaypoints.filter((point) => point.time <= splice.time).map((point) => ({ ...point }));
  let time = splice.time;
  const heading = (position, target) => Math.atan2(target[2] - position[2], target[0] - position[0]);
  const angleDifference = (first, second) => Math.atan2(Math.sin(second - first), Math.cos(second - first));
  const facing = (position, angle) => [position[0] + Math.cos(angle) * 8, route.eyeHeight, position[2] + Math.sin(angle) * 8];
  const move = (position, target, chapter, ease = true) => {
    const previous = waypoints.at(-1);
    const fromAngle = heading(previous.position, previous.target);
    const turn = angleDifference(fromAngle, heading(position, target));
    const duration = Math.max(0.8, distance(previous.position, position) / 3.2, Math.abs(turn));
    const start = time;
    for (let index = 1; index <= 16; index += 1) {
      const fraction = index / 16;
      const progress = ease ? fraction * fraction * (3 - 2 * fraction) : fraction;
      const location = previous.position.map((value, axis) => value + (position[axis] - value) * progress);
      waypoints.push({ time: start + duration * fraction, position: location,
        target: index === 16 ? [...target] : facing(location, fromAngle + turn * progress), chapter });
    }
    time = start + duration;
  };
  move(viewingPosition, viewingTarget, '07');
  const finalArtworkStop = { id: 'final-artwork', kind: 'artwork', title: lastArtwork.title, slot: lastArtwork.slot,
    start: time, end: time + 1.2, position: [...viewingPosition], target: [...viewingTarget] };
  time = finalArtworkStop.end;
  waypoints.push({ time, position: [...viewingPosition], target: [...viewingTarget], chapter: '07' });
  const readingNormalLength = Math.hypot(...readingWall.normal);
  const readingTarget = [readingWall.position[0], route.eyeHeight, readingWall.position[2]];
  const readingPosition = readingTarget.map((value, axis) => value + readingWall.normal[axis] / readingNormalLength * readingWall.viewDistance);
  move(readingPosition, readingTarget, '07');
  const reading = { id: 'final-days', kind: 'reading', readerId: 'auvers:final-days', title: 'The Final Days',
    start: time, end: time + 3.6, position: [...readingPosition], target: [...readingTarget] };
  time = reading.end;
  waypoints.push({ time, position: [...readingPosition], target: [...readingTarget], chapter: '07' });
  const bend = afterlife.arrivalPath[0];
  const doorway = [afterlife.arrivalPath[1][0], route.eyeHeight, afterlife.arrivalPath[1][2]];
  const controls = [readingPosition, [bend[0], route.eyeHeight, readingPosition[2]], [doorway[0], route.eyeHeight, bend[2]], doorway];
  move(readingPosition, facing(readingPosition, heading(controls[0], controls[1])), '07');
  for (let index = 1; index <= 32; index += 1) {
    const fraction = index / 32;
    const inverse = 1 - fraction;
    const weights = [inverse ** 3, 3 * inverse ** 2 * fraction, 3 * inverse * fraction ** 2, fraction ** 3];
    const location = controls[0].map((value, axis) => controls.reduce((sum, point, control) => sum + point[axis] * weights[control], 0));
    const tangent = controls[0].map((value, axis) => 3 * inverse ** 2 * (controls[1][axis] - value)
      + 6 * inverse * fraction * (controls[2][axis] - controls[1][axis]) + 3 * fraction ** 2 * (controls[3][axis] - controls[2][axis]));
    const angle = Math.atan2(tangent[2], tangent[0]);
    const previous = waypoints.at(-1);
    time += Math.max(distance(previous.position, location) / 3.2, Math.abs(angleDifference(heading(previous.position, previous.target), angle)));
    waypoints.push({ time, position: location, target: facing(location, angle), chapter: location[2] < 45 ? '07' : '08' });
  }
  const target = wall.position.map((value, axis) => axis === 1 ? route.eyeHeight : value + wall.normal[axis] * wall.inset);
  const position = target.map((value, axis) => value + wall.normal[axis] * wall.overviewDistance);
  for (const location of [...afterlife.arrivalPath.slice(2).map((point) => [point[0], route.eyeHeight, point[2]]), position]) {
    move(location, location.map((value, axis) => value - wall.normal[axis] * wall.overviewDistance), '08', location === position);
  }
  waypoints.at(-1).target = [...target];
  const introduction = { id: '08', title: afterlife.title, start: time, end: time + 3.2, position: [...position], target: [...target] };
  time = introduction.end;
  waypoints.push({ time, position: [...position], target: [...target], chapter: '08' });
  const exhibit = { id: 'afterlife-overview', kind: 'afterlife', title: afterlife.title, start: time, end: time + 4.5, position: [...position], target: [...target] };
  time = exhibit.end;
  waypoints.push({ time, position: [...position], target: [...target], chapter: '08' });
  return {
    ...route,
    duration: time,
    camera: {
      ...route.camera,
      waypoints,
      introductionStops: [...route.camera.introductionStops, introduction],
      exhibitStops: [...(route.camera.exhibitStops ?? []), finalArtworkStop, reading, exhibit],
      routeLengthMetres: waypoints.reduce((length, point, index) => index === 0 ? length : length + Math.hypot(...point.position.map((value, axis) => value - waypoints[index - 1].position[axis])), 0),
    },
    artworks: route.artworks.map((entry) => entry === lastArtwork ? { ...entry, approachTime: splice.time, routeTime: (finalArtworkStop.start + finalArtworkStop.end) / 2 } : entry),
  };
}

export function retimeHighlightTour(route, duration = HIGHLIGHT_TOUR_SECONDS) {
  const originalDuration = route.duration;
  const waypoints = route.camera.waypoints;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(originalDuration) || originalDuration <= 0
    || Math.abs(waypoints.at(-1).time - originalDuration) > 0.000001) throw new Error('Invalid Highlights tour duration.');
  const firstHallEnd = waypoints.find((point) => point.chapter === '02')?.time;
  if (!Number.isFinite(firstHallEnd) || firstHallEnd <= 0 || firstHallEnd >= originalDuration) throw new Error('Invalid first-hall boundary.');
  const scale = duration / HIGHLIGHT_TOUR_SECONDS;
  const firstHallDuration = FIRST_HALL_TOUR_SECONDS * scale;
  const stops = [
    { start: 0, end: route.camera.openingHoldSeconds, duration: 1.2 * scale },
    { ...route.camera.openingFilmStop, duration: 2.8 * scale },
    ...route.camera.introductionStops.filter((stop) => stop.id === '01').map((stop) => ({ ...stop, duration: 4 * scale })),
    ...(route.camera.exhibitStops ?? []).filter((stop) => stop.end <= firstHallEnd).map((stop) => ({ ...stop, duration: (stop.kind === 'story' ? 3.8 : 4.2) * scale })),
  ].sort((first, second) => first.start - second.start);
  if (stops.some((stop, index) => stop.end <= stop.start || stop.start < 0 || stop.end > firstHallEnd
    || (index > 0 && stop.start < stops[index - 1].end))) throw new Error('Invalid first-hall pause intervals.');
  const heldDuration = stops.reduce((total, stop) => total + stop.end - stop.start, 0);
  const newHeldDuration = stops.reduce((total, stop) => total + stop.duration, 0);
  const movingScale = (firstHallDuration - newHeldDuration) / (firstHallEnd - heldDuration);
  const laterScale = (duration - firstHallDuration) / (originalDuration - firstHallEnd);
  if (!Number.isFinite(movingScale) || movingScale <= 0) throw new Error('Insufficient first-hall moving time.');
  const retime = (time) => {
    if (time >= firstHallEnd) return firstHallDuration + (time - firstHallEnd) * laterScale;
    let held = 0;
    let newHeld = 0;
    for (const stop of stops) {
      const elapsed = Math.max(0, Math.min(time, stop.end) - stop.start);
      held += elapsed;
      newHeld += elapsed * stop.duration / (stop.end - stop.start);
    }
    return newHeld + (time - held) * movingScale;
  };
  const retimeStop = (stop) => ({ ...stop, start: retime(stop.start), end: retime(stop.end) });
  return {
    ...route,
    duration,
    camera: {
      ...route.camera,
      openingHoldSeconds: retime(route.camera.openingHoldSeconds),
      openingFilmTime: retime(route.camera.openingFilmTime),
      openingFilmStop: retimeStop(route.camera.openingFilmStop),
      introductionStops: route.camera.introductionStops.map(retimeStop),
      exhibitStops: (route.camera.exhibitStops ?? []).map(retimeStop),
      waypoints: waypoints.map((point, index) => ({ ...point, time: index === waypoints.length - 1 ? duration : retime(point.time) })),
    },
    artworks: route.artworks.map((entry) => ({ ...entry, approachTime: retime(entry.approachTime), routeTime: retime(entry.routeTime) })),
  };
}
