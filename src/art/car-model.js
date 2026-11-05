  /* ---------- the player car: two modelled bodies, four liveries each ----------
     Built in code from lofted cross-sections (art/car-geo.js), painted by art/car-livery.js. Rebuilt when the car, the
     livery or the graphics quality changes (menu time), so nothing here costs anything per frame.
     Physics sizes (CONFIG.wheels) are not touched: wheel centres, radius and the centre of mass are where they were. */
  const car = new Car();
  const carGroup = new THREE.Group();
  const bodyRoot = new THREE.Group(); carGroup.add(bodyRoot);        // everything that is rebuilt lives in here
  const exteriorCabin = [];          // hidden in cockpit view so the camera sees the interior
  const wheelMeshes = car.wheels.map(() => { const steerG = new THREE.Group(), spinG = new THREE.Group(); steerG.add(spinG); carGroup.add(steerG); return { steerG, spinG, flip: null }; });
  scene.add(carGroup);
  let carTailMat = null;
  let carBuilt = null;               // { ci, li, low } of the model on screen
  let carTex = null, carTexKey = '', carStats = { tris: 0, calls: 0, texBytes: 0 };

  const DARK = 0x111214, TRIMC = 0x6d747c;
  // a straight box / extruded profile / cylinder as parts (car space)
  const _boxG = new THREE.BoxGeometry(1, 1, 1), _cylG = new THREE.CylinderGeometry(1, 1, 1, 12);
  function box(part, w, h, d, x, y, z, col, o = {}) { addGeo(part, _boxG, xf(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, w, h, d), col, o.uv); }
  function cyl(part, r, len, x, y, z, col, o = {}) { addGeo(part, o.low ? new THREE.CylinderGeometry(1, 1, 1, 8) : _cylG, xf(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, r, len, r), col, o.uv); }
  // a slab whose outline is drawn in the side view: pts = [[z, y], ...] (counter-clockwise or not), from x0 to x1
  function slab(part, pts, x0, x1, col, o = {}) {
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(-p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.abs(x1 - x0), bevelEnabled: false });
    const m = new THREE.Matrix4().set(0, 0, 1, Math.min(x0, x1), 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
    addGeo(part, g, m, col, o.uv); g.dispose();
  }
  const both = (fn) => { fn(1); fn(-1); };

  // surface height of a hood-like top at (x, z) for a given body spec (same piecewise shape as the lofted rings)
  function topY(sp, z, x) {
    const ys = sp.ys(z), yt = ys + sp.crown(z), ws = sp.w(z) - sp.tumble, ax = Math.abs(x);
    return ax > ws * 0.5 ? ys + (yt - ys) * 0.75 * clamp((ws - ax) / (ws * 0.5), 0, 1) : yt - (yt - ys) * 0.25 * (ax / (ws * 0.5));
  }

  const KESTREL = {
    z0: -2.12, z1: 2.12, tumble: 0.055, arches: [[1.24, -0.2, 0.43], [-1.33, -0.2, 0.43]],
    yb: curve1([[-2.12, -0.15], [-1.98, -0.24], [-1.7, -0.3], [1.7, -0.3], [1.98, -0.25], [2.12, -0.17]]),
    w0: curve1([[-2.12, 0.66], [-2.04, 0.78], [-1.88, 0.86], [-1.2, 0.875], [1.2, 0.875], [1.8, 0.86], [2.0, 0.8], [2.12, 0.68]]),
    ys: curve1([[-2.12, 0.2], [-2.0, 0.285], [-1.7, 0.3], [-1.2, 0.285], [-0.5, 0.265], [0.5, 0.26], [1.0, 0.255], [1.5, 0.235], [1.85, 0.185], [2.0, 0.14], [2.12, 0.05]]),
    crown: curve1([[-2.12, 0], [-1.9, 0.02], [-1.6, 0.035], [-1.2, 0], [0.8, 0], [1.0, 0.02], [1.5, 0.045], [1.9, 0.035], [2.12, 0]]),
    cabin: {
      z0: 0.86, z1: -1.56, belt: 0.0, tumble: 0.15, bz: [-0.42, 0.05],
      yR: curve1([[-1.56, 0.285], [-1.25, 0.52], [-0.95, 0.75], [-0.55, 0.815], [-0.1, 0.815], [0.12, 0.795], [0.55, 0.52], [0.86, 0.255]]),
      wB: curve1([[-1.56, 0.64], [-1.2, 0.74], [-0.9, 0.8], [0.1, 0.8], [0.5, 0.7], [0.86, 0.6]]),
    },
  };
  KESTREL.w = (z) => KESTREL.w0(z) + 0.05 * bump(z, 1.24, 0.55) + 0.055 * bump(z, -1.33, 0.58);
  const STRADA = {
    z0: -1.9, z1: 1.88, tumble: 0.05, arches: [[1.24, -0.2, 0.43], [-1.33, -0.2, 0.43]],
    yb: curve1([[-1.9, -0.2], [-1.76, -0.27], [-1.5, -0.3], [1.5, -0.3], [1.75, -0.27], [1.88, -0.2]]),
    w0: curve1([[-1.9, 0.76], [-1.82, 0.83], [-1.7, 0.86], [-1.2, 0.86], [1.2, 0.86], [1.65, 0.86], [1.8, 0.83], [1.88, 0.76]]),
    ys: curve1([[-1.9, 0.33], [-1.5, 0.345], [-1.0, 0.33], [0.6, 0.31], [1.0, 0.3], [1.7, 0.275], [1.88, 0.25]]),
    crown: curve1([[-1.9, 0], [-1.6, 0.01], [-1.2, 0], [0.5, 0], [0.8, 0.01], [1.3, 0.03], [1.88, 0.01]]),
    cabin: {
      z0: 0.62, z1: -1.74, belt: 0.0, tumble: 0.1, bz: [-0.56, 0.05],
      yR: curve1([[-1.74, 0.36], [-1.5, 0.68], [-1.3, 0.86], [-1.0, 0.9], [-0.4, 0.91], [0.02, 0.89], [0.2, 0.8], [0.45, 0.5], [0.62, 0.31]]),
      wB: curve1([[-1.74, 0.7], [-1.5, 0.77], [-1.2, 0.82], [0.0, 0.82], [0.35, 0.76], [0.62, 0.7]]),
    },
  };
  STRADA.w = (z) => STRADA.w0(z) + 0.04 * bump(z, 1.24, 0.55) + 0.04 * bump(z, -1.33, 0.55);

  /* the lower body: sill to bonnet / boot, with the wheel wells dished into the sides */
  const SIDE_F = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9];
  function lowerBody(sp, P, low) {
    const st = [], step = low ? 0.16 : 0.08, n = Math.ceil((sp.z1 - sp.z0) / step);
    for (let i = 0; i <= n; i++) {
      const z = sp.z0 + (sp.z1 - sp.z0) * i / n, yb = sp.yb(z), w = sp.w(z), ys = sp.ys(z), yt = ys + sp.crown(z), ws = w - sp.tumble, h = ys - yb;
      const half = [[0, yb, 0], [0.42, yb, 0], [w - 0.09, yb, 0]];
      for (const f of SIDE_F) half.push([w - (f < 0.15 ? 0.035 : f > 0.85 ? 0.012 : 0) - (f > 0.3 && f < 0.7 ? -0.006 : 0), yb + f * h, 0]);
      half.push([ws, ys, 0], [ws * 0.5, ys + (yt - ys) * 0.75, 0], [0, yt, 0]);
      for (const [zc, yc, R] of sp.arches) {                         // wheel well: the skin below the arch curve folds up into the arch, the roof of the well is a flat tunnel
        const dz = z - zc; if (Math.abs(dz) >= R) continue;
        const ya = yc + Math.sqrt(R * R - dz * dz);
        for (let k = 3; k <= 10; k++) if (half[k][1] < ya) { half[k][1] = ya; half[k][2] = 1; }
        half[2][0] = 0.45; half[2][1] = ya; half[2][2] = 1; half[1][2] = 1;
      }
      st.push({ z, ring: mirrorRing(half) });
    }
    const dk = hx3(DARK), wh = [1, 1, 1], zA = sp.z1 - 0.2, zB = sp.z0 + 0.2;
    loft(st, (i, j, f) => {
      let col = wh;
      if (f.flags >= 1) col = [0.04, 0.04, 0.05];
      else if (f.band <= 1 || (f.band >= 10 && f.z < sp.cabin.z0 - 0.04 && f.z > sp.cabin.z1 + 0.04)) col = dk;      // underside, and the deck under the cabin (seen from the cockpit view)
      else if (f.band <= 3 && Math.abs(f.z - 0.2) < 0.8 && !f.cap) col = dk;                // side skirts
      else if ((f.z > zA || f.z < zB) && f.band <= 5) col = dk;                              // bumper plastic
      return { part: P.body, col, uv: true };
    }, { N: 13, crease: 34 });
  }

  /* the cabin: roof, pillars, glass. Everything above the belt line; hidden in the cockpit view */
  function cabinLoft(sp, P, low) {
    const c = sp.cabin, st = [], step = low ? 0.12 : 0.06, n = Math.ceil(Math.abs(c.z1 - c.z0) / step);
    for (let i = 0; i <= n; i++) {
      const z = c.z0 + (c.z1 - c.z0) * i / n, yB = sp.ys(z) + 0.003, H = Math.max(0.006, c.yR(z) - yB), wB = c.wB(z), wT = wB - c.tumble, wR = wT - 0.035;
      const half = [[0, yB], [wB, yB], [wB - 0.012, yB + 0.1 * H], [wT, yB + 0.9 * H], [wR, yB + 0.965 * H], [wR * 0.5, yB + 0.995 * H], [0, yB + H + 0.008]];
      st.push({ z, ring: mirrorRing(half) });
    }
    st.reverse();
    const black = [0.035, 0.035, 0.04], wh = [1, 1, 1];
    loft(st, (i, j, f) => {
      if (f.band === 0) return null;
      if (f.band === 1 || f.cap) return { part: P.cabin, col: wh, uv: true };
      if (f.band === 3) return { part: P.cabin, col: black, uv: false };
      if (f.band === 2) return Math.abs(f.z - c.bz[0]) < c.bz[1] * 0.5 ? { part: P.cabin, col: black, uv: false } : { part: P.glass, col: [1, 1, 1], uv: false };
      return (f.n[2] > 0.28 || f.n[2] < -0.28) ? { part: P.glass, col: [1, 1, 1], uv: false } : { part: P.cabin, col: wh, uv: true };
    }, { N: 7, crease: 40 });
  }

  /* a wheel: tyre, rim with spokes, brake disc. Axis = +x, outer face towards +x */
  function wheelPart(R, rimCol, band, kind, low) {
    const p = newPart(), k = R / 0.32, segs = low ? 14 : 28;
    const tyre = [[0.215, -0.118], [0.255, -0.13], [0.292, -0.122], [0.314, -0.092], [0.32, -0.05], [0.32, 0.05], [0.314, 0.092], [0.292, 0.122], [0.255, 0.13], [0.236, 0.127], [0.215, 0.118]].map(q => [q[0] * k, q[1]]);
    const bandC = hx3(band);
    addLathe(p, tyre, segs, null, (x, y, z) => { const r = Math.hypot(y, z); return (x > 0.12 && r > 0.236 * k && r < 0.262 * k) ? bandC : [0.075, 0.077, 0.082]; });
    const rc = hx3(rimCol), rcd = rc.map(v => v * 0.55);
    addLathe(p, [[0.238 * k, 0.128], [0.2 * k, 0.128]], segs, null, rc);                                                          // rim lip (faces out)
    addLathe(p, [[0.2 * k, 0.128], [0.19 * k, 0.03]], segs, null, rcd);                                                             // barrel, seen from inside
    addLathe(p, [[0.185 * k, 0.03], [0.0, 0.03]], segs, null, [0.2, 0.2, 0.22]);                                                    // brake disc
    addLathe(p, [[0.185 * k, 0.03], [0.19 * k, 0.012], [0.12 * k, 0.012], [0.12 * k, 0.03]], segs, null, [0.45, 0.2, 0.18]);         // disc edge
    addLathe(p, [[0.05, 0.088], [0.04, 0.098], [0.0, 0.098]], segs, null, rcd);                                                     // hub cap
    const sp = kind.spokes, tw = kind.twin;
    for (let s = 0; s < sp; s++) {
      const a = s / sp * Math.PI * 2;
      for (const off of (tw ? [-0.024, 0.024] : [0])) {
        const m = new THREE.Matrix4().makeRotationX(a).multiply(xf(0.108, 0.125 * k, off, 0, 0, tw ? off * 1.6 : 0, 0.02, 0.15 * k, tw ? 0.02 : kind.w));
        addGeo(p, _boxG, m, rc);
      }
      if (!low) {                                                                                                                                                 // lug nuts
        addGeo(p, _boxG, new THREE.Matrix4().makeRotationX(a + 0.3).multiply(xf(0.1, 0.065, 0, 0, 0, 0, 0.024, 0.016, 0.016)), rcd);
      }
    }
    return p;
  }

  /* small shared bits */
  function numberPlate(ci, L, rear) {
    const tex = paintPlate(L.plate, rear);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: tex }));
    m.userData.plateTex = tex; return m;
  }

  // exhaust tailpipe: flared chrome tip with a dark bore, pointing back
  function exhaust(P, x, y, z, low) {
    const g = new THREE.CylinderGeometry(0.05, 0.036, 0.2, low ? 8 : 12, 1, true);
    addGeo(P.trim, g, xf(x, y, z, Math.PI / 2), hx3(0xc4cad0)); g.dispose();
    cyl(P.dark, 0.036, 0.04, x, y, z + 0.0, hx3(0x08080a), { rx: Math.PI / 2, low });
  }
  function buildKestrelDetails(P, L, low, mats) {
    const sp = KESTREL, dk = hx3(DARK), lens = hx3(0xf4f1dc), red = hx3(0x8c1014), chrome = hx3(0xc4cad0);
    // headlights: a dark bezel with a raised rim, an angled lit lens, a projector and an inner reflector, set into the nose slope
    both((s) => {
      const z = 1.96, x = s * 0.55, y = topY(sp, z, 0.55), sl = -Math.atan((topY(sp, z + 0.1, 0.55) - topY(sp, z - 0.1, 0.55)) / 0.2);
      box(P.dark, 0.4, 0.03, 0.2, x, y + 0.002, z + 0.04, dk, { rx: sl, ry: s * 0.14 });
      box(P.trim, 0.37, 0.006, 0.17, x, y + 0.017, z + 0.045, hx3(0x8d949c), { rx: sl, ry: s * 0.14 });
      box(P.lamp, 0.33, 0.012, 0.13, x, y + 0.02, z + 0.05, lens, { rx: sl - 0.12, ry: s * 0.14 });
      cyl(P.lamp, 0.048, 0.01, x + s * 0.06, y + 0.026, z + 0.055, hx3(0xffffff), { rx: sl, low });
      cyl(P.trim, 0.056, 0.008, x + s * 0.06, y + 0.022, z + 0.055, hx3(0x6a7078), { rx: sl, low });
      box(P.dark, 0.06, 0.03, 0.12, s * 0.8, y - 0.03, z - 0.08, dk, { rx: sl, ry: s * 0.5 });          // side marker / fender corner
    });
    // front intake, side intakes, grille bars, and a tapered splitter on two struts
    box(P.dark, 0.74, 0.1, 0.02, 0, -0.14, 2.12, dk);
    for (let k = 0; k < 4; k++) box(P.trim, 0.012, 0.09, 0.026, -0.27 + k * 0.18, -0.14, 2.124, chrome);
    box(P.trim, 0.7, 0.012, 0.026, 0, -0.105, 2.126, chrome);
    both((s) => {
      box(P.dark, 0.22, 0.075, 0.04, s * 0.58, -0.17, 2.07, dk, { ry: s * 0.45 });
      box(P.trim, 0.2, 0.008, 0.04, s * 0.58, -0.13, 2.075, chrome, { ry: s * 0.45 });
      box(P.dark, 0.03, 0.05, 0.04, s * 0.42, -0.28, 2.0, dk);
    });
    loft([[1.98, 0.64], [2.08, 0.66], [2.19, 0.52]].map(a => ({ z: a[0], ring: BOXRING(0, -0.292 + (a[0] - 1.98) * 0.1, a[1], 0.011) })), () => ({ part: P.dark, col: dk, uv: false }), { N: 4, crease: 50 });
    both((s) => { for (const zz of [1.62, 0.95]) cyl(P.trim, 0.018, 0.012, s * 0.45, topY(sp, zz, 0.45) + 0.006, zz, chrome, { low }); });
    // bonnet: two vents and a power bulge with an intake
    both((s) => { for (let k = 0; k < 4; k++) box(P.dark, 0.2, 0.01, 0.025, s * 0.4, topY(sp, 1.24 + k * 0.055, 0.4) + 0.008, 1.24 + k * 0.055, dk, { rx: -0.03 }); });
    {
      const st = [[0.95, 0.15, 0.0], [1.25, 0.19, 0.05], [1.62, 0.2, 0.05], [1.74, 0.17, 0.0]].map(a => ({ z: a[0], ring: BOXRING(0, topY(sp, a[0], 0) + a[2] * 0.5 - 0.005 + 0.012, a[1], 0.015 + a[2] * 0.5) }));
      loft(st, (i, j, f) => (f.cap && f.n[2] > 0 ? { part: P.dark, col: dk, uv: false } : { part: P.body, col: [1, 1, 1], uv: true }), { N: 4, crease: 50 });
    }
    // tail lights, exhaust, rear plate area
    both((s) => { box(P.tail, 0.46, 0.065, 0.025, s * 0.5, 0.1, -2.11, red); box(P.dark, 0.5, 0.1, 0.02, s * 0.5, 0.1, -2.1, dk); });
    box(P.tail, 0.3, 0.02, 0.02, 0, 0.12, -2.115, red);
    exhaust(P, -0.46, -0.26, -2.14, low);
    both((s) => slab(P.dark, [[-2.04, -0.25], [-2.14, -0.25], [-2.17, -0.2], [-2.1, -0.2]], s * 0.2, s * 0.62, dk));        // diffuser, tapered
    // rear wing: endplates, uprights, main plane, flap
    const wc = hx3(L.wing), wz = -1.83, wy = 0.68;
    // thin endplates about as tall as the wing is deep, airfoil-section planes, tapered uprights
    both((s) => {
      slab(P.body, [[wz + 0.2, wy - 0.07], [wz + 0.2, wy + 0.09], [wz + 0.05, wy + 0.14], [wz - 0.2, wy + 0.16], [wz - 0.23, wy + 0.08], [wz - 0.23, wy - 0.09], [wz, wy - 0.09]], s * 0.9, s * 0.914, wc, { uv: true });
      slab(P.dark, [[wz + 0.07, wy - 0.24], [wz - 0.03, wy - 0.24], [wz - 0.04, wy], [wz + 0.04, wy]], s * 0.5, s * 0.55, dk);
    });
    slab(P.trim, [[wz + 0.19, wy - 0.005], [wz + 0.15, wy + 0.025], [wz, wy + 0.04], [wz - 0.2, wy + 0.07], [wz - 0.22, wy + 0.05], [wz - 0.02, wy - 0.015]], -0.9, 0.9, wc, { uv: false });
    slab(P.trim, [[wz - 0.12, wy + 0.1], [wz - 0.16, wy + 0.135], [wz - 0.3, wy + 0.2], [wz - 0.3, wy + 0.17], [wz - 0.2, wy + 0.1]], -0.9, 0.9, wc, { uv: false });
    box(P.dark, 1.8, 0.03, 0.012, 0, wy + 0.2, wz - 0.3, dk, { rx: -0.3 });
    // mirrors and wipers, roof vent, aerial
    both((s) => {
      box(P.dark, 0.1, 0.014, 0.014, s * 0.78, 0.4, 0.6, dk, { rz: s * 0.5 });
      box(P.body, 0.12, 0.085, 0.17, s * 0.93, 0.455, 0.56, [1, 1, 1], { ry: s * 0.12, uv: true });
      box(P.dark, 0.095, 0.07, 0.01, s * 0.93, 0.455, 0.47, dk, { ry: s * 0.12 });
      box(P.dark, 0.26, 0.008, 0.012, s * 0.3, 0.33, 0.78, dk, { ry: s * 0.15, rz: s * 0.08 });
    });
    box(P.cabin, 0.4, 0.035, 0.34, 0, 0.83, -0.12, dk); box(P.cabin, 0.3, 0.04, 0.05, 0, 0.84, -0.0, [0.0, 0.0, 0.0]);
    cyl(P.dark, 0.008, 0.3, 0.4, 0.4, -1.55, dk, { rx: -0.5, low });
    // side skirt blades and mudflaps
    both((s) => {
      box(P.dark, 0.05, 0.05, 1.5, s * 0.865, -0.265, -0.07, dk, { rx: 0 });
      for (const zc of [1.24, -1.33]) slab(P.dark, [[zc - 0.4, -0.27], [zc - 0.55, -0.27], [zc - 0.53, -0.43], [zc - 0.43, -0.43]], s * 0.835, s * 0.85, dk);
    });
    // front fog / rally light pod
    if (L.pod) {
      box(P.dark, 1.0, 0.02, 0.05, 0, topY(sp, 1.86, 0) + 0.0, 1.9, dk, { rx: -0.2 });
      for (const lx of [-0.36, -0.12, 0.12, 0.36]) {
        cyl(P.dark, 0.075, 0.07, lx, topY(sp, 1.88, 0) + 0.06, 1.9, dk, { rx: Math.PI / 2 - 0.2, low });
        cyl(P.lamp, 0.062, 0.012, lx, topY(sp, 1.88, 0) + 0.063, 1.935, lens, { rx: Math.PI / 2 - 0.2, low });
      }
    }
    // plates
    return { frontPlate: [0, -0.205, 2.125, 0], rearPlate: [0, -0.1, -2.12, Math.PI] };
  }

  function buildStradaDetails(P, L, low, mats) {
    const sp = STRADA, dk = hx3(DARK), lens = hx3(0xf4f1dc), red = hx3(0x8c1014), chrome = hx3(0xc4cad0), amber = hx3(0xff9a1a);
    // boxy lamps with a dark surround, amber indicators in the bumper
    both((s) => {
      box(P.dark, 0.34, 0.16, 0.02, s * 0.54, 0.16, 1.88, dk);
      box(P.lamp, 0.3, 0.12, 0.012, s * 0.54, 0.16, 1.892, lens);
      box(P.lamp, 0.12, 0.04, 0.012, s * 0.78, -0.12, 1.86, amber, { ry: s * 0.4 });
    });
    box(P.dark, 0.5, 0.1, 0.02, 0, 0.17, 1.88, dk); box(P.trim, 0.46, 0.014, 0.024, 0, 0.19, 1.886, chrome); box(P.trim, 0.46, 0.014, 0.024, 0, 0.145, 1.886, chrome);
    box(P.dark, 1.5, 0.03, 0.14, 0, -0.29, 1.84, dk);                                        // lip
    box(P.dark, 0.8, 0.09, 0.02, 0, -0.13, 1.885, dk);
    // bonnet: raised centre bulge and two slots, pins
    both((s) => { for (let k = 0; k < 3; k++) box(P.dark, 0.22, 0.01, 0.022, s * 0.4, topY(sp, 1.3 + k * 0.05, 0.4) + 0.006, 1.3 + k * 0.05, dk); });
    both((s) => { for (const zz of [1.6, 0.9]) cyl(P.trim, 0.018, 0.012, s * 0.48, topY(sp, zz, 0.48) + 0.006, zz, chrome, { low }); });
    {
      const st = [[0.85, 0.2, 0.0], [1.0, 0.24, 0.04], [1.55, 0.24, 0.04], [1.7, 0.2, 0.0]].map(a => ({ z: a[0], ring: BOXRING(0, topY(sp, a[0], 0) + a[2] * 0.5 - 0.004, a[1], 0.012 + a[2] * 0.5) }));
      loft(st, () => ({ part: P.body, col: [1, 1, 1], uv: true }), { N: 4, crease: 50 });
    }
    // rear: tall tail lamps, bumper, exhaust, wiper, hatch handle
    both((s) => { box(P.tail, 0.14, 0.34, 0.025, s * 0.78, 0.2, -1.89, red, { ry: s * -0.25 }); box(P.dark, 0.18, 0.38, 0.02, s * 0.78, 0.2, -1.885, dk, { ry: s * -0.25 }); });
    box(P.dark, 1.4, 0.07, 0.03, 0, -0.2, -1.9, dk); box(P.dark, 0.3, 0.04, 0.03, 0, 0.3, -1.9, dk);
    exhaust(P, 0.46, -0.27, -1.96, low);
    // roof spoiler with end fins, roof vent, aerial
    const wc = hx3(L.wing);
    box(P.trim, 1.12, 0.03, 0.22, 0, 0.88, -1.43, wc, { rx: 0.18 });
    both((s) => slab(P.body, [[-1.28, 0.88], [-1.28, 0.93], [-1.4, 0.96], [-1.58, 0.92], [-1.6, 0.84]], s * 0.55, s * 0.565, wc, { uv: false }));
    box(P.cabin, 0.38, 0.035, 0.28, 0, 0.935, -0.45, dk); box(P.cabin, 0.3, 0.04, 0.05, 0, 0.945, -0.36, [0, 0, 0]);
    cyl(P.dark, 0.008, 0.3, 0.45, 0.42, -1.5, dk, { rx: -0.35, low });
    // mirrors, wipers, arch flares, mudflaps, sills
    both((s) => {
      for (const zc of [1.24, -1.33]) {                     // bolted-on box flares, a little wider than the body, with bolt heads
        const R = 0.44, yc = -0.2, pts = [[zc - 0.55, -0.31], [zc - 0.55, 0.33], [zc + 0.55, 0.33], [zc + 0.55, -0.31], [zc + Math.sqrt(R * R - 0.11 * 0.11), -0.31]];
        for (let a = -14; a <= 194; a += low ? 26 : 13) pts.push([zc + R * Math.cos(a * Math.PI / 180), yc + R * Math.sin(a * Math.PI / 180)]);
        pts.push([zc - Math.sqrt(R * R - 0.11 * 0.11), -0.31]);
        slab(P.body, pts, s * 0.86, s * 0.95, [1, 1, 1], { uv: true });
        for (const [bz, by] of [[-0.48, 0.28], [0.48, 0.28], [-0.48, -0.26], [0.48, -0.26], [0, 0.29]]) cyl(P.trim, 0.016, 0.01, s * 0.957, by, zc + bz, hx3(0x9aa0a8), { rz: Math.PI / 2, low });
      }
      box(P.dark, 0.09, 0.014, 0.014, s * 0.76, 0.43, 0.5, dk, { rz: s * 0.4 });
      box(P.body, 0.11, 0.09, 0.15, s * 0.9, 0.48, 0.46, [1, 1, 1], { ry: s * 0.12, uv: true });
      box(P.dark, 0.09, 0.07, 0.01, s * 0.9, 0.48, 0.38, dk, { ry: s * 0.12 });
      box(P.dark, 0.3, 0.008, 0.012, s * 0.3, 0.37, 0.56, dk, { ry: s * 0.15, rz: s * 0.1 });
      box(P.dark, 0.06, 0.05, 1.3, s * 0.845, -0.265, -0.05, dk);
      for (const zc of [1.24, -1.33]) {
        slab(P.dark, [[zc - 0.4, -0.27], [zc - 0.55, -0.27], [zc - 0.53, -0.43], [zc - 0.43, -0.43]], s * 0.83, s * 0.845, dk);
      }
    });
    if (L.pod) {
      box(P.dark, 0.9, 0.02, 0.05, 0, 0.3, 1.88, dk);
      for (const lx of [-0.32, -0.1, 0.1, 0.32]) { cyl(P.dark, 0.07, 0.07, lx, 0.36, 1.9, dk, { rx: Math.PI / 2, low }); cyl(P.lamp, 0.058, 0.012, lx, 0.36, 1.935, lens, { rx: Math.PI / 2, low }); }
    }
    return { frontPlate: [0, -0.2, 1.9, 0], rearPlate: [0, 0.0, -1.905, Math.PI] };
  }

  function carMaterials(low, L) {
    const m = {};
    if (low) {
      m.paint = new THREE.MeshLambertMaterial({ map: carTex, vertexColors: true });
      m.dark = new THREE.MeshLambertMaterial({ vertexColors: true }); m.trim = m.dark;
      m.glass = new THREE.MeshLambertMaterial({ color: 0x2a3d50 });
    } else {
      // glossy clear-coated paint: a satin base under a sharp lacquer layer that mirrors the sky (physical material, high quality only)
      m.paint = new THREE.MeshPhysicalMaterial({ map: carTex, vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMap: envPMREM(), envMapIntensity: 0.65 });
      m.dark = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x333333, shininess: 30, envMap, reflectivity: 0.12, combine: THREE.MixOperation });
      m.trim = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0xffffff, shininess: 90, envMap, reflectivity: 0.5, combine: THREE.MixOperation });
      m.glass = new THREE.MeshPhongMaterial({ color: 0x22364a, specular: 0xffffff, shininess: 140, envMap, reflectivity: 0.55, combine: THREE.MixOperation });
      m.glass.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_fragment>', 'specularStrength *= 0.25 + 0.9 * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.0);\n#include <envmap_fragment>'); };
      m.glass.customProgramCacheKey = () => 'carglass';
    }
    m.lamp = new THREE.MeshBasicMaterial({ vertexColors: true }); m.tail = new THREE.MeshBasicMaterial({ vertexColors: true });      // tail lamps get brighter under braking (carTailMat.color)
    return m;
  }

  let carMatsLive = [];
  function disposeTree(o) {
    o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.isMesh && c.material && c.userData.own) { const mm = Array.isArray(c.material) ? c.material : [c.material]; mm.forEach(x => { if (x.map && c.userData.plateTex) x.map.dispose(); x.dispose(); }); } });
  }

  function buildPlayerCar(ci, li, low) {
    const L = CONFIG.cars[ci].liveries[li], sp = ci === 0 ? KESTREL : STRADA;
    while (bodyRoot.children.length) { const c = bodyRoot.children[0]; bodyRoot.remove(c); disposeTree(c); }
    for (const wm of wheelMeshes) if (wm.flip) { wm.spinG.remove(wm.flip); disposeTree(wm.flip); wm.flip = null; }
    // livery texture
    const size = low ? 512 : 1024, key = ci + ':' + li + ':' + size;
    if (carTexKey !== key) {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * CT.H / CT.W);
      paintLivery(cv, ci, L);
      if (carTex) carTex.dispose();
      carTex = new THREE.CanvasTexture(cv); carTex.anisotropy = maxAniso; carTex.colorSpace = THREE.SRGBColorSpace; carTexKey = key;
      carStats.texBytes = Math.round(cv.width * cv.height * 4 * 1.33);
    }
    for (const m of carMatsLive) m.dispose();
    const mats = carMaterials(low, L); carMatsLive = [...new Set(Object.values(mats))];
    const P = { body: newPart(), cabin: newPart(), glass: newPart(), dark: newPart(), trim: newPart(), lamp: newPart(), tail: newPart() };
    lowerBody(sp, P, low); cabinLoft(sp, P, low);
    const det = ci === 0 ? buildKestrelDetails(P, L, low, mats) : buildStradaDetails(P, L, low, mats);
    // the cabin mesh carries the roof extras too (they are black parts on the paint material), so they hide together
    const mk = (part, mat, shadow, cab) => {
      if (!part.pos.length) return null;
      const m = new THREE.Mesh(partGeo(part), mat); m.castShadow = shadow; m.userData.own = false; bodyRoot.add(m); if (cab) exteriorCabin.push(m); return m;
    };
    exteriorCabin.length = 0;
    carTailMat = mats.tail; mk(P.tail, mats.tail, false, false);
    mk(P.body, mats.paint, true, false); mk(P.cabin, mats.paint, true, true); mk(P.glass, mats.glass, false, true);
    mk(P.dark, mats.dark, true, false); if (P.trim.pos.length) mk(P.trim, mats.trim, false, false); mk(P.lamp, mats.lamp, false, false);
    const mk2 = (pt, pl) => { const m = numberPlate(ci, L, pl); m.position.set(pt[0], pt[1], pt[2]); m.rotation.y = pt[3]; m.userData.own = true; bodyRoot.add(m); };
    mk2(det.frontPlate, false); mk2(det.rearPlate, true);
    // wheels
    const kind = ci === 0 ? { spokes: 6, twin: true, w: 0.04 } : { spokes: 5, twin: false, w: 0.07 };
    const wp = wheelPart(CONFIG.wheels.radius, L.wheel, L.a, kind, low), wg = partGeo(wp);
    const wmat = low ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x666666, shininess: 70, envMap, reflectivity: 0.3, combine: THREE.MixOperation });
    carMatsLive.push(wmat);
    car.wheels.forEach((w, i) => {
      const flip = new THREE.Group(); const m = new THREE.Mesh(wg, wmat); m.castShadow = true; flip.add(m);
      if (w.local.x < 0) flip.rotation.y = Math.PI;
      wheelMeshes[i].spinG.add(flip); wheelMeshes[i].flip = flip;
    });
    carStats.tris = (P.body.pos.length + P.cabin.pos.length + P.glass.pos.length + P.dark.pos.length + P.trim.pos.length + P.lamp.pos.length + P.tail.pos.length) / 9 + 4 * wp.pos.length / 9 + 4;
    carStats.calls = bodyRoot.children.length + 4;
    carBuilt = { ci, li, low };
  }

  // applyLivery(): build / repaint the car for CONFIG.carIndex. With arguments it also picks a livery first.
  function applyLivery(ci, li) {
    if (ci != null && li != null) { liveryChoice[ci] = ((li % CONFIG.cars[ci].liveries.length) + CONFIG.cars[ci].liveries.length) % CONFIG.cars[ci].liveries.length; try { localStorage.setItem('rallyLivery:' + CONFIG.cars[ci].id, CONFIG.cars[ci].liveries[liveryChoice[ci]].id); } catch (e) { /* ignore */ } CONFIG.carIndex = ci; }
    const c = CONFIG.carIndex, l = liveryIndex(c), low = quality === 'low';
    if (carBuilt && carBuilt.ci === c && carBuilt.li === l && carBuilt.low === low) return;
    buildPlayerCar(c, l, low);
  }

  /* ---------- cockpit interior (third camera) ---------- */
  // Car local axes: +x is the car's LEFT, +y up, +z forward. Left-hand drive, so the driver sits at +x.
  const cockpit = new THREE.Group(); cockpit.visible = false; carGroup.add(cockpit);
  const DRV = 0.37;
  const EYE = new THREE.Vector3(DRV, 0.56, -0.3);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const taperCyl = new THREE.CylinderGeometry(0.72, 1, 1, 10);
  const _Y = new THREE.Vector3(0, 1, 0), _bd = new THREE.Vector3();
  function placeBar(m, a, b, r) {
    _bd.subVectors(b, a); const len = _bd.length() || 1e-4;
    m.position.copy(a).addScaledVector(_bd, 0.5); m.scale.set(r, len, r);
    m.quaternion.setFromUnitVectors(_Y, _bd.multiplyScalar(1 / len));
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let wheelTilt, wheelSpin, handRing, needle, shiftLamp, arms = [];
  {
    const mDash = lit({ color: 0x25282c });
    const mTrim = lit({ color: 0x3a3e44 });
    const mCage = lit({ color: 0xbfc5cc });
    const mPaint = lit({ color: 0xe9ecef });
    const mSuede = lit({ color: 0x1d1e21 });
    const mGlove = lit({ color: 0x17181b });
    const mSuit = lit({ color: 0x1f4fa3 });
    const mCuff = lit({ color: 0xd8342c });
    const mYellow = new THREE.MeshBasicMaterial({ color: 0xffc928 });
    const box = (w, h, d, mat, x, y, z, parent = cockpit) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const bar = (a, b, r, mat, parent = cockpit) => { const m = new THREE.Mesh(unitCyl, mat); placeBar(m, a, b, r); parent.add(m); return m; };

    // dashboard, binnacle, console, doors, pillars, roof
    box(1.64, 0.17, 0.5, mDash, 0, 0.27, 0.52);
    box(1.64, 0.03, 0.06, mTrim, 0, 0.355, 0.28);
    box(0.36, 0.1, 0.14, mDash, DRV, 0.415, 0.37);
    box(0.26, 0.2, 0.9, mDash, 0.0, 0.17, -0.05);
    for (const sx of [1, -1]) {
      box(0.1, 0.05, 1.9, mTrim, sx * 0.83, 0.37, -0.35);
      box(0.05, 0.28, 1.9, mTrim, sx * 0.86, 0.22, -0.35);
      bar(V(sx * 0.75, 0.22, 0.74), V(sx * 0.63, 0.74, 0.3), 0.04, mPaint);          // A-pillar
      bar(V(sx * 0.84, 0.38, -1.0), V(sx * 0.69, 0.76, -1.0), 0.045, mPaint);        // B-pillar
      // roll cage
      bar(V(sx * 0.68, 0.18, 0.6), V(sx * 0.58, 0.72, 0.27), 0.02, mCage);
      bar(V(sx * 0.66, 0.18, -0.95), V(sx * 0.6, 0.73, -0.95), 0.022, mCage);
      bar(V(sx * 0.58, 0.72, 0.27), V(sx * 0.6, 0.73, -0.95), 0.02, mCage);
      bar(V(sx * 0.76, 0.2, 0.52), V(sx * 0.76, 0.44, -0.92), 0.02, mCage);           // door bar
    }
    box(1.32, 0.06, 0.08, mPaint, 0, 0.74, 0.3);
    box(1.36, 0.03, 1.6, mTrim, 0, 0.77, -0.5);
    bar(V(0.58, 0.72, 0.27), V(-0.58, 0.72, 0.27), 0.02, mCage);
    bar(V(0.6, 0.73, -0.95), V(-0.6, 0.73, -0.95), 0.022, mCage);
    bar(V(0.6, 0.73, -0.95), V(-0.66, 0.18, -0.95), 0.02, mCage);                     // diagonal in main hoop

    // floor and the driver's legs reaching for the pedals
    box(1.6, 0.02, 1.7, mDash, 0, 0.222, -0.35);
    for (const lx of [0.09, -0.09]) {
      bar(V(DRV + lx, 0.29, -0.5), V(DRV + lx, 0.33, 0.06), 0.065, mSuit);
      bar(V(DRV + lx, 0.33, 0.06), V(DRV + lx, 0.235, 0.42), 0.05, mSuit);
    }
    // sequential gear lever and handbrake
    bar(V(0.1, 0.27, 0.2), V(0.12, 0.39, 0.13), 0.01, mCage);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mDash); knob.position.set(0.12, 0.395, 0.13); cockpit.add(knob);
    bar(V(0.06, 0.27, -0.2), V(0.1, 0.48, -0.08), 0.012, mCage);

    // tacho
    const tc = document.createElement('canvas'); tc.width = tc.height = 256; const tg = tc.getContext('2d');
    tg.fillStyle = '#0c0e10'; tg.beginPath(); tg.arc(128, 128, 126, 0, 7); tg.fill();
    tg.lineCap = 'butt';
    for (let v = 0; v <= 8000; v += 500) {
      const a = (-135 + 270 * v / 8000) * D2R, major = v % 1000 === 0, red = v >= 7000;
      tg.strokeStyle = red ? '#ff4b3e' : '#e9ecef'; tg.lineWidth = major ? 6 : 3;
      const r1 = major ? 92 : 102;
      tg.beginPath(); tg.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); tg.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); tg.stroke();
      if (major) { tg.fillStyle = red ? '#ff4b3e' : '#e9ecef'; tg.font = '700 30px "Saira Condensed", sans-serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(String(v / 1000), 128 + Math.sin(a) * 70, 128 - Math.cos(a) * 70); }
    }
    tg.fillStyle = '#93a2ad'; tg.font = '600 16px "Saira Condensed", sans-serif'; tg.fillText('x1000 rpm', 128, 190);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.058, 32), new THREE.MeshBasicMaterial({ map: srgb(new THREE.CanvasTexture(tc)) }));
    dial.position.set(DRV, 0.425, 0.298); dial.rotation.y = Math.PI; cockpit.add(dial);
    needle = new THREE.Group(); needle.position.z = 0.002; dial.add(needle);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); nm.position.y = 0.022; needle.add(nm);
    shiftLamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
    shiftLamp.position.set(DRV, 0.472, 0.305); cockpit.add(shiftLamp);

    // steering column + wheel (tilted toward the driver)
    bar(V(DRV, 0.28, 0.44), V(DRV, 0.36, 0.13), 0.025, mDash);
    wheelTilt = new THREE.Group(); wheelTilt.position.set(DRV, 0.36, 0.13); wheelTilt.rotation.x = 0.45; cockpit.add(wheelTilt);
    wheelSpin = new THREE.Group(); wheelTilt.add(wheelSpin);
    wheelSpin.add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.021, 10, 36), mSuede));
    box(0.022, 0.03, 0.046, mYellow, 0, 0.175, 0, wheelSpin);                         // centre marker at 12 o'clock
    box(0.15, 0.034, 0.012, mDash, 0.09, -0.005, 0.02, wheelSpin);
    box(0.15, 0.034, 0.012, mDash, -0.09, -0.005, 0.02, wheelSpin);
    box(0.034, 0.15, 0.012, mDash, 0, -0.09, 0.02, wheelSpin);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 16), mDash); hub.rotation.x = Math.PI / 2; hub.position.z = 0.03; wheelSpin.add(hub);

    // gloved hands on the rim at 9 and 3 o'clock (they stay put past ±110° like a driver shuffling)
    handRing = new THREE.Group(); wheelTilt.add(handRing);
    for (const side of [1, -1]) {            // +1 = left hand (driver's left = +x)
      const hand = new THREE.Group(); hand.position.set(side * 0.175, 0, 0); handRing.add(hand);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mGlove); fist.scale.set(0.042, 0.06, 0.047); fist.position.set(side * 0.01, 0, -0.012); hand.add(fist);
      const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.03), mGlove); knuckles.position.set(side * 0.006, 0.002, 0.025); hand.add(knuckles);
      const thumb = new THREE.Mesh(unitCyl, mGlove); placeBar(thumb, V(side * 0.02, 0.025, -0.03), V(-side * 0.035, 0.035, 0.012), 0.013); hand.add(thumb);
      const anchor = new THREE.Object3D(); anchor.position.set(side * 0.02, -0.01, -0.045); hand.add(anchor);
      const upper = new THREE.Mesh(unitCyl, mSuit), fore = new THREE.Mesh(taperCyl, mSuit), cuff = new THREE.Mesh(unitCyl, mCuff);
      cockpit.add(upper, fore, cuff);
      arms.push({ side, anchor, upper, fore, cuff, shoulder: V(DRV + side * 0.21, 0.29, -0.52) });
    }
    cockpit.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }
  const _hw = new THREE.Vector3(), _el = new THREE.Vector3(), _wr = new THREE.Vector3(), _cf = new THREE.Vector3();
  function updateCockpit() {
    if (carBuilt && carBuilt.low !== (quality === 'low')) applyLivery();            // graphics quality changed: rebuild the car
    if (carTailMat) carTailMat.color.setScalar(car.brakeIn > 0.15 ? 1.9 : 1);          // brake lights
    const inside = camMode === 3;
    cockpit.visible = inside;
    for (const m of exteriorCabin) m.visible = !inside;
    if (!inside) return;
    const wheelAngle = car.steer * 7;                       // steering ratio for the visual wheel
    wheelSpin.rotation.z = wheelAngle;
    handRing.rotation.z = clamp(wheelAngle, -1.9, 1.9);
    needle.rotation.z = (135 - 270 * clamp(car.rpm / 8000, 0, 1)) * D2R;
    shiftLamp.material.color.setHex(car.rpm > CONFIG.engine.shiftUpRpm - 300 ? 0xff3322 : 0x3a1010);
    carGroup.updateMatrixWorld(true);
    for (const a of arms) {
      a.anchor.getWorldPosition(_hw); cockpit.worldToLocal(_hw);
      _el.copy(a.shoulder).lerp(_hw, 0.5); _el.x += a.side * 0.1; _el.y -= 0.12;
      _wr.copy(_hw);
      _cf.subVectors(_el, _hw).normalize().multiplyScalar(0.055).add(_hw);
      placeBar(a.upper, a.shoulder, _el, 0.052);
      placeBar(a.fore, _el, _cf, 0.045);
      placeBar(a.cuff, _cf, _wr, 0.036);
    }
  }

