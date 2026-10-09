'use strict';
/*
 * True marker-pose projection for a transparent HTML hologram.
 * Each 512x512 plane has four corners in marker-local 3D coordinates.
 * A-Frame camera + marker matrices project the corners to the same 2D viewport
 * as the WebGL scene; CSS matrix3d maps the plane onto their quadrilateral.
 * No photo is painted into WebGL, eliminating black WebGL texture failures.
 */
(function (scope) {
  const SIZE = 512;
  const localCorners = [
    [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]
  ];
  function isFinitePoint(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }
  function polygonArea(p) {
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const b = p[(i + 1) % 4];
      sum += p[i].x * b.y - b.x * p[i].y;
    }
    return Math.abs(sum) / 2;
  }
  function homographyFromQuad(points, size = SIZE) {
    if (!Array.isArray(points) || points.length !== 4 || !points.every(isFinitePoint)) return null;
    if (!(size > 0) || !Number.isFinite(size) || polygonArea(points) < 8) return null;
    const [p0, p1, p2, p3] = points;
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
    const sx = p0.x - p1.x + p2.x - p3.x;
    const sy = p0.y - p1.y + p2.y - p3.y;
    const den = dx1 * dy2 - dx2 * dy1;
    let g = 0, h = 0;
    if (Math.abs(den) > 1e-7) {
      g = (sx * dy2 - dx2 * sy) / den;
      h = (dx1 * sy - sx * dy1) / den;
    }
    const a = p1.x - p0.x + g * p1.x;
    const b = p3.x - p0.x + h * p3.x;
    const c = p1.y - p0.y + g * p1.y;
    const d = p3.y - p0.y + h * p3.y;
    const values = [a / size, c / size, 0, g / size,
                    b / size, d / size, 0, h / size,
                    0, 0, 1, 0,
                    p0.x, p0.y, 0, 1];
    if (!values.every(Number.isFinite)) return null;
    return `matrix3d(${values.map(v => +v.toFixed(8)).join(',')})`;
  }
  function projectCorners(marker, camera, canvasRect, height, THREE) {
    if (!marker || !camera || !canvasRect || !THREE || canvasRect.width < 1 || canvasRect.height < 1) return null;
    marker.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    return localCorners.map(([x, z]) => {
      // AR.js marker surface is the XZ plane; its normal is +Y.
      const pt = new THREE.Vector3(x, height, z).applyMatrix4(marker.matrixWorld);
      pt.project(camera);
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y) || !Number.isFinite(pt.z) || pt.z > 1.5) return null;
      return {x: canvasRect.left + (pt.x + 1) * canvasRect.width / 2,
              y: canvasRect.top + (1 - pt.y) * canvasRect.height / 2};
    });
  }
  function applyProjection(elements, projector, options = {}) {
    let ok = true;
    for (const el of elements) {
      const height = Number(el.dataset.height || 0);
      const quad = projector(height);
      const transform = homographyFromQuad(quad);
      if (!transform) {ok = false; break;}
      el.style.transform = transform;
    }
    return ok;
  }
  scope.AAProjection = {SIZE, homographyFromQuad, projectCorners, applyProjection, polygonArea};
})(window);
