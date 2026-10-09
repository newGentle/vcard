'use strict';
/*
 * WebAR V12: real 3D model attached to AR.js marker's 6-DoF pose.
 * Uses local transparent alpha PNGs and native A-Frame planes. No CSS
 * projection, no 2D card clamping, no extra camera capture. GitHub portrait
 * is the original public photo.webp from the main portfolio.
 */
(() => {
  const scene = document.getElementById('scene');
  const marker = document.getElementById('aa-marker');
  const status = document.getElementById('status');
  const diag = document.getElementById('diag-output');
  if (!scene || !marker || !status || !diag) return;
  const known = { version: '12.0', started: Date.now(), marker: false, video: false, width: 0, height: 0, webgl: false, assets: {}, mirror: false, errors: [] };
  let mirror, linkedStream, mirrorPromise;
  let diagnosticString = '';
  const assets = ['frame-texture','text-texture','logo-texture','photo-frame-texture','particles-texture','photo-fallback-texture','github-photo'];
  const arReady = () => Boolean(window.AFRAME?.systems?.arjs);
  const caption = text => { if(status.textContent !== text) status.textContent = text; };
  const logError = error => { const msg = String(error?.message || error).slice(0,200); if(!known.errors.includes(msg)) known.errors.push(msg); if(known.errors.length>5) known.errors.shift(); report(); };
  const report = () => {
    const rows = [
      `Build: WebAR V12 ${location.pathname.endsWith('ar-hd.html')?'HD':'STD'}`,
      `HTTPS: ${isSecureContext}`,
      `AR.js system: ${arReady()}`,
      `Scene rendering: ${known.webgl}`,
      `Marker AA recognized: ${known.marker}`,
      `3D geometry: 1 x 1 marker unit`,
      `Perspective: native marker.object3D (6DoF)`,
      `Layers: frame y=.006; particles .035; photo .095; name .132; AA .158`,
      `Webcam source playing: ${known.video}`,
      `Camera: ${known.width} x ${known.height}`,
      `Same-stream video mirror: ${known.mirror}`,
      `Assets: ${assets.map(id=>`${id}=${known.assets[id]||'pending'}`).join(', ')}`,
      `Problems: ${known.errors.join(' | ') || 'none'}`
    ];
    const val=rows.join('\n');
    if(diagnosticString!==val){diagnosticString=val;diag.textContent=val;}
  };
  const checkAsset = id => {
    const img=document.getElementById(id);
    if (!img) return;
    const loaded=()=>{known.assets[id]=img.naturalWidth>0?'loaded':'invalid';report();};
    const failed=()=>{known.assets[id]='FAILED';logError(`Texture unavailable: ${id}`);if(id==='github-photo'){document.getElementById('portrait-photo')?.setAttribute('visible',false);document.getElementById('portrait-fallback-plane')?.setAttribute('visible',true);}};
    img.addEventListener('load',loaded);
    img.addEventListener('error',failed);
    if(img.complete){ if(img.naturalWidth>0)loaded(); else failed(); }
  };
  assets.forEach(checkAsset);
  // Optional upper-body crop of the original 1688x3008 portrait via GPU UVs.
  // Keep ?portrait=full as a safe manual fallback for device-specific texture behavior.
  const photoPlane=document.getElementById('portrait-photo');
  function cropPortraitTexture(){
    if(new URLSearchParams(location.search).get('portrait')==='full')return;
    const map=photoPlane?.getObject3D('mesh')?.material?.map;
    if(!map||map.userData?.aaCropApplied)return;
    map.repeat.set(.63,.56);
    map.offset.set(.185,.44);
    map.needsUpdate=true;
    map.userData.aaCropApplied=true;
    report();
  }
  photoPlane?.addEventListener('materialtextureloaded',cropPortraitTexture);
  photoPlane?.addEventListener('object3dset',cropPortraitTexture);
  marker.addEventListener('markerFound',()=>{known.marker=true;document.documentElement.classList.add('marker-found');caption('✓ AA распознан. 3D-слои закреплены по перспективе маркера.');report();});
  marker.addEventListener('markerLost',()=>{known.marker=false;document.documentElement.classList.remove('marker-found');caption('Маркер потерян — наведите камеру на AA.');report();});
  scene.addEventListener('renderstart',()=>{known.webgl=true;report();});
  scene.addEventListener('loaded',report);
  scene.addEventListener('error',e=>logError(e.detail?.message || 'A-Frame scene error'));
  
  // Keep the same camera MediaStream. No second getUserMedia call.
  function attachMirror(source) {
    if(!source.srcObject || linkedStream === source.srcObject || mirrorPromise)return;
    if(mirror){mirror.pause();mirror.srcObject=null;mirror.remove();}
    linkedStream = source.srcObject;
    mirror = document.createElement('video');
    mirror.id='camera-mirror';mirror.autoplay=true;mirror.muted=true;mirror.playsInline=true;
    mirror.setAttribute('playsinline','');mirror.setAttribute('webkit-playsinline','');
    mirror.setAttribute('muted','');mirror.disablePictureInPicture=true;mirror.setAttribute('aria-hidden','true');
    document.body.appendChild(mirror);mirror.srcObject=linkedStream;
    mirror.addEventListener('playing',()=>{if(mirror.videoWidth){known.mirror=true;document.documentElement.classList.add('mirror-active');report();}});
    mirrorPromise=mirror.play().catch(e=>logError(`Same-stream playback: ${e.message}`)).finally(()=>{mirrorPromise=null;});
  }
  function checkCamera() {
    cropPortraitTexture();
    const videos=[...document.querySelectorAll('video')].filter(v=>v.id!=='camera-mirror');
    const v=videos.find(v=>v.readyState>=2 && v.videoWidth>0);
    if(v){known.video=!v.paused && v.readyState>=2;known.width=v.videoWidth;known.height=v.videoHeight;
      if(v.srcObject && linkedStream!==v.srcObject)attachMirror(v);
      if(known.video && !known.marker && known.errors.length===0)caption('Задняя камера работает. Наведите на AA-маркер.');
    }
    if(Date.now()-known.started>9000 && !arReady())caption('AR.js не загрузился. Проверьте интернет/CDN.');
    report();
  }
  if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)caption('Требуется HTTPS и разрешение на камеру.');
  else if(!window.AFRAME)caption('Не удалось загрузить A-Frame.');
  else caption('Разрешите доступ к камере для WebAR V12.');
  const ticker=setInterval(checkCamera,1100);checkCamera();
  document.getElementById('save-contact')?.addEventListener('click',()=>{
    const a=document.createElement('a');a.href='../Akbar_Abdullaev.vcf';a.download='Akbar_Abdullaev.vcf';document.body.appendChild(a);a.click();a.remove();
  });
  document.getElementById('share-profile')?.addEventListener('click', async ()=>{
    const url=new URL('../index.html',location.href).href;
    try{if(navigator.share)await navigator.share({title:'Akbar Abdullaev | Digital Identity',url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);caption('Ссылка на профиль скопирована');}
      else window.prompt('Скопируйте ссылку:',url);
    }catch(e){if(e?.name!=='AbortError')logError(e);}
  });
  document.getElementById('restart-ar')?.addEventListener('click',()=>location.reload());
  window.addEventListener('error',e=>logError(e.message || e.target?.src || 'Resource load failed'),true);
  window.addEventListener('unhandledrejection',e=>logError(e.reason || 'Promise rejected'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkCamera();});
  window.addEventListener('pagehide',()=>{clearInterval(ticker);if(mirror){mirror.pause();mirror.srcObject=null;}}, {once:true});
  report();
})();
