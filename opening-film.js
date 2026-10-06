import * as THREE from 'three';
import { currentLanguage, onLanguageChange, translate } from './i18n.js';

export function createFilmExpansion({ dialog, panel, button, status, ownerDocument = dialog.ownerDocument }) {
  let expanded = false;
  let nativeActive = false;
  let requesting = false;
  let statusBeforeExpansion = null;
  let expansionStatus = '';
  const isNative = () => ownerDocument.fullscreenElement === panel;

  function setExpansionStatus(message) {
    expansionStatus = message;
    status.textContent = message;
  }

  function restoreStatus() {
    if (statusBeforeExpansion !== null && status.textContent === expansionStatus) status.textContent = statusBeforeExpansion;
    statusBeforeExpansion = null;
    expansionStatus = '';
  }

  function reflect() {
    dialog.classList.toggle('film-player-expanded', expanded);
    button.dataset.expanded = String(expanded);
    button.setAttribute('aria-pressed', String(expanded));
    const label = expanded ? (isNative() ? 'Exit full screen' : 'Restore film size') : 'Full screen';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  async function exitNative() {
    if (!isNative()) return;
    try {
      await ownerDocument.exitFullscreen();
    } catch {
      if (dialog.open && isNative()) {
        expanded = true;
        statusBeforeExpansion = status.textContent;
        reflect();
        setExpansionStatus('Press Escape to leave full screen.');
      }
    }
  }

  function collapse() {
    expanded = false;
    reflect();
    restoreStatus();
    return exitNative();
  }

  async function toggle() {
    if (expanded || isNative()) return collapse();
    if (!dialog.open) return;
    statusBeforeExpansion = status.textContent;
    expanded = true;
    reflect();
    setExpansionStatus('Expanded view · Press Escape or the resize icon to return.');
    if (requesting || ownerDocument.fullscreenEnabled === false || !panel.requestFullscreen) return;
    requesting = true;
    try {
      await panel.requestFullscreen();
      if (!dialog.open || !expanded) await exitNative();
      else {
        nativeActive = isNative();
        reflect();
      }
    } catch {
      if (dialog.open && expanded) setExpansionStatus('Expanded to this window · Press Escape or the resize icon to return.');
    } finally {
      requesting = false;
    }
  }

  ownerDocument.addEventListener('fullscreenchange', () => {
    if (isNative()) {
      if (!dialog.open || !expanded) {
        void exitNative();
        return;
      }
      nativeActive = true;
    } else if (nativeActive) {
      nativeActive = false;
      expanded = false;
      restoreStatus();
    }
    reflect();
  });
  button.addEventListener('click', toggle);
  dialog.addEventListener('close', collapse);
  reflect();
  return { toggle, collapse, isExpanded: () => expanded || isNative() };
}

export function createOpeningFilm({ viewer, renderer, scene, camera, screen, placeholder, pickMeshes, onOpen, onExplore, onWorks, onTour, onCollection, onReturn }) {
  const video = document.querySelector('#opening-film');
  const dialog = document.querySelector('#film-player');
  const closeButton = document.querySelector('#film-close');
  const controls = document.querySelector('.film-controls');
  const playButton = document.querySelector('#film-toggle');
  const playLabel = document.querySelector('#film-label');
  const status = document.querySelector('#film-status');
  const playerStatus = document.querySelector('#film-player-status');
  const playerToggle = document.querySelector('#film-player-toggle');
  const seek = document.querySelector('#film-seek');
  const seekTime = document.querySelector('#film-seek-time');
  const muteButton = document.querySelector('#film-player-mute');
  const fullscreenButton = document.querySelector('#film-player-fullscreen');
  const expansion = createFilmExpansion({ dialog, panel: dialog.querySelector('.film-player-panel'), button: fullscreenButton, status: playerStatus });
  const titleElement = document.querySelector('#film-player-title');
  const replayButton = document.querySelector('#film-replay');
  const complete = document.querySelector('#film-complete');
  const nextTitle = document.querySelector('#film-next-title');
  const exploreButton = document.querySelector('#film-explore');
  const toolbar = document.querySelector('.toolbar');
  const masthead = document.querySelector('.masthead');
  const selectionRay = new THREE.Raycaster();
  const poster = document.createElement('canvas');
  poster.width = 1600;
  poster.height = 900;
  const posterContext = poster.getContext('2d');
  const posterTexture = new THREE.CanvasTexture(poster);
  posterTexture.colorSpace = THREE.SRGBColorSpace;
  posterTexture.flipY = false;
  posterTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const portrait = new Image();
  let title = 'The Early Years';
  let previousFocus = null;
  let closeReason = 'return';
  let failed = false;
  let lastView = { available: false, blocked: false };
  let lastLayout = '';
  let lastVisibilityCheck = -Infinity;
  let screenVisible = false;
  const visibilityPosition = new THREE.Vector3();
  const visibilityRotation = new THREE.Quaternion();
  const intersections = [];
  const projectedPoint = new THREE.Vector3();
  let seeking = false;
  let resumeAfterSeek = false;
  let seekTarget = 0;
  let pendingSeek = null;

  function setCompletion(completed) {
    dialog.dataset.complete = String(completed);
    nextTitle.hidden = !completed;
    complete.hidden = !completed;
    dialog.setAttribute('aria-describedby', completed ? 'film-next-title film-complete' : 'film-player-status');
  }

  function showCompletion() {
    if (!dialog.open) return;
    resetSeek();
    void expansion.collapse();
    setCompletion(true);
    playerStatus.textContent = 'Film complete · Choose your next step.';
    updateLabel();
    updateSeek();
    nextTitle.focus({ preventScroll: true });
  }

  function timeLabel(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function updateSeek() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.max = String(duration);
    seek.disabled = duration <= 0 || failed;
    const position = seeking ? seekTarget : pendingSeek ?? video.currentTime;
    seek.value = String(Number.isFinite(position) ? position : 0);
    seekTime.textContent = `${timeLabel(position)} / ${timeLabel(duration)}`;
    seek.setAttribute('aria-valuetext', `${timeLabel(position)} of ${timeLabel(duration)}`);
    const playing = seeking || pendingSeek !== null ? resumeAfterSeek : !video.paused;
    playerToggle.dataset.playing = String(playing);
    playerToggle.disabled = seeking || pendingSeek !== null;
    playerToggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} opening film`);
    playerToggle.title = playing ? 'Pause' : 'Play';
    const muted = video.muted || video.volume === 0;
    muteButton.dataset.muted = String(muted);
    muteButton.setAttribute('aria-label', `${muted ? 'Unmute' : 'Mute'} opening film`);
    muteButton.title = muted ? 'Unmute' : 'Mute';
  }

  function beginSeek() {
    if (seeking || seek.disabled) return;
    resumeAfterSeek = pendingSeek !== null ? resumeAfterSeek : !video.paused;
    seekTarget = Number(seek.value);
    pendingSeek = null;
    seeking = true;
    video.pause();
  }

  function finishSeek() {
    if (!seeking) return;
    pendingSeek = Math.max(0, Math.min(seekTarget, video.duration));
    seeking = false;
    setCompletion(false);
    video.currentTime = pendingSeek;
    updateSeek();
    settleSeek();
  }

  function settleSeek() {
    if (seeking || pendingSeek === null || video.seeking || Math.abs(video.currentTime - pendingSeek) > 0.2) return;
    const resume = resumeAfterSeek;
    pendingSeek = null;
    resumeAfterSeek = false;
    updateSeek();
    if (video.ended) showCompletion();
    else if (resume && dialog.open) resumeFilm();
  }

  function resetSeek() {
    seeking = false;
    pendingSeek = null;
    resumeAfterSeek = false;
  }

  video.controls = false;
  document.querySelector('.film-seek-controls').hidden = false;

  screen.updateWorldMatrix(true, false);
  const screenCenter = screen.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3().fromBufferAttribute(screen.geometry.getAttribute('normal'), 0)
    .transformDirection(screen.matrixWorld).setY(0).normalize();
  const vertices = screen.geometry.getAttribute('position');
  const screenCorners = Array.from({ length: vertices.count }, (_, index) =>
    screen.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, index)));
  const screenBounds = new THREE.Box3().setFromObject(screen);
  const screenHeight = screenBounds.max.y - screenBounds.min.y;
  const controlTarget = screenCenter.clone();
  controlTarget.y -= screenHeight * 0.33;
  const screenBottom = screenCenter.clone();
  screenBottom.y -= screenHeight / 2;
  screen.geometry.computeBoundingBox();
  const screenWidth = (screen.geometry.boundingBox.max.x - screen.geometry.boundingBox.min.x) * screen.scale.x;
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 1600;
  titleCanvas.height = 650;
  const titleContext = titleCanvas.getContext('2d');
  titleContext.textAlign = 'center';
  titleContext.fillStyle = '#eae2d2';
  titleContext.font = '80px Georgia, serif';
  titleContext.fillText(translate('VINCENT'), 800, 150);
  titleContext.font = '150px Georgia, serif';
  titleContext.fillText(translate('VAN GOGH'), 800, 330);
  titleContext.fillStyle = '#b8ac95';
  titleContext.fillRect(655, 396, 290, 3);
  titleContext.font = '38px Georgia, serif';
  titleContext.fillText(translate('Childhood · Family · Education'), 800, 491);
  const titleTexture = new THREE.CanvasTexture(titleCanvas);
  titleTexture.colorSpace = THREE.SRGBColorSpace;
  const titleSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth, screenWidth * 650 / 1600),
    new THREE.MeshBasicMaterial({ map: titleTexture, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
  );
  titleSurface.name = 'Opening film · Curtain title';
  titleSurface.userData.film_entry = true;
  titleSurface.position.copy(screenCenter).addScaledVector(normal, 0.035);
  titleSurface.position.y += screenHeight / 2 + screenWidth * 650 / 3200 + 0.3;
  titleSurface.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  scene.add(titleSurface);
  pickMeshes.push(titleSurface);
  if (screen.material.map) screen.material.map.dispose();
  screen.material.dispose();
  screen.material = new THREE.MeshBasicMaterial({ map: posterTexture, side: THREE.DoubleSide, toneMapped: false });
  if (placeholder) placeholder.visible = false;

  function paintPoster() {
    posterContext.fillStyle = '#d9d1c2';
    posterContext.fillRect(0, 0, poster.width, poster.height);
    const light = posterContext.createLinearGradient(0, 0, 1600, 900);
    light.addColorStop(0, '#f1ebdf');
    light.addColorStop(1, '#c7baa4');
    posterContext.fillStyle = light;
    posterContext.fillRect(0, 0, poster.width, poster.height);
    if (portrait.complete && portrait.naturalWidth) {
      const portraitHeight = 655;
      const portraitWidth = portraitHeight * portrait.naturalWidth / portrait.naturalHeight;
      posterContext.globalAlpha = 0.75;
      posterContext.drawImage(portrait, 1490 - portraitWidth, 68, portraitWidth, portraitHeight);
      posterContext.globalAlpha = 1;
    }
    posterContext.fillStyle = '#655b49';
    posterContext.font = '30px Georgia, serif';
    posterContext.fillText(translate('AN OPENING FILM'), 105, 145);
    posterContext.fillStyle = '#302f29';
    if (currentLanguage() === 'zh') {
      posterContext.font = '126px Georgia, SimSun, serif';
      posterContext.fillText(translate(title), 98, 400, 740);
    } else if (title === 'The Early Years') {
      posterContext.font = '126px Georgia, serif';
      posterContext.fillText('The Early', 98, 333);
      posterContext.fillText('Years', 98, 478);
    } else {
      posterContext.font = '78px Georgia, serif';
      posterContext.fillText(title, 105, 365, 680);
    }
    posterContext.fillStyle = '#8b795a';
    posterContext.fillRect(105, 538, 104, 3);
    posterContext.fillStyle = '#655b49';
    posterContext.font = '31px Georgia, serif';
    posterContext.fillText(translate('Childhood, family and education'), 105, 607);
    posterTexture.needsUpdate = true;
    video.poster = poster.toDataURL('image/jpeg', 0.9);
  }
  onLanguageChange(() => {
    titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    titleContext.fillStyle = '#eae2d2';
    titleContext.font = '80px Georgia, SimSun, serif';
    titleContext.fillText(translate('VINCENT'), 800, 150);
    titleContext.font = '150px Georgia, SimSun, serif';
    titleContext.fillText(translate('VAN GOGH'), 800, 330);
    titleContext.fillStyle = '#b8ac95';
    titleContext.fillRect(655, 396, 290, 3);
    titleContext.font = '38px Georgia, SimSun, serif';
    titleContext.fillText(translate('Childhood · Family · Education'), 800, 491);
    titleTexture.needsUpdate = true;
    paintPoster();
  });

  function durationLabel() {
    if (!Number.isFinite(video.duration)) return '';
    return `${String(Math.floor(video.duration / 60)).padStart(2, '0')}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}`;
  }

  function updateLabel() {
    playLabel.textContent = failed ? 'Open film player' : video.ended ? 'Continue after the film' : video.currentTime > 0 ? 'Resume film' : 'Play film';
    playButton.setAttribute('aria-label', `${playLabel.textContent}: ${title}`);
    replayButton.hidden = !video.paused && !video.ended;
    replayButton.textContent = failed ? 'Retry opening film' : video.ended ? 'Replay opening film' : video.currentTime > 0 ? 'Resume opening film' : 'Play opening film';
  }

  function update(nextView = lastView) {
    lastView = nextView;
    if (!nextView.available && !video.paused) video.pause();
    if (!nextView.available || nextView.blocked || dialog.open) {
      hideControls();
      lastLayout = '';
      lastVisibilityCheck = -Infinity;
      return;
    }
    const toolbarBounds = toolbar.getBoundingClientRect();
    const layout = [nextView.available, nextView.blocked, dialog.open, viewer.clientWidth, viewer.clientHeight,
      camera.position.x, camera.position.y, camera.position.z, camera.quaternion.x, camera.quaternion.y,
      camera.quaternion.z, camera.quaternion.w, camera.fov, toolbarBounds.top].join('|');
    if (layout === lastLayout) return;
    lastLayout = layout;
    camera.updateMatrixWorld();
    if (projectedPoint.subVectors(camera.position, screenCenter).dot(normal) <= 0) { hideControls(); return; }
    const bounds = renderer.domElement.getBoundingClientRect();
    const projected = projectedPoint.copy(controlTarget).project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) { hideControls(); return; }
    const horizontal = (projected.x + 1) * bounds.width / 2;
    let left = Infinity;
    let right = -Infinity;
    for (const corner of screenCorners) {
      projectedPoint.copy(corner).project(camera);
      left = Math.min(left, projectedPoint.x);
      right = Math.max(right, projectedPoint.x);
    }
    const pixelWidth = (right - left) * bounds.width / 2;
    if (pixelWidth < Math.min(48, bounds.width * 0.08)) { hideControls(); return; }
    const now = performance.now();
    if (now - lastVisibilityCheck >= 120 || camera.position.distanceToSquared(visibilityPosition) >= 0.64
      || 1 - Math.abs(camera.quaternion.dot(visibilityRotation)) > 0.0009) {
      projectedPoint.subVectors(controlTarget, camera.position);
      selectionRay.far = projectedPoint.length() + 0.1;
      selectionRay.set(camera.position, projectedPoint.normalize());
      const visible = pickMeshes.filter((object) => {
        for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
        return true;
      });
      intersections.length = 0;
      const first = selectionRay.intersectObjects(visible, false, intersections)[0]?.object;
      screenVisible = first === screen || first === titleSurface;
      lastVisibilityCheck = now;
      visibilityPosition.copy(camera.position);
      visibilityRotation.copy(camera.quaternion);
    }
    if (!screenVisible) { hideControls(); return; }
    const width = THREE.MathUtils.clamp(pixelWidth * 0.72, 148, 210);
    projectedPoint.copy(screenBottom).project(camera);
    const safeTop = masthead.getBoundingClientRect().bottom - bounds.top + 12;
    const safeBottom = toolbarBounds.top - bounds.top - 12;
    const vertical = Math.min((1 - projectedPoint.y) * bounds.height / 2 + 14, safeBottom - 80);
    if (horizontal < width / 2 + 8 || horizontal > bounds.width - width / 2 - 8 || vertical < safeTop || vertical > safeBottom) { hideControls(); return; }
    for (const [property, value] of Object.entries({ left: horizontal, top: vertical, width })) {
      const pixels = `${value.toFixed(1)}px`;
      if (controls.style[property] !== pixels) controls.style[property] = pixels;
    }
    if (controls.hidden) controls.hidden = false;
  }

  function hideControls() {
    if (!controls.hidden) controls.hidden = true;
  }

  async function open() {
    if (dialog.open) return;
    closeReason = 'return';
    previousFocus = document.activeElement;
    onOpen();
    dialog.showModal();
    controls.hidden = true;
    if (video.ended) showCompletion();
    else {
      closeButton.focus();
      await playFilm();
    }
  }

  async function playFilm() {
    if (!dialog.open) return;
    if (failed) { failed = false; video.load(); }
    if (video.ended) video.currentTime = 0;
    setCompletion(false);
    await resumeFilm();
  }

  async function resumeFilm() {
    try {
      await video.play();
    } catch (cause) {
      if (!dialog.open || cause.name === 'AbortError') return;
      playerStatus.textContent = 'Press Play opening film to begin with sound.';
      updateLabel();
    }
  }

  function close(reason = 'navigation') {
    closeReason = reason;
    if (dialog.open) dialog.close();
  }

  function setSource(source, filmTitle) {
    resetSeek();
    video.pause();
    title = filmTitle;
    failed = false;
    setCompletion(false);
    titleElement.textContent = title;
    status.textContent = 'Loading opening film…';
    playerStatus.textContent = 'Loading opening film…';
    playButton.disabled = true;
    video.muted = false;
    video.volume = 1;
    video.src = source;
    paintPoster();
    updateLabel();
    video.load();
    updateSeek();
  }

  portrait.addEventListener('load', paintPoster);
  portrait.src = './assets/story-vincent-nineteen.jpg';
  paintPoster();
  video.addEventListener('loadedmetadata', () => {
    status.textContent = `Opening film · ${durationLabel()}`;
    playerStatus.textContent = `${title} · ${durationLabel()} · Use controls for sound and full screen.`;
    playButton.disabled = false;
    updateLabel();
    updateSeek();
  });
  video.addEventListener('play', () => {
    if (!dialog.open) {
      video.pause();
      return;
    }
    setCompletion(false);
    playerStatus.textContent = `${title} · ${durationLabel()} · Use controls for sound and full screen.`;
    updateLabel();
    updateSeek();
  });
  video.addEventListener('pause', () => { updateLabel(); updateSeek(); });
  video.addEventListener('timeupdate', updateSeek);
  video.addEventListener('durationchange', updateSeek);
  video.addEventListener('volumechange', updateSeek);
  video.addEventListener('seeking', updateSeek);
  video.addEventListener('seeked', settleSeek);
  video.addEventListener('ended', () => {
    if (seeking || pendingSeek !== null) return;
    showCompletion();
  });
  video.addEventListener('error', () => {
    resetSeek();
    failed = true;
    status.textContent = 'Film unavailable';
    playerStatus.textContent = 'Film could not load. Retry the film, or continue to the early life stories.';
    playButton.disabled = false;
    updateLabel();
    updateSeek();
  });
  playerToggle.addEventListener('click', async () => {
    if (video.paused) await playFilm(); else video.pause();
  });
  seek.addEventListener('pointerdown', beginSeek);
  window.addEventListener('pointerup', finishSeek);
  window.addEventListener('pointercancel', finishSeek);
  seek.addEventListener('blur', finishSeek);
  seek.addEventListener('input', () => {
    const target = Number(seek.value);
    beginSeek();
    seekTarget = target;
    setCompletion(false);
    updateSeek();
  });
  seek.addEventListener('change', finishSeek);
  muteButton.addEventListener('click', () => { video.muted = !video.muted; updateSeek(); });
  playButton.addEventListener('click', open);
  replayButton.addEventListener('click', playFilm);
  exploreButton.addEventListener('click', () => { close(); onExplore(); });
  document.querySelector('#film-works').addEventListener('click', () => { close(); onWorks(); });
  document.querySelector('#film-tour').addEventListener('click', () => { close(); onTour(); });
  document.querySelector('#film-collection').addEventListener('click', () => { close(); onCollection(); });
  closeButton.addEventListener('click', () => close('return'));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (expansion.isExpanded()) void expansion.collapse();
    else close('return');
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close('return');
  });
  dialog.addEventListener('close', () => {
    resetSeek();
    video.pause();
    lastLayout = '';
    update();
    const restoreFocus = previousFocus?.isConnected && !previousFocus.closest('[hidden]') ? previousFocus : playButton;
    if (restoreFocus.getClientRects().length) restoreFocus.focus({ preventScroll: true });
    previousFocus = null;
    if (closeReason === 'return') onReturn?.();
  });
  return { setSource, update, open, close, isOpen: () => dialog.open };
}

