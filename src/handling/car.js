/* =====================================================================
   VEHICLE PHYSICS: rigid body + four raycast wheels
   ===================================================================== */
const _M = new THREE.Vector3(), _P = new THREE.Vector3(), _r = new THREE.Vector3(), _vP = new THREE.Vector3(),
  _fw = new THREE.Vector3(), _rw = new THREE.Vector3(), _F = new THREE.Vector3(), _t = new THREE.Vector3(),
  _qInv = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _g = { h: 0, n: new THREE.Vector3() };
const _ag = new THREE.Vector3(), _af = new THREE.Vector3(), _ar = new THREE.Vector3(), _aF = new THREE.Vector3(), _aP = new THREE.Vector3(), _Yup = new THREE.Vector3(0, 1, 0);
const _aT = new THREE.Vector3(), _aL = new THREE.Vector3(), _aD = new THREE.Vector3();

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
    this.beta = 0; this.grounded = 1; this.groundS = 1; this.airTime = 0; this.surfS = null;
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
    this.beta = 0; this.groundS = 1; this.airTime = 0; this.surfS = null;
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
    const Ix = I.pitch, Iy = I.yaw, Iz = I.roll;
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
  }

  /* ARCADE DRIVING (Sega Rally style)
     - Steering sets a target rotation speed; the car turns towards it directly.
     - Sideways speed is bled off at a rate set by the surface: tarmac grips, gravel and snow slide.
     - Drift: a flick of the steering, a dab of brake while turning, the handbrake, or simply a big slide
       puts the car into a drift. Grip drops, rotation increases, and throttle holds the slide. Lifting tidies it up.
     - Sideways speed that the tyres kill is partly handed back as forward speed, so slides carry momentum.
     - Past maxSlideAngle the car swings back, so a slide very rarely turns into a spin. */
  arcadeForces(dt, inp, throttle, brake, fwd, up) {
    const A = CONFIG.arcade, D = A.drift, CAR = CONFIG.cars[CONFIG.carIndex] || CONFIG.cars[0], m = CONFIG.car.mass, g = CONFIG.gravity, R = CONFIG.wheels.radius;

    // --- Ground contact and surface. Both are smoothed so a bump or a wheel on the verge doesn't make
    //     the grip flicker: the car always knows roughly how much grip it has.
    let nC = 0, maxG = 0, top = 0, drag = 0, look = 0, slide = 0;
    _ag.set(0, 0, 0);
    for (const w of this.wheels) if (w.contact) {
      nC++; _ag.add(w.normal);
      const sp = A.surfaces[w.surface] || A.surfaces.gravel;
      maxG += sp.maxG; top += sp.top; drag += sp.drag; look += sp.look; slide += sp.slide;
    }
    if (!this.surfS) this.surfS = { maxG: 1.3, top: 1, drag: 0.04, look: 7, slide: 1 };
    const SS = this.surfS;
    if (nC) {
      const k = Math.min(1, dt * 10);
      SS.maxG += (maxG / nC - SS.maxG) * k; SS.top += (top / nC - SS.top) * k; SS.drag += (drag / nC - SS.drag) * k;
      SS.look += (look / nC - SS.look) * k; SS.slide += (slide / nC - SS.slide) * k;
      _ag.normalize();
    } else _ag.copy(up);
    const contact = nC >= 2 ? 1 : nC === 1 ? 0.5 : 0;
    this.groundS += (contact - this.groundS) * Math.min(1, dt * (contact > this.groundS ? 30 : 12));
    const ground = this.groundS; this.grounded = nC / 4;
    this.airTime = nC ? 0 : this.airTime + dt;
    const n = _ag;

    // Ground-plane frame: forward, right and left of the car; speed along and across
    const fG = _af.copy(fwd).addScaledVector(n, -fwd.dot(n)).normalize();
    const rG = _ar.crossVectors(fG, n);
    const vF = this.vel.dot(fG), vL = this.vel.dot(rG), speed = Math.hypot(vF, vL);
    // slide angle: + = the car is moving to its right, i.e. its nose points left of where it is going
    const beta = speed > 0.5 ? Math.atan2(vL, Math.max(Math.abs(vF), 1.5)) * (vF >= 0 ? 1 : -1) : 0;
    this.beta = beta;

    // --- Steering input, smoothed so a key press feels like turning a wheel
    const sTarget = inp.steer;
    let sRate;
    if (sTarget !== 0 && this.steerIn !== 0 && Math.sign(sTarget) !== Math.sign(this.steerIn)) sRate = A.steerReverse;
    else if (Math.abs(sTarget) < Math.abs(this.steerIn)) sRate = A.steerReturn;
    else sRate = A.steerAttackSlow + (A.steerAttackFast - A.steerAttackSlow) * clamp(speed / A.steerFastSpeed, 0, 1);
    this.steerIn += clamp(sTarget - this.steerIn, -sRate * dt, sRate * dt);
    const steer = this.steerIn;                                   // + = right

    // --- Drift: only when you ask for it. Brake or handbrake while steering above ~32 km/h starts one in
    //     the direction you're steering. Steering into it tightens the arc, letting go of the key widens
    //     it and then straightens the car, steering the other way ends it.
    const yawDirOfSteer = -Math.sign(steer);                      // + = turning left
    // the brake only starts a drift when you press it while already steering (a tap mid-corner), so braking
    // in a straight line and then turning in stays a clean, gripping corner
    const brakeTap = inp.brake > 0.3 && !(this.prevBrakeKey > 0.3) && Math.abs(steer) > 0.5 && vF > D.minSpeed + 5;
    this.prevBrakeKey = inp.brake;
    if (!this.drift && nC >= 2 && vF > D.minSpeed && Math.abs(steer) > 0.35 && (inp.handbrake || brakeTap)) {
      this.drift = true; this.driftDir = yawDirOfSteer; this.driftNeutral = 0; this.driftCounter = 0;
      this.driftKick = inp.handbrake ? 0.3 : 0.18;               // swing out briskly on entry
    }
    let into = 0;
    if (this.drift) {
      into = -steer * this.driftDir;                              // + = steering into the drift
      this.driftCounter = into < -0.3 ? this.driftCounter + dt : 0;
      this.driftNeutral = Math.abs(steer) < 0.15 ? this.driftNeutral + dt : 0;
      if (this.driftCounter > 0.1 || this.driftNeutral > D.release || speed < 6 || vF < 3 || this.airTime > 0.6) this.drift = false;
    }
    this.driftBlend = clamp(this.driftBlend + (this.drift ? 7 : -5) * dt, 0, 1);
    this.driftKick = Math.max(0, this.driftKick - dt);
    const db = this.driftBlend, dirD = this.driftDir || 1;
    const drifting = db > 0.5;

    // --- 1. Where you go: how fast the direction of travel turns (+ = left)
    const aG = SS.maxG * CAR.grip * g;                            // the tyres' cornering limit here
    const v = Math.max(speed, 0.5);
    const kGeo = 1 / ((A.minRadius + A.radiusGrow * v) / CAR.turn);   // wheel-lock limit (low speed)
    const kGrip = aG * A.gripUse / (v * v);                       // tyre limit
    const rateGrip = -steer * Math.min(kGeo, kGrip) * v;
    let arc = into >= 0 ? D.wideArc + (D.grip - D.wideArc) * into : D.wideArc * (1 + 0.7 * into);
    const rateDrift = dirD * Math.min(aG * arc / v, kGeo * v);
    const rateCmd = rateGrip + (rateDrift - rateGrip) * db;
    // The tyres provide whatever sideways push is needed on top of everything else acting sideways (gravity on
    // a camber, the springs as the body rolls), so the path follows the steering exactly, up to their limit.
    const travel = speed > 0.5 ? _aT.copy(this.vel).addScaledVector(n, -this.vel.dot(n)).normalize() : _aT.copy(fG);
    const left = _aL.crossVectors(n, travel);
    const aOther = this.force.dot(left) / m - g * left.y;         // springs so far + gravity (added after this)
    const aCap = aG * (1 + (D.grip - 1) * db) * 1.04;
    const wv = vF > 0 ? clamp((speed - 1.5) / 3, 0, 1) : 0;       // 0 = walking pace / reversing: plain wheel steering
    const aTyre = clamp(v * rateCmd - aOther, -aCap, aCap) * wv;
    const gripUse = Math.abs(aTyre) / aG;
    this.dbg.gripUse = gripUse;

    // --- 2. Where the car points: its angle to the direction of travel
    const lookA = SS.look * D2R * clamp(v * rateGrip / aG, -1, 1);                    // small slide at the limit
    const driftA = dirD * D.angle * D2R * SS.slide * CAR.drift * (into >= 0 ? 0.75 + 0.25 * into : 0.75 * (1 + into));
    const betaT = lookA + (driftA - lookA) * db;
    const rateNow = wv > 0 ? (aTyre / Math.max(wv, 1e-3) + aOther) / v : 0;           // how fast the path is actually turning
    const align = A.alignRate * (this.driftKick > 0 ? 1.6 : 1);
    let yawT = rateNow + (betaT - beta) * align;
    const yawLow = -steer * kGeo * vF;                                                 // walking pace / reverse: wheels steer the car
    yawT = yawLow + (yawT - yawLow) * wv;
    const yawNow = this.angVel.dot(n);
    let yawK = ground > 0.2 ? A.yawResponse : 0;
    if (!nC && speed > 5) { yawT = -beta * A.airAlign; yawK = 3; }                     // in the air: line the nose up with the travel
    this.dbg.yawT = yawT; this.dbg.yawNow = yawNow; this.dbg.drift = drifting;
    this.torque.addScaledVector(n, CONFIG.car.inertia.yaw * clamp((yawT - yawNow) * yawK, -A.yawAccelMax, A.yawAccelMax));

    if (ground > 0.05) {
      // --- Pace: engine, brakes, drag, all along the direction of travel so they never bend your line
      const topV = A.topSpeed * SS.top * CAR.top;
      const traction = (1 - A.cornerDrain * Math.min(1, gripUse) ** 2) * (drifting ? Math.max(0.75, Math.cos(beta)) : 1);
      this.dbg.traction = traction;
      let a = 0;
      if (this.gear > 0) a += throttle * A.accel * CAR.accel * Math.max(0, 1 - Math.pow(Math.max(0, vF) / topV, 1.8)) * traction;
      else a -= throttle * A.accel * 0.6 * Math.max(0, 1 - Math.max(0, -vF) / A.reverseTop);
      const vAlong = this.vel.dot(travel);
      if (Math.abs(vAlong) > 0.4) a -= Math.sign(vAlong) * brake * A.brakeDecel;
      if (inp.handbrake && speed > 1) a -= Math.sign(vAlong) * D.handbrakeDecel;
      a -= vAlong * SS.drag + (vF > topV ? (vF - topV) * 0.5 : 0);
      a -= vAlong * Math.abs(Math.sin(beta)) * D.drag * 0.1;
      // walking pace and reverse: the car rolls where it points
      const dir = _aD.copy(fG).multiplyScalar(1 - wv).addScaledVector(travel, wv);
      if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.copy(fG);
      let dvLow = -vL * (1 - Math.exp(-10 * dt)) * (1 - wv);
      if (speed < 0.6 && throttle === 0) { dvLow = -vL; a = -vF / dt * 0.5; }           // parked: don't creep
      _aF.copy(dir).multiplyScalar(m * a * ground).addScaledVector(left, m * aTyre * ground).addScaledVector(rG, m * dvLow / dt * ground);
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
    const lock = (28 - 18 * clamp(speed / 40, 0, 1)) * D2R;
    this.steer = clamp(this.steerIn * lock + (drifting ? beta * 0.9 : 0), -0.6, 0.6);          // wheels countersteer visually in a slide
    for (const w of this.wheels) {
      w.omega = vF / R * (!w.front && drifting && throttle > 0.2 ? 1.35 : 1);
      w.vLong = vF;
      w.slipSpeed = w.contact ? Math.abs(vL) * (w.front ? 0.5 : 1) + (!w.front && drifting && throttle > 0.2 ? 4 : 0) : 0;
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

