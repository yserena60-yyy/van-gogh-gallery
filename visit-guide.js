export const VISIT_GUIDE_STORAGE_KEY = 'van-gogh-gallery.visit-guide.v1';

export function readVisitGuideState(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(VISIT_GUIDE_STORAGE_KEY) ?? 'null');
    return { started: saved?.started === true, seen: new Set(Array.isArray(saved?.seen) ? saved.seen.filter((id) => typeof id === 'string') : []) };
  } catch {
    return { started: false, seen: new Set() };
  }
}

export function visitGuidance(context) {
  if (context.playing) return {
    id: context.mode === 'collection' ? 'collection-tour' : 'highlights-tour',
    label: 'THE CAMERA LEADS THE WAY',
    title: context.mode === 'collection' ? 'You are on the Full collection tour' : 'You are on the 3-minute Highlights tour',
    text: 'Use Pause whenever you want to stop. Click a painting to enlarge it and read its story; opening a work pauses the tour.',
    target: '#tour-toggle',
  };
  if (context.freePending) return {
    id: 'free', label: 'EXPLORE AT YOUR OWN PACE', title: 'Look around, then choose a work',
    text: 'Drag to look; scroll or pinch to move closer. Click a painting to open it. Previous and Next lead you between works without walking.',
  };
  if (context.afterlife) return {
    id: 'afterlife', label: 'HALL 08 · EPILOGUE', title: 'Follow the story beyond Vincent’s lifetime',
    text: 'Use the highlighted reading button to open the Afterlife story. Closing reflection takes you to the final question; close a story to return to the gallery.',
    target: '#afterlife-read',
  };
  if (context.introduction) return {
    id: 'introduction', label: 'A NEW CHAPTER', title: 'Begin with this hall’s introduction',
    text: 'Read this introduction opens the room’s story. Then use the forward button to continue through the hall.',
    target: '#hall-intro-toggle',
  };
  if (context.story) return {
    id: 'early-life', label: 'HALL 01 · SEARCHING FOR A PLACE', title: 'Four chapters, read in your own time',
    text: 'Searching for a Place opens London, faith, the miners and learning to draw. Early Works takes you back to the drawings.',
    target: '#story-explore',
  };
  if (context.atFilm) return {
    id: 'film', label: 'HALL 01 · OPENING FILM', title: 'Start with the screen in front of you',
    text: 'Click the play symbol on the screen to watch the film. Or use Play below to begin the 3-minute Highlights tour.',
    target: '#tour-toggle',
  };
  if (['04', '05'].includes(context.chapter)) return {
    id: 'yellow-house', label: 'ARLES · THE YELLOW HOUSE', title: 'A home, a studio and a friendship',
    text: 'The Yellow House opens the story of Vincent and Gauguin. Read at your own pace, then close it to return to this gallery view.',
    target: '#yellow-house-go',
  };
  if (context.artwork) return {
    id: 'artwork', label: 'LOOK CLOSER', title: 'The paintings open into stories',
    text: 'Click a painting to enlarge it and read its story. Previous and Next inside the viewer move between works; closing returns you here.',
  };
  if (context.chapter === '01') return {
    id: 'start', label: 'YOUR NEXT STEP', title: 'A guided visit, or a story of your choosing',
    text: 'Play starts the Highlights tour. Early life takes you to the first hall’s stories; the other story buttons remain available throughout your visit.',
    target: '#tour-toggle',
  };
  return {
    id: 'free', label: 'EXPLORE AT YOUR OWN PACE', title: 'You can always choose what comes next',
    text: 'Use Previous and Next to follow the works, or open Eight Halls · Catalogue to choose a hall or painting. The question mark reopens this guide.',
    target: '#visit-help-toggle',
  };
}

export function createVisitGuide({ onTour, onFree, onHelpOpen, onLayout, ownerDocument = document, storage }) {
  if (!storage) {
    try { storage = globalThis.localStorage; } catch {}
  }
  const state = readVisitGuideState(storage);
  const welcome = ownerDocument.querySelector('#visit-welcome');
  const hint = ownerDocument.querySelector('#visit-hint');
  const help = ownerDocument.querySelector('#visit-help');
  const helpButton = ownerDocument.querySelector('#visit-help-toggle');
  const label = ownerDocument.querySelector('#visit-hint-label');
  const title = ownerDocument.querySelector('#visit-hint-title');
  const text = ownerDocument.querySelector('#visit-hint-text');
  let context = { ready: false, blocked: true };
  let welcomeRequested = false;
  let freePending = false;
  let current = null;
  let cue = null;
  let previousFocus = null;
  let lastLayout = '';

  function save() {
    try { storage?.setItem(VISIT_GUIDE_STORAGE_KEY, JSON.stringify({ started: state.started, seen: [...state.seen] })); } catch {}
  }

  function clearCue() {
    cue?.classList.remove('visit-cue');
    cue = null;
  }

  function refresh() {
    const blocked = !context.ready || context.blocked || help.open;
    if (helpButton.disabled !== !context.ready) helpButton.disabled = !context.ready;
    const hideWelcome = blocked || !welcomeRequested || state.started;
    if (welcome.hidden !== hideWelcome) welcome.hidden = hideWelcome;
    const guidance = visitGuidance({ ...context, freePending });
    if (current?.id !== guidance.id) {
      if (current && !hint.hidden) { state.seen.add(current.id); save(); }
      current = guidance;
      label.textContent = guidance.label;
      title.textContent = guidance.title;
      text.textContent = guidance.text;
    }
    const hideHint = blocked || !welcome.hidden || state.seen.has(guidance.id);
    if (hint.hidden !== hideHint) hint.hidden = hideHint;
    const nextCue = !hint.hidden && guidance.target ? ownerDocument.querySelector(guidance.target) : null;
    if (cue !== nextCue) {
      clearCue();
      cue = nextCue;
      cue?.classList.add('visit-cue');
    }
    const layout = [welcome.hidden, hint.hidden, guidance.id].join(':');
    if (layout !== lastLayout) {
      lastLayout = layout;
      onLayout?.();
    }
  }

  function finishWelcome() {
    welcomeRequested = false;
    if (!state.started) { state.started = true; save(); }
  }

  function closeHelp() {
    if (help.open) help.close();
  }

  async function startTour() {
    finishWelcome();
    freePending = false;
    closeHelp();
    await onTour();
    refresh();
  }

  function exploreFreely() {
    finishWelcome();
    freePending = true;
    closeHelp();
    onFree();
    refresh();
  }

  function recordAction(action) {
    finishWelcome();
    if (action !== 'begin-tour') freePending = false;
    const related = {
      move: ['free', 'start'], artwork: ['artwork', 'highlights-tour', 'collection-tour'],
      'tour-pause': ['highlights-tour', 'collection-tour'], 'early-life': ['early-life', 'start'],
      'yellow-house': ['yellow-house'], afterlife: ['afterlife'], introduction: ['introduction'],
    };
    const unseen = (related[action] ?? []).filter((id) => !state.seen.has(id));
    for (const id of unseen) state.seen.add(id);
    if (unseen.length) save();
    refresh();
  }

  helpButton.addEventListener('click', () => {
    if (help.open || !context.ready) return;
    previousFocus = ownerDocument.activeElement;
    onHelpOpen();
    help.showModal();
    helpButton.setAttribute('aria-expanded', 'true');
    refresh();
    ownerDocument.querySelector('#visit-help-close').focus({ preventScroll: true });
  });
  help.addEventListener('close', () => {
    helpButton.setAttribute('aria-expanded', 'false');
    refresh();
    const focus = previousFocus?.isConnected ? previousFocus : helpButton;
    focus.focus({ preventScroll: true });
    previousFocus = null;
  });
  help.addEventListener('click', (event) => { if (event.target === help) closeHelp(); });
  ownerDocument.querySelector('#visit-help-close').addEventListener('click', closeHelp);
  ownerDocument.querySelector('#visit-welcome-close').addEventListener('click', () => {
    state.seen.add('start');
    state.seen.add('film');
    finishWelcome();
    refresh();
  });
  ownerDocument.querySelector('#visit-hint-dismiss').addEventListener('click', () => {
    state.seen.add(current.id);
    save();
    refresh();
  });
  for (const button of ownerDocument.querySelectorAll('[data-visit-action="tour"]')) button.addEventListener('click', startTour);
  for (const button of ownerDocument.querySelectorAll('[data-visit-action="free"]')) button.addEventListener('click', exploreFreely);
  return {
    update(next) { context = next; refresh(); },
    offerWelcome() { welcomeRequested = !state.started; refresh(); },
    recordAction, startTour,
    isHelpOpen: () => help.open,
  };
}
