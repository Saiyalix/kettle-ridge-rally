// (c) Handling targets on a flat skid pad of each surface, both cars (targets: docs/decisions.md, 2026-11-07 and 2026-11-10):
//     held-key slide per surface, first swing-out, spin test, recovery after letting go, steering wind-on time
//     (and equal on every surface), Strada slides more than Kestrel, handbrake turn.
'use strict';
const { openGame } = require('./lib/game');
const skidpad = require('./lib/skidpad');

module.exports = async function handlingTest({ browser, base, expected }) {
  const T = expected.handling, checks = [], rows = [];
  const surfaces = [...T.driveSurfaces, ...T.offRoadSurfaces];
  const g = await openGame(browser, base, { probe: true });
  const carCount = await g.page.evaluate(() => (window.__probe || window).CONFIG.cars.length);
  const run = a => g.page.evaluate(`(${skidpad.toString()})(${JSON.stringify(a)})`);
  for (let carIndex = 0; carIndex < carCount; carIndex++) {
    for (const surface of surfaces) {
      const off = T.offRoadSurfaces.includes(surface);
      for (const kmh of off ? [T.offRoadKmh] : T.speedsKmh) rows.push(await run({ mode: 'held', surface, kmh, carIndex }));
      for (const kmh of T.spinKmh) rows.push(await run({ mode: 'spin', surface, kmh, carIndex }));
    }
    rows.push(await run({ mode: 'handbrake', surface: T.handbrake.surface, kmh: T.handbrake.kmh, carIndex }));
  }
  await g.ctx.close();
  const f = (a, d = 1) => a.toFixed(d), rng = a => `${f(Math.min(...a))}–${f(Math.max(...a))}`;
  const cars = [...new Set(rows.map(r => r.car))];
  for (const car of cars) {
    const mine = rows.filter(r => r.car === car), held = mine.filter(r => r.mode === 'held'), spin = mine.filter(r => r.mode === 'spin');
    for (const surface of surfaces) {
      const hs = held.filter(r => r.surface === surface), ss = spin.filter(r => r.surface === surface);
      const [lo, hi] = T.slideDeg[surface] || [0, T.grassMaxSlideDeg];
      const sl = hs.map(r => r.slideDeg), sp = hs.map(r => r.swingDeg);
      checks.push({ name: `${car} ${surface}: held-key slide ${lo}–${hi}°`, pass: Math.min(...sl) >= lo && Math.max(...sl) <= hi,
        detail: `${rng(sl)}° at ${hs.map(r => r.kmh).join('/')} km/h` });
      checks.push({ name: `${car} ${surface}: first swing-out ≤ ${T.swingMaxDeg}°`, pass: Math.max(...sp) <= T.swingMaxDeg, detail: `peak ${f(Math.max(...sp))}°` });
      const recMax = T.recoverS[surface] || T.recoverS.default;
      const rec = hs.map(r => r.recoverS), over = hs.map(r => r.overshootDeg);
      checks.push({ name: `${car} ${surface}: letting go → under 5° within ${recMax} s, ≤ ${T.overshootMaxDeg}° past straight`,
        pass: rec.every(x => x !== null && x <= recMax) && Math.max(...over) <= T.overshootMaxDeg,
        detail: `back in ${rec.every(x => x !== null) ? f(Math.max(...rec), 2) : 'never'} s, overshoot ${f(Math.max(...over))}°` });
      checks.push({ name: `${car} ${surface}: spin test never past ${T.spin.maxDeg}°, ≤ ${T.spin.over45S} s past 45°`,
        pass: ss.every(r => !r.spun && r.maxDeg <= T.spin.maxDeg) && Math.max(...ss.map(r => r.over45S)) <= T.spin.over45S,
        detail: `max ${f(Math.max(...ss.map(r => r.maxDeg)), 0)}°, ${f(Math.max(...ss.map(r => r.over45S)), 2)} s past 45° (at ${ss.map(r => r.kmh).join('/')} km/h)` });
    }
    const drive = held.filter(r => T.driveSurfaces.includes(r.surface));
    for (const kmh of T.speedsKmh) {
      const w = drive.filter(r => r.kmh === kmh).map(r => r.wheelMs), lo = Math.min(...w), hi = Math.max(...w);
      if (kmh <= T.turnInUpToKmh) checks.push({ name: `${car} ${kmh} km/h: steering wound on ${T.turnInMs[0]}–${T.turnInMs[1]} ms`, pass: lo >= T.turnInMs[0] && hi <= T.turnInMs[1], detail: `${f(lo, 0)}–${f(hi, 0)} ms` });
      checks.push({ name: `${car} ${kmh} km/h: wind-on same on all surfaces (≤ ${T.maxWheelSpreadMs} ms apart)`, pass: hi - lo <= T.maxWheelSpreadMs, detail: `${f(lo, 0)}–${f(hi, 0)} ms` });
    }
    const hb = mine.find(r => r.mode === 'handbrake');
    checks.push({ name: `${car} handbrake ${T.handbrake.kmh} km/h ${T.handbrake.surface}: 90° within ${T.handbrake.maxS} s, no spin`,
      pass: hb.t90 !== null && hb.t90 <= T.handbrake.maxS && !hb.spun, detail: `90° at ${hb.t90 === null ? 'never' : f(hb.t90, 2) + ' s'}, peak slide ${f(hb.maxDeg, 0)}°` });
  }
  if (cars.length >= 2) for (const surface of ['gravel', 'dirt']) {
    const avg = c => { const a = rows.filter(r => r.mode === 'held' && r.car === c && r.surface === surface).map(r => r.slideDeg); return a.reduce((x, y) => x + y, 0) / a.length; };
    const k = avg(cars[0]), s = avg(cars[1]);
    checks.push({ name: `${cars[1]} slides ≥ ${T.stradaExtraDeg}° more than ${cars[0]} on ${surface}`, pass: s - k >= T.stradaExtraDeg, detail: `${f(s)}° vs ${f(k)}° (+${f(s - k)}°)` });
  }
  return { checks, data: rows };
};
