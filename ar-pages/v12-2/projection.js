'use strict';
/* Perspective mapping from an actual AR.js marker pose.
 * AR.js pose conventions differ between integrations. A rigid fiducial plane
 * must be identified (XY vs XZ) before projecting its corners. Otherwise the
 * marker can be detected while its "card" collapses to an edge-on strip.
 */
(function(scope) {
  const SIZE = 512;
  const CANDIDATE_PLANES = ['XY', 'XZ'];
  // Canvas top-left, top-right, bottom-right, bottom-left (v is upward).
  const corners = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];
  const finite = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function signedArea(pts) {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }
  function polygonArea(pts) { return Array.isArray(pts) && pts.length === 4 && pts.every(finite) ? Math.abs(signedArea(pts)) : 0; }
  function evaluateQuad(pts, viewport) {
    if (!(polygonArea(pts) >= 18)) return null;
    const edges = pts.map((p,i)=>Math.hypot(p.x - pts[(i+1)%4].x, p.y - pts[(i+1)%4].y));
    const shortest = Math.min(...edges), longest = Math.max(...edges);
    if (shortest < 3 || !Number.isFinite(longest) || longest > 20000) return null;
    const cross = pts.map((p,i) => {
      const q=pts[(i+1)%4], r=pts[(i+2)%4];
      return (q.x-p.x)*(r.y-q.y) - (q.y-p.y)*(r.x-q.x);
    });
    if (!cross.every(n => n > 0.00001) && !cross.every(n => n < -0.00001)) return null;
    let minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x));
    let minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
    const width=maxX-minX,height=maxY-minY, area=polygonArea(pts);
    if (!Number.isFinite(area)) return null;
    if(viewport){
      const w=viewport.width,h=viewport.height;
      if (maxX < viewport.left - w*.25 || minX > viewport.left+w*1.25 ||
          maxY < viewport.top-h*.25 || minY > viewport.top+h*1.25) return null;
      if (width > w*3.8 || height>h*3.8) return null;
    }
    const thinness = shortest/longest;
    // The correct image plane has a much larger projected area when viewed
    // head-on. Penalize collapsed edge-on quadrilaterals.
    const score=area * Math.min(1, thinness * 2.5);
    return {area,score,width,height,minX,maxX,minY,maxY,thinness};
  }
  function homographyFromQuad(points, size=SIZE){
    if (!Array.isArray(points)||points.length!==4||!points.every(finite)||!Number.isFinite(size)||size<=0||polygonArea(points)<8) return null;
    const [p0,p1,p2,p3]=points;
    const dx1=p1.x-p2.x,dx2=p3.x-p2.x;
    const dy1=p1.y-p2.y,dy2=p3.y-p2.y;
    const sx=p0.x-p1.x+p2.x-p3.x,sy=p0.y-p1.y+p2.y-p3.y;
    const den=dx1*dy2-dx2*dy1;
    let g=0,h=0;
    if(Math.abs(den)>1e-8){g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}
    const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x;
    const c=p1.y-p0.y+g*p1.y,d=p3.y-p0.y+h*p3.y;
    const vals=[a/size,c/size,0,g/size,b/size,d/size,0,h/size,0,0,1,0,p0.x,p0.y,0,1];
    return vals.every(Number.isFinite)?`matrix3d(${vals.map(v=>+v.toFixed(9)).join(',')})`:null;
  }
  function projectCorners(marker, camera, rect, offset, THREE, plane='XY', turns=0){
    if (!marker || !camera || !THREE?.Vector3 || !rect || rect.width<1 ||rect.height<1 || !CANDIDATE_PLANES.includes(plane)) return null;
    marker.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const theta=turns*Math.PI/2,cos=Math.cos(theta),sin=Math.sin(theta);
    const out=[];
    for (const [x,y] of corners){
      const u=x*cos-y*sin, v=x*sin+y*cos;
      // The important fix: XY uses +Z as its elevation axis.
      // XZ remains as compatibility option with +Y as elevation axis.
      const pt=plane==='XY' ? new THREE.Vector3(u,v,offset) : new THREE.Vector3(u,offset,-v);
      pt.applyMatrix4(marker.matrixWorld).project(camera);
      if (![pt.x,pt.y,pt.z].every(Number.isFinite) || pt.z < -1.05 || pt.z > 1.05) return null;
      out.push({x:rect.left+(pt.x+1)*rect.width/2,
                y:rect.top+(1-pt.y)*rect.height/2});
    }
    return out;
  }
  function chooseProjection(marker,camera,rect,THREE,mode='AUTO',turns=0,viewportRect=null){
    const modes=mode==='AUTO'?CANDIDATE_PLANES:[mode];
    const candidates=modes.map(plane=>{
      const corners=projectCorners(marker,camera,rect,0,THREE,plane,turns);
      const metric=evaluateQuad(corners,viewportRect||rect);
      return {plane,corners,metric};
    });
    const ranked=candidates.filter(c=>c.metric).sort((a,b)=>b.metric.score-a.metric.score);
    return {chosen: ranked[0]||null, candidates};
  }
  function applyProjection(elements,projector,rect) {
    const staged=[];
    for (const el of elements){
      const quad=projector(Number(el.dataset.height||0));
      const metric=evaluateQuad(quad,rect);
      const transform=metric?homographyFromQuad(quad):null;
      if(!transform) return false;
      staged.push([el,transform]);
    }
    for(const [el,transform] of staged) el.style.transform=transform;
    return true;
  }
  scope.AAProjection={SIZE,CANDIDATE_PLANES,polygonArea,evaluateQuad,homographyFromQuad,projectCorners,chooseProjection,applyProjection};
})(window);
