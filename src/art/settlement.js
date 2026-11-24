  /* ---------- settlement kit (art): farms, villages, lodges, stations, power lines, cattle, trains for tracks to place ----------
     tracks decides WHERE and HOW MANY; this file only decides how things look. Nothing here adds an obstacle: if the car can hit it, push your own
     `obstacles` entry. Everything is built from merged boxes, tubes and swept shapes (art/modeller.js), vertex-coloured, one shared material and one
     small picture atlas (printed boards, km digits). Every model has a high and a low variant (quality === 'low', or opts.low = true).

     Frame of every model: origin on the ground in the middle, the front ("door side", the nose of vehicles) looks along local +z. rot = yaw in radians:
     the front then looks along (sin rot, cos rot). Facing a road on your right: rot = p.th - PI/2 (p = track sample; the sample's th is the road direction).
     Ground height comes from terrain.heightAt unless you give y. Buildings carry a stone plinth that reaches 1.5 m below the floor, so they sit on slopes.

       settle.cluster(items, opts)   ONE merged mesh (one draw call) for everything in items; cullFar can hide it. items: [{ kind, x, z, rot, y?, ...modelOptions }].
                                     opts: smoke (default true on high, false on low: chimney smoke billboards, one more draw call), glow (default true: at night the
                                     lit windows and lamps push glowSpots), low. Returns { mesh, tris, smoke, glows } ('smoke' = world positions of chimneys).
       settle.<kind>(x, z, rot, opts)  one model on its own = settle.cluster([{ kind, x, z, rot, ...opts }]).  Kinds (model options in brackets):
         farm:       barn  farmhouse  silo (twin)  hayRolls  gate (w)
         village:    church  inn (name)  shop (name)  marketCross  busShelter  mailboxes
         alpine:     chalet (snow)  hut (snow)  liftPylon  avalancheSign          (snow stakes: settle.snowStakes)
         japan:      restStop  onsen  station  trafficLight (state: 'red' | 'amber' | 'green')  levelCrossing (open)
         desert:     tradingPost (name)  gasStation  waterTower  headframe  conveyor (len, rise)  windpump  boxcars (count)
         service:    teamVan (color)  trailer (color)  timingHut
         shared:     signpost { boards: [{ lines: ['SAWMILL GAP 6', 'SKARNFELL 38'], shape: 'direction' | 'entry' | 'route', dir: 1 | -1 }] }  (or lines / shape / dir directly)
         common model options: col (main wall colour [r,g,b] 0..1), roof (roof colour), lit (windows glow, default true), name (printed on shop / inn / post boards)
       settle.instance(kind, list, opts)    many of one small model as ONE instanced mesh. list: [{ x, z, yaw, y?, s?, color? }]
       settle.kmPosts(list)         km posts with printed number: list items { x, z, yaw, n }  (n = 0..99, instanced, digits chosen per instance)
       settle.snowStakes(list)      road-edge poles with red tops
       settle.cattle(list)          low-poly cows, instanced; color (hex) tints a white/black cow
       settle.powerLine(pts, opts)  poles at pts [{x, z, y?}] (yaw follows the line) + 3 sagging wires. opts: sag (0.7), height (8.3), xfmr (every n-th pole gets a transformer)
       settle.liftLine(pts, opts)   ski-lift: a liftPylon at each point + two cables with chairs (opts.chairs spacing m, default 40; none on low)
       settle.railway(pts, opts)    embankment with ballast, two rails and sleepers along pts; returns { mesh, y(s) }. opts: height (0.9 crest above ground at the ends)
       settle.train(opts)           moving train, ONE mesh in a group: { x0, z0, x1, z1, cars (4), speed (m/s, 24), loop pause } on a straight line (same line as railway)
       settle.smoke(list)           chimney smoke billboards: list { x, y, z, s?, color? } (the cluster does this itself for chimneys)
       settle.update(dt)            called by renderFrame: smoke time and trains. Nothing is allocated per frame.
       settle.stats(kind)           { high, low } triangle counts of one model (for the QA / art budget table)
       Helpers:  sagPoints(out, a, b, sag, segs)   points of a sagging wire, flat [x,y,z,...] into out (the Japan poles in themes.js use it as well)
                 settleDemo()      the gallery on the Test Track start (placed by stage-load.js; keep as a showcase or delete the call) */

  const SG_GLOW = [1, 0, 0, 0], SG_TINT = [0, 1, 0, 0], SG_BOARD = [0.35, 0, 0, 0];
  const SP = {                                                                  // palette (display colours)
    red: [0.62, 0.15, 0.11], white: [0.93, 0.91, 0.85], cream: [0.92, 0.86, 0.70], wood: [0.52, 0.36, 0.22], dark: [0.28, 0.19, 0.13], stone: [0.64, 0.62, 0.57],
    slate: [0.30, 0.33, 0.40], tile: [0.68, 0.28, 0.18], glass: [0.17, 0.23, 0.31], warm: [1.0, 0.82, 0.45], metal: [0.68, 0.71, 0.76], conc: [0.74, 0.74, 0.72],
    sand: [0.82, 0.68, 0.46], adobe: [0.78, 0.58, 0.40], rust: [0.55, 0.30, 0.18], snow: [0.95, 0.97, 1.0], straw: [0.86, 0.72, 0.36], iron: [0.2, 0.2, 0.22],
  };
  const spMul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const spShade = (c) => (x, y, z, ny) => { const k = ny > 0.5 ? 1.1 : ny < -0.5 ? 0.62 : 1; return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)]; };

  /* ---- shapes ---- */
  // a one-sided quad that faces away from the point `ref` (so the winding never has to be thought about)
  function spFace(m, a, b, c, d, col, ref, o) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dot = nx * ((a[0] + c[0]) / 2 - ref[0]) + ny * ((a[1] + c[1]) / 2 - ref[1]) + nz * ((a[2] + c[2]) / 2 - ref[2]);
    if (d) { if (dot >= 0) m.quad(a, b, c, d, col, o); else m.quad(a, d, c, b, col, o); } else if (dot >= 0) m.tri(a, b, c, col, o); else m.tri(a, c, b, col, o);
  }
  // roof prism along x: prof = half profile [[rise, zFraction], ...] from the eave (zf 1) to the ridge (zf 0). Gable: [[0,1],[rh,0]]. Gambrel: [[0,1],[.55rh,.62],[rh,0]]
  const SP_GABLE = (rh) => [[0, 1], [rh, 0]], SP_GAMBREL = (rh) => [[0, 1], [rh * 0.55, 0.62], [rh, 0]];
  function spPrism(m, w, d, y, prof, ov, col, gcol, low) {
    const hw = w / 2 + ov, hd = d / 2 + ov, L = prof.map(([dy, zf]) => [y + dy - (dy === 0 ? 0.06 : 0), -zf * hd]), R = prof.slice(0, -1).reverse().map(([dy, zf]) => [y + dy - (dy === 0 ? 0.06 : 0), zf * hd]);
    const pts = L.concat(R), top = prof[prof.length - 1][0];
    m.sweep(pts, -hw, hw, col);
    for (const sx of [-1, 1]) {
      for (let i = 1; i < pts.length - 1; i++) spFace(m, [sx * hw, pts[0][0], pts[0][1]], [sx * hw, pts[i][0], pts[i][1]], [sx * hw, pts[i + 1][0], pts[i + 1][1]], null, col, [0, y + top / 2, 0]);
      // the gable wall under the overhang
      const gp = prof.map(([dy, zf]) => [y + dy, -zf * d / 2]).concat(prof.slice(0, -1).reverse().map(([dy, zf]) => [y + dy, zf * d / 2]));
      for (let i = 1; i < gp.length - 1; i++) spFace(m, [sx * (w / 2 + 0.01), gp[0][0], gp[0][1]], [sx * (w / 2 + 0.01), gp[i][0], gp[i][1]], [sx * (w / 2 + 0.01), gp[i + 1][0], gp[i + 1][1]], null, gcol || col, [0, y + top / 2, 0]);
    }
  }
  function spHip(m, w, d, y, rh, ov, col) {                                    // hip roof, ridge along x
    const hw = w / 2 + ov, hd = d / 2 + ov, rl = Math.max(0.05, (w - d) / 2), ref = [0, y - 1, 0], t = y + rh;
    spFace(m, [-hw, y, hd], [hw, y, hd], [rl, t, 0], [-rl, t, 0], col, ref); spFace(m, [hw, y, -hd], [-hw, y, -hd], [-rl, t, 0], [rl, t, 0], col, ref);
    spFace(m, [hw, y, hd], [hw, y, -hd], [rl, t, 0], null, col, ref); spFace(m, [-hw, y, -hd], [-hw, y, hd], [-rl, t, 0], null, col, ref);
  }
  function spPyr(m, x, y, z, sx, sz, h, col) {                                 // four-sided spire / pyramid roof
    const a = [x - sx / 2, y, z - sz / 2], b = [x + sx / 2, y, z - sz / 2], c = [x + sx / 2, y, z + sz / 2], d = [x - sx / 2, y, z + sz / 2], t = [x, y + h, z], ref = [x, y + h * 0.3, z];
    spFace(m, a, b, t, null, col, ref); spFace(m, b, c, t, null, col, ref); spFace(m, c, d, t, null, col, ref); spFace(m, d, a, t, null, col, ref);
  }
  const spFound = (m, w, d, col) => m.box(0, -0.7, 0, w + 0.3, 1.6, d + 0.3, col || SP.stone);
  const spWin = (c, x, y, z, w, h, glowing, trim) => {                         // a window on the +z wall (z = wall surface)
    const m = c.m; if (!c.low) m.box(x, y, z + 0.015, w + 0.2, h + 0.2, 0.05, trim || SP.white);
    m.box(x, y, z + 0.04, w, h, 0.05, glowing ? SP.warm : SP.glass, glowing ? { tw: SG_GLOW } : {});
    if (glowing && c.glow.length < 6) c.glow.push([x, y, z + 0.3, 0xffc070, 1.1]);
  };
  const spDoor = (m, x, w, h, col, trim) => { m.box(x, h / 2, 0, w, h, 0.1, col || SP.dark); };
  function spChimney(c, x, y, z, w, h, col) {
    const m = c.m; m.box(x, y + h / 2, z, w, h, w, col || SP.stone); if (!c.low) m.box(x, y + h + 0.06, z, w + 0.18, 0.14, w + 0.18, spMul(col || SP.stone, 0.8));
    c.smoke.push([x, y + h + 0.3, z]);
  }
  // models are built along x with the front at +x, then turned so the front looks along +z
  const spAlong = (m, fn) => m.at(0, 0, 0, -Math.PI / 2, fn);
  function spHall(c, w, d, h, rh, wall, roof, o = {}) {
    const m = c.m; m.box(0, h / 2, 0, w, h, d, spShade(wall));
    spPrism(m, w, d, h, o.gambrel ? SP_GAMBREL(rh) : SP_GABLE(rh), o.ov == null ? 0.4 : o.ov, spShade(roof), spShade(wall), c.low);
    if (o.snow) spPrism(m, w, d, h + 0.1, o.gambrel ? SP_GAMBREL(rh) : SP_GABLE(rh), (o.ov == null ? 0.4 : o.ov) + 0.05, SP.snow, null, c.low);
  }

  /* ---- models: MODELS[kind](c) draws into c.m; c.o = options, c.low, c.smoke / c.glow collect chimneys and lamps ---- */
  const MODELS = {};
  // FARM
  MODELS.barn = (c) => {
    const { m, low, o } = c, wall = o.col || SP.red, roof = o.roof || [0.36, 0.38, 0.43], L = 13, D = 9;
    spFound(m, D, L); spAlong(m, () => {
      spHall(c, L, D, 4.2, 3.6, wall, roof, { gambrel: true, ov: 0.35 });
      m.box(L / 2 + 0.03, 1.6, 0, 0.1, 3.2, 3.6, SP.dark);                      // big doors with white cross braces
      m.box(L / 2 + 0.07, 1.6, -1.8, 0.1, 3.3, 0.16, SP.white); m.box(L / 2 + 0.07, 1.6, 1.8, 0.1, 3.3, 0.16, SP.white); m.box(L / 2 + 0.07, 3.28, 0, 0.1, 0.16, 3.8, SP.white); m.box(L / 2 + 0.07, 1.6, 0, 0.1, 0.16, 3.6, SP.white);
      if (!low) { for (const s of [-1, 1]) m.box(L / 2 + 0.08, 1.6, 0, 0.08, 0.14, 4.6, SP.white, { rx: s * 0.72 }); m.box(L / 2 + 0.05, 5.7, 0, 0.1, 1.5, 1.8, SP.dark); m.box(L / 2 + 0.08, 5.7, 0, 0.1, 0.12, 2.0, SP.white); for (const cx of [-L / 2 + 0.2, L / 2 - 0.2]) for (const sz of [-1, 1]) m.box(cx, 2.1, sz * (D / 2 + 0.02), 0.28, 4.2, 0.05, SP.white);
        for (const x of [-3.5, 0, 3.5]) for (const sz of [-1, 1]) m.box(x, 2.8, sz * (D / 2 + 0.03), 1.0, 0.7, 0.05, SP.white), m.box(x, 2.8, sz * (D / 2 + 0.05), 0.8, 0.5, 0.05, SP.glass);
        m.box(0, 8.1, 0, 1.2, 0.9, 1.2, SP.white); spPyr(m, 0, 8.55, 0, 1.5, 1.5, 0.9, SP.slate); }
    });
  };
  MODELS.farmhouse = (c) => {
    const { m, low, o } = c, wall = o.col || SP.white, roof = o.roof || SP.tile, lit = o.lit !== false;
    spFound(m, 9, 6.5); spHall(c, 9, 6.5, 3.2, 2.5, wall, roof);
    for (const x of [-3, 3]) spWin(c, x, 1.7, 3.25, 1.0, 1.2, lit && x > 0); spWin(c, -3, 4.4 - 0.6, 3.25, 0.0001, 0.0001, false);
    spDoor(m, 0, 1.1, 2.1, SP.dark); m.at(0, 0, 3.25, 0, () => spDoor(m, 0, 1.1, 2.1, SP.wood));
    m.box(0, 2.55, 3.9, 3.0, 0.14, 1.6, SP.dark); if (!low) for (const x of [-1.4, 1.4]) m.box(x, 1.25, 4.5, 0.12, 2.5, 0.12, SP.white);
    spChimney(c, 2.6, 3.4, -0.4, 0.8, 2.4); if (!low) { m.box(-2.4, 4.2, 0, 1.6, 1.5, 0.12, wall); m.box(-2.4, 3.0, 1.2, 1.6, 1.1, 2.4, wall, { rx: -0.0 }); }
  };
  MODELS.silo = (c) => {
    const { m, low, o } = c, seg = low ? 7 : 10, steel = o.col || [0.70, 0.75, 0.80];
    const one = (x, h, r) => { m.cyl([x, -1, 0], [x, h, 0], r, r, seg, steel); m.sph(x, h, 0, r, r * 0.55, r, seg, 4, spMul(steel, 0.85), { cap: Math.PI / 2 }); if (!low) { for (let y = 2; y < h; y += 2.4) m.cyl([x, y, 0], [x, y + 0.14, 0], r + 0.05, r + 0.05, seg, spMul(steel, 0.7)); m.box(x, h / 2, r + 0.06, 0.5, h - 1, 0.1, SP.iron); } };
    one(0, 11, 2.3); if (o.twin) { one(5.0, 8.5, 1.9); m.box(2.5, 7, 0, 3, 0.5, 0.5, SP.metal); }
  };
  MODELS.hayRolls = (c) => {
    const { m, low, o } = c, r = 0.8, col = o.col || SP.straw, seg = low ? 6 : 8, rows = [[-1.7, 0, 1.7], [-0.85, 0.85], [0]];
    rows.forEach((row, j) => row.forEach((x) => { const y = r + j * 1.39; m.cyl([x, y, -0.65], [x, y, 0.65], r, r, seg, col); if (!low) m.cyl([x, y, 0.66], [x, y, 0.67], r * 0.6, r * 0.6, seg, spMul(col, 0.78)); }));
  };
  MODELS.gate = (c) => {
    const { m, low, o } = c, w = o.w || 3.6, wood = SP.wood, n = low ? 3 : 5;
    for (const sx of [-1, 1]) m.box(sx * (w / 2 + 0.1), 0.75, 0, 0.2, 1.5, 0.2, SP.dark);
    for (let i = 0; i < n; i++) m.box(0, 0.25 + i * (1.0 / (n - 1)), 0, w, 0.09, 0.06, wood);
    m.box(0, 0.75, 0, 0.09, 1.1, 0.06, wood); if (!low) m.box(0, 0.75, 0, w * 1.02, 0.09, 0.05, wood, { rz: 0.32 });
    for (const sx of [-1, 1]) for (let k = 1; k <= 2; k++) { const x = sx * (w / 2 + 0.1 + k * 2); m.box(x, 0.55, 0, 0.14, 1.1, 0.14, SP.dark); for (const y of [0.4, 0.85]) m.box(sx * (w / 2 + 0.1 + k * 2 - 1), y, 0, 2.0, 0.07, 0.05, wood); if (low) break; }
  };
  // VILLAGE
  MODELS.church = (c) => {
    const { m, low, o } = c, wall = o.col || [0.78, 0.74, 0.66], roof = o.roof || SP.slate, L = 12, D = 6.6;
    spFound(m, D, L + 4); spAlong(m, () => {
      spHall(c, L, D, 5.2, 3.2, wall, roof, { ov: 0.3 });
      const tx = L / 2 + 0.6; m.box(tx, 6.5, 0, 4.4, 13, 4.4, spShade(wall)); m.box(tx, 13.2, 0, 4.8, 0.4, 4.8, spMul(wall, 0.8));
      spPyr(m, tx, 13.4, 0, 4.6, 4.6, 6.5, spShade(roof)); m.cyl([tx, 19.8, 0], [tx, 21.2, 0], 0.05, 0.05, 4, SP.iron); m.box(tx, 20.8, 0, 0.5, 0.07, 0.07, SP.iron);
      m.box(tx + 2.21, 3.4, 0, 0.1, 2.8, 1.3, SP.dark);                          // door in the tower front
      for (const [dx, dz, rx] of [[2.21, 0, 0], [0, 2.21, 1], [0, -2.21, 1]]) { const sx = rx ? 1.3 : 0.1, sz = rx ? 0.1 : 1.3; m.box(tx + dx, 11.0, dz, sx, 1.8, sz, SP.dark); }
      if (!low) { m.cyl([tx + 2.22, 8.4, 0], [tx + 2.3, 8.4, 0], 0.7, 0.7, 10, SP.white); for (const sz of [-1, 1]) m.cyl([tx - 0.1, 8.4, sz * 2.22], [tx - 0.1, 8.4, sz * 2.3], 0.7, 0.7, 10, SP.white);
        for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) m.box(-L / 2 + 1.8 + i * 2.7, 2.7, sz * (D / 2 + 0.04), 0.7, 2.2, 0.06, c.o.lit === false ? SP.glass : [0.55, 0.62, 0.8]);
        m.box(0, 0, 0, 0.01, 0.01, 0.01, SP.stone); }
    });
    c.glow.length = 0;
  };
  // pictograms for hanging signs are plain boxes; named boards use the atlas
  function spBoard(c, x, y, z, w, h, shape, lines, o = {}) {                     // a printed board facing +z at (x,y,z), one sided with a grey back
    const m = c.m, cell = spSignCell(shape, lines, o.dir || 1), u0 = cell[0], v0 = cell[1], u1 = cell[2], v1 = cell[3], hw = w / 2, hh = h / 2, bk = [0.55, 0.57, 0.6];
    const pts = o.dir === -1 && shape === 'direction' ? [[hw, -hh, 0], [-hw, -hh, 0], [-hw, hh, 0], [hw, hh, 0]] : null;
    if (shape === 'direction') {
      const tip = h * 0.4, d = o.dir === -1 ? -1 : 1, xr = d * hw, xt = d * (hw - 0), xb = d * (hw - tip);       // arrow board: rectangle + pointed end
      const bx0 = -d * hw, ux = (x2) => (u0 + (u1 - u0) * ((x2 + hw) / w));
      m.quad([bx0 + x, y - hh, z], [xb + x, y - hh, z], [xb + x, y + hh, z], [bx0 + x, y + hh, z], SP.white, { tw: SG_BOARD, uv: d > 0 ? [ux(bx0), v1, ux(xb), v1, ux(xb), v0, ux(bx0), v0] : [ux(bx0), v1, ux(xb), v1, ux(xb), v0, ux(bx0), v0] });
      m.tri([xb + x, y - hh, z], [xt + x, y, z], [xb + x, y + hh, z], SP.white, { tw: SG_BOARD, uv: [ux(xb), v1, ux(xt), (v0 + v1) / 2, ux(xb), v0] });
      m.quad([bx0 + x, y + hh, z - 0.04], [xb + x, y + hh, z - 0.04], [xb + x, y - hh, z - 0.04], [bx0 + x, y - hh, z - 0.04], bk, { uv: SG_WHITE() });
      m.tri([xb + x, y + hh, z - 0.04], [xt + x, y, z - 0.04], [xb + x, y - hh, z - 0.04], bk, { uv: SG_WHITE() });
    } else {
      m.quad([x - hw, y - hh, z], [x + hw, y - hh, z], [x + hw, y + hh, z], [x - hw, y + hh, z], SP.white, { tw: SG_BOARD, uv: [u0, v1, u1, v1, u1, v0, u0, v0] });
      m.quad([x - hw, y + hh, z - 0.04], [x + hw, y + hh, z - 0.04], [x + hw, y - hh, z - 0.04], [x - hw, y - hh, z - 0.04], bk, { uv: SG_WHITE() });
      m.box(x, y, z - 0.026, w + 0.06, h + 0.06, 0.03, [0.12, 0.13, 0.16], { uv: SG_WHITE() });
    }
    void pts;
  }
  const spNameLines = (n) => n == null ? null : (Array.isArray(n) ? n : [String(n)]);
  MODELS.inn = (c) => {
    const { m, low, o } = c, wall = o.col || SP.cream, roof = o.roof || SP.tile, lit = o.lit !== false;
    spFound(m, 12, 7); m.box(0, 1.6, 0, 12, 3.2, 7, spShade(wall)); m.box(0, 4.7, 0.2, 12.4, 3.0, 7.4, spShade(wall));
    spPrism(m, 12.4, 7.4, 6.2, SP_GABLE(3.2), 0.5, spShade(roof), spShade(wall), low);
    m.box(0, 3.15, 0.2, 12.7, 0.2, 7.7, SP.dark);
    if (!low) { for (const x of [-6, -3, 0, 3, 6]) m.box(x, 4.7, 3.93, 0.16, 3.0, 0.06, SP.dark); m.box(0, 4.7, 3.93, 12.4, 0.14, 0.06, SP.dark); m.box(0, 5.9, 3.93, 12.4, 0.14, 0.06, SP.dark); }
    for (const x of [-4.2, -1.4, 3.6]) spWin(c, x, 1.7, 3.55, 1.1, 1.3, lit, SP.dark);
    for (const x of [-4.4, -1.8, 1.8, 4.4]) spWin(c, x, 4.6, 3.95, 1.0, 1.2, lit, SP.dark);
    m.box(1.4, 1.1, 3.55, 1.2, 2.2, 0.12, SP.dark); m.box(1.4, 2.5, 3.65, 1.5, 0.18, 0.3, SP.wood);
    c.glow.push([1.4, 2.6, 3.9, 0xffc070, 1.4]);
    spChimney(c, -4.0, 6.0, -1.2, 0.9, 2.4, SP.stone); spChimney(c, 4.4, 6.0, -1.2, 0.9, 2.0, SP.stone);
    const sx = -5.7;                                                          // hanging sign on an iron bracket, the board turned to face along the road
    m.box(sx, 4.6, 4.5, 0.07, 0.07, 1.6, SP.iron); m.box(sx, 4.2, 4.0, 0.06, 0.06, 0.9, SP.iron, { rx: 0.7 });
    const bn = spNameLines(o.name);
    if (bn) m.at(sx + 0.0, 0, 5.1, Math.PI / 2, () => spBoard(c, 0, 3.9, 0, 1.1, 0.75, 'entry', bn));
    else { m.box(sx, 3.85, 5.1, 0.08, 0.8, 1.0, [0.85, 0.68, 0.2]); if (!low) { m.box(sx, 3.8, 5.1, 0.14, 0.34, 0.3, [0.25, 0.14, 0.05]); m.box(sx, 3.8, 5.38, 0.12, 0.2, 0.08, [0.25, 0.14, 0.05]); } }
    if (!low) for (const z of [4.8, 5.4]) m.box(sx, 4.35, z, 0.025, 0.5, 0.025, SP.iron);
  };
  MODELS.shop = (c) => {
    const { m, low, o } = c, wall = o.col || [0.88, 0.80, 0.66], roof = o.roof || [0.45, 0.28, 0.2], lit = o.lit !== false;
    spFound(m, 7, 6); m.box(0, 1.8, 0, 7, 3.6, 6, spShade(wall)); spPrism(m, 6, 7, 3.6, SP_GABLE(1.8), 0.4, spShade(roof), spShade(wall), low);
    m.box(0, 4.2, 3.05, 7.2, 1.1, 0.15, spShade(wall));                           // false front
    m.box(-1.2, 1.7, 3.04, 3.6, 1.7, 0.1, lit ? SP.warm : SP.glass, lit ? { tw: SG_GLOW } : {}); m.box(2.2, 1.1, 3.04, 1.0, 2.1, 0.1, SP.dark);
    if (lit) c.glow.push([-1.2, 1.7, 3.6, 0xffc070, 1.6]);
    const stripes = low ? 2 : 6, aw = 6.6 / stripes;                               // striped awning
    for (let i = 0; i < stripes; i++) { const x0 = -3.3 + i * aw; spFace(m, [x0, 3.0, 3.1], [x0 + aw, 3.0, 3.1], [x0 + aw, 2.45, 4.5], [x0, 2.45, 4.5], i % 2 ? SP.white : [0.8, 0.14, 0.11], [0, 0, 0], { two: false }); }
    const nm = spNameLines(o.name);
    if (nm) spBoard(c, 0, 4.25, 3.15, 4.2, 0.8, 'entry', nm); else m.box(0, 4.25, 3.15, 4.0, 0.7, 0.1, [0.15, 0.3, 0.5]);
    if (!low) { for (const [x, z] of [[-2.6, 4.2], [-1.9, 4.1]]) m.box(x, 0.3, z, 0.55, 0.6, 0.55, SP.wood); m.cyl([3.0, 0, 3.9], [3.0, 0.9, 3.9], 0.32, 0.32, 8, SP.wood); }
  };
  MODELS.marketCross = (c) => {
    const { m, low } = c, st = SP.conc;
    [[3.6, 0.35], [2.8, 0.35], [2.0, 0.35]].forEach(([s, h], i) => m.box(0, 0.17 + i * 0.35, 0, s, h, s, spMul(st, 1 - i * 0.05)));
    m.box(0, 2.1, 0, 0.42, 2.0, 0.42, st); m.box(0, 3.35, 0, 0.8, 0.5, 0.8, spMul(st, 0.9)); spPyr(m, 0, 3.6, 0, 0.9, 0.9, 0.7, spMul(st, 0.8));
    m.box(0, 4.45, 0, 0.14, 1.1, 0.14, st); m.box(0, 4.6, 0, 0.7, 0.14, 0.14, st);
    if (!low) for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) m.box(x, 0.35, z, 0.3, 0.7, 0.3, SP.stone);
  };
  MODELS.busShelter = (c) => {
    const { m, low, o } = c, col = o.col || [0.2, 0.42, 0.62];
    for (const x of [-1.5, 1.5]) for (const z of [-0.6, 0.6]) m.box(x, 1.15, z, 0.09, 2.3, 0.09, col);
    m.box(0, 2.35, 0, 3.4, 0.12, 1.5, col, { rx: 0.05 });
    m.box(0, 1.2, -0.62, 3.0, 1.9, 0.05, [0.6, 0.78, 0.86]); if (!low) { for (const x of [-1.5, 1.5]) m.box(x, 1.2, 0, 0.05, 1.9, 1.1, [0.6, 0.78, 0.86]); m.box(0, 0.5, -0.1, 2.4, 0.07, 0.4, SP.wood); for (const x of [-1, 1]) m.box(x, 0.25, -0.1, 0.06, 0.5, 0.35, SP.iron); }
    m.box(1.0, 1.4, -0.58, 0.5, 0.7, 0.04, SP.white, { uv: SG_WHITE() }); m.cyl([2.2, 0, 0.8], [2.2, 2.9, 0.8], 0.04, 0.04, 5, SP.iron); m.cyl([2.2, 2.9, 0.8], [2.22, 2.93, 0.8], 0.28, 0.28, 8, [0.85, 0.2, 0.12]);
  };
  MODELS.mailboxes = (c) => {
    const { m, low } = c, cols = [[0.75, 0.12, 0.1], [0.15, 0.3, 0.6], [0.2, 0.2, 0.22]];
    m.box(0, 0.5, 0, 2.6, 0.08, 0.1, SP.wood); for (const x of [-1.2, 1.2]) m.box(x, 0.45, 0, 0.1, 0.9, 0.1, SP.wood);
    cols.forEach((col, i) => { const x = -0.8 + i * 0.8; m.box(x, 0.78, 0, 0.3, 0.26, 0.5, col); if (!low) { m.cyl([x, 0.91, -0.25], [x, 0.91, 0.25], 0.15, 0.15, 6, col, { open: true }); m.box(x + 0.18, 0.95, -0.05, 0.03, 0.2, 0.08, [0.9, 0.7, 0.1]); } });
  };
  // ALPINE
  function spBalcony(c, w, y, z, d) { const m = c.m; m.box(0, y, z + d / 2, w, 0.14, d, SP.wood); m.box(0, y + 0.95, z + d, w, 0.08, 0.08, SP.dark); if (!c.low) for (let i = 0; i <= 10; i++) m.box(-w / 2 + i * w / 10, y + 0.5, z + d, 0.05, 0.9, 0.05, SP.dark); }
  MODELS.chalet = (c) => {
    const { m, low, o } = c, wood = o.col || [0.45, 0.30, 0.18], roof = o.roof || SP.dark, lit = o.lit !== false;
    spFound(m, 10, 7.5); m.box(0, 1.4, 0, 10, 2.8, 7.5, spShade(SP.stone)); m.box(0, 4.0, 0, 10, 2.5, 7.5, spShade(wood));
    spPrism(m, 10, 7.5, 5.25, SP_GABLE(1.9), 1.4, spShade(roof), spShade(wood), low);
    if (o.snow) spPrism(m, 10, 7.5, 5.37, SP_GABLE(1.9), 1.45, SP.snow, null, low);
    spBalcony(c, 10, 2.85, 3.75, 1.3);
    if (!low) for (let y = 3.0; y < 5.2; y += 0.5) m.box(0, y, 3.77, 10.02, 0.07, 0.04, spMul(wood, 0.7));
    for (const x of [-3.2, 3.2]) { spWin(c, x, 1.6, 3.75, 1.0, 1.1, lit, SP.white); spWin(c, x, 4.1, 3.75, 1.0, 1.2, lit, SP.white); if (!low) for (const s of [-1, 1]) m.box(x + s * 0.8, 4.1, 3.8, 0.4, 1.3, 0.05, [0.7, 0.14, 0.1]); }
    m.box(0, 1.1, 3.8, 1.3, 2.2, 0.12, SP.dark); if (!low) { m.box(0, 0.12, 4.4, 2.2, 0.24, 1.2, SP.stone); }
    spChimney(c, 3.2, 5.0, -1.5, 0.9, 2.6, SP.stone);
  };
  MODELS.hut = (c) => {
    const { m, low, o } = c, wall = o.col || [0.56, 0.54, 0.5], roof = o.roof || [0.28, 0.3, 0.34], lit = o.lit !== false;
    spFound(m, 4.8, 3.8); spAlong(m, () => { m.box(0, 1.2, 0, 4.8, 2.4, 3.8, spShade(wall)); spPrism(m, 4.8, 3.8, 2.4, SP_GABLE(2.1), 0.5, spShade(roof), spShade(wall), low); if (o.snow) spPrism(m, 4.8, 3.8, 2.5, SP_GABLE(2.1), 0.55, SP.snow, null, low); });
    m.box(0.7, 1.0, 1.95, 0.9, 2.0, 0.1, SP.dark); spWin(c, -1.1, 1.4, 1.95, 0.7, 0.6, lit, SP.white);
    spChimney(c, -1.6, 2.4, -0.9, 0.55, 2.6, SP.stone);
    m.box(-2.6, 0.45, 1.0, 1.2, 0.9, 0.6, SP.wood); if (!low) { for (let i = 0; i < 3; i++) m.box(-2.6, 0.2 + i * 0.3, 1.31, 1.1, 0.06, 0.04, SP.dark); }
  };
  MODELS.liftPylon = (c) => {
    const { m, low } = c, steel = [0.55, 0.57, 0.6];
    m.box(0, 0.3, 0, 1.2, 0.9, 1.2, SP.conc); m.cyl([0, 0.5, 0], [0, 10.4, 0], 0.22, 0.15, low ? 5 : 7, steel); m.box(0, 10.1, 0, 4.2, 0.18, 0.3, steel);
    for (const x of [-1.5, 1.5]) { m.cyl([x - 0.12, 10.6, 0], [x + 0.12, 10.6, 0], 0.4, 0.4, low ? 6 : 9, SP.iron); m.box(x, 10.35, 0, 0.12, 0.5, 0.3, steel); }
    if (!low) { m.box(0, 3.5, 0.2, 0.08, 6.5, 0.04, steel); m.box(0.18, 5.0, 0, 0.18, 0.3, 0.3, [0.9, 0.6, 0.1]); }
  };
  function spTriSign(c, y, scale) {                                              // warning triangle, point up, on the +z side
    const m = c.m, s = scale || 1, r = [0.85, 0.12, 0.1];
    m.tri([-0.62 * s, y, 0.05], [0.62 * s, y, 0.05], [0, y + 1.1 * s, 0.05], r); m.tri([-0.45 * s, y + 0.1 * s, 0.07], [0.45 * s, y + 0.1 * s, 0.07], [0, y + 0.82 * s, 0.07], SP.white);
    m.tri([-0.3 * s, y + 0.16 * s, 0.09], [0.3 * s, y + 0.16 * s, 0.09], [0, y + 0.62 * s, 0.09], SP.iron); m.tri([-0.62 * s, y, -0.02], [0, y + 1.1 * s, -0.02], [0.62 * s, y, -0.02], [0.5, 0.52, 0.55]);
    for (const [x, yy] of [[0.16, 0.26], [0.26, 0.2], [0.07, 0.2]]) m.box(x * s, y + yy * s, 0.1, 0.07 * s, 0.07 * s, 0.03, SP.white);
  }
  MODELS.avalancheSign = (c) => { const { m, low } = c; m.cyl([0, 0, 0], [0, 2.4, 0], 0.045, 0.045, low ? 4 : 6, [0.5, 0.52, 0.56]); spTriSign(c, 1.55, 1.3); if (!low) m.box(0, 1.35, 0.03, 0.8, 0.22, 0.04, SP.white); };
  MODELS.snowStake = (c) => { const { m } = c; m.cyl([0, 0, 0], [0, 1.9, 0], 0.035, 0.035, 4, [0.12, 0.12, 0.14]); m.cyl([0, 1.5, 0], [0, 2.4, 0], 0.04, 0.04, 4, [0.9, 0.2, 0.1]); m.box(0, 1.35, 0.035, 0.06, 0.12, 0.02, SP.white); };
  // JAPAN
  MODELS.restStop = (c) => {
    const { m, low, o } = c, wall = o.col || [0.86, 0.85, 0.82], lit = o.lit !== false;
    spFound(m, 13, 6); m.box(0, 1.8, 0, 13, 3.6, 6, spShade(wall)); m.box(0, 3.75, 0, 13.4, 0.3, 6.4, [0.3, 0.33, 0.4]); m.box(0, 3.95, 0, 13.4, 0.2, 6.4, SP.white);
    m.box(0, 2.0, 3.03, 10.4, 1.9, 0.08, lit ? [1.0, 0.86, 0.55] : SP.glass, lit ? { tw: SG_GLOW } : {}); if (!low) { for (let i = -5; i <= 5; i++) m.box(i * 1.0, 2.0, 3.09, 0.06, 1.9, 0.04, SP.iron); m.box(0, 1.05, 3.09, 10.4, 0.06, 0.04, SP.iron); }
    m.box(0, 3.3, 3.2, 13.0, 0.5, 0.2, [0.85, 0.18, 0.15]);
    if (lit) { c.glow.push([-4, 2.0, 3.4, 0xffd890, 2.0], [4, 2.0, 3.4, 0xffd890, 2.0]); }
    for (let i = 0; i < 3; i++) { m.box(-5.0 + i * 1.0, 0.9, 3.6, 0.8, 1.8, 0.65, spMul([[0.8, 0.12, 0.1], [0.1, 0.4, 0.75], [0.9, 0.85, 0.85]][i], 1)); m.box(-5.0 + i * 1.0, 1.3, 3.95, 0.62, 0.9, 0.04, [1, 0.95, 0.8], { tw: SG_GLOW }); }
    m.cyl([6.8, 0, 4.2], [6.8, 5.6, 4.2], 0.1, 0.1, 5, SP.iron); m.box(6.8, 5.6, 4.2, 1.6, 1.1, 0.2, [0.9, 0.2, 0.18], { tw: SG_GLOW }); m.box(6.8, 5.6, 4.31, 1.3, 0.8, 0.04, SP.white, { tw: SG_GLOW });
    if (!low) for (let i = 0; i < 4; i++) m.box(-1.2 + i * 0.9, 2.9, 3.35, 0.5, 0.9, 0.04, i % 2 ? [0.1, 0.12, 0.3] : [0.95, 0.95, 0.9]);
  };
  MODELS.onsen = (c) => {
    const { m, low, o } = c, wall = o.col || [0.92, 0.89, 0.82], roof = o.roof || [0.2, 0.24, 0.3], lit = o.lit !== false;
    spFound(m, 12, 8); m.box(0, 1.6, 0, 12, 3.2, 8, spShade(wall)); m.box(0, 0.5, 0, 12.1, 1.0, 8.1, spShade(SP.dark));
    spHip(m, 12, 8, 3.2, 1.3, 1.3, spShade(roof));
    m.box(0, 4.6, -0.3, 9, 2.6, 6.4, spShade(wall)); spHip(m, 9, 6.4, 5.9, 2.3, 1.1, spShade(roof));
    for (const x of [-4.5, -2.25, 2.25, 4.5]) { m.box(x, 2.0, 4.03, 1.5, 1.8, 0.07, lit ? SP.warm : SP.glass, lit ? { tw: SG_GLOW } : {}); if (!low) { m.box(x, 2.0, 4.08, 0.05, 1.8, 0.04, SP.dark); m.box(x, 2.0, 4.08, 1.5, 0.05, 0.04, SP.dark); } }
    for (const x of [-3.2, 0, 3.2]) { m.box(x, 4.6, 2.93, 1.5, 1.4, 0.07, lit ? SP.warm : SP.glass, lit ? { tw: SG_GLOW } : {}); if (!low) m.box(x, 4.6, 2.98, 0.05, 1.4, 0.04, SP.dark); }
    m.box(0, 1.2, 4.05, 1.6, 2.4, 0.1, SP.dark); for (let i = 0; i < 3; i++) m.box(-0.5 + i * 0.5, 2.3, 4.2, 0.4, 0.9, 0.04, [0.12, 0.18, 0.4]);
    if (!low) for (const sx of [-1, 1]) { m.cyl([sx * 1.3, 0, 5.2], [sx * 1.3, 2.4, 5.2], 0.1, 0.1, 5, SP.dark); m.sph(sx * 1.3, 2.7, 5.2, 0.28, 0.4, 0.28, 7, 5, [0.9, 0.2, 0.12], { tw: SG_GLOW }); }
    m.box(0, 3.1, 5.2, 4.0, 0.14, 1.6, spMul(roof, 1)); c.glow.push([-1.3, 2.7, 5.2, 0xff5a30, 1.2], [1.3, 2.7, 5.2, 0xff5a30, 1.2]);
    c.smoke.push([-4.6, 5.2, -3.0]); m.box(-4.6, 4.1, -3.0, 0.9, 1.4, 0.9, SP.dark);
    c.steam = true;
  };
  MODELS.station = (c) => {
    const { m, low, o } = c, wall = o.col || [0.88, 0.86, 0.8], roof = o.roof || [0.28, 0.34, 0.5], lit = o.lit !== false;
    spFound(m, 9, 6); m.box(0, 1.6, 0, 9, 3.2, 6, spShade(wall)); spHip(m, 9, 6, 3.2, 1.7, 0.8, spShade(roof));
    m.box(0, 0.45, 8.6, 24, 0.9, 5.2, spShade(SP.conc)); m.box(0, 0.9, 6.1, 24, 0.04, 0.3, [0.95, 0.8, 0.1]);
    for (const x of [-9, -4.5, 0, 4.5, 9]) m.box(x, 2.0, 9.6, 0.16, 2.2, 0.16, SP.iron);
    m.box(0, 3.15, 8.4, 20, 0.2, 4.4, spShade(roof)); m.box(0, 3.4, 5.9, 5.0, 0.9, 0.12, [0.1, 0.3, 0.6], { tw: [0.6, 0, 0, 0] }); m.box(0, 3.4, 5.96, 4.5, 0.6, 0.04, SP.white, { tw: [0.6, 0, 0, 0] });
    for (const x of [-2.8, 0, 2.8]) spWin(c, x, 1.8, 3.05, 1.3, 1.3, lit, SP.dark);
    m.box(3.7, 1.0, 3.05, 1.1, 2.0, 0.1, SP.dark); if (!low) { m.cyl([0, 4.0, 3.04], [0, 4.0, 3.12], 0.55, 0.55, 12, SP.white); m.box(0, 4.0, 3.15, 0.06, 0.4, 0.03, SP.iron); for (const x of [-5, 5]) m.box(x, 0.65, 9.2, 1.6, 0.08, 0.4, SP.wood); }
    if (lit) c.glow.push([-8, 2.6, 9.6, 0xfff0c0, 1.4], [8, 2.6, 9.6, 0xfff0c0, 1.4]);
  };
  MODELS.trafficLight = (c) => {
    const { m, low, o } = c, st = o.state || 'red', on = { red: 0, amber: 1, green: 2 }[st] || 0, cols = [[1, 0.1, 0.08], [1, 0.7, 0.1], [0.1, 1, 0.4]], hx = [0xff2010, 0xffb020, 0x30ff70];
    m.cyl([0, 0, 0], [0, 5.6, 0], 0.1, 0.07, 6, [0.4, 0.42, 0.45]); m.box(2.0, 5.5, 0, 4.0, 0.12, 0.12, [0.4, 0.42, 0.45]);
    for (const hx0 of [4.0, 2.2]) { m.box(hx0, 5.0, 0.0, 0.42, 1.15, 0.36, SP.iron); for (let i = 0; i < 3; i++) m.box(hx0, 5.36 - i * 0.36, 0.2, 0.26, 0.26, 0.06, i === on ? cols[i] : spMul(cols[i], 0.18), i === on ? { tw: SG_GLOW } : {}); }
    c.glow.push([4.0, 5.36 - on * 0.36, 0.4, hx[on], 1.1], [2.2, 5.36 - on * 0.36, 0.4, hx[on], 1.1]);
  };
  MODELS.levelCrossing = (c) => {
    const { m, low, o } = c, open = !!o.open, n = low ? 4 : 8;
    m.box(0, 0.6, 0, 0.4, 1.2, 0.4, SP.white); m.box(0, 1.45, 0.0, 0.5, 0.5, 0.4, SP.iron);
    c.glow.push([0, 1.45, 0.25, 0xff2010, 1.2]); m.box(-0.12, 1.45, 0.2, 0.18, 0.18, 0.05, [1, 0.1, 0.08], { tw: SG_GLOW }); m.box(0.12, 1.45, 0.2, 0.18, 0.18, 0.05, [1, 0.1, 0.08], { tw: SG_GLOW });
    const L = 5.0, rise = open ? 1.3 : 0;
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, xa = 0.2 + t0 * L, xb = 0.2 + t1 * L, ya = 1.0 + t0 * rise * L * 0.0 + (open ? t0 * 4 : 0), yb = 1.0 + (open ? t1 * 4 : 0); m.box((xa + xb) / 2, (ya + yb) / 2, 0, Math.hypot(xb - xa, yb - ya), 0.12, 0.08, i % 2 ? SP.white : [0.85, 0.1, 0.08], { rz: Math.atan2(yb - ya, xb - xa) }); }
    m.cyl([-1.2, 0, 0.8], [-1.2, 3.0, 0.8], 0.05, 0.05, 4, SP.iron); m.box(-1.2, 2.7, 0.84, 1.1, 0.12, 0.04, SP.white, { rz: 0.78 }); m.box(-1.2, 2.7, 0.84, 1.1, 0.12, 0.04, SP.white, { rz: -0.78 });
  };
  // DESERT
  MODELS.tradingPost = (c) => {
    const { m, low, o } = c, wall = o.col || SP.adobe, nm = spNameLines(o.name);
    spFound(m, 10, 7, [0.6, 0.5, 0.4]); m.box(0, 1.6, 0, 10, 3.2, 7, spShade(wall)); m.box(0, 3.3, 0, 10.4, 0.2, 7.4, spMul(wall, 0.85));
    m.box(0, 3.4, 3.7, 10.4, 2.0, 0.3, spShade(wall)); m.box(0, 4.6, 3.7, 6.0, 0.8, 0.3, spShade(wall));
    if (nm) spBoard(c, 0, 4.3, 3.9, 5.4, 1.3, 'entry', nm); else m.box(0, 4.3, 3.88, 5.2, 1.1, 0.1, [0.65, 0.18, 0.12]);
    m.box(0, 0.12, 5.2, 10, 0.24, 2.6, SP.wood); for (const x of [-4.6, -2.3, 0, 2.3, 4.6]) m.box(x, 1.4, 6.3, 0.18, 2.8, 0.18, SP.dark);
    spFace(m, [-5.2, 2.9, 3.6], [5.2, 2.9, 3.6], [5.2, 2.5, 6.6], [-5.2, 2.5, 6.6], SP.wood, [0, 0, 0]);
    m.box(-2, 1.4, 3.52, 1.4, 1.2, 0.1, SP.glass); m.box(2, 1.2, 3.52, 1.2, 2.2, 0.1, SP.dark);
    if (!low) { for (const [x, z] of [[-4.4, 5.4], [-3.5, 5.6], [4.0, 5.5]]) m.cyl([x, 0.24, z], [x, 1.1, z], 0.42, 0.42, 7, SP.rust); for (const [x, z] of [[3.2, 5.2], [3.2, 5.9]]) m.box(x, 0.65, z, 0.8, 0.8, 0.7, SP.wood); m.box(-1, 0.7, 7.4, 3, 0.08, 0.08, SP.dark); for (const x of [-2.4, 0.4]) m.box(x, 0.35, 7.4, 0.1, 0.7, 0.1, SP.dark); }
  };
  MODELS.gasStation = (c) => {
    const { m, low, o } = c, lit = o.lit !== false;
    m.box(0, 4.7, 0, 12, 0.5, 7, SP.white); m.box(0, 4.5, 3.55, 12.1, 0.5, 0.1, [0.85, 0.15, 0.1]); m.box(0, 4.95, 3.55, 12.1, 0.2, 0.12, [0.95, 0.75, 0.1]);
    m.box(0, 4.44, 0, 11.6, 0.04, 6.6, lit ? [1, 0.95, 0.8] : SP.white, lit ? { tw: SG_GLOW } : {});
    for (const [x, z] of [[-5, -2.6], [5, -2.6], [-5, 2.6], [5, 2.6]]) m.box(x, 2.2, z, 0.4, 4.4, 0.4, SP.white);
    for (const x of [-2.5, 2.5]) { m.box(x, 0.12, 0, 1.0, 0.24, 4.6, SP.conc); for (const z of [-1.3, 1.3]) { m.box(x, 0.95, z, 0.55, 1.45, 0.4, [0.85, 0.15, 0.1]); m.box(x, 1.45, z, 0.5, 0.35, 0.44, [0.9, 0.9, 0.9], { tw: SG_GLOW }); if (!low) m.cyl([x + 0.3, 0.8, z], [x + 0.4, 0.3, z], 0.025, 0.025, 4, SP.iron); } }
    m.box(0, 1.6, -7.5, 9, 3.2, 5, spShade(SP.conc)); m.box(0, 3.3, -7.5, 9.4, 0.25, 5.4, [0.85, 0.15, 0.1]); m.box(0, 1.8, -4.98, 7.0, 1.6, 0.08, lit ? SP.warm : SP.glass, lit ? { tw: SG_GLOW } : {}); m.box(0, 1.1, -4.97, 1.0, 2.2, 0.1, SP.dark);
    m.cyl([8.0, 0, 3.5], [8.0, 7.0, 3.5], 0.14, 0.14, 6, SP.iron); m.box(8.0, 7.1, 3.5, 2.4, 1.6, 0.3, [0.95, 0.75, 0.1], { tw: [0.6, 0, 0, 0] }); m.box(8.0, 7.1, 3.67, 1.6, 0.9, 0.06, [0.85, 0.15, 0.1], { tw: SG_GLOW });
    if (lit) c.glow.push([-5, 4.2, 3, 0xfff0c0, 2.0], [5, 4.2, 3, 0xfff0c0, 2.0], [0, 1.8, -4.5, 0xffd890, 1.8]);
  };
  MODELS.waterTower = (c) => {
    const { m, low, o } = c, col = o.col || SP.rust, seg = low ? 8 : 10;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { m.cyl([sx * 2.2, -0.5, sz * 2.2], [sx * 1.7, 9.2, sz * 1.7], 0.14, 0.12, 5, SP.iron); }
    for (const y of low ? [4.5] : [3.0, 6.0]) for (const [a, b, dx, dz] of [[-1, -1, 2, 0], [1, -1, 0, 2], [1, 1, -2, 0], [-1, 1, 0, -2]]) { const k = 2.2 - y * 0.055; m.box(a * k + dx * k / 2, y, b * k + dz * k / 2, dx ? 2 * k : 0.1, 0.1, dz ? 2 * k : 0.1, SP.iron); if (!low) m.cyl([a * k, y - 3 * (1 - 0.0), b * k], [a * k + dx * k, y, b * k + dz * k], 0.04, 0.04, 4, SP.iron); }
    m.cyl([0, 9.2, 0], [0, 13.0, 0], 2.6, 2.6, seg, spShade(col)); m.cyl([0, 13.0, 0], [0, 14.3, 0], 2.75, 0.2, seg, spMul(col, 0.8)); m.cyl([0, 0.2, 0], [0, 9.2, 0], 0.18, 0.18, 5, SP.iron);
    if (!low) { for (const y of [9.8, 12.4]) m.cyl([0, y, 0], [0, y + 0.12, 0], 2.66, 2.66, seg, SP.iron); m.box(0, 11.1, 2.62, 0.3, 4.0, 0.06, SP.iron); }
  };
  MODELS.headframe = (c) => {
    const { m, low, o } = c, wood = o.col || [0.42, 0.30, 0.2];
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) m.cyl([sx * 3.4, -0.3, sz * 1.5], [sx * 0.5, 15.6, sz * 0.7], 0.2, 0.15, 4, wood);
    for (const y of low ? [6] : [3.5, 7.5, 11.5]) { const k = 1 - y / 17; for (const sz of [-1, 1]) m.box(0, y, sz * (0.7 + 0.8 * k), 6.8 * k + 1.0, 0.2, 0.2, wood); for (const sx of [-1, 1]) m.box(sx * (0.5 + 2.9 * k), y, 0, 0.2, 0.2, 3 * k + 1.0, wood); }
    m.cyl([-0.35, 16.0, 0], [0.35, 16.0, 0], 1.7, 1.7, low ? 8 : 12, SP.iron);
    if (!low) { for (const a of [0, 0.78, 1.57, 2.36]) m.box(0, 16.0, 0, 0.08, 3.3, 0.08, [0.45, 0.45, 0.48], { rx: a }); }
    m.cyl([0, 14.4, 0.2], [0, 0.5, 0.2], 0.04, 0.04, 4, SP.iron); m.cyl([0.0, 17.1, 0.0], [0.0, 1.0, 5.5], 0.03, 0.03, 4, SP.iron);
    m.box(0, 1.8, 8.0, 5.6, 3.6, 4.4, spShade(SP.rust)); spPrism(m, 5.6, 4.4, 3.6, SP_GABLE(1.3), 0.3, spShade(SP.slate), null, low); m.box(0, 1.5, 5.82, 1.0, 1.9, 0.1, SP.dark);
    m.box(-4.8, 1.6, -3, 2.4, 3.2, 2.4, spShade(wood)); m.cyl([-4.8, 3.2, -3], [-4.8, 4.2, -3], 1.4, 0.4, 6, spMul(wood, 0.85));
  };
  MODELS.conveyor = (c) => {
    const { m, low, o } = c, len = o.len || 36, rise = o.rise || 9, ang = Math.atan2(rise, len), bl = Math.hypot(len, rise), n = Math.max(2, Math.round(len / 7));
    m.box(len / 2, 0.9 + rise / 2 + 0.6, 0, bl, 0.3, 1.2, [0.25, 0.25, 0.28], { rz: ang }); if (!low) for (const s of [-1, 1]) m.box(len / 2, 1.05 + rise / 2 + 0.6, s * 0.62, bl, 0.35, 0.06, [0.8, 0.5, 0.1], { rz: ang });
    for (let i = 0; i <= n; i++) { const x = i / n * len, y = 0.75 + i / n * rise + 0.6; for (const s of [-1, 1]) m.cyl([x, 0, s * 1.2], [x, y, s * 0.4], 0.09, 0.07, 4, SP.iron); m.box(x, y, 0, 0.12, 0.12, 1.4, SP.iron); if (!low && i < n) m.cyl([x, 0.4, -1.2], [x + len / n, 0.4 + 0 + 0.0, 1.2], 0.03, 0.03, 4, SP.iron); }
    m.box(len + 1, rise + 2.0, 0, 3.0, 2.2, 2.4, spShade(SP.rust)); m.box(-1.0, 1.4, 0, 2.2, 1.0, 2.0, spShade(SP.iron));
    if (!low) for (const [x, y, z, r] of [[len + 5, 0.7, 0, 3.0], [len + 8, 0.5, 1.5, 2.0], [len + 3.5, 0.5, -2, 2.2]]) m.sph(x, 0, z, r, y * 1.9 + 1, r, 6, 4, [0.50, 0.38, 0.3], { cap: 1.57 });
  };
  MODELS.windpump = (c) => {
    const { m, low } = c, H = 8.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cyl([sx * 1.1, -0.2, sz * 1.1], [sx * 0.3, H, sz * 0.3], 0.05, 0.04, 4, SP.metal);
    for (const y of low ? [3] : [1.5, 3.5, 5.5, 7.5]) { const k = 1.1 - y * 0.098; for (const [a, b, w, d] of [[0, k, 2 * k, 0.05], [0, -k, 2 * k, 0.05], [k, 0, 0.05, 2 * k], [-k, 0, 0.05, 2 * k]]) m.box(a, y, b, w, 0.05, d, SP.metal); }
    m.box(0, H + 0.1, 0.2, 0.5, 0.5, 1.0, SP.iron); const wz = 0.8, nb = low ? 8 : 14;
    for (let i = 0; i < nb; i++) { const a = i / nb * Math.PI * 2; m.box(Math.cos(a) * 1.0, H + 0.2 + Math.sin(a) * 1.0, wz, 0.34, 1.35, 0.04, [0.74, 0.76, 0.8], { rz: a - Math.PI / 2 }); }
    m.cyl([0, H + 0.2, wz - 0.05], [0, H + 0.2, wz + 0.15], 0.22, 0.22, 6, SP.iron); m.box(0, H + 0.2, -2.2, 0.05, 0.3, 4.4, SP.iron); m.box(0, H + 0.2, -4.3, 0.04, 1.0, 1.4, [0.8, 0.3, 0.2]);
    m.cyl([0, 0.2, 0], [0, 0.6, 0], 1.6, 1.6, low ? 7 : 10, spMul(SP.rust, 1.05)); m.cyl([1.2, 0, 0], [1.2, 1.1, 0], 0.07, 0.07, 4, SP.iron);
  };
  MODELS.boxcars = (c) => {
    const { m, low, o } = c, n = o.count || 3, cols = [[0.55, 0.26, 0.17], [0.45, 0.38, 0.3], [0.35, 0.3, 0.26], [0.5, 0.2, 0.15]], seg = low ? 5 : 7;
    m.at(0, 0, 0, -Math.PI / 2, () => {
      for (let k = 0; k < n; k++) {
        const x = (k - (n - 1) / 2) * 13, col = cols[k % cols.length];
        m.box(x, 2.2, 0, 12, 2.7, 2.7, spShade(col)); m.box(x, 0.8, 0, 12.4, 0.35, 2.5, SP.iron); m.box(x, 3.65, 0, 12.2, 0.18, 2.6, spMul(col, 0.8));
        for (const s of [-1, 1]) { m.box(x + 0.5, 2.0, s * 1.37, 3.4, 2.3, 0.08, spMul(col, 0.7)); if (!low) { m.box(x + 0.5, 2.0, s * 1.42, 0.08, 2.3, 0.06, SP.iron); m.box(x - 4, 3.0, s * 1.37, 0.14, 1.4, 0.05, spMul(col, 1.15)); } for (const dx of [-4, 4]) for (const wx of [0]) m.cyl([x + dx + wx, 0.45, s * 1.0], [x + dx + wx, 0.45, s * 1.16], 0.42, 0.42, seg, SP.iron); }
        if (k < n - 1) m.box(x + 6.5, 0.9, 0, 1.0, 0.12, 0.12, SP.iron);
      }
      if (!low) { for (const s of [-1, 1]) m.box(0, 0.12, s * 0.72, n * 13 + 4, 0.1, 0.1, SP.iron); for (let i = 0; i < n * 5; i++) m.box(-n * 6.5 + i * 2.6, 0.04, 0, 0.3, 0.08, 2.2, SP.dark); }
    });
  };
  // SERVICE PARK
  const spWheel = (m, x, y, z, r, w, seg) => m.cyl([x, y, z - w / 2], [x, y, z + w / 2], r, r, seg, [0.08, 0.08, 0.09]);
  MODELS.teamVan = (c) => {
    const { m, low, o } = c, col = o.color || [0.85, 0.12, 0.1], seg = low ? 6 : 8;
    const bd = o.body ? spShade(col) : spShade(SP.white), bs = o.body ? SP.white : col;   // o.body: painted in the team colour, with a white stripe and roof
    m.at(0, 0, 0, -Math.PI / 2, () => {
      m.box(-0.6, 1.4, 0, 4.4, 1.9, 2.1, bd); m.box(2.2, 0.95, 0, 1.4, 1.0, 2.0, bd); spFace(m, [1.6, 1.9, -0.95], [2.9, 1.5, -0.95], [2.9, 1.5, 0.95], [1.6, 1.9, 0.95], SP.glass, [0, 0, 0]); m.box(2.95, 0.6, 0, 0.1, 0.4, 1.8, SP.iron);
      for (const s of [-1, 1]) { m.box(-0.6, 1.0, s * 1.06, 4.4, o.body ? 0.4 : 0.3, 0.04, bs); m.box(2.2, 1.45, s * 1.0, 0.9, 0.55, 0.04, SP.glass); m.box(-0.6, 1.9, s * 1.06, 2.2, 0.55, 0.04, SP.glass); for (const wx of [-1.5, 2.0]) spWheel(m, wx, 0.38, s * 1.0, 0.38, 0.26, seg); }
      m.box(-0.6, 2.4, 0, 4.4, 0.1, 2.1, bs); m.box(-2.82, 1.4, 0, 0.06, 1.7, 1.9, o.body ? spMul(col, 0.85) : spMul(SP.white, 0.85)); m.box(2.95, 1.1, 0.7, 0.05, 0.2, 0.3, [1, 0.95, 0.8], { tw: SG_GLOW });
      if (!low) { m.box(-0.6, 2.55, 0, 3.6, 0.06, 1.7, SP.iron); for (const x of [-2, 0, 1]) m.box(x, 2.5, 0, 0.06, 0.12, 1.7, SP.iron); m.box(2.9, 1.95, 0, 0.5, 0.12, 1.2, col); }
    });
  };
  MODELS.trailer = (c) => {
    const { m, low, o } = c, col = o.color || [0.85, 0.12, 0.1], seg = low ? 6 : 8;
    m.at(0, 0, 0, -Math.PI / 2, () => {
      m.box(0, 1.55, 0, 6.5, 2.2, 2.4, spShade(SP.white)); m.box(0, 0.5, 0, 6.5, 0.2, 2.2, SP.iron); m.box(0, 1.0, 1.22, 6.5, 0.45, 0.04, col); m.box(0, 1.0, -1.22, 6.5, 0.45, 0.04, col);
      m.box(4.4, 0.55, 0, 2.6, 0.1, 0.12, SP.iron); m.cyl([5.6, 0.6, 0], [5.8, 0.75, 0], 0.12, 0.12, 5, SP.iron);
      for (const s of [-1, 1]) for (const wx of [-0.7, 0.2]) spWheel(m, wx, 0.4, s * 1.22, 0.4, 0.26, seg);
      spFace(m, [-2.8, 2.65, 1.2], [2.8, 2.65, 1.2], [2.8, 2.3, 3.2], [-2.8, 2.3, 3.2], col, [0, 0, 0], { two: true }); for (const x of [-2.6, 2.6]) m.cyl([x, 0, 3.1], [x, 2.35, 3.1], 0.035, 0.035, 4, SP.metal);
      m.box(-3.3, 0.9, 0, 0.1, 0.3, 2.2, SP.iron, { rz: 0.5 }); if (!low) m.box(0, 1.5, 1.23, 2.6, 1.4, 0.04, [1, 0.9, 0.7], { tw: SG_GLOW });
    });
  };
  MODELS.timingHut = (c) => {
    const { m, low, o } = c;
    m.box(0, 1.5, 0, 5.0, 2.6, 2.5, spShade([0.9, 0.9, 0.92])); m.box(0, 2.85, 0, 5.2, 0.14, 2.7, [0.12, 0.3, 0.6]);
    m.box(-0.6, 1.7, 1.27, 2.6, 1.0, 0.06, SP.warm, { tw: SG_GLOW }); m.box(1.7, 1.1, 1.27, 0.9, 2.1, 0.08, SP.dark);
    c.glow.push([-0.6, 1.8, 1.6, 0xffd890, 1.4]);
    m.box(1.7, 0.1, 1.9, 1.2, 0.2, 0.9, SP.conc); m.cyl([-2.2, 2.9, 0.3], [-2.2, 6.4, 0.3], 0.04, 0.03, 4, SP.metal); m.box(-1.85, 6.1, 0.3, 0.7, 0.45, 0.02, [0.9, 0.12, 0.1], { two: true });
    m.box(0.3, 3.5, 0, 2.0, 0.7, 0.14, [0.06, 0.06, 0.08]); for (let i = 0; i < 4; i++) m.box(-0.5 + i * 0.35, 3.5, 0.09, 0.2, 0.4, 0.03, [1, 0.5, 0.08], { tw: SG_GLOW });
    if (!low) { m.box(-2.7, 0.5, -0.2, 0.5, 1.0, 0.8, SP.iron); m.cyl([2.1, 2.9, -0.6], [2.1, 4.6, -0.6], 0.02, 0.02, 3, SP.metal); }
  };
  // SHARED
  MODELS.signpost = (c) => {
    const { m, low, o } = c, boards = o.boards || [{ lines: o.lines || ['PORT SALLOW', '71'], shape: o.shape || 'direction', dir: o.dir || 1 }], seg = low ? 4 : 6, iron = [0.5, 0.52, 0.56];
    const h = boards.reduce((a, b) => a + (b.shape === 'entry' || b.shape === 'route' ? 1.2 : 0.8), 0);
    m.cyl([0, 0, 0], [0, 1.6 + h, 0], 0.05, 0.05, seg, iron); const wide = boards.some(b => b.shape === 'route' || b.shape === 'entry');
    if (wide) m.cyl([0.0, 0, 0], [0, 1.2 + h, 0], 0.05, 0.05, seg, iron);
    let y = 1.4 + h - 0.1;
    for (const b of boards) { const sh = b.shape || 'direction', bw = sh === 'direction' ? 2.0 : sh === 'route' ? 1.8 : 1.5, bh = sh === 'direction' ? 0.55 : sh === 'route' ? 0.9 : 0.75; y -= bh / 2 + 0.05; spBoard(c, (b.dir === -1 ? -1 : 1) * (sh === 'direction' ? 0.25 : 0), y, 0.06, bw, bh, sh, b.lines || ['PORT SALLOW'], { dir: b.dir || 1 }); y -= bh / 2 + 0.05; }
    if (wide && !low) m.cyl([0.0, 0, 0.0], [0, 0.1, 0], 0.12, 0.1, 5, SP.conc);
  };
  MODELS.kmPost = (c) => {
    const { m, low } = c, bw = 0.24, tx = 0.1;                                   // plate: two glyph cells side by side, digits picked per instance (see settleMat)
    m.box(0, 0.5, 0, bw, 1.0, 0.12, SP.white); m.box(0, 0.93, 0, bw + 0.01, 0.14, 0.13, [0.85, 0.15, 0.1]);
    const gw = 1 / 1024 * 93, u0 = 3 / 1024, v0 = 1 - (896 + 3) / 1024, v1 = 1 - (1024 - 3) / 1024;
    for (const [i, x] of [[1, -0.055], [2, 0.055]]) m.quad([x - 0.05, 0.38, 0.065], [x + 0.05, 0.38, 0.065], [x + 0.05, 0.68, 0.065], [x - 0.05, 0.68, 0.065], SP.white, { tw: [0.3, 0, i, 0], uv: [u0, v1, u0 + gw - 6 / 1024, v1, u0 + gw - 6 / 1024, v0, u0, v0] });
  };
  MODELS.pole = (c) => {
    const { m, low, o } = c, H = o.height || 8.3;
    m.cyl([0, 0, 0], [0, H + 0.6, 0], 0.17, 0.11, low ? 5 : 7, [0.46, 0.35, 0.25]); m.box(0, H, 0, 1.9, 0.12, 0.12, [0.3, 0.22, 0.16]);
    if (!low) { for (const x of [-0.8, 0, 0.8]) m.cyl([x, H + 0.04, 0], [x, H + 0.3, 0], 0.05, 0.04, 4, [0.55, 0.62, 0.7]); for (const s of [-1, 1]) m.box(s * 0.5, H - 0.4, 0, 0.9, 0.07, 0.07, [0.3, 0.22, 0.16], { rz: -s * 0.7 }); if (o.xfmr) m.cyl([0.35, H - 1.4, 0.3], [0.35, H - 0.5, 0.3], 0.27, 0.27, 7, [0.45, 0.5, 0.48]); }
  };
  MODELS.cow = (c) => {
    const { m, low } = c, W = [0.94, 0.92, 0.88], K = [0.14, 0.12, 0.12];
    m.box(0, 1.05, 0, 0.8, 0.8, 1.9, W, { tw: SG_TINT }); m.box(0, 1.2, 1.2, 0.46, 0.5, 0.62, W, { tw: SG_TINT, rx: -0.2 });
    if (low) { for (const z of [-0.65, 0.65]) m.box(0, 0.37, z, 0.7, 0.74, 0.18, spMul(W, 0.8), { tw: SG_TINT }); m.box(0.41, 1.15, -0.2, 0.04, 0.4, 0.6, K); return; }
    m.box(0, 1.0, 1.52, 0.3, 0.26, 0.2, [0.85, 0.65, 0.62]); for (const s of [-1, 1]) { m.box(s * 0.28, 1.5, 1.2, 0.16, 0.08, 0.2, K); m.box(s * 0.17, 1.58, 1.26, 0.05, 0.16, 0.05, [0.9, 0.85, 0.7]); }
    for (const [x, z] of [[-0.26, 0.7], [0.26, 0.7], [-0.26, -0.7], [0.26, -0.7]]) m.box(x, 0.37, z, 0.15, 0.74, 0.17, spMul(W, 0.8), { tw: SG_TINT });
    m.box(0, 1.15, -1.0, 0.07, 0.8, 0.07, K, { rx: 0.2 }); m.box(0, 0.62, -0.5, 0.3, 0.14, 0.4, [0.9, 0.62, 0.6]);
    for (const [x, y, z, w, h, d] of [[0.41, 1.2, -0.2, 0.04, 0.45, 0.6], [-0.41, 1.1, 0.35, 0.04, 0.4, 0.5], [0.0, 1.46, -0.5, 0.5, 0.04, 0.5], [0.41, 1.0, 0.65, 0.04, 0.3, 0.4], [-0.41, 1.2, -0.5, 0.04, 0.35, 0.45]]) m.box(x, y, z, w, h, d, K);
  };
  // wooden pole-top ribbons (wires) -----------------------------------------------------------------------------------
  function sagPoints(out, a, b, sag, segs) {                                    // flat [x,y,z, ...] of a sagging wire, segs + 1 points (no allocation when `out` is reused)
    out.length = 0;
    for (let k = 0; k <= segs; k++) { const t = k / segs, s = Math.sin(t * Math.PI) * sag; out.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s, a[2] + (b[2] - a[2]) * t); }
    return out;
  }
  const _spPts = [];
  function spWire(m, a, b, sag, segs, w, col) {                                  // a sagging wire as a thin ribbon tilted 45 degrees (readable from below and from the side)
    sagPoints(_spPts, a, b, sag, segs);
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, hx = -dz / l * w * 0.5, hz = dx / l * w * 0.5, hy = w * 0.5;
    for (let k = 0; k < segs; k++) {
      const i = k * 3, p = [_spPts[i], _spPts[i + 1], _spPts[i + 2]], q = [_spPts[i + 3], _spPts[i + 4], _spPts[i + 5]];
      m.quad([p[0] - hx, p[1] - hy, p[2] - hz], [q[0] - hx, q[1] - hy, q[2] - hz], [q[0] + hx, q[1] + hy, q[2] + hz], [p[0] + hx, p[1] + hy, p[2] + hz], col, { two: true });
    }
  }

  /* ---- the picture atlas: cell 0 = white (every model's uv), cells 1.. = printed boards (made when first asked for), bottom strip = km digits ---- */
  const SG = { tex: null, cells: new Map(), next: 1 }, SG_N = 1024, SG_CW = 256, SG_CH = 128, SG_GLYPH = 93, SG_WH = [0.1, 0.96];
  const SG_WHITE = () => SG_WH;
  function spAtlas() {
    if (SG.tex) return SG.tex;
    SG.tex = canvasTex(SG_N, SG_N, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, SG_N, SG_N);
      g.fillStyle = '#f4f1e4'; g.fillRect(0, 896, SG_N, 128); g.fillStyle = '#16181c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 112px "Saira Condensed", "Arial Narrow", sans-serif';
      for (let i = 0; i < 10; i++) g.fillText(String(i), i * SG_GLYPH + SG_GLYPH / 2, 962);
      g.fillStyle = '#d9392b'; g.fillRect(10 * SG_GLYPH, 896, SG_GLYPH, 14);
    });
    SG.tex.userData.keep = true; return SG.tex;
  }
  function spSignCell(shape, lines, dir) {                                       // -> uv rect [u0, vTop, u1, vBottom] of the painted board
    const key = shape + '|' + dir + '|' + lines.join('/'); let idx = SG.cells.get(key);
    const tex = spAtlas();
    if (idx == null) {
      idx = SG.next; SG.next = SG.next >= 27 ? 1 : SG.next + 1; SG.cells.set(key, idx);
      const g = tex.image.getContext('2d'), cx = (idx % 4) * SG_CW, cy = Math.floor(idx / 4) * SG_CH, black = shape === 'entry';
      g.save(); g.beginPath(); g.rect(cx, cy, SG_CW, SG_CH); g.clip();
      g.fillStyle = black ? '#121316' : '#1b4a9c'; g.fillRect(cx, cy, SG_CW, SG_CH);
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(cx + 6, cy + 6, SG_CW - 12, SG_CH - 12);
      const n = Math.min(3, lines.length), lh = (SG_CH - 22) / n, x0 = cx + (shape === 'direction' && dir === -1 ? SG_CW * 0.17 : 18), x1 = cx + (shape === 'direction' && dir !== -1 ? SG_CW * 0.83 : SG_CW - 18);
      g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const raw = String(lines[i]).toUpperCase(), mt = /^(.*?)\s+(\d+)\s*([<>^])?$/.exec(raw), name = mt ? mt[1] : raw.replace(/\s*[<>^]$/, ''), num = mt ? mt[2] : '', arrow = mt ? mt[3] : (/[<>^]$/.test(raw) ? raw.slice(-1) : '');
        const cyl = cy + 11 + lh * (i + 0.5), fs = Math.min(lh * 0.92, 66);
        const fit = (txt, avail) => { let s = fs; g.font = '800 ' + s + 'px "Saira Condensed", "Arial Narrow", sans-serif'; const w = g.measureText(txt).width; if (w > avail) { s = s * avail / w; g.font = '800 ' + s + 'px "Saira Condensed", "Arial Narrow", sans-serif'; } return s; };
        const numW = num ? g.measureText(num).width + 16 : 0;
        if (shape === 'entry') { g.textAlign = 'center'; fit(name, x1 - x0); g.fillText(name, (x0 + x1) / 2, cyl); }
        else { const aw = arrow ? lh * 0.6 : 0; g.textAlign = 'left'; fit(name + ' ' + num, x1 - x0 - aw); g.textAlign = 'left'; g.fillText(name, x0, cyl); if (num) { g.textAlign = 'right'; g.fillText(num, x1 - aw, cyl); }
          if (arrow) { const ax = x1 - aw / 2 + 2, ah = lh * 0.3; g.beginPath(); if (arrow === '>') { g.moveTo(ax - ah * 0.6, cyl - ah); g.lineTo(ax + ah * 0.8, cyl); g.lineTo(ax - ah * 0.6, cyl + ah); } else if (arrow === '<') { g.moveTo(ax + ah * 0.6, cyl - ah); g.lineTo(ax - ah * 0.8, cyl); g.lineTo(ax + ah * 0.6, cyl + ah); } else { g.moveTo(ax - ah, cyl + ah * 0.6); g.lineTo(ax, cyl - ah * 0.8); g.lineTo(ax + ah, cyl + ah * 0.6); } g.closePath(); g.fill(); } }
        void numW;
      }
      g.restore(); tex.needsUpdate = true;
    }
    const cx = (idx % 4) * SG_CW, cy = Math.floor(idx / 4) * SG_CH;
    return [(cx + 3) / SG_N, 1 - (cy + 3) / SG_N, (cx + SG_CW - 3) / SG_N, 1 - (cy + SG_CH - 3) / SG_N];
  }

  /* ---- material: vertex colours (display colours), the atlas, glow (tw.x), instance tint (tw.y), per-instance km digits (tw.z) ---- */
  let _spMat = null, _spSmokeMat = null; const SM_T = { value: 0 };
  function spMat() {
    if (_spMat) return _spMat;
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: spAtlas() });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 tw; varying float vGlow;')
        .replace('#include <color_vertex>', `
          #ifdef USE_INSTANCING_COLOR
            vec3 icol = pow(instanceColor.rgb, vec3(2.2));
          #else
            vec3 icol = vec3(1.0);
          #endif
          vColor = vec4(pow(color, vec3(2.2)) * mix(vec3(1.0), icol, tw.y), 1.0); vGlow = tw.x;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          #if defined(USE_MAP) && defined(USE_INSTANCING_COLOR)
            if (tw.z > 0.5) { float di = tw.z < 1.5 ? instanceColor.r : instanceColor.g; vMapUv.x += floor(di * 10.0 + 0.5) * ${(SG_GLYPH / SG_N).toFixed(6)}; }
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vGlow;');
    };
    m.customProgramCacheKey = () => 'settle'; m.userData.keep = true;
    return _spMat = m;
  }
  function spSmokeMat() {
    if (_spSmokeMat) return _spSmokeMat;
    const tex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    tex.userData.keep = true;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSmT = SM_T;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSmT; varying float vSmA; varying float vSt;')
        .replace('#include <project_vertex>', `
          float ph = fract(instanceColor.r + uSmT * 0.06);
          float sz = instanceMatrix[0].x * (0.8 + ph * 3.4) * instanceColor.g;
          vec3 base = instanceMatrix[3].xyz + vec3(ph * 4.0, ph * 9.0, ph * 1.5);
          vec4 mvPosition = modelViewMatrix * vec4(base, 1.0);
          mvPosition.xy += position.xy * sz;
          gl_Position = projectionMatrix * mvPosition;
          vSmA = smoothstep(0.0, 0.1, ph) * (1.0 - ph) * 0.85; vSt = instanceColor.b;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSmA; varying float vSt;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(0.42), vec3(0.95), vSt); diffuseColor.a *= vSmA;');
    };
    m.customProgramCacheKey = () => 'settle-smoke'; m.userData.keep = true;
    return _spSmokeMat = m;
  }

  /* ---- building clusters ---- */
  const spLow = (o) => o && o.low != null ? !!o.low : quality === 'low';
  function spCtx(m, kind, item, low) { return { m, low, o: item, smoke: [], glow: [] }; }
  function spYAt(it) {
    if (it.y != null) return it.y; const r = it.r == null ? 3 : it.r, h = terrain.heightAt;
    return (h(it.x, it.z) + h(it.x + r, it.z) + h(it.x - r, it.z) + h(it.x, it.z + r) + h(it.x, it.z - r)) / 5;
  }
  function spSmoke(list) {                                                       // list: [{ x, y, z, s?, steam? }]
    const per = 4, geo = new THREE.PlaneGeometry(1, 1), mesh = new THREE.InstancedMesh(geo, spSmokeMat(), Math.max(1, list.length * per)), M = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach((p, i) => { for (let k = 0; k < per; k++) { const s = p.s || 1; M.makeScale(s, s, s).setPosition(p.x, p.y, p.z); mesh.setMatrixAt(i * per + k, M); col.setRGB((k + ((i * 0.37) % 1)) / per, 0.85 + 0.3 * (((i * 7 + k * 3) % 5) / 4), p.steam ? 1 : 0); mesh.setColorAt(i * per + k, col); } });
    mesh.name = 'settle'; mesh.count = list.length * per; mesh.frustumCulled = false; mesh.renderOrder = 4; add(mesh); return mesh;
  }
  function spCluster(items, opts = {}) {
    const low = spLow(opts), m = modeller(); m.uv0 = SG_WHITE(); spAtlas();
    let ox = 0, oz = 0, oy = 1e9; const ys = items.map(it => spYAt(it));
    items.forEach((it, i) => { ox += it.x; oz += it.z; oy = Math.min(oy, ys[i]); }); ox /= items.length; oz /= items.length;
    const smoke = [], glows = [];
    items.forEach((it, i) => {
      const fn = MODELS[it.kind]; if (!fn) return; const c = spCtx(m, it.kind, it, low), r = it.rot || 0, cs = Math.cos(r), sn = Math.sin(r);
      m.at(it.x - ox, ys[i] - oy, it.z - oz, r, () => fn(c));
      const wp = (p) => [it.x + p[0] * cs + p[2] * sn, ys[i] + p[1], it.z - p[0] * sn + p[2] * cs];
      for (const p of c.smoke) { const w = wp(p); smoke.push({ x: w[0], y: w[1], z: w[2], s: it.smokeSize || 1, steam: !!c.steam }); }
      for (const gl of c.glow) { const w = wp(gl); glows.push({ x: w[0], y: w[1], z: w[2], c: gl[3], size: gl[4] }); }
    });
    const geo = m.geo(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, spMat()); mesh.name = 'settle'; mesh.position.set(ox, oy, oz); mesh.castShadow = !low; mesh.receiveShadow = true; add(mesh);
    if (ST.look.night && opts.glow !== false) for (const g of glows) glowSpots.push(g);
    const out = { mesh, tris: geo.index.count / 3, smoke, glows, smokeMesh: null };
    if ((opts.smoke != null ? opts.smoke : !low) && smoke.length) out.smokeMesh = spSmoke(smoke);
    return out;
  }
  function spModelGeo(kind, o, low) { const m = modeller(); m.uv0 = SG_WHITE(); spAtlas(); MODELS[kind](spCtx(m, kind, o || {}, low)); return m.geo(); }
  function spInstance(kind, list, opts = {}) {
    const low = spLow(opts), geo = spModelGeo(kind, opts.model || {}, low), tint = kind === 'cow', km = kind === 'kmPost';
    const mesh = instanced(geo, spMat(), list, (o, it) => { o.position.set(it.x, it.y != null ? it.y : terrain.heightAt(it.x, it.z), it.z); o.rotation.set(0, it.yaw || 0, 0); o.scale.setScalar(it.s || 1); },
      { shadow: opts.shadow === true, color: tint ? (c, it) => { c.setRGB(...hexRGB(it.color != null ? it.color : 0xffffff)); } : km ? (c, it) => { const n = Math.max(0, Math.min(99, it.n | 0)); c.setRGB((n >= 10 ? Math.floor(n / 10) : 10) / 10, (n % 10) / 10, 0); } : null });
    mesh.name = 'settle'; mesh.userData.tris = geo.index.count / 3 * list.length; return mesh;
  }
  const spYaw = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  function spPowerLine(pts, o = {}) {
    const low = spLow(o), H = (o.height || 8.3) + 0.15, sag = o.sag != null ? o.sag : 0.7, list = pts.map((p, i) => ({ x: p.x, z: p.z, y: p.y != null ? p.y : terrain.heightAt(p.x, p.z), yaw: spYaw(pts[Math.max(0, i - 1)] === p ? p : pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + (i === 0 ? 1 : 0))]) }));
    if (list.length > 1) { list[0].yaw = spYaw(pts[0], pts[1]); for (let i = 1; i < list.length; i++) list[i].yaw = spYaw(pts[i - 1], pts[i]); }
    const poles = spInstance('pole', list, { low, model: { height: o.height } });
    const m = modeller(), ox = pts[0].x, oz = pts[0].z, oy = list[0].y;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, px = dz / l, pz = -dx / l;      // across the line
      for (const off of low ? [-0.8, 0.8] : [-0.8, 0, 0.8]) spWire(m, [a.x + px * off - ox, a.y + H - oy, a.z + pz * off - oz], [b.x + px * off - ox, b.y + H - oy, b.z + pz * off - oz], sag, low ? 3 : 6, 0.07, [0.1, 0.1, 0.12]);
    }
    const geo = m.geo(); geo.computeBoundingSphere(); const wires = new THREE.Mesh(geo, spMat()); wires.name = 'settle'; wires.position.set(ox, oy, oz); add(wires);
    return { poles, wires, tris: poles.userData.tris + geo.index.count / 3 };
  }
  function spLiftLine(pts, o = {}) {
    const low = spLow(o), list = pts.map((p, i) => ({ x: p.x, z: p.z, y: p.y != null ? p.y : terrain.heightAt(p.x, p.z), yaw: spYaw(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]) }));
    const pylons = spInstance('liftPylon', list, { low, shadow: false }), m = modeller(), ox = pts[0].x, oz = pts[0].z, oy = list[0].y, step = o.chairs || 40;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, px = dz / l, pz = -dx / l, sag = l * 0.012;
      for (const off of [-1.5, 1.5]) {
        const A = [a.x + px * off - ox, a.y + 11.0 - oy, a.z + pz * off - oz], B = [b.x + px * off - ox, b.y + 11.0 - oy, b.z + pz * off - oz]; spWire(m, A, B, sag, low ? 4 : 8, 0.07, [0.08, 0.08, 0.1]);
        if (!low) for (let d = step * 0.5 + (off > 0 ? step * 0.5 : 0); d < l - 6; d += step) {
          const t = d / l, s = Math.sin(t * Math.PI) * sag, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t - s, z = A[2] + (B[2] - A[2]) * t, yw = Math.atan2(dx, dz);
          m.at(x, y - 1.9, z, yw, () => { m.box(0, 0, 0, 1.0, 0.08, 0.5, [0.85, 0.12, 0.1]); m.box(0, 0.4, -0.22, 1.0, 0.7, 0.07, [0.85, 0.12, 0.1]); m.box(0, 0.95, 0, 0.05, 1.6, 0.05, SP.iron); });
        }
      }
    }
    const geo = m.geo(); geo.computeBoundingSphere(); const cables = new THREE.Mesh(geo, spMat()); cables.name = 'settle'; cables.position.set(ox, oy, oz); add(cables);
    return { pylons, cables, tris: pylons.userData.tris + geo.index.count / 3 };
  }
  function spRailway(pts, o = {}) {
    const low = spLow(o), seg = low ? 28 : 14, hgt = o.height != null ? o.height : 0.9, grass = o.grass || [0.36, 0.52, 0.27], m = modeller();
    m.uv0 = SG_WHITE(); spAtlas();
    const path = [];                                                             // resample
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(l / seg)); for (let k = 0; k < n; k++) path.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }); }
    path.push({ x: pts[pts.length - 1].x, z: pts[pts.length - 1].z });
    const y0 = terrain.heightAt(path[0].x, path[0].z) + hgt, y1 = terrain.heightAt(path[path.length - 1].x, path[path.length - 1].z) + hgt, ox = path[0].x, oz = path[0].z;
    let total = 0; const cum = [0]; for (let i = 1; i < path.length; i++) { total += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); cum.push(total); }
    const cross = path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: p.x, z: p.z, px: dz / l, pz: -dx / l, y: y0 + (y1 - y0) * (cum[i] / (total || 1)) }; });
    const V = (p, off, y) => [p.x + p.px * off - ox, y, p.z + p.pz * off - oz], ballast = [0.55, 0.52, 0.47], ref = (p) => [p.x - ox, p.y - 6, p.z - oz];
    for (let i = 0; i < cross.length - 1; i++) {
      const a = cross[i], b = cross[i + 1], toe = (p, s) => terrain.heightAt(p.x + p.px * s * 4.4, p.z + p.pz * s * 4.4) - 0.3;
      for (const s of [-1, 1]) spFace(m, V(a, s * 2.2, a.y), V(b, s * 2.2, b.y), V(b, s * 4.4, toe(b, s)), V(a, s * 4.4, toe(a, s)), grass, ref(a));
      spFace(m, V(a, -2.2, a.y), V(b, -2.2, b.y), V(b, 2.2, b.y), V(a, 2.2, a.y), ballast, ref(a));
      for (const s of [-1, 1]) m.cyl(V(a, s * 0.72, a.y + 0.2), V(b, s * 0.72, b.y + 0.2), 0.06, 0.06, 3, [0.5, 0.5, 0.54], { open: true });
      if (!low) { const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, px: a.px, pz: a.pz, y: (a.y + b.y) / 2 }, yw = Math.atan2(b.x - a.x, b.z - a.z), l = Math.hypot(b.x - a.x, b.z - a.z);
        for (const t of [-0.3, 0.2]) { const q = [mid.x + (b.x - a.x) * t - ox, mid.y + 0.07, mid.z + (b.z - a.z) * t - oz]; m.at(q[0], q[1], q[2], yw, () => m.quad([-1.3, 0, -0.14], [-1.3, 0, 0.14], [1.3, 0, 0.14], [1.3, 0, -0.14], [0.3, 0.22, 0.16], { two: false })); } void l; }
    }
    const geo = m.geo(); geo.computeBoundingSphere(); const mesh = new THREE.Mesh(geo, spMat()); mesh.name = 'settle'; mesh.position.set(ox, 0, oz); mesh.receiveShadow = true; add(mesh);
    return { mesh, tris: geo.index.count / 3, length: total, a: [path[0].x, y0, path[0].z], b: [path[path.length - 1].x, y1, path[path.length - 1].z] };
  }
  const _spMovers = [];
  function spTrain(o) {
    const low = spLow(o), n = o.cars || 4, m = modeller(); m.uv0 = SG_WHITE(); spAtlas();
    const body = (x, len, col, loco) => {                                         // along -x from x (the front end), nose +x
      const x0 = x - len / 2; m.box(x0, 2.25, 0, len, 2.3, 3.0, spShade(col)); m.box(x0, 0.75, 0, len - 1.0, 0.7, 2.6, SP.iron); m.box(x0, 3.5, 0, len, 0.22, 2.8, spShade(spMul(col, 0.7)));
      for (const s of [-1, 1]) {
        m.box(x0, 1.45, s * 1.51, len, 0.3, 0.04, [0.8, 0.12, 0.1]);
        if (low) m.box(x0, 2.6, s * 1.52, len - 2, 0.8, 0.04, SP.warm, { tw: SG_GLOW });
        else for (let k = 0; k < Math.floor((len - 2) / 2.2); k++) m.box(x0 - (len - 2) / 2 + 1.1 + k * 2.2, 2.65, s * 1.52, 1.5, 0.85, 0.04, loco && k === 0 ? SP.glass : SP.warm, loco && k === 0 ? {} : { tw: SG_GLOW });
        for (const bx of [-0.3, 0.3]) for (const wx of [-len * 0.32, len * 0.32]) m.cyl([x0 + wx + bx * 2, 0.5, s * 1.1], [x0 + wx + bx * 2, 0.5, s * 1.25], 0.5, 0.5, low ? 5 : 7, [0.08, 0.08, 0.09]);
      }
      return x0;
    };
    const blue = [0.16, 0.28, 0.55], cream = [0.9, 0.86, 0.74];
    body(0, 14, blue, true); m.box(0.02, 2.3, 0, 0.06, 1.2, 2.6, SP.glass); m.box(0.04, 1.2, 1.0, 0.06, 0.25, 0.3, [1, 0.95, 0.75], { tw: SG_GLOW }); m.box(0.04, 1.2, -1.0, 0.06, 0.25, 0.3, [1, 0.95, 0.75], { tw: SG_GLOW });
    for (let i = 0; i < n; i++) body(-14.6 - 1 - i * 19.6 + 0, 18.6, cream, false);
    const len = 15 + n * 19.6, geo = m.geo(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, spMat()); mesh.castShadow = !low; const grp = new THREE.Group(); grp.add(mesh); grp.rotation.order = 'YXZ';
    const dx = o.x1 - o.x0, dz = o.z1 - o.z0, D = Math.hypot(dx, dz), hy = o.height != null ? o.height : 0.9, ya = (o.y0 != null ? o.y0 : terrain.heightAt(o.x0, o.z0) + hy) + 0.15, yb = (o.y1 != null ? o.y1 : terrain.heightAt(o.x1, o.z1) + hy) + 0.15;
    const t = { grp, x0: o.x0, z0: o.z0, ux: dx / D, uz: dz / D, D, ya, yb, speed: o.speed || 24, len, d: o.start != null ? o.start : -len, pause: o.pause != null ? o.pause : 8, wait: 0, pitch: Math.atan2(yb - ya, D), loop: o.loop !== false };
    grp.rotation.set(0, Math.atan2(-dz, dx), t.pitch); grp.name = 'settle'; add(grp); _spMovers.push(t); t.tris = geo.index.count / 3; spPlaceTrain(t); return t;
  }
  function spPlaceTrain(t) { const k = t.d / t.D; t.grp.position.set(t.x0 + t.ux * t.d, t.ya + (t.yb - t.ya) * k, t.z0 + t.uz * t.d); t.grp.visible = t.d > -t.len && t.d - t.len < t.D; }
  function spUpdate(dt) {
    SM_T.value += dt;
    for (let i = _spMovers.length - 1; i >= 0; i--) {
      const t = _spMovers[i]; if (t.grp.parent !== stageGroup) { _spMovers.splice(i, 1); continue; }       // an old stage's train
      if (t.wait > 0) { t.wait -= dt; continue; }
      t.d += t.speed * dt; if (t.d > t.D + t.len) { if (t.loop) { t.d = -t.len; t.wait = t.pause; } else t.wait = 1e9; }
      spPlaceTrain(t);
    }
  }
  function spStats(kind, o) {
    const out = {}; for (const low of [false, true]) { const g = spModelGeo(kind === 'cattle' ? 'cow' : kind === 'kmPosts' ? 'kmPost' : kind === 'snowStakes' ? 'snowStake' : kind, o || {}, low); out[low ? 'low' : 'high'] = g.index.count / 3; g.dispose(); } return out;
  }

  const settle = {
    cluster: spCluster, instance: spInstance, powerLine: spPowerLine, liftLine: spLiftLine, railway: spRailway, train: spTrain, smoke: spSmoke, update: spUpdate, stats: spStats, models: MODELS,
    kmPosts: (list, o) => spInstance('kmPost', list, o), snowStakes: (list, o) => spInstance('snowStake', list, o), cattle: (list, o) => spInstance('cow', list, o),
  };
  for (const kind of Object.keys(MODELS)) if (!settle[kind] && kind !== 'cow' && kind !== 'kmPost' && kind !== 'pole' && kind !== 'snowStake') settle[kind] = (x, z, rot, opts) => spCluster([Object.assign({ kind, x, z, rot }, opts)], opts);

  /* ---- showcase on the Test Track start: one cluster per region, so every model can be seen and counted. Called by stage-load.js (Test Track only). ---- */
  function settleDemo() {
    const P0 = sampleAt(40), th = P0.th, fx = Math.sin(th), fz = Math.cos(th), rx = -Math.cos(th), rz = Math.sin(th), face = th - Math.PI / 2;
    const at = (u, v) => ({ x: P0.x + fx * u + rx * v, z: P0.z + fz * u + rz * v });                // u along the road, v to the right (negative = left)
    const put = (kind, u, v, extra) => Object.assign({ kind }, at(u, v), { rot: face }, extra);
    const rows = [
      [[put('barn', 0, -50), put('farmhouse', 20, -46, { rot: face }), put('silo', -16, -44, { twin: true }), put('hayRolls', 36, -40), put('gate', 46, -34)]],
      [[put('church', 70, -50), put('inn', 96, -44, { name: ['THE OLD FORGE'] }), put('shop', 114, -40, { name: ['BIRKWEN STORES'] }), put('marketCross', 128, -30), put('busShelter', 138, -22), put('mailboxes', 144, -20)]],
      [[put('chalet', 168, -50, { snow: true }), put('hut', 186, -40), put('liftPylon', 198, -30), put('avalancheSign', 204, -16)]],
      [[put('restStop', 232, -50), put('onsen', 258, -50), put('station', 284, -56), put('trafficLight', 304, -14, { state: 'green' }), put('levelCrossing', 316, -10)]],
      [[put('tradingPost', 340, -46, { name: ['TRADING POST'] }), put('gasStation', 366, -48), put('waterTower', 388, -34), put('headframe', 404, -50), put('conveyor', 420, -60, { rot: face }), put('windpump', 458, -34), put('boxcars', 474, -40)]],
      [[put('teamVan', 500, -30), put('trailer', 510, -42), put('timingHut', 524, -30), put('signpost', 540, -12, { boards: [{ lines: ['SAWMILL GAP 6 >', 'SKARNFELL 38', 'PORT SALLOW 71'], shape: 'direction' }, { lines: ['BIRKWEN'], shape: 'entry' }] })]],
    ];
    const res = rows.map(r => spCluster(r[0].map(it => it), {}));
    const km = [], cows = [];
    for (let i = 0; i < 6; i++) { const q = at(60 + i * 90, 9.5); km.push({ x: q.x, z: q.z, yaw: face + Math.PI, n: 4 + i * 3 }); }
    for (let i = 0; i < 10; i++) { const q = at(10 + (i % 5) * 7, -80 - Math.floor(i / 5) * 9); cows.push({ x: q.x, z: q.z, yaw: i * 1.9, color: [0xffffff, 0xcaa070, 0x7a5030, 0xd8d0c8][i % 4] }); }
    settle.kmPosts(km); settle.cattle(cows);
    const pl = [0, 1, 2, 3, 4, 5, 6].map(i => at(i * 40, 22)); settle.powerLine(pl);
    const r0 = at(-150, 70), r1 = at(700, 70); settle.railway([r0, r1]); settle.train({ x0: r0.x, z0: r0.z, x1: r1.x, z1: r1.z, cars: 4, speed: 22, start: 120 });
    return res;
  }
