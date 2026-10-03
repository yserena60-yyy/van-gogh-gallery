import * as THREE from 'three';

export function createOpeningFilm({ viewer, renderer, scene, camera, screen, placeholder, pickMeshes, onOpen, onExplore, onWorks }) {
  const video = document.querySelector('#opening-film');
  const dialog = document.querySelector('#film-player');
  const closeButton = document.querySelector('#film-close');
  const controls = document.querySelector('.film-controls');
  const playButton = document.querySelector('#film-toggle');
  const playLabel = document.querySelector('#film-label');
  const status = document.querySelector('#film-status');
  const playerStatus = document.querySelector('#film-player-status');
  const titleElement = document.querySelector('#film-player-title');
  const replayButton = document.querySelector('#film-replay');
  const complete = document.querySelector('#film-complete');
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
  let failed = false;
  let lastView = { available: false, blocked: false };
  let lastLayout = '';

  screen.updateWorldMatrix(true, false);
  const screenCenter = screen.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3().fromBufferAttribute(screen.geometry.getAttribute('normal'), 0)
    .transformDirection(screen.matrixWorld).setY(0).normalize();
  const vertices = screen.geometry.getAttribute('position');
  const screenBounds = new THREE.Box3().setFromObject(screen);
  const screenHeight = screenBounds.max.y - screenBounds.min.y;
  screen.geometry.computeBoundingBox();
  const screenWidth = (screen.geometry.boundingBox.max.x - screen.geometry.boundingBox.min.x) * screen.scale.x;
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 1600;
  titleCanvas.height = 650;
  const titleContext = titleCanvas.getContext('2d');
  titleContext.textAlign = 'center';
  titleContext.fillStyle = '#eae2d2';
  titleContext.font = '80px Georgia, serif';
  titleContext.fillText('VINCENT', 800, 150);
  titleContext.font = '150px Georgia, serif';
  titleContext.fillText('VAN GOGH', 800, 330);
  titleContext.fillStyle = '#b8ac95';
  titleContext.fillRect(655, 396, 290, 3);
  titleContext.font = '38px Georgia, serif';
  titleContext.fillText('Childhood · Family · Education', 800, 491);
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
    posterContext.fillText('AN OPENING FILM', 105, 145);
    posterContext.fillStyle = '#302f29';
    if (title === 'The Early Years') {
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
    posterContext.fillText('Childhood, family and education', 105, 607);
    posterTexture.needsUpdate = true;
    video.poster = poster.toDataURL('image/jpeg', 0.9);
  }

  function durationLabel() {
    if (!Number.isFinite(video.duration)) return '';
    return `${String(Math.floor(video.duration / 60)).padStart(2, '0')}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}`;
  }

  function updateLabel() {
    playLabel.textContent = failed ? 'Open film player' : video.ended ? 'Replay film' : video.currentTime > 0 ? 'Resume film' : 'Play film';
    playButton.setAttribute('aria-label', `${playLabel.textContent}: ${title}`);
    replayButton.hidden = !video.paused && !video.ended;
    replayButton.textContent = failed ? 'Retry opening film' : video.ended ? 'Replay opening film' : video.currentTime > 0 ? 'Resume opening film' : 'Play opening film';
  }

  function update(nextView = lastView) {
    lastView = nextView;
    const layout = [nextView.available, nextView.blocked, dialog.open, viewer.clientWidth, viewer.clientHeight,
      camera.position.x, camera.position.y, camera.position.z, camera.quaternion.x, camera.quaternion.y,
      camera.quaternion.z, camera.quaternion.w, camera.fov, toolbar.getBoundingClientRect().top].join('|');
    if (layout === lastLayout) return;
    lastLayout = layout;
    controls.hidden = true;
    if (!nextView.available) video.pause();
    if (!nextView.available || nextView.blocked || dialog.open) return;
    camera.updateMatrixWorld();
    if (camera.position.clone().sub(screenCenter).dot(normal) <= 0) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    const target = screenCenter.clone();
    target.y -= screenHeight * 0.33;
    const projected = target.clone().project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return;
    const corners = Array.from({ length: vertices.count }, (_, index) =>
      screen.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, index)).project(camera));
    const pixelWidth = (Math.max(...corners.map((point) => point.x)) - Math.min(...corners.map((point) => point.x))) * bounds.width / 2;
    if (pixelWidth < Math.min(48, bounds.width * 0.08)) return;
    selectionRay.set(camera.position, target.clone().sub(camera.position).normalize());
    const visible = pickMeshes.filter((object) => {
      for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
      return true;
    });
    const first = selectionRay.intersectObjects(visible, false)[0]?.object;
    if (first !== screen && first !== titleSurface) return;
    const width = THREE.MathUtils.clamp(pixelWidth * 0.72, 148, 210);
    const horizontal = (projected.x + 1) * bounds.width / 2;
    const screenBottom = screenCenter.clone();
    screenBottom.y -= screenHeight / 2;
    screenBottom.project(camera);
    const safeTop = masthead.getBoundingClientRect().bottom - bounds.top + 12;
    const safeBottom = toolbar.getBoundingClientRect().top - bounds.top - 12;
    const vertical = Math.min((1 - screenBottom.y) * bounds.height / 2 + 14, safeBottom - 80);
    if (horizontal < width / 2 + 8 || horizontal > bounds.width - width / 2 - 8 || vertical < safeTop || vertical > safeBottom) return;
    controls.style.left = `${horizontal}px`;
    controls.style.top = `${vertical}px`;
    controls.style.width = `${width}px`;
    controls.hidden = false;
  }

  async function open() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    onOpen();
    dialog.showModal();
    controls.hidden = true;
    closeButton.focus();
    await playFilm();
  }

  async function playFilm() {
    if (!dialog.open) return;
    if (failed) { failed = false; video.load(); }
    if (video.ended) video.currentTime = 0;
    complete.hidden = true;
    try {
      await video.play();
    } catch (cause) {
      if (!dialog.open || cause.name === 'AbortError') return;
      playerStatus.textContent = 'Press Play opening film to begin with sound.';
      updateLabel();
    }
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function setSource(source, filmTitle) {
    video.pause();
    title = filmTitle;
    failed = false;
    complete.hidden = true;
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
  }

  portrait.addEventListener('load', paintPoster);
  portrait.src = './assets/story-vincent-nineteen.jpg';
  paintPoster();
  video.addEventListener('loadedmetadata', () => {
    status.textContent = `Opening film · ${durationLabel()}`;
    playerStatus.textContent = `${title} · ${durationLabel()} · Use controls for sound and full screen.`;
    playButton.disabled = false;
    updateLabel();
  });
  video.addEventListener('play', () => {
    if (!dialog.open) {
      video.pause();
      return;
    }
    playerStatus.textContent = `${title} · ${durationLabel()} · Use controls for sound and full screen.`;
    updateLabel();
  });
  video.addEventListener('pause', updateLabel);
  video.addEventListener('ended', () => {
    playerStatus.textContent = 'Film complete · Choose your next step.';
    complete.hidden = false;
    updateLabel();
  });
  video.addEventListener('error', () => {
    failed = true;
    status.textContent = 'Film unavailable';
    playerStatus.textContent = 'Film could not load. Retry the film, or continue to the early life stories.';
    playButton.disabled = false;
    updateLabel();
  });
  playButton.addEventListener('click', open);
  replayButton.addEventListener('click', playFilm);
  document.querySelector('#film-explore').addEventListener('click', () => { close(); onExplore(); });
  document.querySelector('#film-works').addEventListener('click', () => { close(); onWorks(); });
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    lastLayout = '';
    update();
    const restoreFocus = previousFocus?.isConnected && !previousFocus.closest('[hidden]') ? previousFocus : playButton;
    if (restoreFocus.getClientRects().length) restoreFocus.focus({ preventScroll: true });
    previousFocus = null;
  });
  return { setSource, update, open, close, isOpen: () => dialog.open };
}
