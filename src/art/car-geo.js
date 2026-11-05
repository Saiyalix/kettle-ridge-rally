  /* ---------- car geometry helpers (used by art/car-model.js and art/car-livery.js) ----------
     Everything here makes plain "parts": { pos, nor, uv, col } flat arrays, 3 vertices per triangle, that are merged
     by material at the end (few draw calls). Car space: +x = the car's left, +y up, +z forward, origin = centre of mass.
     Functions only: nothing here touches the scene, so it is safe to load early. */
  // Livery atlas layout (one canvas for the whole car, see art/car-livery.js): three tiles stacked,
  // left side (viewer sees the nose on the left), right side (nose on the right), and the top view (nose on the right).
  const CT = { W: 1024, H: 1152, ppm: 1024 / 4.4, zMax: 2.2, yTop: 0.9, hSide: 340, topY0: 680, topH: 468 };
  function carUV(x, y, z, nx, ny, nz, out) {
    let px, py;
    if (Math.abs(nx) >= Math.abs(ny) * 0.9 && Math.abs(nx) >= Math.abs(nz)) {
      const y0 = nx > 0 ? 0 : CT.hSide;
      px = (nx > 0 ? CT.zMax - z : z + CT.zMax) * CT.ppm;
      py = y0 + clamp((CT.yTop - y) * CT.ppm, 2, CT.hSide - 3);
    } else {
      px = (z + CT.zMax) * CT.ppm;
      py = CT.topY0 + clamp((1 - x) * CT.ppm, 2, CT.topH - 3);
    }
    out[0] = clamp(px, 2, CT.W - 3) / CT.W; out[1] = 1 - py / CT.H;
  }
  const hx3 = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const newPart = () => ({ pos: [], nor: [], uv: [], col: [] });
  const _xm = new THREE.Matrix4(), _xq = new THREE.Quaternion(), _xe = new THREE.Euler(), _xp = new THREE.Vector3(), _xs = new THREE.Vector3();
  function xf(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _xe.set(rx, ry, rz, 'YXZ'); _xq.setFromEuler(_xe);
    return new THREE.Matrix4().compose(_xp.set(x, y, z), _xq, _xs.set(sx, sy, sz));
  }
  // push one triangle (9 numbers) with a flat or given normal
  function pushTri(part, p, n, col, uvOn) {
    for (let k = 0; k < 3; k++) {
      part.pos.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]); part.nor.push(n[k * 3], n[k * 3 + 1], n[k * 3 + 2]);
      part.col.push(col[0], col[1], col[2]);
    }
    if (uvOn) {
      const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2], bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
      let fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx; const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
      const o = [0, 0];
      for (let k = 0; k < 3; k++) { carUV(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], fx, fy, fz, o); part.uv.push(o[0], o[1]); }
    } else for (let k = 0; k < 3; k++) part.uv.push(0.004, 0.004);
  }
  // add a three.js primitive (Box, Cylinder, Lathe, ...) to a part; m = Matrix4 (or null); col = hex or [r,g,b] or fn(x,y,z) -> [r,g,b]
  function addGeo(part, geo, m, col, uvOn) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, cnt = p.length / 3;
    const cf = typeof col === 'function' ? col : null, c0 = cf ? null : (typeof col === 'number' ? hx3(col) : col);
    for (let t = 0; t < cnt; t += 3) {
      const tp = p.subarray(t * 3, t * 3 + 9), tn = n.subarray(t * 3, t * 3 + 9);
      if (cf) {
        for (let k = 0; k < 3; k++) { const c = cf(tp[k * 3], tp[k * 3 + 1], tp[k * 3 + 2]); part.col.push(c[0], c[1], c[2]); }
        const save = part.col; part.col = [];
        pushTri(part, tp, tn, [0, 0, 0], uvOn); part.col = save;
      } else pushTri(part, tp, tn, c0, uvOn);
    }
    g.dispose();
  }
  function partCount(part) { return part.pos.length / 9; }
  function partGeo(part) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(part.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(part.col, 3));
    return g;
  }
  // smooth-ish curve through [[z, value], ...] (cardinal spline), returns f(z)
  function curve1(keys) {
    const n = keys.length;
    const tan = keys.map((k, i) => { const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)]; return (b[1] - a[1]) / ((b[0] - a[0]) || 1); });
    return (z) => {
      if (z <= keys[0][0]) return keys[0][1];
      if (z >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0; while (z > keys[i + 1][0]) i++;
      const z0 = keys[i][0], z1 = keys[i + 1][0], h = z1 - z0, t = (z - z0) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * tan[i] * 0.85 + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * tan[i + 1] * 0.85;
    };
  }
  const bump = (z, c, hw) => { const d = Math.abs(z - c) / hw; return d >= 1 ? 0 : Math.pow(Math.cos(d * Math.PI / 2), 2); };
  // half profile (x >= 0, from the bottom centre up to the top centre) -> closed ring, counter-clockwise seen from +z
  function mirrorRing(half) {
    const r = half.map(p => [p[0], p[1], p[2] || 0]);
    for (let k = half.length - 2; k >= 1; k--) r.push([-half[k][0], half[k][1], half[k][2] || 0]);
    return r;
  }
  const rowOfRing = (j, N) => (j < N ? j : 2 * N - 2 - j);       // which half-profile row a ring index belongs to
  const BOXRING = (cx, cy, hw, hh) => mirrorRing([[0, cy - hh], [hw, cy - hh], [hw, cy + hh], [0, cy + hh]]);

  /* Loft: rings (all the same length, one per station along z) joined into a skin, with end caps.
     stations: [{ z, ring: [[x, y, flag], ...] }]
     Stations must be listed with z increasing (the faces point outwards that way).
     faceFn(i, j, info) -> { part, col: [r,g,b], uv: bool } or null (skip). info = { z, n: [nx,ny,nz], band, flags, cap }
        i = station (face lies between i and i+1, or -1 / S-1 for the two caps), j = ring segment, band = row band in the
        half profile (needs opts.N = rows in the half profile), flags = how many of the 3 vertices carry flag 1.
     opts: crease = degrees; faces whose normals differ more than that stay crisp. */
  function loft(st, faceFn, opts = {}) {
    const S = st.length, M = st[0].ring.length, N = opts.N || 0, cosC = Math.cos((opts.crease || 38) * Math.PI / 180);
    const P = [], F = [];       // vertices [x,y,z,flag]; faces [a,b,c, i, j, kind]
    for (let i = 0; i < S; i++) for (let j = 0; j < M; j++) { const r = st[i].ring[j]; P.push([r[0], r[1], st[i].z, r[2] || 0]); }
    const at = (i, j) => i * M + (j % M);
    for (let i = 0; i < S - 1; i++) for (let j = 0; j < M; j++) {
      F.push([at(i, j), at(i, j + 1), at(i + 1, j), i, j]);
      F.push([at(i, j + 1), at(i + 1, j + 1), at(i + 1, j), i, j]);
    }
    // caps: fan around the ring centre
    for (const [i, last] of [[0, false], [S - 1, true]]) {
      let cx = 0, cy = 0; for (let j = 0; j < M; j++) { cx += st[i].ring[j][0]; cy += st[i].ring[j][1]; }
      P.push([cx / M, cy / M, st[i].z, 0]); const c = P.length - 1;
      for (let j = 0; j < M; j++) F.push(last ? [c, at(i, j), at(i, j + 1), last ? S - 1 : -1, j, 1] : [c, at(i, j + 1), at(i, j), -1, j, 1]);
    }
    const FN = F.map(f => {
      const a = P[f[0]], b = P[f[1]], c = P[f[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      return l < 1e-9 ? null : { n: [nx / l, ny / l, nz / l], area: l };
    });
    const key = (v) => Math.round(v[0] * 4000) + ',' + Math.round(v[1] * 4000) + ',' + Math.round(v[2] * 4000);
    const vm = new Map();
    F.forEach((f, fi) => { if (!FN[fi]) return; for (let k = 0; k < 3; k++) { const kk = key(P[f[k]]); let l = vm.get(kk); if (!l) vm.set(kk, l = []); l.push(fi); } });
    const tri = new Array(9), nrm = new Array(9);
    F.forEach((f, fi) => {
      const fn = FN[fi]; if (!fn) return;
      const kind = f[5] === 1;
      const z = (P[f[0]][2] + P[f[1]][2] + P[f[2]][2]) / 3;
      const band = N ? Math.min(rowOfRing(f[4], N), rowOfRing((f[4] + 1) % M, N)) : 0;
      const flags = P[f[0]][3] + P[f[1]][3] + P[f[2]][3];
      const res = faceFn(f[3], f[4], { z, n: fn.n, band, flags, cap: kind });
      if (!res) return;
      for (let k = 0; k < 3; k++) {
        const v = P[f[k]]; tri[k * 3] = v[0]; tri[k * 3 + 1] = v[1]; tri[k * 3 + 2] = v[2];
        let sx = 0, sy = 0, sz = 0;
        for (const gi of vm.get(key(v))) { const g = FN[gi]; if (g.n[0] * fn.n[0] + g.n[1] * fn.n[1] + g.n[2] * fn.n[2] > cosC) { sx += g.n[0] * g.area; sy += g.n[1] * g.area; sz += g.n[2] * g.area; } }
        const l = Math.hypot(sx, sy, sz) || 1; nrm[k * 3] = sx / l; nrm[k * 3 + 1] = sy / l; nrm[k * 3 + 2] = sz / l;
      }
      pushTri(res.part, tri, nrm, res.col, res.uv);
    });
  }
  // a lathe (turned part): profile = [[radius, along-axis], ...]; axis is local X after the transform m
  function addLathe(part, profile, segs, m, col, uvOn) {
    const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), segs);
    g.rotateZ(-Math.PI / 2);                       // lathe axis Y -> X
    addGeo(part, g, m, col, uvOn); g.dispose();
  }
