  /* ---------- event detail (tracks): where the rally-event props stand ----------
     Uses art's builders from art/details.js. Where and how many is decided here; how things look is art's.
     Own generator (ST.seed * 131 + 7): the stage's rng is never touched, so the older scenery stays where it was.
     Rules (forgiving): nothing within 5 m of the road edge; nothing solid except hay rows that are 8 m or more from the edge (none
     are placed that close in at the moment: hay stands 3.2 m from the edge and is visual only); tents, cars, loos and towers 10 m or
     more from the edge; only on the outside of corners; nothing on a drop side (ground lower than the road beside it), steep ground,
     near trees / walls / houses (obstacles), near people already placed, or in a gate zone. */
  function eventDetail() {
    const r2 = mulberry32(ST.seed * 131 + 7), night = !!ST.look.night;
    const L = { tents: [], flags: [], marshals: [], photos: [], loos: [], cars: [], signs: [], towers: [], hay: [] }, used = [];
    const gateS = [16].concat(ST.checkpoints, [track.finishS]);
    const FLAGS = [0xd32f2f, 0x1565c0, 0xffd600, 0x2e7d32, 0xef6c00, 0x111111];
    const turnAt = s => track.turns.find(t => s > t.s0 - 28 && s < t.s1 + 12);
    const outsideOf = t => t.dir === 'R' ? -1 : 1;
    const dSeg = (o, x, z) => { if (o.ax === undefined) return Math.hypot(o.x - x, o.z - z) - (o.r || 0); const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - o.ax) * dx + (z - o.az) * dz) / l2, 0, 1); return Math.hypot(o.ax + dx * t - x, o.az + dz * t - z) - (o.r || 0); };
    const lateralOK = (p, side, offFar) => {                                    // the ground from the road edge out to the prop: no drop, no steep bank
      for (const o of [half + 2, half + 5, (half + offFar) / 2 + 2, offFar]) { const [x, z] = sideXZ(p, side * o), dy = terrain.heightAt(x, z) - p.y; if (dy < -1.6 || dy > 3.2) return false; }
      return true;
    };
    // can a prop of radius R stand at lateral distance off (from the road centre) beside road point p?
    function ok(p, side, off, R, minEdge, anyTurnSide) {
      const [x, z] = sideXZ(p, side * off), y0 = terrain.heightAt(x, z);
      if (terrain.distAt(x, z) < half + minEdge) return null;
      if (!lateralOK(p, side, off)) return null;
      for (let k = 0; k < 4; k++) { const a = k * 1.571 + 0.4, h = terrain.heightAt(x + Math.cos(a) * R * 0.8, z + Math.sin(a) * R * 0.8); if (Math.abs(h - y0) > 0.9) return null; }
      for (const o of obstacles) if (dSeg(o, x, z) < R + 0.6) return null;
      for (let d = half + 1.5; d < off - R; d += 1.2) { const [wx, wz] = sideXZ(p, side * d); for (const o of obstacles) if (o.h >= 1.5 && o.ax !== undefined && dSeg(o, wx, wz) < 0.8) return null; }       // nothing between the road and the prop (a wall or fence in front hides it)
      for (const q of used) if (Math.hypot(q.x - x, q.z - z) < R + q.r) return null;
      for (const q of crowdList) if (Math.abs(q.x - x) < R + 1.2 && Math.abs(q.z - z) < R + 1.2 && Math.hypot(q.x - x, q.z - z) < R + 1.0) return null;
      if (!anyTurnSide) { const t = turnAt(p.s); if (t && side !== outsideOf(t)) return null; }       // inside of a corner stays clear
      return { x, z, y: y0 };
    }
    // try s0, then nearby s (and a little further back) until a spot fits; marks the spot as used
    function find(s0, side, off, R, minEdge, opt = {}) {
      for (const ds of opt.ds || [0, 4, -4, 8, -8, 12, -12, 18, -18, 26, -26]) for (const eo of opt.eo || [0, 2, 4]) {
        const s = s0 + ds; if (s < 8 || s > track.finishS + 40 || s > track.length - 6) continue;
        if (!opt.gate && gateS.some(g => Math.abs(g - s) < 22)) continue;                           // gate zones stay clear
        const p = sampleAt(s), o = ok(p, side, off + eo, R, minEdge, opt.any); if (!o) continue;
        used.push({ x: o.x, z: o.z, r: R }); return Object.assign(o, { p, s, side, th: p.th });
      }
      return null;
    }
    const faceRoad = (o) => o.th + (o.side > 0 ? Math.PI / 2 : -Math.PI / 2) + (r2() - 0.5) * 0.1;

    // ---- start and finish areas ----
    function area(s0, tentSide, otherSide, dir, o) {
      const T = (ds, off, w, color) => { const f = find(s0 + ds * dir, tentSide, half + off, w > 3 ? 2.9 : 2.4, 9.5, { gate: true, ds: [0, 3, -3, 6, -6, 10], eo: [0, 1.5, 3] }); if (f) L.tents.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f), w, color, s: 1 }); };
      T(o.t0, 13.5, 4.5, 0xd32f2f); T(o.t0 + 8, 13.5, 3, 0x1565c0); T(o.t0 + 15, 13.5, 3, 0xffd600);
      for (const [ds, off, side] of o.flags) { const f = find(s0 + ds * dir, side, half + off, 0.5, 4.5, { gate: true, ds: [0, 2, -2, 4, -4], eo: [0, 1] }); if (f) L.flags.push({ x: f.x, z: f.z, y: f.y, yaw: (r2() - 0.5) * 1.2, color: FLAGS[L.flags.length % FLAGS.length] }); }
      if (o.tower) { const f = find(s0 + o.tower[0] * dir, o.tower[2], half + o.tower[1], 2.2, 10.5, { gate: true, ds: [0, 6, -6, 12, -12, 20], eo: [0, 3, 6] }); if (f) L.towers.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f) }); }
      o.loos.forEach((ds, i) => { const f = find(s0 + ds * dir, o.loosSide, half + 17.5 + (i & 1) * 0.5, 0.9, 10.5, { gate: true, ds: [0, 3, -3, 6, -6], eo: [0, 2, 4] }); if (f) L.loos.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f), color: i % 3 === 2 ? 0xe8e8e0 : 0x8fc6f2 }); });
      o.cars.forEach(([ds, off, side], i) => { const f = find(s0 + ds * dir, side, half + off, 2.4, 10.5, { gate: true, ds: [0, 5, -5, 10, -10], eo: [0, 3, 6] }); if (f) L.cars.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f) + (i % 3 === 1 ? Math.PI : 0) + (r2() - 0.5) * 0.35, kind: ['hatch', 'estate', 'pickup'][i % 3] }); });
      o.signs.forEach(([ds, off, side, kind, para]) => { const f = find(s0 + ds * dir, side, half + off, 0.5, 4.8, { gate: true, ds: [0, 3, -3, 6, -6], eo: [0, 1] }); if (f) L.signs.push({ x: f.x, z: f.z, y: f.y, yaw: para ? f.th + (dir > 0 ? Math.PI : 0) : faceRoad(f), kind }); });
      o.marshals.forEach(([ds, side, flag]) => { const f = find(s0 + ds * dir, side, half + 5.2, 1.6, 4.8, { gate: true, ds: [0, 3, -3, 6, -6], eo: [0, 1] }); if (f) L.marshals.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f) + (side > 0 ? 0 : Math.PI) * 0, flag }); });
    }
    // start (the cars wait at s = 6, the gate is at s = 16, the start crowds are at s 22 to 52): tents left, parking right behind the crowd
    area(0, -1, 1, 1, {
      t0: 6,
      flags: [[10, 8, -1], [18, 8, -1], [26, 8, -1], [34, 8, -1], [12, 8.5, 1], [19, 8.5, 1]],
      tower: [58, 14, 1], loos: [34, 42, 50], loosSide: -1,
      cars: [[18, 14, 1], [28, 14.5, 1], [38, 15, 1], [48, 14, 1], [24, 21, 1], [36, 21.5, 1], [58, 18, -1]],
      signs: [[6, 6.5, 1, 'parking', true], [14, 6.5, 1, 'spectator', true], [2, 6.5, -1, 'service', false], [40, 6, -1, 'wc', false]],
      marshals: [[8, 1, false], [14, -1, false]],
    });
    // finish: tents right (after the line), parking left behind the finish crowd, tower on the line side
    const F = track.finishS;
    area(F, 1, -1, 1, {
      t0: 24,
      flags: [[-14, 8, 1], [-6, 8, 1], [4, 8, 1], [-12, 9, -1], [-4, 9, -1], [8, 9, -1]],
      tower: [-46, 14, 1], loos: [44, 50, 56], loosSide: 1,
      cars: [[18, 14, -1], [28, 14.5, -1], [38, 15, -1], [-8, 20, -1], [6, 20.5, -1], [20, 21, -1], [48, 15, -1]],
      signs: [[-70, 6.5, 1, 'parking', true], [-30, 6.5, 1, 'spectator', true], [-52, 6.5, -1, 'service', false], [30, 6, 1, 'wc', false]],
      marshals: [[-8, 1, false], [-18, -1, false], [10, -1, false]],
    });

    // ---- along the stage ----
    // marshal posts every ~450 to 550 m
    const first = 200 + r2() * 60, step = Math.round((F - 380) / Math.round((F - 380) / 500));
    for (let s = first + 60; s < F - 160; s += step) {
      if (gateS.some(g => Math.abs(g - s) < 30)) { s += 40; }
      const tr = turnAt(s), pref = tr ? [outsideOf(tr)] : [1, -1];
      let f = null;
      for (const side of pref.concat(pref.length === 1 ? [] : []) ) { f = find(s, side, half + 5.5, 1.6, 4.8, { ds: [0, 15, -15, 30, -30, 45, -45, 60, -60], eo: [0, 1] }); if (f) break; }
      if (f && !gateS.some(g => Math.abs(g - f.s) < 24) && f.s > 140 && f.s < F - 140) {
        const tt = track.turns.find(t => t.s0 > f.s && t.s0 - f.s < 120);
        L.marshals.push({ x: f.x, z: f.z, y: f.y, yaw: faceRoad(f), flag: !!(tt && (tt.r <= 24 || tt.blind)) });
      }
    }
    // photographers: outside of hairpins and tight corners, and at jumps; well behind the tape (tape stands 4.2 m from the edge)
    const spec = track.turns.filter(t => t.r <= 40 && t.s0 > 100 && t.s1 < F - 60).sort((a, b) => a.r - b.r).slice(0, 3);
    for (const t of spec) {
      const side = outsideOf(t), mid = (t.s0 + t.s1) / 2;
      for (const ds of [12, -17]) { const f = find(mid + ds, side, half + 5.6, 0.7, 5, { any: false, ds: [0, 3, -3, 6, -6], eo: [0, 0.8, 1.6] }); if (f) { const q = sampleAt(mid); L.photos.push({ x: f.x, z: f.z, y: f.y, yaw: Math.atan2(q.x - f.x, q.z - f.z) + (r2() - 0.5) * 0.3 }); } }
    }
    for (const [js] of ST.jumps) for (const [ds, side] of [[-4, -1], [24, 1], [26, -1]]) {
      const f = find(js + ds, side, half + 6, 0.7, 5, { any: true, ds: [0, 3, -3, 6, -6, 10], eo: [0, 1] });
      if (f) { const q = sampleAt(js + 6); L.photos.push({ x: f.x, z: f.z, y: f.y, yaw: Math.atan2(q.x - f.x, q.z - f.z) }); }
    }

    // hay rows: outside of 2 or 3 fast corners that have no rails or chevrons (radius 88 to 150), visual only, 3.2 m from the edge
    const haySpecs = [];
    const fastTurns = track.turns.filter(t => t.r >= 48 && t.r <= 150 && !t.blind && !(t.r <= 60 && ST.theme === 'forest') && t.s0 > 200 && t.s1 < F - 80).sort((a, b) => a.r - b.r);
    const haySpread = [];
    for (const t of fastTurns) {
      if (haySpecs.length >= 3) break;
      if (haySpread.some(s => Math.abs(s - t.s0) < 400)) continue;
      const side = outsideOf(t), runs = []; let cur = [], good = 0, total = 0;
      for (let s = t.s0 - 6; s <= t.s1 + 6; s += 2) {
        total++;
        const p = sampleAt(s), [x, z] = sideXZ(p, side * (half + 3.2)), h = terrain.heightAt(x, z);
        const fine = h > p.y - 1.0 && h < p.y + 1.4 && terrain.distAt(x, z) > half + 0.9 && lateralOK(p, side, half + 3.2) && !obstacles.some(o => dSeg(o, x, z) < 1.0) && !gateS.some(g => Math.abs(g - s) < 16);
        if (fine) { cur.push({ x, z }); good++; } else { if (cur.length > 3) runs.push(cur); cur = []; }
      }
      if (cur.length > 3) runs.push(cur);
      if (good < 14 || good / total < 0.5) continue;
      let room = quality === 'low' ? 24 : 40;                                                     // points of 2 m: a row of at most 48 / 80 m per corner (phone budget)
      haySpecs.push(runs.sort((a, b) => b.length - a.length).map(r => { const k = Math.min(r.length, room); room -= k; return r.slice(0, k); }).filter(r => r.length > 3)); haySpread.push(t.s0);
    }
    for (const runs of haySpecs) for (const run of runs) for (const b of hayRow(run, { rows: quality === 'low' ? 1 : 2 })) L.hay.push(b);

    // extra small spectator groups: outside of a few medium corners and at the jump (their own tape is not drawn: the groups stand 6 to 7 m back)
    const small = track.turns.filter(t => t.r > 40 && t.r <= 100 && t.s0 > 150 && t.s1 < F - 100).slice(0, 4);
    const groups = [];
    for (const t of small) {
      const side = outsideOf(t), mid = (t.s0 + t.s1) / 2, f = find(mid, side, half + 7.2, 3.2, 5.5, { ds: [0, 6, -6, 12, -12], eo: [0, 1.5] });
      if (f) groups.push({ x: f.x, z: f.z, y: f.y, th: f.th, side, tag: 'corner', n: 9 });
    }
    for (const [js] of ST.jumps) for (const side of [1, -1]) { const f = find(js - 26, side, half + 7.2, 3.2, 5.5, { any: true, ds: [0, 6, -6, 12], eo: [0, 1.5] }); if (f) groups.push({ x: f.x, z: f.z, y: f.y, th: f.th, side, tag: 'jump', n: 9 }); }

    // ---- build ----
    if (L.tents.length) serviceTents(L.tents);
    if (L.flags.length) flagPoles(L.flags);
    if (L.marshals.length) marshalPosts(L.marshals);
    if (L.photos.length) photographers(L.photos);
    if (L.loos.length) portaLoos(L.loos);
    if (L.cars.length) parkedCars(L.cars);
    if (L.signs.length) signPosts(L.signs);
    if (L.towers.length) tvTowers(L.towers);
    if (L.hay.length) hayBales(L.hay);
    for (const g of groups) spectatorGroup(g, { tag: g.tag, n: g.n, width: 5 });
    if (night) {                                                            // lit tents and towers: warm glows (night.js)
      for (const t of L.tents) glowSpots.push({ x: t.x, y: t.y + 2.9, z: t.z, c: 0xffd9a0, size: 2.2 });
      for (const t of L.towers) glowSpots.push({ x: t.x, y: t.y + 7.8, z: t.z, c: 0xfff2d0, size: 2.4 });
      for (const m of L.marshals) glowSpots.push({ x: m.x, y: m.y + 2.4, z: m.z, c: 0xff9a40, size: 0.5 });
    }
    return L;
  }
