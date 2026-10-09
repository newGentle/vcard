'use strict';
// NFC VisitCard WebAR V4: AR.js video mirroring and truthful diagnostics.
(() => {
  const scene = document.getElementById('scene');
  const marker = document.getElementById('hiro-marker');
  const status = document.getElementById('status');
  const output = document.getElementById('diag-output');
  const actions = document.getElementById('actions');
  const retry = document.getElementById('retry-ar');
  if (!scene || !marker || !status || !output || !actions) return;

  const state = {
    started: Date.now(), sceneRendered: false, marker: false,
    sourcePlaying: false, videoWidth: 0, videoHeight: 0,
    mirrorReady: false, fault: '', errors: []
  };
  let nativeVideo = null;
  let mirror = null;
  let linkedStream = null;
  let videoTask = null;
  let lastDiag = '';
  const setStatus = (value) => {
    if (status.textContent !== value) status.textContent = value;
  };
  const round = n => Math.round(Number(n) || 0);
  const dimensions = el => {
    if (!el) return 'not found';
    const r = el.getBoundingClientRect();
    return `${round(r.width)}x${round(r.height)} at ${round(r.left)},${round(r.top)}`;
  };
  const arRegistered = () => Boolean(window.AFRAME?.systems?.arjs);
  function report() {
    const lines = [
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
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `Body CSS: ${dimensions(document.body)}`,
      `Marker HIRO: ${state.marker}`,
      `Last fault: ${state.fault || 'none'}`,
      `Errors: ${state.errors.join(' | ') || 'none'}`
    ];
    const next = lines.join('\n');
    if (next !== lastDiag) output.textContent = lastDiag = next;
  }
  function addError(message) {
    const text = String(message || 'unknown').slice(0, 190);
    if (!state.errors.includes(text)) state.errors.push(text);
    if (state.errors.length > 5) state.errors.shift();
    report();
  }
  function fault(message) {
    state.fault = message;
    setStatus(`Ошибка AR: ${message}`);
    report();
  }
  function startMirroring(source) {
    // Never request another camera: share the live MediaStream opened by AR.js.
    if (videoTask || !source?.srcObject) return;
    if (linkedStream === source.srcObject && mirror) return;
    if (mirror) {
      mirror.pause();
      mirror.srcObject = null;
      mirror.remove();
    }
    linkedStream = source.srcObject;
    mirror = document.createElement('video');
    mirror.id = 'camera-mirror';
    mirror.setAttribute('autoplay', '');
    mirror.setAttribute('muted', '');
    mirror.setAttribute('playsinline', '');
    mirror.setAttribute('webkit-playsinline', '');
    mirror.autoplay = true;
    mirror.muted = true;
    mirror.playsInline = true;
    mirror.disablePictureInPicture = true;
    mirror.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mirror);
    mirror.srcObject = source.srcObject;
    videoTask = mirror.play().then(() => {
      state.mirrorReady = mirror.videoWidth > 0 && mirror.videoHeight > 0;
      if (state.mirrorReady) {
        document.documentElement.classList.add('mirror-active');
        if (!state.marker) setStatus('✓ Камера передаёт видео. Наведите её на HIRO-маркер.');
      }
      report();
    }).catch(err => {
      addError(`Video mirror: ${err.name || 'Error'} ${err.message || ''}`);
      state.mirrorReady = false;
      // Original AR.js camera remains visible if a second video element cannot play.
    }).finally(() => { videoTask = null; });
    mirror.addEventListener('playing', () => {
      if (mirror?.videoWidth) {
        state.mirrorReady = true;
        document.documentElement.classList.add('mirror-active');
        report();
      }
    });
  }
  function checkVideo() {
    const videos = Array.from(document.querySelectorAll('video')).filter(v => v.id !== 'camera-mirror');
    const source = videos.find(v => v.srcObject && v.videoWidth > 0 && v.readyState >= 2) ||
      videos.find(v => v.videoWidth > 0 && v.readyState >= 2);
    if (source) {
      nativeVideo = source;
      state.sourcePlaying = !source.paused && source.readyState >= 2;
      state.videoWidth = source.videoWidth;
      state.videoHeight = source.videoHeight;
      if (source.srcObject && linkedStream !== source.srcObject) startMirroring(source);
      if (!state.marker && !state.fault && !state.mirrorReady) {
        setStatus('Камера передаёт видео. Подготавливаем полноэкранный вид…');
      }
    }
    const waited = Date.now() - state.started;
    if (waited > 7500 && !arRegistered() && !state.fault) {
      fault('AR.js не зарегистрировал систему. Проверьте CDN и ошибки загрузки ниже.');
    } else if (waited > 15000 && arRegistered() && !state.sourcePlaying && !state.fault) {
      setStatus('Ожидаем видео. Откройте «Проверить камеру» для сравнения.');
    }
    report();
  }
  window.addEventListener('error', e => {
    const src = e.target?.src;
    if (src && (String(src).includes('aframe') || String(src).includes('AR.js'))) {
      addError(`CDN failed: ${String(src).slice(0, 135)}`);
    } else {
      addError(e.message || 'Failed to load script/resource');
    }
  }, true);
  window.addEventListener('unhandledrejection', e => addError(e.reason?.message || e.reason || 'promise rejected'));
  scene.addEventListener('renderstart', () => {
    state.sceneRendered = true;
    report();
  });
  marker.addEventListener('markerFound', () => {
    state.marker = true;
    actions.classList.add('visible');
    setStatus('✓ HIRO распознан. Виртуальная визитка привязана к маркеру.');
    report();
  });
  marker.addEventListener('markerLost', () => {
    state.marker = false;
    actions.classList.remove('visible');
    if (!state.fault) setStatus('Маркер потерян. Наведите камеру на HIRO.');
    report();
  });
  if (retry) retry.addEventListener('click', () => window.location.reload());
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    fault('Нужны HTTPS и поддержка камеры в браузере.');
  } else if (!window.AFRAME) {
    fault('A-Frame не загрузился: проверьте подключение к CDN.');
  } else if (!arRegistered()) {
    // Do not abort: diagnostics still run and monitor late library registration.
    setStatus('Ожидаем библиотеку AR.js; проверяем подключение…');
  } else {
    setStatus('AR.js запущен. Разрешите доступ к задней камере…');
  }
  report();
  const timer = window.setInterval(checkVideo, 900);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVideo(); });
  window.addEventListener('resize', report);
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    // Do not stop original camera stream here: AR.js owns its lifecycle.
    if (mirror) {
      mirror.pause();
      mirror.srcObject = null;
    }
  }, { once: true });
})();
