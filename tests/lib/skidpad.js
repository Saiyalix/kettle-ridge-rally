// Skid pad: runs inside the page (page.evaluate). Uses the game's own Car class and CONFIG on a flat,
// endless pad of one surface, so the numbers are the car's behaviour and nothing else.
// mode 'held'      hold a steering key 3 s, then let go for 1.5 s (cruise throttle holds the speed all the time):
//                  slideDeg (steady slide while held), swingDeg (biggest slide while the key is held, the first swing-out),
//                  wheelMs (key press -> steering fully wound on), recoverS (letting go -> under 5 deg), overshootDeg
//                  (how far the car swings past straight after letting go), drift (the game's own "drifting" flag).
// mode 'spin'      full lock + full throttle for 4 s: maxDeg, over45S (seconds past 45 deg), spun (ever past 90 deg).
// mode 'handbrake' full lock, handbrake 0.4 s from t = 0.1 s, then 60% throttle: t90 (seconds until the nose has turned 90 deg), maxDeg, spun.
//                  autoGas: true = the throttle comes from the phone's auto gas instead (full gas except while/after the handbrake).
// Phone modes use the game's own phone code (tiltToSteer, autoGasOn, gasStep in src/handling/physics-step.js):
// mode 'tilt'      phone tilted to `pct` % of full lock (with a small hand shake) for 3 s, then back to centre for 1.5 s,
//                  cruise throttle: slideDeg, wobbleDeg (largest - smallest slide in the last held second), swingDeg,
//                  steer (average steering it gave), recoverS, overshootDeg (as in 'held').
// mode 'autogas'   phone: auto gas (full throttle) and the right button held; a brake tap (0.15 s) at t = 1.5 s:
//                  slideDeg (before the tap), tapPeakDeg (biggest slide in the 1.5 s after it), turnDeg (heading change in
//                  those 1.5 s), maxDeg, over45S (seconds past 45 deg), spun. tap: false = the same run without the tap (for comparison).
module.exports = function skidpad({ mode, surface, kmh, carIndex, pct, tap = true, autoGas = false }) {
  // Car and CONFIG come from the probe (works when the game script is a module and they are not globals)
  const probe = window.__probe || window, { Car, CONFIG } = probe;
  const pads = { gas: 0, tilt: 0, lift: 0, brakeS: 0 };                  // the phone controls' own state for this run
  const prevCar = CONFIG.carIndex; CONFIG.carIndex = carIndex;
  const world = { groundAt(x, z, o) { o.h = 0; o.n.set(0, 1, 0); }, surfaceAt() { return surface; } };
  const car = new Car(); car.reset(0, 0.75, 0, 0);
  const H = 1 / CONFIG.physicsHz, inp = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const target = kmh / 3.6, DEG = 180 / Math.PI;
  const cruise = () => { inp.throttle = car.vForward < target ? 1 : 0; };
  const step = () => { car.prevPos.copy(car.pos); car.prevQ.copy(car.q); car.step(H, inp, world); };
  for (let k = 0; k < 120; k++) step();                                  // settle on the springs
  car.vel.set(0, 0, target); for (const w of car.wheels) w.omega = target / CONFIG.wheels.radius;
  for (let k = 0; k < 180; k++) { cruise(); step(); }                    // 1.5 s straight at speed
  const base = { mode, surface, kmh, car: CONFIG.cars[carIndex].name };
  let res;
  if (mode === 'held') {
    const samples = []; let drift = false, wheelMs = null;
    inp.steer = 1;                                                        // hold "right"
    for (let k = 1; k <= Math.round(4.5 / H); k++) {
      const t = k * H;
      if (t > 3) inp.steer = 0;                                           // let go
      cruise(); step();
      samples.push({ t, beta: car.beta * DEG });
      if (wheelMs === null && Math.abs(car.steerIn) >= 0.999) wheelMs = t * 1000;
      if (t <= 3 && car.drift) drift = true;
    }
    const held = samples.filter(s => s.t <= 3), tail = held.filter(s => s.t > 2);
    const sgn = Math.sign(tail.reduce((a, s) => a + s.beta, 0)) || 1;
    const slideDeg = tail.reduce((a, s) => a + Math.abs(s.beta), 0) / tail.length;
    const swingDeg = Math.max(...held.map(s => Math.abs(s.beta)));
    const after = samples.filter(s => s.t > 3);
    const back = after.find(s => Math.abs(s.beta) < 5);
    res = { slideDeg, swingDeg, wheelMs, drift, recoverS: back ? back.t - 3 : null, overshootDeg: Math.max(0, ...after.map(s => -sgn * s.beta)) };
  } else if (mode === 'spin') {
    let maxDeg = 0, over45 = 0, spun = false;
    inp.steer = 1; inp.throttle = 1;
    for (let k = 1; k <= Math.round(4 / H); k++) {
      step(); const b = Math.abs(car.beta) * DEG;
      maxDeg = Math.max(maxDeg, b); if (b > 45) over45 += H; if (b > 90) spun = true;
    }
    res = { maxDeg, over45S: over45, spun };
  } else if (mode === 'tilt') {
    const full = CONFIG.arcade.phone.tiltFull, samples = [];
    let deg = 0;
    for (let k = 1; k <= Math.round(4.5 / H); k++) {
      const t = k * H;
      // the sensor updates at 60 Hz; a hand shakes about ±1.4°
      if (k % 2 === 0) deg = (t > 3 ? 0 : full * pct / 100) + 0.8 * Math.sin(2 * Math.PI * 6 * t) + 0.6 * Math.sin(2 * Math.PI * 1.3 * t + 1);
      inp.steer = probe.tiltToSteer(deg, H, pads);
      cruise(); step();
      samples.push({ t, beta: car.beta * DEG, steer: inp.steer });
    }
    const held = samples.filter(s => s.t <= 3), tail = held.filter(s => s.t > 2), sl = tail.map(s => Math.abs(s.beta));
    const sgn = Math.sign(tail.reduce((a, s) => a + s.beta, 0)) || 1;
    const after = samples.filter(s => s.t > 3), back = after.find(s => Math.abs(s.beta) < 5);
    res = { pct, slideDeg: sl.reduce((a, x) => a + x, 0) / sl.length, wobbleDeg: Math.max(...sl) - Math.min(...sl),
      swingDeg: Math.max(...held.map(s => Math.abs(s.beta))), steer: tail.reduce((a, s) => a + s.steer, 0) / tail.length,
      recoverS: back ? back.t - 3 : null, overshootDeg: Math.max(0, ...after.map(s => -sgn * s.beta)) };
  } else if (mode === 'autogas') {
    let slideSum = 0, slideN = 0, tapPeakDeg = 0, maxDeg = 0, spun = false, yaw0 = null, over45 = 0;
    pads.gas = 1;                                                         // auto gas was already down
    inp.steer = 1;
    for (let k = 1; k <= Math.round(3 / H); k++) {
      const t = k * H;
      inp.brake = tap && t > 1.5 && t <= 1.65 ? 1 : 0;
      inp.throttle = probe.gasStep(probe.autoGasOn(inp.brake > 0, false, H, pads) ? 1 : 0, H, pads);
      step();
      const b = Math.abs(car.beta) * DEG, y = Math.atan2(car.fwd.x, car.fwd.z);
      if (t > 1 && t <= 1.5) { slideSum += b; slideN++; }
      if (t > 1.5) tapPeakDeg = Math.max(tapPeakDeg, b);
      if (yaw0 === null && t > 1.5) yaw0 = y;
      maxDeg = Math.max(maxDeg, b); if (b > 90) spun = true; if (b > 45) over45 += H;
    }
    const y1 = Math.atan2(car.fwd.x, car.fwd.z);
    res = { tap, slideDeg: slideSum / slideN, tapPeakDeg, turnDeg: Math.abs(Math.atan2(Math.sin(y1 - yaw0), Math.cos(y1 - yaw0))) * DEG, maxDeg, over45S: over45, spun, endKmh: car.speed * 3.6 };
  } else {
    let yaw = null, tot = 0, t90 = null, maxDeg = 0, spun = false;
    inp.steer = 1;
    for (let k = 1; k <= Math.round(2.5 / H); k++) {
      const t = k * H;
      inp.handbrake = t > 0.1 && t < 0.5;
      inp.throttle = autoGas ? probe.gasStep(probe.autoGasOn(false, inp.handbrake, H, pads) ? 1 : 0, H, pads) : t >= 0.5 ? 0.6 : 0;
      step();
      const y = Math.atan2(car.fwd.x, car.fwd.z);
      if (yaw !== null) tot += Math.atan2(Math.sin(y - yaw), Math.cos(y - yaw)); yaw = y;
      if (t90 === null && Math.abs(tot) > Math.PI / 2) t90 = t;
      const b = Math.abs(car.beta) * DEG; maxDeg = Math.max(maxDeg, b); if (b > 90) spun = true;
    }
    res = { autoGas, t90, maxDeg, spun };
  }
  CONFIG.carIndex = prevCar;
  return Object.assign(base, res);
};
