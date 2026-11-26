  /* ---------- theme: forest (Kettle Ridge) ---------- */
  function sceneryForest(rng) {
    const trees = scatter(rng, 2600, 12000, (x, z, d, y, s0) => {
      if (d < half + 5) return false;
      if (rng() > (d < 30 ? 0.75 : d < 90 ? 0.45 : 0.18)) return false;
      return nearHouse(x, z) ? false : { snow: s0 > ST.snowFrom - 40 };
    });
    const fin = track.finishS, snowS = ST.snowFrom - 40;
    const lvl = { snow: s0 => s0 > snowS, ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 7 && slopeAt(x, z) < 0.5 };
    const woods = woodExtras(trees, Object.assign({ salt: 1, a: 480, b: snowS, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14, rows: [
      { o0: 5.6, o1: 8.2, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.2 }, { o0: 9, o1: 14, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.4 },
      { o0: 15, o1: 24, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.6 }, { o0: 25, o1: 40, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4 }] }, lvl));
    const crest = woodExtras(trees.concat(woods), Object.assign({ salt: 2, a: snowS, b: fin - 90, minLen: 25, maxLen: 55, gapMin: 70, gapMax: 160, colMax: 14, rows: [
      { o0: 7, o1: 12, step: 5, p: 0.6, s0: 1.0, s1: 1.5, sep: 3.4 }, { o0: 13, o1: 24, step: 5, p: 0.55, s0: 1.1, s1: 1.6, sep: 3.8 }] }, lvl));
    if (ST.id === 'kettle') for (const t of woods.concat(crest)) if (ctxBlocked(t.x, t.z)) t.s = 0.001;       // trees stay off the world's places (own placements: worldPlan)
    conifers(trees.concat(woods, crest), (c, t) => t.snow ? c.setRGB(0.80 + rng() * 0.1, 0.88 + rng() * 0.08, 0.95) : c.setRGB(0.13 + rng() * 0.06, 0.48 + rng() * 0.12, 0.30 + rng() * 0.06));
    rocks(rng, roadsideRocks(rng, 320).filter(r => !nearHouse(r.x, r.z)).map(r => ctxBlocked(r.x, r.z) ? Object.assign(r, { size: 0.001, solid: false }) : r));
    cornerRails(t => t.r <= 60, { postColor: 0x6b5238, railColor: 0xff6a1f, solid: true, mu: 0.3 });
  }

  /* ---------- theme: test (Test Track): open country, a few trees far back for orientation, nothing solid anywhere near the road ---------- */
  function sceneryTest(rng) {
    const trees = scatter(rng, 90, 6000, (x, z, d, y, s0) => d > 70 && rng() < 0.5 ? { col: false } : false);
    conifers(trees, (c) => c.setRGB(0.13 + rng() * 0.06, 0.48 + rng() * 0.12, 0.30 + rng() * 0.06));
  }

  /* ---------- theme: castle (Thornwick Keep) ---------- */
  function sceneryCastle(rng) {
    const C = ST.castle, g1 = C.gate1, g2 = C.gate2, fin = track.finishS, L = castleL;
    // forest thick on the climb, thin round the castle and on the descent, a meadow at the finish. Nothing solid within 8 m of the road edge.
    const gapOf = (x, z) => { const n = world.nearest(x, z); return n.i < 0 ? 99 : Math.sqrt(n.d2) - half; };      // exact distance from the road edge (the terrain grid's is only good to a few metres)
    const dens = s0 => s0 < 470 ? 0.3 : s0 < g1 - 20 ? 1 : s0 < g2 + 40 ? 0.3 : s0 < fin - 330 ? 0.65 : s0 < fin - 130 ? 0.25 : 0.03;
    const trees = scatter(rng, 2300, 14000, (x, z, d, y, s0) => {
      if (d < half + 8.2 || gapOf(x, z) < 8.6) return false;
      if (rng() > (d < 30 ? 0.75 : d < 90 ? 0.45 : 0.18) * dens(s0)) return false;
      return nearHouse(x, z) ? false : true;
    });
    const lvl = { ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 7 && slopeAt(x, z) < 0.5 };
    const rowsA = [{ o0: 5.6, o1: 8.2, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.2 }, { o0: 9, o1: 14, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.4 },
      { o0: 15, o1: 24, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.6 }, { o0: 25, o1: 40, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4 }];
    const woods = woodExtras(trees, Object.assign({ salt: 1, a: 480, b: g1 - 70, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14, rows: rowsA }, lvl));
    const lower = woodExtras(trees.concat(woods), Object.assign({ salt: 2, a: g2 + 70, b: fin - 330, minLen: 80, maxLen: 200, gapMin: 40, gapMax: 110, colMax: 14, rows: [rowsA[1], rowsA[2], rowsA[3]] }, lvl));
    for (const t of woods.concat(lower)) if (t.col && gapOf(t.x, t.z) < 8.6) t.col = false;        // trunks you can hit stay 8 m or more from the road edge; nearer ones are for looks only
    conifers(trees.concat(woods, lower), (c) => c.setRGB(0.18 + rng() * 0.06, 0.50 + rng() * 0.12, 0.27 + rng() * 0.06));      // (art) warmer olive greens for the dawn light; same three random draws
    // boulders: only the ones 8 m or more from the road edge are solid
    rocks(rng, roadsideRocks(rng, 220).filter(r => !nearHouse(r.x, r.z)).map(r => Object.assign(r, { solid: r.solid && gapOf(r.x, r.z) >= 8.6 + r.size })));
    buildCastle(L);
  }

  /* ---------- theme: alpine cliffs (Vulture Ledge) ---------- */
  function sceneryAlpine(rng) {
    const pines = scatter(rng, 1500, 14000, (x, z, d, y) => {
      if (d < half + 7 || y > ST.snowLine - 6 || slopeAt(x, z) > 0.45) return false;
      return rng() < (d < 40 ? 0.4 : d < 140 ? 0.22 : 0.1);
    });
    const upOf = (p, side) => side > 0 ? p.upR : p.upL;
    const ridge = { salt: 3, a: 40, b: track.finishS - 40, minLen: 180, maxLen: 420, gapMin: 12, gapMax: 50, colMax: 14,
      ok: (p, side, off, x, z, y) => { const u = upOf(p, side); if (y > ST.snowLine - 6 || slopeAt(x, z) > 0.5) return false;
        return u > 0.6 ? off >= 11 : u < 0.4 ? off >= 16 && y < p.y - 2 : off >= 13; },
      rows: [{ o0: 9, o1: 16, step: 4, p: 0.85, s0: 1.0, s1: 1.4, sep: 3.6 }, { o0: 17, o1: 28, step: 3.5, p: 0.9, s0: 1.1, s1: 1.6, sep: 4 }, { o0: 29, o1: 48, step: 3.6, p: 0.9, s0: 1.2, s1: 1.8, sep: 4.4 }] };
    const woods = woodExtras(pines, ridge);
    conifers(pines.concat(woods), (c) => c.setRGB(0.10 + rng() * 0.05, 0.38 + rng() * 0.1, 0.30 + rng() * 0.05), { tall: 1.25, wide: 0.8 });
    // boulders at the foot of the rock walls (solid), loose rocks across steep ground
    const wallRocks = roadsideRocks(rng, 160, (p, side) => (side > 0 ? p.upR : p.upL) > 0.6).map(r => Object.assign(r, { size: r.size * 1.6 }));
    const scree = scatter(rng, 420, 9000, (x, z, d, y) => d > half + 6 && slopeAt(x, z) > 0.55 ? { size: 0.4 + rng() * 1.4, solid: false } : false);
    rocks(rng, wallRocks.concat(scree), [0.60, 0.55, 0.62]);
    // drop-side walls and rock faces: see buildRoadside() in scenery.js. The old corner collision stays underneath as a safety layer.
    for (const sg of cliffBarriers(track, half).segs) obstacles.push(sg);
    distantPeaks(rng, 20, ST.look.peak ? ST.look.peak[0] : 0x9aa6d0, ST.look.peak ? ST.look.peak[1] : 0xf4f7ff, { dist: 1350, y: -60, hideRandom: !!ST.look.noPeaks });
  }

  /* ---------- theme: desert (Red Mesa Run) ----------
     The mesas are part of the ground (mesaHeight in stages.js), so they cost no extra pieces. Here: red boulders, cacti and dead trees,
     and a few red rock banks beside the road (visual rock faces 9 m out). Cacti and dead trees are two merged meshes drawn instanced.
     Nothing solid within 8.6 m of the road edge; the racing line stays clear. */
  function desertGeo(kind, sides) {
    const Pp = [], Cc = [], Ii = [];
    const tube = (p0, p1, r0, r1, col, cap) => {
      const ax = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(ax[0], ax[1], ax[2]); ax[0] /= L; ax[1] /= L; ax[2] /= L;
      const ref = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let u = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]]; const ul = Math.hypot(u[0], u[1], u[2]); u = u.map(q => q / ul);
      const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]], base = Pp.length / 3;
      for (let k = 0; k < sides; k++) {
        const a = k / sides * 6.2832, c = Math.cos(a), s = Math.sin(a);
        for (const [pt, r, sh] of [[p0, r0, 0.8], [p1, r1, 1]]) {
          Pp.push(pt[0] + (u[0] * c + w[0] * s) * r, pt[1] + (u[1] * c + w[1] * s) * r, pt[2] + (u[2] * c + w[2] * s) * r);
          Cc.push(col[0] * sh, col[1] * sh, col[2] * sh);
        }
      }
      for (let k = 0; k < sides; k++) { const a = base + k * 2, b = base + ((k + 1) % sides) * 2; Ii.push(a, b, a + 1, b, b + 1, a + 1); }
      if (cap) { const c = Pp.length / 3; Pp.push(p1[0] + ax[0] * r1 * 0.5, p1[1] + ax[1] * r1 * 0.5, p1[2] + ax[2] * r1 * 0.5); Cc.push(col[0], col[1], col[2]); for (let k = 0; k < sides; k++) Ii.push(base + k * 2 + 1, base + ((k + 1) % sides) * 2 + 1, c); }
    };
    if (kind === 'cactus') {
      const g = [0.36, 0.46, 0.30];
      tube([0, 0, 0], [0, 2.7, 0], 0.30, 0.24, g, true);
      tube([0.2, 1.1, 0], [0.95, 1.2, 0], 0.15, 0.15, g, false); tube([0.95, 1.2, 0], [0.95, 2.1, 0], 0.15, 0.12, g, true);
      tube([-0.2, 1.5, 0], [-0.8, 1.6, 0.1], 0.13, 0.13, g, false); tube([-0.8, 1.6, 0.1], [-0.8, 2.3, 0.1], 0.13, 0.1, g, true);
    } else {
      const d = [0.46, 0.40, 0.34];
      tube([0, 0, 0], [0.1, 3.0, 0], 0.26, 0.09, d, true);
      tube([0.04, 1.4, 0], [0.9, 2.3, 0.2], 0.1, 0.05, d, true); tube([0.07, 2.0, 0], [-0.8, 2.9, -0.2], 0.09, 0.04, d, true); tube([0.09, 2.6, 0], [0.5, 3.6, 0.3], 0.07, 0.03, d, true);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(Ii); g.computeVertexNormals();
    return g;
  }
  function sceneryDesert(rng) {
    const low = quality === 'low';
    const gapOf = (x, z) => { const n = world.nearest(x, z); return n.i < 0 ? 99 : Math.sqrt(n.d2) - half; };
    const keep = frameKeepOut();
    const ok = (x, z, d, y, s0) => d > half + 8.8 && gapOf(x, z) > 8.6 && slopeAt(x, z) < 0.35 && !keep(s0, 1) && !nearHouse(x, z);
    const cacti = scatter(rng, 200, 9000, (x, z, d, y, s0) => ok(x, z, d, y, s0) && rng() < (d < 40 ? 0.5 : 0.2) ? { s: 0.8 + rng() * 0.7 } : false);
    const dead = scatter(rng, 110, 9000, (x, z, d, y, s0) => ok(x, z, d, y, s0) && rng() < (d < 40 ? 0.4 : 0.15) ? { s: 0.8 + rng() * 0.8 } : false);
    const sides = low ? 4 : 6, place = (o, c) => { o.position.set(c.x, c.y - 0.05, c.z); o.rotation.set(0, c.r, 0); o.scale.setScalar(c.s); };
    const lowCut = (list) => low ? list.filter((_, i) => i % 5 < 3) : list;       // phones: a third fewer (look only; trunks below stay solid)
    // one instanced mesh per 300 m of road, so the graphics card skips the ones behind or far ahead (a single mesh would be drawn whole all the time)
    const chunked = (list, kind) => { const by = {}, geo = desertGeo(kind, sides); for (const c of lowCut(list)) (by[Math.floor(c.s0 / 300)] || (by[Math.floor(c.s0 / 300)] = [])).push(c); for (const k in by) instanced(geo, structMat(), by[k], place); };
    chunked(cacti, 'cactus'); chunked(dead, 'dead');
    for (const c of cacti) obstacles.push({ x: c.x, z: c.z, r: 0.32 * c.s });
    for (const c of dead) obstacles.push({ x: c.x, z: c.z, r: 0.22 * c.s });
    // red boulders; only the ones 8.6 m or more from the road edge are solid
    rocks(rng, roadsideRocks(rng, 260).map(r => Object.assign(r, { size: r.size * 1.2, solid: r.solid && gapOf(r.x, r.z) >= 8.6 + r.size })).map(r => ctxBlocked(r.x, r.z) ? Object.assign(r, { size: 0.001, solid: false }) : r), [0.58, 0.34, 0.25]);   // rocks and trees shrink on the world's places (no random number moves)
    distantPeaks(rng, 20, 0x8a5048, 0xe0b090, { dist: 1350, y: -60, hideRandom: true });
  }

  /* ---------- theme: Japan (Sakura Touge) ---------- */
  function sceneryJapan(rng) {
    const city0 = track.cityStart, tun = ST.toriiTunnel;
    const inTunnel = s0 => s0 > tun[0] - 6 && s0 < tun[1] + 6;
    // cherry trees: countryside and around the shrine
    const sakura = scatter(rng, 700, 9000, (x, z, d, y, s0) => {
      if (d < half + 4.5 || s0 > city0 - 40 || (s0 > 700 && s0 < city0 - 300 && rng() < 0.85)) return false;
      if (s0 < 560 && d > half + 7 && d < 170 && slopeAt(x, z) < 0.14) return false;     // keep paddies open
      return rng() < (d < 25 ? 0.6 : d < 80 ? 0.3 : 0.08) && !nearHouse(x, z) ? { s: 0.8 + rng() * 0.5 } : false;
    });
    const lining = woodExtras(sakura, { salt: 4, a: 140, b: tun[0] - 40, minLen: 90, maxLen: 200, gapMin: 50, gapMax: 130, colMax: 12,
      ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 3 && slopeAt(x, z) < 0.4,
      rows: [{ o0: 5, o1: 8, step: 6.5, p: 0.75, s0: 0.9, s1: 1.3, sep: 4.5 }, { o0: 10, o1: 15, step: 9, p: 0.4, s0: 0.9, s1: 1.4, sep: 5 }] });
    const sakuraAll = sakura.concat(lining);
    treeStand(sakuraAll, () => SPECIES.sakura);
    // trunks you can hit stay 7 m or more from the road edge (a car that slides wide at 150 km/h runs out onto open ground, not into a tree); nearer ones are for looks only
    for (const t of sakuraAll) if ((t.col !== undefined ? t.col : t.d < 30) && Math.sqrt(world.nearest(t.x, t.z).d2) - half >= 7) obstacles.push({ x: t.x, z: t.z, r: 0.3 * t.s });
    // cedar forest on the mountain pass
    const cedars = scatter(rng, 1800, 12000, (x, z, d, y, s0) => {
      if (d < half + 5 || s0 < 690 || s0 > city0 - 60 || inTunnel(s0)) return false;
      return rng() < (d < 50 ? 0.7 : d < 150 ? 0.4 : 0.15) && !nearHouse(x, z) ? { s: 0.9 + rng() * 0.5 } : false;
    });
    const groves = woodExtras(cedars, { salt: 5, a: tun[1] + 30, b: city0 - 70, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14,
      ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 12 && slopeAt(x, z) < 0.55,
      rows: [{ o0: 6, o1: 9, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.4 }, { o0: 10, o1: 15, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.6 },
        { o0: 16, o1: 26, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.8 }, { o0: 27, o1: 42, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4.2 }] });
    conifers(cedars.concat(groves), (c) => c.setRGB(0.10 + rng() * 0.04, 0.34 + rng() * 0.08, 0.26 + rng() * 0.05), { tall: 1.6, wide: 0.7 });
    rocks(rng, roadsideRocks(rng, 90, p => p.s > 700 && p.s < city0 - 60));
    // white guardrails on the pass
    cornerRails(t => t.r <= 80 && t.s0 > 680 && t.s1 < city0 - 30, { postColor: 0x8d939c, railColor: 0xeef1f5, style: 'guard', railH: 0.32, railY: 0.62, offset: 1.4, postH: 0.8, solid: true });

    // tunnel of vermilion torii gates
    const VERM = 0xe2432b, gates = [];
    for (let s = tun[0]; s <= tun[1]; s += 4.6) gates.push(sampleAt(s));
    const span = half + 0.8;
    const pillars = [];
    for (const p of gates) for (const sd of [-1, 1]) { const [x, z] = sideXZ(p, sd * span); pillars.push({ x, z, y: terrain.heightAt(x, z) }); obstacles.push({ x, z, r: 0.32 }); }
    instanced(new THREE.CylinderGeometry(0.24, 0.27, 4.7, 10).translate(0, 2.35, 0), lit({ color: VERM }), pillars, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    const beamY = p => terrain.heightAt(p.x, p.z);
    instanced(new THREE.BoxGeometry(span * 2 + 1.8, 0.34, 0.5).translate(0, 4.75, 0), lit({ color: 0x2a1d22 }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(span * 2 + 1.4, 0.3, 0.42).translate(0, 4.4, 0), lit({ color: VERM }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(span * 2 + 0.6, 0.24, 0.3).translate(0, 3.7, 0), lit({ color: VERM }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });

    // shrine beside the tunnel exit: stone platform, hall, hip roof, big torii and stone lanterns
    {
      const p = sampleAt(tun[1] + 30), [sx, sz] = sideXZ(p, -34), sy = terrain.heightAt(sx, sz);
      const shrine = new THREE.Group(); shrine.position.set(sx, sy, sz); shrine.rotation.y = p.th + Math.PI / 2;
      const box = (w, hh, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), lit({ color })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; shrine.add(m); return m; };
      box(16, 1.2, 13, 0xb9b2aa, 0, 0.2, 0);
      box(10, 4.2, 7.5, 0xf3e6cf, 0, 2.9, 0);
      for (const px of [-4.6, -1.6, 1.6, 4.6]) box(0.45, 4.2, 0.45, VERM, px, 2.9, 3.9);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 1, 1, 4, 1), lit({ color: 0x39405a }));
      roof.rotation.y = Math.PI / 4; roof.scale.set(9.5, 3.6, 7.6); roof.position.set(0, 6.8, 0); roof.castShadow = true; shrine.add(roof);
      box(13.5, 0.4, 10.5, 0x39405a, 0, 5.0, 0);
      // approach torii
      for (const px of [-2.6, 2.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 6.5, 10), lit({ color: VERM })); c.position.set(px, 3.25, 13); c.castShadow = true; shrine.add(c); }
      box(7.8, 0.45, 0.7, 0x2a1d22, 0, 6.6, 13); box(7.0, 0.4, 0.6, VERM, 0, 6.15, 13); box(6.0, 0.3, 0.4, VERM, 0, 5.2, 13);
      for (const [lx, lz] of [[-3.5, 9], [3.5, 9], [-3.5, 17], [3.5, 17]]) { box(0.9, 0.5, 0.9, 0xb5b0a8, lx, 0.25, lz); box(0.35, 1.0, 0.35, 0xb5b0a8, lx, 1.0, lz); box(0.9, 0.7, 0.9, 0xc9c3ba, lx, 1.85, lz); box(1.2, 0.3, 1.2, 0x8f8a83, lx, 2.35, lz); }
      add(shrine);
    }

    // utility poles and sagging wires (countryside and town)
    const poles = [];
    for (let s = 20; s < track.length - 20; s += 34) { if (s > 600 && s < city0 - 120) continue; if (inTunnel(s)) continue; const p = sampleAt(s), [x, z] = sideXZ(p, half + 2.8); poles.push({ x, z, y: terrain.heightAt(x, z), th: p.th, s }); obstacles.push({ x, z, r: 0.22 }); }
    instanced(new THREE.CylinderGeometry(0.13, 0.17, 9, 7).translate(0, 4.5, 0), lit({ color: 0x8b8d94 }), poles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, 8.3, 0), lit({ color: 0x5d6068 }), poles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); });
    {
      const verts = [], sagBuf = [];
      for (let i = 1; i < poles.length; i++) {
        const a = poles[i - 1], b = poles[i]; if (b.s - a.s > 40) continue;
        for (const off of [-0.8, 0, 0.8]) {
          const ox = Math.cos(a.th) * off, oz = -Math.sin(a.th) * off;
          const pp = sagPoints(sagBuf, [a.x + ox, a.y + 8.3, a.z + oz], [b.x + ox, b.y + 8.3, b.z + oz], 0.7, 8);      // art/settlement.js
          for (let k = 0; k < 8; k++) verts.push(pp[k * 3], pp[k * 3 + 1], pp[k * 3 + 2], pp[k * 3 + 3], pp[k * 3 + 4], pp[k * 3 + 5]);
        }
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2633 })));
    }

    // ----- town -----
    // window texture: 4 × 4 windows per tile, lit windows glow at dusk
    const winTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = '#3b4766'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); g.fillStyle = '#d9d5cf'; g.fillRect(i * 64 + 8, j * 64 + 50, 48, 5); }
    });
    const r2 = mulberry32(77);
    const litTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (r2() < (ST.look.night ? 0.8 : 0.55)) { g.fillStyle = r2() < 0.7 ? '#fff0b8' : '#d4ecff'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); }
    });
    for (const t of [winTex, litTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    const bMat = lit({ map: winTex, emissiveMap: litTex, emissive: 0xffffff, emissiveIntensity: ST.look.night ? 1.05 : 0.85, vertexColors: true });
    const WALLS = [[1.0, 0.96, 0.88], [0.86, 0.88, 0.92], [1.0, 0.84, 0.78], [0.82, 0.90, 1.0], [0.95, 0.90, 0.80], [0.78, 0.80, 0.84]];
    function building(w, d, hh) {
      const g = new THREE.BoxGeometry(w, hh, d); g.translate(0, hh / 2, 0);
      const uv = g.attributes.uv, n = uv.count;
      for (let v = 0; v < n; v++) {
        const face = Math.floor(v / 4), fw = face < 2 ? d : w;
        if (face === 2 || face === 3) uv.setXY(v, 0.01, 0.01);
        else uv.setXY(v, uv.getX(v) * fw / 12.8, uv.getY(v) * Math.max(1, hh - 1) / 13.6);
      }
      const wc = WALLS[Math.floor(rng() * WALLS.length)], cols = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) cols.set(wc, v * 3);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      return g;
    }
    const SIGNS = [['ラーメン', '#e2392b'], ['カラオケ', '#7a3cd6'], ['居酒屋', '#f0a01e'], ['薬局', '#1f9a5a'], ['ホテル', '#e0408a'], ['寿司', '#1d5fd1'], ['喫茶', '#8c5a2b'], ['本屋', '#0f8a8a'], ['ゲーム', '#d6309c'], ['焼鳥', '#c2341f']];
    const signMats = SIGNS.map(([txt, bg]) => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(128, 512, (g, w, hh) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, hh); g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, hh - 16);
      g.fillStyle = '#ffffff'; g.font = '800 84px ' + JP_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = [...txt], step = Math.min(110, (hh - 60) / chars.length);
      chars.forEach((ch, k) => g.fillText(ch, w / 2, hh / 2 + (k - (chars.length - 1) / 2) * step));
    }) }));
    const vendTex = canvasTex(64, 128, (g) => {
      g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#cfe8ff'; g.fillRect(6, 8, 52, 60);
      const cans = ['#e2392b', '#1d5fd1', '#f0a01e', '#1f9a5a', '#ffffff', '#7a3cd6'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { g.fillStyle = cans[(r * 5 + c) % cans.length]; g.fillRect(9 + c * 10, 12 + r * 19, 7, 14); }
      g.fillStyle = '#333a44'; g.fillRect(10, 84, 44, 10); g.fillRect(22, 104, 20, 14);
    });
    const vendMat = new THREE.MeshBasicMaterial({ map: vendTex });
    const lampHeads = [], lampPoles = [], lanterns = [], vends = [];
    const townB = [];                                  // look only: the buildings, for the 3D detail (art/buildings.js townDetail)
    for (const side of [-1, 1]) {
      let s = city0 + 10;
      while (s < track.length - 10) {
        const w = 8 + rng() * 9, d = 10 + rng() * 6, sc = s + w / 2, p = sampleAt(sc);
        const off = side * (half + 3.6 + d / 2), [cx, cz] = sideXZ(p, off);
        const fx = Math.sin(p.th), fz = Math.cos(p.th), rx = -Math.cos(p.th), rz = Math.sin(p.th);
        let ok = true;
        for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) if (terrain.distAt(cx + fx * a + rx * b, cz + fz * a + rz * b) < half + 2.6) ok = false;
        if (!ok || rng() < 0.08) { s += 5; continue; }
        const nearEnd = clamp((sc - city0) / (track.finishS - city0), 0, 1);
        const hh = 7 + rng() * 12 + nearEnd * rng() * 22;
        const y = terrain.heightAt(cx, cz) - 1.5;
        const m = new THREE.Mesh(building(w, d, hh), bMat); m.position.set(cx, y, cz); m.rotation.y = p.th + Math.PI / 2; m.castShadow = m.receiveShadow = true; add(m); townB.push({ x: cx, y, z: cz, yaw: p.th + Math.PI / 2, w, d, h: hh, side });
        { // the footprint as four wall segments (w along the road, d away from it), matching the mesh
          const ax = -Math.cos(p.th) * d / 2, az = Math.sin(p.th) * d / 2, bx = Math.sin(p.th) * w / 2, bz = Math.cos(p.th) * w / 2;
          const c = [[cx + ax + bx, cz + az + bz], [cx + ax - bx, cz + az - bz], [cx - ax - bx, cz - az - bz], [cx - ax + bx, cz - az + bz]];
          for (let k = 0; k < 4; k++) obstacles.push({ ax: c[k][0], az: c[k][1], bx: c[(k + 1) % 4][0], bz: c[(k + 1) % 4][1], r: 0.1, h: 99 });
        }
        // rooftop boxes
        if (rng() < 0.7) { const ac = new THREE.Mesh(new THREE.BoxGeometry(2 + rng() * 2, 1.2, 2), lit({ color: 0xbfc4cc })); ac.position.set(cx, y + hh + 0.6, cz); ac.rotation.y = p.th + rng(); add(ac); }
        // vertical sign sticking out from the facade, readable as you drive up
        if (rng() < 0.75) {
          const [gx, gz] = sideXZ(sampleAt(sc - w * 0.3), side * (half + 3.0));
          const si = Math.floor(rng() * signMats.length), sg = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.6), signMats[si]);
          sg.position.set(gx, terrain.heightAt(gx, gz) + 4.2 + rng() * 3, gz); sg.rotation.y = p.th; add(sg);
          if (ST.look.night) glowSpots.push({ x: gx, y: sg.position.y, z: gz, c: parseInt(SIGNS[si][1].slice(1), 16), size: 2.2 });
        }
        if (rng() < 0.4) for (let k = 0; k < 3; k++) { const [lx, lz] = sideXZ(sampleAt(sc - 2 + k * 2), side * (half + 3.3)); lanterns.push({ x: lx, z: lz, y: terrain.heightAt(lx, lz) + 3.1 }); if (ST.look.night) glowSpots.push({ x: lx, y: terrain.heightAt(lx, lz) + 3.1, z: lz, c: 0xff4a30, size: 1.2 }); }
        if (rng() < 0.25) { const [vx, vz] = sideXZ(sampleAt(sc + 1), side * (half + 2.9)); vends.push({ x: vx, z: vz, y: terrain.heightAt(vx, vz), th: p.th + (side > 0 ? Math.PI / 2 : -Math.PI / 2) }); obstacles.push({ x: vx, z: vz, r: 0.6 }); }
        s += w + 0.6 + rng() * 2;
      }
      for (let ls = city0 + 15; ls < track.length - 10; ls += 26) { const p = sampleAt(ls), [x, z] = sideXZ(p, side * (half + 0.9)), y = terrain.heightAt(x, z); lampPoles.push({ x, z, y, th: p.th, side }); lampHeads.push({ x: x + Math.cos(p.th) * side * 0.9, z: z - Math.sin(p.th) * side * 0.9, y: y + 5.6 }); obstacles.push({ x, z, r: 0.18 }); }
    }
    instanced(new THREE.CylinderGeometry(0.08, 0.1, 5.8, 6).translate(0, 2.9, 0), lit({ color: 0x5d6068 }), lampPoles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1.0, 0.1, 0.1), lit({ color: 0x5d6068 }), lampPoles, (o, q) => { o.position.set(q.x + Math.cos(q.th) * q.side * 0.45, q.y + 5.75, q.z - Math.sin(q.th) * q.side * 0.45); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), lampHeads, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    instanced(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 10), new THREE.MeshBasicMaterial({ color: 0xff4a36 }), lanterns, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    instanced(new THREE.BoxGeometry(1.0, 1.9, 0.75).translate(0, 0.95, 0), [lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), vendMat, lit({ color: 0xd8342c })], vends, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th, 0); o.scale.setScalar(1); });
    townDetail(townB);
    // zebra crossing just before the finish
    const stripes = [];
    { const p = sampleAt(track.finishS - 25); for (let k = -4; k <= 4; k++) { const [x, z] = sideXZ(p, k * (half / 4.6)); stripes.push({ x, z, y: terrain.heightAt(x, z) + 0.06, th: p.th }); } }
    instanced(new THREE.PlaneGeometry(0.55, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f2ea, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), stripes, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th, 0); o.scale.setScalar(1); }, { shadow: false });
    // a snow-capped volcano on the horizon, straight ahead at the finish
    const pe = sampleAt(track.finishS), fd = 1700;
    distantPeaks(rng, 10, ST.look.peak ? ST.look.peak[0] : 0x8d86c4, ST.look.peak ? ST.look.peak[1] : 0xfff0f4, { dist: 1400, y: -40, hideRandom: !!ST.look.noPeaks, extra: { x: pe.x + Math.sin(pe.th) * fd, z: pe.z + Math.cos(pe.th) * fd, r: 900, h: 720, rot: 0, cap: 0.28 } });
  }

  /* ---------- trackside: spectators behind tape and sponsor boards (all brands invented) ---------- */
  const SPONSORS = [['ROTOR OIL', '#d32f2f', '#ffffff'], ['KAISER TYRES', '#ffd600', '#111111'], ['NOVA FUEL', '#1565c0', '#ffffff'], ['GRIPMAX', '#111111', '#ffd600'],
    ['SOLARIS', '#ef6c00', '#ffffff'], ['TURBO COLA', '#c62828', '#ffe082'], ['VELOCE', '#2e7d32', '#ffffff'], ['ZENITH WATCHES', '#283593', '#ffd54f']];
  let sponsorMats = null;
  function getSponsorMats() {
    if (!sponsorMats) sponsorMats = SPONSORS.map(([txt, bg, fg]) => lit({ map: canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
      g.font = 'italic 900 58px "Arial Black", "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(txt, w / 2, h / 2 + 2);
    }) }));
    for (const m of sponsorMats) { m.userData.keep = true; m.map.userData.keep = true; }     // cached for every stage: the stage dispose leaves them
    return sponsorMats;
  }
  function trackside(rng) {
    if (ST.practice) { readabilityBoards(); return; }       // practice stage: no sponsor boards, crowds or tape, nothing beside the road but the corner boards
    const boards = [], crowds = [], tapes = [];
    const groundOk = (x, z, p) => Math.abs(terrain.heightAt(x, z) - p.y) < 2.5 && terrain.distAt(x, z) > half + 2.2;
    const city = isFinite(track.cityStart) ? track.cityStart : Infinity;
    const addBoard = (s0, side) => { const p = sampleAt(s0), off = side * (half + 3.2), [x, z] = sideXZ(p, off); if (groundOk(x, z, p)) { boards.push({ x, z, y: terrain.heightAt(x, z), th: p.th, side, k: boards.length }); obstacles.push({ x, z, r: 0.5 }); } };
    for (let s0 = 26; s0 < 130; s0 += 13) addBoard(s0, (s0 / 13) % 2 < 1 ? 1 : -1);
    for (const cp of ST.checkpoints) for (const d of [-22, -10, 10]) addBoard(cp + d, d < 0 ? -1 : 1);
    for (let s0 = track.finishS - 70; s0 < track.finishS + 30; s0 += 12) { addBoard(s0, 1); addBoard(s0 + 6, -1); }
    // spectators: start, finish, tight corners (outside, well back) and jumps
    const spots = [[30, 1, 'start'], [44, -1, 'start'], [track.finishS - 30, -1, 'finish'], [track.finishS + 15, 1, 'finish']];
    for (const t of track.turns) if (t.r <= 45) spots.push([(t.s0 + t.s1) / 2, t.dir === 'R' ? -1 : 1, 'corner']);
    for (const [js] of ST.jumps) spots.push([js + 8, 1, 'jump'], [js + 8, -1, 'jump']);
    if (ST.castle) spots.push([ST.castle.gate1 - 26, 1, 'corner'], [ST.castle.gate1 - 26, -1, 'corner'], [ST.castle.gate2 + 26, 1, 'corner']);      // SS4: crowds in front of the gatehouse and outside the back gate
    for (const [s0, side, tag] of spots) {
      if (s0 > city - 20 && s0 < track.finishS - 40) continue;
      for (let k = -1; k <= 1; k++) {
        const p = sampleAt(s0 + k * 7.5), off = side * (half + 6.5 + rng() * 1.5), [x, z] = sideXZ(p, off);
        if (!groundOk(x, z, p)) continue;
        crowds.push({ x, z, y: terrain.heightAt(x, z), th: p.th, side, u: rng(), tag });
        const [tx, tz] = sideXZ(p, side * (half + 4.2)); tapes.push({ x: tx, z: tz, y: terrain.heightAt(tx, tz), th: p.th });
        obstacles.push({ x: tx, z: tz, r: 0.2 });
      }
    }
    const mats = getSponsorMats(), sponsorPlace = (o, b) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.th + (b.side > 0 ? Math.PI / 2 : -Math.PI / 2), 0); o.scale.setScalar(1); };
    const faces = sponsorFaceGeo();
    mats.forEach((m, mi) => instanced(faces, m, boards.filter(b => b.k % mats.length === mi), sponsorPlace));
    instanced(sponsorFrameGeo(), structMat(), boards, sponsorPlace);                // frame, legs and stays (3D), one mesh for all sponsors
    for (const c of crowds) crowdAdd(crowdGroup(c, { tag: c.tag }));              // 3D spectators (art/people.js)
    instanced(tapeGeo(), structMat(), tapes, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); }, { shadow: false });      // stakes and sagging tape (3D)
    readabilityBoards();
  }

  /* ---------- readability: chevron boards on tight or blind corners, 100/50 m boards before hairpins and squares ---------- */
  function readabilityBoards() {
    const signs = { L: [], R: [], b100: [], b50: [] }, posts = [];
    const city = isFinite(track.cityStart) ? track.cityStart : Infinity;
    const place = (list, s0, side, faceBack = 25) => {
      if (s0 < 30 || s0 > track.finishS - 10) return;
      const p = sampleAt(s0), [x, z] = sideXZ(p, side * (half + 3.0));
      if (terrain.distAt(x, z) < half + 2.2) return;                      // would stand on another stretch of road
      const q = sampleAt(s0 - faceBack), ground = terrain.heightAt(x, z), y = Math.max(ground, p.y - 0.3);
      if (y - ground > 6) return;
      list.push({ x, z, y, rot: Math.atan2(q.x - x, q.z - z) });
      posts.push({ x, z, y0: ground, h: y - ground + 1.9 });
      if (!ST.practice) obstacles.push({ x, z, r: 0.12 });      // (practice stage: the corner boards are not solid)
    };
    for (const t of track.turns) {
      const side = t.dir === 'R' ? -1 : 1;                                 // boards stand on the outside
      if (t.r <= 45 || t.blind) {
        const len = t.s1 - t.s0, n = len > 60 ? 4 : 3;
        for (let k = 0; k < n; k++) place(signs[t.dir], t.s0 + len * (0.08 + 0.8 * k / (n - 1)) * 0.75, side, 22);
      }
      if (t.r <= 32 && t.s0 < city + 400) { place(signs.b100, t.s0 - 100, side, 30); place(signs.b50, t.s0 - 50, side, 30); }
    }
    const chev = right => canvasTex(128, 96, (g) => {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#e8322b'; g.fillRect(6, 6, 116, 84);
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 2; k++) {
        const x0 = 22 + k * 44; g.beginPath();
        if (right) { g.moveTo(x0, 16); g.lineTo(x0 + 20, 16); g.lineTo(x0 + 46, 48); g.lineTo(x0 + 20, 80); g.lineTo(x0, 80); g.lineTo(x0 + 26, 48); }
        else { g.moveTo(x0 + 46, 16); g.lineTo(x0 + 26, 16); g.lineTo(x0, 48); g.lineTo(x0 + 26, 80); g.lineTo(x0 + 46, 80); g.lineTo(x0 + 20, 48); }
        g.closePath(); g.fill();
      }
    });
    const dist = label => canvasTex(96, 128, (g) => {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, 96, 128); g.fillStyle = '#ffffff'; g.fillRect(6, 6, 84, 116);
      g.fillStyle = '#e8322b'; for (let k = 0; k < (label === '100' ? 3 : 2); k++) g.fillRect(14, 74 + k * 15, 68, 9);
      g.fillStyle = '#16181c'; g.font = '800 40px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 48, 40);
    });
    const placeB = (o, b) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.rot, 0); o.scale.setScalar(1); };
    const board = (list, tex, w, h) => instanced(boardFaceGeo(w, h), new THREE.MeshBasicMaterial({ map: tex }), list, placeB, { shadow: false });
    const frame = (list, w, h) => instanced(boardFrameGeo(w, h), structMat(), list, placeB, { shadow: false });
    board(signs.R, chev(true), 2.3, 1.7); board(signs.L, chev(false), 2.3, 1.7); frame(signs.R.concat(signs.L), 2.3, 1.7);
    board(signs.b100, dist('100'), 1.3, 1.75); board(signs.b50, dist('50'), 1.3, 1.75); frame(signs.b100.concat(signs.b50), 1.3, 1.75);
    instanced(postGeo(), structMat(), posts, (o, q) => { o.position.set(q.x, q.y0, q.z); o.rotation.set(0, 0, 0); o.scale.set(1, q.h, 1); }, { shadow: false });
    instanced(postFootGeo(), structMat(), posts, (o, q) => { o.position.set(q.x, q.y0, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
  }


  /* ---------- the world around SS1 Kettle Ridge (docs/decisions.md, 2026-11-24; names and distances from docs/region.md) ----------
     Birkwen village green at the start (church, inn, shop, cross, bus shelter, letter boxes), the service park on a bench, the Kettle Wold farm
     (barn, farmhouse, silo, hay, cattle, fences, a power line) along s 140 to 470, two closed side roads with signposts, km posts every 100 m,
     and the Sawmill Gap timber yard at the finish. All of it is scenery: built from art's settlement kit (art/settlement.js) as ONE merged mesh per place
     (cullFar hides far places), instanced posts / cattle. Own generator (ST.seed * 211 + 5): no older tree, rock or board moves.
     worldPlan() runs before the trees (it tells them where not to grow), worldBuild() after the roadside. Everything stands 20 m or more from the road edge
     unless it is non-solid (letter boxes, signposts, km posts, tape) or in the village street (8.6 m or more from the edge). */
  let worldData = null;
  const WORLD_FOOT = {                                                // solid footprint { w across (local x), d deep (local z), dz centre offset }; circles { r }
    church: { w: 7.2, d: 15, dz: 1.4 }, inn: { w: 12.6, d: 7.8, dz: 0.2 }, shop: { w: 7.4, d: 6.4 }, marketCross: { r: 2.1 }, busShelter: { w: 3.6, d: 1.6 },
    barn: { w: 9.6, d: 13.6 }, farmhouse: { w: 9.4, d: 8, dz: 0.8 }, teamVan: { w: 2.4, d: 5.9 }, trailer: { w: 2.7, d: 9 , dz: 1.2 }, timingHut: { w: 5.4, d: 3 },
    logStack: { w: 4.2, d: 9 }, sawChimney: { r: 1.9 },
    tradingPost: { w: 10.4, d: 11.4, dz: 2 }, gasStation: { w: 12.2, d: 14.4, dz: -3.5 }, waterTower: { r: 3.2 }, headframe: { w: 13, d: 17, dz: 3 }, windpump: { r: 2 },
  };
  function worldModels() {                                            // extra models for the kit (same rules as art's: draw into c.m, local frame, front +z)
    const M = settle.models, here = (c, lx, lz) => { const r = c.o.rot || 0; return [c.o.x + lx * Math.cos(r) + lz * Math.sin(r), c.o.z - lx * Math.sin(r) + lz * Math.cos(r)]; };
    const gh = (c, lx, lz) => { const [x, z] = here(c, lx, lz); return terrain.heightAt(x, z) - c.o.y; };
    M.laneStrip = (c) => {                                            // a dirt lane along local +z, hugging the ground
      const { m, o, low } = c, len = o.len || 20, w = o.w || 3.4, col = o.col || [0.52, 0.44, 0.32], n = Math.max(1, Math.round(len / (low ? 8 : 4)));
      for (let i = 0; i < n; i++) {
        const z0 = len * i / n, z1 = len * (i + 1) / n, y = (x, z) => gh(c, x, z) + 0.13;
        m.quad([-w / 2, y(-w / 2, z0), z0], [w / 2, y(w / 2, z0), z0], [w / 2, y(w / 2, z1), z1], [-w / 2, y(-w / 2, z1), z1], col, { two: true });
        if (!low) m.quad([-0.12, y(-0.12, z0) + 0.015, z0], [0.12, y(0.12, z0) + 0.015, z0], [0.12, y(0.12, z1) + 0.015, z1], [-0.12, y(-0.12, z1) + 0.015, z1], [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], { two: true });
      }
    };
    M.fenceRun = (c) => {                                             // a post and rail fence along local +x, hugging the ground
      const { m, o, low } = c, len = o.len || 40, step = low ? 8 : 5, n = Math.max(1, Math.round(len / step)), wood = [0.50, 0.38, 0.26];
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const x = len * i / n, y = gh(c, x, 0);
        m.box(x, y + 0.55, 0, 0.13, 1.1, 0.13, wood);
        if (prev) for (const ry of low ? [0.8] : [0.55, 0.98]) { const dx = x - prev.x, dy = y - prev.y, l = Math.hypot(dx, dy); m.box((x + prev.x) / 2, (y + prev.y) / 2 + ry, 0, l, 0.08, 0.05, [0.62, 0.5, 0.36], { rz: Math.atan2(dy, dx) }); }
        prev = { x, y };
      }
    };
    M.closedBarrier = (c) => {                                        // red / white bars across a closed road
      const { m, o, low } = c, w = o.w || 4.4, k = low ? 4 : 8, red = [0.82, 0.14, 0.1], white = [0.94, 0.94, 0.92];
      for (const sx of [-1, 1]) m.box(sx * (w / 2 + 0.1), 0.65, 0, 0.14, 1.3, 0.14, white);
      for (const y of [0.62, 1.04]) for (let i = 0; i < k; i++) m.box(-w / 2 + (i + 0.5) * w / k, y, 0, w / k, 0.2, 0.05, (i + (y > 0.8 ? 1 : 0)) % 2 ? white : red);
    };
    M.logStack = (c) => {                                             // a pile of logs, length along local x (len), the stack is 3 to 4 layers high
      const { m, o, low } = c, len = o.len || 8, rows = [6, 5, 4, 3], rr = 0.34, seg = low ? 5 : 6;
      let k = 0;
      rows.forEach((n, j) => { for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * rr * 2.05, y = rr + j * rr * 1.8, t = 0.82 + ((k * 37) % 11) / 11 * 0.3; k++;
        m.cyl([x, y, -len / 2], [x, y, len / 2], rr, rr, seg, [0.50 * t, 0.36 * t, 0.22 * t]);
      } });
      m.box(0, 0.12, 0, 4.4, 0.24, len - 0.4, [0.3, 0.22, 0.15]);
    };
    M.poleRun = (c) => {                                              // a power line: poles and three sagging wires between them (world points in o.pts)
      const { m, o, low } = c, P = o.pts, H = 8.3, seg = low ? 5 : 6, wood = [0.46, 0.35, 0.25], dark = [0.3, 0.22, 0.16], wire = [0.1, 0.1, 0.12];
      const L = (p) => [p.x - o.x, terrain.heightAt(p.x, p.z) - o.y, p.z - o.z];
      P.forEach((p, i) => {
        const q = L(p), n = P[Math.min(P.length - 1, i + 1)], pr = P[Math.max(0, i - 1)], yaw = Math.atan2(n.x - pr.x, n.z - pr.z);
        m.cyl([q[0], q[1], q[2]], [q[0], q[1] + H + 0.6, q[2]], 0.17, 0.11, seg, wood);
        m.at(q[0], q[1], q[2], yaw, () => m.box(0, H, 0, 1.9, 0.12, 0.12, dark));
        if (i) {
          const a = L(pr), l = Math.hypot(q[0] - a[0], q[2] - a[2]) || 1, px = (q[2] - a[2]) / l, pz = -(q[0] - a[0]) / l, k = low ? 3 : 4;
          for (const off of low ? [-0.8, 0.8] : [-0.8, 0, 0.8]) {
            let prev = null;
            for (let j = 0; j <= k; j++) { const t = j / k, pt = [a[0] + (q[0] - a[0]) * t + px * off, a[1] + (q[1] - a[1]) * t + H + 0.15 - 0.8 * Math.sin(t * Math.PI), a[2] + (q[2] - a[2]) * t + pz * off]; if (prev) m.cyl(prev, pt, 0.04, 0.04, 3, wire, { open: true }); prev = pt; }
          }
        }
      });
    };
    M.sawChimney = (c) => {                                           // tall brick chimney with smoke
      const { m, o, low } = c, H = o.h || 26, seg = low ? 6 : 10, brick = [0.58, 0.30, 0.22];
      m.cyl([0, -0.5, 0], [0, H, 0], 1.5, 0.95, seg, brick);
      if (!low) for (const y of [H * 0.35, H * 0.7, H - 0.6]) m.cyl([0, y, 0], [0, y + 0.35, 0], 1.5 - y / H * 0.55 + 0.1, 1.5 - y / H * 0.55 + 0.1, seg, [0.4, 0.2, 0.15]);
      m.cyl([0, H, 0], [0, H + 0.4, 0], 1.12, 1.12, seg, [0.22, 0.22, 0.24]); m.box(0, 0.4, 0, 4.6, 0.8, 4.6, [0.55, 0.53, 0.5]);
      c.smoke.push([0, H + 0.6, 0]);
    };
  }
  // the places, in road coordinates: s along the road, lat across it (+ right, - left, from the road centre line)
  function worldPlan() {
    worldData = null; const K = ST.id === 'kettle'; if (!K && ST.id !== 'redmesa') return;
    const WR = mulberry32(ST.seed * 211 + 5), D = { clusters: [], km: [], cattle: [], pl: [], solids: [], smoke: [] };
    const outV = (p, side) => side > 0 ? [-Math.cos(p.th), Math.sin(p.th)] : [Math.cos(p.th), -Math.sin(p.th)];       // unit vector pointing away from the road
    const at = (s, lat) => { const p = sampleV(s), [x, z] = sideXZ(p, lat); return { x, z, p }; };
    const footY = (x, z, rot, f) => {                                                        // ground under a footprint: level for the floor, and how bumpy it is
      const c = Math.cos(rot), sn = Math.sin(rot), w = (f && f.w || 2 * (f && f.r || 2)) / 2, d = (f && f.d || 2 * (f && f.r || 2)) / 2; let lo = 1e9, hi = -1e9, sum = 0, n = 0;
      for (const [a, b] of [[0, 0], [-w, -d], [w, -d], [w, d], [-w, d], [0, -d], [0, d]]) { const h = terrain.heightAt(x + a * c + b * sn, z - a * sn + b * c); lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++; }
      return { y: (lo + hi) / 2 + (hi - lo > 1.2 ? 0.15 : 0), spread: hi - lo };
    };
    const cl = (name) => { const c = { name, items: [], smoke: false }; D.clusters.push(c); return c; };
    const solid = (it, f) => {
      if (!f) return; const c = Math.cos(it.rot), sn = Math.sin(it.rot);
      if (f.r) { D.solids.push({ x: it.x + 0, z: it.z, r: f.r, mu: 0.3 }); return; }
      const at2 = (lx, lz) => [it.x + lx * c + lz * sn, it.z - lx * sn + lz * c], dz = f.dz || 0, cs = [at2(-f.w / 2, dz + f.d / 2), at2(f.w / 2, dz + f.d / 2), at2(f.w / 2, dz - f.d / 2), at2(-f.w / 2, dz - f.d / 2)];
      for (let k = 0; k < 4; k++) D.solids.push({ ax: cs[k][0], az: cs[k][1], bx: cs[(k + 1) % 4][0], bz: cs[(k + 1) % 4][1], r: 0.3, mu: 0.3, h: 99 });
    };
    // put(cluster, kind, s, lat, opts): faces the road; opts.turn adds a yaw, opts.along = face along the road instead, opts.solid false = no collision
    const put = (c, kind, s, lat, o = {}) => {
      const a = at(s, lat), side = lat > 0 ? 1 : -1, f = o.foot || WORLD_FOOT[kind], rot = (o.rot != null ? o.rot : a.p.th + side * Math.PI / 2) + (o.turn || 0);
      const it = Object.assign({ kind, x: a.x, z: a.z, rot }, o); delete it.turn; delete it.solid; delete it.foot;
      const fy = footY(a.x, a.z, rot, f || { r: 2 }); it.y = fy.y; if (fy.spread > 2.6) it.bumpy = fy.spread;
      c.items.push(it); if (o.solid !== false && f) solid(it, f);
      D.block = D.block || []; D.block.push({ x: a.x, z: a.z, r: Math.max(6, f ? (f.r || Math.hypot(f.w, f.d) / 2 + 3) : 5) });
      return it;
    };
    const lane = (c, s, side, len, w, col) => {                                          // a lane that leaves the road at a right angle
      const a = at(s, side * (half + 0.5)), o = outV(a.p, side);
      const it = { kind: 'laneStrip', x: a.x, z: a.z, rot: Math.atan2(o[0], o[1]), len, w, col, r: 1 }; it.y = terrain.heightAt(a.x, a.z); c.items.push(it);
      for (let d = 0; d < len; d += 8) D.block.push({ x: a.x + o[0] * d, z: a.z + o[1] * d, r: 5 });
    };
    const fence = (c, s, side, from, to) => {                                            // a fence that runs away from the road (field boundary)
      const a = at(s, side * (half + from)), o = outV(a.p, side);
      c.items.push({ kind: 'fenceRun', x: a.x, z: a.z, rot: Math.atan2(-o[1], o[0]), len: to - from, y: terrain.heightAt(a.x, a.z), r: 1 });
    };
    D.block = [];
    const face = (s, side) => sampleV(s).th + side * Math.PI / 2;
    const COL = { red: [0.80, 0.12, 0.10], blue: [0.14, 0.32, 0.72], yellow: [0.93, 0.74, 0.12], green: [0.14, 0.55, 0.28], orange: [0.93, 0.45, 0.1], teal: [0.1, 0.55, 0.6] };
    if (K) {
    for (let s = -84; s <= 70; s += 14) for (const side of [-1, 1]) { const a = at(s, side * 22); D.block.push({ x: a.x, z: a.z, r: 15 }); }       // the green stays free of trees (the street houses that stood here are gone)

    // 1. Birkwen village green and the service park
    const vg = cl('birkwen');
    put(vg, 'church', 66, 44);
    put(vg, 'inn', -24, 17, { name: ['THE OLD FORGE'] });
    put(vg, 'shop', -54, -16.6, { name: ['BIRKWEN STORES'] });
    put(vg, 'marketCross', -6, 15.5);
    put(vg, 'busShelter', -46, 14.2);
    put(vg, 'mailboxes', -36, 7.4, { solid: false }); put(vg, 'mailboxes', -62, -7.6, { solid: false });
    const sp = vg;
    [[-30, 'red'], [-16, 'blue'], [-2, 'yellow'], [12, 'green']].forEach(([s, col], i) => {
      put(sp, 'teamVan', s, -31, { color: COL[col], body: true, turn: (WR() - 0.5) * 0.12 });
      put(sp, 'trailer', s + (i % 2 ? 2 : -1), -46, { color: COL[col], turn: (WR() - 0.5) * 0.1 });
    });
    put(sp, 'timingHut', 36, -31);
    put(sp, 'teamVan', 46, -42, { body: true, color: COL.orange, turn: 0.5 }); put(sp, 'teamVan', 52, -48, { body: true, color: COL.teal, turn: -0.4 });

    // 2. farmland, s 140 to 470
    const fm = cl('farm');
    put(fm, 'farmhouse', 262, -29.5, { col: [0.93, 0.9, 0.8] });
    put(fm, 'barn', 296, -38);
    put(fm, 'silo', 274, -47, { twin: true, solid: false });
    D.solids.push({ x: at(274, -47).x, z: at(274, -47).z, r: 2.5, mu: 0.3 });
    put(fm, 'hayRolls', 248, -32, { solid: false }); put(fm, 'hayRolls', 320, -36, { solid: false });
    lane(fm, 279, -1, 26, 3.4); put(fm, 'gate', 279, -(half + 8), { solid: false, w: 3.6, rot: face(279, -1) });
    fence(fm, 226, -1, 8.6, 62); fence(fm, 342, -1, 8.6, 66); fence(fm, 236, 1, 8.6, 54); fence(fm, 336, 1, 8.6, 54);
    const cowRow = (s0, s1, side, n, l0, l1) => { for (let i = 0; i < n; i++) { const a = at(s0 + (s1 - s0) * WR(), side * (l0 + (l1 - l0) * WR())); fm.items.push({ kind: 'cow', x: a.x, z: a.z, rot: WR() * 6.28, y: terrain.heightAt(a.x, a.z), r: 1 }); D.block.push({ x: a.x, z: a.z, r: 3 }); } };
    cowRow(238, 328, 1, 4, 14, 50); cowRow(340, 418, -1, 4, 16, 56); cowRow(250, 300, -1, 2, 20, 28);
    const pts = [];
    for (let s = 130; s <= 530; s += 57) { const a = at(s, 66 + Math.sin(s / 90) * 4); pts.push({ x: a.x, z: a.z }); D.block.push({ x: a.x, z: a.z, r: 3 }); }
    fm.items.push({ kind: 'poleRun', x: pts[0].x, z: pts[0].z, rot: 0, y: terrain.heightAt(pts[0].x, pts[0].z), pts, r: 1 });

    // 3. Sawmill Gap timber yard, beside the finish
    const fin = track.finishS, ty = cl('timber');
    put(ty, 'barn', fin + 94, 47, { col: [0.50, 0.40, 0.30], roof: [0.34, 0.36, 0.4], turn: 0 });
    put(ty, 'farmhouse', fin + 56, 43, { col: [0.86, 0.84, 0.76], roof: [0.4, 0.3, 0.26] });
    put(ty, 'sawChimney', fin + 112, 49, { h: 28 });
    [[24, 36], [38, 36], [52, 36], [62, 57], [78, 59], [34, 54]].forEach(([ds, lat]) => put(ty, 'logStack', fin + ds, lat, { len: 8 + WR() * 3, turn: Math.PI / 2 + (WR() - 0.5) * 0.1 }));
    put(ty, 'barn', fin + 66, 60, { col: [0.42, 0.34, 0.26], roof: [0.30, 0.33, 0.38], turn: 0.12 });         // drying shed behind the stacks
    [[88, 36], [102, 36], [96, 62]].forEach(([ds, lat]) => put(ty, 'logStack', fin + ds, lat, { len: 8 + WR() * 3, turn: Math.PI / 2 + (WR() - 0.5) * 0.1 }));
    put(ty, 'hayRolls', fin + 118, 34, { solid: false });
    put(ty, 'teamVan', fin + 40, 33.5, { color: COL.green, turn: -0.15 }); put(ty, 'trailer', fin + 46, 33.5, { color: COL.green, turn: 0.1 });

    }
    // 4. side roads (closed), signposts, km posts
    const roadOK = (s) => K ? !track.turns.some(t => s > t.s0 - 45 && s < t.s1 + 45) && !ST.checkpoints.concat([16, track.finishS]).some(g => Math.abs(g - s) < 40) && !ST.jumps.some(j => Math.abs(j[0] - s) < 60) : !track.turns.some(t => s > t.s0 - 22 && s < t.s1 + 22) && !ST.checkpoints.concat([16, track.finishS]).some(g => Math.abs(g - s) < 30) && !ST.jumps.some(j => Math.abs(j[0] - s) < 30);
    const sideRoad = (name, s, side, col, boards) => {
      if (!roadOK(s)) { D.warn = (D.warn || []).concat(name + ' blocked'); return; }
      const c = cl(name); lane(c, s, side, 46, 3.6, col);
      put(c, 'closedBarrier', s, side * (half + 11), { w: 4.6, solid: false });
      put(c, 'signpost', s - 9, side * (half + 5.2), { boards: [{ lines: ['ROAD', 'CLOSED'], shape: 'entry' }], solid: false, rot: face(s - 9, side) + 0.3 * side });
      put(c, 'signpost', s - 20, side * (half + 4.8), { boards, solid: false, rot: sampleV(s - 20).th + Math.PI });
    };
    if (K) {
    sideRoad('side-a', 850, 1, [0.55, 0.50, 0.42], [{ lines: ['GREYWATER DAM 47'], dir: 1 }, { lines: ['HARL MILL 96'], dir: 1 }]);
    sideRoad('side-b', 1765, -1, [0.62, 0.55, 0.4], [{ lines: ['SKARNFELL 38'], dir: -1 }, { lines: ['PORT SALLOW 71'], dir: -1 }]);
    const tc = cl('tsign'), ts = at(-189, 6.2);
    put(tc, 'signpost', -189, 6.4, { boards: [{ lines: ['SKARNFELL 38'], dir: -1 }, { lines: ['PORT SALLOW 71', 'SALTREACH 98'], dir: 1 }], solid: false, rot: sampleV(-189).th });
    void ts;
    } else {
      // ---- SS5 Red Mesa Run (docs/region.md): Cinder Wells at the start, a cattle ranch, old workings, windmill pumps, side roads, the Red Mesa mine at the finish ----
      // Left of the run-in the ground is open to s -70, right of it to s 0; from there the canyon walls (mesas) stand 25 m out. Flat open ground: s 300 to 600, 900 to 1200, 1660 on.
      const RUST = [0.55, 0.30, 0.18], RUST2 = [0.46, 0.34, 0.26], fin = track.finishS, sgn = (x) => x > 0 ? 1 : -1;
      const along = (s, lat) => { const a = at(s, lat); return a.p.th + sgn(lat) * Math.PI / 2; };
      const circle = (it, r) => D.solids.push({ x: it.x, z: it.z, r, mu: 0.3 });
      // a long thing (conveyor) whose local x runs along the item: a footprint of its own, turned a quarter
      const longSolid = (it, w, len, x0) => solid({ x: it.x, z: it.z, rot: it.rot + Math.PI / 2 }, { w, d: len, dz: x0 + len / 2 });
      const cows = (c, s0, s1, side, n, l0, l1) => { for (let i = 0; i < n; i++) { const a = at(s0 + (s1 - s0) * WR(), side * (l0 + (l1 - l0) * WR())); c.items.push({ kind: 'cow', x: a.x, z: a.z, rot: WR() * 6.28, y: terrain.heightAt(a.x, a.z), r: 1 }); D.block.push({ x: a.x, z: a.z, r: 3 }); } };
      const poles = (c, s0, s1, step, lat, wob) => { const pts = []; for (let s = s0; s <= s1; s += step) { const a = at(s, lat + Math.sin(s / 90) * wob); pts.push({ x: a.x, z: a.z }); D.block.push({ x: a.x, z: a.z, r: 3 }); } c.items.push({ kind: 'poleRun', x: pts[0].x, z: pts[0].z, rot: 0, y: terrain.heightAt(pts[0].x, pts[0].z), pts, r: 1 }); };
      // 1. Cinder Wells: store and gas station on the left of the run-in, water tower and windmill pumps, the service park on the right
      const cw = cl('cinder');
      put(cw, 'gasStation', -104, -28); put(cw, 'tradingPost', -84, -23, { name: ['WELLS STORE'] });
      put(cw, 'waterTower', -118, 32, { col: [0.50, 0.30, 0.2] }); put(cw, 'windpump', -128, -36); put(cw, 'windpump', -134, 40);
      put(cw, 'busShelter', -78, 14.5); put(cw, 'mailboxes', -90, 7.4, { solid: false });
      [[-66, 'red'], [-52, 'blue'], [-38, 'yellow'], [-24, 'green']].forEach(([s, col], i) => {
        put(cw, 'teamVan', s, 26, { color: COL[col], body: true, turn: (WR() - 0.5) * 0.12 });
        put(cw, 'trailer', s + (i % 2 ? 2 : -1), 41, { color: COL[col], turn: (WR() - 0.5) * 0.1 });
      });
      put(cw, 'timingHut', -80, 30); put(cw, 'teamVan', -46, 56, { body: true, color: COL.orange, turn: 0.5 }); put(cw, 'teamVan', -40, 62, { body: true, color: COL.teal, turn: -0.4 });
      // 2. cattle ranch, s 300 to 450 on the right of the first sweeper
      const rn = cl('ranch');
      put(rn, 'farmhouse', 352, 42, { col: [0.90, 0.80, 0.62], roof: [0.55, 0.28, 0.2] });
      put(rn, 'barn', 392, 52, { col: [0.55, 0.26, 0.2], roof: [0.38, 0.36, 0.36] });
      put(rn, 'silo', 372, 58, { twin: true, solid: false }); { const a = at(372, 58); D.solids.push({ x: a.x, z: a.z, r: 2.5, mu: 0.3 }); }
      put(rn, 'windpump', 332, 38); put(rn, 'hayRolls', 316, 32, { solid: false }); put(rn, 'hayRolls', 420, 36, { solid: false });
      lane(rn, 352, 1, 26, 3.4, [0.56, 0.42, 0.30]); put(rn, 'gate', 352, half + 8, { solid: false, w: 3.6, rot: along(352, 1) });
      fence(rn, 312, 1, 8.6, 60); fence(rn, 432, 1, 8.6, 64); fence(rn, 322, -1, 8.6, 50);
      cows(rn, 322, 430, 1, 8, 14, 52); cows(rn, 455, 540, -1, 5, 16, 55);
      poles(rn, 296, 620, 58, 68, 4);
      // 3. old workings beside the tarmac mining road (s 940 to 1160): rusting conveyor, two abandoned vans, boxcars, pumps. The dry river bed is the ground itself (884)
      const ow = cl('workings');
      { const it = put(ow, 'conveyor', 1010, -36, { len: 34, rise: 8, solid: false }); longSolid(it, 3.4, 34 + 10, -3); }
      put(ow, 'teamVan', 1056, -34, { body: true, color: RUST, turn: 0.9 }); put(ow, 'trailer', 1062, -45, { color: RUST2, turn: -0.3 }); put(ow, 'teamVan', 1074, -50, { body: true, color: RUST2, turn: 0.2 });
      { const it = put(ow, 'boxcars', 1112, -62, { count: 2, solid: false, rot: sampleV(1112).th, foot: { w: 3.2, d: 27 } }); solid(it, { w: 3.2, d: 27 }); }
      put(ow, 'windpump', 912, 34); put(ow, 'windpump', 1150, -42); put(ow, 'windpump', 968, 46);
      // 4. open country after the crest: pumps, a second herd, three closed side roads and their signposts
      const rg = cl('range');
      put(rg, 'windpump', 1830, -40); put(rg, 'windpump', 2250, 45); put(rg, 'windpump', 2540, -50);
      fence(rg, 2062, -1, 8.6, 70); fence(rg, 2160, -1, 8.6, 70); cows(rg, 2066, 2156, -1, 5, 18, 62);
      sideRoad('side-a', 1095, 1, [0.58, 0.46, 0.34], [{ lines: ['EMBER FORK 15'], dir: 1 }, { lines: ['PORT SALLOW 82'], dir: 1 }]);
      sideRoad('side-b', 1761, -1, [0.60, 0.48, 0.36], [{ lines: ['SALTREACH 120'], dir: -1 }, { lines: ['EMBER FORK 15'], dir: -1 }]);
      sideRoad('side-c', 1930, 1, [0.56, 0.44, 0.32], [{ lines: ['RED MESA 8'], dir: 1 }, { lines: ['PORT SALLOW 82'], dir: 1 }]);
      const tc = cl('tsign'); put(tc, 'signpost', -143, 6.4, { boards: [{ lines: ['EMBER FORK 15'], dir: -1 }, { lines: ['PORT SALLOW 82', 'SALTREACH 120'], dir: 1 }], solid: false, rot: sampleV(-143).th });
      // 5. Red Mesa mine head, beside the finish: head frame, mine office, sheds, conveyor into the ore bins, water tower, a rail spur with boxcars, power line
      const mn = cl('mine');
      put(mn, 'farmhouse', fin + 24, 38, { col: [0.82, 0.68, 0.48], roof: [0.4, 0.3, 0.26] });
      put(mn, 'headframe', fin + 70, 48);
      { const it = put(mn, 'conveyor', fin + 108, 40, { len: 34, rise: 9, rot: along(fin + 108, -1), solid: false }); longSolid(it, 3.4, 34 + 10, -3); }
      put(mn, 'barn', fin + 34, 62, { col: [0.50, 0.28, 0.2], roof: [0.34, 0.34, 0.36], turn: 0.1 }); put(mn, 'barn', fin + 150, 54, { col: [0.45, 0.36, 0.28], roof: [0.3, 0.32, 0.36], turn: -0.1 });
      put(mn, 'waterTower', fin + 160, -40, { col: [0.52, 0.32, 0.2] }); put(mn, 'teamVan', fin + 30, -30, { body: true, color: RUST, turn: -0.5 });
      const sa = at(fin + 12, -58), sb = at(fin + 175, -58);
      mn.rail = [sa, sb];
      { const it = put(mn, 'boxcars', fin + 80, -58, { count: 3, solid: false, rot: sampleV(fin + 80).th, foot: { w: 3.2, d: 39 } }); solid(it, { w: 3.2, d: 39 }); mn.cars = it; }
      poles(mn, fin - 240, fin + 150, 57, 76, 3);
    }
    const gatesS = [16].concat(ST.checkpoints, [track.finishS]);
    for (let s = 100; s < track.finishS - 20; s += 100) {
      if (gatesS.some(g => Math.abs(g - s) < 14) || ST.jumps.some(j => Math.abs(j[0] - s) < 30)) continue;
      const t = track.turns.find(u => s > u.s0 - 10 && s < u.s1 + 10), side = t ? (t.dir === 'R' ? 1 : -1) : 1;           // inside of corners: the chevrons stay on the outside
      const a = at(s, side * (half + 1.7)); D.km.push({ x: a.x, z: a.z, yaw: a.p.th + Math.PI - side * 0.6, n: Math.round(s / 100) });
    }
    worldData = D;
    for (const b of D.block) ctxHouses.push({ x: b.x, z: b.z, r: b.r });
    // the soft ground the service park and the yard stand on is flat, so trees stay off it too
    for (const c of D.clusters) c.mid = c.items.length ? { x: c.items.reduce((a, b) => a + b.x, 0) / c.items.length, z: c.items.reduce((a, b) => a + b.z, 0) / c.items.length } : null;
  }
  function worldBuild() {
    const D = worldData; if (!D) return;
    worldModels();
    for (const c of D.clusters) {
      if (!c.items.length) continue;
      if (c.rail) {                                                           // the spur: the cars stand on the rails (their height follows the embankment)
        const [a, b] = c.rail, rw = settle.railway([{ x: a.x, z: a.z }, { x: b.x, z: b.z }], { height: 0.9, grass: [0.74, 0.60, 0.42] });
        const t = Math.hypot(c.cars.x - a.x, c.cars.z - a.z) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
        c.cars.y = rw.a[1] + (rw.b[1] - rw.a[1]) * t + 0.22; c.railTris = rw.tris;
      }
      const r = settle.cluster(c.items, { smoke: false });
      r.mesh.castShadow = r.mesh.castShadow && (c.name === 'birkwen' || c.name === 'cinder');           // only the village throws shadows: the car is near it at the start (the shadow map covers 45 m round the car)
      c.tris = r.tris;
      if (r.smoke.length && quality !== 'low') { const sm = settle.smoke(r.smoke); sm.frustumCulled = true; }
    }
    if (D.km.length) settle.kmPosts(D.km);
  }
  function worldSolids() { if (worldData) for (const o of worldData.solids) obstacles.push(o); }       // after eventDetail, so the event props keep their places
