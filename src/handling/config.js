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

  // Arcade driving model, 90s arcade rally style (see Car.arcadeForces). Two axles, each with its own grip:
  //  1. A held key asks the FRONT tyres for grip towards that side, measured from where the front axle is going.
  //     With no key the front wheels follow the slide (automatic countersteer), so letting go straightens the car.
  //  2. The REAR tyres can run out of grip before the fronts: then the tail swings out by itself and the car
  //     rotates into a slide. How easily depends on the surface (rear grip, peak), the car, speed, throttle,
  //     braking and weight transfer. The slide settles where front and rear balance, never in a spin.
  //  3. The handbrake takes most of the rear grip away (tight turns, hairpins).
  //  4. Spin guard: past guard.from degrees the car resists the slide growing, hard.
  // Weight (body roll, dive, squat, bounce) is drawn from the real accelerations: see `body` below.
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
    minRadius: 5.5,               // m: tightest turn at walking pace (wheel lock). Lower = tighter hairpins
    radiusGrow: 0.06,             // the lock limit eases a little with speed (m of radius per m/s)
    steerFrom: 4,                 // m/s: below this a key is plain wheel angle (full lock for hairpins)...
    steerFull: 12,                // m/s: ...above this a key asks the front tyres for grip (blend in between)
    frontAim: 1.0,                // held key = front tyres at this × their peak slip angle. Higher = sharper turn-in, more rotation
    slideHold: 1.15,              // × the surface's `slide` angle where a held key stops adding rotation (the slide settles there).
                                  // Higher = bigger, longer slides from steering alone
    slideCatch: 0.15,             // s: a held key also eases off by how fast the slide is growing (looks this far ahead).
                                  // Higher = the first swing-out is smaller and calmer; 0 = big pendulum swings
    slideFrom: 7,                 // m/s (25 km/h): below this the rear grips like the front (no slides at a crawl)...
    slideFull: 19,                // m/s (68 km/h): ...above this the surface's full rear looseness applies
    slideCarry: 1.0,              // share of the rear grip lost to a loose surface that still bends your path (at the centre, so the
                                  // tail still swings out). Higher = slides corner as hard as gripping: sliding is the fast way round
    slideKeep: 0.6,               // share of the speed a slide scrubs that you keep. Higher = a held slide loses less speed (1 = none)
    weightShift: 1.4,             // × the real load transfer between the axles. Higher = braking or lifting swings the tail more
    powerSlide: 1.0,              // share of the rear drive force that eats rear grip. Higher = throttle pushes the tail out more
    brakeRear: 0.35,              // share of braking done by the rear wheels
    brakeSlide: 0.35,             // share of the rear braking force that eats rear grip. Higher = a brake tap mid-corner rotates more
    rearDrive: 0.6,               // share of the engine force through the rear axle (× car rearDrive)
    liftDecel: 0.7,               // m/s² engine braking off the throttle (also shifts weight forward: lift-off tuck-in)
    handbrakeGrip: 0.28,          // rear grip left while the handbrake is held. Lower = the tail swings round faster
    slideGrip: 0.78,              // share of grip a tyre keeps when sliding well past its peak. Higher = slides keep more bite (calmer)
    falloff: { front: 0.45, rear: 0.9 }, // how fast grip drops past the tyre's peak (higher = snappier). Fronts hold on, rears let go
    selfAlign: 1.0,               // with no key the front wheels point this much along the slide (1 = exactly: no force, the rear straightens the car)
    catchDamp: 12,                // 1/s: as a slide swings back through straight, this brakes the swing. Higher = less swing-back after a catch
    settle: 4,                    // 1/s: with no key, extra help bringing the car back in line (higher = quicker, less swing-back)
    guard: { from: 42, range: 30, push: 9, damp: 7 }, // spin guard: from this angle (°), fully on `range` ° later; push = rad/s² back
                                                       // towards the travel, damp = how hard it brakes the rotation. Higher = harder to spin
    drift: {
      minSpeed: 9,                // m/s (≈32 km/h): slower than this the car never counts as drifting
      on: 12,                     // ° of slide that counts as a drift (HUD, sound, replays, dust)...
      off: 7,                     // ...and the drift ends below this
      handbrakeDecel: 4,          // m/s² while the handbrake is held
      // drift memory (handbrake pull or brake tap while steering): for that slide the rear is looser and the slide may grow bigger
      looser: 0.3,                // share of rear grip taken away while it lasts. Higher = tarmac drifts hold longer on the throttle
      holdExtra: 14,              // ° added to where a held key settles the slide (× car drift). Higher = bigger deliberate drifts
      release: 0.32,              // s of neutral steering (or countersteer) that ends it
    },
    airFloat: 0.22,               // share of gravity cancelled in the air: floaty jumps
    airLevel: 6,                  // how strongly the car levels itself in the air
    airAlign: 2,                  // in the air the nose eases back towards the direction of travel, for clean landings
    gears: [0, 45, 80, 115, 150, 182], // km/h where each gear starts (6-speed automatic)
    // Visual weight: the body leans on its wheels from the real accelerations (drawn only; physics unaffected).
    body: {
      roll: 0.005,                // rad per m/s² sideways: leaning out in corners and slides. Higher = more lean
      pitch: 0.004,               // rad per m/s² along: nose dips under braking, squats under power
      heave: 0.004,               // m per m/s² up/down: squashes on landings and compressions
      maxRoll: 0.11, maxPitch: 0.08, maxHeave: 0.09,   // rad, rad, m: caps
      freq: 1.7,                  // Hz: how quickly the body follows. Lower = softer, lazier body
      damping: 0.42,              // 1 = no bounce; lower = it settles with a visible bounce or two
    },
    // per surface: maxG = front grip in g (the cornering limit; the test bot and rivals pick speeds from it),
    // top = top speed share, drag = rolling drag,
    // rear = rear grip vs front (lower = the tail lets go more easily; below 1 a held key slides the car),
    // peak = slip angle of most grip (°; higher = softer, more progressive),
    // slide = angle (° × slideHold × car drift) where a held key stops adding rotation; a held slide settles at about 0.6× that
    surfaces: {
      tarmac: { maxG: 1.6,  top: 1.0,  drag: 0.02, rear: 1.04, peak: 6.5, slide: 16 },
      gravel: { maxG: 1.3,  top: 0.96, drag: 0.04, rear: 0.6,  peak: 9,   slide: 30 },
      dirt:   { maxG: 1.24, top: 0.95, drag: 0.05, rear: 0.58, peak: 10,  slide: 32 },
      snow:   { maxG: 1.08, top: 0.92, drag: 0.05, rear: 0.56, peak: 10,  slide: 34 },
      grass:  { maxG: 0.85, top: 0.55, drag: 0.6,  rear: 0.7,  peak: 11,  slide: 28 },
    },
  },
  // Car colours (art owns paint / stripe / skirt / number and `liveries`): paint/stripe/skirt/number = the default
  // livery (liveries[0]), kept so the menu swatches keep working. Each livery is drawn by art/car-livery.js:
  //   base = body, a / b = accents, c = dark trim, wheel = rim colour, numBg / numFg = number panel, plate = invented plate text,
  //   design = which painter function, pod = rally light bar on the nose, wing = wing / roof spoiler colour.
  cars: [
    { id: 'kestrel', name: 'Kestrel GT4', blurb: 'Planted and precise. Grips hard and turns in sharply.', accel: 1.0, top: 1.0, grip: 1.06, drift: 0.85, turn: 1.0, rear: 1.0, rearDrive: 0.85,
      paint: 0xf4f6f8, stripe: 0xffc928, skirt: 0x1f4fa3, number: '7',
      liveries: [
        { id: 'ridgeline', name: 'Ridgeline',   design: 'ridgeline', base: 0xf4f6f8, a: 0xffc928, b: 0x1f4fa3, c: 0x14213f, wheel: 0xd9dde2, numBg: 0xffc928, numFg: 0x101820, plate: 'KR 07-GT', wing: 0x14213f, spons: ['ROTOR OIL', 'NORTHGATE', 'BRINDLE'] },
        { id: 'midnight',  name: 'Midnight Blue', design: 'midnight', base: 0x16255a, a: 0xb4f01c, b: 0xf4f6f8, c: 0x0a1230, wheel: 0xc9cfd8, numBg: 0xf4f6f8, numFg: 0x16255a, plate: 'MB 31-NT', pod: true, wing: 0xb4f01c, spons: ['HALCYON', 'ROTOR OIL', 'PIKE RACING'], number: '31' },
        { id: 'magma',     name: 'Magma',       design: 'magma',     base: 0x17181c, a: 0xff4a12, b: 0xffb81c, c: 0x2a1208, wheel: 0xff4a12, numBg: 0xffb81c, numFg: 0x17181c, plate: 'MG 66-HT', pod: true, wing: 0xff4a12, spons: ['TAMARACK', 'NORTHGATE', 'ROTOR OIL'], number: '66' },
        { id: 'mint',      name: 'Alpine Mint', design: 'mint',      base: 0x35d6a4, a: 0x3a1a6b, b: 0xf4f6f8, c: 0x1a0d36, wheel: 0xf4f6f8, numBg: 0xf4f6f8, numFg: 0x3a1a6b, plate: 'AM 12-IN', wing: 0x3a1a6b, spons: ['BRINDLE BANK', 'HALCYON', 'PIKE RACING'], number: '12' },
      ] },
    { id: 'strada', name: 'Strada HF', blurb: 'Light and punchy. Quicker away and loves a long slide.', accel: 1.06, top: 1.02, grip: 0.97, drift: 1.05, turn: 1.12, rear: 0.95, rearDrive: 1.15,
      paint: 0xd8342c, stripe: 0xf4f6f8, skirt: 0x1b1d20, number: '4',
      liveries: [
        { id: 'signal',  name: 'Signal Red',   design: 'signal', base: 0xd8342c, a: 0xf4f6f8, b: 0x1b1d20, c: 0x1b1d20, wheel: 0xf4f6f8, numBg: 0xf4f6f8, numFg: 0x1b1d20, plate: 'SR 04-HF', wing: 0x1b1d20, spons: ['ROTOR OIL', 'KETTLE CO-OP', 'BRINDLE'] },
        { id: 'lime',    name: 'Lime Rush',    design: 'lime',   base: 0xb7e81c, a: 0x15161a, b: 0x12b7c4, c: 0x15161a, wheel: 0x24272c, numBg: 0x15161a, numFg: 0xb7e81c, plate: 'LR 88-ZP', wing: 0x15161a, spons: ['TAMARACK', 'HALCYON', 'NORTHGATE'], number: '88' },
        { id: 'violet',  name: 'Violet Storm', design: 'violet', base: 0x6a2bd6, a: 0x19e0e0, b: 0xf4f6f8, c: 0x1b0d3d, wheel: 0x19e0e0, numBg: 0xf4f6f8, numFg: 0x4a1aa8, plate: 'VS 23-ZZ', wing: 0x19e0e0, spons: ['PIKE RACING', 'ROTOR OIL', 'AUROC'], number: '23' },
        { id: 'arctic',  name: 'Silver Shard', design: 'arctic', base: 0xc9ced6, a: 0x0f6b5e, b: 0xff3d8a, c: 0x0f6b5e, wheel: 0xff3d8a, numBg: 0xff3d8a, numFg: 0xf4f6f8, plate: 'SS 19-IC', wing: 0x0f6b5e, spons: ['NORTHGATE', 'KETTLE CO-OP', 'HALCYON'], number: '19' },
      ] },
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

  camera: { chaseDistance: 6.6, chaseHeight: 2.3, chaseLag: 7.0, rallyDistance: 15, rallyHeight: 10.5, rallyLookAhead: 7,
    // extra camera mode 4 (low far view, shows the sky): same follow as the far rally camera, lower and looking further ahead
    lowDistance: 15, lowHeight: 6.8, lowLookAhead: 15,
    // mode 5: low, close chase. Sits near the road so it rushes past; pulls back, rises a little and widens the view with speed (0 to 45 m/s)
    closeDistance: 4.6, closePull: 1.8, closeHeight: 1.25, closeRise: 0.25, closeLookAhead: 7, closeFov: 66, closeFovGain: 16 },
};

