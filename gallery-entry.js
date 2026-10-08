export function createGalleryEntry({ onBegin, onStart }) {
  const dialog = document.querySelector('#gallery-entry');
  const panel = document.querySelector('#entry-panel');
  const start = document.querySelector('#entry-start');
  const prologue = document.querySelector('#entry-prologue');
  const quote = document.querySelector('#entry-quote');
  const skip = document.querySelector('#entry-skip');
  const viewer = document.querySelector('#viewer');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ready = false;
  let running = false;
  let completed = false;
  let sequence = 0;
  let timer = null;
  let animation = null;
  let releaseWait = null;

  async function fade(from, to, duration) {
    animation = panel.animate([{ opacity: from }, { opacity: to }], {
      duration: reduced.matches ? 0 : duration, easing: 'ease-in-out', fill: 'forwards',
    });
    try { await animation.finished; } catch { return false; }
    return true;
  }

  function hold(duration) {
    return new Promise((resolve) => {
      releaseWait = resolve;
      timer = window.setTimeout(() => { releaseWait = null; resolve(); }, duration);
    });
  }

  function enter(playFilm) {
    if (!ready || completed) return;
    if (!running) onStart?.();
    completed = true;
    sequence += 1;
    window.clearTimeout(timer);
    animation?.cancel();
    releaseWait?.();
    releaseWait = null;
    dialog.dataset.stage = 'complete';
    viewer.classList.remove('entry-view');
    dialog.close();
    onBegin({ playFilm });
  }

  async function begin() {
    if (!ready || running || completed) return;
    running = true;
    onStart?.();
    const token = ++sequence;
    start.disabled = true;
    if (!await fade(1, 0, 550) || token !== sequence) return;
    start.hidden = true;
    prologue.hidden = false;
    dialog.dataset.stage = 'prologue';
    dialog.setAttribute('aria-labelledby', 'entry-prologue-text');
    dialog.setAttribute('aria-describedby', 'entry-prologue-note');
    skip.focus({ preventScroll: true });
    if (!await fade(0, 1, 750) || token !== sequence) return;
    await hold(4000);
    if (token !== sequence || !await fade(1, 0, 900)) return;
    if (token !== sequence) return;
    prologue.hidden = true;
    quote.hidden = false;
    dialog.dataset.stage = 'reflection';
    dialog.setAttribute('aria-labelledby', 'entry-quote');
    dialog.removeAttribute('aria-describedby');
    if (!await fade(0, 1, 750) || token !== sequence) return;
    await hold(4000);
    if (token !== sequence || !await fade(1, 0, 1100)) return;
    if (token === sequence) enter(true);
  }

  start.addEventListener('click', begin);
  skip.addEventListener('click', () => enter(false));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); enter(false); });
  dialog.addEventListener('click', (event) => {
    const control = event.target.closest('button, a, input, select, textarea, #language-switch');
    if (!control || control === start) begin();
  });
  dialog.dataset.stage = 'title';
  viewer.classList.add('entry-view');
  if (dialog.open) dialog.close();
  dialog.showModal();
  return {
    setReady() {
      if (ready || completed) return;
      ready = true;
      start.disabled = false;
      skip.disabled = false;
      document.querySelector('#entry-prompt').textContent = 'Click anywhere to enter · or press Enter';
      start.focus({ preventScroll: true });
    },
    fail() {
      completed = true;
      sequence += 1;
      window.clearTimeout(timer);
      animation?.cancel();
      releaseWait?.();
      releaseWait = null;
      dialog.dataset.stage = 'failed';
      viewer.classList.remove('entry-view');
      dialog.close();
    },
    isOpen: () => dialog.open,
  };
}
