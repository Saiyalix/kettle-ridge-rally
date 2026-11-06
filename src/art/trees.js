  /* ---------- trees, rocks and roadside nature: real 3D models with levels of detail and wind (art) ----------
     What it looks like is here; where things stand and what the car can hit is tracks (tracks/scenery.js, themes.js):
     they call treeStand(list, pick) / rockStand(...) with the positions they planned, and buildNature() adds loose
     decoration (grass tufts, bushes, flowers, reeds) from its OWN seeded generator. Nothing in this file draws a number from the
     stage's random generator, adds an obstacle or moves a tree.

     Models: every species is one geometry per level of detail, made in code (vertex colours carry the shading: dark under
     every branch tier or blossom clump, light on top). One InstancedMesh per species and level. Per-tree variety comes from the
     instance colour (autumn leaves, blossom pink), the placed scale and turn, and a tiny per-tree stretch in the vertex shader.
     Wind: the vertex shader moves the upper part of each tree (one sin per vertex, one shared time uniform); not on low quality.

     Level of detail: the trees of a species are sorted into 40 m squares ("chunks") once, when the stage loads. When the camera has
     moved 8 m or turned 11 degrees (and not every frame), updateTrees() walks the chunks, drops the ones that are behind the camera
     or beyond the fog, and copies each remaining chunk into the near / middle / far mesh by its distance. The meshes are only
     filled, never created, in the race: a few thousand number copies, no garbage. See the numbers in docs/decisions.md. */
  const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  const WIND = { uT: { value: 0 } };
  const treeFieldsOf = () => stageGroup.userData.fields || (stageGroup.userData.fields = []);

  /* ----- tiny geometry kit: indexed, vertex colours, tw = (foliage mask, sway in metres) ----- */
  const tgNew = (H, amp) => ({ p: [], c: [], w: [], i: [], H: H || 1, amp: amp == null ? 0.2 : amp, up: false });
  function tgV(b, x, y, z, col, fol, sway) {
    b.p.push(x, y, z); b.c.push(Math.min(1, col[0]), Math.min(1, col[1]), Math.min(1, col[2]));
    const k = Math.max(0, y) / b.H; b.w.push(fol, sway != null ? sway : k * k * b.amp);
    return b.p.length / 3 - 1;
  }
  const tgT = (b, a, c, d) => b.i.push(a, c, d);
  function tgGeo(b) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.setAttribute('tw', new THREE.Float32BufferAttribute(b.w, 2));
    g.setIndex(b.i);
    if (b.up) { const n = new Float32Array(b.p.length); for (let k = 1; k < n.length; k += 3) n[k] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); }
    else g.computeVertexNormals();
    g.userData.keep = true; return g;
  }
  const mixC = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  // light / shade of a colour: lighter goes warm, darker goes cool (that is what makes the tiers and clumps read)
  const shadeC = (c, k) => k >= 1 ? [c[0] * k * 1.04, c[1] * k, c[2] * k * 0.92] : [c[0] * k * 0.88, c[1] * k * 0.96, c[2] * k * 1.1];
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const BARK = [0.40, 0.27, 0.17], BARK_DK = [0.24, 0.16, 0.11];
  // a tapered tube from A to B with `seg` sides (open ends)
  function tgLimb(b, x0, y0, z0, x1, y1, z1, r0, r1, seg, c0, c1) {
    let ax = x1 - x0, ay = y1 - y0, az = z1 - z0; const L = Math.hypot(ax, ay, az) || 1; ax /= L; ay /= L; az /= L;
    let ux, uy, uz; if (Math.abs(ay) < 0.9) { ux = -az; uy = 0; uz = ax; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; } else { ux = 1; uy = 0; uz = 0; }
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    const ring = (x, y, z, r, col) => { const o = []; for (let i = 0; i < seg; i++) { const a = i / seg * 6.2832, cs = Math.cos(a) * r, sn = Math.sin(a) * r; o.push(tgV(b, x + ux * cs + vx * sn, y + uy * cs + vy * sn, z + uz * cs + vz * sn, col, 0)); } return o; };
    const A = ring(x0, y0, z0, r0, c0), B = ring(x1, y1, z1, r1, c1);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; tgT(b, A[i], A[j], B[i]); tgT(b, A[j], B[j], B[i]); }
  }
  // icosphere (shared vertices), cached by detail
  const _ico = {};
  function icoGet(det) {
    if (_ico[det]) return _ico[det];
    const t = (1 + Math.sqrt(5)) / 2, nm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    let v = det < 0 ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] : [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nm);
    let f = det < 0 ? [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
      : [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < Math.max(0, det); d++) {
      const cache = new Map(), nf = [];
      const mid = (a, c) => { const k = a < c ? a * 4096 + c : c * 4096 + a; if (!cache.has(k)) { v.push(nm([(v[a][0] + v[c][0]) / 2, (v[a][1] + v[c][1]) / 2, (v[a][2] + v[c][2]) / 2])); cache.set(k, v.length - 1); } return cache.get(k); };
      for (const [a, c, e] of f) { const ab = mid(a, c), bc = mid(c, e), ca = mid(e, a); nf.push([a, ab, ca], [c, bc, ab], [e, ca, bc], [ab, bc, ca]); }
      f = nf;
    }
    return _ico[det] = { v, f };
  }
  // a lumpy ball of leaves: shared, jittered vertices (soft shading), light on top, dark underneath and low in the crown
  function tgBlob(b, cx, cy, cz, rx, ry, rz, det, r, jit, lite, dark, fol, aoLo, aoHi) {
    const ico = icoGet(det), base = b.p.length / 3;
    for (const v of ico.v) {
      const j = 1 - jit + r() * jit * 2, x = cx + v[0] * rx * j, y = cy + v[1] * ry * j, z = cz + v[2] * rz * j;
      const k = 0.5 + 0.5 * sstep(-0.55, 0.8, v[1]), ao = 0.84 + 0.16 * sstep(aoLo, aoHi, y), sp = 0.9 + r() * 0.2;
      tgV(b, x, y, z, mixC(dark, lite, k).map(q => q * ao * sp), fol);
    }
    for (const f of ico.f) tgT(b, base + f[0], base + f[1], base + f[2]);
  }

  /* ----- conifers: layered, irregular branch tiers around a trunk ----- */
  function buildConifer(sp, lvl, low) {
    const H = sp.H, R0 = sp.rad * 1.15, yLo = sp.trunkH, b = tgNew(H, sp.amp || 0.16), r = mulberry32(sp.seed * 7 + lvl * 3 + 1);
    const N = lvl === 0 ? sp.tiers - (low ? 2 : 0) : lvl === 1 ? Math.max(3, sp.tiers - 3) : 2;
    const seg = lvl === 0 ? (low ? 8 : 14) : lvl === 1 ? 8 : 6, crown = H - yLo;
    const tierH = crown * (lvl === 2 ? 0.62 : N <= 4 ? 0.46 : sp.tierF || 0.38), mid = lvl === 0 && !low, under = lvl === 0;
    tgLimb(b, 0, -0.3, 0, 0, yLo + crown * 0.55, 0, 0.3 * (sp.trunkW || 1), 0.08, lvl === 0 ? 6 : 3, BARK, BARK_DK);
    const snowW = (w) => sp.snow ? w : 0, SNOW = [0.93, 0.96, 1.0];
    for (let k = 0; k < N; k++) {
      const t = N > 1 ? k / (N - 1) : 0, rimY = yLo + (crown - tierH) * t, R = R0 * (1 - 0.8 * Math.pow(t, 0.9));
      const top = sp.col, tw = (c, w) => mixC(c, SNOW, snowW(w));
      const apex = tgV(b, (r() - 0.5) * 0.1 * R, rimY + tierH, (r() - 0.5) * 0.1 * R, tw(shadeC(top, 1.16), 0.95), 1);
      const rim = [], rimU = [], mids = [], rot = k * 1.1 + r() * 0.5;
      for (let i = 0; i < seg; i++) {
        const a = rot + i / seg * 6.2832 + (r() - 0.5) * 0.25, rr = R * (i % 2 ? 0.66 : 1.06) * (0.86 + r() * 0.28), ry = rimY - (i % 2 ? -0.05 * R : sp.droop * R * 0.17) + (r() - 0.5) * 0.1 * R;
        const cs = Math.cos(a), sn = Math.sin(a), edge = 0.82 + r() * 0.12;
        rim.push(tgV(b, cs * rr, ry, sn * rr, tw(shadeC(top, edge), r() * 0.12), 1));
        if (under) rimU.push(tgV(b, cs * rr, ry, sn * rr, shadeC(top, 0.5), 1));
        if (mid) mids.push(tgV(b, cs * rr * 0.55, rimY + tierH * 0.36, sn * rr * 0.55, tw(shadeC(top, 0.98), 0.4), 1));
      }
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        if (mid) { tgT(b, apex, mids[j], mids[i]); tgT(b, rim[j], rim[i], mids[i]); tgT(b, rim[j], mids[i], mids[j]); }
        else tgT(b, apex, rim[j], rim[i]);
      }
      if (under) {
        const c = tgV(b, 0, rimY + tierH * 0.1, 0, shadeC(top, 0.36), 1);
        for (let i = 0; i < seg; i++) tgT(b, c, rimU[i], rimU[(i + 1) % seg]);
      }
    }
    return tgGeo(b);
  }

  /* ----- broadleaf trees (autumn colours come from the instance colour) ----- */
  const LEAF_LITE = [1.0, 0.98, 0.88], LEAF_DARK = [0.74, 0.78, 0.9];
  function buildBroad(sp, lvl, low) {
    const H = sp.H, R = sp.rad, b = tgNew(H, 0.26), r = mulberry32(sp.seed * 5 + lvl * 3 + 2), hi = lvl === 0 && !low;
    const stemTop = H * 0.46, aoLo = H * 0.34, aoHi = H * 0.95;
    tgLimb(b, 0, -0.3, 0, 0.1, stemTop, 0, 0.3 * (sp.trunkW || 1), 0.12, lvl === 0 ? (low ? 5 : 7) : 3, BARK, BARK_DK);
    const blobs = [], n = lvl === 0 ? (low ? 4 : 7) : lvl === 1 ? 4 : 1;
    blobs.push([0, H * 0.72, 0, R * 0.86, R * 0.66, R * 0.86, hi ? 1 : 0]);
    for (let j = 0; j < n; j++) {
      const a = j / n * 6.2832 + r() * 0.8, d = R * (0.46 + r() * 0.16), y = H * (0.5 + r() * 0.2);
      blobs.push([Math.cos(a) * d, y, Math.sin(a) * d, R * (0.56 + r() * 0.12), R * (0.46 + r() * 0.1), R * (0.56 + r() * 0.12), hi && j < 6 ? 1 : 0]);
      if (hi && j === 0) tgLimb(b, 0.1, stemTop * 0.8, 0, Math.cos(a) * d * 0.7, y - R * 0.1, Math.sin(a) * d * 0.7, 0.1, 0.05, 4, BARK, BARK_DK);
    }
    if (lvl === 2) blobs.push([0, H * 0.55, 0, R * 0.9, R * 0.42, R * 0.9, 0]);
    for (const q of blobs) tgBlob(b, q[0], q[1], q[2], q[3], q[4], q[5], low ? 0 : q[6], r, 0.16, LEAF_LITE, LEAF_DARK, 1, aoLo, aoHi);
    return tgGeo(b);
  }

  /* ----- cherry trees: dark crooked limbs, flat clustered blossom clumps ----- */
  function buildSakura(sp, lvl, low) {
    const H = sp.H, R = sp.rad, b = tgNew(H, 0.24), r = mulberry32(sp.seed * 3 + lvl + 9), hi = lvl === 0 && !low;
    const LITE = [1.0, 1.0, 1.0], DARK = [0.84, 0.64, 0.78], aoLo = H * 0.38, aoHi = H * 0.92;
    const nb = lvl === 0 ? (low ? 6 : 12) : lvl === 1 ? 5 : 2, seg = lvl === 0 ? (low ? 5 : 7) : 3;
    tgLimb(b, 0, -0.3, 0, 0.25, H * 0.34, 0.1, 0.34, 0.2, seg, [0.30, 0.2, 0.17], [0.22, 0.15, 0.13]);
    const blobs = [];
    for (let j = 0; j < nb; j++) {
      const a = j * 2.4 + r() * 0.6, d = j === 0 ? 0 : R * (0.3 + 0.45 * Math.sqrt(j / nb)), y = H * (0.62 + r() * 0.2) - d * 0.14 + (j % 3 === 0 ? 0.35 : 0);
      blobs.push([Math.cos(a) * d + 0.2, y, Math.sin(a) * d, R * (0.38 + r() * 0.12), R * (0.29 + r() * 0.07), R * (0.38 + r() * 0.12), hi && j < 6 ? 1 : 0]);
      if (lvl < 2 && j > 0 && (j < 6 || hi)) tgLimb(b, 0.2, H * 0.3, 0.1, Math.cos(a) * d * 0.75 + 0.2, y - R * 0.25, Math.sin(a) * d * 0.75, 0.13, 0.05, lvl === 0 ? 5 : 3, [0.28, 0.19, 0.16], [0.2, 0.14, 0.13]);
    }
    if (lvl === 2) blobs.push([0, H * 0.62, 0, R * 0.95, R * 0.36, R * 0.95, 0]);
    for (const q of blobs) tgBlob(b, q[0], q[1], q[2], q[3], q[4], q[5], low ? 0 : q[6], r, 0.2, LITE, DARK, 1, aoLo, aoHi);
    return tgGeo(b);
  }

  /* ----- species table: shape numbers, colours and the level-of-detail ranges (metres, [high, low]) ----- */
  const TREE_LV = [[0, 46, 26], [1, 130, 80], [2, 1e9, 1e9]];
  const CON = (o) => Object.assign({ kind: 'con', rad: 2.5, trunkH: 1.0, tiers: 7, droop: 1, seed: 11, col: [0.27, 0.58, 0.3], reach: 3.2 }, o);
  const SPECIES = {
    spruce: CON({ name: 'spruce', H: 8.5, rad: 2.5, tiers: 7, seed: 11, col: [0.25, 0.56, 0.28] }),
    fir: CON({ name: 'fir', H: 8.5, rad: 2.6, tiers: 6, seed: 12, droop: 2, tierF: 0.4, col: [0.19, 0.5, 0.33] }),
    snow: CON({ name: 'snow', H: 8.5, rad: 2.5, tiers: 7, seed: 13, snow: true, col: [0.18, 0.46, 0.27] }),
    snowFir: CON({ name: 'snowFir', H: 8.5, rad: 2.6, tiers: 6, seed: 14, snow: true, droop: 2, tierF: 0.4, col: [0.16, 0.44, 0.3] }),
    pineT: CON({ name: 'pineT', H: 9.78, rad: 2.4, tiers: 8, seed: 15, col: [0.2, 0.5, 0.3] }),
    firT: CON({ name: 'firT', H: 9.78, rad: 2.6, tiers: 6, seed: 16, droop: 2, tierF: 0.4, col: [0.24, 0.52, 0.27] }),
    cedar: CON({ name: 'cedar', H: 12.5, rad: 1.9, tiers: 9, seed: 17, trunkH: 1.4, tierF: 0.28, col: [0.2, 0.45, 0.28], reach: 2.6 }),
    cedar2: CON({ name: 'cedar2', H: 12.5, rad: 2.1, tiers: 8, seed: 18, trunkH: 1.6, droop: 2.5, tierF: 0.3, col: [0.17, 0.4, 0.3], reach: 2.8 }),
    broad: { name: 'broad', kind: 'broad', H: 7.6, rad: 2.7, seed: 21, reach: 3.8 },
    sakura: { name: 'sakura', kind: 'sakura', H: 7.5, rad: 3.3, seed: 22, reach: 4.4 },
  };
  for (const k in SPECIES) {
    const sp = SPECIES[k], mk = sp.kind === 'con' ? buildConifer : sp.kind === 'broad' ? buildBroad : buildSakura;
    sp.mat = k === 'sakura' ? (low) => { const m = treeMaterial(low, 's'); m.emissive.setHex(ST.look.night ? 0x4c2a40 : 0); return m; } : (low) => treeMaterial(low); sp.shadowLv = 2; sp.cache = {};
    sp.levels = (low) => sp.cache[low ? 'l' : 'h'] || (sp.cache[low ? 'l' : 'h'] = TREE_LV.map(([l, hi, lo]) => ({ geo: mk(sp, l, low), maxD: low ? lo : hi })));
  }

  /* ----- shared material for everything that is a plant: vertex colours, instance colour on the leaves only, wind ----- */
  const _treeMats = {};
  function treeMaterial(low, variant) {
    const key = (low ? 'l' : 'h') + (variant || '');
    if (_treeMats[key]) return _treeMats[key];
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    if (!low) m.defines = { SWAY: 1 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWT = WIND.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 tw;\nuniform float uWT;')
        .replace('#include <color_vertex>', `vColor = vec4(pow(color.rgb, vec3(2.2)) * mix(vec3(1.0), pow(instanceColor.rgb, vec3(2.2)), tw.x), 1.0);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec4 ip = instanceMatrix[3];
            float hh = fract(sin(ip.x * 12.9898 + ip.z * 78.233) * 43758.5453);
            transformed.xz *= 0.9 + 0.2 * fract(hh * 5.7); transformed.y *= 0.93 + 0.14 * hh;
            #ifdef SWAY
              float ph = ip.x * 0.31 + ip.z * 0.23;
              transformed.x += (sin(uWT * 1.7 + ph) + 0.5 * sin(uWT * 0.8 + ph * 1.7)) * tw.y;
              transformed.z += cos(uWT * 1.3 + ph * 1.3) * tw.y * 0.7;
            #endif
          #endif`);
    };
    m.customProgramCacheKey = () => 'tree' + (low ? 'l' : 'h') + (variant || '');
    m.userData.keep = true;
    return _treeMats[key] = m;
  }
  // the shadow of a tree is stretched the same way as the tree (no wind)
  let _treeDepth = null;
  function treeDepthMaterial() {
    if (_treeDepth) return _treeDepth;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 ip = instanceMatrix[3];
          float hh = fract(sin(ip.x * 12.9898 + ip.z * 78.233) * 43758.5453);
          transformed.xz *= 0.9 + 0.2 * fract(hh * 5.7); transformed.y *= 0.93 + 0.14 * hh;
        #endif`);
    };
    m.customProgramCacheKey = () => 'treedepth';
    m.userData.keep = true;
    return _treeDepth = m;
  }

  /* ----- groups of instances with level of detail ----- */
  const CHUNK = 40;
  // items: positioned objects. place(dummy, item) sets the matrix, colorOf(item) = [r,g,b] (or null for white)
  function makeGroup(sp, items, place, colorOf, opt = {}) {
    const map = new Map();
    for (const it of items) { const k = Math.floor(it.x / CHUNK) * 100003 + Math.floor(it.z / CHUNK); let c = map.get(k); if (!c) map.set(k, c = []); c.push(it); }
    const n = items.length, M = new Float32Array(n * 16), C = new Float32Array(n * 3), chunks = [], order = [];
    let o = 0;
    for (const list of map.values()) {
      const ch = { a: o, b: o + list.length, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
      for (const it of list) {
        place(dummy, it); dummy.updateMatrix(); dummy.matrix.toArray(M, o * 16);
        const c = colorOf ? colorOf(it) : [1, 1, 1]; C[o * 3] = c[0]; C[o * 3 + 1] = c[1]; C[o * 3 + 2] = c[2];
        ch.x0 = Math.min(ch.x0, it.x); ch.x1 = Math.max(ch.x1, it.x); ch.z0 = Math.min(ch.z0, it.z); ch.z1 = Math.max(ch.z1, it.z); order.push(it); o++;
      }
      const m = sp.reach || 3; ch.x0 -= m; ch.x1 += m; ch.z0 -= m; ch.z1 += m;
      ch.cx = (ch.x0 + ch.x1) / 2; ch.cz = (ch.z0 + ch.z1) / 2; ch.r = Math.hypot(ch.x1 - ch.x0, ch.z1 - ch.z0) / 2;
      chunks.push(ch);
    }
    const g = { sp, n, M, C, chunks, order, meshes: [], q: null, mat: opt.mat || null, counts: [0, 0, 0] };
    treeFieldsOf().push(g);
    return g;
  }
  function groupQuality(g, low) {
    const lv = g.sp.levels(low), mat = g.mat ? g.mat(low) : g.sp.mat(low);
    for (let l = 0; l < lv.length; l++) {
      const d = lv[l], geo = d.geo;
      let m = g.meshes[l];
      if (!m) {
        m = g.meshes[l] = new THREE.InstancedMesh(geo, mat, g.n);
        m.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(g.n * 16), 16); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(g.n * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false; m.receiveShadow = false; m.count = 0; m.visible = false;
        add(m);
      } else { m.geometry = geo; m.material = mat; }
      m.castShadow = !!g.sp.shadowLv && l < g.sp.shadowLv && !low;
      if (m.castShadow && g.sp.depth !== false) m.customDepthMaterial = treeDepthMaterial(); else m.customDepthMaterial = undefined;
    }
    g.q = low ? 'low' : 'high'; g.lv = lv;
  }
  const _lod = { g: null, x: 1e9, z: 1e9, fx: 1, fz: 0, q: '', fog: 0, ar: 0, n: 0 };
  function updateTrees(dt) {
    WIND.uT.value += dt;
    const fields = stageGroup && stageGroup.userData.fields;
    if (!fields || !fields.length) return;
    const low = quality === 'low', cp = camera.position;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements; let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz);
    if (fl < 0.05) { fx = 1; fz = 0; } else { fx /= fl; fz /= fl; }
    const fog = scene.fog.far;
    const same = _lod.g === stageGroup && _lod.q === quality && _lod.fog === fog && _lod.ar === camera.aspect && _lod.n === fields.length;
    if (same && Math.hypot(cp.x - _lod.x, cp.z - _lod.z) < 8 && fx * _lod.fx + fz * _lod.fz > 0.98) return;
    _lod.g = stageGroup; _lod.x = cp.x; _lod.z = cp.z; _lod.fx = fx; _lod.fz = fz; _lod.q = quality; _lod.fog = fog; _lod.ar = camera.aspect; _lod.n = fields.length;
    const farMax = fog * (low ? 0.82 : 0.93), nearAll = low ? 18 : 48;
    const halfW = Math.min(3.0, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) + 0.45);
    for (const g of fields) {
      if (g.q !== quality) groupQuality(g, low);
      const lv = g.lv, cnt = g.counts; cnt[0] = cnt[1] = cnt[2] = 0;
      const arrM = g.meshes.map(m => m.instanceMatrix.array), arrC = g.meshes.map(m => m.instanceColor.array);
      const last = lv.length - 1;
      for (let ci = 0; ci < g.chunks.length; ci++) {
        const ch = g.chunks[ci];
        const nx = cp.x < ch.x0 ? ch.x0 : cp.x > ch.x1 ? ch.x1 : cp.x, nz = cp.z < ch.z0 ? ch.z0 : cp.z > ch.z1 ? ch.z1 : cp.z;
        const d = Math.hypot(nx - cp.x, nz - cp.z);
        if (d > farMax || d > lv[last].maxD) continue;
        if (d > nearAll) {
          const dx = ch.cx - cp.x, dz = ch.cz - cp.z, c = Math.hypot(dx, dz) || 1;
          if (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / c))) - Math.asin(Math.min(1, ch.r / c)) > halfW) continue;
        }
        let l = 0; while (l < last && d >= lv[l].maxD) l++;
        const m = arrM[l], cc = arrC[l], k = cnt[l];
        const n = ch.b - ch.a;
        for (let q = ch.a * 16, qe = ch.b * 16, w = k * 16; q < qe; q++, w++) m[w] = g.M[q];
        for (let q = ch.a * 3, qe = ch.b * 3, w = k * 3; q < qe; q++, w++) cc[w] = g.C[q];
        cnt[l] = k + n;
      }
      for (let l = 0; l < g.meshes.length; l++) {
        const m = g.meshes[l], c = cnt[l];
        m.count = c; m.visible = c > 0;
        if (c > 0) {
          m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, c * 16); m.instanceMatrix.needsUpdate = true;
          m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, c * 3); m.instanceColor.needsUpdate = true;
        }
      }
    }
  }
  // a stage's trees were just built: make the first fill happen on the next frame, and make the meshes exist for the shader pre-warm
  function treesReady() { _lod.g = null; for (const g of treeFieldsOf()) if (!g.meshes.length) groupQuality(g, quality === 'low'); }

  /* ----- trees: positions come from tracks ----- */
  const BROAD_COLS = [[0.34, 0.66, 0.22, 0.2], [0.68, 0.76, 0.18, 0.16], [0.97, 0.78, 0.14, 0.26], [0.94, 0.52, 0.1, 0.24], [0.8, 0.26, 0.1, 0.14]];
  function treeColor(t, sp) {
    const h = hash2(t.x * 1.7, t.z * 0.9 + 3.1), h2 = hash2(t.z * 2.3, t.x + 7.7), tint = (ST.look.foliageTint) || [1, 1, 1];
    let c;
    if (sp.kind === 'broad') { let a = h, p = BROAD_COLS[0]; for (const q of BROAD_COLS) { if (a < q[3]) { p = q; break; } a -= q[3]; p = q; } const v = 0.9 + 0.1 * h2; c = [p[0] * v, p[1] * v, p[2] * v]; }
    else if (sp.kind === 'sakura') { const v = 0.88 + 0.12 * h2; c = [1.0 * v, (0.78 + 0.12 * h) * v, (0.88 + 0.08 * (1 - h)) * v]; }
    else { const v = 0.84 + 0.16 * h2; c = [v * (0.94 + 0.12 * h), v, v * (0.94 + 0.12 * (1 - h))]; }
    if (sp.kind === 'con') return c;                       // cedars stay dark at night
    return [c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]];
  }
  function treeStand(list, pick) {
    const by = new Map();
    for (const t of list) { const sp = pick(t); if (!sp) continue; let a = by.get(sp.name); if (!a) by.set(sp.name, a = { sp, items: [] }); a.items.push(t); }
    for (const { sp, items } of by.values()) makeGroup(sp, items, (o, t) => { o.position.set(t.x, t.y - 0.2, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); }, (t) => treeColor(t, sp));
  }

  /* ----- rocks: faceted, with a moss or snow cap on the sides that face up ----- */
  function buildRock(variant, near, low) {
    const det = low ? (near ? 0 : -1) : (near ? 1 : 0), ico = icoGet(det), r = mulberry32(variant * 31 + (near ? 1 : 2) + 5);
    const v = ico.v.map(q => { const j = 0.78 + r() * 0.4, sx = variant ? 1.3 : 1, sy = variant ? 0.62 : 1; return [q[0] * j * sx, q[1] * j * sy, q[2] * j]; });
    const pos = [], col = [], tw = [], uv = [];
    for (const f of ico.f) {
      const A = v[f[0]], B = v[f[1]], Cc = v[f[2]], nx = (B[1] - A[1]) * (Cc[2] - A[2]) - (B[2] - A[2]) * (Cc[1] - A[1]), ny = (B[2] - A[2]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[2] - A[2]), nz = (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]);
      const l = Math.hypot(nx, ny, nz) || 1, k = 0.8 + 0.2 * (ny / l * 0.5 + 0.5) + (r() - 0.5) * 0.16, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      for (const q of [A, B, Cc]) { pos.push(q[0], q[1], q[2]); col.push(k, k, k * 1.03); tw.push(r(), 0); if (ax > ay && ax > az) uv.push(q[2], q[1]); else if (ay >= az) uv.push(q[0], q[2]); else uv.push(q[0], q[1]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('tw', new THREE.Float32BufferAttribute(tw, 2)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); g.userData.keep = true; return g;
  }
  const ROCK_SP = [0, 1].map(vr => ({ name: 'rock' + vr, reach: 3, shadowLv: 1, depth: false, cache: {}, levels(low) { return this.cache[low ? 'l' : 'h'] || (this.cache[low ? 'l' : 'h'] = [{ geo: buildRock(vr, true, low), maxD: low ? 30 : 55 }, { geo: buildRock(vr, false, low), maxD: 1e9 }]); } }));
  // cap: { col: [r,g,b] (display), amt } -- one material per cap kind per stage
  function rockMaterial(cap) {
    const mk = (low) => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.rock });
      const capCol = new THREE.Vector3(Math.pow(cap.col[0], 2.2), Math.pow(cap.col[1], 2.2), Math.pow(cap.col[2], 2.2));
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uCapCol = { value: capCol }; sh.uniforms.uCapAmt = { value: cap.amt };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 tw;\nuniform vec3 uCapCol; uniform float uCapAmt;')
          .replace('#include <color_vertex>', 'vColor = vec4(pow(color.rgb, vec3(2.2)) * pow(instanceColor.rgb, vec3(2.2)), 1.0);')
          .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
            { vec3 upV = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
              float kk = dot(normalize(transformedNormal), upV);
              float capK = smoothstep(0.55 - 0.3 * tw.x, 0.85 - 0.3 * tw.x, kk) * uCapAmt;
              vColor.rgb = mix(vColor.rgb, uCapCol, capK); }`);
      };
      m.customProgramCacheKey = () => 'rock';
      return m;
    };
    const mats = {};
    return (low) => mats[low ? 'l' : 'h'] || (mats[low ? 'l' : 'h'] = mk(low));
  }
  // items: [{x, y, z, size, rot: [rx, ry, rz], col: [r, g, b], cap: 'moss' | 'snow' | 'none'}]
  function rockStand(items) {
    const caps = ST.look.rockCaps || { moss: { col: [0.3, 0.46, 0.18], amt: 0.55 }, snow: { col: [0.95, 0.97, 1.0], amt: 0.95 }, none: { col: [0, 0, 0], amt: 0 } };
    const mats = {}, by = {};
    for (const it of items) { const key = it.cap + (hash2(it.x, it.z) < 0.35 ? '1' : '0'); (by[key] || (by[key] = [])).push(it); }
    for (const key in by) {
      const kind = key.slice(0, -1), v = +key.slice(-1);
      if (!mats[kind]) mats[kind] = rockMaterial(caps[kind] || caps.none);
      makeGroup(ROCK_SP[v], by[key], (o, r) => { o.position.set(r.x, r.y - r.size * 0.3, r.z); o.rotation.set(r.rot[0], r.rot[1], r.rot[2]); o.scale.set(r.size * 1.2, r.size * 0.8, r.size); }, (r) => r.col, { mat: mats[kind] });
    }
  }

  /* ----- decoration: grass tufts, bushes, flowers, reeds (own generator, never collidable, never on the road) ----- */
  function buildTuft(low, H, wide) {
    const b = tgNew(H, 0.07), n = low ? 4 : 8, r = mulberry32(5); b.up = true;
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.2832 + r() * 0.7, len = H * (0.6 + 0.4 * r()), lean = 0.2 + 0.4 * r(), w = wide * (0.7 + 0.5 * r()), ca = Math.cos(a), sa = Math.sin(a);
      const x0 = ca * 0.06, z0 = sa * 0.06, tx = ca * (0.06 + lean * len), tz = sa * (0.06 + lean * len);
      const bl = tgV(b, x0 - sa * w, 0, z0 + ca * w, [0.42, 0.5, 0.4], 1), br = tgV(b, x0 + sa * w, 0, z0 - ca * w, [0.42, 0.5, 0.4], 1), tp = tgV(b, tx, len, tz, [0.9, 0.96, 0.8], 1);
      tgT(b, bl, br, tp); tgT(b, br, bl, tp);
    }
    return tgGeo(b);
  }
  function buildBush(low, near) {
    const b = tgNew(1.2, 0.05), r = mulberry32(8), n = near && !low ? 3 : 1;
    for (let k = 0; k < n; k++) { const a = k * 2.1, d = k ? 0.4 : 0; tgBlob(b, Math.cos(a) * d, 0.5 - k * 0.04, Math.sin(a) * d, 0.55, 0.42, 0.55, 0, r, 0.2, [1, 0.98, 0.9], [0.5, 0.56, 0.7], 1, 0, 1.1); }
    return tgGeo(b);
  }
  function buildFlowers() {
    const b = tgNew(0.5, 0.05), r = mulberry32(3);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + r(), d = 0.12 + r() * 0.18, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.32 + r() * 0.2, w = 0.012;
      const s0 = tgV(b, x - w, 0, z, [0.3, 0.55, 0.25], 0), s1 = tgV(b, x + w, 0, z, [0.3, 0.55, 0.25], 0), s2 = tgV(b, x, h, z, [0.4, 0.7, 0.3], 0);
      tgT(b, s0, s1, s2); tgT(b, s1, s0, s2);
      const c = tgV(b, x, h + 0.02, z, [1, 1, 0.9], 1), ring = [];
      for (let i = 0; i < 6; i++) { const q = i / 6 * 6.2832; ring.push(tgV(b, x + Math.cos(q) * 0.075, h, z + Math.sin(q) * 0.075, [0.95, 0.95, 0.95], 1)); }
      for (let i = 0; i < 6; i++) tgT(b, c, ring[(i + 1) % 6], ring[i]);
    }
    b.up = true; return tgGeo(b);
  }
  function buildReed(low) {
    const b = tgNew(1.6, 0.14), n = low ? 4 : 7, r = mulberry32(6);
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.2832 + r(), len = 1.0 + r() * 0.6, lean = 0.1 + 0.25 * r(), w = 0.03, ca = Math.cos(a), sa = Math.sin(a), x0 = ca * 0.1, z0 = sa * 0.1;
      const tx = ca * (0.1 + lean * len), tz = sa * (0.1 + lean * len);
      const bl = tgV(b, x0 - sa * w, 0, z0 + ca * w, [0.35, 0.42, 0.3], 1), br = tgV(b, x0 + sa * w, 0, z0 - ca * w, [0.35, 0.42, 0.3], 1), tp = tgV(b, tx, len, tz, [0.95, 0.9, 0.7], 1);
      tgT(b, bl, br, tp); tgT(b, br, bl, tp);
      if (!low && k % 2 === 0) { const hb = tgV(b, tx - sa * 0.03, len - 0.22, tz + ca * 0.03, [0.5, 0.36, 0.24], 0), hc = tgV(b, tx + sa * 0.03, len - 0.22, tz - ca * 0.03, [0.5, 0.36, 0.24], 0), ht = tgV(b, tx, len + 0.1, tz, [0.62, 0.46, 0.3], 0); tgT(b, hb, hc, ht); tgT(b, hc, hb, ht); }
    }
    b.up = true; return tgGeo(b);
  }
  const makeDeco = (name, reach, lvDefs) => { const sp = { name, reach, shadowLv: 0, cache: {}, mat: treeMaterial }; sp.levels = (low) => sp.cache[low ? 'l' : 'h'] || (sp.cache[low ? 'l' : 'h'] = lvDefs(low)); return sp; };
  const DECO = {
    tuft: makeDeco('tuft', 0.6, (low) => [{ geo: buildTuft(low, 0.4, 0.06), maxD: low ? 26 : 62 }]),
    tuftTall: makeDeco('tuftTall', 0.8, (low) => [{ geo: buildTuft(low, 0.62, 0.075), maxD: low ? -1 : 75 }]),       // (not drawn on low: one draw call less)
    bush: makeDeco('bush', 1.8, (low) => low ? [{ geo: buildBush(true, false), maxD: 36 }] : [{ geo: buildBush(false, true), maxD: 60 }, { geo: buildBush(false, false), maxD: 120 }]),
    flower: makeDeco('flower', 0.6, (low) => [{ geo: buildFlowers(), maxD: low ? -1 : 40 }]),
    reed: makeDeco('reed', 0.8, (low) => [{ geo: buildReed(low), maxD: low ? 28 : 80 }]),
  };
  function buildNature() {
    if (!stageGroup || !track) return;
    const nr = mulberry32(ST.seed * 131 + 7), L = ST.look, japan = ST.theme === 'japan', alpine = ST.theme === 'alpine';
    const snowFrom = ST.snowFrom != null ? ST.snowFrom : 1e9, city = track.cityStart || 1e9;
    const edge = half * 1.14 + 0.9;
    const okSpot = (x, z, y, p, minD, s0) => {
      const n = world.nearest(x, z); if (n.i < 0 || Math.sqrt(n.d2) < minD) return false;
      if (Math.abs(y - P[n.i].y) > 3.2) return false;
      if (s0 > city - 40) return false;
      if (nearHouse(x, z) || slopeAt(x, z) > 0.55) return false;
      return true;
    };
    const gr = (k) => { const a = L.grassA, b = L.grassB, t = nr(); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((q, i) => Math.min(1, q * (k + (i === 1 ? 0.12 : 0)) )); };
    const tufts = [], tall = [], bushes = [], flowers = [], reeds = [];
    const dry = alpine ? 0.4 : 0.1, strawC = [0.8, 0.7, 0.42];
    for (let s = 12; s < track.length - 12; s += 1.5) for (const side of [-1, 1]) {
      const p = sampleAt(s);
      for (let k = 0, n = nr() < 0.55 ? 2 : 1; k < n; k++) {
        const off = edge + Math.pow(nr(), 1.8) * 12, [x, z] = sideXZ(sampleAt(s + nr() * 1.5), side * off), y = terrain.heightAt(x, z), sc = 0.7 + nr() * 0.8, rot = nr() * 6.28, pick = nr(), pick2 = nr();
        if (s > snowFrom - 20 || !okSpot(x, z, y, p, edge, s)) continue;
        const c = pick2 < dry ? strawC.map(q => q * (0.9 + 0.15 * pick)) : gr(1.0);
        (pick < 0.3 ? tall : tufts).push({ x, y: y - 0.02, z, s: sc, r: rot, c });
      }
    }
    for (let s = 14; s < track.length - 14; s += 9 + nr() * 4) for (const side of [-1, 1]) {
      const off = half * 1.14 + 2.4 + nr() * 12, p = sampleAt(s), [x, z] = sideXZ(p, side * off), y = terrain.heightAt(x, z), sc = 0.7 + nr() * 0.9, rot = nr() * 6.28, pick = nr(), pick2 = nr();
      if (nr() < 0.4 || !okSpot(x, z, y, p, half * 1.14 + 1.6 + sc * 0.9, s)) continue;
      let c = [0.28 + pick * 0.1, 0.55 + pick * 0.12, 0.24];
      if (s > snowFrom - 40) c = [0.8, 0.88, 0.98];
      else if (alpine) c = [0.5 + pick * 0.2, 0.52 + pick * 0.1, 0.3];
      else if (japan) c = pick2 < 0.3 ? [1.0, 0.45 + pick * 0.2, 0.72] : [0.2 + pick * 0.1, 0.5, 0.3];
      else if (pick2 < 0.08) c = [0.62, 0.46, 0.27];
      bushes.push({ x, y: y - 0.05, z, s: sc, r: rot, c });
    }
    if (ST.id === 'kettle') {
      for (let s = 30; s < snowFrom - 300; s += 26 + nr() * 30) {
        if (s > 120 && s < 480) continue;
        const side = nr() < 0.5 ? -1 : 1, off = half * 1.14 + 3 + nr() * 16, p = sampleAt(s), [cx, cz] = sideXZ(p, side * off), cols = [[1, 0.95, 0.5], [1, 1, 1], [1, 0.6, 0.78], [0.76, 0.6, 1], [1, 0.45, 0.35]], pc = cols[Math.floor(nr() * cols.length)];
        for (let k = 0, n = 8 + Math.floor(nr() * 7); k < n; k++) {
          const a = nr() * 6.28, d = Math.sqrt(nr()) * 3.6, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = terrain.heightAt(x, z), rot = nr() * 6.28, sc = 0.8 + nr() * 0.6, mixc = nr() < 0.25;
          if (!okSpot(x, z, y, p, half * 1.14 + 1.2, s)) continue;
          flowers.push({ x, y: y - 0.02, z, s: sc, r: rot, c: mixc ? cols[Math.floor(nr() * cols.length)] : pc });
        }
      }
    }
    if (japan) {
      // reeds on the dikes between the paddies and along the field edges
      for (let s = 20; s < 600; s += 2.5) for (const side of [-1, 1]) {
        const off = half + 8 + nr() * 52, p = sampleAt(s), [x, z] = sideXZ(p, side * off), y = terrain.heightAt(x, z);
        const fx = x / 16, fz = z / 16, dike = (fx - Math.floor(fx)) < 0.22 || (fz - Math.floor(fz)) < 0.22;
        if (!dike || nr() < 0.55 || terrain.sAt(x, z) > 560 || slopeAt(x, z) > 0.14 || !okSpot(x, z, y, p, half + 7, s)) continue;
        reeds.push({ x, y: y - 0.02, z, s: 0.8 + nr() * 0.7, r: nr() * 6.28, c: [0.7 + nr() * 0.2, 0.74 + nr() * 0.15, 0.5] });
      }
    }
    const tint = L.foliageTint || [1, 1, 1];
    const col = (it) => [it.c[0] * tint[0], it.c[1] * tint[1], it.c[2] * tint[2]];
    const place = (o, it) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.r, 0); o.scale.setScalar(it.s); };
    for (const [list, sp] of [[tufts, DECO.tuft], [tall, DECO.tuftTall], [bushes, DECO.bush], [flowers, DECO.flower], [reeds, DECO.reed]]) if (list.length) makeGroup(sp, list, place, col);
    treesReady();
  }
