'use strict';
(() => {
  const scene=document.getElementById('scene');
  const marker=document.getElementById('aa-marker');
  const layersRoot=document.getElementById('hologram');
  const planes=[...document.querySelectorAll('.projected-plane')];
  const depthSvg=document.getElementById('depth-lines');
  const depthLines=[...(depthSvg?.querySelectorAll('line')||[])];
  const status=document.getElementById('status');
  const diagnostic=document.getElementById('diagnostic-text');
  const planeButton=document.getElementById('plane-mode');
  const rotateButton=document.getElementById('rotate-model');
  const planeInfo=document.getElementById('plane-info');
  const fitButton=document.getElementById('camera-fit');
  const P=window.AAProjection;
  if(!scene||!marker||!layersRoot||!P||!planes.length)return;
  const THREE=window.AFRAME?.THREE||window.THREE;
  let detected=false,projected=false,rafId=0,autoChoice=null;
  let trackedFrames=0,invalidFrames=0,lastReport=-1e5,lastVideo=null;
  let planeMode='AUTO',quarterTurns=0,fitMode='COVER';
  try{
    const saved=sessionStorage.getItem('aa-v122-calibration');
    if(saved){const state=JSON.parse(saved);if(['AUTO','XY','XZ'].includes(state.mode))planeMode=state.mode;
      if(Number.isInteger(state.turn)&&state.turn>=0&&state.turn<=3)quarterTurns=state.turn;
      if(['COVER','SCREEN'].includes(state.fit))fitMode=state.fit;}
  }catch(e){}
  function persist(){try{sessionStorage.setItem('aa-v122-calibration',JSON.stringify({mode:planeMode,turn:quarterTurns,fit:fitMode}));}catch(e){}}
  function calibrate(){autoChoice=null;projected=false;layersRoot.classList.remove('tracked');updateButtons();}
  function updateButtons(){
    if(planeButton)planeButton.textContent='Plane '+planeMode+(autoChoice?' / '+autoChoice:'');
    if(rotateButton)rotateButton.textContent='Rotate '+(quarterTurns*90)+'°';
    if(fitButton)fitButton.textContent='Fit '+fitMode;
    if(planeInfo)planeInfo.textContent=planeMode==='AUTO'?'AUTO selects visible marker surface':'Calibration mode '+planeMode;
  }
  planeButton?.addEventListener('click',()=>{planeMode=planeMode==='AUTO'?'XY':planeMode==='XY'?'XZ':'AUTO';persist();calibrate();});
  rotateButton?.addEventListener('click',()=>{quarterTurns=(quarterTurns+1)%4;persist();calibrate();});
  fitButton?.addEventListener('click',()=>{fitMode=fitMode==='COVER'?'SCREEN':'COVER';persist();calibrate();});
  updateButtons();
  const show=v=>layersRoot.classList.toggle('tracked',v);
  const say=t=>{if(status&&status.textContent!==t)status.textContent=t;};
  function updateCameraVideo(){
    const streams=[...document.querySelectorAll('video')].filter(v=>v.id!=='mirror');
    const src=streams.find(v=>v.videoWidth&&v.readyState>=2);
    if(!src)return;
    if(src.srcObject&&src.srcObject!==lastVideo){
      lastVideo=src.srcObject;
      let mirror=document.getElementById('mirror');
      if(!mirror){mirror=document.createElement('video');mirror.id='mirror';mirror.muted=true;
        mirror.autoplay=true;mirror.playsInline=true;mirror.setAttribute('playsinline','');
        mirror.setAttribute('aria-hidden','true');document.body.appendChild(mirror);}
      mirror.srcObject=src.srcObject;
      mirror.play().then(()=>document.documentElement.classList.add('video-ready')).catch(()=>{});
    }
  }
  function getRect(){const canvas=scene.canvas||scene.querySelector('canvas');return canvas?.getBoundingClientRect()||null;}
  function getCameraProjectionRect(viewport){
    if(fitMode==='SCREEN')return viewport;
    // Object-fit:cover crops the 4:3 camera into the 9:20 portrait display.
    // Camera NDC projection must use the *uncropped* 4:3 coordinate system.
    // Mapping with viewport.width directly compresses the x axis ~3x.
    const video=document.querySelector('video:not(#mirror)');
    const srcW=video?.videoWidth|| (location.pathname.includes('ar-hd')?960:640);
    const srcH=video?.videoHeight||(location.pathname.includes('ar-hd')?720:480);
    const aspect=srcW/srcH;
    const coverW=Math.max(viewport.width,viewport.height*aspect);
    const coverH=Math.max(viewport.height,viewport.width/aspect);
    return {left:viewport.left+(viewport.width-coverW)/2,
      top:viewport.top+(viewport.height-coverH)/2,width:coverW,height:coverH};
  }
  const metrics=plane=>{
    const viewport=getRect();if(!viewport||!scene.camera||!THREE)return null;
    const cover=getCameraProjectionRect(viewport);
    const quad=P.projectCorners(marker.object3D,scene.camera,cover,0,THREE,plane,quarterTurns);
    return P.evaluateQuad(quad,viewport);
  };
  function render(now){
    rafId=requestAnimationFrame(render);
    if(now-lastReport>1400){
      lastReport=now;updateCameraVideo();
      const video=document.querySelector('video:not(#mirror)');
      const xy=detected?metrics('XY'):null,xz=detected?metrics('XZ'):null;
      const canvas=getRect();
      const cover=canvas?getCameraProjectionRect(canvas):null;
      if(diagnostic) diagnostic.textContent=[
        'Build: V12.2 / auto plane calibration',
        'HTTPS: '+!!window.isSecureContext,
        'Marker detected: '+detected,
        'Pose projection: '+(projected?'VALID':'waiting'),
        'Calibration: '+planeMode+'; selected: '+(autoChoice||'none')+'; turn '+quarterTurns*90+'deg; fit='+fitMode,
        'XY marker footprint: '+(xy?`${Math.round(xy.width)} x ${Math.round(xy.height)} px (area ${Math.round(xy.area)})`:'edge-on / unavailable'),
        'XZ marker footprint: '+(xz?`${Math.round(xz.width)} x ${Math.round(xz.height)} px (area ${Math.round(xz.area)})`:'edge-on / unavailable'),
        'Display canvas: '+(canvas?`${Math.round(canvas.width)}x${Math.round(canvas.height)}`:'pending'),
        'Camera cover rect: '+(cover?`${Math.round(cover.width)}x${Math.round(cover.height)} offset ${Math.round(cover.left)},${Math.round(cover.top)}`:'pending'),
        'Camera stream: '+(video?`${video.videoWidth}x${video.videoHeight}`:'pending'),
        'Photo: '+(document.getElementById('github-photo')?.naturalWidth?'loaded':'pending/fallback'),
        'Valid / invalid frames: '+trackedFrames+' / '+invalidFrames
      ].join('\n');
    }
    if(!detected||!THREE||!scene.camera||!marker.object3D.visible){
      if(projected){projected=false;show(false);}return;
    }
    const viewport=getRect();if(!viewport)return;
    const rect=getCameraProjectionRect(viewport);
    if(planeMode==='AUTO'&&!autoChoice){
      const result=P.chooseProjection(marker.object3D,scene.camera,rect,THREE,'AUTO',quarterTurns,viewport);
      if(result.chosen){autoChoice=result.chosen.plane;updateButtons();}
    }
    const plane=planeMode==='AUTO'?autoChoice:planeMode;
    if(!plane){invalidFrames++;say('AA found. The marker is edge-on: tilt toward the camera.');return;}
    const get=height=>P.projectCorners(marker.object3D,scene.camera,rect,height,THREE,plane,quarterTurns);
    const good=P.applyProjection(planes,get,viewport);
    if(good){
      if(depthSvg&&depthLines.length===4){
        const floor=get(0.006),raised=get(0.28);
        depthSvg.setAttribute('viewBox',`0 0 ${window.innerWidth} ${window.innerHeight}`);
        if(floor&&raised)floor.forEach((p,i)=>{
          const q=raised[i],line=depthLines[i];
          line.setAttribute('x1',p.x.toFixed(2));line.setAttribute('y1',p.y.toFixed(2));
          line.setAttribute('x2',q.x.toFixed(2));line.setAttribute('y2',q.y.toFixed(2));
        });
      }
      trackedFrames++;
      if(!projected){projected=true;show(true);say('AA recognized. '+plane+' perspective anchored to marker.');}
    }else{
      invalidFrames++;if(projected){projected=false;show(false);say('AA found, but projection is edge-on. Change camera angle or plane mode.');}
    }
  }
  marker.addEventListener('markerFound',()=>{detected=true;autoChoice=null;say('AA recognized. Calibrating marker geometry...');});
  marker.addEventListener('markerLost',()=>{detected=false;autoChoice=null;projected=false;show(false);say('AA marker lost. Aim at the AA image.');});
  document.getElementById('save-contact')?.addEventListener('click',()=>{
    const a=document.createElement('a');a.href='../Akbar_Abdullaev.vcf';a.download='Akbar_Abdullaev.vcf';
    document.body.appendChild(a);a.click();a.remove();
  });
  document.getElementById('share-profile')?.addEventListener('click',async()=>{
    const url=new URL('../index.html',location.href).href;
    try{if(navigator.share)await navigator.share({title:'Akbar Abdullaev',url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);say('Profile link copied.');}
      else window.prompt('Copy profile link:',url);
    }catch(e){if(e?.name!=='AbortError')say('Sharing unavailable. Use the profile URL.');}
  });
  document.getElementById('restart')?.addEventListener('click',()=>location.reload());
  const photo=document.getElementById('github-photo');
  const fallback=()=>{if(photo)photo.style.display='none';const e=document.querySelector('.photo-placeholder');if(e)e.style.display='grid';};
  photo?.addEventListener('error',fallback);if(photo?.complete&&!photo.naturalWidth)fallback();
  const ticker=setInterval(updateCameraVideo,1300);
  const start=()=>{if(!rafId)rafId=requestAnimationFrame(render);};
  if(scene.hasLoaded)start();else scene.addEventListener('loaded',start,{once:true});
  if(!isSecureContext)say('HTTPS required for camera access.');
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCameraVideo();});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(rafId);clearInterval(ticker);
    const mirror=document.getElementById('mirror');if(mirror){mirror.pause();mirror.srcObject=null;}},{once:true});
})();
