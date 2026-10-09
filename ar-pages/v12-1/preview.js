'use strict';
(() => {
  const stage = document.getElementById('preview-stage');
  const marker = document.getElementById('sim-marker');
  const layers = [...document.querySelectorAll('.projected-plane')];
  const controlIds = ['roll','tilt','zoom'];
  const inputs = Object.fromEntries(controlIds.map(id => [id,document.getElementById(id)]));
  if(!stage || !marker || !window.AAProjection)return;
  const radians = v => Number(v)*Math.PI/180;
  function quadForHeight(height, roll, tilt, scale) {
    const centerX=stage.clientWidth/2, centerY=stage.clientHeight/2;
    const nominal=Math.min(stage.clientWidth,stage.clientHeight)*0.54*scale;
    const cr=Math.cos(roll),sr=Math.sin(roll),ct=Math.cos(tilt),st=Math.sin(tilt);
    const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    return points.map(([x,z])=>{
      let py=z*ct-height*st;
      const depth=z*st+height*ct;
      const px=x*cr-py*sr;
      py=x*sr+py*cr;
      const distanceFactor=1/(1-depth/3);
      return {x:centerX+px*nominal*distanceFactor,y:centerY+py*nominal*distanceFactor};
    });
  }
  function repaint(){
    const roll=radians(inputs.roll.value),tilt=radians(inputs.tilt.value),scale=Number(inputs.zoom.value)/100;
    const project=height=>quadForHeight(height,roll,tilt,scale);
    const ok=AAProjection.applyProjection(layers,project);
    const a=AAProjection.homographyFromQuad(project(0));
    if(a)marker.style.transform=a;
    const floor=project(0.006),raised=project(0.28);
    const svg=document.getElementById('depth-lines');
    if(svg){
      svg.setAttribute('viewBox',`0 0 ${stage.clientWidth} ${stage.clientHeight}`);
      [...svg.querySelectorAll('line')].forEach((line,i)=>{
        line.setAttribute('x1',floor[i].x);line.setAttribute('y1',floor[i].y);
        line.setAttribute('x2',raised[i].x);line.setAttribute('y2',raised[i].y);
      });
    }
    document.getElementById('roll-value').textContent=`${inputs.roll.value} degrees`;
    document.getElementById('tilt-value').textContent=`${inputs.tilt.value} degrees`;
    document.getElementById('zoom-value').textContent=`${scale.toFixed(2)}x`;
    stage.dataset.projection=ok?'valid':'invalid';
  }
  Object.values(inputs).forEach(el=>el.addEventListener('input',repaint));
  window.addEventListener('resize',repaint);
  document.getElementById('github-photo')?.addEventListener('error',function(){this.style.display='none';document.querySelector('.photo-placeholder').style.display='grid';});
  repaint();
})();
