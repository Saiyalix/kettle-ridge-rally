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

// SS4 Thornwick Keep: gentle rolling country with the castle hill in the middle of it. The route climbs onto a flat plateau (the courtyard) and down again.
// The castle (src/tracks/castle.js) is placed from the route: ST.castle.gate1 / gate2 are the s values of the two gates.
function thornRolling(x, z) {
  return 4.2 * Math.sin(x * 0.0052 + 0.7) * Math.cos(z * 0.0047 - 0.4)
    + 2.2 * Math.sin(x * 0.011 + z * 0.007 + 1.3)
    + 0.8 * Math.sin(x * 0.027 - z * 0.019) * Math.cos(z * 0.031 + x * 0.008);
}
let _castleST = null;
const castleCfg = () => _castleST || (_castleST = STAGES.find(s => s.theme === 'castle'));
// the ground without the moat: flat at the castle level inside and 20 m around the walls, then easing down to the rolling country over 300 m
function castleBase(x, z) {
  const ST = castleCfg(), C = ST.castle, F = castleFrame(C, ST.segments), [u, v] = castleToLocal(F, x, z);
  const d = castleRectDist(F.rect, u, v), m = 1 - smoothstep(clamp((d - 20) / 300, 0, 1)), b = thornRolling(x, z);
  return b + (C.level - b) * m;
}
// the ground with the moat: a ditch 5 to 17 m outside the walls. The road (and its blend into the ground) crosses it on a causeway at each gate.
function castleHeight(x, z) {
  const ST = castleCfg(), F = castleFrame(ST.castle, ST.segments), [u, v] = castleToLocal(F, x, z);
  const d = castleRectDist(F.rect, u, v), k = clamp((d - 11) / 6, -1, 1);
  return castleBase(x, z) - (d > 0 ? 3.4 * 0.5 * (1 + Math.cos(Math.PI * k)) : 0);
}
const THORN_PRE = [
  ['S', 120], ['L', 25, 200], ['S', 50], ['R', 30, 140], ['S', 50], ['L', 45, 90], ['S', 40],                                    // start, village street
  ['R', 60, 70], ['S', 40], ['L', 85, 38], ['S', 70], ['R', 30, 150], ['S', 80], ['L', 55, 60], ['S', 40], ['R', 100, 34], ['S', 40],   // forest (bridge hump on the 80 m straight)
  ['R', 70, 50], ['S', 30], ['L', 140, 24], ['S', 30], ['R', 60, 80], ['S', 20], ['L', 40, 100], ['S', 53],                  // the climb to the castle
];
const THORN_CASTLE = [['S', 40], ['R', 90, 18], ['S', 62], ['S', 7]];                                                           // gate 1 (middle of the arch) -> courtyard corner -> gate 2 -> out
const THORN_POST = [
  ['S', 25], ['R', 100, 40], ['S', 40], ['L', 55, 60], ['S', 40], ['R', 75, 45], ['S', 40], ['L', 60, 55], ['S', 50],             // winding descent past the wall and moat
  ['R', 40, 100], ['S', 60], ['L', 70, 50], ['S', 50], ['R', 50, 70], ['S', 80], ['S', 150],                                      // down to the meadow
];
const THORN_G1 = THORN_PRE.reduce((a, g) => a + segLen(g), 0), THORN_G2 = THORN_G1 + THORN_CASTLE.slice(0, 3).reduce((a, g) => a + segLen(g), 0);

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
    // look: bright day. Big painted cumulus on deep blue, crisp sun. (sunEl / sunAz = degrees above the horizon / compass bearing, 0 = start direction)
    look: {
      skyTop: 0x1a5fd8, skyMid: 0x4a9cf2, horizon: 0xcfe8ff, fogNear: 150, fogFar: 640,
      hemiSky: 0xdcefff, hemiGround: 0x5c7050, hemi: 1.1, sun: 0xfff1d8, sunI: 3.6, exposure: 1.1, sunEl: 52, sunAz: -123,
      ink: 0x1c2440, env: [0x7ab8ff, 0xeaf5ff, 0x5a6a3a],
      sky: { clouds: 'cumulus', seed: 5, sunCol: 0xfffbe8, sunSize: 0.03, glowCol: 0xfff0c0, glowAmt: 0.35, band: 0, shade: 0x9fb8e0, lit: 0xffffff, rim: 0xfff4cc },
      ridge: [
        { col: 0x9cbbe6, base: 2, amp: 80, per: 5, oct: 4, jag: 1, mist: 0.5, snow: 0xffffff },
        { col: 0x86b2dc, base: -14, amp: 56, per: 7, oct: 4, jag: 0, mist: 0.45 },
        { col: 0x6fa6a6, base: -30, amp: 40, per: 9, oct: 3, jag: 0, mist: 0.4, trees: 1, treeCol: 0x4f8f8a },
      ],
      grade: { tint: [1.02, 1.0, 0.97], sat: 1.2, con: 1.07, bloom: 0.4, thresh: 0.86, vig: 0.3 },
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
    // look: late-afternoon sunset. Low warm sun, long shadows, orange-purple sky, purple haze in the distance
    look: {
      skyTop: 0x241a68, skyMid: 0x9a4f9e, horizon: 0xb877a8, fogNear: 200, fogFar: 900,
      hemiSky: 0xb8a4ec, hemiGround: 0x50407a, hemi: 2.2, sun: 0xffbf86, sunI: 6.2, exposure: 1.0, sunEl: 17, sunAz: -60,
      ink: 0x2a1c44, env: [0x6a4a9a, 0xff9a70, 0x4a3050], shadowBias: -0.0006, shadowNormal: 0.05, dust: 0.8,
      sky: { clouds: 'sunset', seed: 12, sunCol: 0xfff2c0, sunSize: 0.05, glowCol: 0xff9238, glowAmt: 0.9, band: 0.9, shade: 0x4a2a70, lit: 0xff9a52, rim: 0xffe08a },
      ridge: [
        { col: 0xf0a49a, base: 4, amp: 100, per: 5, oct: 4, jag: 1, mist: 0.55 },
        { col: 0xc87ba4, base: -10, amp: 84, per: 6, oct: 4, jag: 1, mist: 0.5 },
        { col: 0x8f5a9e, base: -22, amp: 66, per: 8, oct: 4, jag: 1, mist: 0.4 },
        { col: 0x5b3d7e, base: -36, amp: 46, per: 10, oct: 3, jag: 0, mist: 0.3, trees: 1 },
      ],
      noPeaks: true,
      grade: { tint: [1.04, 0.98, 0.95], lift: [0.012, 0.0, 0.03], sat: 1.0, con: 1.1, bloom: 0.5, thresh: 0.8, bloom2: 0.2, vig: 0.38 },
      grassA: [0.42, 0.62, 0.30], grassB: [0.56, 0.68, 0.34], dirt: [0.70, 0.56, 0.40], snow: [0.95, 0.97, 1.0], rock: [0.50, 0.43, 0.47],
    },
  },
  {
    id: 'sakura', code: 'SS3', name: 'Sakura Touge', place: 'Japan by night',
    blurb: 'Rice paddies and cherry trees under the moon, a lantern-lit tunnel of torii gates, a hairpin mountain pass, then a run into a glowing neon town.',
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
    // look: night. Stars and a moon, a glowing city on the horizon, lit windows and lanterns, headlights on the road
    look: {
      night: true, flare: false, dust: 0.45,
      skyTop: 0x03051a, skyMid: 0x0e1650, horizon: 0x1f2658, fogNear: 110, fogFar: 560,
      hemiSky: 0x7080e8, hemiGround: 0x20285a, hemi: 1.5, sun: 0x9fb0ff, sunI: 2.0, exposure: 0.85, sunEl: 10, sunAz: 12, lightEl: 38, lightAz: 12,
      ink: 0x10142c, env: [0x141a48, 0x3a4090, 0x10142c], shadowBias: -0.0006, shadowNormal: 0.04,
      sky: { clouds: 'night', seed: 31, stars: 1, moon: 1, city: 1, cityAt: 0, sunCol: 0xf6f2e4, sunSize: 0.045, glowCol: 0x7c88e8, glowAmt: 0.5, band: 0.35, shade: 0x070a1e, lit: 0x4a5a98, rim: 0x9fb0f0 },
      ridge: [
        { col: 0x141a4c, base: 3, amp: 64, per: 5, oct: 4, jag: 1, mist: 0.4 },
        { col: 0x090c26, base: -6, amp: 20, per: 9, oct: 3, jag: 0, mist: 0.1, trees: 1 },
      ],
      noPeaks: true, peak: [0x0c1138, 0x4a528c],
      nightGlow: { road: 0x9aa4c8, roadI: 0.8, reach: 40, pool: 0.35 },
      grade: { tint: [0.95, 0.98, 1.06], lift: [0.004, 0.008, 0.024], sat: 1.12, con: 1.1, bloom: 0.55, thresh: 0.78, bloom2: 0.4, vig: 0.42 },
      grassA: [0.36, 0.60, 0.30], grassB: [0.50, 0.68, 0.30], dirt: [0.72, 0.58, 0.42], snow: [0.9, 0.94, 1.0], rock: [0.60, 0.56, 0.62],
      foliageTint: [1.0, 0.82, 0.86], rockCaps: { moss: { col: [0.14, 0.26, 0.16], amt: 0.5 }, snow: { col: [0.8, 0.85, 1.0], amt: 0.9 }, none: { col: [0, 0, 0], amt: 0 } },
    },
  },
  {
    id: 'thornwick', code: 'SS4', name: 'Thornwick Keep', place: 'Castle hills at dawn',
    blurb: 'Gravel only. A village street, a misty forest climb, then in through the gatehouse, round the well in the castle courtyard and out the far gate. Down past the moat to the meadow.',
    bestKey: 'rallyBest_thornwick', seed: 47, theme: 'castle', terrain: 'blend', height: castleHeight, roadHeight: castleBase, roadSmooth: { W: 6, passes: 2 },
    roadHalfWidth: 4.0, runoff: 150,
    surfaceChanges: [[0, 'gravel']],
    checkpoints: [560, 1100, 1700, 2120],
    timeStart: 31, timeExt: [26, 31, 22, 16], refTime: 111,
    jumps: [[850, 1.9]],
    castle: { gate1: THORN_G1, gate2: THORN_G2, level: 14, west: 70, northPast: 42, well: [40, 18] },
    segments: [...THORN_PRE, ...THORN_CASTLE, ...THORN_POST],
    // look (art): a misty morning at dawn. Low warm sun behind the player on the approach (long shadows, the castle front glows), pale golden sky,
    // soft peach mist in the valleys (fog starts close, so far hills and the keep melt into it), cool blue shade, dew-bright meadows.
    look: {
      skyTop: 0x6c92c6, skyMid: 0xc9c9d6, horizon: 0xf2dcbc, fogNear: 38, fogFar: 330,
      hemiSky: 0xd8e2f4, hemiGround: 0xa08a6a, hemi: 1.45, sun: 0xffc486, sunI: 3.4, exposure: 1.08, sunEl: 12, sunAz: 232,
      ink: 0x2a2a3c, env: [0x9ab4d6, 0xf6dcb4, 0x6a5e44],
      sky: { clouds: 'cumulus', seed: 14, sunCol: 0xffe0a8, sunSize: 0.05, glowCol: 0xffbe78, glowAmt: 0.95, band: 0.6, shade: 0xb6a8c4, lit: 0xfff0d6, rim: 0xffcf98 },
      ridge: [
        { col: 0xc9b9c9, base: 2, amp: 70, per: 5, oct: 4, jag: 0, mist: 0.62 },
        { col: 0xb2b4c4, base: -14, amp: 50, per: 7, oct: 4, jag: 0, mist: 0.58 },
        { col: 0x9aa8a4, base: -30, amp: 36, per: 9, oct: 3, jag: 0, mist: 0.52, trees: 1, treeCol: 0x6f8c80 },
      ],
      grade: { tint: [1.05, 1.0, 0.93], sat: 1.1, con: 1.05, bloom: 0.55, thresh: 0.8, vig: 0.32 },
      grassA: [0.30, 0.52, 0.26], grassB: [0.52, 0.66, 0.30], dirt: [0.66, 0.54, 0.38], snow: [0.90, 0.94, 1.0], rock: [0.66, 0.62, 0.62],
    },
  },
];
CONFIG.stage = STAGES[0];

