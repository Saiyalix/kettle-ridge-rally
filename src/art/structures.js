  /* ---------- structures: gates, boards, tape lines, guard rails as 3D models (art) ----------
     Only the LOOK is here. Positions, counts and what the car can hit stay in tracks (themes.js, scenery.js, stage-load.js).
     All geometry is built in code with modeller() (art/modeller.js): one merged mesh per kind, vertex colours, no textures except the
     printed faces (banners, sign faces), which keep their own texture so the text stays sharp. */
  const hexRGB = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
  const cssRGB = (s) => hexRGB(parseInt(s.slice(1), 16));
  const mulRGB = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
  let _structMat = null;
  function structMat() { if (!_structMat) { _structMat = lit({ vertexColors: true }); _structMat.userData.keep = true; } return _structMat; }
  let _beaconMat = null;
  function beaconMat() { if (!_beaconMat) { _beaconMat = new THREE.MeshBasicMaterial({ vertexColors: true }); _beaconMat.userData.keep = true; } return _beaconMat; }
  // a flat textured face (uv 0..1) of size w x h at height cy and depth z, facing +z (flip = face -z, with the picture the right way round)
  function facePlane(w, h, cy, z, flip) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(0, cy, 0);
    if (flip) g.rotateY(Math.PI);
    g.translate(0, 0, flip ? -z : z); return g;
  }
  const mergeGeos = (list) => {
    const g = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], idx = [];
    for (const q of list) { const b = pos.length / 3; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); uv.push(...q.attributes.uv.array); for (const i of q.index.array) idx.push(i + b); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  };

  /* ----- gates -----
     gateModel(kind, w, opt) -> { struct, beacons, bw, bh, bannerY, bannerZ }
       kind 'arch'  = inflatable arch (start, finish): chambered legs and beam, knuckles, sandbags, blower, guy ropes, pennants, lights
       kind 'truss' = aluminium truss gantry (checkpoints): box-truss columns and beam, foam pads, ballast, outriggers, spot lamps, flags
       w = distance between the two legs (the old gate width), opt.c1 / opt.c2 = main and second colour (display rgb), opt.checker, opt.lights = 'start' | 'finish' | 'cp'
       struct = lit vertex-coloured geometry, beacons = unlit bright bits (lamps, light discs). bw x bh = banner size, bannerZ = how far the banner planes stand out, glows = [[x, y, z, 0xcolour], ...] lamp positions for the night glow. */
  function gateModel(kind, w, opt = {}) {
    const low = quality === 'low', m = modeller(), bm = modeller(), hw = w / 2, bw = w + 0.3, bh = bw / 8, c1 = opt.c1 || [0.12, 0.55, 0.3], c2 = opt.c2 || [1, 1, 1];
    const grey = [0.46, 0.48, 0.52], dark = [0.16, 0.17, 0.2], alu = [0.78, 0.8, 0.84];
    const glows = [];
    const stake = (x, z) => { m.cyl([x, 0.32, z], [x, -0.05, z], 0.035, 0.02, 4, [0.6, 0.6, 0.62]); };
    const pennant = (x, y, z, col, len) => { m.cyl([x, y, z], [x, y + 1.0, z], 0.013, 0.011, 4, [0.85, 0.85, 0.88], { open: true }); m.tri([x, y + 1.0, z], [x, y + 0.62, z], [x + len, y + 0.81, z + 0.02], col, { two: true }); };
    if (kind === 'arch') {
      const seg = low ? 8 : 12, ch = 0.9, N = 6, cA = opt.checker ? [0.08, 0.08, 0.09] : c1, cB = opt.checker ? [0.96, 0.96, 0.94] : [0.96, 0.96, 0.94];
      for (const sx of [-1, 1]) {
        const x = sx * hw;
        m.cyl([x, 0, 0], [x, 0.16, 0], 0.9, 0.86, 14, dark, {});
        for (let k = 0; k < N; k++) {
          const y0 = 0.16 + k * ch, col = k % 2 ? cB : cA, mid = y0 + ch / 2;
          m.cyl([x, y0, 0], [x, mid, 0], 0.5, 0.62, seg, col, { open: true }); m.cyl([x, mid, 0], [x, y0 + ch, 0], 0.62, 0.5, seg, col, { open: true });
        }
        m.sph(x, 0.16 + N * ch + 0.05, 0, 0.7, 0.62, 0.7, seg, 6, cA, {});
        for (const sz of [-1, 1]) {                                                          // ballast bags and a stake with a guy rope
          m.box(x - sx * 0.1, 0.16, sz * 0.95, 0.9, 0.3, 0.5, [0.2, 0.26, 0.42], { ry: sx * 0.2 }); m.box(x + sx * 0.5, 0.16, sz * 0.95, 0.6, 0.28, 0.46, [0.2, 0.26, 0.42], { ry: -sx * 0.3 });
          const gx = x + sx * 1.9, gz = sz * 2.6; stake(gx, gz); m.cyl([gx, 0.3, gz], [x, 5.7, sz * 0.2], 0.011, 0.011, 3, [0.9, 0.88, 0.8], { open: true });
        }
      }
      const by = 0.16 + N * ch + 0.05, nb = Math.ceil(w / ch);                                // the beam: chambers across, same fat tube
      for (let k = 0; k < nb; k++) {
        const x0 = -hw + w * k / nb, x1 = -hw + w * (k + 1) / nb, xm = (x0 + x1) / 2, col = k % 2 ? cB : cA;
        m.cyl([x0, by, 0], [xm, by, 0], 0.5, 0.6, seg, col, { open: true }); m.cyl([xm, by, 0], [x1, by, 0], 0.6, 0.5, seg, col, { open: true });
      }
      m.box(0, 5.0, 0, bw, bh, 1.3, mulRGB(c1, 0.75));                                       // the banner box (the printed faces are drawn over it)
      m.box(-hw - 1.7, 0.4, 0.2, 0.9, 0.6, 0.8, [0.9, 0.45, 0.1]);                                // the blower and its hose
      m.cyl([-hw - 1.25, 0.45, 0.2], [-hw - 0.5, 0.5, 0.1], 0.14, 0.14, 8, [0.2, 0.2, 0.23], { open: true });
      m.box(hw + 1.8, 0.2, -0.5, 1.3, 0.4, 0.7, [0.55, 0.57, 0.6]);                              // generator / cable box
      for (let k = 0; k < 5; k++) pennant(-hw + 1.6 + (w - 3.2) * k / 4, by + 0.55, 0, k % 2 ? c2 : opt.checker ? [0.1, 0.1, 0.1] : c1, 0.55);
      if (opt.checker) for (const sx of [-1, 1]) {                                          // chequered flags on the knuckles
        const x = sx * hw, y = by + 0.7, fl = 0.9;
        m.cyl([x, y, 0], [x, y + 2.0, 0], 0.016, 0.013, 4, [0.85, 0.85, 0.88]);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x0 = x + 0.02 + fl * i / 4, y0 = y + 2.0 - 0.6 * (j + 1) / 3; m.quad([x0, y0, 0.02], [x0 + fl / 4, y0, 0.02], [x0 + fl / 4, y0 + 0.2, 0.02], [x0, y0 + 0.2, 0.02], (i + j) % 2 ? [0.96, 0.96, 0.94] : [0.08, 0.08, 0.09], { two: true }); }
      } else for (const sx of [-1, 1]) pennant(sx * hw, by + 0.55, 0.0, c2, sx * 0.7);
      if (opt.lights === 'start') for (const sx of [-1, 1]) {                                // countdown lights on the inner legs
        const x = sx * (hw - 0.78);
        m.box(x, 3.5, 0.15, 0.36, 1.1, 0.3, [0.1, 0.1, 0.12]); m.box(x, 3.5, 0.0, 0.1, 0.1, 0.1, [0.1, 0.1, 0.12]);
        [[1, 0.1, 0.08], [1, 0.7, 0.1], [0.15, 0.9, 0.3]].forEach((c, i) => { bm.sph(x, 3.8 - i * 0.3, 0.32, 0.11, 0.11, 0.06, 8, 5, c); glows.push([x, 3.8 - i * 0.3, 0.4, i === 0 ? 0xff2a20 : i === 1 ? 0xffb020 : 0x30ff70]); });
      }
      if (opt.lights === 'finish') for (const sx of [-1, 1]) { bm.sph(sx * (hw - 0.1), by + 0.68, 0, 0.16, 0.16, 0.16, 8, 6, [1, 0.8, 0.1]); glows.push([sx * (hw - 0.1), by + 0.68, 0, 0xffc020]); }
      return { struct: m.geo(), beacons: bm.geo(), bw, bh, bannerY: 5.0, bannerZ: 0.66, glows };
    }
    // aluminium truss gantry
    const H = 6.4, step = low ? 1.0 : 0.6, tr = 0.26;
    const chord = (a, b) => m.cyl(a, b, 0.034, 0.034, 4, alu, { open: true });
    const brace = (a, b) => m.cyl(a, b, 0.016, 0.016, 3, [0.7, 0.72, 0.76], { open: true });
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      const C = [[-tr, -tr], [tr, -tr], [tr, tr], [-tr, tr]];
      for (const [cx, cz] of C) chord([x + cx, 0.1, cz], [x + cx, H, cz]);
      for (let y = 0.1, k = 0; y + step <= H + 0.01; y += step, k++) for (let f = 0; f < 4; f++) {
        const A = C[f], B = C[(f + 1) % 4], up = (k + f) % 2;
        brace([x + A[0], up ? y : y + step, A[1]], [x + B[0], up ? y + step : y, B[1]]);
      }
      m.box(x, 0.06, 0, 1.3, 0.12, 1.3, grey); for (const bx of [-0.5, 0.5]) for (const bz of [-0.5, 0.5]) m.box(x + bx, 0.14, bz, 0.07, 0.06, 0.07, [0.3, 0.3, 0.33]);
      m.box(x, 0.55, 0, 0.64, 1.0, 0.64, [1, 0.8, 0.08]);                                    // foam pad at the foot
      for (const sz of [-1, 1]) { m.box(x, 0.28, sz * 1.15, 0.75, 0.5, 0.55, [0.62, 0.62, 0.6]); m.cyl([x, 0.3, sz * 0.4], [x, 0.3, sz * 1.0], 0.04, 0.04, 4, grey); }       // ballast block and outrigger
      m.box(x, H + 0.08, 0, 0.62, 0.3, 0.62, grey);
      pennant(x, H + 0.2, 0, [1, 0.8, 0.1], sx * 0.7);
    }
    const yb = 5.85, yt = 6.37;
    for (const yy of [yb, yt]) for (const zz of [-tr, tr]) chord([-hw, yy, zz], [hw, yy, zz]);
    const nb = Math.ceil(w / step);
    for (let k = 0; k < nb; k++) {
      const x0 = -hw + w * k / nb, x1 = -hw + w * (k + 1) / nb;
      for (const zz of [-tr, tr]) if (!(low && zz < 0)) { k % 2 ? brace([x0, yb, zz], [x1, yt, zz]) : brace([x0, yt, zz], [x1, yb, zz]); }
      brace([x0, yb, -tr], [x1, yb, tr]); brace([x0, yt, tr], [x1, yt, -tr]);
    }
    for (const lx of [-hw * 0.4, hw * 0.4]) { m.box(lx, H + 0.2, 0.0, 0.34, 0.26, 0.4, dark, { ry: 0.2 }); bm.box(lx, H + 0.2, 0.22, 0.24, 0.16, 0.05, [1, 0.95, 0.7]); }
    if (opt.lights === 'cp') for (const sx of [-1, 1]) { bm.sph(sx * (hw - 0.3), H + 0.33, 0.2, 0.13, 0.13, 0.13, 8, 5, [1, 0.72, 0.1]); glows.push([sx * (hw - 0.3), H + 0.33, 0.2, 0xffb020]); }
    m.box(0, 5.0, 0, bw, bh, 0.07, dark);
    return { struct: m.geo(), beacons: bm.geo(), bw, bh, bannerY: 5.0, bannerZ: 0.04, glows };
  }

  /* ----- sign boards on posts (chevrons, 100 / 50 m boards) -----
     boardFrameGeo(w, h): rim, back plate, bolts and brackets, built around a printed face at height 1.6 + h / 2. Everything is moved 0.12 m forward
     so the post stands behind the board (the face then no longer has a post through it). Face: boardFaceGeo(w, h). */
  const BOARD_Z = 0.12;
  function boardFrameGeo(w, h) {
    const m = modeller(), cy = 1.6 + h / 2, rim = 0.055, steel = [0.55, 0.58, 0.62], dk = [0.1, 0.11, 0.13];
    m.box(0, cy, BOARD_Z - 0.045, w + 2 * rim, h + 2 * rim, 0.014, dk);                      // back plate
    m.box(0, cy + h / 2 + rim / 2, BOARD_Z + 0.0, w + 2 * rim, rim, 0.09, steel); m.box(0, cy - h / 2 - rim / 2, BOARD_Z + 0.0, w + 2 * rim, rim, 0.09, steel);
    m.box(-w / 2 - rim / 2, cy, BOARD_Z + 0.0, rim, h, 0.09, steel); m.box(w / 2 + rim / 2, cy, BOARD_Z + 0.0, rim, h, 0.09, steel);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) m.box(sx * (w / 2 + rim / 2), cy + sy * (h / 2 + rim / 2), BOARD_Z + 0.05, 0.04, 0.04, 0.02, [0.85, 0.86, 0.9]);
    for (const sy of [-0.3, 0.3]) { m.box(0, cy + sy * h, BOARD_Z - 0.09, 0.16, 0.07, 0.07, steel); m.box(0, cy + sy * h, BOARD_Z - 0.125, 0.07, 0.04, 0.03, [0.85, 0.86, 0.9]); }   // clamps around the post
    return m.geo();
  }
  const boardFaceGeo = (w, h) => facePlane(w, h, 1.6 + h / 2, BOARD_Z + 0.036, false);
  // the post: a square steel tube 1 m tall (the instance scales it in y); foot: base plate, bolts, concrete collar
  function postGeo() { const m = modeller(); m.box(0, 0.5, 0, 0.09, 1, 0.09, [0.5, 0.53, 0.57]); m.box(0, 0.5, 0, 0.1, 0.06, 0.1, [0.3, 0.32, 0.35]); return m.geo(); }
  function postFootGeo() {
    const m = modeller(); m.cyl([0, -0.2, 0], [0, 0.07, 0], 0.17, 0.15, 7, [0.55, 0.54, 0.52]); m.box(0, 0.09, 0, 0.26, 0.025, 0.26, [0.42, 0.44, 0.48]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) m.box(a * 0.1, 0.115, b * 0.1, 0.035, 0.03, 0.035, [0.82, 0.83, 0.86]);
    return m.geo();
  }

  /* ----- sponsor boards: 6 m x 1.1 m, a frame with two A-frame legs and a printed front and back -----
     sponsorFrameGeo() is shared by all sponsors; sponsorFaceGeo() has both faces (the back face mirrored so the text reads from behind). */
  function sponsorFrameGeo() {
    const m = modeller(), cy = 1.15, w = 6, h = 1.1, rim = 0.06, ali = [0.74, 0.76, 0.8], dk = [0.12, 0.13, 0.16];
    m.box(0, cy, 0, w + 2 * rim, h + 2 * rim, 0.05, dk);
    m.box(0, cy + h / 2 + rim / 2, 0, w + 2 * rim, rim, 0.1, ali); m.box(0, cy - h / 2 - rim / 2, 0, w + 2 * rim, rim, 0.1, ali);
    m.box(-w / 2 - rim / 2, cy, 0, rim, h, 0.1, ali); m.box(w / 2 + rim / 2, cy, 0, rim, h, 0.1, ali);
    for (const sx of [-1, 1]) {
      const x = sx * 2.7;
      m.cyl([x, 0.0, 0.0], [x, cy - h / 2, 0.0], 0.045, 0.045, 5, [0.5, 0.52, 0.56]);
      m.cyl([x, 0.02, -0.78], [x, cy - h / 2 + 0.1, -0.04], 0.04, 0.04, 5, [0.45, 0.47, 0.52]);              // the stay: leans back so the board does not tip
      m.cyl([x, 0.02, 0.78], [x, cy - h / 2 + 0.1, 0.04], 0.04, 0.04, 5, [0.45, 0.47, 0.52]);
      for (const z of [-0.78, 0.78]) m.box(x, 0.02, z, 0.2, 0.04, 0.2, [0.3, 0.32, 0.35]);
      m.box(x, cy - h / 2 - 0.12, 0.0, 0.14, 0.1, 0.12, [0.85, 0.86, 0.9]);
    }
    return m.geo();
  }
  const sponsorFaceGeo = () => mergeGeos([facePlane(6, 1.1, 1.15, 0.031, false), facePlane(6, 1.1, 1.15, 0.031, true)]);

  /* ----- tape line: three stakes and a sagging red / white tape, 7.5 m long, local x along the line, origin on the ground in the middle ----- */
  function tapeGeo() {
    const low = quality === 'low', m = modeller(), L = 7.5, segs = low ? 6 : 12, y = (x) => 0.92 - 0.07 * (1 - Math.pow(x / (L / 2), 2));
    for (const x of [-L / 2, 0, L / 2]) {
      m.cyl([x, -0.15, 0], [x, 1.0, 0], 0.045, 0.038, low ? 4 : 6, [0.9, 0.2, 0.17]);
      m.cyl([x, 1.0, 0], [x, 1.07, 0], 0.036, 0.01, low ? 4 : 6, [0.96, 0.96, 0.94]);
      m.cyl([x, -0.1, 0], [x, 0.08, 0], 0.075, 0.05, low ? 4 : 6, [0.38, 0.36, 0.32], { open: true });
    }
    for (let i = 0; i < segs; i++) {
      const x0 = -L / 2 + L * i / segs, x1 = -L / 2 + L * (i + 1) / segs, col = i % 2 ? [0.96, 0.96, 0.94] : [0.9, 0.16, 0.14];
      m.quad([x0, y(x0) - 0.05, 0], [x1, y(x1) - 0.05, 0], [x1, y(x1) + 0.05, 0], [x0, y(x0) + 0.05, 0], col, { two: true });
    }
    return m.geo();
  }

  /* ----- guard rails along corners (cornerRails in tracks/scenery.js) -----
     railPostGeo(h, color, railY, railH): a post with base plate, bolts, a collar where the rail is bolted on and a painted top
     railGeo(style, h, color): a unit-long rail (the instance scales it to the length), 'guard' = corrugated steel beam (W profile), anything else = two timber boards */
  function railPostGeo(h, col, railY, railH) {
    const low = quality === 'low', m = modeller(), dk = mulRGB(col, 0.7), bolt = [0.85, 0.86, 0.9];
    m.box(0, h / 2 - 0.1, 0, 0.12, h + 0.2, 0.12, col); m.box(0, railY, 0, 0.19, railH + 0.06, 0.19, dk);
    if (!low) { m.box(0, h + 0.015, 0, 0.15, 0.05, 0.15, [0.9, 0.9, 0.88]); m.box(0, railY, 0.1, 0.05, 0.05, 0.02, bolt); }
    return m.geo();
  }
  function railGeo(style, h, col) {
    const m = modeller(), t = 0.012;
    if (style === 'guard') {
      const f = h / 2, low = quality === 'low', z = low ? [0, 0.05, 0.05, 0] : [0, 0.055, 0.055, 0, 0, 0.055, 0.055, 0], yy = (low ? [-1, -0.4, 0.4, 1] : [-1, -0.82, -0.52, -0.34, 0.34, 0.52, 0.82, 1]).map(v => v * f);
      m.sweep(yy.map((y, i) => [y, z[i]]), -0.5, 0.5, col, { open: true });
    } else {
      for (const k of [-1, 1]) m.box(0, k * h * 0.26, 0, 1, h * 0.42, 0.05, mulRGB(col, k > 0 ? 1 : 0.9));
      m.box(0, 0, -0.015, 1, h * 1.0, 0.02, mulRGB(col, 0.7));
    }
    return m.geo();
  }
