/* =====================================================================
   TRACK: a spline built from the stage's segments
   ===================================================================== */
// Co-driver calls in the Sega Rally manner: Easy / Medium / Sharp, Long, Square, Hairpin, "maybe", "don't cut"
function paceNote(seg) {
  const dir = seg[0] === 'R' ? 'right' : 'left', ang = seg[1], r = seg[2];
  if (ang >= 140) return 'Hairpin ' + dir;
  if (ang >= 75 && r < 32) return 'Square ' + dir;
  const sev = r >= 110 ? 'Easy' : r >= 45 ? 'Medium' : 'Sharp';
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
  for (const seg of ST.segments) {
    if (seg[0] === 'S') {
      const n = Math.max(1, Math.round(seg[1] / step)), ds = seg[1] / n;
      for (let i = 0; i < n; i++) { x += Math.sin(th) * ds; z += Math.cos(th) * ds; s += ds; pts.push({ x, z, th, s }); }
    } else {
      // Right turn = heading decreases (car's right is -x when facing +z)
      const dir = seg[0] === 'R' ? -1 : 1, ang = seg[1] * D2R, r = seg[2], len = ang * r;
      notes.push({ s, s1: s + len, r, text: paceNote(seg), kind: seg[1] >= 140 ? 'hairpin' : 'turn', dir: seg[0] });
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
    h = pts.map(p => ST.height(p.x, p.z));
    for (let pass = 0; pass < 3; pass++) {
      const W = 35, out = new Array(n);
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
  for (const [js, jh] of ST.jumps) {
    notes.push({ s: js - 22, text: 'Crest, jump!', kind: 'jump', dir: '' });
    for (let i = 0; i < n; i++) {
      const u = pts[i].s - js;
      if (u > -28 && u <= 0) h[i] += jh * smoothstep((u + 28) / 28);
      else if (u > 0 && u < 22) h[i] += jh * (1 - smoothstep(u / 22));
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
  const turnNote = new Map(notes.filter(nt => nt.kind !== 'jump').map(nt => [Math.round(nt.s), nt]));
  for (const t of turns) { const nt = turnNote.get(Math.round(t.s0)); t.blind = !!(nt && nt.blind); t.note = nt ? nt.text : ''; }
  notes.sort((a, b) => a.s - b.s);
  return { samples: pts, notes, turns, length, finishS, cityStart, flatZones, step };
}

/* =====================================================================
   TERRAIN: a height grid. Physics and rendering read the same numbers.
   'blend': natural hills, eased down to the road near it.
   'cliff': shaped around the road: a rock wall on the uphill side, a drop on the other.
   ===================================================================== */
function buildTerrain(track, ST = CONFIG.stage) {
  const P = track.samples, half = ST.roadHalfWidth, cliff = ST.terrain === 'cliff';
  const cell = ST.cell || 4, margin = cliff ? 260 : 200;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= margin; minZ -= margin; maxX += margin; maxZ += margin;
  const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const N = nx * nz;
  const h = new Float32Array(N), dist = new Float32Array(N), nearS = new Float32Array(N);
  const natural = (x, z) => {
    let v = ST.height(x, z);
    for (const f of track.flatZones) { const r = Math.hypot(x - f.x, z - f.z); if (r < f.r + 140) v += (f.level - v) * (1 - smoothstep(clamp((r - f.r) / 140, 0, 1))); }
    return v;
  };
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
  P.forEach((p, i) => { const k = Math.floor(p.x / HC) * 73856 + Math.floor(p.z / HC); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  // Coarse nearest-sample grid for far-away points
  const CG = 10, cnx = Math.ceil(nx / CG) + 1, cnz = Math.ceil(nz / CG) + 1, coarseI = new Int32Array(cnx * cnz), coarseD = new Float32Array(cnx * cnz);
  for (let cz = 0; cz < cnz; cz++) for (let cx = 0; cx < cnx; cx++) {
    const x = minX + cx * CG * cell, z = minZ + cz * CG * cell;
    let best = 1e18, bi = 0;
    for (let j = 0; j < P.length; j += 4) { const dx = P[j].x - x, dz = P[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = j; } }
    coarseI[cz * cnx + cx] = bi; coarseD[cz * cnx + cx] = Math.sqrt(best);
  }
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = minX + ix * cell, z = minZ + iz * cell, k = iz * nx + ix;
      const hx = Math.floor(x / HC), hz = Math.floor(z / HC);
      let best = 1e18, bi = -1;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const list = hash.get((hx + a) * 73856 + (hz + b)); if (!list) continue;
        for (const j of list) { const dx = P[j].x - x, dz = P[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = j; } }
      }
      if (bi < 0) {
        const ck = Math.round(iz / CG) * cnx + Math.round(ix / CG), ci = coarseI[ck];
        h[k] = cliff ? profile(P[ci], lateral(P[ci], x, z), x, z) : natural(x, z);
        dist[k] = Math.max(R * HC, coarseD[ck]); nearS[k] = P[ci].s;
        continue;
      }
      const d = Math.sqrt(best), p = P[bi];
      dist[k] = d; nearS[k] = p.s;
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
        for (const j of list) { if (Math.abs(P[j].s - p.s) < 70) continue; const dx = P[j].x - x, dz = P[j].z - z, d2 = dx * dx + dz * dz; if (d2 < best2) { best2 = d2; bj = j; } }
      }
      const h1 = profile(p, lateral(p, x, z), x, z);
      if (bj < 0) { h[k] = h1; continue; }
      const d2 = Math.sqrt(best2), w1 = 1 / Math.pow(d + 1, 4), w2 = 1 / Math.pow(d2 + 1, 4);
      h[k] = (h1 * w1 + profile(P[bj], lateral(P[bj], x, z), x, z) * w2) / (w1 + w2);
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
  return { minX, minZ, maxX, maxZ, nx, nz, cell, h, dist, nearS, heightAt, distAt: (x, z) => gridLookup(dist, x, z), sAt: (x, z) => gridLookup(nearS, x, z) };
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

