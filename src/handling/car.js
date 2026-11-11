/* =====================================================================
   VEHICLE PHYSICS: rigid body + four raycast wheels
   ===================================================================== */
const _M = new THREE.Vector3(), _P = new THREE.Vector3(), _r = new THREE.Vector3(), _vP = new THREE.Vector3(),
  _fw = new THREE.Vector3(), _rw = new THREE.Vector3(), _F = new THREE.Vector3(), _t = new THREE.Vector3(),
  _qInv = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _g = { h: 0, n: new THREE.Vector3() };
const _ag = new THREE.Vector3(), _af = new THREE.Vector3(), _ar = new THREE.Vector3(), _aF = new THREE.Vector3(), _aP = new THREE.Vector3(), _Yup = new THREE.Vector3(0, 1, 0);
const _aT = new THREE.Vector3(), _aL = new THREE.Vector3(), _aD = new THREE.Vector3(), _aV = new THREE.Vector3();

const BODY_POINTS = [];
for (const x of [-0.86, 0.86]) for (const y of [-0.32, 0.62]) for (const z of [-2.0, 2.0]) BODY_POINTS.push(new THREE.Vector3(x, y, z));
BODY_POINTS.push(new THREE.Vector3(0, 0.82, 0), new THREE.Vector3(0, -0.32, 0));

function torqueAt(rpm) {
  const c = CONFIG.engine.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  return c[c.length - 1][1];
}

class Car {
  constructor() {
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.q = new THREE.Quaternion(); this.angVel = new THREE.Vector3();
    this.force = new THREE.Vector3(); this.torque = new THREE.Vector3();
    this.fwd = new THREE.Vector3(); this.up = new THREE.Vector3(); this.right = new THREE.Vector3();
    const W = CONFIG.wheels;
    this.wheels = [[W.trackHalf, W.frontZ, true], [-W.trackHalf, W.frontZ, true], [W.trackHalf, W.rearZ, false], [-W.trackHalf, W.rearZ, false]]
      .map(([x, z, front]) => ({
        local: new THREE.Vector3(x, W.mountY, z), front, omega: 0, spin: 0, comp: 0, prevComp: 0, compVel: 0,
        contact: false, susp: CONFIG.suspension.restLength, load: 0, surface: 'tarmac', slipSpeed: 0,
        point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), vLong: 0, Ieff: CONFIG.wheels.inertia,
      }));
    this.steer = 0; this.gear = 1; this.rpm = CONFIG.engine.idleRpm; this.shiftTimer = 0; this.reverseTimer = 0;
    this.speed = 0; this.vForward = 0; this.throttleOut = 0; this.frontPeak = 8 * D2R;
    this.brakeIn = 0;
    this.steerIn = 0; this.drift = false; this.driftDir = 0; this.driftBlend = 0; this.driftNeutral = 0; this.driftCounter = 0; this.driftKick = 0;
    this.beta = 0; this.grounded = 1; this.groundS = 1; this.airTime = 0; this.surfS = null; this.loadF = 1; this.loadR = 1; this.prevBeta = 0; this.betaRate = 0; this.driftBoost = 0; this.driftSide = 0; this.prevBrakeKey = 0;
    this.lastVel = new THREE.Vector3(); this.vis = { roll: 0, pitch: 0, heave: 0, rollV: 0, pitchV: 0, heaveV: 0, init: false };   // visual body attitude
    this.dbg = { gripUse: 0, traction: 1, yawT: 0, yawNow: 0, drift: false };
    this.prevPos = new THREE.Vector3(); this.prevQ = new THREE.Quaternion();      // for smooth rendering between physics steps
  }

  reset(x, y, z, heading) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.prevPos.copy(this.pos); this.prevQ.copy(this.q);
    for (const w of this.wheels) { w.omega = 0; w.comp = w.prevComp = w.compVel = 0; }
    this.gear = 1; this.steer = 0; this.shiftTimer = 0; this.brakeIn = 0;
    this.steerIn = 0; this.drift = false; this.driftDir = 0; this.driftBlend = 0; this.driftNeutral = 0; this.driftCounter = 0; this.driftKick = 0;
    this.beta = 0; this.groundS = 1; this.airTime = 0; this.surfS = null; this.loadF = 1; this.loadR = 1; this.prevBeta = 0; this.betaRate = 0; this.driftBoost = 0; this.driftSide = 0; this.prevBrakeKey = 0;
    this.lastVel.set(0, 0, 0); Object.assign(this.vis, { roll: 0, pitch: 0, heave: 0, rollV: 0, pitchV: 0, heaveV: 0, init: false });
  }

  addForceAt(F, P) {
    this.force.add(F);
    _r.subVectors(P, this.pos);
    this.torque.add(_t.crossVectors(_r, F));
  }

  pointVelocity(P, out) {
    _r.subVectors(P, this.pos);
    return out.crossVectors(this.angVel, _r).add(this.vel);
  }

  step(dt, inp, world) {
    const C = CONFIG, S = C.suspension, T = C.tyre, W = C.wheels, E = C.engine, B = C.brakes, ST = C.steering;
    const m = C.car.mass, R = W.radius, arcade = C.model === 'arcade';
    this.force.set(0, 0, 0); this.torque.set(0, 0, 0);

    // Local axes in world space. Car forward is local +z, right is local -x.
    const fwd = this.fwd.set(0, 0, 1).applyQuaternion(this.q);
    const up = this.up.set(0, 1, 0).applyQuaternion(this.q);
    const right = this.right.crossVectors(fwd, up);
    const vF = this.vel.dot(fwd), speed = this.vel.length();
    this.vForward = vF; this.speed = speed;

    /* --- Pedals and reverse: holding brake at a standstill selects reverse --- */
    const gas = inp.throttle;
    // Keyboard brake builds pressure over pedalRampTime instead of slamming to 100%
    const rampRate = dt / Math.max(0.001, B.pedalRampTime);
    this.brakeIn = inp.brake > this.brakeIn ? Math.min(inp.brake, this.brakeIn + rampRate) : Math.max(inp.brake, this.brakeIn - rampRate * 2);
    const brk = this.brakeIn;
    if (this.gear > 0) {
      if (inp.brake > 0 && gas === 0 && vF < 0.6) { this.reverseTimer += dt; if (this.reverseTimer > 0.25) { this.gear = -1; this.reverseTimer = 0; } } else this.reverseTimer = 0;
    } else {
      if (gas > 0 && vF > -0.6) { this.reverseTimer += dt; if (this.reverseTimer > 0.12) { this.gear = 1; this.reverseTimer = 0; } } else this.reverseTimer = 0;
    }
    const throttle = this.gear > 0 ? gas : brk * 0.7;
    const brake = this.gear > 0 ? brk : gas;
    const hold = throttle === 0 && speed < 0.8;   // driver keeps a foot on the brake when stopped
    this.throttleOut = throttle;

    /* --- Steering ---
       At low speed a key gives plain wheel angle up to full lock. At speed, a held key aims the front
       tyres at their peak-grip slip angle relative to the direction the front axle is travelling, like a
       driver feeding in just enough lock. That keeps the fronts biting instead of scrubbing, and steering
       the other way in a slide is real countersteer. The rear still slides, the car can still spin.
       No input: the wheels follow the travel direction a little (caster self-aligning). */
    const maxLock = ST.maxLockDeg * D2R;
    const sf = clamp((Math.abs(vF) - ST.slipSteerFrom) / (ST.slipSteerFull - ST.slipSteerFrom), 0, 1) * (vF > 0 ? 1 : 0);
    let travel = 0;
    if (sf > 0) {
      _P.copy(fwd).multiplyScalar(W.frontZ).add(this.pos);
      this.pointVelocity(_P, _vP);
      travel = clamp(Math.atan2(_vP.dot(right), Math.max(_vP.dot(fwd), 1)), -maxLock, maxLock);
    }
    let slipLock = this.frontPeak * ST.slipSteer;
    // Countersteering (key pointing the same way the front axle is sliding): aim softer so it catches
    // the slide instead of whipping the car into a slide the other way
    if (inp.steer * travel > 0) slipLock *= 1 - (1 - ST.countersteerAim) * clamp(Math.abs(travel) / (8 * D2R), 0, 1);
    const lowSpeedTarget = inp.steer * maxLock;
    const highSpeedTarget = travel * ST.selfAlign * (1 - Math.abs(inp.steer)) + (travel + slipLock * Math.sign(inp.steer)) * Math.abs(inp.steer);
    const target = clamp(lowSpeedTarget + (highSpeedTarget - lowSpeedTarget) * sf, -maxLock, maxLock);
    const returning = Math.abs(target) < Math.abs(this.steer) || target * this.steer < 0;
    const rate = (returning ? ST.returnSpeed : ST.steerSpeed) * dt;
    this.steer += clamp(target - this.steer, -rate, rate);

    /* --- Engine and gearbox (sequential, automatic) --- */
    const DT = C.drivetrain, rearOpen = inp.handbrake;   // hydraulic handbrake opens the centre diff
    const ratio = this.gear > 0 ? E.gears[this.gear - 1] * E.finalDrive : -E.reverseRatio * E.finalDrive;
    const w0 = this.wheels;
    const avgW = rearOpen ? (w0[0].omega + w0[1].omega) / 2 : (w0[0].omega + w0[1].omega + w0[2].omega + w0[3].omega) / 4;
    const toRpm = Math.abs(ratio) * 60 / (2 * Math.PI);
    const wheelRpm = Math.abs(avgW) * toRpm;
    const roadRpm = speed / R * toRpm;                     // engine rpm at this road speed with no wheelspin (whole speed, so a big slide doesn't drop it into 1st)
    let rpm = Math.max(wheelRpm, E.idleRpm);
    if ((this.gear === 1 || this.gear === -1) && throttle > 0) rpm = Math.max(rpm, E.idleRpm + throttle * 2800); // clutch slip at launch
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 22);

    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const clutchIn = brake > 0.3 && throttle === 0;        // driver dips the clutch under hard braking
    const engaged = this.shiftTimer <= 0 && !clutchIn;
    let driveT = 0;
    if (engaged) {
      if (rpm < E.redlineRpm) driveT = torqueAt(rpm) * throttle * ratio * E.efficiency;
      driveT -= Math.sign(avgW) * (1 - throttle) * E.engineBrakeTorque * Math.min(1, wheelRpm / E.redlineRpm) * Math.abs(ratio) * E.efficiency;
    }
    // Shift points follow road speed, so wheelspin in a power slide bounces off the limiter instead of
    // changing up and killing the slide. A little wheelspin still counts (30%).
    const shiftRpm = roadRpm * 0.7 + wheelRpm * 0.3;
    if (!arcade && this.gear > 0 && this.shiftTimer <= 0) {
      if (shiftRpm > E.shiftUpRpm && this.gear < E.gears.length) { this.gear++; this.shiftTimer = E.shiftTime; }
      else if (roadRpm < E.shiftDownRpm && this.gear > 1) {
        const next = roadRpm * E.gears[this.gear - 2] / E.gears[this.gear - 1];
        if (next < E.shiftUpRpm - 600) { this.gear--; this.shiftTimer = E.shiftTime * 0.7; }
      }
    }

    /* --- Differentials: split drive torque, then let each diff lock move torque to the slower side --- */
    const Ieng = engaged ? E.inertia * ratio * ratio / 4 : 0;           // engine inertia felt at each wheel
    for (const w of w0) w.Ieff = W.inertia + ((rearOpen && !w.front) ? 0 : Ieng);
    const Tf = rearOpen ? driveT : driveT * (1 - DT.rearTorqueBias);
    const Tr = rearOpen ? 0 : driveT * DT.rearTorqueBias;
    const tq = [Tf / 2, Tf / 2, Tr / 2, Tr / 2];
    if (!rearOpen) {
      const If = w0[0].Ieff + w0[1].Ieff, Ir = w0[2].Ieff + w0[3].Ieff;
      const dW = (w0[0].omega + w0[1].omega - w0[2].omega - w0[3].omega) / 2;
      const lim = DT.centre.preload + DT.centre.lock * Math.abs(driveT);
      const Tc = clamp(0.5 * dW / (dt * (1 / If + 1 / Ir)), -lim, lim);     // torque that would close half the gap this step
      tq[0] -= Tc / 2; tq[1] -= Tc / 2; tq[2] += Tc / 2; tq[3] += Tc / 2;
    }
    for (const [a, b, D, Tin] of [[0, 1, DT.front, Tf], [2, 3, DT.rear, Tr]]) {
      const wa = w0[a], wb = w0[b];
      const lim = D.preload + (Tin >= 0 ? D.powerLock : D.coastLock) * Math.abs(Tin);
      const Tl = clamp(0.5 * (wa.omega - wb.omega) / (dt * (1 / wa.Ieff + 1 / wb.Ieff)), -lim, lim);
      tq[a] -= Tl; tq[b] += Tl;
    }

    /* --- Pass 1: suspension raycasts --- */
    const maxT = S.restLength + R;
    for (const w of this.wheels) {
      _M.copy(w.local).applyQuaternion(this.q).add(this.pos);      // suspension mount in world space
      let t = maxT, px = _M.x, pz = _M.z;
      if (up.y > 0.15) {
        // the ray goes along -up; solve M.y - up.y*t = ground height (3 fixed-point iterations)
        t = 0;
        for (let k = 0; k < 3; k++) { px = _M.x - up.x * t; pz = _M.z - up.z * t; world.groundAt(px, pz, _g); t = (_M.y - _g.h) / up.y; }
      }
      const comp = (up.y > 0.15 && t < maxT) ? Math.min(maxT - t, S.travel + 0.2) : 0;   // capped for the same reason
      w.contact = comp > 0;
      w.compVel = (comp - w.prevComp) / dt;
      w.prevComp = w.comp = comp;
      w.susp = clamp(t - R, S.restLength - S.travel - 0.04, S.restLength);
      if (w.contact) {
        w.point.set(px, _g.h, pz); w.normal.copy(_g.n);
        w.surface = world.surfaceAt(px, pz);
      }
    }

    /* --- Pass 2: forces per wheel --- */
    const N0 = m * C.gravity / 4;
    const arbF = (w0[0].comp - w0[1].comp) * S.antiRollFront, arbR = (w0[2].comp - w0[3].comp) * S.antiRollRear;
    const arb = [arbF, -arbF, arbR, -arbR];
    let peakSum = 0, peakN = 0;

    for (let i = 0; i < 4; i++) {
      const w = w0[i];
      const Tdrive = tq[i];
      let Tb = brake * (w.front ? B.frontTorque : B.rearTorque);
      if (!w.front && inp.handbrake) Tb = Math.max(Tb, B.handbrakeTorque);
      if (hold) Tb = Math.max(Tb, 500);

      if (!w.contact) {
        w.load = 0; w.slipSpeed = 0;
        this.integrateWheel(w, Tdrive, Tb, 0, 0, 0, dt);
        continue;
      }

      // Spring + damper + anti-roll bar + bump stop. Load shifts emerge from body pitch and roll.
      const k = w.front ? S.springFront : S.springRear;
      const c = w.compVel > 0 ? S.damperBump : S.damperRebound;
      let Fs = k * w.comp + c * w.compVel + arb[i];
      if (w.comp > S.travel) Fs += (w.comp - S.travel) * S.bumpStop;
      const N = Math.max(0, Fs);
      w.load = N;
      _F.copy(up).multiplyScalar(N);
      this.addForceAt(_F, w.point);
      if (arcade) continue;                                    // arcade: driving forces are applied to the body below

      // Wheel direction projected onto the ground plane
      const sa = w.front ? this.steer : 0;
      _fw.copy(fwd).multiplyScalar(Math.cos(sa)).addScaledVector(right, Math.sin(sa));
      _fw.addScaledVector(w.normal, -_fw.dot(w.normal)).normalize();
      _rw.crossVectors(_fw, w.normal);

      this.pointVelocity(w.point, _vP);
      const vLong = _vP.dot(_fw), vLat = _vP.dot(_rw);
      w.vLong = vLong;

      // This surface's tyre curve
      const surf = C.surfaces[w.surface];
      const peakRatio = surf.peakSlipRatio, peakAlpha = surf.peakSlipAngleDeg * D2R;
      const Csh = Math.min(1.9, 1 + (surf.falloff - 1) * (w.front ? T.frontFalloff : T.rearFalloff));
      const Bsh = Math.tan(Math.PI / (2 * Csh));
      if (w.front) { peakSum += peakAlpha; peakN++; }

      // Slip ratio (wheel spin vs ground speed) and slip angle (sideways sliding)
      const denom = Math.max(Math.abs(vLong), T.minSpeedLong);
      const slip = (w.omega * R - vLong) / denom;
      const alpha = Math.atan2(vLat, Math.max(Math.abs(vLong), T.minSpeedLat));

      // Combined slip: normalise both by their peak, so braking + cornering share one friction circle
      const loadFactor = clamp(1 - T.loadSensitivity * (N / N0 - 1), 0.6, 1.15);
      const muN = N * T.baseGrip * surf.grip * loadFactor;
      const sx = slip / peakRatio, sy = alpha / peakAlpha;
      const rho = Math.hypot(sx, sy);
      let Fx = 0, Fy = 0;
      if (rho > 1e-6) {
        const Fmag = muN * Math.sin(Csh * Math.atan(Bsh * rho)); // simplified Pacejka curve, peak at rho = 1
        Fx = Fmag * sx / rho;
        Fy = -Fmag * sy / rho;
      }
      _F.copy(_fw).multiplyScalar(Fx).addScaledVector(_rw, Fy);
      if (surf.drag) { _F.addScaledVector(_fw, -vLong * surf.drag).addScaledVector(_rw, -vLat * surf.drag); }
      this.addForceAt(_F, w.point);

      w.slipSpeed = Math.hypot(w.omega * R - vLong, vLat);
      if (B.lockUpLimit && Tb > 0 && !(inp.handbrake && !w.front) && Math.abs(vLong) > 1.5) {
        const over = (-slip - peakRatio * 1.15) / (peakRatio * 0.6);   // 0 at the grip peak, 1 well into lock-up
        if (over > 0) Tb *= clamp(1 - over, 0.15, 1);
      }
      const kSlip = muN * Csh * Bsh / (peakRatio * denom) * R;   // dFx/dω, used for a stable implicit wheel update
      this.integrateWheel(w, Tdrive, Tb, Fx, kSlip, N * T.rollingResistance * surf.rolling, dt);
    }
    if (peakN) this.frontPeak = peakSum / peakN;
    if (arcade) this.arcadeForces(dt, inp, throttle, brake, fwd, up);

    /* --- Stability aid: only acts in big slides that are still growing --- */
    if (!arcade && C.car.stability > 0 && speed > 5) {
      const beta = Math.atan2(this.vel.dot(right), Math.max(Math.abs(vF), 0.5));
      const yawUp = this.angVel.dot(up);
      const over = clamp((Math.abs(beta) - C.car.stabilityAngle * D2R) / (25 * D2R), 0, 1);
      if (over > 0 && beta * yawUp > 0) this.torque.addScaledVector(up, -C.car.stability * over * yawUp * C.car.inertia.yaw * 6);
    }

    /* --- Gravity and aerodynamics --- */
    const A = C.aero;
    this.force.y -= m * C.gravity;
    if (!arcade) this.force.addScaledVector(this.vel, -0.5 * A.airDensity * A.dragCdA * speed);
    this.force.addScaledVector(up, -0.5 * A.airDensity * A.downforceClA * vF * vF);

    /* --- Chassis touching the ground (big landings, rollovers) --- */
    const BC = C.body;
    // Many points touching at once (car on its side on a slope) would make the contact springs too stiff
    // for the time step, so their strength is shared out between the touching points
    let touching = 0;
    for (const lp of BODY_POINTS) { _P.copy(lp).applyQuaternion(this.q).add(this.pos); if (world.groundAt(_P.x, _P.z, _g), _g.h > _P.y) touching++; }
    const share = Math.min(1, 3 / Math.max(1, touching));
    for (const lp of BODY_POINTS) {
      _P.copy(lp).applyQuaternion(this.q).add(this.pos);
      world.groundAt(_P.x, _P.z, _g);
      const depth = Math.min(_g.h - _P.y, 0.5);           // capped: next to a cliff the ground grid jumps steeply
      if (depth <= 0) continue;
      this.pointVelocity(_P, _vP);
      const vn = _vP.dot(_g.n);
      const Fn = Math.min(40000, Math.max(0, (BC.contactStiffness * depth - BC.contactDamping * vn) * share));
      _F.copy(_g.n).multiplyScalar(Fn);
      _vP.addScaledVector(_g.n, -vn);                       // tangential sliding velocity
      const vt = _vP.length();
      if (vt > 0.01) _F.addScaledVector(_vP, -Math.min(BC.contactFriction * Fn, vt * 2500) / vt);
      this.addForceAt(_F, _P);
    }

    /* --- Integrate the rigid body (semi-implicit Euler) --- */
    this.vel.addScaledVector(this.force, dt / m);
    this.pos.addScaledVector(this.vel, dt);
    const I = C.car.inertia;
    _qInv.copy(this.q).invert();
    const wb = _t.copy(this.angVel).applyQuaternion(_qInv);
    const tb = this.torque.applyQuaternion(_qInv);
    const Ix = I.pitch, Iy = arcade ? I.yaw / ((C.cars[C.carIndex] || C.cars[0]).turn || 1) : I.yaw, Iz = I.roll;
    const gx = wb.y * (Iz * wb.z) - wb.z * (Iy * wb.y);      // gyroscopic term ω × Iω
    const gy = wb.z * (Ix * wb.x) - wb.x * (Iz * wb.z);
    const gz = wb.x * (Iy * wb.y) - wb.y * (Ix * wb.x);
    wb.x += dt * (tb.x - gx) / Ix; wb.y += dt * (tb.y - gy) / Iy; wb.z += dt * (tb.z - gz) / Iz;
    this.angVel.copy(wb).applyQuaternion(this.q).multiplyScalar(1 - 0.05 * dt);
    if (this.angVel.lengthSq() > 400) this.angVel.setLength(20);     // sanity caps for violent crashes
    if (this.vel.lengthSq() > 8100) this.vel.setLength(90);
    _dq.set(this.angVel.x * dt * 0.5, this.angVel.y * dt * 0.5, this.angVel.z * dt * 0.5, 0).multiply(this.q);
    this.q.x += _dq.x; this.q.y += _dq.y; this.q.z += _dq.z; this.q.w += _dq.w; this.q.normalize();

    for (const w of this.wheels) w.spin += w.omega * dt;
    if (arcade) this.updateBodyPose(dt);
  }

  /* ARCADE DRIVING (90s arcade rally style): a two-axle car with simple, forgiving tyres.
     - Steering: at speed a held key asks the front tyres for grip towards that side, measured from where the
       front axle is travelling. No key = the wheels follow the slide (automatic countersteer).
     - Each axle has a grip limit from the surface, the car and the load on it (weight transfer comes from the
       suspension). When the rear runs out first the tail swings out by itself: loose surfaces, speed,
       throttle (power slide), a brake tap or lifting off (weight forward) and the handbrake all make that happen.
     - As the slide grows, a held key asks for less front grip (`slideHold`), so the slide settles at an angle
       set by surface and car instead of spinning. The spin guard stops the rest.
     - The engine pushes along the car's nose, so in a slide throttle drives the car round the corner and keeps
       its speed. Brakes and drag act along the direction of travel. */
  arcadeForces(dt, inp, throttle, brake, fwd, up) {
    const A = CONFIG.arcade, D = A.drift, CAR = CONFIG.cars[CONFIG.carIndex] || CONFIG.cars[0], m = CONFIG.car.mass, g = CONFIG.gravity, R = CONFIG.wheels.radius;
    const a = CONFIG.wheels.frontZ, b = -CONFIG.wheels.rearZ, L = a + b, Iy = CONFIG.car.inertia.yaw / (CAR.turn || 1);
    const w0 = this.wheels;

    // --- Ground contact and surface. Smoothed so a bump or a wheel on the verge doesn't make the grip flicker.
    let nC = 0, maxG = 0, top = 0, drag = 0, rear = 0, peak = 0, slide = 0;
    _ag.set(0, 0, 0);
    for (const w of w0) if (w.contact) {
      nC++; _ag.add(w.normal);
      const sp = A.surfaces[w.surface] || A.surfaces.gravel;
      maxG += sp.maxG; top += sp.top; drag += sp.drag; rear += sp.rear; peak += sp.peak; slide += sp.slide;
    }
    if (!this.surfS) { const s0 = A.surfaces.gravel; this.surfS = { maxG: s0.maxG, top: s0.top, drag: s0.drag, rear: s0.rear, peak: s0.peak, slide: s0.slide }; }
    const SS = this.surfS;
    if (nC) {
      const k = Math.min(1, dt * 10);
      SS.maxG += (maxG / nC - SS.maxG) * k; SS.top += (top / nC - SS.top) * k; SS.drag += (drag / nC - SS.drag) * k;
      SS.rear += (rear / nC - SS.rear) * k; SS.peak += (peak / nC - SS.peak) * k; SS.slide += (slide / nC - SS.slide) * k;
      _ag.normalize();
    } else _ag.copy(up);
    const contact = nC >= 2 ? 1 : nC === 1 ? 0.5 : 0;
    this.groundS += (contact - this.groundS) * Math.min(1, dt * (contact > this.groundS ? 30 : 12));
    const ground = this.groundS; this.grounded = nC / 4;
    this.airTime = nC ? 0 : this.airTime + dt;
    const n = _ag;

    // --- Load on each axle, from the springs (smoothed): braking loads the front, a crest makes the car light
    const Nf0 = m * g * b / L, Nr0 = m * g * a / L;
    const kL = Math.min(1, dt * 20);
    this.loadF += ((w0[0].load + w0[1].load) / Nf0 - this.loadF) * kL;
    this.loadR += ((w0[2].load + w0[3].load) / Nr0 - this.loadR) * kL;
    // weight transfer between the axles, scaled by weightShift (total load unchanged)
    const tot = (this.loadF * Nf0 + this.loadR * Nr0) / (Nf0 + Nr0);
    const lf = clamp(tot + (this.loadF - tot) * A.weightShift, 0, 1.7), lr = clamp(tot + (this.loadR - tot) * A.weightShift, 0, 1.7);

    // Ground-plane frame: forward, right and left of the car; speed along and across
    const fG = _af.copy(fwd).addScaledVector(n, -fwd.dot(n)).normalize();
    const rG = _ar.crossVectors(fG, n);
    const lG = _aL.copy(rG).negate();
    const vF = this.vel.dot(fG), vL = this.vel.dot(rG), speed = Math.hypot(vF, vL);
    // slide angle: + = the car is moving to its right, i.e. its nose points left of where it is going
    const beta = speed > 0.5 ? Math.atan2(vL, Math.max(Math.abs(vF), 1.5)) * (vF >= 0 ? 1 : -1) : 0;
    this.beta = beta;
    const r = this.angVel.dot(n);                                       // rotation, + = turning left

    // --- Steering input, smoothed so a key press feels like turning a wheel (same on every surface)
    const sTarget = inp.steer;
    let sRate;
    if (sTarget !== 0 && this.steerIn !== 0 && Math.sign(sTarget) !== Math.sign(this.steerIn)) sRate = A.steerReverse;
    else if (Math.abs(sTarget) < Math.abs(this.steerIn)) sRate = A.steerReturn;
    else sRate = A.steerAttackSlow + (A.steerAttackFast - A.steerAttackSlow) * clamp(speed / A.steerFastSpeed, 0, 1);
    this.steerIn += clamp(sTarget - this.steerIn, -sRate * dt, sRate * dt);
    const sc = -this.steerIn;                                           // + = left (same sign as rotation)

    // --- Axle velocities and grip limits
    const v = Math.max(speed, 0.5);
    const vx = Math.max(Math.abs(vF), 3);
    const vy = -vL;                                                     // + = moving to the car's left
    const travF = Math.atan2(vy + r * a, vx), travR = Math.atan2(vy - r * b, vx);
    const muF = SS.maxG * CAR.grip;
    // the rear's looseness fades in with speed: at a crawl both axles grip the same
    const loose = smoothstep(clamp((speed - A.slideFrom) / (A.slideFull - A.slideFrom), 0, 1));
    // drift memory: a handbrake pull or a brake tap while steering (at speed) loosens the rear and lets the slide
    // grow bigger for this corner. It fades after drift.release s of neutral steering, on countersteer, or when the slide ends.
    const brakeTap = inp.brake > 0.3 && !(this.prevBrakeKey > 0.3) && Math.abs(this.steerIn) > 0.5;
    this.prevBrakeKey = inp.brake;
    if (nC >= 2 && speed > D.minSpeed && Math.abs(this.steerIn) > 0.35 && (inp.handbrake || brakeTap)) { this.driftBoost = 1; this.driftNeutral = 0; this.driftSide = Math.sign(sc); }
    if (this.driftBoost > 0) {
      this.driftNeutral = Math.abs(this.steerIn) < 0.15 || sc * this.driftSide < -0.3 ? this.driftNeutral + dt : 0;
      if (this.driftNeutral > D.release || speed < D.minSpeed - 3 || (!inp.handbrake && Math.abs(beta) < D.off * D2R && this.betaRate * beta <= 0)) this.driftBoost = Math.max(0, this.driftBoost - dt * 4);
    }
    const boost = this.driftBoost;
    const rearRatio = (1 + (SS.rear * (CAR.rear || 1) - 1) * loose) * (1 - D.looser * boost);
    const muR = muF * rearRatio;
    let capF = muF * Nf0 * lf, capR = muR * Nr0 * lr, capRfull = muF * Math.max(1, rearRatio) * Nr0 * lr;
    // engine force (along the nose), split between the axles; part of the rear's share uses up rear grip
    const topV = A.topSpeed * SS.top * CAR.top;
    let aDrive = 0;
    if (this.gear > 0) aDrive = throttle * A.accel * CAR.accel * Math.max(0, 1 - Math.pow(Math.max(0, vF) / topV, 1.8));
    else aDrive = -throttle * A.accel * 0.6 * Math.max(0, 1 - Math.max(0, -vF) / A.reverseTop);
    const rearShare = clamp(A.rearDrive * (CAR.rearDrive || 1), 0, 1);
    const aLift = this.gear > 0 && throttle === 0 && vF > 3 ? A.liftDecel : 0;
    const holdFull = Math.min(Math.max(4 * D2R, A.slideHold * SS.slide * D2R * CAR.drift) + D.holdExtra * D2R * CAR.drift * boost, (A.guard.from - 6) * D2R);
    // part steering (phone tilt): the slide settles at that share of the full hold angle, so a small tilt is a small slide.
    // Keys are always 0 or full, so this never changes keyboard driving.
    const part = Math.abs(inp.steer) > 0 && Math.abs(inp.steer) < 1 ? Math.abs(inp.steer) : 1;
    const holdA = part < 1 ? Math.max(4 * D2R, holdFull * Math.pow(part, A.partHold)) : holdFull;
    // throttle eats rear grip (power slide) up to about the hold angle; past it, it just drives the car forwards
    const powerFade = clamp(1 - (Math.abs(beta) - holdA * 0.8) / (holdA * 0.4), 0, 1);
    const used = A.powerSlide * Math.abs(aDrive) * rearShare * m * powerFade + A.brakeSlide * brake * A.brakeDecel * A.brakeRear * m + aLift * m * 0.5;   // engine braking: half of it at the rear
    const circle = Math.sqrt(Math.max(0.04, 1 - (used / Math.max(capR, 1)) ** 2));
    capR *= circle; capRfull *= circle;
    if (inp.handbrake) capR *= A.handbrakeGrip;
    const peakF = SS.peak * D2R, peakR = SS.peak * D2R * 1.1;           // the rears peak a little later: they let go progressively

    // --- Front wheel angle. Low speed: plain lock. At speed: the key asks for front slip; as the car rotates
    //     towards the key the request shrinks to nothing at holdA (slideHold × surface slide × car drift), so the slide settles below it
    const kGeo = 1 / ((A.minRadius + A.radiusGrow * v) / (CAR.turn || 1));
    const lockLow = Math.atan(L * kGeo);
    const sf = clamp((vF - A.steerFrom) / (A.steerFull - A.steerFrom), 0, 1);
    this.betaRate += ((beta - this.prevBeta) / dt - this.betaRate) * Math.min(1, dt * 30); this.prevBeta = beta;
    // + = already rotated towards the key (looking slideCatch s ahead, so a fast swing is caught early)
    const into = (beta + clamp(this.betaRate, -3, 3) * A.slideCatch) * Math.sign(sc);
    const aim = into > 0 ? clamp(1 - into / holdA, -0.6, 1) : 1;      // past the hold angle the key even countersteers a little
    const deltaHigh = travF * A.selfAlign + sc * peakF * A.frontAim * aim;
    const maxLock = 0.62;                                              // rad (35°): the wheels' real lock
    const delta = clamp(sc * lockLow * (1 - sf) + deltaHigh * sf, -maxLock, maxLock);

    // --- Tyre forces (left = +): rise to the peak, then ease down to a sliding grip
    const tyre = (alpha, pk, fall) => {
      const x = Math.abs(alpha) / pk;
      const f = x < 1 ? x * (2 - x) : A.slideGrip + (1 - A.slideGrip) * Math.exp(-(x - 1) * fall);
      return -Math.sign(alpha) * f;
    };
    const alphaF = travF - delta, alphaR = travR;
    let Ff = capF * tyre(alphaF, peakF, A.falloff.front), Fr = capR * tyre(alphaR, peakR, A.falloff.rear);
    // slide carry: the grip the rear lost to the surface's looseness is handed back as a side force at the centre
    // of mass. The tail still swings out (no turning push from it), but the car keeps cornering in a slide.
    let Fc = A.slideCarry * (capRfull * tyre(alphaR, peakR, 0) - Fr * (inp.handbrake ? 1 / A.handbrakeGrip : 1));
    if (Fc * Fr < 0) Fc = 0;
    // ...and so is the front grip a held key gives up to hold the slide (aim < 1), so a held slide corners like gripping
    if (aim < 1 && sc !== 0) { const full = capF * tyre(-sc * peakF * A.frontAim, peakF, A.falloff.front); if (full * Ff >= 0 && Math.abs(full) > Math.abs(Ff)) Fc += A.slideCarry * (full - Ff); }
    // never push harder than would cancel the axle's sideways slip in a couple of steps (stable at low speed)
    const mEf = 1 / (1 / m + a * a / Iy), mEr = 1 / (1 / m + b * b / Iy);
    Ff = clamp(Ff, -mEf * vx * Math.abs(Math.tan(alphaF)) / dt * 0.5, mEf * vx * Math.abs(Math.tan(alphaF)) / dt * 0.5);
    Fr = clamp(Fr, -mEr * vx * Math.abs(Math.tan(alphaR)) / dt * 0.5, mEr * vx * Math.abs(Math.tan(alphaR)) / dt * 0.5);
    const wv = vF > 0 ? clamp((speed - 1.5) / 3, 0, 1) : 0;            // 0 = walking pace / reversing: plain wheel steering
    Ff *= wv; Fr *= wv; Fc *= wv;
    this.dbg.gripUse = Math.max(Math.abs(Ff) / Math.max(capF, 1), Math.abs(Fr) / Math.max(capR, 1));
    this.dbg.traction = capR / Math.max(1, muR * Nr0 * lr);

    // --- Rotation helpers: settle (no key: bring the car back in line), spin guard, air, walking pace
    const travel = speed > 0.5 ? _aT.copy(this.vel).addScaledVector(n, -this.vel.dot(n)).normalize() : _aT.copy(fG);
    const left = _aD.crossVectors(n, travel);
    const pathRate = speed > 2 ? (this.force.dot(left) / m - g * left.y + (Ff + Fr + Fc) * Math.cos(beta) / m) / v : 0;
    const rel = r - pathRate;                                          // how fast the slide angle is changing (+ = nose going left)
    let yawAcc = 0;
    if (wv > 0 && nC) {
      const neutral = 1 - clamp(Math.abs(this.steerIn) / 0.3, 0, 1);
      yawAcc += -A.settle * neutral * (rel + beta * 3) * wv;
      // catch: as a slide swings back through straight, brake the swing (strongest near 0°) so it doesn't pendulum
      if (rel * beta < 0 || Math.abs(beta) < 3 * D2R) yawAcc += -A.catchDamp * rel * (1 - clamp(Math.abs(beta) / (20 * D2R), 0, 1)) * wv;
      const over = clamp((Math.abs(beta) - A.guard.from * D2R) / (A.guard.range * D2R), 0, 1);
      if (over > 0) {
        yawAcc += -Math.sign(beta) * A.guard.push * over;
        if (rel * beta > 0) yawAcc += -A.guard.damp * over * rel;
      }
    }
    const yawLow = sc * kGeo * vF;                                     // walking pace / reverse: wheels steer the car
    if (nC) yawAcc += clamp((yawLow - r) * 16, -26, 26) * (1 - wv);
    if (!nC && speed > 5) yawAcc += clamp((-beta * A.airAlign - r) * 3, -26, 26);    // in the air: line the nose up with the travel
    this.dbg.yawT = pathRate; this.dbg.yawNow = r;
    this.torque.addScaledVector(n, Iy * yawAcc);

    // --- Drift state (for HUD, sound, dust, replays): a big enough slide at speed
    const absB = Math.abs(beta) * 57.2958;
    if (!this.drift && nC >= 2 && speed > D.minSpeed && absB > D.on) { this.drift = true; this.driftDir = Math.sign(beta); }
    else if (this.drift && (absB < D.off || speed < D.minSpeed - 3)) this.drift = false;
    this.dbg.drift = this.drift;
    const drifting = this.drift;

    if (ground > 0.05) {
      // tyre side forces at each axle, at road level: they turn the car, bend its path and roll the body
      _aP.copy(this.pos).addScaledVector(fwd, a).addScaledVector(up, -0.35);
      _aF.copy(lG).multiplyScalar(Ff * ground); this.addForceAt(_aF, _aP);
      _aP.copy(this.pos).addScaledVector(fwd, -b).addScaledVector(up, -0.35);
      _aF.copy(lG).multiplyScalar(Fr * ground); this.addForceAt(_aF, _aP);
      // the carried grip pushes square to the direction of travel, so it bends the path without scrubbing speed;
      // slideKeep hands back part of the speed the sliding tyres scrub (their side force leaning against the travel)
      const scrub = (Ff + Fr) * lG.dot(travel);                       // < 0 while sliding: pulls against the travel
      _aP.copy(this.pos).addScaledVector(up, -0.35);
      _aF.copy(left).multiplyScalar(Fc * Math.sign(lG.dot(left) || 1) * ground);
      if (scrub < 0) _aF.addScaledVector(travel, -scrub * A.slideKeep * ground);
      this.addForceAt(_aF, _aP);
      // engine along the nose (front and rear axle), so in a slide throttle drives the car round
      _aF.copy(fG).multiplyScalar(m * aDrive * (1 - rearShare) * ground * wv);
      _aP.copy(this.pos).addScaledVector(fwd, a).addScaledVector(up, -0.35); this.addForceAt(_aF, _aP);
      _aF.copy(fG).multiplyScalar(m * aDrive * rearShare * ground * wv);
      _aP.copy(this.pos).addScaledVector(fwd, -b).addScaledVector(up, -0.35); this.addForceAt(_aF, _aP);
      // brakes, engine braking, drag: along the direction of travel
      let ac = 0;
      const vAlong = this.vel.dot(travel);
      if (Math.abs(vAlong) > 0.4) ac -= Math.sign(vAlong) * (brake * A.brakeDecel + aLift);
      if (inp.handbrake && speed > 1) ac -= Math.sign(vAlong) * D.handbrakeDecel;
      ac -= vAlong * SS.drag + (vF > topV ? (vF - topV) * 0.5 : 0);
      // walking pace and reverse: the car rolls where it points
      const dir = _aV.copy(fG).multiplyScalar(1 - wv).addScaledVector(travel, wv);
      if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.copy(fG);
      ac += aDrive * (1 - wv);
      let dvLow = -vL * (1 - Math.exp(-10 * dt)) * (1 - wv);
      if (speed < 0.6 && throttle === 0) { dvLow = -vL; ac = -vF / dt * 0.5; }           // parked: don't creep
      _aF.copy(dir).multiplyScalar(m * ac * ground).addScaledVector(rG, m * dvLow / dt * ground);
      _aP.copy(this.pos).addScaledVector(up, -0.35);                                     // below the centre of mass: body pitches and rolls
      this.addForceAt(_aF, _aP);
    } else {
      // in the air: a little lift for floaty jumps, and the car levels itself for a clean landing
      this.force.y += m * g * A.airFloat;
      _aF.crossVectors(up, _Yup);
      this.torque.addScaledVector(_aF, CONFIG.car.inertia.roll * A.airLevel);
      _aF.copy(this.angVel).addScaledVector(up, -this.angVel.dot(up));
      this.torque.addScaledVector(_aF, -CONFIG.car.inertia.roll * 2.5);
    }

    // automatic gearbox, revs and wheel visuals (for sound, HUD and dust)
    const kmh = Math.abs(vF) * 3.6, G = A.gears;
    if (this.gear > 0) {
      let gear = 1; for (let k = 1; k < G.length; k++) if (kmh > G[k] - (k < this.gear ? 6 : 0)) gear = k + 1;
      if (gear !== this.gear) { this.gear = gear; this.shiftTimer = 0.09; }
      const lo = G[gear - 1], hi = G[gear] || 210;
      let rpm = 2400 + 4600 * clamp((kmh - lo) / (hi - lo), 0, 1);
      if (throttle > 0 && (drifting || kmh < 18)) rpm += 1300 * throttle;
      if (kmh < 3 && throttle === 0) rpm = CONFIG.engine.idleRpm;
      this.rpm += (Math.min(rpm, CONFIG.engine.redlineRpm) - this.rpm) * Math.min(1, dt * 14);
    } else this.rpm += (1800 + kmh * 120 - this.rpm) * Math.min(1, dt * 10);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    this.steer = clamp(delta, -0.6, 0.6) * -1;                        // + = right, as the wheel meshes expect
    const spinR = !inp.handbrake && drifting && throttle > 0.2;
    for (const w of w0) {
      w.omega = inp.handbrake && !w.front ? 0 : vF / R * (!w.front && spinR ? 1.35 : 1);
      w.vLong = vF;
      w.slipSpeed = w.contact ? (w.front ? vx * Math.abs(Math.sin(alphaF)) : vx * Math.abs(Math.sin(alphaR)) + (spinR ? 4 : 0) + (inp.handbrake ? Math.abs(vF) * 0.5 : 0)) : 0;
    }
  }

  // Visual weight: body roll / pitch / heave from the accelerations the car really feels (drawn only).
  updateBodyPose(dt) {
    const B = CONFIG.arcade.body, V = this.vis;
    _aV.subVectors(this.vel, this.lastVel).divideScalar(dt);
    this.lastVel.copy(this.vel);
    if (!V.init) { V.init = true; return; }
    const aLeft = clamp(-_aV.dot(this.right), -25, 25), aFwd = clamp(_aV.dot(this.fwd), -25, 25), aUp = clamp(_aV.dot(this.up), -40, 40);
    const air = this.grounded === 0;
    const tR = air ? 0 : clamp(aLeft * B.roll, -B.maxRoll, B.maxRoll);
    const tP = air ? 0 : clamp(-aFwd * B.pitch, -B.maxPitch, B.maxPitch);
    const tH = air ? 0.02 : clamp(-aUp * B.heave, -B.maxHeave, B.maxHeave);
    const w = 2 * Math.PI * B.freq, z = B.damping;
    for (const [k, t] of [['roll', tR], ['pitch', tP], ['heave', tH]]) {
      const kv = k + 'V';
      V[kv] += (w * w * (t - V[k]) - 2 * z * w * V[kv]) * dt;
      V[k] += V[kv] * dt;
    }
  }

  // Wheel spin: drive torque in, brake + tyre reaction + rolling resistance out.
  // Solved semi-implicitly so stiff tyre forces don't make the wheel speed oscillate.
  integrateWheel(w, Tdrive, Tb, Fx, kSlip, rollF, dt) {
    const Iw = w.Ieff, R = CONFIG.wheels.radius, eps = 1.0;
    const th = Math.tanh(w.omega / eps);
    const Tbrk = Tb * th, dTbrk = Tb * (1 - th * th) / eps;
    const Troll = rollF * R * Math.tanh(w.omega * 2);
    const net = Tdrive - Tbrk - Fx * R - Troll - w.omega * 0.05;
    const prev = w.omega;
    w.omega += dt * net / (Iw + dt * (kSlip * R + dTbrk));
    if (Tb > 0 && prev !== 0 && Math.sign(w.omega) !== Math.sign(prev) && Math.abs(Tdrive) < Tb) w.omega = 0;
  }
}

