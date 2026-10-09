'use strict';
(() => {
  const status = document.getElementById('status');
  const output = document.getElementById('diag-output');
  const marker = document.getElementById('hiro-marker');
  const scene = document.getElementById('scene');
  const actions = document.getElementById('actions');
  const state = { startedAt: Date.now(), rendered: false, marker: false, video: false,
    cameraWidth: 0, cameraHeight: 0, fault: '', errors: [] };
  const setStatus = (s) => { status.textContent = s; };
  function report() {
    output.textContent = [
      `HTTPS/Secure context: ${isSecureContext}`,
      `WebRTC: ${!!navigator.mediaDevices?.getUserMedia}`,
      `A-Frame loaded: ${!!window.AFRAME}`,
      `AR.js component: ${!!window.AFRAME?.components?.arjs}`,
      `Scene rendered: ${state.rendered}`,
      `Webcam video playing: ${state.video}`,
      `Video dimensions: ${state.cameraWidth} x ${state.cameraHeight}`,
      `HIRO detected: ${state.marker}`,
      `Last fault: ${state.fault || 'none'}`,
      `Recent errors: ${state.errors.join(' | ') || 'none'}`
    ].join('\n');
  }
  function fault(message) {
    state.fault = message;
    setStatus(`Ошибка AR: ${message}. Нажмите «Проверить камеру» внизу.`);
    report();
  }
  window.addEventListener('error', e => {
    if (state.errors.length < 4) state.errors.push((e.message || 'script load error').slice(0, 150));
    report();
  });
  window.addEventListener('unhandledrejection', e => {
    if (state.errors.length < 4) state.errors.push(String(e.reason?.message || e.reason || 'promise error').slice(0,150));
    report();
  });
  scene.addEventListener('renderstart', () => {state.rendered = true; report();});
  marker.addEventListener('markerFound', () => {
    state.marker = true;
    actions.classList.add('visible');
    setStatus('✓ HIRO-маркер распознан — виртуальная визитка закреплена над ним');
    report();
  });
  marker.addEventListener('markerLost', () => {
    state.marker = false;
    actions.classList.remove('visible');
    setStatus('Маркер потерян — наведите камеру на чёрно-белый HIRO');
    report();
  });
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    fault('Браузер не предоставляет доступ к камере в защищённом контексте');
    return;
  }
  if (!window.AFRAME) {
    fault('Библиотека A-Frame не загрузилась — проверьте интернет');
    return;
  }
  if (!window.AFRAME.components?.arjs) {
    fault('Библиотека AR.js не загрузилась — проверьте интернет');
    return;
  }
  setStatus('Запуск видеопотока… разрешите камеру и наведите её на HIRO-маркер.');
  report();
  const timer = window.setInterval(() => {
    const videos = [...document.querySelectorAll('video')];
    const video = videos.find(v => v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2);
    if (video) {
      state.video = true;
      state.cameraWidth = video.videoWidth;
      state.cameraHeight = video.videoHeight;
      if (!state.marker && !state.fault) setStatus('✓ Камера передаёт видео. Наведите её на HIRO-маркер.');
    }
    if (!video && Date.now() - state.startedAt > 14000 && !state.fault) {
      setStatus('Видеопоток ещё не получен. Проверьте разрешение камеры, затем тест камеры ниже.');
    }
    report();
  }, 1000);
  window.addEventListener('pagehide', () => clearInterval(timer), {once:true});
})();
