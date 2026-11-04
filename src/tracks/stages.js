/* =====================================================================
   STAGES. Each stage has a route (segments), surfaces, checkpoints, terrain, scenery theme and lighting.
   Segments: ['S', length m] straight, ['L'|'R', angle °, radius m] corner.
   ===================================================================== */
function forestHeight(x, z) {
  return 16 * Math.sin(x * 0.0042 + 0.7) * Math.cos(z * 0.0037 - 0.4)
    + 7 * Math.sin(x * 0.011 + z * 0.006 + 1.3)
    + 3.2 * Math.sin(x * 0.027 - z * 0.019) * Math.cos(z * 0.031 + x * 0.008)
    + 1.1 * Math.sin(x * 0.07 + 1.1) * Math.sin(z * 0.063);
}
function rockNoise(x, z) {
  return 6 * Math.sin(x * 0.013 + 0.4) * Math.cos(z * 0.011 - 1.2)
    + 3 * Math.sin(x * 0.031 - z * 0.027 + 2.0)
    + 1.6 * Math.sin(x * 0.071 + 0.3) * Math.sin(z * 0.064 + 1.7);
}
function japanHeight(x, z) {
  return 24 * Math.sin(x * 0.0034 + 1.1) * Math.cos(z * 0.0031 - 0.6)
    + 9 * Math.sin(x * 0.009 + z * 0.007 + 0.5)
    + 2.6 * Math.sin(x * 0.026 - z * 0.021) * Math.cos(z * 0.017 + x * 0.011);
}

const STAGES = [
  {
    id: 'kettle', code: 'SS1', name: 'Kettle Ridge', place: 'Forest hills',
    blurb: 'Rolling forest roads: fast tarmac, loose gravel, then snow over the top. One big crest.',
    bestKey: 'kettleRidgeBest_v1', seed: 7, theme: 'forest', terrain: 'blend', height: forestHeight,
    roadHalfWidth: 4.2, runoff: 150,
    surfaceChanges: [[0, 'tarmac'], [820, 'gravel'], [1790, 'snow']],
    snowFrom: 1790,
    checkpoints: [520, 1030, 1520, 2030],
    timeStart: 28, timeExt: [29, 25, 26, 22], refTime: 109,   // refTime: a steady clean run; rival times are spread around it    // arcade clock: seconds at the start, + at each checkpoint
    jumps: [[1450, 2.3]],
    segments: [
      ['S', 120], ['L', 35, 180], ['S', 80], ['R', 70, 80], ['S', 60], ['L', 90, 40],
      ['S', 140], ['R', 30, 250], ['S', 100], ['L', 60, 60], ['S', 60], ['R', 165, 17],
      ['S', 90], ['L', 165, 17], ['S', 70], ['R', 50, 90], ['S', 210], ['L', 80, 48],
      ['R', 80, 48], ['S', 120], ['R', 45, 120], ['L', 120, 30], ['S', 100], ['R', 100, 34],
      ['S', 80], ['L', 40, 150], ['S', 150], ['S', 150],
    ],
    look: {
      skyTop: 0x2f7fe0, skyMid: 0x7cc2ff, horizon: 0xc4e8ff, fogNear: 140, fogFar: 620,
      hemiSky: 0xdcefff, hemiGround: 0x6a7fb0, hemi: 0.5, sun: 0xfff3dc, sunI: 0.85, sunDir: [-70, 110, -45],
      cloud: 0xffffff, ink: 0x1c2440,
      grassA: [0.34, 0.62, 0.30], grassB: [0.48, 0.72, 0.32], dirt: [0.74, 0.60, 0.40], snow: [0.90, 0.94, 1.0], rock: [0.62, 0.60, 0.66],
    },
  },
  {
    id: 'vulture', code: 'SS2', name: 'Vulture Ledge', place: 'High mountains',
    blurb: 'All dirt and gravel, cut into the side of a mountain. Rock wall on one side, a long drop on the other.',
    bestKey: 'rallyBest_vulture', seed: 21, theme: 'alpine', terrain: 'cliff', height: rockNoise,
    roadHalfWidth: 3.7, runoff: 150, cell: 3,
    surfaceChanges: [[0, 'gravel'], [640, 'dirt'], [1360, 'gravel'], [1900, 'dirt']],
    snowLine: 95,
    checkpoints: [560, 1150, 1700, 2150],
    timeStart: 29, timeExt: [31, 23, 21, 11], refTime: 107,
    jumps: [[1320, 1.7]],
    // grade profile (fraction): the road climbs and dips along the mountainside
    elevation: s => 0.075 * Math.sin(s / 150 + 0.4) * 150 + 0.035 * Math.sin(s / 52) * 52 + s * 0.02,
    // which side rises into a rock wall (1) or falls away (0): [s, left, right], blended between keys
    // left wall → narrow ridge (drops both sides) → right wall → hairpin flips it → left wall → ridge → right wall
    cliffSides: [[0, 1, 0], [600, 1, 0], [650, 0, 0], [740, 0, 0], [790, 0, 1], [1080, 0, 1], [1125, 1, 0], [1860, 1, 0], [1900, 0, 0], [1960, 0, 0], [2000, 0, 1]],
    segments: [
      ['S', 110], ['R', 30, 140], ['S', 80], ['L', 55, 70], ['S', 60], ['R', 80, 45], ['S', 90],
      ['L', 35, 160], ['S', 120], ['L', 95, 38], ['S', 70], ['R', 45, 90], ['S', 110],
      ['R', 150, 18], ['S', 70], ['L', 60, 60], ['S', 100], ['L', 30, 200], ['S', 140],
      ['R', 70, 50], ['S', 80], ['L', 110, 30], ['S', 90], ['R', 40, 120], ['S', 100],
      ['R', 60, 70], ['S', 90], ['L', 45, 110], ['S', 120], ['S', 150],
    ],
    look: {
      skyTop: 0x1a5bd0, skyMid: 0x5aa8ff, horizon: 0xd8f0ff, fogNear: 220, fogFar: 1000,
      hemiSky: 0xe6f3ff, hemiGround: 0x7a6f9a, hemi: 0.52, sun: 0xffffff, sunI: 0.95, sunDir: [-60, 120, 40],
      cloud: 0xffffff, ink: 0x1c2440,
      grassA: [0.42, 0.62, 0.30], grassB: [0.56, 0.68, 0.34], dirt: [0.70, 0.56, 0.40], snow: [0.95, 0.97, 1.0], rock: [0.50, 0.43, 0.47],
    },
  },
  {
    id: 'sakura', code: 'SS3', name: 'Sakura Touge', place: 'Japan at dusk',
    blurb: 'Rice paddies and cherry trees, a tunnel of torii gates, a hairpin mountain pass, then a run into a neon town.',
    bestKey: 'rallyBest_sakura', seed: 33, theme: 'japan', terrain: 'blend', height: japanHeight,
    roadHalfWidth: 4.4, runoff: 150,
    surfaceChanges: [[0, 'tarmac'], [1250, 'gravel'], [1620, 'tarmac']],
    checkpoints: [600, 1150, 1700, 2150],
    timeStart: 24, timeExt: [29, 27, 21, 11], refTime: 102,
    jumps: [],
    cityLength: 640,                 // the last part of the run is in town
    toriiTunnel: [580, 672],
    flatRoad: [{ from: 0, to: 330, ramp: 300 }, { city: true, ramp: 300 }],
    segments: [
      ['S', 180], ['L', 20, 300], ['S', 120], ['R', 45, 110], ['S', 70], ['S', 120], ['L', 70, 60], ['S', 60],
      ['R', 160, 16], ['S', 70], ['L', 160, 16], ['S', 90], ['R', 60, 55], ['S', 60], ['L', 80, 40], ['S', 120],
      ['R', 125, 24], ['S', 80], ['L', 140, 18], ['S', 90],
      ['R', 35, 140], ['S', 100], ['L', 50, 80], ['S', 140], ['R', 90, 20], ['S', 130], ['L', 90, 20], ['S', 200], ['S', 150],
    ],
    look: {
      skyTop: 0x34388a, skyMid: 0xf08f86, horizon: 0xffd2a2, fogNear: 150, fogFar: 640,
      hemiSky: 0xffe0d0, hemiGround: 0x6a5a9e, hemi: 0.6, sun: 0xffcf9f, sunI: 0.78, sunDir: [90, 55, 70],
      cloud: 0xffd2c4, ink: 0x2a1f40,
      grassA: [0.36, 0.60, 0.30], grassB: [0.50, 0.68, 0.30], dirt: [0.72, 0.58, 0.42], snow: [0.9, 0.94, 1.0], rock: [0.60, 0.56, 0.62],
    },
  },
];
CONFIG.stage = STAGES[0];

