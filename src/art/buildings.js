  /* ---------- buildings (art): detailed 3D houses and town detail ----------
     buildings(list, opt) makes real houses in code: recessed windows and doors (reveals, frames, sills, lintels, shutters),
     balconies, a plinth, gutters and a downpipe, chimneys, roofs with eaves (hip, gable either way, shed, flat) and houses made of
     two or three volumes (a front-gable bay with a porch or garage, or a lean-to). 'japanese' houses are timber-frame houses with a
     curved-eave tile roof, an engawa veranda with sliding paper doors, lattice windows and lanterns. At night the windows and
     paper screens glow (vertex-coloured, unlit mesh, so no extra lights and no extra textures).
     Everything of one call is merged: per style one wall mesh and one roof mesh, plus ONE trim mesh and ONE glass mesh for all styles
     (4 draw calls for one style, 6 for two). Variants (form, roof, colours) come from the house position, so a stage looks the same
     every time and nothing uses the stage's random numbers. 'low' quality builds a simpler house (no slats, rails, quoins, mullions).
     townDetail(list) adds ledges, window frames, awnings, balconies and rooftop clutter to the SS3 neon town (one trim mesh).
     Local frame of a house: x across the front, y up, z towards the front (the side facing the road). */
  const BD_UP = [0, 1, 0];
  const bdMix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const bdMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  function houseKit(it, S, tb, gb, X) {
    const c = Math.cos(it.yaw || 0), s = Math.sin(it.yaw || 0), wb = S.wb, rb = S.rb;
    const T = (x, y, z) => [it.x + x * c + z * s, it.y + y, it.z - x * s + z * c];
    const D = (v) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    const put = (b, p, uv, col) => { const w = T(p[0], p[1], p[2]); return b.v(w[0], w[1], w[2], uv[0], uv[1], col); };
    const Q = (b, pts, uvs, out, col) => {
      const cc = Array.isArray(col[0]) ? col : [col, col, col, col];
      const ix = pts.map((p, i) => put(b, p, uvs[i], cc[i]));
      b.quad(ix[0], ix[1], ix[2], ix[3], D(out));
    };
    // a wall frame: u runs along the wall (left to right as seen from outside), y up, w out from the wall
    const wf = (O, ax, n, L) => ({ O, ax, n, L, P: (u, y, w) => [O[0] + ax[0] * u + n[0] * w, y, O[1] + ax[1] * u + n[1] * w], d: (du, dy, dw) => [ax[0] * du + n[0] * dw, dy, ax[1] * du + n[1] * dw] });
    const faces = (x0, x1, z0, z1) => ({ front: wf([x0, z1], [1, 0], [0, 1], x1 - x0), right: wf([x1, z1], [0, -1], [1, 0], z1 - z0), back: wf([x1, z0], [-1, 0], [0, -1], x1 - x0), left: wf([x0, z0], [0, 1], [-1, 0], z1 - z0) });
    const ID = wf([0, 0], [1, 0], [0, 1], 1);                       // identity frame: u = x, w = z (axis-aligned boxes in house space)
    // a box in a wall frame; skip = letters of faces not made: f front, b back, l left, r right, t top, u underside
    const fbox = (b, F, u0, u1, y0, y1, w0, w1, col, skip = '') => {
      const P = F.P, has = (k) => skip.indexOf(k) < 0;
      if (has('f')) Q(b, [P(u0, y0, w1), P(u1, y0, w1), P(u1, y1, w1), P(u0, y1, w1)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], F.d(0, 0, 1), col);
      if (has('b')) Q(b, [P(u1, y0, w0), P(u0, y0, w0), P(u0, y1, w0), P(u1, y1, w0)], [[u1, y0], [u0, y0], [u0, y1], [u1, y1]], F.d(0, 0, -1), col);
      if (has('l')) Q(b, [P(u0, y0, w0), P(u0, y0, w1), P(u0, y1, w1), P(u0, y1, w0)], [[w0, y0], [w1, y0], [w1, y1], [w0, y1]], F.d(-1, 0, 0), col);
      if (has('r')) Q(b, [P(u1, y0, w1), P(u1, y0, w0), P(u1, y1, w0), P(u1, y1, w1)], [[w1, y0], [w0, y0], [w0, y1], [w1, y1]], F.d(1, 0, 0), col);
      if (has('t')) Q(b, [P(u0, y1, w1), P(u1, y1, w1), P(u1, y1, w0), P(u0, y1, w0)], [[u0, w1], [u1, w1], [u1, w0], [u0, w0]], BD_UP, col);
      if (has('u')) Q(b, [P(u0, y0, w0), P(u1, y0, w0), P(u1, y0, w1), P(u0, y0, w1)], [[u0, w0], [u1, w0], [u1, w1], [u0, w1]], [0, -1, 0], col);
    };
    // a sheet of wall (plaster / stone texture) with rectangular openings cut out and the reveals (the thickness of the wall) built in
    const wallHoles = (F, yb, yt, holes, col, o = {}) => {
      const tile = 4, uo = o.uo || 0, rd = o.rd != null ? o.rd : 0.25, wain = o.wain || 0, wcol = o.wcol || col, rcol = bdMul(col, 0.74);
      const ys = [yb, yt]; for (const h of holes) ys.push(h.y0, h.y1); if (wain) ys.push(wain);
      const yy = [...new Set(ys.filter(y => y >= yb - 1e-6 && y <= yt + 1e-6))].sort((a, b) => a - b);
      const seg = (u0, u1, y0, y1, cl) => {
        if (u1 - u0 < 1e-3 || y1 - y0 < 1e-3) return;
        Q(wb, [F.P(u0, y0, 0), F.P(u1, y0, 0), F.P(u1, y1, 0), F.P(u0, y1, 0)], [[u0 / tile + uo, y0 / tile], [u1 / tile + uo, y0 / tile], [u1 / tile + uo, y1 / tile], [u0 / tile + uo, y1 / tile]], F.d(0, 0, 1), cl);
      };
      for (let i = 0; i < yy.length - 1; i++) {
        const ya = yy[i], yz = yy[i + 1], cl = ya < wain - 1e-6 ? wcol : col, hs = holes.filter(h => h.y0 <= ya + 1e-6 && h.y1 >= yz - 1e-6).sort((a, b) => a.u0 - b.u0);
        let cur = 0; for (const h of hs) { seg(cur, h.u0, ya, yz, cl); cur = h.u1; } seg(cur, F.L, ya, yz, cl);
      }
      for (const h of holes) {
        const { u0, u1, y0, y1 } = h, P = F.P;
        Q(wb, [P(u0, y0, 0), P(u0, y0, -rd), P(u0, y1, -rd), P(u0, y1, 0)], [[0, y0 / tile], [rd / tile, y0 / tile], [rd / tile, y1 / tile], [0, y1 / tile]], F.d(1, 0, 0), rcol);
        Q(wb, [P(u1, y0, -rd), P(u1, y0, 0), P(u1, y1, 0), P(u1, y1, -rd)], [[0, y0 / tile], [rd / tile, y0 / tile], [rd / tile, y1 / tile], [0, y1 / tile]], F.d(-1, 0, 0), rcol);
        Q(wb, [P(u0, y1, 0), P(u1, y1, 0), P(u1, y1, -rd), P(u0, y1, -rd)], [[u0 / tile, 0], [u1 / tile, 0], [u1 / tile, rd / tile], [u0 / tile, rd / tile]], [0, -1, 0], rcol);
        if (y0 > yb + 0.05) Q(wb, [P(u0, y0, -rd), P(u1, y0, -rd), P(u1, y0, 0), P(u0, y0, 0)], [[u0 / tile, 0], [u1 / tile, 0], [u1 / tile, rd / tile], [u0 / tile, rd / tile]], BD_UP, rcol);
      }
    };
    // a lit or dark pane in the glass mesh. kind: 'win' glass, 'paper' (shoji / lattice window), 'lamp'
    const pane = (F, u0, u1, y0, y1, w, kind, lit) => {
      const night = X.night; if (lit == null) lit = X.rng() < (kind === 'paper' ? 0.6 : 0.5);
      let top, bot;
      if (kind === 'lamp') { top = night ? [1, 0.8, 0.42] : [0.86, 0.74, 0.5]; bot = night ? [1, 0.62, 0.28] : [0.7, 0.55, 0.36]; }
      else if (night && lit) { top = kind === 'paper' ? [1, 0.84, 0.52] : [1, 0.86, 0.55]; bot = kind === 'paper' ? [0.98, 0.66, 0.34] : [0.95, 0.66, 0.3]; }
      else if (night) { top = kind === 'paper' ? [0.2, 0.22, 0.32] : [0.08, 0.1, 0.18]; bot = kind === 'paper' ? [0.1, 0.11, 0.18] : [0.03, 0.04, 0.08]; }
      else if (kind === 'paper') { top = [0.9, 0.87, 0.78]; bot = [0.76, 0.73, 0.64]; }
      else { top = [0.66, 0.78, 0.9]; bot = [0.14, 0.2, 0.3]; }
      Q(gb, [F.P(u0, y0, w), F.P(u1, y0, w), F.P(u1, y1, w), F.P(u0, y1, w)], [[0, 0], [1, 0], [1, 1], [0, 1]], F.d(0, 0, 1), [bot, bot, top, top]);
      return night && lit;
    };
    // a cylinder / tapered prism standing on y0 (local x,z centre), n sides
    const cyl = (b, cx, cz, y0, y1, r0, r1, n, col, skip = '') => {
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, am = (a0 + a1) / 2;
        Q(b, [[cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1]],
          [[i / n, 0], [(i + 1) / n, 0], [(i + 1) / n, 1], [i / n, 1]], [Math.cos(am), 0.15, Math.sin(am)], col);
      }
      if (skip.indexOf('t') < 0 && r1 > 0) { const pts = []; for (let i = 0; i < 4; i++) pts.push([cx + Math.cos(i / 4 * 6.2832 + 0.785) * r1 * 1.414, y1, cz + Math.sin(i / 4 * 6.2832 + 0.785) * r1 * 1.414]); Q(b, pts, [[0, 0], [1, 0], [1, 1], [0, 1]], BD_UP, col); }
    };
    // one roof slope: a sheet from the eave edge (frame F, w = 0) up to the ridge `run` m further in. Top = tiles (roof mesh), underside + edges = trim mesh.
    // u0..u1 eave length; ins0/ins1 how far the ridge ends are pulled in (hips); o: { nu, nv, th, disp(x,z), rakes:[bool,bool], fascia, under, gutter, skirtY }
    const slab = (F, u0, u1, yE, yR, run, ins0, ins1, o = {}) => {
      const nu = o.nu || 1, nv = o.nv || 1, th = o.th || 0.12, slopeLen = Math.hypot(run, yR - yE), tint = o.tint || [1, 1, 1];
      const top = [], bot = [];
      for (let j = 0; j <= nv; j++) {
        const tj = j / nv, row = [], rowB = [];
        for (let i = 0; i <= nu; i++) {
          const ue = u0 + (u1 - u0) * i / nu, ur = (u0 + ins0) + ((u1 - ins1) - (u0 + ins0)) * i / nu, u = ue + (ur - ue) * tj;
          const p = F.P(u, 0, -run * tj); let y = yE + (yR - yE) * tj; if (o.disp) y += o.disp(p[0], p[2]);
          row.push([p[0], y, p[2], u, tj * slopeLen]); rowB.push([p[0], y - th, p[2]]);
        }
        top.push(row); bot.push(rowB);
      }
      const under = o.under || [0.62, 0.54, 0.46], fas = o.fascia || [0.95, 0.93, 0.86];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const A = top[j][i], B = top[j][i + 1], C = top[j + 1][i + 1], Dd = top[j + 1][i];
        const vc = tint.map((v, k) => v * (0.94 + 0.06 * Math.sin(i * 2.1 + j * 3.3 + k)));
        Q(rb, [A, B, C, Dd], [[A[3] / 4, A[4] / 4], [B[3] / 4, B[4] / 4], [C[3] / 4, C[4] / 4], [Dd[3] / 4, Dd[4] / 4]], BD_UP, vc);
        const a = bot[j][i], b = bot[j][i + 1], cc = bot[j + 1][i + 1], dd = bot[j + 1][i];
        Q(tb, [a, b, cc, dd], [[a[0], a[2]], [b[0], b[2]], [cc[0], cc[2]], [dd[0], dd[2]]], [0, -1, 0], under);
      }
      for (let i = 0; i < nu; i++) {                                    // the eave edge
        const A = top[0][i], B = top[0][i + 1], a = bot[0][i], b = bot[0][i + 1];
        Q(tb, [a, b, B, A], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], F.d(0, 0, 1), fas);
        if (o.skirtY != null) Q(tb, [[a[0], o.skirtY, a[2]], [b[0], o.skirtY, b[2]], b, a], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], F.d(0, 0, 1), o.skirtCol || fas);
      }
      const rk = o.rakes || [false, false];
      for (let side = 0; side < 2; side++) if (rk[side]) {
        const i = side ? nu : 0;
        for (let j = 0; j < nv; j++) { const A = top[j][i], B = top[j + 1][i], a = bot[j][i], b = bot[j + 1][i]; Q(tb, [a, b, B, A], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], F.d(side ? 1 : -1, 0, 0), fas); }
      }
      if (o.gutter && !X.low) fbox(tb, F, u0 - 0.05, u1 + 0.05, yE - th - 0.1, yE - th + 0.1, 0.0, 0.14, [0.5, 0.52, 0.55], 'b');
    };
    // all four slopes of a roof over the eave rectangle R = [X0, X1, Z0, Z1]. kind: 'hip', 'gx' (ridge along x), 'gz' (ridge along z)
    const roofRect = (R, kind, yE, pitch, o = {}) => {
      const [X0, X1, Z0, Z1] = R, W = X1 - X0, Dp = Z1 - Z0, Fs = faces(X0, X1, Z0, Z1);
      const run = (kind === 'gx' ? Dp : kind === 'gz' ? W : Math.min(W, Dp)) / 2, yR = yE + run * pitch;
      const zc = (Z0 + Z1) / 2, xc = (X0 + X1) / 2;
      let ridge;
      if (kind === 'gx') { slab(Fs.front, 0, W, yE, yR, run, 0, 0, Object.assign({}, o, { rakes: [true, true] })); slab(Fs.back, 0, W, yE, yR, run, 0, 0, Object.assign({}, o, { rakes: [true, true] })); ridge = [X0, X1, zc, zc]; }
      else if (kind === 'gz') { slab(Fs.right, 0, Dp, yE, yR, run, 0, 0, Object.assign({}, o, { rakes: [true, true] })); slab(Fs.left, 0, Dp, yE, yR, run, 0, 0, Object.assign({}, o, { rakes: [true, true] })); ridge = [xc, xc, Z0, Z1]; }
      else {
        const iw = Math.min(run, W / 2), id = Math.min(run, Dp / 2);
        slab(Fs.front, 0, W, yE, yR, run, iw, iw, o); slab(Fs.back, 0, W, yE, yR, run, iw, iw, o); slab(Fs.right, 0, Dp, yE, yR, run, id, id, o); slab(Fs.left, 0, Dp, yE, yR, run, id, id, o);
        ridge = W >= Dp ? [X0 + run, X1 - run, zc, zc] : [xc, xc, Z0 + run, Z1 - run];
      }
      return { yR, ridge, run };
    };
    const ridgeCap = (r, yR, col, wd = 0.16, hh = 0.2) => {
      const [x0, x1, z0, z1] = r.ridge; if (x1 - x0 < 0.01 && z1 - z0 < 0.01) return;
      const ax = x1 - x0 >= z1 - z0;
      fbox(tb, ID, x0 - (ax ? 0 : wd), x1 + (ax ? 0 : wd), yR - 0.04, yR + hh, z0 - (ax ? wd : 0), z1 + (ax ? wd : 0), col);
    };
    return { it, T, D, put, Q, wf, faces, ID, fbox, wallHoles, pane, cyl, slab, roofRect, ridgeCap, wb, rb, tb, gb, low: X.low, night: X.night, rng: X.rng, glows: X.glows, style: X.style, hw: it.w / 2, hd: it.d / 2, h: it.h || 8 };
  }

  /* ---- European plaster / stone house ---- */
  function europeanHouse(K) {
    const { it, rng, hw, hd, h, low, wb, rb, tb, gb, fbox, wallHoles, pane, slab, roofRect, ridgeCap, faces, ID, wf } = K;
    const stone = K.style === 'stone', tint = it.tint || [1, 1, 1], trim = stone ? [0.86, 0.8, 0.68] : [0.95, 0.92, 0.84], plinthCol = stone ? [0.62, 0.58, 0.52] : [0.6, 0.57, 0.52];
    const SHUT = [[0.2, 0.4, 0.3], [0.55, 0.2, 0.16], [0.2, 0.3, 0.5], [0.42, 0.3, 0.2]], DOOR = [[0.3, 0.17, 0.1], [0.2, 0.36, 0.28], [0.5, 0.16, 0.14], [0.2, 0.26, 0.4]];
    const shut = rng() < 0.7 ? SHUT[Math.floor(rng() * 4)] : null, doorCol = DOOR[Math.floor(rng() * 4)];
    const pitch = 0.46 + rng() * 0.2, ov = 0.45, flat = it.roof === 'flat';
    const pr = rng(), kindMain = it.roof === 'gable' ? 'gx' : flat ? 'flat' : pr < 0.38 ? 'hip' : pr < 0.72 ? 'gx' : 'gz', formR = rng();
    const roofTint = [0.9 + rng() * 0.12, 0.9 + rng() * 0.12, 0.9 + rng() * 0.12];
    const uo = rng(), dn = rng(), balc = rng() < 0.55, chim = rng() < 0.6, chimSide = rng() < 0.5 ? 0.3 : 0.7;
    const vols = [];
    let form = flat || hw * 2 < 7.6 || hd * 2 < 6.2 ? 0 : formR < 0.5 ? 0 : formR < 0.78 ? 1 : 2;
    if (form === 1) {                                              // front-gable bay on one side, porch or garage beside it
      const mainD = hd * 1.1, side = rng() < 0.5 ? -1 : 1;
      const bw = clamp(hw * 2 * 0.42, 3.4, mainD * 0.95), bx0 = side < 0 ? -hw : hw - bw, bx1 = bx0 + bw;
      const mz1 = -hd + mainD, ridgeZ = -hd + mainD / 2;
      vols.push({ x0: -hw, x1: hw, z0: -hd, z1: mz1, h, kind: kindMain === 'gz' ? 'gx' : kindMain === 'hip' ? 'hip' : 'gx' });
      vols.push({ x0: bx0, x1: bx1, z0: mz1, z1: hd, h, kind: 'gz', rz0: ridgeZ });
      const px0 = side < 0 ? bx1 : -hw, px1 = side < 0 ? hw : bx0;
      vols.push({ x0: px0, x1: px1, z0: mz1, z1: hd, h: 3.0, kind: 'shed', face: 'front', garage: rng() < 0.4 });
    } else if (form === 2) {                                       // lean-to against one side
      const side = rng() < 0.5 ? -1 : 1, lw = clamp(hw * 2 * 0.28, 2.6, 4.2);
      const mx0 = side < 0 ? -hw + lw : -hw, mx1 = side < 0 ? hw : hw - lw;
      vols.push({ x0: mx0, x1: mx1, z0: -hd, z1: hd, h, kind: kindMain === 'flat' ? 'hip' : kindMain });
      vols.push({ x0: side < 0 ? -hw : mx1, x1: side < 0 ? mx0 : hw, z0: -hd, z1: hd, h: 3.2, kind: 'shed', face: side < 0 ? 'left' : 'right' });
    } else vols.push({ x0: -hw, x1: hw, z0: -hd, z1: hd, h, kind: kindMain });
    const inVol = (v, x, z, y) => x > v.x0 + 0.05 && x < v.x1 - 0.05 && z > v.z0 + 0.05 && z < v.z1 - 0.05 && y < v.h + 0.5;
    const blockedBy = (self, x, z, y) => vols.some(v => v !== self && inVol(v, x, z, y));
    const mainVol = vols[0];
    vols.forEach((V, vi) => {
      const Fs = faces(V.x0, V.x1, V.z0, V.z1), storeys = V.h > 5 ? 2 : 1, fh = V.h / storeys, isMain = vi === 0 || V.kind === 'gz';
      const hasBalc = balc && isMain && storeys > 1;
      for (const fname of ['front', 'right', 'back', 'left']) {
        const F = Fs[fname], L = F.L;
        const tp = (u) => { const q = F.P(u, V.h - 0.6, 0.15); return blockedBy(V, q[0], q[2], V.h - 0.6); }, hidden = tp(0.4) && tp(L / 2) && tp(L - 0.4);      // a wall is skipped only if another volume covers it up to the eave
        if (hidden) continue;
        const free = (u, y) => { const p = F.P(u, y, 0.35); return !blockedBy(V, p[0], p[2], y) && !blockedBy(V, F.P(u - 0.8, y, 0.35)[0], F.P(u - 0.8, y, 0.35)[2], y) && !blockedBy(V, F.P(u + 0.8, y, 0.35)[0], F.P(u + 0.8, y, 0.35)[2], y); };
        const holes = [], items = [];
        const slotW = 3.1, n = Math.max(1, Math.round((L - 1.0) / slotW)), gap = L / n, isFront = fname === 'front', di = n > 1 ? (dn < 0.5 ? 0 : n - 1) : 0;
        for (let i = 0; i < n; i++) {
          const uc = gap * (i + 0.5);
          for (let k = 0; k < storeys; k++) {
            const base = k * fh + (k ? 0 : 0.18);
            if (V.garage && isFront && k === 0) { if (i === 0) { const gw = Math.min(L - 1.0, 3.4), u0 = L / 2 - gw / 2; if (free(L / 2, 1)) items.push({ kind: 'garage', u0, u1: u0 + gw, y0: 0.1, y1: 2.35 }); } continue; }
            if (V.kind === 'shed' && k > 0) continue;
            if (isFront && isMain && k === 0 && i === di && V.kind !== 'shed') { if (free(uc, 1)) items.push({ kind: 'door', u0: uc - 0.55, u1: uc + 0.55, y0: 0.18, y1: 2.3 }); continue; }
            if (isFront && hasBalc && k === 1 && i === di) { if (free(uc, k * fh + 1)) items.push({ kind: 'fdoor', u0: uc - 0.5, u1: uc + 0.5, y0: fh + 0.15, y1: fh + 2.25 }); continue; }
            if (!isFront && rng() < 0.28) continue;
            const wh = Math.min(1.55, fh * 0.44), y0 = base + (k ? 0.85 : 0.9);
            if (V.kind === 'shed' && y0 + wh > V.h - 0.25) continue;
            if (free(uc, y0 + wh / 2)) items.push({ kind: 'win', u0: uc - 0.52, u1: uc + 0.52, y0, y1: y0 + wh });
          }
        }
        for (const it0 of items) holes.push({ u0: it0.u0, u1: it0.u1, y0: it0.y0, y1: it0.y1 });
        const col = [tint[0], tint[1], tint[2]], wo = uo + fname.length * 0.31 + vi * 0.2;
        wallHoles(F, -1, V.h, holes, col, { rd: 0.26, uo: wo });
        // gable end or shed end above the wall top
        const gableEnd = (V.kind === 'gx' && (fname === 'right' || fname === 'left')) || (V.kind === 'gz' && (fname === 'front' || fname === 'back'));
        const span = (V.kind === 'gx' ? V.z1 - V.z0 : V.x1 - V.x0);
        if (gableEnd) {
          const rise = (span / 2) * pitch;
          const cp = [[0, V.h], [L, V.h], [L / 2, V.h + rise], [L / 2, V.h + rise]];
          K.Q(wb, [F.P(cp[0][0], cp[0][1], 0), F.P(cp[1][0], cp[1][1], 0), F.P(cp[2][0], cp[2][1], 0), F.P(cp[3][0], cp[3][1], 0)], cp.map(q => [q[0] / 4 + wo, q[1] / 4]), F.d(0, 0, 1), col);
          if (!low && fname !== 'back' && L > 4) { const uc = L / 2, y0 = V.h + rise * 0.25; pane(F, uc - 0.3, uc + 0.3, y0, y0 + 0.6, 0.02, 'win'); fbox(tb, F, uc - 0.38, uc + 0.38, y0 - 0.08, y0 + 0.68, -0.02, 0.06, trim, 'b'); }
        } else if (V.kind === 'shed') {
          // the two ends of a shed roof are trapezoids: the roof is higher against the main wall
          const alongZ = V.face === 'front', endFace = alongZ ? (fname === 'left' || fname === 'right') : (fname === 'front' || fname === 'back');
          if (endFace) {
            const yS = (x, z) => V.face === 'front' ? V.h + 0.3 - ov * 0.25 + (V.z1 + ov - z) * 0.25 : V.face === 'right' ? V.h + 0.3 - ov * 0.25 + (V.x1 + ov - x) * 0.25 : V.h + 0.3 - ov * 0.25 + (x - (V.x0 - ov)) * 0.25;
            const p0 = F.P(0, 0, 0), p1 = F.P(L, 0, 0), y0s = yS(p0[0], p0[2]) - 0.14, y1s = yS(p1[0], p1[2]) - 0.14;
            K.Q(wb, [F.P(0, V.h, 0), F.P(L, V.h, 0), F.P(L, y1s, 0), F.P(0, y0s, 0)], [[0, V.h / 4], [L / 4, V.h / 4], [L / 4, y1s / 4], [0, y0s / 4]].map(q => [q[0] + wo, q[1]]), F.d(0, 0, 1), col);
          }
        }
        // plinth, cornice and belt course
        fbox(tb, F, -0.06, L + 0.06, -1, 0.55, 0, 0.07, plinthCol, low ? 'blrtbu' : 'blu');
        if (!low && V.h > 5) { fbox(tb, F, -0.1, L + 0.1, V.h - 0.3, V.h - 0.02, 0, 0.22, trim, 'b'); if (storeys > 1) fbox(tb, F, -0.03, L + 0.03, fh - 0.08, fh + 0.1, 0, 0.06, trim, 'blr'); }
        if (stone && !low && V.h > 5 && isFront) for (let q = 0, y = 0.6; y < V.h - 0.5; q++, y += 0.55) for (const left of [true, false]) { const ln = q % 2 ? 0.32 : 0.6; if (left) fbox(tb, F, 0, ln, y, y + 0.46, 0, 0.035, trim, 'blrtu'); else fbox(tb, F, L - ln, L, y, y + 0.46, 0, 0.035, trim, 'blrtu'); }
        // contents of the openings
        for (const o of items) {
          const { u0, u1, y0, y1 } = o, w = u1 - u0, uc = (u0 + u1) / 2, rd = 0.26;
          if (o.kind === 'win' || o.kind === 'fdoor') {
            pane(F, u0, u1, y0, y1, -rd + 0.03, 'win');
            const ft = 0.07;
            if (!low) {
              fbox(tb, F, u0, u1, y0, y0 + ft, -rd, -rd + 0.1, trim, 'bu'); fbox(tb, F, u0, u1, y1 - ft, y1, -rd, -rd + 0.1, trim, 'bt'); fbox(tb, F, u0, u0 + ft, y0, y1, -rd, -rd + 0.1, trim, 'br'); fbox(tb, F, u1 - ft, u1, y0, y1, -rd, -rd + 0.1, trim, 'bl');
            }
            if (!low) { fbox(tb, F, uc - 0.025, uc + 0.025, y0, y1, -rd + 0.02, -rd + 0.08, trim, 'blr'); fbox(tb, F, u0, u1, y0 + (y1 - y0) * 0.62, y0 + (y1 - y0) * 0.62 + 0.05, -rd + 0.02, -rd + 0.08, trim, 'blrtu'); }
            // architrave around the opening, sill and lintel
            if (o.kind === 'win') {
              fbox(tb, F, u0 - 0.1, u1 + 0.1, y0 - 0.12, y0 - 0.02, 0, 0.17, trim, low ? 'blrbu' : 'b');
              fbox(tb, F, u0 - 0.08, u1 + 0.08, y1 + 0.0, y1 + 0.16, 0, stone ? 0.1 : 0.06, trim, low ? 'blrbu' : 'bu');
              if (!low) { fbox(tb, F, u0 - 0.08, u0, y0, y1, 0, 0.05, trim, 'bu'); fbox(tb, F, u1, u1 + 0.08, y0, y1, 0, 0.05, trim, 'bu'); }
              if (stone && !low) fbox(tb, F, uc - 0.12, uc + 0.12, y1 + 0.16, y1 + 0.3, 0, 0.1, trim, 'bu');
              if (shut) for (const sd of [-1, 1]) {
                const sw = w * 0.48, a0 = sd < 0 ? u0 - 0.06 - sw : u1 + 0.06, a1 = a0 + sw;
                fbox(tb, F, a0, a1, y0, y1, 0, 0.05, shut, low ? 'blrbtu' : 'bu');
                if (!low) for (const yy of [y0 + 0.08, (y0 + y1) / 2 - 0.03, y1 - 0.14]) fbox(tb, F, a0 + 0.04, a1 - 0.04, yy, yy + 0.06, 0.05, 0.075, bdMul(shut, 0.7), 'blrbu');
              }
            } else {                                                  // balcony in front of the french window
              const bw = 0.55; fbox(tb, F, u0 - bw, u1 + bw, y0 - 0.2, y0 - 0.04, 0, 1.0, [0.62, 0.6, 0.57]);
              const iron = [0.27, 0.28, 0.31];
              const ua = u0 - bw, ub = u1 + bw;                                                                              // open railing: top rail, bottom rail, corner posts, balusters (never a solid plate)
              fbox(tb, F, ua, ub, y0 + 0.88, y0 + 0.94, 0.9, 0.96, iron, 'u'); fbox(tb, F, ua, ub, y0 - 0.02, y0 + 0.04, 0.9, 0.96, iron, 'u');
              for (const [a, b] of [[ua, ua + 0.05], [ub - 0.05, ub]]) {
                fbox(tb, F, a, b, y0 + 0.88, y0 + 0.94, 0.0, 0.96, iron, 'u'); fbox(tb, F, a, b, y0 - 0.02, y0 + 0.04, 0.0, 0.96, iron, 'u');
                fbox(tb, F, a, b, y0, y0 + 0.9, 0.9, 0.96, iron, 'u'); fbox(tb, F, a, b, y0, y0 + 0.9, 0.0, 0.05, iron, 'u');
                if (!low) for (let ww = 0.2; ww < 0.9; ww += 0.22) fbox(tb, F, a, b, y0, y0 + 0.9, ww, ww + 0.035, iron, 'u');
              }
              if (!low) for (let uu = ua + 0.2; uu < ub - 0.1; uu += 0.22) fbox(tb, F, uu, uu + 0.035, y0 - 0.04, y0 + 0.9, 0.92, 0.95, iron, 'blrbu');
              fbox(tb, F, u0 - 0.1, u1 + 0.1, y1, y1 + 0.14, 0, 0.06, trim, 'bu');
            }
          } else if (o.kind === 'door') {
            fbox(tb, F, u0 + 0.03, u1 - 0.03, y0, y1, -rd, -rd + 0.08, doorCol, 'blr');
            if (!low) { fbox(tb, F, u0 + 0.14, u1 - 0.14, y0 + 0.12, y0 + 0.95, -rd + 0.08, -rd + 0.11, bdMul(doorCol, 1.25), 'blrbtu'); fbox(tb, F, u0 + 0.14, u1 - 0.14, y0 + 1.1, y1 - 0.15, -rd + 0.08, -rd + 0.11, bdMul(doorCol, 1.25), 'blrbtu'); fbox(tb, F, u1 - 0.22, u1 - 0.16, y0 + 1.0, y0 + 1.1, -rd + 0.1, -rd + 0.16, [0.8, 0.66, 0.3], 'blr'); }
            if (!low) { fbox(tb, F, u0 - 0.1, u0 + 0.0, y0, y1 + 0.12, 0, 0.06, trim, 'bu'); fbox(tb, F, u1, u1 + 0.1, y0, y1 + 0.12, 0, 0.06, trim, 'bu'); } fbox(tb, F, u0 - 0.1, u1 + 0.1, y1, y1 + 0.14, 0, 0.1, trim, low ? 'blrbu' : 'bu');
            fbox(tb, F, u0 - 0.3, u1 + 0.3, -1, 0.18, 0, 0.7, plinthCol, low ? 'blrbu' : 'bu');                                             // step
            if (!low && V.h > 5) { fbox(tb, F, u0 - 0.35, u1 + 0.35, y1 + 0.34, y1 + 0.44, 0, 0.8, trim, 'b'); }          // little canopy over the door
            if (K.night || !low) { const lit = pane(F, u1 + 0.26, u1 + 0.4, y1 - 0.5, y1 - 0.2, 0.02, 'lamp', true); if (lit) { const g = F.P(u1 + 0.33, y1 - 0.35, 0.15), wp = K.T(g[0], 0, g[2]); K.glows.push({ x: wp[0], y: it.y + y1 - 0.35, z: wp[2], c: 0xffc070, size: 1.1 }); } }
          } else if (o.kind === 'garage') {
            fbox(tb, F, u0 + 0.02, u1 - 0.02, o.y0, o.y1, -rd, -rd + 0.06, [0.7, 0.7, 0.68], 'blrbu');
            if (!low) for (let yy = o.y0 + 0.4; yy < o.y1 - 0.1; yy += 0.4) fbox(tb, F, u0 + 0.02, u1 - 0.02, yy, yy + 0.04, -rd + 0.06, -rd + 0.08, [0.45, 0.45, 0.44], 'blrbtu');
            if (!low) { fbox(tb, F, u0 - 0.12, u0, o.y0, o.y1 + 0.14, 0, 0.1, trim, 'bu'); fbox(tb, F, u1, u1 + 0.12, o.y0, o.y1 + 0.14, 0, 0.1, trim, 'bu'); } fbox(tb, F, u0 - 0.12, u1 + 0.12, o.y1, o.y1 + 0.16, 0, 0.12, trim, low ? 'blrbu' : 'bu');
          }
        }
      }
    });
    // roofs
    const rc = [0.62, 0.3, 0.22];
    const roofFor = (V) => {
      if (V.kind === 'flat') return;
      const x0 = V.x0 - ov, x1 = V.x1 + ov, z0 = (V.rz0 != null ? V.rz0 : V.z0 - ov), z1 = V.z1 + ov;
      if (V.kind === 'shed') {
        const key = V.face, F = key === 'front' ? faces(V.x0 - 0.3, V.x1 + 0.3, V.z0, V.z1 + ov).front : key === 'left' ? faces(V.x0 - ov, V.x1, V.z0 - 0.3, V.z1 + 0.3).left : faces(V.x0, V.x1 + ov, V.z0 - 0.3, V.z1 + 0.3).right;
        const run = key === 'front' ? V.z1 + ov - V.z0 : V.x1 - V.x0 + ov, yE = V.h + 0.3 - ov * 0.25, yR = yE + run * 0.25;
        slab(F, 0, F.L, yE, yR, run, 0, 0, { tint: roofTint, th: 0.1, rakes: [true, true], gutter: true });
        return;
      }
      const R = [x0, x1, z0, z1], yE = V.h - ov * pitch;
      const r = roofRect(R, V.kind, yE, pitch, { tint: roofTint, th: 0.12, gutter: true });
      ridgeCap(r, r.yR, rc);
      return r;
    };
    let mainRoof = null;
    for (const V of vols) { const r = roofFor(V); if (V === mainVol) mainRoof = r; }
    if (flat) {                                                   // low parapet roof
      const V = mainVol, Fs = faces(V.x0, V.x1, V.z0, V.z1), pc = [0.78, 0.75, 0.7];
      K.Q(rb, [[V.x0 - 0.2, h + 0.02, V.z1 + 0.2], [V.x1 + 0.2, h + 0.02, V.z1 + 0.2], [V.x1 + 0.2, h + 0.02, V.z0 - 0.2], [V.x0 - 0.2, h + 0.02, V.z0 - 0.2]], [[0, 0], [4, 0], [4, 4], [0, 4]], BD_UP, [0.5, 0.5, 0.52]);
      for (const k of ['front', 'right', 'back', 'left']) { const F = Fs[k]; fbox(tb, F, -0.2, F.L + 0.2, h, h + 0.7, -0.1, 0.25, pc, 'bu'); }
      const hx = rng() * (hw - 2) - hw / 2; fbox(tb, ID, hx - 1.0, hx + 1.0, h, h + 2.3, -1.0, 1.0, [0.7, 0.68, 0.64]); fbox(tb, ID, hx + 2, hx + 3.2, h, h + 0.7, -0.5, 0.5, [0.6, 0.62, 0.66]);
    }
    // chimney on the main roof, downpipe at a front corner
    if (chim && mainRoof) {
      const r = mainRoof, along = r.ridge[1] - r.ridge[0] > r.ridge[3] - r.ridge[2], len = along ? r.ridge[1] - r.ridge[0] : r.ridge[3] - r.ridge[2];
      let cx, cz;
      if (len > 1.5) { const t = chimSide; cx = r.ridge[0] + (r.ridge[1] - r.ridge[0]) * t; cz = r.ridge[2] + (r.ridge[3] - r.ridge[2]) * t; } else { cx = r.ridge[0]; cz = r.ridge[2]; }
      const brick = stone ? [0.62, 0.5, 0.42] : [0.66, 0.34, 0.26], y0 = mainVol.h - 0.2, y1 = r.yR + 1.0;
      fbox(tb, ID, cx - 0.36, cx + 0.36, y0, y1, cz - 0.36, cz + 0.36, brick, 'u');
      fbox(tb, ID, cx - 0.46, cx + 0.46, y1, y1 + 0.14, cz - 0.46, cz + 0.46, [0.5, 0.48, 0.46]);
      if (!low) { K.cyl(tb, cx - 0.14, cz, y1 + 0.14, y1 + 0.46, 0.1, 0.1, 6, [0.5, 0.26, 0.2]); K.cyl(tb, cx + 0.16, cz, y1 + 0.14, y1 + 0.38, 0.1, 0.1, 6, [0.5, 0.26, 0.2]); }
    }
    if (!low) { const F = faces(mainVol.x0, mainVol.x1, mainVol.z0, mainVol.z1).front; fbox(tb, F, -0.12, 0.0, 0.2, mainVol.h - 0.1, 0.0, 0.1, [0.5, 0.52, 0.55], 'bu'); }
  }

  /* ---- Japanese timber-frame house ---- */
  function japaneseHouse(K) {
    const { it, rng, hw, hd, low, wb, rb, tb, gb, fbox, wallHoles, pane, slab, roofRect, ridgeCap, faces, ID, wf } = K;
    const two = it.h >= 7.6 || (it.h >= 7.0 && rng() < 0.4), tint = it.tint || [1, 1, 1];
    const PL = [[1, 0.97, 0.9], [0.92, 0.89, 0.82], [0.96, 0.93, 0.85], [0.8, 0.74, 0.65]], pl0 = PL[Math.floor(rng() * PL.length)];
    const nb = K.night ? 1.7 : 1;                                       // at night the plaster is painted lighter and the roof edges catch the moon, so the shape still reads against the dark wood
    const plaster = [pl0[0] * (0.9 + tint[0] * 0.1) * nb, pl0[1] * (0.9 + tint[1] * 0.1) * nb, pl0[2] * (0.9 + tint[2] * 0.1) * nb * 1.05];
    const wood = K.night ? [0.1, 0.07, 0.06] : [0.2, 0.14, 0.11], woodL = [0.46, 0.33, 0.22], burnt = [0.2, 0.19, 0.2], stoneC = [0.5, 0.49, 0.47], kum = [0.34, 0.24, 0.17];
    const wallH = two ? 6.0 : 3.5, dv = two ? 0 : Math.min(1.6, hd * 0.3), ov = 0.85, gable = rng() < 0.4, uo = rng();
    const body = { x0: -hw, x1: hw, z0: -hd, z1: hd - dv };
    const Fs = faces(body.x0, body.x1, body.z0, body.z1), pitch = 0.5, sag = 0.26, lift = 0.5;
    // ---- walls
    const doorCenter = Fs.front.L * (0.3 + rng() * 0.4);
    const front = Fs.front, L = front.L;
    const holesFront = [], shoji = [];
    if (!two) {
      const a = Math.max(0.5, L * 0.12 + rng() * 0.5), b = Math.min(L - 0.5, a + Math.max(2.8, L * 0.62));
      holesFront.push({ u0: a, u1: b, y0: 0.5, y1: 2.45 }); shoji.push({ a, b, y0: 0.5, y1: 2.45 });
    } else {
      const a = doorCenter - 0.95; holesFront.push({ u0: a, u1: a + 1.9, y0: 0.18, y1: 2.3 }); shoji.push({ a, b: a + 1.9, y0: 0.18, y1: 2.3, door: true });
      for (const uc of [L * 0.2, L * 0.8]) if (Math.abs(uc - doorCenter) > 2.3) holesFront.push({ u0: uc - 0.7, u1: uc + 0.7, y0: 3.85, y1: 5.15, lattice: true });
      if (Math.abs(doorCenter - L * 0.5) > 1.8) holesFront.push({ u0: L * 0.5 - 0.6, u1: L * 0.5 + 0.6, y0: 3.85, y1: 5.15, lattice: true });
      for (const uc of [L * 0.2, L * 0.8]) if (Math.abs(uc - doorCenter) > 2.3) holesFront.push({ u0: uc - 0.6, u1: uc + 0.6, y0: 0.85, y1: 2.2, lattice: true });
    }
    let litUp = false;
    const wallsFor = (F, name) => {
      let holes;
      if (name === 'front') holes = holesFront;
      else { holes = []; const n = Math.max(1, Math.round(F.L / 4.2)); for (let i = 0; i < n; i++) { const uc = F.L / n * (i + 0.5); if (name === 'back' && rng() < 0.3) continue; holes.push({ u0: uc - 0.6, u1: uc + 0.6, y0: two ? 3.9 : 1.3, y1: two ? 5.1 : 2.25, lattice: true }); if (two && rng() < 0.7) holes.push({ u0: uc - 0.6, u1: uc + 0.6, y0: 0.95, y1: 2.15, lattice: true }); } }
      wallHoles(F, -1, wallH, holes, plaster, { rd: 0.2, uo: uo + name.length * 0.27, wain: 0.9, wcol: burnt });
      // timber frame
      const sp = Math.max(1.4, Math.min(2.1, F.L / Math.ceil(F.L / 1.9)));
      fbox(tb, F, -0.08, F.L + 0.08, 0.0, 0.3, 0, 0.08, wood, 'bu'); fbox(tb, F, -0.08, F.L + 0.08, wallH - 0.34, wallH, 0, 0.1, wood, 'bu');
      if (two) fbox(tb, F, -0.08, F.L + 0.08, 3.25, 3.5, 0, 0.09, wood, 'bu');
      for (let u = 0; u <= F.L + 0.01; u += sp) {
        const uu = Math.min(u, F.L); if (holes.some(h => uu > h.u0 - 0.2 && uu < h.u1 + 0.2)) continue;
        fbox(tb, F, uu - 0.08, uu + 0.08, 0.3, wallH - 0.34, 0, 0.08, wood, 'bu');
      }
      fbox(tb, F, -0.1, F.L + 0.1, -1, 0.5, -0.02, 0.06, stoneC, 'blu');
      for (const h of holes) if (h.lattice) {                           // lattice window with paper behind
        const { u0, u1, y0, y1 } = h, rd = 0.2;
        const upLit = two && y0 > 3 && !litUp ? (litUp = true) : undefined;
        pane(F, u0, u1, y0, y1, -rd + 0.04, 'paper', upLit);
        fbox(tb, F, u0 - 0.1, u1 + 0.1, y1, y1 + 0.12, -0.02, 0.1, wood, 'bu'); fbox(tb, F, u0 - 0.1, u1 + 0.1, y0 - 0.12, y0, -0.02, 0.14, wood, 'b');
        fbox(tb, F, u0 - 0.1, u0, y0, y1, -0.02, 0.1, wood, 'bu'); fbox(tb, F, u1, u1 + 0.1, y0, y1, -0.02, 0.1, wood, 'bu');
        const nb = low ? 3 : Math.max(4, Math.round((u1 - u0) / 0.16));
        for (let k = 1; k < nb; k++) { const uu = u0 + (u1 - u0) * k / nb; fbox(tb, F, uu - 0.022, uu + 0.022, y0, y1, -0.06, 0.04, woodL, 'blrbtu'); }
        if (!low) { fbox(tb, F, u0, u1, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, -0.04, 0.03, woodL, 'blrbtu'); }
      }
    };
    for (const nme of ['front', 'right', 'back', 'left']) wallsFor(Fs[nme], nme);
    // gable end caps: plaster triangle (the roof is a gable with the ridge along x)
    const eaveY = wallH + 0.55, eaveR = [-hw - ov, hw + ov, -hd - ov, hd + ov];
    if (gable) {
      for (const nme of ['right', 'left']) {
        const F = Fs[nme], Lf = F.L, zE = (hd + ov), run = zE;
        // roof underside above the wall at depth z: y = eaveY - th + (zE - |z|) * pitch  (minus the sag allowance)
        const yAt = (z) => eaveY - 0.22 - sag * 1.2 + (zE - Math.abs(z)) * pitch;
        // polygon: front edge, back edge, with the apex at z = 0
        const uApex = nme === 'right' ? (body.z1 - 0) : (0 - body.z0);
        const yz = (u) => { const z = nme === 'right' ? body.z1 - u : body.z0 + u; return yAt(z); };
        const poly = [[0, wallH], [Lf, wallH], [Lf, yz(Lf)], [uApex, yAt(0)], [0, yz(0)]];
        for (let i = 1; i < poly.length - 1; i++) K.Q(wb, [F.P(poly[0][0], poly[0][1], 0), F.P(poly[i][0], poly[i][1], 0), F.P(poly[i + 1][0], poly[i + 1][1], 0), F.P(poly[i + 1][0], poly[i + 1][1], 0)], [[poly[0][0] / 4, poly[0][1] / 4], [poly[i][0] / 4, poly[i][1] / 4], [poly[i + 1][0] / 4, poly[i + 1][1] / 4], [poly[i + 1][0] / 4, poly[i + 1][1] / 4]], F.d(0, 0, 1), plaster);
        // crossing timbers on the gable
        if (!low) for (const k of [0.25, 0.5, 0.75]) { const uu = Lf * k, yy = yz(uu); if (yy > wallH + 0.3) fbox(tb, F, uu - 0.06, uu + 0.06, wallH, yy - 0.05, 0, 0.07, wood, 'bu'); }
      }
    }
    // ---- veranda (engawa)
    if (!two) {
      const F = front, deck = [0.5, 0.36, 0.25];
      fbox(tb, F, -0.1, L + 0.1, -1, 0.34, 0.0, dv - 0.05, stoneC, 'bu'); fbox(tb, F, -0.15, L + 0.15, 0.34, 0.5, 0.0, dv + 0.08, deck, 'bu');
      if (!low) for (let k = 1; k < 6; k++) fbox(tb, F, -0.15, L + 0.15, 0.5, 0.5 + 0.002, 0.0 + k * dv / 6, 0.0 + k * dv / 6 + 0.02, wood, 'fblrub');
      const nP = Math.max(2, Math.round(L / 2.8) + 1);
      for (let i = 0; i < nP; i++) { const uu = 0.25 + (L - 0.5) * i / (nP - 1); fbox(tb, F, uu - 0.08, uu + 0.08, 0.5, wallH, dv - 0.2, dv - 0.04, wood, 'u'); }
      fbox(tb, F, -0.2, L + 0.2, wallH - 0.28, wallH, dv - 0.24, dv - 0.02, wood, 'u');
      if (!low) fbox(tb, F, -0.2, L + 0.2, 0.34, 0.5, dv + 0.08, dv + 0.1, wood, 'u');
    }
    // ---- sliding doors / shoji
    for (const sh of shoji) {
      const { a, b, y0, y1 } = sh, F = front, rd = 0.2, w = b - a, np = Math.max(2, Math.round(w / 0.95)), pw = w / np;
      fbox(tb, F, a - 0.1, b + 0.1, y1, y1 + 0.24, -0.04, 0.12, wood, 'bu'); fbox(tb, F, a - 0.1, a, y0 - 0.04, y1, -0.04, 0.12, wood, 'bu'); fbox(tb, F, b, b + 0.1, y0 - 0.04, y1, -0.04, 0.12, wood, 'bu');
      fbox(tb, F, a, b, y0 - 0.06, y0 + 0.05, -rd, 0.1, wood, 'bu');
      const litRoom = rng() < 0.7;
      for (let k = 0; k < np; k++) {
        const u0 = a + k * pw, u1 = u0 + pw, off = (k % 2) * 0.05, y2 = y0 + (sh.door ? 0.05 : 0.5);
        const isLit = pane(F, u0, u1, y2, y1 - 0.02, -rd + 0.05, 'paper', litRoom && ((k + (rng() < 0.2 ? 1 : 0)) % 3 !== 2));
        if (isLit && !sh.door) {                                  // warm light spilling from the lit screen onto the veranda boards (a vertex-coloured patch, no light)
          const near = [0.85, 0.5, 0.22], far = [0.3, 0.2, 0.13];
          K.Q(gb, [F.P(u0 - 0.05, 0.52, 0.02), F.P(u1 + 0.05, 0.52, 0.02), F.P(u1 + 0.35, 0.52, dv - 0.1), F.P(u0 - 0.35, 0.52, dv - 0.1)], [[0, 0], [1, 0], [1, 1], [0, 1]], BD_UP, [near, near, far, far]);
        }
        fbox(tb, F, u0 - 0.03, u0 + 0.03, y0, y1, -0.2 + off, -0.1 + off, wood, 'bu');
        if (!sh.door) fbox(tb, F, u0 + 0.03, u1 - 0.03, y0 + 0.05, y0 + 0.5, -0.2 + off, -0.1 + off, woodL, 'bu');
        fbox(tb, F, u0 + 0.03, u1 - 0.03, y2 - 0.0, y2 + 0.04, -0.2 + off, -0.1 + off, wood, 'bu');
        if (!low) {
          for (const f of [0.38, 0.7]) fbox(tb, F, u0 + 0.03, u1 - 0.03, y2 + (y1 - y2) * f, y2 + (y1 - y2) * f + 0.025, -0.2 + off, -0.08 + off, kum, 'blrbtu');
          for (const f of [0.33, 0.66]) fbox(tb, F, u0 + pw * f - 0.012, u0 + pw * f + 0.012, y2, y1, -0.2 + off, -0.08 + off, kum, 'blrbtu');
        }
      }
      fbox(tb, F, b - 0.03, b + 0.03, y0, y1, -0.2, -0.1, wood, 'bu');
    }
    // ---- lower pent roof (hisashi) over the entrance of a two-storey house
    if (two) {
      const Fh = wf([front.O[0] + front.n[0] * 1.3, front.O[1] + front.n[1] * 1.3], front.ax, front.n, L);
      slab(Fh, -0.4, L + 0.4, 3.0, 3.0 + 1.3 * 0.33, 1.3, 0, 0, { nu: 6, nv: 2, th: 0.14, tint: K.night ? [1.9, 2.0, 2.3] : [0.95, 0.95, 1], rakes: [true, true], under: [0.34, 0.26, 0.2], fascia: K.night ? [1.4, 1.4, 1.6] : [0.86, 0.84, 0.78],
        disp: (x, z) => { const fx = (x - Fh.O[0]) * Fh.ax[0] + (z - Fh.O[1]) * Fh.ax[1]; const e = Math.min(fx + 0.4, L + 0.4 - fx); return 0.22 * Math.exp(-(e * e) / 0.7); } });
    }
    // ---- main roof
    const dispFn = (R, kind, run) => (x, z) => {
      const [X0, X1, Z0, Z1] = R;
      let t = kind === 'gx' ? Math.min(z - Z0, Z1 - z) : Math.min(x - X0, X1 - x, z - Z0, Z1 - z);
      t = clamp(t / run, 0, 1);
      const cx = Math.min(x - X0, X1 - x), cz = Math.min(z - Z0, Z1 - z), cd2 = cx * cx + cz * cz;
      return -sag * Math.sin(Math.PI * t) + lift * Math.exp(-cd2 / 2.6);
    };
    const kind = gable ? 'gx' : 'hip', run = (kind === 'gx' ? (eaveR[3] - eaveR[2]) : Math.min(eaveR[1] - eaveR[0], eaveR[3] - eaveR[2])) / 2;
    const r = roofRect(eaveR, kind, eaveY, pitch, { nu: 8, nv: 3, th: 0.22, disp: dispFn(eaveR, kind, run), under: [0.3, 0.22, 0.17], fascia: K.night ? [1.5, 1.5, 1.7] : [0.88, 0.86, 0.8], skirtY: wallH, skirtCol: K.night ? [1.1, 1.1, 1.25] : [0.82, 0.8, 0.74], tint: K.night ? [1.8, 1.9, 2.2] : [1, 1, 1.02] });
    ridgeCap(r, r.yR + 0.06, K.night ? [0.55, 0.6, 0.75] : [0.18, 0.2, 0.25], 0.26, 0.3);
    // ceiling under the eaves (wood), around the walls
    {
      const e = eaveR, ceil = [0.36, 0.26, 0.19], y = wallH + 0.01, b0 = body;
      K.Q(tb, [[e[0], y, e[3]], [e[1], y, e[3]], [e[1], y, b0.z1], [e[0], y, b0.z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], ceil);
      K.Q(tb, [[e[0], y, b0.z0], [e[1], y, b0.z0], [e[1], y, e[2]], [e[0], y, e[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], ceil);
      K.Q(tb, [[e[0], y, b0.z1], [b0.x0, y, b0.z1], [b0.x0, y, b0.z0], [e[0], y, b0.z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], ceil);
      K.Q(tb, [[b0.x1, y, b0.z1], [e[1], y, b0.z1], [e[1], y, b0.z0], [b0.x1, y, b0.z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], ceil);
    }
    // ---- lanterns: a paper lantern hanging from the eave by the entrance, a stone lantern in front (glow at night)
    {
      const F = front, uu = two ? doorCenter + 1.35 : shoji[0].b + 0.55, ww = two ? 1.1 : dv - 0.3, yb = two ? 2.5 : wallH - 0.7;
      const base = F.P(uu, 0, ww);
      const night = K.night, red = night ? [1, 0.46, 0.2] : [0.8, 0.16, 0.12];
      K.cyl(gb, base[0], base[2], yb, yb + 0.4, 0.15, 0.15, 6, red, 't');
      K.cyl(tb, base[0], base[2], yb + 0.4, yb + 0.44, 0.12, 0.12, 6, [0.1, 0.1, 0.1], ''); K.cyl(tb, base[0], base[2], yb - 0.04, yb, 0.1, 0.1, 6, [0.1, 0.1, 0.1], '');
      if (!two) fbox(tb, ID, base[0] - 0.015, base[0] + 0.015, yb + 0.44, wallH - 0.28, base[2] - 0.015, base[2] + 0.015, [0.1, 0.1, 0.1], 'u');
      if (night) { const wp = K.T(base[0], yb + 0.2, base[2]); K.glows.push({ x: wp[0], y: it.y + yb + 0.2, z: wp[2], c: 0xff6a30, size: 1.5 }); }
      const sx = F.P(rng() < 0.5 ? 0.9 : L - 0.9, 0, dv + 1.1), g = [0.55, 0.54, 0.52];
      fbox(tb, ID, sx[0] - 0.3, sx[0] + 0.3, -1, 0.14, sx[2] - 0.3, sx[2] + 0.3, g, 'u'); fbox(tb, ID, sx[0] - 0.09, sx[0] + 0.09, 0.14, 0.78, sx[2] - 0.09, sx[2] + 0.09, g, 'u');
      fbox(tb, ID, sx[0] - 0.21, sx[0] + 0.21, 0.78, 0.84, sx[2] - 0.21, sx[2] + 0.21, g, ''); fbox(tb, ID, sx[0] - 0.3, sx[0] + 0.3, 1.16, 1.28, sx[2] - 0.3, sx[2] + 0.3, g, 'u'); fbox(tb, ID, sx[0] - 0.1, sx[0] + 0.1, 1.28, 1.4, sx[2] - 0.1, sx[2] + 0.1, g, 'u');
      K.cyl(gb, sx[0], sx[2], 0.84, 1.16, 0.15, 0.15, 4, night ? [1, 0.72, 0.38] : [0.82, 0.74, 0.58], 't');
      if (night) { const wp = K.T(sx[0], 1.0, sx[2]); K.glows.push({ x: wp[0], y: it.y + 1.0, z: wp[2], c: 0xffb060, size: 1.3 }); }
    }
  }

  /* buildings(list, opt): detailed 3D houses, built in code. One call = one wall mesh and one roof mesh per style used, plus one trim mesh and one glass mesh
     for all of them (4 draw calls for one style, 6 for two), however many houses are in the list.
       list: [{ x, y, z, yaw, w, d, h, style, tint, roof }, ...]
         x,y,z   ground position of the middle of the building (y = terrain height there; the walls go 1 m below it)
         yaw     rotation.y in radians. The FRONT (windows + door) faces local +z. To face the road use yaw = facingYaw(x, z, roadX, roadZ)
         w, d    width of the front (6..20 m), depth (5..12 m). The house stays inside this footprint (eaves reach 0.5 .. 0.9 m beyond it)
         h       wall height, 6..10 m (european: two storeys; japanese: 7.6 and more = two storeys, below = one storey with a veranda)
         style   'plaster' (default), 'stone', 'japanese' or 'timber' (SS4: half-timber walls and a thatched roof; stone houses get a slate roof on SS4)
         tint    [r,g,b] 0..1 multiplier for the wall colour, e.g. [1,0.9,0.75] sand, [1,0.82,0.8] pink, [0.85,0.9,1] pale blue
         roof    'hip' (default: the builder picks hip or gable and the pitch, and also the shape of the house: plain box, front-gable bay with porch, lean-to),
                 'gable', or 'flat' (low parapet). Japanese houses are always a curved-eave hip or gable.
     Returns an array of the meshes made. */
  function buildings(list, opt = {}) {
    const low = quality === 'low', night = !!(ST.look && ST.look.night), sets = {}, tb = geoBuilder(), gb = geoBuilder(), glows = [], out = [];
    for (const it of list) {
      const style = it.style === 'stone' || it.style === 'japanese' || it.style === 'timber' ? it.style : 'plaster';
      const S = sets[style] || (sets[style] = { wb: geoBuilder(), rb: geoBuilder() });
      const rng = mulberry32((Math.floor(it.x * 10) * 7919 + Math.floor(it.z * 10) * 104729) >>> 0 || 1);
      const K = houseKit(it, S, tb, gb, { low, night, rng, glows, style });
      if (style === 'japanese') japaneseHouse(K); else europeanHouse(K);
    }
    for (const style of Object.keys(sets)) {
      out.push(roadsideMesh(sets[style].wb.build(), style === 'stone' ? stoneWarmTex() : style === 'timber' ? timberTex() : plasterTex()),
        roadsideMesh(sets[style].rb.build(), style === 'japanese' ? jpRoofTex() : style === 'timber' ? thatchTex() : style === 'stone' && ST.id === 'thornwick' ? slateTex() : roofTex()));
    }
    out.push(roadsideMesh(tb.build(), trimTex(), { shadow: false }));
    const gm = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); gm.receiveShadow = false; gm.castShadow = false; add(gm); out.push(gm);
    if (night) for (const g of glows) glowSpots.push(g);
    return out;
  }

  /* townDetail(list): depth for the neon town buildings of SS3 (the painted windows stay; this adds real frames and ledges on top).
       list: [{ x, y, z, yaw, w, d, h, side }]  x,y,z = the mesh position (y = foot of the wall), yaw = its rotation.y, w along the road, d away from it,
       h its height, side = +1 / -1 (which side of the road; decides which long face looks at the road).
     Adds on the road face: window frames with sills, floor ledges, corner pilasters, shop awnings, balconies, air-conditioner boxes; on the roof:
     parapet, stair hut, water tank, antenna with a red light, sometimes a lit sign board. One trim mesh + one unlit glass mesh for the whole list. Look only. */
  function townDetail(list) {
    if (!list.length) return [];
    const low = quality === 'low', night = !!(ST.look && ST.look.night), tb = geoBuilder(), gb = geoBuilder(), glows = [];
    const AW = [[[0.86, 0.2, 0.18], [0.96, 0.94, 0.88]], [[0.15, 0.5, 0.35], [0.96, 0.94, 0.88]], [[0.15, 0.32, 0.65], [0.96, 0.94, 0.88]], [[0.95, 0.55, 0.15], [0.98, 0.9, 0.7]], [[0.5, 0.2, 0.55], [0.95, 0.9, 0.95]]];
    for (const b of list) {
      const it = { x: b.x, y: b.y, z: b.z, yaw: b.yaw, w: b.w, d: b.d, h: b.h };
      const rng = mulberry32((Math.floor(b.x * 10) * 7919 + Math.floor(b.z * 10) * 104729) >>> 0 || 1);
      const K = houseKit(it, { wb: tb, rb: tb }, tb, gb, { low, night, rng, glows, style: 'plaster' });
      const { fbox, faces, ID } = K, hw = b.w / 2, hd = b.d / 2, hh = b.h, Fs = faces(-hw, hw, -hd, hd), F = b.side > 0 ? Fs.front : Fs.back, L = F.L, sc = hh / (hh - 1);
      const grey = [0.74, 0.74, 0.76], dark = [0.28, 0.3, 0.34], tone = bdMul(grey, 0.9 + rng() * 0.2);
      // window rows and columns as painted on the facade texture (4 x 4 windows per 12.8 m x 13.6 m)
      const wins = [];
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
        const y0 = (k + 1 - (14 + 64 * j + 48) / 256) * 13.6 * sc, y1 = (k + 1 - (14 + 64 * j) / 256) * 13.6 * sc;
        if (y0 < 0.3 || y1 > hh - 0.6) continue;
        for (let kk = 0; kk * 12.8 < L; kk++) for (let i = 0; i < 4; i++) {
          const a0 = (kk + (i * 64 + 12) / 256) * 12.8, a1 = (kk + (i * 64 + 52) / 256) * 12.8;
          if (a1 > L - 0.1) continue;
          wins.push({ a0, a1, y0, y1, row: j + k * 4 });
        }
      }
      const rows = [...new Set(wins.map(w => Math.round(w.y0 * 10)))].sort((a, c) => a - c).map(v => v / 10);
      for (const w of wins) {
        fbox(tb, F, w.a0 - 0.14, w.a1 + 0.14, w.y1, w.y1 + 0.14, 0, 0.16, tone, low ? 'blrbu' : 'blrb');
        fbox(tb, F, w.a0 - 0.22, w.a1 + 0.22, w.y0 - 0.34, w.y0 - 0.08, 0, 0.3, tone, low ? 'blrbtu' : 'br');
        if (!low) {
          fbox(tb, F, w.a0 - 0.12, w.a0, w.y0 - 0.08, w.y1, 0, 0.12, dark, 'btu'); fbox(tb, F, w.a1, w.a1 + 0.12, w.y0 - 0.08, w.y1, 0, 0.12, dark, 'btu');
          fbox(tb, F, (w.a0 + w.a1) / 2 - 0.035, (w.a0 + w.a1) / 2 + 0.035, w.y0, w.y1, 0, 0.07, dark, 'blrbtu');
          if (rng() < 0.12) fbox(tb, F, (w.a0 + w.a1) / 2 - 0.4, (w.a0 + w.a1) / 2 + 0.4, w.y0 - 0.95, w.y0 - 0.4, 0, 0.36, [0.85, 0.86, 0.88], 'b');            // air-conditioner box under the sill
        }
      }
      // floor ledges (road face and both sides) and corner pilasters
      const ledge = [...new Set(wins.map(w => Math.round((w.y1 + 0.5) * 2) / 2))].filter(y => y < hh - 1);
      if (!low) for (const y of rows.slice(1)) for (const k of ['front', 'back', 'left', 'right']) if (k === (b.side > 0 ? 'front' : 'back') || k === 'left' || k === 'right') fbox(tb, Fs[k], -0.1, Fs[k].L + 0.1, y - 0.62, y - 0.5, 0, 0.1, bdMul(grey, 0.95), 'bu');
      void ledge;
      fbox(tb, F, -0.12, 0.55, 0, hh, 0, 0.14, bdMul(grey, 0.85), 'bu'); fbox(tb, F, L - 0.55, L + 0.12, 0, hh, 0, 0.14, bdMul(grey, 0.85), 'bu');
      // parapet and cornice
      for (const k of ['front', 'right', 'back', 'left']) { const G = Fs[k], road = k === (b.side > 0 ? 'front' : 'back'); if (low && !road) continue; fbox(tb, G, -0.15, G.L + 0.15, hh - 0.4, hh + 0.02, 0, 0.4, bdMul(grey, 1.0), low ? 'blrbu' : 'b'); fbox(tb, G, -0.15, G.L + 0.15, hh, hh + 0.85, -0.3, 0.1, bdMul(grey, 0.9), low ? 'blrbu' : 'u'); }
      // shop awning over the ground-floor windows of the road face
      const gw = wins.filter(w => w.y0 < 4 && w.a0 > 0.5), gy = gw.length ? gw[0].y1 : 2.6;
      if (gw.length && rng() < 0.75) {
        const [c1, c2] = AW[Math.floor(rng() * AW.length)], span = Math.min(L - 1.2, 4.5 + rng() * 4), u0 = Math.max(0.6, L * (0.2 + rng() * 0.2)), u1 = Math.min(L - 0.6, u0 + span), n = Math.max(3, Math.round((u1 - u0) / 0.5)), yt = gy + 0.5, yb = yt - 0.45, dp = 1.4;
        for (let i = 0; i < n; i++) {
          const a = u0 + (u1 - u0) * i / n, c = u0 + (u1 - u0) * (i + 1) / n, col = i % 2 ? c2 : c1;
          K.Q(tb, [F.P(a, yt, 0.05), F.P(c, yt, 0.05), F.P(c, yb, dp), F.P(a, yb, dp)], [[0, 0], [1, 0], [1, 1], [0, 1]], F.d(0, 0.6, 1), col);
          K.Q(tb, [F.P(a, yb, dp), F.P(c, yb, dp), F.P(c, yb - 0.22, dp), F.P(a, yb - 0.22, dp)], [[0, 0], [1, 0], [1, 1], [0, 1]], F.d(0, 0, 1), col);
        }
        fbox(tb, F, u0, u0 + 0.05, yb - 0.1, yt, 0.0, 0.05, dark, 'bt'); fbox(tb, F, u1 - 0.05, u1, yb - 0.1, yt, 0.0, 0.05, dark, 'bt');
      }
      // a balcony on one window of the upper floors
      const up = wins.filter(w => w.y0 > 4.5 && w.y1 < hh - 2.0);
      if (up.length && rng() < 0.55) {
        const w = up[Math.floor(rng() * up.length)], u0 = w.a0 - 0.5, u1 = w.a1 + 0.5, y = w.y0 - 0.2;
        fbox(tb, F, u0, u1, y - 0.18, y, 0.0, 1.1, bdMul(grey, 0.8));
        fbox(tb, F, u0, u1, y + 0.95, y + 1.02, 1.04, 1.1, dark, 'u'); fbox(tb, F, u0, u0 + 0.05, y, y + 1.0, 0.0, 1.1, dark, 'u'); fbox(tb, F, u1 - 0.05, u1, y, y + 1.0, 0.0, 1.1, dark, 'u');
        if (!low) for (let u = u0 + 0.2; u < u1 - 0.1; u += 0.22) fbox(tb, F, u, u + 0.035, y, y + 0.96, 1.05, 1.09, dark, 'blrbtu');
      }
      // roof clutter
      const rx = (rng() - 0.5) * (b.w - 5), rz = (rng() - 0.5) * (b.d - 5);
      if (rng() < 0.5) fbox(tb, ID, rx - 1.1, rx + 1.1, hh, hh + 2.4, rz - 1.0, rz + 1.0, [0.7, 0.7, 0.72], '');
      if (rng() < 0.4) { const tx = -rx * 0.8, tz = -rz * 0.8; for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) fbox(tb, ID, tx + lx - 0.06, tx + lx + 0.06, hh, hh + 1.4, tz + lz - 0.06, tz + lz + 0.06, [0.4, 0.4, 0.44], 'u'); K.cyl(tb, tx, tz, hh + 1.4, hh + 3.0, 1.0, 1.0, 10, [0.55, 0.42, 0.34]); }
      if (rng() < 0.35) {
        const ax = (rng() - 0.5) * (b.w - 3), az = (rng() - 0.5) * (b.d - 3);
        fbox(tb, ID, ax - 0.04, ax + 0.04, hh, hh + 5, az - 0.04, az + 0.04, [0.3, 0.3, 0.34], 'u'); fbox(tb, ID, ax - 0.6, ax + 0.6, hh + 4.0, hh + 4.06, az - 0.03, az + 0.03, [0.3, 0.3, 0.34], '');
        const wp = K.T(ax, 0, az); if (night) glows.push({ x: wp[0], y: b.y + hh + 5.1, z: wp[2], c: 0xff2a1a, size: 1.1 });
        K.cyl(gb, ax, az, hh + 5.0, hh + 5.14, 0.08, 0.08, 4, [1, 0.2, 0.15], '');
      }
      if (rng() < 0.18) {                                      // a lit sign board on the roof, facing the road
        const SB = [[1, 0.35, 0.6], [0.3, 0.9, 1], [1, 0.85, 0.2], [0.6, 1, 0.5]], c1 = SB[Math.floor(rng() * SB.length)], bw = Math.min(L - 3, 5 + rng() * 3), u0 = (L - bw) / 2;
        fbox(tb, F, u0, u0 + 0.12, hh, hh + 1.4, -1.0, -0.88, dark, 'u'); fbox(tb, F, u0 + bw - 0.12, u0 + bw, hh, hh + 1.4, -1.0, -0.88, dark, 'u');
        fbox(tb, F, u0 - 0.1, u0 + bw + 0.1, hh + 1.2, hh + 3.1, -1.1, -0.95, dark, '');
        const c2 = night ? c1 : bdMul(c1, 0.75);
        K.Q(gb, [F.P(u0, hh + 1.3, -0.94), F.P(u0 + bw, hh + 1.3, -0.94), F.P(u0 + bw, hh + 3.0, -0.94), F.P(u0, hh + 3.0, -0.94)], [[0, 0], [1, 0], [1, 1], [0, 1]], F.d(0, 0, 1), [bdMul(c2, 0.8), bdMul(c2, 0.8), c2, c2]);
      }
    }
    const out = [roadsideMesh(tb.build(), trimTex(), { shadow: false })];
    const gm = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); add(gm); out.push(gm);
    if (night) for (const g of glows) glowSpots.push(g);
    return out;
  }
