  /* ---------- rivals: 14 other crews, run like a real rally ----------
     Crews start one at a time, 10 seconds apart, and race the clock, not each other. Each crew's whole
     run is worked out when the stage starts (their pace on this stage, corner speeds from the surface),
     so their split and stage times are fixed and fair. On the road you'll only meet one if you catch
     the crew ahead or the one behind catches you. Your position is decided on time. */
  const FIELD = 15, START_GAP = 10;          // 15 crews, each starting 10 seconds after the one before
  const DRIVERS = ['K. Lindqvist', 'M. Duval', 'A. Rossetti', 'T. Kanzaki', 'J. Okafor', 'P. Novák', 'S. Haraldsen', 'L. Moreau', 'D. Kowalski', 'R. Ishikawa', 'E. Varga', 'H. Brandt', 'C. Oyelaran', 'F. Castell'];
  const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const rivals = [];
  for (let i = 0; i < DRIVERS.length; i++) {
    // the car models are dressed on by art/rival-model.js (one per frame once the game runs); until then the group is empty
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    rivals.push({ g, wheels: [], name: DRIVERS[i], pace: 0.9 + 0.022 * i, s: 0, lane: 0, laneT: 0, v: 0, yawVis: 0, dust: 0, spin: 0, tab: null, offset: 0, stageTime: 0 });
  }
  let curvS = new Float32Array(1);
  function computeCurvature() {
    curvS = new Float32Array(P.length);
    for (let i = 0; i < P.length; i++) { let a = P[Math.min(P.length - 1, i + 3)].th - P[Math.max(0, i - 3)].th; curvS[i] = a / 12; }
  }
  const rivalPose = new THREE.Matrix4(), _rn = new THREE.Vector3(), _rf = new THREE.Vector3(), _rx = new THREE.Vector3(), _rg = { h: 0, n: new THREE.Vector3() };
  function placeRival(r) {
    const fi = clamp(r.s / track.step, 0, P.length - 1.001), i = fi | 0, t = fi - i, a = P[i], b = P[i + 1];
    const th = a.th + (b.th - a.th) * t;
    const cx = a.x + (b.x - a.x) * t - Math.cos(th) * r.lane, cz = a.z + (b.z - a.z) * t + Math.sin(th) * r.lane;
    world.groundAt(cx, cz, _rg);
    const hd = th + r.yawVis;
    _rf.set(Math.sin(hd), 0, Math.cos(hd)); _rn.copy(_rg.n);
    _rf.addScaledVector(_rn, -_rf.dot(_rn)).normalize(); _rx.crossVectors(_rn, _rf);
    rivalPose.makeBasis(_rx, _rn, _rf); r.g.quaternion.setFromRotationMatrix(rivalPose);
    r.g.position.set(cx, _rg.h + 0.51, cz);
    r.x = cx; r.z = cz; r.hd = hd;
  }
  // Drive one crew's run offline: returns the time (s after their start) at every road sample
  function simulateRival(skill) {
    const n = P.length, tab = new Float32Array(n), dt = 1 / 30;
    let s = startS, v = 0, t = 0, last = Math.floor(startS / track.step);
    while (s < track.length - 3 && t < 900) {
      const i = clamp(Math.round(s / track.step), 0, n - 1), SA = CONFIG.arcade.surfaces[P[i].surface];
      let km = 0; const reach = Math.round((14 + v * 1.7) / track.step);
      for (let j = i; j < Math.min(n, i + reach); j++) km = Math.max(km, Math.abs(curvS[j]));
      const target = Math.min(km > 1e-4 ? Math.sqrt(SA.maxG * 9.81 * 0.8 * skill / km) : 99, 50 * SA.top * skill);
      v = Math.max(0.5, v + clamp(target - v, -10 * dt, 6 * dt)); s += v * dt; t += dt;
      const j = Math.min(n - 1, Math.floor(s / track.step)); while (last < j) tab[++last] = t;
    }
    while (last < n - 1) tab[++last] = t;
    return tab;
  }
  const timeAtDist = (tab, d) => { const f = clamp(d / track.step, 0, P.length - 1.001), i = f | 0, u = f - i; return tab[i] + (tab[i + 1] - tab[i]) * u; };
  function distAtTime(tab, t) {
    let lo = 0, hi = P.length - 1;
    if (t <= tab[0]) return 0; if (t >= tab[hi]) return track.length;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tab[mid] <= t) lo = mid; else hi = mid; }
    const u = (t - tab[lo]) / Math.max(1e-6, tab[hi] - tab[lo]);
    return (lo + u) * track.step;
  }
  let skill1Time = 100;
  function calibrateRivals() { skill1Time = timeAtDist(simulateRival(1), track.finishS); }
  // order: the crews in starting order (names), the player's slot is where 'You' sits in it
  let startOrder = [];
  function setupRivals(order) {
    startOrder = order || defaultOrder();
    if (ST.practice) { for (const r of rivals) { r.tab = null; r.stageTime = null; r.g.visible = false; } return; }     // practice stage: nobody else on the road
    const slotOf = name => startOrder.indexOf(name);
    const me = slotOf('You');
    for (const r of rivals) {
      // each crew's form varies a little stage to stage
      const target = ST.refTime * r.pace * (1 + (Math.random() - 0.5) * 0.035);
      let skill = skill1Time / target, tab = null;
      for (let it = 0; it < 4; it++) {                                // a few correction passes to land on the target time
        tab = simulateRival(skill);
        skill *= Math.pow(timeAtDist(tab, track.finishS) / target, 1.5);
      }
      r.tab = tab;
      r.stageTime = timeAtDist(r.tab, track.finishS);
      r.offset = (slotOf(r.name) - me) * START_GAP;                  // seconds after you that they start (negative = before)
      r.s = 0; r.v = 0; r.lane = r.laneT = 0; r.yawVis = 0; r.g.visible = false;
    }
    updateRivals(0, 0);
  }
  function defaultOrder() { const o = rivals.map(r => r.name); o.splice(7, 0, 'You'); return o; }   // you start 8th of 15
  function hideRivals() { for (const r of rivals) r.g.visible = false; }
  function playerLateral() { const p = P[progIdx]; return (car.pos.x - p.x) * -Math.cos(p.th) + (car.pos.z - p.z) * Math.sin(p.th); }
  function updateRivals(dt, clock) {
    const ps = P[progIdx].s, pl = playerLateral();
    for (const r of rivals) {
      if (!r.tab) continue;
      const el = clock - r.offset;
      if (el < 0) { r.g.visible = false; continue; }                  // not started yet
      const s = Math.min(track.length - 3, distAtTime(r.tab, el));
      if (s > track.finishS + 40) { r.g.visible = false; r.s = s; continue; }   // finished and off the stage
      if (dt > 0) r.v += ((s - r.s) / dt - r.v) * Math.min(1, dt * 8);
      r.s = s; r.g.visible = true;
      const i = clamp(Math.round(s / track.step), 0, P.length - 1), surf = P[i].surface;
      // line: a little towards the inside of corners; move over if they come up on you
      r.laneT = clamp(-curvS[i] * 40, -1.2, 1.2);
      if (state !== 'menu' && Math.abs(r.s - ps) < 14 && Math.abs(r.lane - pl) < 2.2) r.laneT = pl > 0 ? -(half - 1.2) : half - 1.2;
      r.lane += clamp(r.laneT - r.lane, -2 * Math.max(dt, 1 / 60), 2 * Math.max(dt, 1 / 60));
      r.lane = clamp(r.lane, -(half - 1.1), half - 1.1);
      const aL = r.v * r.v * curvS[i];
      const yt = clamp(aL / 9.81 * (surf === 'tarmac' ? 0.12 : 0.38), -0.45, 0.45);
      r.yawVis += (yt - r.yawVis) * Math.min(1, Math.max(dt, 1 / 60) * 3);
      placeRival(r);
      r.spin += r.v * dt / 0.32; for (const w of r.wheels) w.rotation.x = r.spin;
      if (dt > 0 && CONFIG.surfaces[surf].dust && r.v > 8) {
        r.dust += dt * r.v * 0.9;
        while (r.dust > 1) {
          r.dust -= 1; const c = CONFIG.surfaces[surf].dust, k = 0.9 + Math.random() * 0.15;
          emit(r.x - _rf.x * 2.1 + (Math.random() - 0.5), r.g.position.y - 0.35, r.z - _rf.z * 2.1 + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, [c[0] * k, c[1] * k, c[2] * k], 0.9, 1.0 + Math.random() * 0.8);
        }
      }
    }
  }
  // bumping: two circles per car
  function collideRivals() {
    for (const r of rivals) {
      if (!r.g.visible) continue;
      const dx0 = car.pos.x - r.x, dz0 = car.pos.z - r.z;
      if (dx0 * dx0 + dz0 * dz0 > 36) continue;
      const fx = Math.sin(r.hd), fz = Math.cos(r.hd);
      for (const a of [1.15, -1.15]) for (const b of [1.15, -1.15]) {
        const px = car.pos.x + car.fwd.x * a, pz = car.pos.z + car.fwd.z * a, qx = r.x + fx * b, qz = r.z + fz * b;
        const dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz);
        if (d >= 1.9 || d < 1e-3) continue;
        const nx = dx / d, nz = dz / d, push = 1.9 - d;
        car.pos.x += nx * push; car.pos.z += nz * push;
        const vn = (car.vel.x - fx * r.v) * nx + (car.vel.z - fz * r.v) * nz;
        if (vn < 0) {
          const J = -1.3 * vn * 0.5;
          car.vel.x += nx * J; car.vel.z += nz * J;
          car.angVel.y += (Math.random() - 0.5) * J * 0.12;
          if (vn < -1.5) impacts.push(Math.min(1, -vn / 10));
        }
      }
    }
  }
  function racePosition(atDist, myTime) {
    const d = atDist != null ? atDist : P[progIdx].s, t = myTime != null ? myTime : raceTime;
    let ahead = 0; for (const r of rivals) if (r.tab && timeAtDist(r.tab, d) < t) ahead++;
    return 1 + ahead;
  }
  function splitGap(d, t) { let best = Infinity; for (const r of rivals) if (r.tab) best = Math.min(best, timeAtDist(r.tab, d)); return t - best; }
  function classify(myTime) {          // stage classification: everyone's time, you included (null = did not finish)
    const rows = ST.practice ? [] : rivals.map(r => ({ name: r.name, time: r.stageTime }));
    rows.push({ name: 'You', time: myTime, you: true });
    rows.sort((a, b) => (a.time == null) - (b.time == null) || a.time - b.time);
    rows.forEach((r, k) => { r.pos = r.time == null ? null : k + 1; r.pts = r.time == null ? 0 : (POINTS[k] || 0); });
    return rows;
  }

