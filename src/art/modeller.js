  /* ---------- modeller: a tiny kit for building one merged, vertex-coloured model out of primitives (art) ----------
     Used by people.js, structures.js and details.js. Not a stage builder: it only makes a BufferGeometry.
       const m = modeller();
       m.box(cx, cy, cz, w, h, d, col, o)            centred box, o.ry / o.rx / o.rz = turn in radians (about its own centre)
       m.cyl(a, b, r0, r1, seg, col, o)              tapered tube from point a to point b (arrays [x,y,z]); r0 at a, r1 at b; o.open = no end caps, o.nobottom = no bottom cap only, o.ez = squash the tube in one direction (0.6 = oval)
       m.sph(cx, cy, cz, rx, ry, rz, ws, hs, col, o) ellipsoid with ws x hs segments; o.cap = vertical angle in radians (1.57 = top half only)
       m.quad(a, b, c, d, col, o)                    one flat face from four points (counter-clockwise seen from the front); o.two = also draw the back
       m.tri(a, b, c, col, o)                        one triangle (same rules)
       m.sweep(profile, x0, x1, col, o)              a profile [[y,z],...] (closed outline, seen from +x) swept along x from x0 to x1 (guardrails, beams); o.open = an open polyline, a thin sheet drawn on both sides
       m.at(x, y, z, ry, fn)                         everything drawn inside fn() is moved and turned (turn about y) first; can be nested
       m.geo()                                       -> THREE.BufferGeometry with position, normal, color, pt, tw (indexed)
     col: [r,g,b] 0..1 in display (sRGB looking) numbers, or a function (x, y, z, ny) => [r,g,b] (x,y,z after at()).
     o.part: number used by the people shader (palette slot, see people.js) or a function (x,y,z) => number. Default 4 = "fixed colour".
     o.tw: [lean, arm, flutter, jump] numbers or a function (x,y,z) => 4 numbers. Default 0 0 0 0. In structure materials tw.x = 1 means "multiply
     by the instance colour" and tw.z = flutter (flags), see details.js. */
  const _mdV = new THREE.Vector3(), _mdN = new THREE.Vector3(), _mdUp = new THREE.Vector3(0, 1, 0), _mdQ = new THREE.Quaternion(), _mdE = new THREE.Euler(), _mdS = new THREE.Vector3(1, 1, 1), _mdM = new THREE.Matrix4(), _mdNM = new THREE.Matrix3();
  const MD_ZERO4 = [0, 0, 0, 0];
  function modeller() {
    const P = [], N = [], C = [], T = [], W = [], I = [];
    const stack = [new THREE.Matrix4()];
    const top = () => stack[stack.length - 1];
    function push(g, m, col, o) {
      const M = top().clone(); if (m) M.multiply(m);
      _mdNM.getNormalMatrix(M);
      const pos = g.attributes.position, nor = g.attributes.normal, base = P.length / 3;
      for (let i = 0; i < pos.count; i++) {
        _mdV.fromBufferAttribute(pos, i).applyMatrix4(M); _mdN.fromBufferAttribute(nor, i).applyMatrix3(_mdNM).normalize();
        P.push(_mdV.x, _mdV.y, _mdV.z); N.push(_mdN.x, _mdN.y, _mdN.z);
        const c = typeof col === 'function' ? col(_mdV.x, _mdV.y, _mdV.z, _mdN.y) : col; C.push(c[0], c[1], c[2]);
        T.push(typeof o.part === 'function' ? o.part(_mdV.x, _mdV.y, _mdV.z) : (o.part == null ? 4 : o.part));
        const w = typeof o.tw === 'function' ? o.tw(_mdV.x, _mdV.y, _mdV.z) : (o.tw || MD_ZERO4); W.push(w[0], w[1], w[2], w[3]);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + base); else for (let i = 0; i < pos.count; i++) I.push(i + base);
    }
    const api = {
      box(cx, cy, cz, w, h, d, col, o = {}) {
        _mdE.set(o.rx || 0, o.ry || 0, o.rz || 0); _mdQ.setFromEuler(_mdE); _mdS.set(w, h, d); _mdM.compose(new THREE.Vector3(cx, cy, cz), _mdQ, _mdS);
        push(MD_BOX, _mdM, col, o);
      },
      cyl(a, b, r0, r1, seg, col, o = {}) {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6;
        const key = seg + (o.open ? 'o' : 'c'), g = (MD_CYL[key] || (MD_CYL[key] = new THREE.CylinderGeometry(1, 1, 1, seg, 1, !!o.open)));
        // the unit cylinder is rebuilt per call with the right radii (top = b end): scale the x/z of vertices by lerping radius
        const geo = g.clone(), p = geo.attributes.position;
        if (o.nobottom && !o.open && geo.groups.length > 2) { const g2 = geo.groups[2], arr = Array.from(geo.index.array); arr.splice(g2.start, g2.count); geo.setIndex(arr); }     // no bottom cap (hidden)
        for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y + 0.5, r = r0 + (r1 - r0) * t; p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r * (o.ez || 1)); }
        // normals of a tapered tube lean outwards by the taper; the unit cylinder's side normals are fine for small tapers
        _mdQ.setFromUnitVectors(_mdUp, _mdV.set(dx / len, dy / len, dz / len)); _mdS.set(1, len, 1);
        _mdM.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _mdQ, _mdS);
        push(geo, _mdM, col, o); geo.dispose();
      },
      sph(cx, cy, cz, rx, ry, rz, ws, hs, col, o = {}) {
        const geo = new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, 0, o.cap || Math.PI);
        _mdE.set(o.rx || 0, o.ry || 0, o.rz || 0); _mdQ.setFromEuler(_mdE); _mdS.set(rx, ry, rz); _mdM.compose(new THREE.Vector3(cx, cy, cz), _mdQ, _mdS);
        push(geo, _mdM, col, o); geo.dispose();
      },
      quad(a, b, c, d, col, o = {}) {
        const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), l = Math.hypot(nx, ny, nz) || 1;
        const mk = (s) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [nx / l * s, ny / l * s, nz / l * s]), 3)); q.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); return q; };
        const f = mk(1); push(f, null, col, o); f.dispose();
        if (o.two) { const k = mk(-1); push(k, null, col, o); k.dispose(); }
      },
      tri(a, b, c, col, o = {}) { api.quad(a, b, c, c, col, o); },
      sweep(prof, x0, x1, col, o = {}) {
        if (o.open) {                                                                                      // an open polyline: a thin sheet, both sides drawn
          for (let i = 0; i < prof.length - 1; i++) { const [y0, z0] = prof[i], [y1, z1] = prof[i + 1]; api.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], col, { part: o.part, tw: o.tw, two: true }); }
          return;
        }
        let cy = 0, cz = 0; for (const [y, z] of prof) { cy += y; cz += z; } cy /= prof.length; cz /= prof.length;
        for (let i = 0; i < prof.length; i++) {
          const [y0, z0] = prof[i], [y1, z1] = prof[(i + 1) % prof.length];
          const ny = z1 - z0, nz = -(y1 - y0), s = (ny * (y0 - cy) + nz * (z0 - cz)) >= 0 ? 1 : -1;       // outward: away from the middle
          if (s > 0) api.quad([x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0], col, o);            // winding decides which side is the front
          else api.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], col, o);
        }
      },
      at(x, y, z, ry, fn) {
        const M = top().clone().multiply(_mdM.makeRotationY(ry || 0).setPosition(x, y, z));
        stack.push(M); fn(); stack.pop();
      },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('pt', new THREE.Float32BufferAttribute(T, 1)); g.setAttribute('tw', new THREE.Float32BufferAttribute(W, 4));
        g.setIndex(I); g.userData.keep = true; return g;
      },
      get tris() { return I.length / 3; },
    };
    return api;
  }
  const MD_BOX = new THREE.BoxGeometry(1, 1, 1), MD_CYL = {};
