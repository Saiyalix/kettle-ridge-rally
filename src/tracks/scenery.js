  /* ---------- shared scenery pieces ---------- */
  // Trees are real 3D models now (art/trees.js). Here: which species stands where (decided from the tree's position only, so no
  // random number of the stage is drawn) and the trunk collision, which is exactly what it always was.
  function conifers(list, colorFn, shape = {}) {
    const alpine = ST.theme === 'alpine', cedar = shape.tall > 1.4;
    treeStand(list, (t) => {
      const h = hash2(t.x, t.z);
      if (t.snow) return SPECIES[h < 0.3 ? 'snowFir' : 'snow'];
      if (alpine) return SPECIES[h < 0.45 ? 'pineT' : 'firT'];
      if (cedar) return SPECIES[h < 0.5 ? 'cedar' : 'cedar2'];
      const pBroad = 0.55 * (1 - smoothstep(clamp((t.s0 - 650) / 950, 0, 1)));      // autumn broadleaf trees in the lower forest
      if (h < pBroad) return SPECIES.broad;
      return SPECIES[hash2(t.z, t.x) < 0.38 ? 'fir' : 'spruce'];
    });
    for (const t of list) if (t.col !== undefined ? t.col : t.d < 40) obstacles.push({ x: t.x, z: t.z, r: 0.3 * t.s });
  }

  /* ---------- extra woods: dense layered stands beside the road ----------
     Extra trees are planned here with their own generator (ST.seed * 7919 + salt), never the stage rng, so no older tree, rock or board moves.
     Rows go from a near row (visual only inside 8 m of the road edge, and only on straights) to rows (trunk collision from 8 m) to back rows (not collidable); each row has its own step, offset band and size.
     Kept clear: gates, the start/finish areas and village (frameKeepOut), houses, the torii tunnel, existing trees (spacing), and
     the inside of every corner (20 m deep, from 30 m before it) (so you see where the road goes). Collision does not depend on graphics quality.
     o: { salt, a, b, minLen, maxLen, gapMin, gapMax, colMax, rows: [{ o0, o1, step, p, s0, s1, sep }], ok(p, side, off, x, z, y, s) } */
  function woodExtras(existing, o) {
    const wr = mulberry32(ST.seed * 7919 + o.salt), keep = frameKeepOut(), out = [];
    const gates = [16, ...ST.checkpoints, track.finishS], inside = [], turns = track.turns.map(t => [t.s0 - 20, t.s1 + 60]);
    for (const t of track.turns) if (t.r <= 120) inside.push([t.s0 - 30, t.s1 + 4, t.dir === 'R' ? 1 : -1]);
    const grid = new Map(), gk = (i, j) => i * 100003 + j, CELL = 4;
    const put = (x, z) => { const k = gk(Math.floor(x / CELL), Math.floor(z / CELL)); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(x, z); };
    const crowded = (x, z, sep) => {
      const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL), r = Math.ceil(sep / CELL);
      for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { const c = grid.get(gk(i, j)); if (c) for (let q = 0; q < c.length; q += 2) if (Math.hypot(c[q] - x, c[q + 1] - z) < sep) return true; }
      return false;
    };
    for (const t of existing) put(t.x, t.z);
    for (const side of [-1, 1]) for (const [a, b] of chunksOf(wr, o.a, o.b, o.minLen, o.maxLen, o.gapMin, o.gapMax)) for (const row of o.rows) {
      for (let s = a; s <= b; s += row.step) {
        const ss = s + (wr() - 0.5) * row.step, r1 = wr(), r2 = wr(), r3 = wr(), r4 = wr();
        if (ss < o.a || ss > o.b || r1 > row.p * Math.min(1, Math.min(ss - a, b - ss) / 25)) continue;
        const off = row.o0 + r2 * (row.o1 - row.o0);
        if (off < 16 && (keep(ss, side) || gates.some(g => Math.abs(ss - g) < 24))) continue;
        if (off < 8 && turns.some(r => ss >= r[0] && ss <= r[1])) continue;                  // the near row (visual only) stays off corners and 60 m after them
        if (inside.some(r => r[2] === side && ss >= r[0] && ss <= r[1] && off < 20)) continue;
        const p = sampleAt(ss), [x, z] = sideXZ(p, side * (half + off)), y = terrain.heightAt(x, z);
        if (terrain.distAt(x, z) < half + Math.min(off, 12) - 1.2 || nearHouse(x, z) || crowded(x, z, row.sep)) continue;
        if (o.ok && !o.ok(p, side, off, x, z, y, ss)) continue;
        const s0 = terrain.sAt(x, z);
        put(x, z);
        out.push({ x, z, y, d: terrain.distAt(x, z), s0, r: r3 * 6.28, s: row.s0 + r4 * (row.s1 - row.s0), snow: !!(o.snow && o.snow(s0)), col: off >= 8 && off <= o.colMax && terrain.distAt(x, z) - half >= 8.2 });
      }
    }
    return out;
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
    // the random draws are the same as ever (3 for the turn, 3 for the colour, per rock); the shape is art/trees.js
    const items = list.map((r) => {
      const rot = [rng() * 3, rng() * 3, rng() * 3], col = [color[0] + rng() * 0.1, color[1] + rng() * 0.1, color[2] + rng() * 0.1];
      const cap = ST.theme === 'alpine' ? (r.y > ST.snowLine - 8 ? 'snow' : 'moss') : (ST.snowFrom != null && terrain.sAt(r.x, r.z) > ST.snowFrom - 30 ? 'snow' : 'moss');
      return { x: r.x, y: r.y, z: r.z, size: r.size, rot, col, cap };
    });
    rockStand(items);
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
    // look: posts and rails are 3D (art/structures.js). opt.style = 'guard' for a corrugated steel beam, otherwise timber boards
    const pH = opt.postH || 1.1, rH = opt.railH || 0.5, rY = opt.railY || 0.7, pc = hexRGB(opt.postColor), rc = hexRGB(opt.railColor);
    instanced(railPostGeo(pH, pc, rY, rH), structMat(), posts, (o, p) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(railGeo(opt.style, rH, rc), structMat(), rails, (o, [a, b]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + rY, (a[2] + b[2]) / 2);
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
  let castleL = null;                                                // SS4: castleLayout(), set by sceneryCastle; the castle area counts as "a house" for trees, rocks and ground decoration
  const nearHouse = (x, z) => frameHouses.some(h => (x - h.x) * (x - h.x) + (z - h.z) * (z - h.z) < h.r * h.r) || (castleL && castleKeepOut(castleL, x, z, 26));
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
    if (ST.castle) all.push([ST.castle.gate1 - 60, ST.castle.gate2 + 60]);
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
          const styleRoll = rng() < (opt.stone != null ? opt.stone : 0.35), style = ST.id === 'sakura' ? 'japanese' : ST.id === 'thornwick' ? (styleRoll ? 'stone' : 'timber') : styleRoll ? 'stone' : 'plaster', tint = TINTS[Math.floor(rng() * TINTS.length)], flat = !!opt.flat && rng() < 0.4, skipIt = rng() < skip;
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
    if (ST.id === 'thornwick') { row(150, 455, 3.8, 6.0, 0.12, { stone: 0.6 }); row(60, 140, 10, 13, 0.4, { stone: 0.5 }); }
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
    } else if (ST.id === 'thornwick') {
      // village street: low stone walls in front of the houses (like SS1). Everywhere else walls and fences stand 8.6 m or more from the road edge (nothing solid close to the road).
      for (const side of [-1, 1]) {
        for (const [a, b] of chunksOf(rng, 140, 470, 90, 160, 3, 6)) stone(framePath(a, b, side, 2.4, keep, { any: true, noDist: true, follow: true }), Object.assign(wallOpt(), { sink: 1.2 }), 0.33);
        for (const [a, b] of chunksOf(rng, 480, track.finishS - 80, 50, 120, 20, 70)) {
          if (rng() < 0.3) continue;
          if (rng() < 0.5) stone(framePath(a, b, side, 8.8, keep), wallOpt(), 0.33);
          else fence(framePath(a, b, side, 8.8, keep), { height: 1.0 + rng() * 0.2, rails: rng() < 0.5 ? 2 : 3, tint: [1, 1, 1] });
        }
      }
    } else if (ST.id === 'vulture') {
      // drop side: a continuous low stone wall 1.8 m outside the road edge (same line as the old corner walls; its face is 1.3 m out, so a car on the road never touches it). Rock side: a layered rock face.
      for (const side of [-1, 1]) {
        const up = p => side > 0 ? p.upR : p.upL;
        let runs = [], cur = null;
        for (let s = 0; s <= track.finishS + 10; s += 3) {
          const u = up(sampleAt(s)), kind = u < 0.4 ? 'drop' : u > 0.6 ? 'rock' : null;
          if (kind && cur && cur.kind === kind) cur.b = s; else { cur = kind ? { kind, a: s, b: s } : null; if (cur) runs.push(cur); }
        }
        runs.forEach(r => {
          if (r.b - r.a < 9) return;
          if (r.kind === 'drop') stone(framePath(r.a, r.b, side, 1.8, keep, { any: true, follow: true, noDist: true, min: 2, step: 2 }), Object.assign(wallOpt(), { height: 0.95, sink: 1.8 }), 0.5);
          else for (const [a, b] of chunksOf(rng, r.a, r.b, 90, 150, 0, 0)) face(framePath(a, b + 6, side, 3.6, keep, { step: 6, any: true }), { side, height: 9 + rng() * 5, lean: 0.3 + rng() * 0.2, rough: 1.2, rows: 5, seed: seed(), tint: [1, 0.97, 0.97] });
        });
      }
    } else if (ST.id === 'test') {
      // practice stage: no walls, fences or houses
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
