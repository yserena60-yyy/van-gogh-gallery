export function createCollectionTour({ order, visit, onChange = () => {}, holdSeconds = 8 }) {
  if (typeof order !== 'function' || typeof visit !== 'function') throw new TypeError('A collection order and visit function are required');
  if (!Number.isFinite(holdSeconds) || holdSeconds <= 0) throw new RangeError('Invalid viewing time');
  let index = -1;
  let playing = false;
  let phase = 'idle';
  let remaining = holdSeconds;
  let message = '';
  let revision = 0;
  let pending = null;

  function state() {
    return { index, playing, phase, remaining, holdSeconds, message, total: order().length };
  }

  function notify() {
    onChange(state());
  }

  async function arrive(nextIndex, autoplay) {
    const works = order();
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= works.length) return false;
    const ticket = ++revision;
    index = nextIndex;
    playing = autoplay;
    phase = 'loading';
    remaining = holdSeconds;
    message = '';
    const isCurrent = () => ticket === revision;
    notify();
    try {
      const arrived = await visit(works[index], {
        isCurrent,
        onPhase(nextPhase) {
          if (!isCurrent()) return;
          if (nextPhase === 'loading' || nextPhase === 'moving') phase = nextPhase;
          notify();
        },
      });
      if (!isCurrent()) return false;
      if (!arrived) throw new Error('The next artwork could not be loaded');
      phase = 'holding';
      remaining = holdSeconds;
      notify();
      return true;
    } catch (cause) {
      if (!isCurrent()) return false;
      playing = false;
      phase = 'error';
      message = 'Artwork images could not load. The previous walls are unchanged. Press Retry to continue.';
      notify();
      return false;
    } finally {
      if (isCurrent()) pending = null;
    }
  }

  function pause() {
    playing = false;
    if (phase === 'loading' || phase === 'moving') {
      revision += 1;
      pending = null;
      phase = 'paused';
    }
    notify();
  }

  function play() {
    if (!order().length) return Promise.resolve(false);
    if (playing) return pending ?? Promise.resolve(true);
    playing = true;
    if (phase === 'holding') {
      notify();
      return Promise.resolve(true);
    }
    if ((phase === 'loading' || phase === 'moving') && pending) {
      notify();
      return pending;
    }
    pending = arrive(phase === 'complete' || index < 0 ? 0 : index, true);
    return pending;
  }

  function seek(nextIndex) {
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= order().length) return Promise.resolve(false);
    pending = arrive(nextIndex, false);
    return pending;
  }

  function adopt(nextIndex) {
    revision += 1;
    pending = null;
    playing = false;
    index = Number.isInteger(nextIndex) && nextIndex >= 0 && nextIndex < order().length ? nextIndex : -1;
    phase = index < 0 ? 'idle' : 'holding';
    remaining = holdSeconds;
    message = '';
    notify();
  }

  function setHold(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('Invalid viewing time');
    holdSeconds = seconds;
    remaining = seconds;
    notify();
  }

  function tick(delta) {
    if (!playing || phase !== 'holding' || !Number.isFinite(delta) || delta <= 0) return;
    const previousSeconds = Math.ceil(remaining);
    remaining = Math.max(0, remaining - Math.min(delta, 0.1));
    if (remaining > 0.000001) {
      if (Math.ceil(remaining) !== previousSeconds) notify();
      return;
    }
    if (index === order().length - 1) {
      remaining = 0;
      playing = false;
      phase = 'complete';
      notify();
      return;
    }
    pending = arrive(index + 1, true);
    return pending;
  }

  return { state, play, pause, seek, adopt, setHold, tick };
}
