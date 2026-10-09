'use strict';
// WebAR V8 — reliable AR.js marker tracking + readable, touchable 2.5D DOM profile.
// No texture upload is needed. The existing AR.js camera stream remains the only capture source.
(() => {
  const scene = document.getElementById('scene');
  const marker = document.getElementById('hiro-marker');
  const status = document.getElementById('status');
  const output = document.getElementById('diag-output');
  const actions = document.getElementById('actions');
  const overlay = document.getElementById('ar-overlay');
  const retry = document.getElementById('retry-ar');
  const rotateButton = document.getElementById('rotate-card');
  const highResolution = location.pathname.endsWith('/ar-hd.html');
  let cardRotation = 0; // screen-facing by default; never inherit HIRO roll
  let cardScale = 1;
  function setCardRotation(degrees) {
    cardRotation = degrees;
    document.documentElement.classList.toggle('manual-sideways', degrees !== 0);
    overlay?.style.setProperty('--card-rotation', degrees + 'deg');
    if (rotateButton) {
      rotateButton.setAttribute('aria-pressed', String(degrees !== 0));
      rotateButton.setAttribute('title', 'Card rotation: ' + degrees + ' degrees');
    }
    lastX = NaN; lastY = NaN;
  }
  rotateButton?.addEventListener('click', () => {
    setCardRotation(cardRotation === 0 ? 90 : cardRotation === 90 ? 270 : 0);
    report();
  });
  // Android handles native rotation if auto-rotate is enabled. Do not also rotate the DOM card.
  const landscapeQuery = window.matchMedia('(orientation: landscape)');
  landscapeQuery.addEventListener?.('change', () => { setCardRotation(0); report(); });

  const footer = document.querySelector('.hud-bottom');
  const header = document.querySelector('.hud-top');
  if (!scene || !marker || !status || !output || !actions || !overlay) return;

  const state = {
    started: Date.now(), sceneRendered: false, marker: false,
    sourcePlaying: false, videoWidth: 0, videoHeight: 0,
    mirrorReady: false, overlayVisible: false, markerWidth: 0,
    projectedCenter: '', fault: '', errors: []
  };
  let nativeVideo = null, mirror = null, linkedStream = null, mirrorTask = null;
  let lastX = NaN, lastY = NaN, lastReport = '', hideTimer = null;
  const round = n => Math.round(Number(n) || 0);
  const arRegistered = () => Boolean(window.AFRAME?.systems?.arjs);
  function dimensions(el) {
    if (!el) return 'not found';
    const r = el.getBoundingClientRect();
    return `${round(r.width)}x${round(r.height)} at ${round(r.left)},${round(r.top)}`;
  }
  function setStatus(message) {
    if (status.textContent !== message) status.textContent = message;
  }
  function report() {
    const lines = [
      `Build: V8 / orientation + tracking quality`,
      `Tracking profile: ${highResolution ? 'HD 960x720 request' : 'STD 640x480 request'}`,
      `Card manual rotation: ${cardRotation} degrees`,
      `Card fit scale: ${Math.round(cardScale * 100)}%`,
      `Secure HTTPS: ${isSecureContext}`,
      `Camera API: ${Boolean(navigator.mediaDevices?.getUserMedia)}`,
      `A-Frame loaded: ${Boolean(window.AFRAME)}`,
      `AR.js SYSTEM registered: ${arRegistered()}`,
      `Scene renderstart: ${state.sceneRendered}`,
      `Camera source playing: ${state.sourcePlaying}`,
      `Original video: ${state.videoWidth}x${state.videoHeight}`,
      `Original video CSS: ${dimensions(nativeVideo)}`,
      `Fullscreen video mirror: ${state.mirrorReady}`,
      `Mirror CSS: ${dimensions(mirror)}`,
      `Viewport: ${innerWidth}x${innerHeight}`,
      `Marker HIRO: ${state.marker}`,
      `Marker width: ${round(state.markerWidth)} CSS px`,
      `Marker center: ${state.projectedCenter || 'not projected'}`,
      `HTML card visible: ${state.overlayVisible}`,
      `HTML card size: ${dimensions(overlay)}`,
      `Last fault: ${state.fault || 'none'}`,
      `Errors: ${state.errors.join(' | ') || 'none'}`
    ];
    const msg = lines.join('\n');
    if (msg !== lastReport) output.textContent = lastReport = msg;
  }
  function addError(value) {
    const text = String(value || 'Unknown').slice(0, 190);
    if (!state.errors.includes(text)) state.errors.push(text);
    if (state.errors.length > 5) state.errors.shift();
    report();
  }
  function fault(value) {
    state.fault = value;
    setStatus(`Ошибка AR: ${value}`);
    report();
  }
  function startMirror(source) {
    if (mirrorTask || !source?.srcObject || linkedStream === source.srcObject) return;
    if (mirror) {
      mirror.pause(); mirror.srcObject = null; mirror.remove();
    }
    linkedStream = source.srcObject;
    mirror = document.createElement('video');
    mirror.id = 'camera-mirror';
    mirror.autoplay = true;
    mirror.muted = true;
    mirror.playsInline = true;
    mirror.setAttribute('autoplay', '');
    mirror.setAttribute('muted', '');
    mirror.setAttribute('playsinline', '');
    mirror.setAttribute('webkit-playsinline', '');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.disablePictureInPicture = true;
    document.body.appendChild(mirror);
    mirror.srcObject = linkedStream;
    mirror.addEventListener('playing', () => {
      if (mirror.videoWidth > 0) {
        state.mirrorReady = true;
        document.documentElement.classList.add('mirror-active');
        report();
      }
    });
    mirrorTask = mirror.play().then(() => {
      state.mirrorReady = mirror.videoWidth > 0;
      if (state.mirrorReady) document.documentElement.classList.add('mirror-active');
      report();
    }).catch(err => addError(`Mirror playback: ${err.name}: ${err.message}`))
      .finally(() => { mirrorTask = null; });
  }
  function checkCamera() {
    const sources = Array.from(document.querySelectorAll('video')).filter(el => el.id !== 'camera-mirror');
    const source = sources.find(el => el.srcObject && el.readyState >= 2 && el.videoWidth > 0) ||
                   sources.find(el => el.readyState >= 2 && el.videoWidth > 0);
    if (source) {
      nativeVideo = source;
      state.sourcePlaying = !source.paused && source.readyState >= 2;
      state.videoWidth = source.videoWidth;
      state.videoHeight = source.videoHeight;
      if (source.srcObject && linkedStream !== source.srcObject) startMirror(source);
      if (!state.marker && state.sourcePlaying && !state.fault) {
        setStatus('✓ Камера работает. Наведите её на HIRO-маркер.');
      }
    }
    const elapsed = Date.now() - state.started;
    if (elapsed > 8000 && !arRegistered() && !state.fault) {
      fault('Не загрузилась система AR.js. Проверьте CDN.');
    } else if (elapsed > 16000 && arRegistered() && !state.sourcePlaying && !state.fault) {
      setStatus('Ожидаем видеопоток. Попробуйте «Тест камеры».');
    }
    report();
  }

  // Project the real HIRO pose into the WebGL canvas viewport; independent of the
  // CSS object-fit used by the video mirror and independent of any 3D image texture.
  function projectLocal(x, y, z, rect, camera) {
    const point = new THREE.Vector3(x, y, z);
    marker.object3D.localToWorld(point);
    point.project(camera);
    if (![point.x, point.y, point.z].every(Number.isFinite)) return null;
    if (point.z < -1 || point.z > 1) return null;
    return {
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2
    };
  }
  function reposition() {
    requestAnimationFrame(reposition);
    if (!state.marker || !scene.camera || !scene.canvas || !window.THREE) return;
    const rect = scene.canvas.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    marker.object3D.updateWorldMatrix(true, false);
    scene.camera.updateMatrixWorld(true);
    const center = projectLocal(0, 0, 0, rect, scene.camera);
    const left = projectLocal(-0.5, 0, 0, rect, scene.camera);
    const right = projectLocal(0.5, 0, 0, rect, scene.camera);
    if (!center || !left || !right) return;
    if (center.x < -80 || center.x > innerWidth + 80 || center.y < -80 || center.y > innerHeight + 80) return;
    const physicalWidth = Math.hypot(right.x - left.x, right.y - left.y);
    state.markerWidth = physicalWidth;
    state.projectedCenter = `${round(center.x)},${round(center.y)}`;
    // The card remains upright to the screen, never rigidly rotated with HIRO.
    // Landscape layouts are compact; manual 90-degree mode handles Android auto-rotate OFF.
    const isLandscape = innerWidth > innerHeight && innerHeight < 650;
    const isSideways = cardRotation !== 0;
    const cardWidth = isSideways
      ? Math.min(540, Math.max(280, innerHeight - 115))
      : isLandscape
        ? Math.min(innerWidth - 24, 520, Math.max(320, physicalWidth * 1.35))
        : Math.min(innerWidth - 24, Math.max(258, physicalWidth * 1.35));
    overlay.style.setProperty('--card-width', `${round(cardWidth)}px`);
    // offsetWidth/Height are the untransformed DOM dimensions. Rotation swaps the bounding box.
    const rawW = overlay.offsetWidth || cardWidth;
    const rawH = overlay.offsetHeight || 260;
    const displayedW = isSideways ? rawH : rawW;
    const displayedH = isSideways ? rawW : rawH;
    const topEdge = (header?.getBoundingClientRect().bottom || 64) + 9;
    const bottomEdge = (footer?.getBoundingClientRect().top || innerHeight - 175) - 9;
    const availableHeight = Math.max(80, bottomEdge - topEdge);
    cardScale = Math.min(1, (innerWidth - 24) / displayedW,
      availableHeight / displayedH);
    if (!Number.isFinite(cardScale)) cardScale = 1;
    cardScale = Math.max(0.35, cardScale);
    overlay.style.setProperty('--card-scale', cardScale.toFixed(3));
    const fitW = displayedW * cardScale;
    const fitH = displayedH * cardScale;
    const minY = topEdge + fitH / 2;
    const maxY = bottomEdge - fitH / 2;
    const targetX = Math.max(fitW / 2 + 10, Math.min(innerWidth - fitW / 2 - 10, center.x));
    const intendedY = center.y - Math.min(38, physicalWidth * .16);
    const targetY = maxY >= minY
      ? Math.max(minY, Math.min(maxY, intendedY))
      : Math.max(fitH / 2 + 10, Math.min(innerHeight - fitH / 2 - 10, intendedY));
    // Mild smoothing, without detaching the visible overlay from the marker.
    lastX = Number.isFinite(lastX) ? lastX + (targetX - lastX) * 0.35 : targetX;
    lastY = Number.isFinite(lastY) ? lastY + (targetY - lastY) * 0.35 : targetY;
    overlay.style.left = `${lastX.toFixed(1)}px`;
    overlay.style.top = `${lastY.toFixed(1)}px`;
    if (!state.overlayVisible) {
      overlay.classList.add('is-visible');
      state.overlayVisible = true;
      setStatus('✓ HIRO распознан. Контактная визитка закреплена над маркером.');
      report();
    }
  }

  function onMarkerFound() {
    state.marker = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    overlay.hidden = false;
    actions.classList.add('visible');
    setStatus('✓ HIRO распознан. Показываем виртуальную визитку.');
    report();
  }
  function onMarkerLost() {
    state.marker = false;
    overlay.classList.remove('is-visible');
    state.overlayVisible = false;
    actions.classList.remove('visible');
    lastX = NaN; lastY = NaN;
    setStatus('Маркер потерян. Наведите камеру на HIRO.');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!state.marker) overlay.hidden = true; }, 220);
    report();
  }
  marker.addEventListener('markerFound', onMarkerFound);
  marker.addEventListener('markerLost', onMarkerLost);
  scene.addEventListener('renderstart', () => { state.sceneRendered = true; report(); });
  requestAnimationFrame(reposition);

  // All buttons are real HTML controls, not a clickable image texture.
  const profileUrl = new URL('index.html?v=8', location.href).href;
  function saveContact() {
    const vcf = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Akbar', 'TITLE:Head of IT',
      'NOTE:WebAR demo - replace with approved details', 'END:VCARD', ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([vcf], {type:'text/vcard;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = 'visitcard-demo.vcf'; document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function shareProfile() {
    try {
      if (navigator.share) await navigator.share({title:'VisitCard AR Demo', url:profileUrl});
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl);
        setStatus('Ссылка на профиль скопирована');
      } else window.prompt('Скопируйте ссылку:', profileUrl);
    } catch (err) { if (err.name !== 'AbortError') addError(`Share: ${err.message || err}`); }
  }
  document.querySelectorAll('.save-action').forEach(el => el.addEventListener('click', saveContact));
  document.querySelectorAll('.share-action').forEach(el => el.addEventListener('click', shareProfile));
  retry?.addEventListener('click', () => location.reload());
  window.addEventListener('error', e => addError(e.message || `Load failed: ${e.target?.src || 'unknown'}`), true);
  window.addEventListener('unhandledrejection', e => addError(e.reason?.message || e.reason || 'Promise rejected'));

  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) fault('Необходим HTTPS и доступ к камере.');
  else if (!window.AFRAME) fault('A-Frame не загрузился.');
  else if (!arRegistered()) setStatus('Ожидаем AR.js (нужен интернет для CDN)…');
  else setStatus('Разрешите доступ к задней камере…');
  report();
  const interval = setInterval(checkCamera, 950);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCamera(); });
  window.addEventListener('resize', report);
  window.addEventListener('pagehide', () => {
    clearInterval(interval);
    if (hideTimer) clearTimeout(hideTimer);
    if (mirror) { mirror.pause(); mirror.srcObject = null; }
  }, {once:true});
})();
