'use strict';
(() => {
  const scene = document.getElementById('scene');
  const marker = document.getElementById('aa-marker');
  const layersRoot = document.getElementById('hologram');
  const planes = [...document.querySelectorAll('.projected-plane')];
  const depthSvg = document.getElementById('depth-lines');
  const depthLines = [...(depthSvg?.querySelectorAll('line') || [])];
  const status = document.getElementById('status');
  const diagnostic = document.getElementById('diagnostic-text');
  if (!scene || !marker || !layersRoot || !planes.length || !window.AAProjection) return;
  const THREE = window.AFRAME?.THREE || window.THREE;
  const started = performance.now();
  let detected = false, projected = false, rafId = 0;
  let trackedFrames = 0, invalidFrames = 0, lastReport = -1000, lastVideo = null;
  const show = (value) => {layersRoot.classList.toggle('tracked',value);};
  const say = text => {if (status.textContent !== text) status.textContent = text;};
  function updateCameraVideo() {
    const streams = [...document.querySelectorAll('video')].filter(v => v.id !== 'mirror');
    const src = streams.find(v => v.videoWidth && v.readyState >= 2);
    if (!src) return;
    if (src.srcObject && src.srcObject !== lastVideo) {
      // Mirror the existing MediaStream; never request a second camera.
      lastVideo = src.srcObject;
      let mirror = document.getElementById('mirror');
      if (!mirror) {
        mirror = document.createElement('video');
        mirror.id = 'mirror'; mirror.muted = true; mirror.autoplay = true; mirror.playsInline = true;
        mirror.setAttribute('playsinline',''); mirror.setAttribute('aria-hidden','true');
        document.body.appendChild(mirror);
      }
      mirror.srcObject = src.srcObject;
      mirror.play().then(() => document.documentElement.classList.add('video-ready')).catch(() => {});
    }
  }
  function getRect() {
    const canvas = scene.canvas || scene.querySelector('canvas');
    return canvas?.getBoundingClientRect() || null;
  }
  function render(now) {
    rafId = requestAnimationFrame(render);
    if (now - lastReport > 1250) {
      updateCameraVideo(); lastReport = now;
      const cam = scene.camera;
      const video = document.querySelector('video:not(#mirror)');
      const errors = [];
      if (!window.AFRAME?.systems?.arjs) errors.push('AR.js not initialized');
      if (!cam) errors.push('AR camera pending');
      if (!THREE) errors.push('Three.js pending');
      diagnostic.textContent = [
        `Build: V12.1 ${location.pathname.includes('ar-hd') ? 'HD' : 'STD'}`,
        `Secure context: ${isSecureContext}`,
        `Marker detected: ${detected}`,
        `Corner projection: ${projected ? 'active' : 'waiting'}`,
        `Projected frames: ${trackedFrames}, skipped: ${invalidFrames}`,
        `Camera: ${video?.videoWidth || 0}x${video?.videoHeight || 0}`,
        `Actual pose: marker 6DoF / 4 projected corners`,
        `Height layers: 0.006 / 0.065 / 0.12 / 0.19 / 0.235`,
        `Photograph: ${document.getElementById('github-photo')?.complete && document.getElementById('github-photo')?.naturalWidth ? 'loaded' : 'pending or failed'}`,
        `Issues: ${errors.join(', ') || 'none'}`
      ].join('\n');
    }
    if (!detected || !THREE || !scene.camera || !marker.object3D.visible) {
      if (projected) {projected = false; show(false);} return;
    }
    const rect = getRect();
    if (!rect) return;
    const valid = AAProjection.applyProjection(planes, height =>
      AAProjection.projectCorners(marker.object3D, scene.camera, rect, height, THREE));
    if (valid) {
      if (depthLines.length === 4) {
        const floor=AAProjection.projectCorners(marker.object3D,scene.camera,rect,0.006,THREE);
        const raised=AAProjection.projectCorners(marker.object3D,scene.camera,rect,0.28,THREE);
        depthSvg.setAttribute('viewBox',`0 0 ${window.innerWidth} ${window.innerHeight}`);
        floor.forEach((p,i) => {
          const q=raised[i],line=depthLines[i];
          if (p && q) {
            line.setAttribute('x1',p.x.toFixed(2)); line.setAttribute('y1',p.y.toFixed(2));
            line.setAttribute('x2',q.x.toFixed(2)); line.setAttribute('y2',q.y.toFixed(2));
          }
        });
      }
      trackedFrames++;
      if (!projected) {projected=true;show(true);say('AA detected. Perspective and transparent layers locked to the marker.');}
    } else {
      invalidFrames++;
      if (projected) {projected=false;show(false);}
    }
  }
  marker.addEventListener('markerFound', () => { detected = true; say('AA marker detected. Aligning projected layers...'); });
  marker.addEventListener('markerLost', () => { detected = false; projected = false; show(false);say('AA marker lost. Aim at the printed AA image.'); });
  document.getElementById('save-contact')?.addEventListener('click', () => {
    const a=document.createElement('a'); a.href='../Akbar_Abdullaev.vcf';a.download='Akbar_Abdullaev.vcf';document.body.appendChild(a);a.click();a.remove();
  });
  document.getElementById('share-profile')?.addEventListener('click',async()=>{
    const url = new URL('../index.html',location.href).href;
    try {if(navigator.share)await navigator.share({title:'Akbar Abdullaev',url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);say('Profile link copied.');}
      else window.prompt('Copy profile link:',url);
    }catch(e){if(e?.name !== 'AbortError')say('Share unavailable; open the full profile.');}
  });
  document.getElementById('restart')?.addEventListener('click',()=>location.reload());
  const photo=document.getElementById('github-photo');
  const photoFallback=()=>{photo.style.display='none';const p=document.querySelector('.photo-placeholder');if(p)p.style.display='grid';};
  photo?.addEventListener('error',photoFallback);
  if(photo?.complete && !photo.naturalWidth)photoFallback();
  const startedTicker = setInterval(updateCameraVideo,1300);
  const start=()=>{if(!rafId)rafId=requestAnimationFrame(render);};
  if (scene.hasLoaded)start();else scene.addEventListener('loaded',start,{once:true});
  if (!isSecureContext) say('HTTPS is required to access the rear camera.');
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCameraVideo();});
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(rafId);clearInterval(startedTicker);
    const mirror=document.getElementById('mirror');if(mirror){mirror.pause();mirror.srcObject=null;}
  },{once:true});
})();
