  /* ---------- shared scenery pieces ---------- */
  // Billboard trees: two crossed textured quads, the classic trick of the era
  const treeTex = {};
  function drawPine(g, w, h, snowy, narrow) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#5b3d26'; g.fillRect(w * 0.46, h * 0.78, w * 0.08, h * 0.22);
    const tiers = narrow ? 9 : 7, top = h * 0.03, bottom = h * 0.86;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1), y0 = top + (bottom - top) * t * 0.92, y1 = y0 + (bottom - top) * (narrow ? 0.2 : 0.26);
      const half = w * (narrow ? 0.12 + 0.24 * t : 0.1 + 0.38 * t);
      const base = snowy ? [70, 128, 92] : narrow ? [48, 112, 70] : [62, 140, 70];
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      g.beginPath(); g.moveTo(w / 2, y0);
      for (let x = -half; x <= half; x += half / 6) g.lineTo(w / 2 + x, y1 - (Math.abs(x) / half) * 8 + (Math.round(x / half * 6) % 2 ? 6 : 0));
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,220,0.16)'; g.beginPath(); g.moveTo(w / 2, y0 + 4); g.lineTo(w / 2 - half * 0.85, y1 - 6); g.lineTo(w / 2 - half * 0.2, y1 - 8); g.closePath(); g.fill();
      if (snowy) { g.fillStyle = 'rgba(246,250,255,0.92)'; g.beginPath(); g.moveTo(w / 2, y0); g.lineTo(w / 2 - half * 0.7, y0 + (y1 - y0) * 0.55); g.lineTo(w / 2 + half * 0.6, y0 + (y1 - y0) * 0.45); g.closePath(); g.fill(); }
    }
  }
  function drawSakura(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4e3330'; g.fillRect(w * 0.45, h * 0.55, w * 0.1, h * 0.45);
    g.strokeStyle = '#4e3330'; g.lineWidth = 8; g.beginPath(); g.moveTo(w * 0.5, h * 0.62); g.lineTo(w * 0.28, h * 0.42); g.moveTo(w * 0.5, h * 0.6); g.lineTo(w * 0.72, h * 0.4); g.stroke();
    const r = mulberry32(5);
    for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = r(); const x = w / 2 + Math.cos(a) * d * w * 0.4, y = h * 0.36 + Math.sin(a) * d * h * 0.26, rad = 14 + r() * 22;
      g.fillStyle = `rgb(${245 + r() * 10 | 0},${170 + r() * 40 | 0},${200 + r() * 30 | 0})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = w * (0.2 + r() * 0.6), y = h * (0.15 + r() * 0.3); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, y, 5 + r() * 8, 0, 7); g.fill(); }
  }
  function getTreeTex(kind) {
    if (!treeTex[kind]) {
      const t = makeTex(128, 256, (g, w, h) => kind === 'sakura' ? drawSakura(g, w, h) : drawPine(g, w, h, kind === 'snow', kind === 'cedar'));
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.userData.keep = true; treeTex[kind] = t;
    }
    return treeTex[kind];
  }
  function crossedQuads(w, h) {
    const a = new THREE.PlaneGeometry(w, h), b = new THREE.PlaneGeometry(w, h); b.rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry(), pos = [], uv = [], nrm = [], idx = [];
    [a, b].forEach((q, qi) => {
      const p = q.attributes.position, u = q.attributes.uv;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i) + h / 2, p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nrm.push(0, 1, 0); }
      for (let i = 0; i < q.index.count; i++) idx.push(q.index.getX(i) + qi * 4);
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    return g;
  }
  function billboards(list, kind, w, h) {
    if (!list.length) return;
    const tex = getTreeTex(kind);
    const m = instanced(crossedQuads(w, h), lit({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), list,
      (o, t) => { o.position.set(t.x, t.y - 0.2, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); },
      { color: (c) => { const v = 0.82 + Math.random() * 0.18; c.setRGB(v, v, v); } });
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  }
  function conifers(list, colorFn, shape = {}) {
    const cedar = shape.tall > 1.4;
    billboards(list.filter(t => !t.snow), cedar ? 'cedar' : 'pine', cedar ? 3.8 : 5.0, (cedar ? 12.5 : 8.5) * (shape.tall > 1 && !cedar ? 1.15 : 1));
    billboards(list.filter(t => t.snow), 'snow', 5.0, 8.5);
    for (const t of list) if (t.d < 40) obstacles.push({ x: t.x, z: t.z, r: 0.3 * t.s });
  }
  function scatter(rng, count, tries, accept) {
    const out = [];
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = terrain.minX + rng() * (terrain.maxX - terrain.minX), z = terrain.minZ + rng() * (terrain.maxZ - terrain.minZ);
      const d = terrain.distAt(x, z), y = terrain.heightAt(x, z), s0 = terrain.sAt(x, z);
      const t = accept(x, z, d, y, s0);
      if (t) out.push(Object.assign({ x, z, y, d, s0, r: rng() * 6.28, s: 0.8 + rng() * 0.7 }, t === true ? {} : t));
    }
    return out;
  }
  const slopeAt = (x, z) => Math.hypot(terrain.heightAt(x + 2, z) - terrain.heightAt(x - 2, z), terrain.heightAt(x, z + 2) - terrain.heightAt(x, z - 2)) / 4;
  function rocks(rng, list, color = [0.66, 0.64, 0.68]) {
    instanced(new THREE.DodecahedronGeometry(1, 0), lit({ color: 0xffffff, map: TEX.rock, flatShading: true }), list,
      (o, r) => { o.position.set(r.x, r.y - r.size * 0.3, r.z); o.rotation.set(rng() * 3, rng() * 3, rng() * 3); o.scale.set(r.size * 1.2, r.size * 0.8, r.size); },
      { color: (c) => c.setRGB(color[0] + rng() * 0.1, color[1] + rng() * 0.1, color[2] + rng() * 0.1) });
    for (const r of list) if (r.solid) obstacles.push({ x: r.x, z: r.z, r: r.size * 1.05, mu: 0.35 });
  }
  function roadsideRocks(rng, count, sideOk) {
    const list = [];
    for (let i = 0; i < count * 12 && list.length < count; i++) {
      const p = P[Math.floor(rng() * P.length)], side = rng() < 0.5 ? -1 : 1;
      if (sideOk && !sideOk(p, side)) continue;
      const off = (half + 3 + rng() * 22) * side, [x, z] = sideXZ(p, off);
      if (terrain.distAt(x, z) < half + 2.5) continue;
      const big = rng() < 0.35, size = big ? 0.9 + rng() * 0.8 : 0.25 + rng() * 0.3;
      list.push({ x, z, y: terrain.heightAt(x, z), size, solid: big });
    }
    return list;
  }
  // rails/fences along the outside of corners
  function cornerRails(filter, opt) {
    const posts = [], rails = [];
    for (const t of track.turns) {
      if (!filter(t)) continue;
      const side = t.dir === 'R' ? -1 : 1;       // outside of a right turn is the left side
      let prev = null;
      for (let s = t.s0 - 8; s <= t.s1 + 8; s += opt.spacing || 3) {
        const p = sampleAt(s), [x, z] = sideXZ(p, (half + (opt.offset || 2.6)) * side), y = terrain.heightAt(x, z);
        posts.push([x, y, z]);
        if (prev) { rails.push([prev, [x, y, z]]); if (opt.solid) obstacles.push({ ax: prev[0], az: prev[2], bx: x, bz: z, r: 0.2, mu: opt.mu || 0.2 }); }
        prev = [x, y, z];
      }
    }
    instanced(new THREE.BoxGeometry(0.12, opt.postH || 1.1, 0.12).translate(0, (opt.postH || 1.1) / 2, 0), lit({ color: opt.postColor }), posts,
      (o, p) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1, opt.railH || 0.5, 0.04), lit({ color: opt.railColor }), rails, (o, [a, b]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (opt.railY || 0.7), (a[2] + b[2]) / 2);
      o.rotation.set(0, Math.atan2(-dz, dx), 0); o.scale.set(Math.hypot(dx, dz), 1, 1);
    });
  }
  // far-off peaks beyond the terrain, drawn without fog in hazy colours
  function distantPeaks(rng, count, base, cap, opts = {}) {
    let cx = 0, cz = 0; for (const p of P) { cx += p.x; cz += p.z; } cx /= P.length; cz /= P.length;
    const g = new THREE.ConeGeometry(1, 1, 7, 1); g.translate(0, 0.5, 0);
    const cg = new THREE.ConeGeometry(1, 1, 7, 1); cg.translate(0, 0.5, 0);
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.3, d = (opts.dist || 1250) + rng() * 300;
      list.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, r: 220 + rng() * 260, h: 260 + rng() * 380, rot: rng() * 6 });
    }
    if (opts.extra) list.push(opts.extra);
    if (opts.hideRandom) list.splice(0, list.length - (opts.extra ? 1 : 0));     // the painted backdrop (art/sky.js) replaces the random cones; the random numbers above are still drawn, so nothing else moves
    instanced(g, new THREE.MeshBasicMaterial({ color: base, fog: false }), list, (o, m) => { o.position.set(m.x, (opts.y || -40), m.z); o.rotation.set(0, m.rot, 0); o.scale.set(m.r, m.h, m.r); }, { shadow: false });
    instanced(cg, new THREE.MeshBasicMaterial({ color: cap, fog: false }), list, (o, m) => { const f = m.cap || 0.3; o.position.set(m.x, (opts.y || -40) + m.h * (1 - f), m.z); o.rotation.set(0, m.rot, 0); o.scale.set(m.r * f * 1.04, m.h * f, m.r * f * 1.04); }, { shadow: false });
  }

  /* ---------- roadside frame: walls, fences, rock faces and houses close to the road ----------
     Placement and collision live here (tracks); how the pieces look is in art/roadside.js.
     Everything comes from its own seeded generator, so a stage looks and plays the same every time,
     on both graphics qualities. Walls, fences, rock faces and house sides are segment obstacles. */
  let frameHouses = [];                                              // [{x, z, r}] circles where trees and rocks must not stand
  const nearHouse = (x, z) => frameHouses.some(h => (x - h.x) * (x - h.x) + (z - h.z) * (z - h.z) < h.r * h.r);
  // merge several meshes made by the same builder into one (one draw call per type per stage)
  function mergeMeshes(list, shadow) {
    list = list.filter(Boolean);
    if (!list.length) return null;
    const geo = new THREE.BufferGeometry();
    for (const [a, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
      const arr = new Float32Array(list.reduce((n, m) => n + m.geometry.attributes[a].array.length, 0)); let o = 0;
      for (const m of list) { arr.set(m.geometry.attributes[a].array, o); o += m.geometry.attributes[a].array.length; }
      geo.setAttribute(a, new THREE.BufferAttribute(arr, size));
    }
    const ix = new Uint32Array(list.reduce((n, m) => n + m.geometry.index.array.length, 0)); let o = 0, base = 0;
    for (const m of list) { const src = m.geometry.index.array; for (let k = 0; k < src.length; k++) ix[o++] = src[k] + base; base += m.geometry.attributes.position.count; }
    geo.setIndex(new THREE.BufferAttribute(ix, 1));
    const out = new THREE.Mesh(geo, list[0].material); out.castShadow = !!shadow; out.receiveShadow = true;
    list.forEach((m, i) => { stageGroup.remove(m); m.geometry.dispose(); if (i) m.material.dispose(); });
    add(out); return out;
  }
  const wallSegs = (pts, r, mu, h) => { for (let i = 0; i < pts.length - 1; i++) obstacles.push({ ax: pts[i].x, az: pts[i].z, bx: pts[i + 1].x, bz: pts[i + 1].z, r, mu, h: h || 2.5 }); };
  // all roadside pieces keep away from the gates, boards, jumps, the torii tunnel, and the outside of tight corners (chevrons)
  function frameKeepOut() {
    const all = [[0, 135], [track.finishS - 78, track.length]];
    if (ST.theme === 'alpine') { all.length = 0; all.push([13.5, 18.5], [track.finishS - 2.5, track.finishS + 2.5]); for (const cp of ST.checkpoints) all.push([cp - 2.5, cp + 2.5]); }   // gate posts only
    else for (const cp of ST.checkpoints) all.push([cp - 28, cp + 16]);
    if (ST.theme !== 'alpine') for (const [js] of ST.jumps) all.push([js - 20, js + 30]);
    if (ST.toriiTunnel) all.push([ST.toriiTunnel[0] - 12, ST.toriiTunnel[1] + 12]);
    const sd = { '-1': [], '1': [] }, lim = ST.theme === 'japan' ? 80 : 60;
    if (ST.theme !== 'alpine') for (const t of track.turns) if (t.r <= lim) sd[t.dir === 'R' ? -1 : 1].push([t.s0 - 12, t.s1 + 12]);
    return (s, side) => all.some(r => s >= r[0] && s <= r[1]) || sd[side].some(r => s >= r[0] && s <= r[1]);
  }
  // points along one side of the road at `off` m beyond the road edge; split into pieces where the ground is wrong or the spot is kept clear
  function framePath(a, b, side, off, keep, opt = {}) {
    const pieces = []; let cur = [];
    const flush = () => { if (cur.length >= (opt.min || 3)) pieces.push(cur); cur = []; };
    for (let s = a; s <= b + 0.01; s += opt.step || 3) {
      const p = sampleAt(s), [x, z] = sideXZ(p, side * (half + off)), g = terrain.heightAt(x, z);
      const ok = !keep(s, side) && (opt.any && opt.noDist || terrain.distAt(x, z) > half + off - 0.9) && (opt.any || Math.abs(g - p.y) < (opt.dy || 2.4));
      if (!ok) { flush(); continue; }
      cur.push({ x, y: opt.follow ? Math.max(g, p.y - 0.3) : g, z, s });
    }
    flush(); return pieces;
  }
  const chunksOf = (rng, a, b, minLen, maxLen, gapMin, gapMax) => { const out = []; let s = a; while (s < b) { const len = minLen + rng() * (maxLen - minLen); out.push([s, Math.min(b, s + len)]); s += len + gapMin + rng() * (gapMax - gapMin); } return out; };

  // houses: planned first (trees and rocks keep out of them), built later with the other pieces
  let frameHouseList = [];
  function planHouses(rng) {
    frameHouses = []; frameHouseList = [];
    const gates = [16, ...ST.checkpoints, track.finishS];
    const TINTS = [[1, 0.92, 0.78], [1, 0.84, 0.8], [0.88, 0.92, 1], [0.96, 0.96, 0.9], [1, 0.9, 0.7], [0.92, 0.86, 0.8]];
    const row = (s0, s1, gapMin, gapMax, skip, opt = {}) => {
      for (const side of [-1, 1]) {
        let s = s0;
        while (s < s1) {
          const w = 7 + rng() * 7, d = 6 + rng() * 3, h = 6.5 + rng() * 2.5, sc = s + w / 2, gap = gapMin + rng() * (gapMax - gapMin);
          const styleRoll = rng() < (opt.stone != null ? opt.stone : 0.35), style = ST.id === 'sakura' ? 'japanese' : styleRoll ? 'stone' : 'plaster', tint = TINTS[Math.floor(rng() * TINTS.length)], flat = !!opt.flat && rng() < 0.4, skipIt = rng() < skip;
          s += w + 0.8 + rng() * 2.5;
          if (skipIt || sc > s1 || gates.some(g => Math.abs(sc - g) < w / 2 + 16)) continue;
          const p = sampleAt(sc), [cx, cz] = sideXZ(p, side * (half + gap + d / 2)), yaw = facingYaw(cx, cz, p.x, p.z);
          const c = Math.cos(yaw), sn = Math.sin(yaw), at = (lx, lz) => [cx + lx * c + lz * sn, cz - lx * sn + lz * c];
          const cs = [at(-w / 2, d / 2), at(w / 2, d / 2), at(w / 2, -d / 2), at(-w / 2, -d / 2)];
          let ok = true, y = 1e9, yMax = -1e9;
          for (const q of cs.concat([at(0, d / 2), at(0, -d / 2), at(-w / 4, d / 2), at(w / 4, d / 2), at(0, 0)])) {
            if (terrain.distAt(q[0], q[1]) < half + gapMin - 0.6) ok = false;
            const g = terrain.heightAt(q[0], q[1]); y = Math.min(y, g); yMax = Math.max(yMax, g);
          }
          if (!ok || yMax - y > 3.5 || Math.abs(y - p.y) > 3) continue;
          frameHouseList.push({ x: cx, y: y + 0.3, z: cz, yaw, w, d, h, style, tint, roof: flat ? 'flat' : 'hip' });
          frameHouses.push({ x: cx, z: cz, r: Math.hypot(w, d) / 2 + 2.5 });
          for (let k = 0; k < 4; k++) obstacles.push({ ax: cs[k][0], az: cs[k][1], bx: cs[(k + 1) % 4][0], bz: cs[(k + 1) % 4][1], r: 0.3, mu: 0.3, h: 99 });
        }
      }
    };
    if (ST.id === 'kettle') { row(150, 455, 3.8, 6.0, 0.12); row(62, 140, 9, 12, 0.35, { stone: 0.5 }); }
    if (ST.id === 'sakura') row(1640, track.cityStart - 4, 4.4, 6.5, 0.1, { stone: 0.2, flat: true });
  }

  function buildRoadside(rng) {
    const keep = frameKeepOut(), stoneGrey = [], stoneWarm = [], fences = [], faces = [];
    const stone = (pieces, opt, r) => { for (const pts of pieces) { (opt.warm ? stoneWarm : stoneGrey).push(stoneWall(pts, opt)); wallSegs(pts, r, 0.25, 2.5); } };
    const fence = (pieces, opt) => { for (const pts of pieces) { fences.push(woodFence(pts, opt)); wallSegs(pts, 0.15, 0.2, 2.5); } };
    const face = (pieces, opt) => { for (const pts of pieces) { faces.push(rockFace(pts, opt)); wallSegs(pts, 0.55, 0.3, 99); } };
    const seed = () => 1 + Math.floor(rng() * 9999);
    const wallOpt = () => ({ height: 0.9 + rng() * 0.4, thick: 0.6, warm: rng() < 0.45, tint: [0.9 + rng() * 0.1, 0.9 + rng() * 0.1, 0.9 + rng() * 0.1] });

    if (ST.id === 'kettle') {
      for (const side of [-1, 1]) for (const [a, b] of chunksOf(rng, 140, 470, 90, 160, 3, 6).concat(chunksOf(rng, 470, track.finishS - 80, 40, 110, 4, 14))) {
        const village = b <= 470, snow = a > ST.snowFrom - 20, pick = rng();
        if (village) { stone(framePath(a, b, side, 2.4, keep, { any: true, noDist: true, follow: true }), Object.assign(wallOpt(), { sink: 1.2 }), 0.33); continue; }
        if (pick < 0.15) continue;
        if (pick < 0.4) { const o = wallOpt(); if (snow) o.tint = [0.88, 0.94, 1]; stone(framePath(a, b, side, 2.4, keep), o, 0.33); }
        else fence(framePath(a, b, side, 2.6, keep), { height: 1.0 + rng() * 0.2, rails: rng() < 0.5 ? 2 : 3, tint: snow ? [0.92, 0.96, 1.05] : [1, 1, 1] });
      }
    } else if (ST.id === 'vulture') {
      // drop side: a continuous low stone wall hugging the road (same line as the old corner walls). Rock side: a layered rock face.
      for (const side of [-1, 1]) {
        const up = p => side > 0 ? p.upR : p.upL;
        let runs = [], cur = null;
        for (let s = 0; s <= track.finishS + 10; s += 3) {
          const u = up(sampleAt(s)), kind = u < 0.4 ? 'drop' : u > 0.6 ? 'rock' : null;
          if (kind && cur && cur.kind === kind) cur.b = s; else { cur = kind ? { kind, a: s, b: s } : null; if (cur) runs.push(cur); }
        }
        runs.forEach(r => {
          if (r.b - r.a < 9) return;
          if (r.kind === 'drop') stone(framePath(r.a, r.b, side, 1.3, keep, { any: true, follow: true, noDist: true, min: 2, step: 2 }), Object.assign(wallOpt(), { height: 0.95, sink: 1.8 }), 0.5);
          else for (const [a, b] of chunksOf(rng, r.a, r.b, 90, 150, 0, 0)) face(framePath(a, b + 6, side, 3.6, keep, { step: 6, any: true }), { side, height: 9 + rng() * 5, lean: 0.3 + rng() * 0.2, rough: 1.2, rows: 5, seed: seed(), tint: [1, 0.97, 0.97] });
        });
      }
    } else {
      const city = track.cityStart;
      for (const side of [-1, 1]) {
        // mountain pass, inside of every corner: a cut bank (rock face) or a tall stone retaining wall
        const forced = [];
        for (const t of track.turns) if (t.s0 > 690 && t.s1 < city - 30 && t.dir === (side > 0 ? 'R' : 'L')) {
          const a = t.s0 - 15, b = t.s1 + 15; forced.push([a, b]);
          if (rng() < 0.6) face(framePath(a, b + 6, side, 3.6, keep, { step: 6, any: true }), { side, height: 5 + rng() * 4, lean: 0.4 + rng() * 0.25, rough: 1.0, rows: 4, seed: seed(), tint: [0.95, 0.93, 0.96] });
          else stone(framePath(a, b, side, 2.6, keep, { any: true, follow: true }), { height: 2.0 + rng() * 0.8, thick: 0.8, warm: rng() < 0.5, sink: 1.2 }, 0.45);
        }
        const keepFree = (s, sd) => keep(s, sd) || forced.some(r => s >= r[0] - 6 && s <= r[1] + 6);
        // the rest of the pass: classify each stretch by the ground beside the road, then rock bank / retaining wall (uphill) or low wall (downhill)
        const kindAt = s => { const p = sampleAt(s), [x, z] = sideXZ(p, side * (half + 9)), dh = terrain.heightAt(x, z) - p.y; return dh > 1.3 ? 'bank' : dh < -2.5 ? 'drop' : 'flat'; };
        let cur = null; const runs = [];
        for (let s = 140; s <= city - 10; s += 6) {
          const k = kindAt(s);
          if (cur && cur.kind === k) cur.b = s; else { cur = { kind: k, a: s, b: s }; runs.push(cur); }
        }
        for (const r of runs) {
          if (r.b - r.a < 18) continue;
          for (const [a, b] of chunksOf(rng, r.a, r.b, 40, 110, 0, 0)) {
            if (r.kind === 'bank') {
              if (rng() < 0.55) face(framePath(a, b + 6, side, 3.6, keepFree, { step: 6, any: true }), { side, height: 5 + rng() * 5, lean: 0.35 + rng() * 0.25, rough: 1.0, rows: 4, seed: seed(), tint: [0.95, 0.93, 0.96] });
              else stone(framePath(a, b, side, 2.6, keepFree, { any: true, follow: true }), { height: 2.0 + rng() * 0.8, thick: 0.8, warm: rng() < 0.5, sink: 1.2 }, 0.45);
            } else if (r.kind === 'drop') stone(framePath(a, b, side, 2.4, keepFree, { any: true, follow: true }), Object.assign(wallOpt(), { height: 0.9, sink: 1.5 }), 0.33);
            else if (rng() < 0.6) stone(framePath(a, b, side, 2.2, keepFree), wallOpt(), 0.33);
          }
        }
        // town outskirts: low walls in front of the old houses
        for (const [a, b] of chunksOf(rng, 1640, city - 4, 25, 45, 8, 14)) stone(framePath(a, b, side, 3.6, keep), wallOpt(), 0.33);
      }
    }
    mergeMeshes(stoneGrey, false); mergeMeshes(stoneWarm, false); mergeMeshes(fences, false); mergeMeshes(faces, false);
    if (frameHouseList.length) buildings(frameHouseList);
  }
