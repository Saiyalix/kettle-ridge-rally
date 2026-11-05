// Skid pad: runs inside the page (page.evaluate). Uses the game's own Car class and CONFIG on a flat,
// endless pad of one surface, so the numbers are the car's behaviour and nothing else.
// Returns, for one surface + speed + car:
//   slideDeg     steady slide angle while a steering key is held (car angle vs. direction of travel)
//   wheelMs      key press → steering fully wound on (what the "turn-in 67-100 ms" target refers to)
//   pathMs       key press → the direction of travel turning at 90% of its steady rate (how it feels)
//   drift        whether a drift started (must never happen: no handbrake, no brake)
//   radiusM      steady turning radius
module.exports = function skidpad({ surface, kmh, carIndex }) {
  // Car and CONFIG come from the probe (works when the game script is a module and they are not globals)
  const { Car, CONFIG } = window.__probe || window;
  const prevCar = CONFIG.carIndex; CONFIG.carIndex = carIndex;
  const world = { groundAt(x, z, o) { o.h = 0; o.n.set(0, 1, 0); }, surfaceAt() { return surface; } };
  const car = new Car(); car.reset(0, 0.75, 0, 0);
  const H = 1 / CONFIG.physicsHz, inp = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const target = kmh / 3.6;
  const cruise = () => { inp.throttle = car.vForward < target ? 1 : 0; };
  const step = () => { car.prevPos.copy(car.pos); car.prevQ.copy(car.q); car.step(H, inp, world); };
  for (let k = 0; k < 120; k++) step();                                  // settle on the springs
  car.vel.set(0, 0, target); for (const w of car.wheels) w.omega = target / CONFIG.wheels.radius;
  for (let k = 0; k < 180; k++) { cruise(); step(); }                    // 1.5 s straight at speed
  const heading = () => Math.atan2(car.vel.x, car.vel.z);
  const samples = []; let drift = false, prevH = heading(), wheelMs = null;
  inp.steer = 1;                                                          // hold "right"
  const N = Math.round(3 / H);
  for (let k = 1; k <= N; k++) {
    cruise(); step();
    const h = heading(); let d = h - prevH; d = Math.atan2(Math.sin(d), Math.cos(d)); prevH = h;
    samples.push({ t: k * H, rate: Math.abs(d) / H, beta: Math.abs(car.beta), v: car.speed });
    if (wheelMs === null && Math.abs(car.steerIn) >= 0.999) wheelMs = k * H * 1000;
    if (car.drift) drift = true;
  }
  const tail = samples.slice(-Math.round(1 / H));                         // last second = steady state
  const avg = f => tail.reduce((a, s) => a + f(s), 0) / tail.length;
  const rateSS = avg(s => s.rate), vSS = avg(s => s.v);
  const hit = samples.find(s => s.rate >= 0.9 * rateSS);
  CONFIG.carIndex = prevCar;
  return { surface, kmh, car: CONFIG.cars[carIndex].name, slideDeg: avg(s => s.beta) * 180 / Math.PI,
    wheelMs, pathMs: hit ? hit.t * 1000 : null, drift, radiusM: rateSS > 1e-4 ? vSS / rateSS : null, endKmh: vSS * 3.6 };
};
