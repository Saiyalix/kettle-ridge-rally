/* =====================================================================
   TRACK: a spline built from the stage's segments
   ===================================================================== */
// Co-driver calls in the Sega Rally manner: Easy / Medium / Sharp, Long, Square, Hairpin, "maybe", "don't cut"
// surf: the surface the corner is on. On tarmac the car can only hold about 150 km/h round a 110 m radius, so "Easy" (= keep your foot down) needs 150 m there
function paceNote(seg, surf) {
  const dir = seg[0] === 'R' ? 'right' : 'left', ang = seg[1], r = seg[2];
  if (ang >= 300) return 'Full circle ' + dir + ', drift area';
  if (ang >= 140) return 'Hairpin ' + dir;
  if (ang >= 75 && r < 32) return 'Square ' + dir;
  const sev = r >= (surf === 'tarmac' ? 150 : 110) ? 'Easy' : r >= 45 ? 'Medium' : 'Sharp';
  let t = (ang >= 70 ? 'Long ' + sev.toLowerCase() : sev) + ' ' + dir;
  if (sev === 'Easy' && r >= 170) t += ', maybe';
  else if (sev !== 'Easy' && ang >= 60 && r < 60) t += ", don't cut";
  return t;
}

function buildTrack(ST = CONFIG.stage) {
  const step = 2;
  let x = 0, z = 0, th = 0, s = 0;
  const pts = [{ x, z, th, s }];
  const notes = [], turns = [];
  const surfaceAtS = s0 => { let sf = ST.surfaceChanges[0][1]; for (const [d, sname] of ST.surfaceChanges) if (s0 >= d) sf = sname; return sf; };
  for (const seg of ST.segments) {
    if (seg[0] === 'S') {
      const n = Math.max(1, Math.round(seg[1] / step)), ds = seg[1] / n;
      for (let i = 0; i < n; i++) { x += Math.sin(th) * ds; z += Math.cos(th) * ds; s += ds; pts.push({ x, z, th, s }); }
    } else {
      // Right turn = heading decreases (car's right is -x when facing +z)
      const dir = seg[0] === 'R' ? -1 : 1, ang = seg[1] * D2R, r = seg[2], len = ang * r;
      notes.push({ s, s1: s + len, r, text: paceNote(seg, surfaceAtS(s)), kind: seg[1] >= 140 ? 'hairpin' : 'turn', dir: seg[0] });
      turns.push({ s0: s, s1: s + len, dir: seg[0], r });
      const n = Math.max(2, Math.round(len / step)), ds = len / n, dth = dir * ang / n;
      for (let i = 0; i < n; i++) {
        th += dth * 0.5; x += Math.sin(th) * ds; z += Math.cos(th) * ds; th += dth * 0.5; s += ds;
        pts.push({ x, z, th, s });
      }
    }
  }
  const length = s, finishS = length - ST.runoff, n = pts.length;
  const cityStart = ST.cityLength ? finishS - ST.cityLength : Infinity;

  // Road height
  let h;
  if (ST.elevation) h = pts.map(p => ST.elevation(p.s));
  else {
    // terrain under the road, heavily smoothed so gradients stay drivable
    // (ST.roadHeight = a ground function without ditches and the like, ST.roadSmooth = { W, passes }: SS4 follows its castle hill closely)
    const rs = ST.roadSmooth || { W: 35, passes: 3 };
    h = pts.map(p => (ST.roadHeight || ST.height)(p.x, p.z));
    for (let pass = 0; pass < rs.passes; pass++) {
      const W = rs.W, out = new Array(n);
      for (let i = 0; i < n; i++) { let sum = 0, c = 0; for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) { sum += h[j]; c++; } out[i] = sum / c; }
      h = out;
    }
  }
  // Flat stretches (paddies, town): hold a level and ramp into it
  const flatZones = [];
  for (const f of ST.flatRoad || []) {
    const from = f.city ? cityStart : f.from, to = f.city ? length : f.to;
    let lvl = 0, c = 0, cx = 0, cz = 0;
    for (let i = 0; i < n; i++) if (pts[i].s >= from && pts[i].s <= to) { lvl += h[i]; cx += pts[i].x; cz += pts[i].z; c++; }
    lvl /= c; cx /= c; cz /= c;
    for (let i = 0; i < n; i++) {
      const s0 = pts[i].s, t = s0 < from ? 1 - (from - s0) / f.ramp : s0 > to ? 1 - (s0 - to) / f.ramp : 1;
      if (t > 0) h[i] += (lvl - h[i]) * smoothstep(clamp(t, 0, 1));
    }
    let rad = 0; for (let i = 0; i < n; i++) if (pts[i].s >= from && pts[i].s <= to) rad = Math.max(rad, Math.hypot(pts[i].x - cx, pts[i].z - cz));
    flatZones.push({ x: cx, z: cz, r: rad + 60, level: lvl });
  }
  if (flatZones.length) for (let pass = 0; pass < 3; pass++) {   // smooth the ramps into and out of flat stretches
    const W = 25, out = new Array(n);
    for (let i = 0; i < n; i++) { let sum = 0, c = 0; for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) { sum += h[j]; c++; } out[i] = sum / c; }
    h = out;
  }
  // Crests: quick rise, then the road falls away so the car takes off
  // (a jump entry [s, height, 'bump'] is a short whoop: half as long, no call)
  for (const [js, jh, kind] of ST.jumps) {
    const bump = kind === 'bump', up = bump ? 14 : 28, down = bump ? 11 : 22;
    if (!bump) notes.push({ s: js - 22, text: 'Crest, jump!', kind: 'jump', dir: '' });
    for (let i = 0; i < n; i++) {
      const u = pts[i].s - js;
      if (u > -up && u <= 0) h[i] += jh * smoothstep((u + up) / up);
      else if (u > 0 && u < down) h[i] += jh * (1 - smoothstep(u / down));
    }
  }
  // Cliff sides: 1 = rock wall rising on that side, 0 = drop
  const cs = ST.cliffSides;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    p.y = h[i];
    let surf = ST.surfaceChanges[0][1];
    for (const [d, sname] of ST.surfaceChanges) if (p.s >= d) surf = sname;
    p.surface = surf;
    if (cs) {
      let k = 0; while (k < cs.length - 1 && cs[k + 1][0] <= p.s) k++;
      const a = cs[k], b = cs[Math.min(k + 1, cs.length - 1)];
      const t = b[0] > a[0] ? smoothstep(clamp((p.s - a[0]) / (b[0] - a[0]), 0, 1)) : 0;
      p.upL = a[1] + (b[1] - a[1]) * t; p.upR = a[2] + (b[2] - a[2]) * t;
      p.wall = 14 + 20 * (0.5 + 0.5 * Math.sin(p.s / 97 + 0.6));
      p.drop = 40 + 55 * (0.5 + 0.5 * Math.sin(p.s / 143 + 1.3));
    }
  }
  // Run-in and run-out: visual road before s = 0 and after the runoff (ST.context.lead / .tail). NOT in `samples`: s values, gates, checkpoints,
  // pace notes, minimap, rivals and the bot only ever see `samples`. Terrain and the road mesh also read `visual` (lead + samples + tail + tee arms).
  // Each piece: { len m, curve deg (+ = turning left, over the whole length), end: 'tee' | 'gate' | 'none', surface, arm: tee arm length m }
  const ctx = ST.context || {}, lead = [], tail = [], arms = [], ends = {};
  const ghFn = ST.roadHeight || ST.height, XS = 4;
  const extend = (a, sgn, spec) => {
    const out = [], m = Math.max(1, Math.round(spec.len / XS)), ds = spec.len / m, dth = (spec.curve || 0) * D2R / m, g0 = ghFn(a.x, a.z);
    let x = a.x, z = a.z, th = a.th;
    for (let i = 1; i <= m; i++) {
      if (sgn > 0) { th += dth * 0.5; x += Math.sin(th) * ds; z += Math.cos(th) * ds; th += dth * 0.5; }
      else { th -= dth * 0.5; x -= Math.sin(th) * ds; z -= Math.cos(th) * ds; th -= dth * 0.5; }
      const s0 = sgn > 0 ? a.s + i * ds : -i * ds;
      const y = ST.elevation ? ST.elevation(s0) : a.y + (ghFn(x, z) - g0) * smoothstep(clamp(i * ds / 80, 0, 1));
      const q = { x, z, th, s: s0, y, surface: spec.surface || a.surface, v: true };
      if (cs) { q.upL = a.upL; q.upR = a.upR; q.wall = a.wall; q.drop = a.drop; }
      out.push(q);
    }
    return sgn > 0 ? out : out.reverse();
  };
  if (ctx.lead) lead.push(...extend(pts[0], -1, ctx.lead));
  if (ctx.tail) tail.push(...extend(pts[n - 1], 1, ctx.tail));
  // a T: the road ends against a cross road (both arms are visual road too, so the ground flattens under them)
  const teeFor = (e, spec, outward) => {
    const half = ST.roadHalfWidth, L = spec.arm || 36, c = Math.cos(e.th), sn = Math.sin(e.th);
    const cx = e.x + Math.sin(e.th) * outward * half * 0.98, cz = e.z + Math.cos(e.th) * outward * half * 0.98, g0 = ghFn(cx, cz), strip = [];
    for (let t = -L; t <= L + 0.01; t += XS) {
      const x = cx + c * t, z = cz - sn * t, q = { x, z, th: e.th + Math.PI / 2, s: e.s, y: e.y + (ghFn(x, z) - g0) * smoothstep(clamp(Math.abs(t) / 30, 0, 1)), surface: e.surface, v: true, t: t + 1000 };
      if (cs) { q.upL = e.upL; q.upR = e.upR; q.wall = e.wall; q.drop = e.drop; }
      strip.push(q); arms.push(q);
    }
    return strip;
  };
  const tees = [];
  if (lead.length && ctx.lead.end === 'tee') tees.push(teeFor(lead[0], ctx.lead, -1));
  if (tail.length && ctx.tail.end === 'tee') tees.push(teeFor(tail[tail.length - 1], ctx.tail, 1));
  if (lead.length) ends.lead = { end: ctx.lead.end || 'none', p: lead[0] };
  if (tail.length) ends.tail = { end: ctx.tail.end || 'none', p: tail[tail.length - 1] };
  if (cs) for (const nt of notes) {           // warn about corners with a drop on the outside
    if (nt.kind === 'jump') continue;
    const p = pts[clamp(Math.round(nt.s / step) + 8, 0, n - 1)];
    if ((nt.dir === 'L' ? p.upR : p.upL) < 0.4) nt.text = nt.text.replace(", don't cut", '') + ', careful!';
  }
  // Readability: corners hidden behind a crest are 'blind' (chevrons, and the call says so); fast corners
  // that drop away steeply are called 'downhill' so you brake earlier
  const hAt = s0 => pts[clamp(Math.round(s0 / step), 0, n - 1)].y;
  for (const nt of notes) {
    if (nt.kind === 'jump') continue;
    let crest = false;
    for (let d = 8; d <= 45; d += 2) { const c = hAt(nt.s - d); if (c - hAt(nt.s - d - 25) > 1.0 && c - hAt(nt.s + 10) > 1.0) { crest = true; break; } }
    nt.blind = crest;
    const drop = hAt(nt.s - 30) - hAt(nt.s1);
    const care = nt.text.endsWith(', careful!'), base = nt.text.replace(', careful!', '');
    let extra = '';
    if (crest && !/Hairpin|Square/.test(base)) extra = ', over crest';
    else if (drop > 6 && nt.r >= 60) extra = ', downhill';
    if (extra) nt.text = base.replace(', maybe', '') + extra + (care ? ', careful!' : '');
  }
  // SS4: the co-driver knows the castle. The corner before gate 1 says "gate", the courtyard corner says "around the well"
  if (ST.castle) {
    const before = notes.filter(nt => nt.kind !== 'jump' && nt.s1 <= ST.castle.gate1).pop();
    if (before && ST.castle.gate1 - before.s1 < 90) before.text += ', then gate, brake for the well';      // early warning: the courtyard corner comes 40 m after the gate
    for (const nt of notes) if (nt.kind !== 'jump' && nt.s >= ST.castle.gate1 && nt.s1 <= ST.castle.gate2) nt.text = nt.text.replace(", don't cut", '') + ', around the well';
  }
  // Tight corners are the ones that punish full gas: the call says "brake" (hairpin, square, full circle) and the HUD shows
  // it earlier (note.lead = extra metres of warning), in a warning colour (note.tight). Sharp corners already say "don't cut".
  for (const nt of notes) {
    if (nt.kind === 'jump') continue;
    const hard = /^(Hairpin|Square|Full circle)/.test(nt.text), sharp = /sharp/i.test(nt.text);
    nt.tight = hard || sharp;
    nt.lead = hard ? 60 : sharp ? 30 : 0;
    if (hard && !/careful|brake|well/.test(nt.text)) nt.text += ', brake!';
  }
  const turnNote = new Map(notes.filter(nt => nt.kind !== 'jump').map(nt => [Math.round(nt.s), nt]));
  for (const t of turns) { const nt = turnNote.get(Math.round(t.s0)); t.blind = !!(nt && nt.blind); t.note = nt ? nt.text : ''; }
  notes.sort((a, b) => a.s - b.s);
  return { samples: pts, notes, turns, length, finishS, cityStart, flatZones, step, lead, tail, tees, ends, visual: lead.concat(pts, tail, arms) };
}

/* =====================================================================
   TERRAIN: a height grid. Physics and rendering read the same numbers.
   'blend': natural hills, eased down to the road near it.
   'cliff': shaped around the road: a rock wall on the uphill side, a drop on the other.
   ===================================================================== */
function buildTerrain(track, ST = CONFIG.stage) {
  const P = track.samples, V = track.visual || P, half = ST.roadHalfWidth, cliff = ST.terrain === 'cliff', ctx = ST.context || {};
  const cell = ST.cell || 4, margin = ctx.margin || (cliff ? 260 : 200);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= margin; minZ -= margin; maxX += margin; maxZ += margin;
  // scenery scatters inside these (the box without run-in / run-out), so adding a run-in never moves a tree
  const base = { minX, minZ, maxX, maxZ };
  if (V !== P) {              // grow the grid to cover the run-in / run-out, on the same grid lines (heights on the old nodes stay exactly as they were)
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of V) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); }
    a -= margin; c -= margin; b += margin; d += margin;
    if (a < minX) minX -= Math.ceil((minX - a) / cell) * cell;
    if (c < minZ) minZ -= Math.ceil((minZ - c) / cell) * cell;
    if (b > maxX) maxX += Math.ceil((b - maxX) / cell) * cell;
    if (d > maxZ) maxZ += Math.ceil((d - maxZ) / cell) * cell;
  }
  const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const N = nx * nz;
  // the grid before any run-in / run-out was added (same origin): the ground colour noise is drawn from the stage generator over this part only
  const ix0 = Math.round((base.minX - minX) / cell), iz0 = Math.round((base.minZ - minZ) / cell), nx0 = Math.ceil((base.maxX - base.minX) / cell) + 1, nz0 = Math.ceil((base.maxZ - base.minZ) / cell) + 1;
  const h = new Float32Array(N), dist = new Float32Array(N), nearS = new Float32Array(N), distV = new Float32Array(N);
  const natural0 = (x, z) => {
    let v = ST.height(x, z);
    for (const f of track.flatZones) { const r = Math.hypot(x - f.x, z - f.z); if (r < f.r + 140) v += (f.level - v) * (1 - smoothstep(clamp((r - f.r) / 140, 0, 1))); }
    return v;
  };
  // benches (ST.context.benches): level pads beside the road for service parks, car parks, farm yards. { s, side, off, w, d, ramp }:
  // centre `off` m from the road centre line (side +1 = right), w along the road, d across it, eased into the ground over `ramp` m (default 24).
  // The inner edge is kept at least 20 m from the road edge, and a bench only ever changes the ground (natural), never the road height.
  const benches = [];
  for (const b of ctx.benches || []) {
    let bp = P[0], bd = 1e9, bs = b.s;
    for (const arr of [track.lead, P, track.tail]) for (const q of arr) { const dd = Math.abs(q.s - bs); if (dd < bd) { bd = dd; bp = q; } }
    const off = Math.max(b.off, half + 20 + b.d / 2), side = b.side < 0 ? -1 : 1;
    const cx = bp.x - Math.cos(bp.th) * side * off, cz = bp.z + Math.sin(bp.th) * side * off;
    benches.push({ x: cx, z: cz, th: bp.th, w: b.w, d: b.d, ramp: b.ramp || 24, level: natural0(cx, cz), s: bp.s, side, off });
  }
  const natural = benches.length ? (x, z) => {
    let v = natural0(x, z);
    for (const b of benches) {
      const dx = x - b.x, dz = z - b.z, u = dx * Math.sin(b.th) + dz * Math.cos(b.th), l = -dx * Math.cos(b.th) + dz * Math.sin(b.th);
      const ex = Math.max(0, Math.abs(u) - b.w / 2), ez = Math.max(0, Math.abs(l) - b.d / 2), dr = Math.hypot(ex, ez);
      if (dr < b.ramp) v += (b.level - v) * (1 - smoothstep(dr / b.ramp));
    }
    return v;
  } : natural0;
  // cliff profile of the ground at lateral offset lat (+ = right of the road) from sample p
  const profile = (p, lat, x, z) => {
    const a = Math.abs(lat), edge = half + 2.2;
    if (a <= edge) return p.y;
    const w = a - edge, up = lat >= 0 ? p.upR : p.upL;
    const rise = Math.min(w * 2.3, p.wall) + Math.max(0, w - p.wall / 2.3) * 0.6;
    const fall = -Math.min(w * 1.7, p.drop) + Math.max(0, w - p.drop / 1.7 - 60) * 0.3;
    return p.y + up * rise + (1 - up) * fall + rockNoise(x, z) * Math.min(1, w / 12);
  };
  const lateral = (p, x, z) => (x - p.x) * -Math.cos(p.th) + (z - p.z) * Math.sin(p.th);
  // Spatial hash of road samples
  const HC = 20, R = cliff ? 4 : 3, hash = new Map();
  V.forEach((p, i) => { const k = Math.floor(p.x / HC) * 73856 + Math.floor(p.z / HC); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  // Coarse nearest-sample grid for far-away points
  // (the coarse points sit on the grid of the ground as it was before any run-in / run-out was added, so far-away dist / nearS values never change)
  const CG = 10, cOx = Math.ceil(ix0 / CG) + 1, cOz = Math.ceil(iz0 / CG) + 1, cnx = Math.ceil(nx / CG) + cOx + 2, cnz = Math.ceil(nz / CG) + cOz + 2, coarseI = new Int32Array(cnx * cnz), coarseD = new Float32Array(cnx * cnz);
  const cIx = ix => Math.round((ix - ix0) / CG) + cOx, cIz = iz => Math.round((iz - iz0) / CG) + cOz;
  for (let cz = 0; cz < cnz; cz++) for (let cx = 0; cx < cnx; cx++) {
    const x = base.minX + (cx - cOx) * CG * cell, z = base.minZ + (cz - cOz) * CG * cell;
    let best = 1e18, bi = 0;
    for (let j = 0; j < P.length; j += 4) { const dx = P[j].x - x, dz = P[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = j; } }
    coarseI[cz * cnx + cx] = bi; coarseD[cz * cnx + cx] = Math.sqrt(best);
  }
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = minX + ix * cell, z = minZ + iz * cell, k = iz * nx + ix;
      const hx = Math.floor(x / HC), hz = Math.floor(z / HC);
      let best = 1e18, bi = -1, bestP = 1e18, bpi = -1;       // best = nearest road of any kind (height), bestP = nearest real stage road (dist, nearS: as ever)
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const list = hash.get((hx + a) * 73856 + (hz + b)); if (!list) continue;
        for (const j of list) { const dx = V[j].x - x, dz = V[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = j; } if (d2 < bestP && !V[j].v) { bestP = d2; bpi = j; } }
      }
      if (bpi < 0) {
        const ck = cIz(iz) * cnx + cIx(ix), ci = coarseI[ck];
        dist[k] = Math.max(R * HC, coarseD[ck]); nearS[k] = P[ci].s;
        if (bi < 0) { h[k] = cliff ? profile(P[ci], lateral(P[ci], x, z), x, z) : natural(x, z); distV[k] = dist[k]; continue; }
      } else { dist[k] = Math.sqrt(bestP); nearS[k] = V[bpi].s; }
      if (bi < 0) continue;
      const d = Math.sqrt(best), p = V[bi];
      distV[k] = d;
      if (!cliff) {
        const t = clamp((d - (half + 2)) / 22, 0, 1);
        h[k] = p.y + (natural(x, z) - p.y) * smoothstep(t);
        continue;
      }
      // Blend with the nearest point of a different part of the road (switchbacks), so terrain between
      // two close legs meets smoothly instead of stepping
      let best2 = 1e18, bj = -1;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const list = hash.get((hx + a) * 73856 + (hz + b)); if (!list) continue;
        for (const j of list) { if (Math.abs(V[j].s - p.s) < 70) continue; const dx = V[j].x - x, dz = V[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best2) { best2 = d2; bj = j; } }
      }
      const h1 = profile(p, lateral(p, x, z), x, z);
      if (bj < 0) { h[k] = h1; continue; }
      const d2 = Math.sqrt(best2), w1 = 1 / Math.pow(d + 1, 4), w2 = 1 / Math.pow(d2 + 1, 4);
      h[k] = (h1 * w1 + profile(V[bj], lateral(V[bj], x, z), x, z) * w2) / (w1 + w2);
    }
  }
  function heightAt(x, z) {
    let fx = (x - minX) / cell, fz = (z - minZ) / cell;
    fx = clamp(fx, 0, nx - 1.001); fz = clamp(fz, 0, nz - 1.001);
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, k = iz * nx + ix;
    const a = h[k], b = h[k + 1], c = h[k + nx], e = h[k + nx + 1];
    return (a + (b - a) * tx) + ((c + (e - c) * tx) - (a + (b - a) * tx)) * tz;
  }
  function gridLookup(arr, x, z) {
    const ix = clamp(Math.round((x - minX) / cell), 0, nx - 1), iz = clamp(Math.round((z - minZ) / cell), 0, nz - 1);
    return arr[iz * nx + ix];
  }
  return { minX, minZ, maxX, maxZ, base, ix0, iz0, nx0, nz0, nx, nz, cell, h, dist, nearS, distV, benches, heightAt, distAt: (x, z) => gridLookup(dist, x, z), distVAt: (x, z) => gridLookup(distV, x, z), sAt: (x, z) => gridLookup(nearS, x, z) };
}

/* World interface used by the car: ground height, normal and surface */
function makeWorld(track, terrain, ST = CONFIG.stage) {
  const P = track.samples, half = ST.roadHalfWidth, HC = 10;
  const hash = new Map();
  P.forEach((p, i) => { const key = Math.floor(p.x / HC) * 73856 + Math.floor(p.z / HC); if (!hash.has(key)) hash.set(key, []); hash.get(key).push(i); });
  function nearest(x, z) {
    const cx = Math.floor(x / HC), cz = Math.floor(z / HC);
    let best = 1e18, bi = -1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = hash.get((cx + a) * 73856 + (cz + b)); if (!list) continue;
      for (const i of list) { const dx = P[i].x - x, dz = P[i].z - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = i; } }
    }
    return { i: bi, d2: best };
  }
  return {
    groundAt(x, z, out) {
      out.h = terrain.heightAt(x, z);
      const e = 0.8;
      const hx = terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z);
      const hz = terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e);
      out.n.set(-hx, 2 * e, -hz).normalize();
    },
    surfaceAt(x, z) {
      const r = nearest(x, z);
      if (r.i < 0 || r.d2 > half * half) return 'grass';
      return P[r.i].surface;
    },
    nearest,
  };
}

