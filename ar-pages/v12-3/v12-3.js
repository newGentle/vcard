'use strict';
/**
 * V12.3: no 6DoF plane guessing. The 4 corners and relative orientation are
 * provided by ARToolkit's own getMarker event (marker.vertex, marker.dirPatt).
 * Keep full-screen video and overlay in the SAME cover/contain coordinate map.
 */
(() => {
  const C=window.AACorners;
  const scene=document.getElementById('scene');
  const marker=document.getElementById('aa-marker');
  const root=document.getElementById('hologram');
  const card=document.getElementById('holo-card');
  const svg=document.getElementById('raw-outline');
  const status=document.getElementById('status');
  const diagnostic=document.getElementById('diagnostic-text');
  if(!C||!scene||!marker||!root||!card)return;
  let controller=null,controllerListener=null;
  let lastMarker=null,smoothed=null,lastDirection=null,lastReport=0,lastTransform='';
  let orientation='marker',fit='cover',showCorners=false;
  let frameCount=0,rejectedFrames=0,validFrames=0,registered=false,videoSize={width:640,height:480};
  let linkedStream=null,mirror=null;
  const reportError=[];
  const markText=t=>{if(status&&status.textContent!==t)status.textContent=t;};
  const btnOrient=document.getElementById('orientation'),btnCorner=document.getElementById('show-corners'),btnFit=document.getElementById('video-fit');
  function readSaved(){try{const a=JSON.parse(sessionStorage.getItem('aa-v123-state')||'{}');if(a.orientation==='upright')orientation=a.orientation;if(a.fit==='contain')fit=a.fit;if(a.showCorners===true)showCorners=true;}catch(e){}}
  function persist(){try{sessionStorage.setItem('aa-v123-state',JSON.stringify({orientation,fit,showCorners}));}catch(e){}}
  function showOptions(){if(btnOrient)btnOrient.textContent=orientation==='marker'?'Ориентация: AA':'Ориентация: экран';
    if(btnCorner){btnCorner.textContent=showCorners?'Углы: ON':'Углы: OFF';btnCorner.classList.toggle('active',showCorners);}
    if(btnFit)btnFit.textContent='Видео: '+fit.toUpperCase();
    document.documentElement.classList.toggle('show-corners',showCorners);
    document.documentElement.classList.toggle('fit-contain',fit==='contain');
  }
  readSaved();showOptions();
  btnOrient?.addEventListener('click',()=>{orientation=orientation==='marker'?'upright':'marker';smoothed=null;lastDirection=null;persist();showOptions();});
  btnCorner?.addEventListener('click',()=>{showCorners=!showCorners;persist();showOptions();});
  btnFit?.addEventListener('click',()=>{fit=fit==='cover'?'contain':'cover';smoothed=null;persist();showOptions();});
  document.getElementById('restart')?.addEventListener('click',()=>location.reload());
  document.getElementById('save-contact')?.addEventListener('click',()=>{const a=document.createElement('a');a.href='../Akbar_Abdullaev.vcf';a.download='Akbar_Abdullaev.vcf';document.body.appendChild(a);a.click();a.remove();});
  document.getElementById('share-profile')?.addEventListener('click',async()=>{
    const url=new URL('../index.html',location.href).href;
    try{if(navigator.share)await navigator.share({title:'Akbar Abdullaev | Digital Identity',url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);markText('Ссылка на профиль скопирована.');}
      else window.prompt('Ссылка на профиль:',url);
    }catch(e){if(e?.name!=='AbortError')markText('Не удалось поделиться. Откройте профиль по ссылке.');}
  });
  const photo=document.getElementById('portrait');
  photo?.addEventListener('error',()=>{photo.style.display='none';photo.parentNode?.classList.add('photo-failed');});
  if(photo?.complete&&!photo.naturalWidth)photo.parentNode?.classList.add('photo-failed');
  function getController(){return scene.systems?.arjs?._arSession?.arContext?.arController||null;}
  function onMarker(event){
    const m=event?.data?.marker;
    if(!m||!(Number(m.idPatt)>=0))return;
    const vertices=C.orderVertices(m);
    if(!vertices)return;
    const confidence=Number(m.cfPatt);
    if(Number.isFinite(confidence)&&confidence<.34)return;
    const context=scene.systems?.arjs?._arSession?.arContext;
    const frame={
      width:context?.parameters?.canvasWidth||controller?.canvas?.width||640,
      height:context?.parameters?.canvasHeight||controller?.canvas?.height||480
    };
    lastMarker={raw:vertices,source:frame,confidence,dir:Number(m.dirPatt),seen:performance.now()};
    frameCount++;
  }
  function attachController(){
    if(controller)return;
    const source=getController();
    if(source&&typeof source.addEventListener==='function'){
      controller=source;
      controllerListener=onMarker;
      controller.addEventListener('getMarker',controllerListener);
      registered=true;
    }
  }
  function getVideo(){
    const arVideo=scene.systems?.arjs?._arSession?.arSource?.domElement;
    if(arVideo?.videoWidth)return arVideo;
    return [...document.querySelectorAll('video')].find(v=>v.id!=='camera-mirror'&&v.videoWidth>0)||null;
  }
  function attachMirror(){
    const source=getVideo();
    if(!source?.srcObject||source.srcObject===linkedStream||!source.videoWidth)return;
    if(mirror){mirror.pause();mirror.srcObject=null;mirror.remove();mirror=null;}
    linkedStream=source.srcObject;
    mirror=document.createElement('video');mirror.id='camera-mirror';mirror.muted=true;mirror.autoplay=true;mirror.playsInline=true;
    mirror.setAttribute('playsinline','');mirror.setAttribute('webkit-playsinline','');mirror.setAttribute('aria-hidden','true');
    mirror.srcObject=linkedStream;document.body.appendChild(mirror);
    mirror.play().then(()=>document.documentElement.classList.add('camera-mirror-ready')).catch(()=>{});
  }
  function viewport(){return {left:0,top:0,width:window.innerWidth,height:window.innerHeight};}
  function videoShape(){const v=getVideo();if(v?.videoWidth&&v.videoHeight)videoSize={width:v.videoWidth,height:v.videoHeight};return videoSize;}
  function updateDiagnostic(now,quad,info){
    if(now-lastReport<1100||!diagnostic)return;
    lastReport=now;
    const age=lastMarker?Math.round(now-lastMarker.seen):'none';
    const area=info?Math.round(info.area):'none';
    const bounds=info?`${Math.round(info.width)} x ${Math.round(info.height)}`:'none';
    diagnostic.textContent=[
      'Version: AA WebAR V12.3 DIRECT CORNERS',
      'HTTPS: '+!!isSecureContext+' | Controller registered: '+registered,
      'Detected marker: '+!!(lastMarker&&now-lastMarker.seen<400),
      'Pattern dirPatt: '+(lastMarker?.dir??'n/a')+' | confidence: '+(Number.isFinite(lastMarker?.confidence)?lastMarker.confidence.toFixed(2):'n/a'),
      'ARKit source canvas: '+(lastMarker?lastMarker.source.width+' x '+lastMarker.source.height:'waiting'),
      'Actual video: '+videoShape().width+' x '+videoShape().height+' | viewport: '+window.innerWidth+' x '+window.innerHeight,
      'Overlay footprint: '+bounds+' px | area '+area+' px2',
      'Options: '+orientation+' / '+fit+' / corners:'+showCorners,
      'Frame samples: '+frameCount+' | accepted: '+validFrames+' | rejected: '+rejectedFrames,
      'Photo: '+(photo?.naturalWidth>0?'loaded':'pending/fallback'),
      'Notes: '+(reportError.join(' | ')||'none')
    ].join('\n');
  }
  function drawQuad(q){
    if(!q||!svg)return;
    svg.setAttribute('viewBox',`0 0 ${window.innerWidth} ${window.innerHeight}`);
    document.getElementById('raw-polygon')?.setAttribute('points',q.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '));
    [...svg.querySelectorAll('circle')].forEach((el,i)=>{el.setAttribute('cx',q[i].x.toFixed(1));el.setAttribute('cy',q[i].y.toFixed(1));});
    const label=document.getElementById('marker-top-label');if(label){label.setAttribute('x',(q[0].x+10).toFixed(1));label.setAttribute('y',(q[0].y-10).toFixed(1));}
  }
  function frame(now){
    requestAnimationFrame(frame);
    if(!controller)attachController();
    if(Math.round(now)%1400<18)attachMirror();
    const isFresh=lastMarker&&now-lastMarker.seen<340;
    if(!isFresh){root.classList.remove('tracked');svg?.classList.remove('active');if(now>9000&&!registered)markText('ARToolKit не выдаёт углы. Проверьте загрузку AR.js.');else if(lastMarker)markText('AA не виден. Наведите камеру на маркер.');
      updateDiagnostic(now,null,null);return;}
    const params=lastMarker;
    let q=C.scaleDetectedCorners(params.raw,params.source,videoShape(),viewport(),fit);
    if(orientation==='upright'&&q)q=C.keepUpright(q);
    const metric=C.measureQuad(q);
    if(!metric?.valid){rejectedFrames++;root.classList.remove('tracked');svg?.classList.remove('active');markText('AA найден, но маркер слишком мал или под большим углом.');updateDiagnostic(now,q,metric);return;}
    const key=params.dir+'|'+orientation+'|'+fit;
    const largestDiff=smoothed?Math.max(...q.map((p,i)=>Math.hypot(p.x-smoothed[i].x,p.y-smoothed[i].y))):Infinity;
    smoothed=(!smoothed||lastDirection!==key||largestDiff>110)?q:C.interpolate(smoothed,q,.42);
    lastDirection=key;
    const tf=C.cssHomography(smoothed);
    if(tf){card.style.transform=tf;lastTransform=tf;root.classList.add('tracked');svg?.classList.add('active');validFrames++;drawQuad(smoothed);
      if(orientation==='marker')markText('✓ AA распознан: углы и верх маркера определены непосредственно ARToolkit.');
      else markText('✓ AA распознан: карточка выровнена относительно экрана.');
    }else{root.classList.remove('tracked');svg?.classList.remove('active');rejectedFrames++;}
    updateDiagnostic(now,q,metric);
  }
  if(!isSecureContext)markText('Камера требует HTTPS.');
  window.addEventListener('error',event=>{if(reportError.length<5)reportError.push(String(event.message||event.target?.src||'Unknown load error').slice(0,120));});
  let pending=0;
  const timer=setInterval(()=>{if(!controller)attachController();attachMirror();pending++;if(pending>30)clearInterval(timer);},500);
  window.addEventListener('pagehide',()=>{clearInterval(timer);if(controller&&controllerListener&&typeof controller.removeEventListener==='function')controller.removeEventListener('getMarker',controllerListener);if(mirror){mirror.pause();mirror.srcObject=null;}},{once:true});
  requestAnimationFrame(frame);
})();
