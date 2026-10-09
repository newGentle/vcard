'use strict';
// NFC VisitCard WebAR V5: AR.js video mirroring and truthful diagnostics.
(() => {
  const scene = document.getElementById('scene');
  const marker = document.getElementById('hiro-marker');
  const status = document.getElementById('status');
  const output = document.getElementById('diag-output');
  const actions = document.getElementById('actions');
  const retry = document.getElementById('retry-ar');
  const hotspots = document.getElementById('marker-hotspots');
  const profilePlane = document.getElementById('profile-card');
  const cardTexture = document.getElementById('card-image');
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
      `Card texture: ${cardTexture?.naturalWidth ? cardTexture.naturalWidth + 'x' + cardTexture.naturalHeight : 'not loaded'}`,
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
  cardTexture?.addEventListener('error', () => addError('3D card image missing: assets/ar-card.png'));
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
    if (hotspots) hotspots.hidden = false;
    setStatus('✓ HIRO распознан. Виртуальная визитка привязана к маркеру.');
    report();
  });
  marker.addEventListener('markerLost', () => {
    state.marker = false;
    actions.classList.remove('visible');
    if (hotspots) hotspots.hidden = true;
    if (!state.fault) setStatus('Маркер потерян. Наведите камеру на HIRO.');
    report();
  });
  // Real working HTML actions, not fake clickable geometry in the 3D texture.
  const profileUrl = new URL('index.html?v=5', location.href).href;
  function saveDemoContact() {
    const vcard = ['BEGIN:VCARD','VERSION:3.0','FN:Akbar','TITLE:Head of IT',
      'NOTE:Public WebAR demo, replace with approved contact details','END:VCARD',''].join('\r\n');
    const blobUrl = URL.createObjectURL(new Blob([vcard], {type:'text/vcard;charset=utf-8'}));
    const a = document.createElement('a');a.href=blobUrl;a.download='visitcard-demo.vcf';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }
  async function shareProfile() {
    try {
      if (navigator.share) await navigator.share({title:'AR VisitCard Demo',url:profileUrl});
      else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(profileUrl);setStatus('Ссылка на визитку скопирована');}
      else {window.prompt('Скопируйте ссылку:',profileUrl);}
    } catch(err) {if (err.name !== 'AbortError') addError('Share: '+(err.message || err));}
  }
  for (const btn of document.querySelectorAll('.save-action,#hot-save')) btn.addEventListener('click',saveDemoContact);
  for (const btn of document.querySelectorAll('.share-action,#hot-share')) btn.addEventListener('click',shareProfile);

  // Project three button centers from marker-local 3D coordinates to the phone viewport.
  // Only provide touch targets when the fiducial is tracked and the plane is on screen.
  const hotspotCoords = [
    ['hot-save', -0.54, -0.375],
    ['hot-profile', 0, -0.375],
    ['hot-share', 0.54, -0.375]
  ];
  let lastProjection = 0;
  function projectHotspots(now) {
    requestAnimationFrame(projectHotspots);
    if (!state.marker || !hotspots || !profilePlane?.object3D || !scene.camera || !window.THREE) return;
    if (now-lastProjection < 80) return;
    lastProjection = now;
    const rect=(scene.canvas || scene).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    profilePlane.object3D.updateWorldMatrix(true, false);
    scene.camera.updateMatrixWorld();
    for (const [id,x,y] of hotspotCoords) {
      const element=document.getElementById(id);
      if (!element) continue;
      const projected=new THREE.Vector3(x,y,0.01);
      profilePlane.object3D.localToWorld(projected);
      projected.project(scene.camera);
      const left=rect.left+(projected.x+1)*rect.width/2;
      const top=rect.top+(1-projected.y)*rect.height/2;
      const visible=projected.z>-1 && projected.z<1 && left>35 && left<innerWidth-35 && top>90 && top<innerHeight-170;
      element.style.display=visible?'block':'none';
      if (visible) {element.style.left=left+'px';element.style.top=top+'px';}
    }
  }
  requestAnimationFrame(projectHotspots);

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
