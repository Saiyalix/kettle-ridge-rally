/* =====================================================================
   CASTLE DATA (SS4 Thornwick Keep). Pure data and maths: no drawing, no THREE, no scene.
   Everything is derived from the stage's route, so the castle always sits where the road says.

   Local frame ("castle frame"): origin = the middle of gate 1 on the road, u = straight on (the way the road
   goes through the gate), v = to the right of the road (same side as the road's right). Metres.
   The curtain walls are a rectangle in this frame: u0 .. u1 and v0 .. v1 (wall centre lines).
     south wall  u = u0 = 0     gate 1 in it, at v = 0
     east wall   v = v1         gate 2 in it, at u = gate2.u
     north wall  u = u1         west wall  v = v0
   The road: in through gate 1, 40 m straight, one tight right-hander around the well (the well stands in the
   middle of that corner), then straight to gate 2.

   castleLayout(track, ST) returns (all x, z in world metres, all sizes in metres, y is NOT included:
   the castle stands on a flat plateau at ST.castle.level, use that or terrain.heightAt):
     origin     { x, z, th }      gate 1 (th = road heading there: forward = (sin th, cos th), right = (-cos th, sin th))
     level      plateau height of courtyard and walls
     rect       { u0, u1, v0, v1 } wall centre lines in the castle frame
     toWorld(u, v) -> [x, z]      toLocal(x, z) -> [u, v]
     wallThick, wallH, merlonH    curtain wall thickness / height / battlement height on top
     walls      [{ ax, az, bx, bz, thick, h, side }]            curtain wall pieces (gaps where the gatehouses are)
     towers     [{ x, z, r, h, kind }]                          kind: 'corner' | 'mid' | 'gate'
     gatehouses [{ x, z, th, s, depth, half, passageH, h, blockW, towerAt, which }]
                  x, z, th = middle of the passage on the road; depth along the road; half = clear half width of the
                  passage (4.4: the road is 4.0); passageH = clear height of the arch (7.0); h = height of the blocks and
                  the lintel; blockW = width of each block beside the passage; towerAt = lateral offset of the two gate towers
     buildings  [{ kind, x, z, yaw, w, d, h, style, roof, builder }]
                  yaw = rotation.y; the FRONT faces local +z (as in art/buildings.js); w along the front, d deep, h wall height.
                  builder 'house' = use buildings() (6..20 m wide), 'block' = castle blockout (keep, hall, stables ...)
     well       { x, z, r, h }
     moat       { d0, d1, level }   ring outside the walls: distance from the wall rectangle d0 .. d1, water surface at `level`
     court      { s0, s1 }          road s range inside the castle (gate 1 .. gate 2)
   castleObstacles(layout) -> collision list for `obstacles` (segments and circles); castleKeepOut(layout, x, z, margin)
   -> true when a point is inside the castle area (+ margin), for placing trees, rocks and ground decoration.
   ===================================================================== */
const segLen = g => (g[0] === 'S' ? g[1] : g[1] * D2R * g[2]);
// the road samples, built exactly like buildTrack does (same integration), so the castle frame matches the real road
function routeSamples(segments) {
  const step = 2; let x = 0, z = 0, th = 0, s = 0;
  const pts = [{ x, z, th, s }];
  for (const seg of segments) {
    if (seg[0] === 'S') {
      const n = Math.max(1, Math.round(seg[1] / step)), ds = seg[1] / n;
      for (let i = 0; i < n; i++) { x += Math.sin(th) * ds; z += Math.cos(th) * ds; s += ds; pts.push({ x, z, th, s }); }
    } else {
      const dir = seg[0] === 'R' ? -1 : 1, ang = seg[1] * D2R, r = seg[2], len = ang * r;
      const n = Math.max(2, Math.round(len / step)), ds = len / n, dth = dir * ang / n;
      for (let i = 0; i < n; i++) { th += dth * 0.5; x += Math.sin(th) * ds; z += Math.cos(th) * ds; th += dth * 0.5; s += ds; pts.push({ x, z, th, s }); }
    }
  }
  return pts;
}
function routeAtS(pts, s) {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
  return Math.abs(pts[lo].s - s) <= Math.abs(pts[hi].s - s) ? pts[lo] : pts[hi];
}
const castleToWorld = (F, u, v) => [F.x + u * F.sin - v * F.cos, F.z + u * F.cos + v * F.sin];
const castleToLocal = (F, x, z) => { const dx = x - F.x, dz = z - F.z; return [dx * F.sin + dz * F.cos, -dx * F.cos + dz * F.sin]; };
// the frame of a castle config C (memoised on C): gate 1 position and heading, wall rectangle
function castleFrame(C, segments) {
  if (C._f) return C._f;
  const pts = routeSamples(segments), g1 = routeAtS(pts, C.gate1), g2 = routeAtS(pts, C.gate2);
  const F = { x: g1.x, z: g1.z, th: g1.th, sin: Math.sin(g1.th), cos: Math.cos(g1.th) };
  const [u2, v2] = castleToLocal(F, g2.x, g2.z);
  F.rect = { u0: 0, u1: u2 + C.northPast, v0: -C.west, v1: v2 };
  F.g2 = { u: u2, v: v2, th: g2.th };
  return (C._f = F);
}
// distance outside the wall rectangle (0 inside) and depth inside it (0 outside), in the castle frame
const castleRectDist = (R, u, v) => Math.hypot(Math.max(R.u0 - u, 0, u - R.u1), Math.max(R.v0 - v, 0, v - R.v1));
const castleRectDepth = (R, u, v) => Math.max(0, Math.min(u - R.u0, R.u1 - u, v - R.v0, R.v1 - v));

const GATE = { depth: 12, half: 4.4, passageH: 7.0, h: 12.5, blockW: 7.6, towerAt: 12.4 };

function castleLayout(track, ST = CONFIG.stage) {
  const C = ST.castle, F = castleFrame(C, ST.segments), R = F.rect;
  const W = (u, v) => castleToWorld(F, u, v);
  const P = track.samples;
  const sampleS = s => routeAtS(P, s);
  const wallThick = 3, wallH = 9, merlonH = 1.3;
  const L = { origin: { x: F.x, z: F.z, th: F.th }, level: C.level, rect: R, wallThick, wallH, merlonH, toWorld: W, toLocal: (x, z) => castleToLocal(F, x, z) };
  // gatehouses
  const g2 = F.g2;
  L.gatehouses = [
    { which: 1, s: C.gate1, u: 0, v: 0, th: F.th },
    { which: 2, s: C.gate2, u: g2.u, v: g2.v, th: g2.th },
  ].map(g => { const [x, z] = W(g.u, g.v), p = sampleS(g.s); return Object.assign({ x, z, th: p.th, u: g.u, v: g.v }, GATE, { which: g.which, s: g.s, towerAt: GATE.towerAt }); });
  // curtain walls: south and east walls have a gap at the gate (from tower to tower)
  const T = GATE.towerAt, walls = [];
  const wall = (a, b, side) => walls.push({ ax: W(...a)[0], az: W(...a)[1], bx: W(...b)[0], bz: W(...b)[1], thick: wallThick, h: wallH, side });
  wall([R.u0, R.v0], [R.u0, -T], 'S'); wall([R.u0, T], [R.u0, R.v1], 'S');
  wall([R.u0, R.v1], [g2.u - T, R.v1], 'E'); wall([g2.u + T, R.v1], [R.u1, R.v1], 'E');
  wall([R.u1, R.v1], [R.u1, R.v0], 'N'); wall([R.u1, R.v0], [R.u0, R.v0], 'W');
  L.walls = walls;
  // towers: corners, beside both gates, and along the long walls
  const towers = [], tower = (u, v, r, h, kind) => { const [x, z] = W(u, v); towers.push({ x, z, r, h, kind }); };
  for (const [u, v] of [[R.u0, R.v0], [R.u1, R.v0], [R.u1, R.v1], [R.u0, R.v1]]) tower(u, v, 5.6, 16, 'corner');
  for (const sd of [-1, 1]) { tower(0, sd * T, 4.8, 17, 'gate'); tower(g2.u + sd * T, g2.v, 4.8, 17, 'gate'); }
  for (const [u, v] of [[(R.u0 + R.u1) / 2, R.v0], [R.u1, -18], [R.u1, 28], [R.u0, -42], [R.u0, 48], [22, R.v1]]) tower(u, v, 4.1, 13.5, 'mid');
  L.towers = towers;
  // buildings inside. Local yaw: front faces direction (fu, fv) in the castle frame.
  const yawTo = (fu, fv) => { const dx = fu * F.sin - fv * F.cos, dz = fu * F.cos + fv * F.sin; return Math.atan2(dx, dz); };
  const bld = (kind, u, v, w, d, h, fu, fv, o = {}) => { const [x, z] = W(u, v); return Object.assign({ kind, x, z, yaw: yawTo(fu, fv), w, d, h, style: 'stone', roof: 'hip', builder: 'block' }, o); };
  L.buildings = [
    bld('keep', 72, -40, 24, 22, 28, -1, 0.3, { roof: 'hip' }),
    bld('hall', 85, 38, 42, 15, 11, -1, 0, { roof: 'gable' }),
    bld('stable', 24, 48, 36, 11, 6.5, 1, 0, { roof: 'gable' }),
    bld('chapel', 30, -48, 10, 18, 9, 0, 1, { roof: 'gable' }),
    bld('barracks', 62, -62, 40, 9, 7, 0, 1, { roof: 'gable' }),
    bld('smithy', 12, 26, 9, 7, 6.5, 0, -1, { roof: 'hip', builder: 'house', style: 'stone' }),
    bld('gatekeeper', 14, -24, 10, 8, 6.5, 0, 1, { roof: 'hip', builder: 'house', style: 'plaster' }),
  ];
  // well: in the middle of the courtyard corner (centre of the arc of the road's right-hander)
  const wu = C.well[0], wv = C.well[1], [wx, wz] = W(wu, wv);
  L.well = { x: wx, z: wz, r: 2.1, h: 1.1 };
  L.moat = { d0: 5, d1: 17, level: C.level - 1.7 };
  L.court = { s0: C.gate1, s1: C.gate2 };
  return L;
}

// collision pieces for the castle. Walls, gatehouse blocks and buildings are segments with a radius (their face is `r` out from the line),
// towers and the well are circles. h 99: you cannot jump over them. Tagged `castle` for the tests and for art.
function castleObstacles(L) {
  const out = [];
  const seg = (ax, az, bx, bz, r, tag) => out.push({ ax, az, bx, bz, r, mu: 0.3, h: 99, castle: tag });
  for (const w of L.walls) seg(w.ax, w.az, w.bx, w.bz, w.thick / 2, 'wall');
  for (const t of L.towers) out.push({ x: t.x, z: t.z, r: t.r, mu: 0.3, h: 99, castle: 'tower' });
  const rect = (cx, cz, fx, fz, rx, rz, a0, a1, l0, l1, inset, tag) => {        // rectangle in a frame (forward f, right r), along a0..a1, lateral l0..l1, faces inset by `inset`
    const pt = (a, l) => [cx + fx * a + rx * l, cz + fz * a + rz * l];
    const c = [pt(a0 + inset, l0 + inset), pt(a1 - inset, l0 + inset), pt(a1 - inset, l1 - inset), pt(a0 + inset, l1 - inset)];
    for (let k = 0; k < 4; k++) seg(c[k][0], c[k][1], c[(k + 1) % 4][0], c[(k + 1) % 4][1], inset, tag);
  };
  for (const g of L.gatehouses) {
    const fx = Math.sin(g.th), fz = Math.cos(g.th), rx = -Math.cos(g.th), rz = Math.sin(g.th), d = g.depth / 2;
    rect(g.x, g.z, fx, fz, rx, rz, -d, d, g.half, g.half + g.blockW, 0.5, 'gate');
    rect(g.x, g.z, fx, fz, rx, rz, -d, d, -g.half - g.blockW, -g.half, 0.5, 'gate');
  }
  for (const b of L.buildings) rect(b.x, b.z, Math.sin(b.yaw), Math.cos(b.yaw), Math.cos(b.yaw), -Math.sin(b.yaw), -b.d / 2, b.d / 2, -b.w / 2, b.w / 2, 0.4, 'building');
  out.push({ x: L.well.x, z: L.well.z, r: L.well.r, mu: 0.3, h: 99, castle: 'well' });
  return out;
}
// true inside the castle area (wall rectangle + margin, moat included when margin >= 20)
function castleKeepOut(L, x, z, margin) {
  const [u, v] = L.toLocal(x, z);
  return castleRectDist(L.rect, u, v) < margin;
}
// 0..1: how much a ground point belongs to the courtyard (flat cobble / trodden earth), soft edge at the walls
function castleCourt(L, x, z) {
  const [u, v] = L.toLocal(x, z);
  return clamp(castleRectDepth(L.rect, u, v) / 3, 0, 1);
}
