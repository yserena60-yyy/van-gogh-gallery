export function createGalleryEntry({ onBegin }) {
  const dialog = document.querySelector('#gallery-entry');
  const panel = document.querySelector('#entry-panel');
  const start = document.querySelector('#entry-start');
  const quote = document.querySelector('#entry-quote');
  const hall = document.querySelector('#entry-hall');
  const skip = document.querySelector('#entry-skip');
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
    completed = true;
    sequence += 1;
    window.clearTimeout(timer);
    animation?.cancel();
    releaseWait?.();
    releaseWait = null;
    dialog.close();
    onBegin({ playFilm });
  }

  async function begin() {
    if (!ready || running || completed) return;
    running = true;
    const token = ++sequence;
    start.disabled = true;
    if (!await fade(1, 0, 550) || token !== sequence) return;
    start.hidden = true;
    quote.hidden = false;
    dialog.setAttribute('aria-label', 'We know who he would become. As you enter, set that knowledge aside.');
    dialog.removeAttribute('aria-labelledby');
    skip.focus({ preventScroll: true });
    if (!await fade(0, 1, 800) || token !== sequence) return;
    await hold(4600);
    if (token !== sequence || !await fade(1, 0, 1100)) return;
    if (token !== sequence) return;
    quote.hidden = true;
    hall.hidden = false;
    dialog.setAttribute('aria-label', 'Hall 01: Origins and Uncertainty');
    if (!await fade(0, 1, 750) || token !== sequence) return;
    await hold(2500);
    if (token !== sequence || !await fade(1, 0, 900)) return;
    if (token === sequence) enter(true);
  }

  start.addEventListener('click', begin);
  document.querySelector('#entry-watch').addEventListener('click', () => enter(true));
  skip.addEventListener('click', () => enter(false));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); enter(false); });
  dialog.addEventListener('click', (event) => {
    if (ready && !running && event.target !== skip) begin();
  });
  dialog.showModal();
  return {
    setReady() {
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
      dialog.close();
    },
    isOpen: () => dialog.open,
  };
}
