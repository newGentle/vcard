'use strict';
/**
 * AA WebAR V12.3. Marker vertices come DIRECTLY from jsartoolkit's getMarker
 * event, in the controller's source-image coordinates. No guessed XY/XZ pose,
 * no projectionMatrix guess, no camera intrinsics approximation.
 *
 * ARToolkit JS API: vertex[(4-dir)%4] is the marker-image top-left corner;
 * remaining vertices proceed clockwise. This is the key to reliable rotation.
 */
(function(root){
  const SOURCE_SIZE=600;
  const mod=(x,n)=>((x%n)+n)%n;
  const isFinitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  function rawPoints(marker){
    if(!marker||!marker.vertex||marker.vertex.length!==4)return null;
    const pts=Array.from(marker.vertex,v=>{
      if(Array.isArray(v)||ArrayBuffer.isView(v))return {x:Number(v[0]),y:Number(v[1])};
      return {x:Number(v?.x),y:Number(v?.y)};
    });
    return pts.every(isFinitePoint)?pts:null;
  }
  function orderVertices(marker){
    const pts=rawPoints(marker);if(!pts)return null;
    const d=Number.isFinite(Number(marker.dirPatt))?Number(marker.dirPatt):Number(marker.dir);
    const rotation=Number.isInteger(d)?mod(d,4):0;
    const start=mod(4-rotation,4);
    return [0,1,2,3].map(i=>pts[(start+i)%4]);
  }
  function keepUpright(pts){
    const a=pts[0],b=pts[1];
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    const steps=Math.round(angle/(Math.PI/2));
    return [0,1,2,3].map(i=>pts[mod(i-steps,4)]);
  }
  function displayRect(frame,viewport,fit='cover'){
    if(!frame||!viewport||frame.width<1||frame.height<1||viewport.width<1||viewport.height<1)return null;
    const scale=(fit==='contain'?Math.min:Math.max)(viewport.width/frame.width,viewport.height/frame.height);
    const width=frame.width*scale,height=frame.height*scale;
    return {left:viewport.left+(viewport.width-width)/2,top:viewport.top+(viewport.height-height)/2,width,height,scale};
  }
  function scaleDetectedCorners(pts,source,video,viewport,fit='cover'){
    if(!Array.isArray(pts)||pts.length!==4||!pts.every(isFinitePoint)||!source||source.width<1||source.height<1)return null;
    const rect=displayRect(video,viewport,fit);if(!rect)return null;
    return pts.map(p=>({x:rect.left+(p.x/source.width)*rect.width,y:rect.top+(p.y/source.height)*rect.height}));
  }
  function signedArea(p){let v=0;for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4];v+=a.x*b.y-b.x*a.y;}return v/2;}
  function measureQuad(pts){
    if(!pts||pts.length!==4||!pts.every(isFinitePoint))return null;
    const area=Math.abs(signedArea(pts));
    const edges=pts.map((p,i)=>Math.hypot(p.x-pts[(i+1)%4].x,p.y-pts[(i+1)%4].y));
    const cross=pts.map((p,i)=>{const b=pts[(i+1)%4],c=pts[(i+2)%4];return (b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x);});
    const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
    const minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
    const convex=cross.every(v=>v>0.01)||cross.every(v=>v< -0.01);
    return {area,edges,convex,width:maxX-minX,height:maxY-minY,minX,minY,maxX,maxY,
      valid:convex&&area>250&&Math.min(...edges)>12&&Math.max(...edges)<10000};
  }
  function cssHomography(p,size=SOURCE_SIZE){
    const m=measureQuad(p);if(!m?.valid||size<=0)return null;
    const [tl,tr,br,bl]=p;
    const dx1=tr.x-br.x,dx2=bl.x-br.x,dy1=tr.y-br.y,dy2=bl.y-br.y;
    const sx=tl.x-tr.x+br.x-bl.x,sy=tl.y-tr.y+br.y-bl.y;
    const den=dx1*dy2-dx2*dy1;
    let g=0,h=0;
    if(Math.abs(den)>1e-9){g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}
    const a=tr.x-tl.x+g*tr.x,b=bl.x-tl.x+h*bl.x;
    const c=tr.y-tl.y+g*tr.y,d=bl.y-tl.y+h*bl.y;
    const n=[a/size,c/size,0,g/size,b/size,d/size,0,h/size,0,0,1,0,tl.x,tl.y,0,1];
    return n.every(Number.isFinite)?'matrix3d('+n.map(x=>x.toFixed(10)).join(',')+')':null;
  }
  function interpolate(previous,next,alpha){if(!previous||previous.length!==4)return next.map(p=>({...p}));return next.map((p,i)=>({x:previous[i].x*(1-alpha)+p.x*alpha,y:previous[i].y*(1-alpha)+p.y*alpha}));}
  root.AACorners={SOURCE_SIZE,rawPoints,orderVertices,keepUpright,displayRect,scaleDetectedCorners,signedArea,measureQuad,cssHomography,interpolate};
})(typeof window==='undefined'?globalThis:window);
