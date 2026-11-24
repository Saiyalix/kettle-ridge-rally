// (c) Handling targets on a flat skid pad of each surface, every car (targets: docs/decisions.md, 2026-11-07 and 2026-11-10):
//     held-key slide per surface, first swing-out, spin test, recovery after letting go, steering wind-on time
//     (and equal on every surface), per-car pairs slide more than each other (Strada > Kestrel, Nightjar > Strada), long drift, handbrake turn.
//     A car listed in expected.json handling.perCar has its own slide, grass and letting-go targets (CLAUDE.md).
//     Phone controls: part tilt (proportional, steady), auto gas with a brake tap, handbrake turn on auto gas.
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
    rows.push(await run({ mode: 'long', surface: T.longDrift.surface, kmh: T.longDrift.kmh, carIndex, holdS: T.longDrift.holdS, fromS: T.longDrift.fromS }));
    // phone: part tilt per surface, auto gas with and without a brake tap, handbrake turn with auto gas
    const PH = T.phone;
    for (const surface of surfaces) for (const pct of PH.tiltPct)
      rows.push(await run({ mode: 'tilt', surface, kmh: T.offRoadSurfaces.includes(surface) ? T.offRoadKmh : PH.tiltKmh, carIndex, pct }));
    for (const surface of T.driveSurfaces) for (const tap of [false, true]) rows.push(await run({ mode: 'autogas', surface, kmh: PH.autoGasKmh, carIndex, tap }));
    rows.push(await run({ mode: 'handbrake', surface: T.handbrake.surface, kmh: T.handbrake.kmh, carIndex, autoGas: true }));
  }
  await g.ctx.close();
  const f = (a, d = 1) => a.toFixed(d), rng = a => `${f(Math.min(...a))}–${f(Math.max(...a))}`;
  const cars = [...new Set(rows.map(r => r.car))];
  // this car's own targets where expected.json gives them, the shared ones otherwise
  const own = car => T.perCar[car] || {};
  const slideRange = (car, surface) => own(car).slideDeg && own(car).slideDeg[surface] || T.slideDeg[surface] || [0, own(car).grassMaxSlideDeg || T.grassMaxSlideDeg];
  const recoverMax = (car, surface) => { const r = own(car).recoverS || T.recoverS; return r[surface] || r.default; };
  for (const car of cars) {
    const mine = rows.filter(r => r.car === car), held = mine.filter(r => r.mode === 'held'), spin = mine.filter(r => r.mode === 'spin');
    for (const surface of surfaces) {
      const hs = held.filter(r => r.surface === surface), ss = spin.filter(r => r.surface === surface);
      const [lo, hi] = slideRange(car, surface);
      const sl = hs.map(r => r.slideDeg), sp = hs.map(r => r.swingDeg);
      checks.push({ name: `${car} ${surface}: held-key slide ${lo}–${hi}°`, pass: Math.min(...sl) >= lo && Math.max(...sl) <= hi,
        detail: `${rng(sl)}° at ${hs.map(r => r.kmh).join('/')} km/h` });
      if (surface === 'tarmac' && own(car).tarmacMinDeg) {
        const fast = hs.filter(r => r.kmh >= own(car).tarmacMinFromKmh);
        checks.push({ name: `${car} tarmac: held-key slide at least ${own(car).tarmacMinDeg}° from ${own(car).tarmacMinFromKmh} km/h up`,
          pass: fast.every(r => r.slideDeg >= own(car).tarmacMinDeg), detail: fast.map(r => `${f(r.slideDeg)}° at ${r.kmh}`).join(', ') + ' km/h' });
      }
      checks.push({ name: `${car} ${surface}: first swing-out ≤ ${T.swingMaxDeg}°`, pass: Math.max(...sp) <= T.swingMaxDeg, detail: `peak ${f(Math.max(...sp))}°` });
      const recMax = recoverMax(car, surface);
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
    const LD = T.longDrift, ld = mine.find(r => r.mode === 'long');
    if (own(car).longDrift) {
      const rivals = cars.filter(c => !T.perCar[c]), best = Math.max(...rivals.map(c => rows.find(r => r.mode === 'long' && r.car === c).keptPct));
      const need = own(car).longDrift.needsMoreSpeedKeptPts;
      checks.push({ name: `${car} long drift (${LD.surface}, ${LD.kmh} km/h, key held ${LD.holdS} s, gas off): angle within ±${LD.maxSpreadDeg}° of its average from ${LD.fromS} s`,
        pass: ld.spreadDeg <= LD.maxSpreadDeg, detail: `${f(ld.meanDeg)}° ±${f(ld.spreadDeg)}` });
      checks.push({ name: `${car} long drift: keeps ≥ ${need} points more speed than the better of ${rivals.join(' and ')}`,
        pass: ld.keptPct - best >= need, detail: `${f(ld.keptPct)}% kept vs ${f(best)}% (+${f(ld.keptPct - best)} points)` });
    }
    for (const hb of mine.filter(r => r.mode === 'handbrake'))
      checks.push({ name: `${car} handbrake ${T.handbrake.kmh} km/h ${T.handbrake.surface}${hb.autoGas ? ' (phone, auto gas)' : ''}: 90° within ${T.handbrake.maxS} s, no spin`,
        pass: hb.t90 !== null && hb.t90 <= T.handbrake.maxS && !hb.spun, detail: `90° at ${hb.t90 === null ? 'never' : f(hb.t90, 2) + ' s'}, peak slide ${f(hb.maxDeg, 0)}°` });
    // phone tilt: slide grows with the tilt, part tilt is steady, a small tilt is a small slide, full tilt = held key, letting go
    const PH = T.phone, tilt = mine.filter(r => r.mode === 'tilt');
    for (const surface of surfaces) {
      const ts = PH.tiltPct.map(p => tilt.find(r => r.surface === surface && r.pct === p)), sl = ts.map(r => r.slideDeg);
      const full = ts[ts.length - 1], half = ts[PH.tiltPct.indexOf(PH.tiltHalfPct)], part = ts.filter(r => r.pct < 100);
      const [lo, hi] = slideRange(car, surface), recMax = recoverMax(car, surface);
      const label = `${car} ${surface} tilt ${PH.tiltPct.join('/')}%`;
      checks.push({ name: `${label}: slide grows with tilt (≥ ${PH.tiltMinStepDeg}° a step)`, pass: sl.every((x, i) => i === 0 || x >= sl[i - 1] + PH.tiltMinStepDeg), detail: sl.map(x => f(x) + '°').join(' / ') });
      checks.push({ name: `${label}: part tilt steady (wobble ≤ ${PH.tiltWobbleMaxDeg}°)`, pass: Math.max(...part.map(r => r.wobbleDeg)) <= PH.tiltWobbleMaxDeg, detail: part.map(r => f(r.wobbleDeg) + '°').join(' / ') });
      checks.push({ name: `${car} ${surface}: ${PH.tiltHalfPct}% tilt slides ≤ ${PH.tiltHalfMaxShare}× full tilt`, pass: half.slideDeg <= PH.tiltHalfMaxShare * full.slideDeg, detail: `${f(half.slideDeg)}° vs ${f(full.slideDeg)}°` });
      checks.push({ name: `${label}: full tilt slide ${lo}–${hi}°, swing ≤ ${T.swingMaxDeg}°, back under 5° within ${recMax} s, ≤ ${T.overshootMaxDeg}° past straight`,
        pass: full.slideDeg >= lo && full.slideDeg <= hi && Math.max(...ts.map(r => r.swingDeg)) <= T.swingMaxDeg && ts.every(r => r.recoverS !== null && r.recoverS <= recMax) && Math.max(...ts.map(r => r.overshootDeg)) <= T.overshootMaxDeg,
        detail: `full ${f(full.slideDeg)}°, swing ${f(Math.max(...ts.map(r => r.swingDeg)))}°, back in ${ts.every(r => r.recoverS !== null) ? f(Math.max(...ts.map(r => r.recoverS)), 2) : 'never'} s, overshoot ${f(Math.max(...ts.map(r => r.overshootDeg)))}°` });
    }
    // auto gas: a brake tap swings the car round more than no tap, and never spins it
    for (const surface of T.driveSurfaces) {
      const no = mine.find(r => r.mode === 'autogas' && r.surface === surface && !r.tap), yes = mine.find(r => r.mode === 'autogas' && r.surface === surface && r.tap);
      const need = PH.brakeTapSurfaces.includes(surface);
      checks.push({ name: `${car} ${surface} auto gas ${PH.autoGasKmh} km/h: brake tap ${need ? `turns ≥ ${PH.brakeTapMinExtraTurnDeg}° more, ` : ''}never past ${T.spin.maxDeg}°, ≤ ${T.spin.over45S} s past 45°`,
        pass: (!need || yes.turnDeg >= no.turnDeg + PH.brakeTapMinExtraTurnDeg) && [no, yes].every(r => !r.spun && r.maxDeg <= T.spin.maxDeg && r.over45S <= T.spin.over45S),
        detail: `turned ${f(no.turnDeg)}° → ${f(yes.turnDeg)}° with the tap, peak slide ${f(yes.tapPeakDeg)}°, ${f(Math.max(no.over45S, yes.over45S), 2)} s past 45°` });
    }
  }
  // pairs: one car slides at least so many degrees more than another (average over the speeds), per surface
  for (const pr of T.slideMorePairs) if (cars.includes(pr.more) && cars.includes(pr.less)) for (const surface of pr.surfaces) {
    const avg = c => { const a = rows.filter(r => r.mode === 'held' && r.car === c && r.surface === surface).map(r => r.slideDeg); return a.reduce((x, y) => x + y, 0) / a.length; };
    const m = avg(pr.more), l = avg(pr.less);
    checks.push({ name: `${pr.more} slides ≥ ${pr.extraDeg}° more than ${pr.less} on ${surface}`, pass: m - l >= pr.extraDeg, detail: `${f(m)}° vs ${f(l)}° (+${f(m - l)}°)` });
  }
  return { checks, data: rows };
};
