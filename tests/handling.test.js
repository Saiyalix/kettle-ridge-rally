// (c) Handling targets on a flat skid pad of each surface, both cars:
//     slide from holding a key 2–10°, turn-in 67–100 ms (up to 80 km/h), turn-in the same on every surface,
//     no drift without handbrake or brake.
'use strict';
const { openGame } = require('./lib/game');
const skidpad = require('./lib/skidpad');

module.exports = async function handlingTest({ browser, base, expected }) {
  const T = expected.handling, checks = [], rows = [];
  const g = await openGame(browser, base, {});
  const carCount = await g.page.evaluate(() => CONFIG.cars.length);
  const run = a => g.page.evaluate(`(${skidpad.toString()})(${JSON.stringify(a)})`);
  for (let carIndex = 0; carIndex < carCount; carIndex++) {
    for (const surface of [...T.driveSurfaces, ...T.offRoadSurfaces]) {
      for (const kmh of T.offRoadSurfaces.includes(surface) ? [T.offRoadKmh] : T.speedsKmh) rows.push(await run({ surface, kmh, carIndex }));
    }
  }
  await g.ctx.close();
  const cars = [...new Set(rows.map(r => r.car))];
  for (const car of cars) {
    const mine = rows.filter(r => r.car === car);
    for (const surface of [...T.driveSurfaces, ...T.offRoadSurfaces]) {
      const rs = mine.filter(r => r.surface === surface);
      const lo = Math.min(...rs.map(r => r.slideDeg)), hi = Math.max(...rs.map(r => r.slideDeg));
      checks.push({ name: `${car} ${surface}: held-key slide ${T.slideDeg[0]}–${T.slideDeg[1]}°`, pass: lo >= T.slideDeg[0] && hi <= T.slideDeg[1],
        detail: `${lo.toFixed(1)}–${hi.toFixed(1)}° at ${rs.map(r => r.kmh).join('/')} km/h` });
      checks.push({ name: `${car} ${surface}: no drift from steering alone`, pass: rs.every(r => !r.drift), detail: rs.some(r => r.drift) ? 'a drift started' : 'none' });
    }
    for (const kmh of T.speedsKmh) {
      const rs = mine.filter(r => r.kmh === kmh && T.driveSurfaces.includes(r.surface));
      const w = rs.map(r => r.wheelMs), p = rs.map(r => r.pathMs);
      const wLo = Math.min(...w), wHi = Math.max(...w), pLo = Math.min(...p), pHi = Math.max(...p);
      if (kmh <= T.turnInUpToKmh) checks.push({ name: `${car} ${kmh} km/h: turn-in ${T.turnInMs[0]}–${T.turnInMs[1]} ms`, pass: wLo >= T.turnInMs[0] && wHi <= T.turnInMs[1], detail: `${wLo.toFixed(0)}–${wHi.toFixed(0)} ms` });
      checks.push({ name: `${car} ${kmh} km/h: turn-in same on all surfaces`, pass: wHi - wLo <= T.maxWheelSpreadMs && pHi - pLo <= T.maxPathSpreadMs,
        detail: `steering ${wLo.toFixed(0)}–${wHi.toFixed(0)} ms, car response ${pLo.toFixed(0)}–${pHi.toFixed(0)} ms` });
    }
  }
  return { checks, data: rows };
};
