'use strict';
(() => {
 const C=window.AACorners;if(!C)return;
 const stage=document.getElementById('preview-stage'),card=document.getElementById('holo-card'),sim=document.getElementById('sim-marker');
 const roll=document.getElementById('roll'),tilt=document.getElementById('tilt'),zoom=document.getElementById('zoom');
 function repaint(){
   const w=stage.clientWidth,h=stage.clientHeight;
   const S=Math.min(w,h)*.62*Number(zoom.value)/100;
   const theta=Number(roll.value)*Math.PI/180,phi=Number(tilt.value)*Math.PI/180;
   const cs=Math.cos(theta),ss=Math.sin(theta),ct=Math.cos(phi),st=Math.sin(phi);
   const square=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
   const quad=square.map(([x,y])=>{const yr=y*ct;const z=y*st;const dx=x*cs-yr*ss,dy=x*ss+yr*cs;const perspective=1/(1-z*.75);
     return {x:w/2+dx*S*perspective,y:h/2+dy*S*perspective};});
   const tf=C.cssHomography(quad);
   if(tf){card.style.transform=tf;sim.style.transform=tf;}
   document.getElementById('roll-value').textContent=roll.value+'°';
   document.getElementById('tilt-value').textContent=tilt.value+'°';
   document.getElementById('zoom-value').textContent=zoom.value+'%';
   const m=C.measureQuad(quad);
   document.getElementById('preview-report').textContent=`Четырёхугольник: ${Math.round(m.width)} x ${Math.round(m.height)} px · площадь: ${Math.round(m.area)} · валидность: ${!!tf}`;
 }
 [roll,tilt,zoom].forEach(e=>e.addEventListener('input',repaint));window.addEventListener('resize',repaint);
 repaint();
})();
