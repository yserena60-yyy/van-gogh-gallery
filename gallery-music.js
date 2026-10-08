import { onLanguageChange, translate } from './i18n.js';

export function createGalleryMusic({ video }) {
  const tracks = [...document.querySelectorAll('audio[data-gallery-track]')].map((audio) => ({
    id: audio.dataset.galleryTrack,
    title: audio.dataset.title,
    source: audio.dataset.source,
    audio,
    gain: 0,
    fadeFrame: null,
    playbackRevision: 0,
    pending: false,
    needsGesture: false,
    failed: false,
  }));
  const controls = document.querySelector('#gallery-music-controls');
  const toggle = document.querySelector('#music-toggle');
  const label = document.querySelector('#music-label');
  const settings = document.querySelector('#music-settings');
  const settingsToggle = document.querySelector('#music-settings-toggle');
  const volume = document.querySelector('#music-volume');
  const volumeValue = document.querySelector('#music-volume-value');
  const status = document.querySelector('#music-status');
  const trackLink = document.querySelector('#music-track-title');
  const filmDialog = document.querySelector('#film-player');
  const storageKey = 'van-gogh-gallery.music.v1';
  const settingsRevision = 2;
  const blockers = new Set(['entry']);
  let current = tracks.find((track) => track.id === 'wildflowers');
  let enabled = true;
  let level = 0.2;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) {
      level = Math.max(0, Math.min(1, saved.volume));
      if ((saved.revision ?? 1) < settingsRevision && level === 0.1) level = 0.2;
    }
  } catch {}
  save();
  for (const track of tracks) {
    track.audio.loop = true;
    track.audio.volume = 0;
  }
  volume.value = String(Math.round(level * 100));

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ revision: settingsRevision, enabled, volume: level })); } catch {}
  }

  function shouldPlay(track = current) {
    return track === current && enabled && level > 0 && blockers.size === 0;
  }

  function applyVolume(track) {
    const { audio } = track;
    const edgeGain = Number.isFinite(audio.duration) && audio.duration > 3
      ? Math.max(0, Math.min(1, audio.currentTime / 1.2, (audio.duration - audio.currentTime) / 1.2))
      : 1;
    audio.volume = Math.max(0, Math.min(1, level * track.gain * edgeGain));
  }

  function render() {
    const { audio, needsGesture, failed } = current;
    const active = enabled && !audio.paused && !blockers.size;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.dataset.playing = String(active);
    const action = needsGesture || failed ? 'Play background music' : enabled ? 'Turn background music off' : 'Turn background music on';
    toggle.setAttribute('aria-label', translate(action));
    toggle.title = translate(action);
    label.textContent = translate(needsGesture || failed ? 'Play music' : enabled ? 'Music on' : 'Music off');
    volumeValue.textContent = `${Math.round(level * 100)}%`;
    volume.setAttribute('aria-valuetext', `${Math.round(level * 100)}%`);
    if (trackLink.textContent !== current.title) {
      trackLink.textContent = current.title;
      trackLink.href = current.source;
    }
    const message = failed ? 'Music unavailable. Try again.'
      : !enabled || level === 0 ? 'Background music is off.'
      : blockers.has('film') || blockers.has('video') ? 'Music pauses while the opening film is open.'
      : needsGesture ? 'Select the music button to start playback.'
      : 'Quiet background music · Your volume is remembered.';
    status.textContent = translate(message);
  }

  function cancelFade(track) {
    if (track.fadeFrame !== null) cancelAnimationFrame(track.fadeFrame);
    track.fadeFrame = null;
  }

  function fadeTo(track, target, duration, onComplete) {
    cancelFade(track);
    const initial = track.gain;
    const started = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      track.gain = initial + (target - initial) * progress;
      applyVolume(track);
      if (progress < 1) track.fadeFrame = requestAnimationFrame(step);
      else { track.fadeFrame = null; onComplete?.(); }
    }
    track.fadeFrame = requestAnimationFrame(step);
  }

  function stopPlayback(track, immediate = true, duration = 300) {
    track.playbackRevision += 1;
    track.pending = false;
    if (!immediate && !track.audio.paused) {
      fadeTo(track, 0, duration, () => { track.audio.pause(); render(); });
    } else {
      cancelFade(track);
      track.gain = 0;
      applyVolume(track);
      track.audio.pause();
    }
    render();
  }

  async function startPlayback(track) {
    if (track.pending) return;
    const revision = ++track.playbackRevision;
    track.pending = true;
    cancelFade(track);
    track.gain = 0;
    applyVolume(track);
    try {
      await track.audio.play();
      if (revision !== track.playbackRevision) {
        if (!shouldPlay(track) && track.fadeFrame === null) track.audio.pause();
        return;
      }
      track.pending = false;
      track.needsGesture = false;
      track.failed = false;
      if (!shouldPlay(track)) track.audio.pause();
      else fadeTo(track, 1, 1600);
    } catch (error) {
      if (revision !== track.playbackRevision) return;
      track.pending = false;
      if (error.name !== 'AbortError') track.needsGesture = true;
    }
    render();
  }

  function sync(immediate = true) {
    for (const track of tracks) {
      if (!shouldPlay(track)) stopPlayback(track, immediate);
      else if (track.audio.paused) void startPlayback(track);
      else if (!track.pending) { fadeTo(track, 1, 500); render(); }
    }
  }

  function setChapter(chapter) {
    const next = tracks.find((track) => track.id === (chapter === '08' ? 'hope' : 'wildflowers'));
    if (next === current) return;
    const previous = current;
    current = next;
    if (shouldPlay()) {
      stopPlayback(previous, false, 1600);
      if (current.audio.paused) void startPlayback(current);
      else if (!current.pending) fadeTo(current, 1, 1600);
      render();
    } else sync();
  }

  function suspend(reason) {
    blockers.add(reason);
    sync();
  }

  function resume(reason) {
    blockers.delete(reason);
    sync();
  }

  function closeSettings() {
    settings.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const retry = current.failed || current.needsGesture;
    if (current.failed) { current.failed = false; current.audio.load(); }
    enabled = retry ? true : !enabled;
    current.needsGesture = false;
    save();
    sync(false);
  });
  settingsToggle.addEventListener('click', () => {
    settings.hidden = !settings.hidden;
    settingsToggle.setAttribute('aria-expanded', String(!settings.hidden));
    if (!settings.hidden) volume.focus({ preventScroll: true });
  });
  volume.addEventListener('input', () => {
    level = Number(volume.value) / 100;
    save();
    for (const track of tracks) applyVolume(track);
    sync();
    render();
  });
  controls.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') event.stopPropagation();
    if (event.key === 'Escape') { closeSettings(); settingsToggle.focus({ preventScroll: true }); }
  });
  for (const type of ['pointerdown', 'pointerup', 'click', 'keyup']) controls.addEventListener(type, (event) => event.stopPropagation());
  document.addEventListener('pointerdown', (event) => { if (!controls.contains(event.target)) closeSettings(); });
  for (const track of tracks) {
    track.audio.addEventListener('timeupdate', () => applyVolume(track));
    track.audio.addEventListener('loadedmetadata', () => applyVolume(track));
    track.audio.addEventListener('play', render);
    track.audio.addEventListener('pause', render);
    track.audio.addEventListener('error', () => { track.failed = true; stopPlayback(track); });
  }
  video.addEventListener('play', () => suspend('video'));
  video.addEventListener('pause', () => resume('video'));
  video.addEventListener('ended', () => resume('video'));
  filmDialog.addEventListener('close', () => resume('film'));
  new MutationObserver(() => {
    if (filmDialog.open) suspend('film'); else resume('film');
  }).observe(filmDialog, { attributes: true, attributeFilter: ['open'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend('hidden'); else resume('hidden');
  });
  if (document.hidden) blockers.add('hidden');
  onLanguageChange(render);
  render();

  return {
    unlock() {
      if (enabled && level > 0) {
        for (const track of tracks) if (track.audio.paused && !track.pending) void startPlayback(track);
      }
    },
    enter() { controls.hidden = false; resume('entry'); },
    suspend,
    setChapter,
  };
}
