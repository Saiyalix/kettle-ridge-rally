  /* ---------- castle blockout (SS4): meshes made from castleLayout() (src/tracks/castle.js) ----------
     Simple geometry only: boxes, cylinders, cones and roofs with the stone and roof textures, as five meshes (stone, roof, moat water,
     plus the houses from buildings()). Art rebuilds the look from the same layout data; collisions come from castleObstacles(), not from these meshes. */
  function buildCastle(L) {
    const stone = geoBuilder(), roof = geoBuilder(), lvl = L.level, base = lvl - 3, TILE = 4, WHITE = [1, 1, 1];
    const tone = (k) => { const s = 0.92 + 0.08 * Math.sin(k * 12.9898); return [s, s, s * 0.98]; };
    // a flat face (3 or 4 points [x,y,z]) whose front looks along `out`; uv in metres
    const face = (b, pts, col, out, uv) => {
      const ids = pts.map(p => { const [u, v] = uv ? uv(p) : [(p[0] + p[2]) / TILE, p[1] / TILE]; return b.v(p[0], p[1], p[2], u, v, col); });
      if (ids.length === 4) b.quad(ids[0], ids[1], ids[2], ids[3], out);
      else {
        const [a, c, d] = pts, n = [(c[1] - a[1]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[1] - a[1]), (c[2] - a[2]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[2] - a[2]), (c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])];
        if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0) b.tri(ids[0], ids[1], ids[2]); else b.tri(ids[0], ids[2], ids[1]);
      }
    };
    // a prism over a convex footprint [[x,z],...] from ya to yb: sides, top, optional underside
    const prism = (poly, ya, yb, col, o = {}) => {
      const n = poly.length; let cx = 0, cz = 0, per = 0;
      for (const p of poly) { cx += p[0] / n; cz += p[1] / n; }
      for (let i = 0; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]), u0 = per / TILE, u1 = (per + len) / TILE; per += len;
        face(stone, [[p[0], ya, p[1]], [q[0], ya, q[1]], [q[0], yb, q[1]], [p[0], yb, p[1]]], col, [(p[0] + q[0]) / 2 - cx, 0, (p[1] + q[1]) / 2 - cz],
          pt => [Math.hypot(pt[0] - p[0], pt[2] - p[1]) < 1e-6 ? u0 : u1, pt[1] / TILE]);
      }
      const cap = (y, dir) => { for (let i = 1; i < n - 1; i++) face(stone, [[poly[0][0], y, poly[0][1]], [poly[i][0], y, poly[i][1]], [poly[i + 1][0], y, poly[i + 1][1]]], col, [0, dir, 0], pt => [pt[0] / TILE, pt[2] / TILE]); };
      if (!o.noTop) cap(yb, 1);
      if (o.bottom) cap(ya, -1);
    };
    const boxPoly = (cx, cz, yaw, w, d) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [cx + a * c + b * s, cz - a * s + b * c]); };
    const ngon = (cx, cz, r, n, rot = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(rot + i / n * 6.2832) * r, cz + Math.sin(rot + i / n * 6.2832) * r]);
    // a pyramid or cone over a footprint (roof): apex above the middle
    const fan = (poly, y, rise, col) => {
      let cx = 0, cz = 0; for (const p of poly) { cx += p[0] / poly.length; cz += p[1] / poly.length; }
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        face(roof, [[p[0], y, p[1]], [q[0], y, q[1]], [cx, y + rise, cz]], col, [(p[0] + q[0]) / 2 - cx, 0.7, (p[1] + q[1]) / 2 - cz], pt => [(pt[0] + pt[2]) / 5, (pt[1] - y) / 3]);
      }
    };
    const ROOF = [0.62, 0.34, 0.26], ROOF2 = [0.42, 0.40, 0.46];
    // curtain walls with a battlement (merlons) on both edges
    L.walls.forEach((w, k) => {
      const dx = w.bx - w.ax, dz = w.bz - w.az, len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len, nx = -tz, nz = tx, ht = w.thick / 2;
      prism([[w.ax + nx * ht, w.az + nz * ht], [w.bx + nx * ht, w.bz + nz * ht], [w.bx - nx * ht, w.bz - nz * ht], [w.ax - nx * ht, w.az - nz * ht]], base, lvl + w.h, tone(k));
      for (let a = 1.2; a < len - 1; a += 3.2) for (const sd of [-1, 1]) {
        const cx = w.ax + tx * a + nx * sd * (ht - 0.35), cz = w.az + tz * a + nz * sd * (ht - 0.35);
        prism(boxPoly(cx, cz, Math.atan2(tx, tz) + Math.PI / 2, 1.8, 0.7), lvl + w.h, lvl + w.h + L.merlonH, tone(a + k));
      }
    });
    // towers: stone cylinder, a ring of merlon blocks at the top edge for the low ones, a cone roof on the tall ones
    L.towers.forEach((t, k) => {
      prism(ngon(t.x, t.z, t.r, 16), base, lvl + t.h, tone(k + 3));
      if (t.kind === 'mid') { for (const [x, z] of ngon(t.x, t.z, t.r - 0.4, 8)) prism(boxPoly(x, z, 0, 1.4, 1.4), lvl + t.h, lvl + t.h + L.merlonH, tone(x)); }
      else fan(ngon(t.x, t.z, t.r + 0.7, 16), lvl + t.h, t.r * 1.9, k % 2 ? ROOF2 : ROOF);
    });
    // gatehouses: a block each side of the passage and the lintel over it (underside = the arch ceiling)
    for (const g of L.gatehouses) {
      const fx = Math.sin(g.th), fz = Math.cos(g.th), rx = -Math.cos(g.th), rz = Math.sin(g.th), d = g.depth / 2;
      const gp = (a, l) => [g.x + fx * a + rx * l, g.z + fz * a + rz * l];
      for (const sd of [-1, 1]) {
        const l0 = sd * g.half, l1 = sd * (g.half + g.blockW);
        prism([gp(-d, l0), gp(d, l0), gp(d, l1), gp(-d, l1)], base, lvl + g.h, WHITE);
        for (let a = -d + 0.6; a < d; a += 3.2) prism(boxPoly(...gp(a, sd * (g.half + g.blockW - 0.4)), Math.atan2(fx, fz) + Math.PI / 2, 1.8, 0.7), lvl + g.h, lvl + g.h + L.merlonH, WHITE);
      }
      prism([gp(-d, -g.half), gp(d, -g.half), gp(d, g.half), gp(-d, g.half)], lvl + g.passageH, lvl + g.h, WHITE, { bottom: true });
      for (let l = -g.half; l < g.half; l += 3.2) for (const a of [-d + 0.35, d - 0.35]) prism(boxPoly(...gp(a, l + 1.2), Math.atan2(fx, fz), 1.8, 0.7), lvl + g.h, lvl + g.h + L.merlonH, WHITE);
    }
    // castle buildings (blockout). Houses from buildings() are collected and made below.
    const houses = [];
    for (const b of L.buildings) {
      if (b.builder === 'house') { houses.push({ x: b.x, y: terrain.heightAt(b.x, b.z) + 0.3, z: b.z, yaw: b.yaw, w: b.w, d: b.d, h: b.h, style: b.style, tint: [1, 0.92, 0.8], roof: b.roof }); continue; }
      const poly = boxPoly(b.x, b.z, b.yaw, b.w, b.d), top = lvl + b.h, col = b.kind === 'keep' ? [0.86, 0.84, 0.82] : WHITE;
      prism(poly, base, top, col);
      if (b.kind === 'keep') {                                                          // battlement ring and a pointed roof
        for (let a = -b.w / 2 + 1; a < b.w / 2; a += 3) for (const sd of [-1, 1]) {
          const c = Math.cos(b.yaw), s = Math.sin(b.yaw), l = (u, v) => [b.x + u * c + v * s, b.z - u * s + v * c];
          prism(boxPoly(...l(a, sd * (b.d / 2 - 0.4)), b.yaw, 1.8, 0.8), top, top + 1.2, col);
          prism(boxPoly(...l(sd * (b.w / 2 - 0.4), a * b.d / b.w), b.yaw, 0.8, 1.8), top, top + 1.2, col);
        }
        fan(boxPoly(b.x, b.z, b.yaw, b.w - 5, b.d - 5), top + 1.2, 11, ROOF2);
      } else if (b.roof === 'gable') {                                                  // ridge along the width
        const c = Math.cos(b.yaw), s = Math.sin(b.yaw), l = (u, v) => [b.x + u * c + v * s, b.z - u * s + v * c], rh = b.d * 0.42, ov = 0.7;
        const A = l(-b.w / 2 - ov, -b.d / 2 - ov), B = l(b.w / 2 + ov, -b.d / 2 - ov), Cc = l(b.w / 2 + ov, b.d / 2 + ov), D = l(-b.w / 2 - ov, b.d / 2 + ov), R0 = l(-b.w / 2 - ov, 0), R1 = l(b.w / 2 + ov, 0);
        const P3 = (p, y) => [p[0], y, p[1]];
        const roofUv = pt => [(pt[0] + pt[2]) / 5, (pt[1] - top) / 3];
        face(roof, [P3(A, top), P3(B, top), P3(R1, top + rh), P3(R0, top + rh)], ROOF, [A[0] - D[0], 0.8, A[1] - D[1]], roofUv);
        face(roof, [P3(D, top), P3(Cc, top), P3(R1, top + rh), P3(R0, top + rh)], ROOF, [D[0] - A[0], 0.8, D[1] - A[1]], roofUv);
        const E0 = l(-b.w / 2, -b.d / 2), E1 = l(-b.w / 2, b.d / 2), F0 = l(b.w / 2, -b.d / 2), F1 = l(b.w / 2, b.d / 2), M0 = l(-b.w / 2, 0), M1 = l(b.w / 2, 0);
        face(stone, [P3(E0, top), P3(E1, top), P3(M0, top + rh * 0.92)], col, [-c, 0, s]);
        face(stone, [P3(F0, top), P3(F1, top), P3(M1, top + rh * 0.92)], col, [c, 0, -s]);
      } else fan(boxPoly(b.x, b.z, b.yaw, b.w + 1.4, b.d + 1.4), top, b.d * 0.5, ROOF);
    }
    // the well in the courtyard corner: ring wall, two posts and a small roof
    {
      const w = L.well;
      prism(ngon(w.x, w.z, w.r, 14), lvl - 1, lvl + w.h, WHITE);
      for (const sd of [-1, 1]) prism(boxPoly(w.x + sd * (w.r - 0.4), w.z, 0, 0.35, 0.35), lvl, lvl + 3.2, WHITE);
      fan(boxPoly(w.x, w.z, 0, w.r * 2 + 0.8, w.r * 2 + 0.8), lvl + 3.2, 1.6, ROOF);
    }
    const sm = roadsideMesh(stone.build(), stoneTex(), { shadow: true }), rm = roadsideMesh(roof.build(), roofTex(), { shadow: true });
    sm.name = 'castleStone'; rm.name = 'castleRoof';
    if (houses.length) buildings(houses);
    // moat: a flat water ring 5 to 17 m outside the walls, sunk into the ditch the terrain has there (see castleHeight in stages.js)
    {
      const R = L.rect, W = L.toWorld, y = L.moat.level, ring = [], corners = d => [[R.u0 - d, R.v0 - d], [R.u1 + d, R.v0 - d], [R.u1 + d, R.v1 + d], [R.u0 - d, R.v1 + d]].map(([u, v]) => W(u, v));
      const inner = corners(L.moat.d0), outer = corners(L.moat.d1), pos = [], idx = [];
      for (const q of inner.concat(outer)) pos.push(q[0], y, q[1]);
      for (let i = 0; i < 4; i++) { const a = i, b = (i + 1) % 4, c = 4 + i, d = 4 + (i + 1) % 4; idx.push(a, b, d, a, d, c); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const mat = lit({ color: 0x3f6670, side: THREE.DoubleSide }), m = new THREE.Mesh(geo, mat); m.name = 'castleMoat'; m.receiveShadow = true; add(m);
    }
    for (const ob of castleObstacles(L)) obstacles.push(ob);
  }
