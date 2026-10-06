export const HIGHLIGHT_TOUR_SECONDS = 180;

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

export function retimeHighlightTour(route, duration = HIGHLIGHT_TOUR_SECONDS) {
  const originalDuration = route.duration;
  const waypoints = route.camera.waypoints;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(originalDuration) || originalDuration <= 0
    || Math.abs(waypoints.at(-1).time - originalDuration) > 0.000001) throw new Error('Invalid Highlights tour duration.');
  const scale = duration / originalDuration;
  const retimeStop = (stop) => ({ ...stop, start: stop.start * scale, end: stop.end * scale });
  return {
    ...route,
    duration,
    camera: {
      ...route.camera,
      openingHoldSeconds: route.camera.openingHoldSeconds * scale,
      openingFilmTime: route.camera.openingFilmTime * scale,
      openingFilmStop: retimeStop(route.camera.openingFilmStop),
      introductionStops: route.camera.introductionStops.map(retimeStop),
      exhibitStops: (route.camera.exhibitStops ?? []).map(retimeStop),
      waypoints: waypoints.map((point, index) => ({ ...point, time: index === waypoints.length - 1 ? duration : point.time * scale })),
    },
    artworks: route.artworks.map((entry) => ({ ...entry, approachTime: entry.approachTime * scale, routeTime: entry.routeTime * scale })),
  };
}
