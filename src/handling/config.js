'use strict';
/* =====================================================================
   CONFIG: every tunable value lives here. Units are SI (kg, m, s, N, Nm).
   ===================================================================== */
const CONFIG = {
  model: 'arcade',                // 'arcade' (Sega Rally style) or 'sim' (tyre simulation used before)
  physicsHz: 120,                 // fixed physics step rate
  gravity: 9.81,

  car: {
    mass: 1230,                   // kg, R5-class rally car with crew
    inertia: { pitch: 1650, yaw: 1550, roll: 480 }, // kg·m² around local x, y, z. Lower yaw = quicker rotation
    stability: 0.6,               // spin protection (like art of rally's stability slider): past stabilityAngle, resists the slide growing. 0 = off
    stabilityAngle: 38,           // degrees of slide before it starts helping
  },

  wheels: {
    radius: 0.32,                 // m
    inertia: 1.1,                 // kg·m², wheel + brake disc + half shaft
    trackHalf: 0.79,              // m, half the distance between left and right wheels
    frontZ: 1.24,                 // m, front axle ahead of centre of mass
    rearZ: -1.33,                 // m, rear axle behind centre of mass (slightly nose-heavy, like a real R5)
    mountY: 0.04,                 // m, suspension top relative to centre of mass (centre of mass ends up ~0.5 m above the road)
  },

  suspension: {
    restLength: 0.32,             // m, spring length with no load
    travel: 0.24,                 // m, compression before the bump stop
    springFront: 36000,           // N/m
    springRear: 33000,            // N/m
    damperBump: 3400,             // N·s/m while compressing (higher = weight shifts arrive faster)
    damperRebound: 4700,          // N·s/m while extending
    antiRollFront: 5000,          // N/m, resists left/right compression difference
    antiRollRear: 12500,          // stiffer than the front: neutral balance that rotates on lift-off
    bumpStop: 180000,             // N/m past full travel
  },

  tyre: {
    baseGrip: 1.0,                // global grip multiplier on top of each surface's grip
    loadSensitivity: 0.08,        // heavily loaded tyres lose some grip per newton (why weight transfer matters)
    frontFalloff: 0.55,           // × surface falloff for the fronts: they hold on past their limit, so the car doesn't plough
    rearFalloff: 1.2,             // × surface falloff for the rears: they let go progressively, so slides start easily and glide
    minSpeedLong: 3.0,            // m/s, keeps slip maths stable near standstill
    minSpeedLat: 2.5,
    rollingResistance: 0.014,
  },

  engine: {
    idleRpm: 1000,
    redlineRpm: 7400,
    torqueCurve: [[1000, 240], [2500, 385], [4000, 480], [5500, 500], [6500, 465], [7400, 395]], // [rpm, Nm], ~390 hp: enough to break the rear loose
    engineBrakeTorque: 80,        // Nm at the redline with throttle closed
    inertia: 0.09,                // kg·m², flywheel + crank. Felt through the wheels in low gears
    gears: [3.10, 2.20, 1.68, 1.33, 1.08],
    reverseRatio: 4.4,
    finalDrive: 4.9,              // short stage gearing
    efficiency: 0.88,
    shiftUpRpm: 7000,
    shiftDownRpm: 3600,
    shiftTime: 0.09,              // s without drive while changing gear (sequential box)
  },

  // All-wheel drive with three differentials. A diff "lock" moves torque from the faster wheel to the
  // slower one, up to preload + lock × input torque. More lock = more traction and stability, less rotation.
  drivetrain: {
    rearTorqueBias: 0.70,         // centre split, share to the rear axle. Rear-biased so throttle swings the tail out
    centre: { preload: 30,  lock: 0.08 },   // loose, so the rear can spin up while the fronts keep biting
    front:  { preload: 25,  powerLock: 0.12, coastLock: 0.06 },
    rear:   { preload: 60,  powerLock: 0.50, coastLock: 0.30 },   // both rear wheels spin together in a power slide
  },

  brakes: {
    frontTorque: 2000,            // Nm per wheel at full pedal (70% front bias)
    rearTorque: 850,
    handbrakeTorque: 3000,        // Nm per rear wheel; also opens the centre diff like a hydraulic handbrake
    pedalRampTime: 0.10,          // s to reach full pressure with a keyboard key
    lockUpLimit: true,            // keyboard threshold braking: pressure backs off as a wheel starts to lock, so you can
                                  // brake and steer together. false = raw pedal, wheels lock and the car slides straight on
  },

  steering: {
    maxLockDeg: 35,               // most the front wheels can turn (hairpins, catching big slides)
    slipSteer: 1.0,               // at speed, a held key aims the front tyres at this × their peak-grip slip angle,
                                  // measured from where the car is travelling: maximum bite, no scrubbing
    slipSteerFrom: 4,             // m/s: below this speed the key gives plain wheel angle (full lock for hairpins)
    slipSteerFull: 12,            // m/s: above this speed it is fully grip-based
    steerSpeed: 4.0,              // rad/s turning in
    returnSpeed: 5.0,             // rad/s back to centre
    countersteerAim: 0.45,        // when steering against a slide, aim at this fraction of the grip angle (gentler catch)
    selfAlign: 0.85,              // caster effect: with no input the wheels follow the slide this much, so throttle holds the drift angle
  },

  // Arcade driving model, built on one rule set (see Car.arcadeForces):
  //  1. Where you GO: steering bends your direction of travel, up to the tyres' grip limit and no further.
  //     Holding a key = the tightest turn the surface allows. Too fast for a corner = a wider line, never a spin.
  //  2. Where the car POINTS: a small slide angle at the limit (more on loose surfaces, for the rally look),
  //     and a big angle only in a drift you start yourself (brake or handbrake while steering).
  //  3. Surfaces change how much grip you have, never how quickly the car answers the keys.
  // Suspension, jumps and body roll still come from the physics above.
  arcade: {
    accel: 9.5,                   // m/s² from a standstill
    topSpeed: 54,                 // m/s (≈195 km/h) on tarmac
    reverseTop: 11,
    brakeDecel: 15,               // m/s²
    // Keyboard steering curve: how fast the virtual steering wheel turns (full lock per second).
    // Quick at low speed for hairpins, calmer at high speed so a held key doesn't twitch the car.
    steerAttackSlow: 14,          // turning in, at walking pace
    steerAttackFast: 8.5,         // turning in, at steerFastSpeed and above
    steerFastSpeed: 38,           // m/s
    steerReturn: 16,              // letting go: back to centre
    steerReverse: 22,             // switching from left to right
    minRadius: 5.5,               // m: tightest turn at walking pace (wheel lock)
    radiusGrow: 0.06,             // the lock limit eases a little with speed (m of radius per m/s)
    gripUse: 0.97,                // a held key corners at this share of the tyre limit: steering alone never slides the car
    cornerDrain: 0.65,            // engine pull lost while cornering right at the limit
    yawResponse: 16,              // how tightly the car's rotation follows what it should be doing
    yawAccelMax: 26,              // rad/s²: cap on how hard the car can be spun up
    alignRate: 8,                 // how quickly the car's angle settles to its target (1/s)
    drift: {
      minSpeed: 9,                // m/s (≈32 km/h): slowest speed a drift can start
      angle: 32,                  // degrees the car swings out in a drift (× surface slide × car drift)
      grip: 1.12,                 // a drift steered hard into the corner turns this much tighter than gripping...
      wideArc: 0.6,               // ...and this wide with the key released (you steer the arc, Mario Kart style)
      release: 0.32,              // s with no steering before a drift straightens up
      drag: 0.9,                  // speed scrubbed by the slide angle (m/s² per m/s at 90°)
      handbrakeDecel: 4,          // m/s² while the handbrake is held
    },
    airFloat: 0.22,               // share of gravity cancelled in the air: floaty Sega jumps
    airLevel: 6,                  // how strongly the car levels itself in the air
    airAlign: 2,                  // in the air the nose eases back towards the direction of travel, for clean landings
    gears: [0, 45, 80, 115, 150, 182], // km/h where each gear starts (6-speed automatic)
    // per surface: cornering limit in g, top speed share, rolling drag,
    // look: slide angle at the cornering limit (degrees), slide: drift angle scale
    surfaces: {
      tarmac: { maxG: 1.6,  top: 1.0,  drag: 0.02, look: 2.5, slide: 0.82 },
      gravel: { maxG: 1.3,  top: 0.96, drag: 0.04, look: 8,   slide: 1.0 },
      dirt:   { maxG: 1.24, top: 0.95, drag: 0.05, look: 9,   slide: 1.05 },
      snow:   { maxG: 1.08, top: 0.92, drag: 0.05, look: 10,  slide: 1.12 },
      grass:  { maxG: 0.85, top: 0.55, drag: 0.6,  look: 6,   slide: 1.1 },
    },
  },
  cars: [
    { id: 'kestrel', name: 'Kestrel GT4', blurb: 'Planted and precise. Grips hard and turns in sharply.', accel: 1.0, top: 1.0, grip: 1.06, drift: 0.92, turn: 1.0,
      paint: 0xf4f6f8, stripe: 0xffc928, skirt: 0x1f4fa3, number: '7' },
    { id: 'strada', name: 'Strada HF', blurb: 'Light and punchy. Quicker away and loves a long slide.', accel: 1.06, top: 1.02, grip: 0.97, drift: 1.12, turn: 1.08,
      paint: 0xd8342c, stripe: 0xf4f6f8, skirt: 0x1b1d20, number: '4' },
  ],
  carIndex: 0,

  aero: {
    airDensity: 1.225,
    dragCdA: 0.78,                // drag coefficient × frontal area
    downforceClA: 0.25,
  },

  body: {                         // chassis contact when it touches the ground (landings, rolls)
    contactStiffness: 70000,
    contactDamping: 4500,
    contactFriction: 0.6,
  },

  // Tyre behaviour per surface. peakSlipAngle: sideways slip with the most grip (lower = sharper, snappier).
  // falloff: how much grip is lost past the peak (higher = more sudden). Loose surfaces peak late and keep grip while sliding.
  surfaces: {
    tarmac: { label: 'Tarmac',   grip: 1.35, peakSlipAngleDeg: 6.5,  peakSlipRatio: 0.09, falloff: 1.45, rolling: 1.0, drag: 0,  dust: null },
    gravel: { label: 'Gravel',   grip: 1.12, peakSlipAngleDeg: 10.5, peakSlipRatio: 0.15, falloff: 1.45, rolling: 1.7, drag: 6,  dust: [0.78, 0.66, 0.5] },
    snow:   { label: 'Snow',     grip: 0.86, peakSlipAngleDeg: 9.0,  peakSlipRatio: 0.13, falloff: 1.38, rolling: 1.5, drag: 5,  dust: [0.97, 0.98, 1.0] },
    dirt:   { label: 'Dirt',     grip: 1.04, peakSlipAngleDeg: 11.5, peakSlipRatio: 0.16, falloff: 1.42, rolling: 2.0, drag: 8,  dust: [0.66, 0.48, 0.33] },
    grass:  { label: 'Off road', grip: 0.70, peakSlipAngleDeg: 12.0, peakSlipRatio: 0.20, falloff: 1.25, rolling: 5.0, drag: 38, dust: [0.45, 0.4, 0.3] },
  },

  camera: { chaseDistance: 6.6, chaseHeight: 2.3, chaseLag: 7.0, rallyDistance: 15, rallyHeight: 10.5, rallyLookAhead: 7 },
};

