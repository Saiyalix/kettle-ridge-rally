  /* ---------- castle look (SS4 Thornwick Keep): meshes made from castleLayout() (src/tracks/castle.js) ----------
     Tracks owns the data and the collision (castleObstacles); this file only decides how it LOOKS (art). No new obstacles, no random draws from the stage generator.
     Everything static is merged per material: stone, slate roofs, clay roofs, thatch, wood, trim (iron, cloth, barrels, hay), unlit glass (windows, slits, torch flames),
     courtyard cobbles, moat water, banners and pennants (the only moving part: wind in the vertex shader), plus a small far set (windmill, watchtower, haystacks).
     Low quality: fewer wall pieces, no studs / corbels / props, no flag motion, no water shimmer, smaller textures (the texture cache halves them). */
  const castleFx = { group: null, ct: { value: 0 }, water: null, sails: null, smoke: null, puffs: null };
  function updateCastleFx(dt) {
    const F = castleFx; if (F.group !== stageGroup || quality === 'low') return;
    F.ct.value += dt;
    if (F.water) F.water.offset.set(F.ct.value * 0.010, F.ct.value * 0.006);
    if (F.sails) F.sails.rotation.z -= dt * 0.35;
    if (F.puffs) {
      const pos = F.puffs.geometry.attributes.position, col = F.puffs.geometry.attributes.color, d = F.puffs.userData;
      for (let i = 0; i < d.n; i++) {
        const ph = (F.ct.value * 0.18 + d.ph[i]) % 1, e = ph * ph * 0.6 + ph * 0.4, a = (1 - ph) * Math.min(1, ph * 6) * 0.9;
        pos.setXYZ(i, d.x[i] + d.wx * e * 9 + Math.sin(ph * 5 + d.ph[i] * 9) * 0.4, d.y[i] + ph * 9, d.z[i] + d.wz * e * 9);
        col.setXYZ(i, d.c[0] * a, d.c[1] * a, d.c[2] * a);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
    }
  }

  /* ----- castle textures (generated once, cached; half size on low) ----- */
  // dressed ashlar: 4 m x 4 m per repeat, courses of 0.67 m, warm grey with rain streaks and lichen
  function castleStoneTex() {
    return artTex('castleStone', [512, 512], (g, W, H, S, r) => {
      g.fillStyle = '#6a655a'; g.fillRect(0, 0, W, H);
      const rows = 6, rh = H / rows, pal = [[188, 178, 160], [200, 190, 168], [172, 164, 150], [208, 197, 172], [160, 154, 144], [194, 180, 154], [180, 172, 160]];
      for (let y = 0; y < rows; y++) {
        const yy = y * rh, n = 2 + (r() < 0.5 ? 1 : 0), cuts = [0];
        for (let k = 1; k < n; k++) cuts.push(k / n + (r() - 0.5) * 0.18);
        cuts.push(1); cuts.sort((a, b) => a - b);
        const off = (y % 2) * 0.5 / n;
        for (let k = 0; k < n; k++) {
          const xa = (cuts[k] + off) * W, xb = (cuts[k + 1] + off) * W, bx = xa + 2.5 * S, bw = xb - xa - 5 * S, by = yy + 2.2 * S, bh = rh - 4.4 * S, c = pick(r, pal), v = 0.9 + r() * 0.2;
          for (const dx of [-W, 0, W]) {
            const x = bx + dx;
            g.fillStyle = `rgb(${c[0] * v | 0},${c[1] * v | 0},${c[2] * v | 0})`; g.fillRect(x, by, bw, bh);
            const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, 'rgba(255,250,230,0.22)'); gr.addColorStop(0.18, 'rgba(255,250,230,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.26)'); g.fillStyle = gr; g.fillRect(x, by, bw, bh);
            g.fillStyle = 'rgba(255,250,230,0.16)'; g.fillRect(x, by, 1.6 * S, bh); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + bw - 1.6 * S, by, 1.6 * S, bh);
            for (let i = 0; i < 70 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'; g.fillRect(x + r() * bw, by + r() * bh, S * 1.4, S * 1.4); }
            if (r() < 0.2) { g.fillStyle = 'rgba(96,124,60,0.2)'; g.beginPath(); g.ellipse(x + r() * bw, by + bh - 3 * S, (6 + r() * 14) * S, (2 + r() * 4) * S, 0, 0, 7); g.fill(); }
            if (r() < 0.1) { g.fillStyle = 'rgba(30,24,18,0.5)'; g.fillRect(x + r() * bw * 0.8, by + r() * bh * 0.5, 2.2 * S, 5 * S); }          // a chip
          }
        }
      }
      for (let i = 0; i < 9; i++) { const x = r() * W, w = (3 + r() * 6) * S, gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(30,26,20,0.16)'); gr.addColorStop(0.7, 'rgba(30,26,20,0.07)'); gr.addColorStop(1, 'rgba(30,26,20,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, H); }   // rain streaks
    }, 51, 8);
  }
  // slate shingles: grey-blue, tinted by vertex colour; 4 m x 4 m per repeat (courses run across u)
  function slateTex() {
    return artTex('slate', [256, 256], (g, W, H, S, r) => {
      g.fillStyle = '#3c424e'; g.fillRect(0, 0, W, H);
      const rows = 12, rh = H / rows, cols = 7, cw = W / cols;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = 0.78 + r() * 0.4, cx = (x + (y % 2) * 0.5) * cw;
        for (const dx of [-W, 0]) {
          g.fillStyle = `rgb(${150 * v | 0},${160 * v | 0},${176 * v | 0})`; g.fillRect(cx + dx + 1, y * rh, cw - 2, rh * 1.5);
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx + dx + 1, y * rh, cw - 2, 1.5 * S);
          g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx + dx + 1, y * rh + rh * 1.5 - 2 * S, cw - 2, 2 * S);
          g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + dx + cw - 2.5 * S, y * rh, 1.5 * S, rh * 1.5);
        }
      }
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(90,120,70,0.22)'; g.beginPath(); g.ellipse(r() * W, r() * H, (3 + r() * 6) * S, (2 + r() * 3) * S, 0, 0, 7); g.fill(); }
    }, 52, 4);
  }
  // thatch: straw bundles running down the slope (v), 4 m x 4 m per repeat
  function thatchTex() {
    return artTex('thatch', [256, 256], (g, W, H, S, r) => {
      g.fillStyle = '#7d6232'; g.fillRect(0, 0, W, H);
      const pal = ['#b89a58', '#a58545', '#c8ab68', '#8f7038', '#d2b878', '#9a7a3c'];
      for (let i = 0; i < 1500; i++) {
        const x = r() * W, y = r() * H, len = (12 + r() * 26) * S, lean = (r() - 0.5) * 0.25;
        g.strokeStyle = pal[Math.floor(r() * pal.length)]; g.globalAlpha = 0.55 + r() * 0.4; g.lineWidth = (0.8 + r() * 1.8) * S;
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + len * lean, y + dy + len); g.stroke(); }
      }
      g.globalAlpha = 1;
      for (let k = 0; k < 5; k++) { const y = k * H / 5; const gr = g.createLinearGradient(0, y, 0, y + H / 5); gr.addColorStop(0, 'rgba(40,26,8,0.0)'); gr.addColorStop(0.85, 'rgba(40,26,8,0.0)'); gr.addColorStop(1, 'rgba(40,26,8,0.5)'); g.fillStyle = gr; g.fillRect(0, y, W, H / 5); }
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(100,110,50,0.14)'; g.beginPath(); g.ellipse(r() * W, r() * H, (4 + r() * 8) * S, (2 + r() * 4) * S, 0, 0, 7); g.fill(); }   // a little moss
    }, 53, 4);
  }
  // half-timber wall: cream plaster in 2 m cells with dark oak posts, rails and braces; 4 m x 4 m per repeat
  function timberTex() {
    return artTex('timber', [256, 256], (g, W, H, S, r) => {
      g.fillStyle = '#e6d8b8'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * H, rad = (14 + r() * 40) * S; blot(g, x, y, rad, r() < 0.5 ? '120,96,60' : '255,250,235', 0.07 + r() * 0.08); }
      for (let i = 0; i < 2500 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.1)' : 'rgba(255,255,255,0.12)'; g.fillRect(r() * W, r() * H, S * 1.4, S * 1.4); }
      const bw = 11 * S, oak = '#46301f';
      g.strokeStyle = oak; g.lineWidth = 9 * S; g.lineCap = 'butt';
      for (const [x0, y0, x1, y1] of [[0, 0, 128, 128], [256, 0, 128, 128], [0, 256, 128, 128], [256, 256, 128, 128], [128, 0, 256, 128], [128, 0, 0, 128], [128, 256, 256, 128], [128, 256, 0, 128]]) { g.beginPath(); g.moveTo(x0 * S, y0 * S); g.lineTo(x1 * S, y1 * S); g.stroke(); }
      g.fillStyle = oak;
      for (const x of [0, 128, 256]) g.fillRect(x * S - bw / 2, 0, bw, H);
      for (const y of [0, 128, 256]) g.fillRect(0, y * S - bw / 2, W, bw);
      for (let i = 0; i < 80; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,10,4,0.3)' : 'rgba(190,150,100,0.22)'; const x = [0, 128, 256][Math.floor(r() * 3)] * S + (r() - 0.5) * bw; g.fillRect(x, r() * H, S, (6 + r() * 14) * S); }
    }, 54, 8);
  }
  // cobbles / trodden courtyard: 3 m x 3 m per repeat
  function cobbleTex() {
    return artTex('cobble', [256, 256], (g, W, H, S, r) => {
      g.fillStyle = '#5a4e40'; g.fillRect(0, 0, W, H);
      const pal = [[178, 166, 146], [152, 142, 126], [194, 180, 156], [136, 128, 116], [168, 152, 128], [146, 140, 132]];
      const rows = 11, rh = H / rows;
      for (let y = 0; y < rows; y++) {
        let x = -r() * 20 * S;
        while (x < W) {
          const w = (16 + r() * 16) * S, c = pick(r, pal), v = 0.85 + r() * 0.3;
          for (const dx of [-W, 0]) {
            g.fillStyle = `rgb(${c[0] * v | 0},${c[1] * v | 0},${c[2] * v | 0})`; g.beginPath();
            if (g.roundRect) g.roundRect(x + dx + 1.2 * S, y * rh + 1.2 * S, w - 2.4 * S, rh - 2.4 * S, 4 * S); else g.rect(x + dx + 1.2 * S, y * rh + 1.2 * S, w - 2.4 * S, rh - 2.4 * S);
            g.fill();
            g.fillStyle = 'rgba(255,250,235,0.14)'; g.fillRect(x + dx + 2 * S, y * rh + 1.8 * S, w - 4 * S, 2 * S);
          }
          x += w;
        }
      }
      for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, rad = (14 + r() * 30) * S; wrapXY(W, H, x, y, rad, (X, Y) => blot(g, X, Y, rad, r() < 0.6 ? '70,90,40' : '70,56,38', 0.1 + r() * 0.1)); }   // moss and mud
    }, 55, 8);
  }
  function waterTex() {
    const low = quality === 'low', sz = low ? 64 : 128, S = sz / 128, r = mulberry32(56), c = document.createElement('canvas'); c.width = c.height = sz;
    const g = c.getContext('2d'); g.fillStyle = '#9db0b0'; g.fillRect(0, 0, sz, sz);
    for (let i = 0; i < 46; i++) { const x = r() * sz, y = r() * sz, w = (8 + r() * 22) * S; g.fillStyle = r() < 0.6 ? 'rgba(255,255,255,0.14)' : 'rgba(30,50,60,0.14)'; for (const dx of [-sz, 0, sz]) for (const dy of [-sz, 0, sz]) { g.beginPath(); g.ellipse(x + dx, y + dy, w, (1 + r() * 1.6) * S, 0, 0, 7); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 1 : 4; return srgb(t);
  }
  // heraldry (invented): Thornwick = a golden thorn-ring on crimson (A), a crimson thorn-branch on teal and cream (B), crimson to gold pennant stripes (C)
  function bannerTex() {
    const low = quality === 'low', sz = low ? 128 : 256, S = sz / 256, c = document.createElement('canvas'); c.width = c.height = sz;
    const g = c.getContext('2d'); g.scale(S, S);
    const GOLD = '#e8b630', DGOLD = '#a8741c', CRIM = '#a2262c';
    // A: x 0..102
    g.fillStyle = CRIM; g.fillRect(0, 0, 102, 256);
    g.fillStyle = GOLD; g.fillRect(0, 0, 5, 256); g.fillRect(97, 0, 5, 256); g.fillRect(0, 0, 102, 5);
    g.save(); g.translate(51, 92);
    g.fillStyle = GOLD; for (let i = 0; i < 10; i++) { g.save(); g.rotate(i / 10 * 6.2832); g.beginPath(); g.moveTo(-5, -23); g.lineTo(0, -44); g.lineTo(5, -23); g.fill(); g.restore(); }
    g.strokeStyle = GOLD; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.stroke();
    g.fillStyle = '#f4e8c8'; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); g.restore();
    g.strokeStyle = GOLD; g.lineWidth = 9; g.beginPath(); g.moveTo(10, 176); g.lineTo(51, 150); g.lineTo(92, 176); g.stroke();
    g.beginPath(); g.moveTo(10, 204); g.lineTo(51, 178); g.lineTo(92, 204); g.stroke();
    // B: x 102..204
    g.fillStyle = '#e9ddbc'; g.fillRect(102, 0, 102, 256);
    g.fillStyle = '#1f6a66'; g.beginPath(); g.moveTo(102, 0); g.lineTo(204, 0); g.lineTo(204, 150); g.lineTo(102, 60); g.fill(); g.beginPath(); g.moveTo(102, 256); g.lineTo(102, 190); g.lineTo(204, 256); g.fill();
    g.strokeStyle = DGOLD; g.lineWidth = 4; g.strokeRect(104, 2, 98, 252);
    g.strokeStyle = CRIM; g.lineWidth = 7; g.beginPath(); g.moveTo(120, 232); g.bezierCurveTo(130, 160, 180, 130, 186, 40); g.stroke();
    g.fillStyle = CRIM; for (const [x, y, d] of [[128, 190, -1], [146, 156, 1], [158, 124, -1], [172, 92, 1], [180, 62, -1]]) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + d * 24, y - 16); g.lineTo(x + 3, y + 6); g.fill(); }
    // C: pennant stripes, x 204..256: crimson to gold along u
    const gr = g.createLinearGradient(204, 0, 256, 0); gr.addColorStop(0, '#b02a2a'); gr.addColorStop(0.62, '#c8402a'); gr.addColorStop(0.64, '#e8b630'); gr.addColorStop(1, '#f2cc58'); g.fillStyle = gr; g.fillRect(204, 0, 52, 256);
    g.fillStyle = 'rgba(255,255,255,0.1)'; for (let y = 0; y < 256; y += 20) g.fillRect(204, y, 52, 2);
    // cloth: soft folds and a worn edge
    for (let i = 0; i < 6; i++) { const x = 8 + i * 34; g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; g.fillRect(x, 0, 10, 256); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = low ? 1 : 4; return srgb(t);
  }
  const BAN = { A: [0.012, 0.396], B: [0.416, 0.796], C: [0.81, 0.99] };          // u ranges of the three pictures

  /* ----- small geometry kit (everything goes into geoBuilder meshes; colours are 0..1 vertex tints) ----- */
  const TL = 4;
  const cMix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const hsh = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  // a flat polygon (3, 4 or more points; convex), front side looks along `out`; uvs per point; col = one colour or one per point
  function poly(b, pts, uvs, col, out) {
    const ids = pts.map((p, i) => b.v(p[0], p[1], p[2], uvs[i][0], uvs[i][1], Array.isArray(col[0]) ? col[i] : col));
    if (ids.length === 4) { b.quad(ids[0], ids[1], ids[2], ids[3], out); return; }
    for (let i = 1; i < ids.length - 1; i++) {
      const a = pts[0], p = pts[i], q = pts[i + 1], ux = p[0] - a[0], uy = p[1] - a[1], uz = p[2] - a[2], vx = q[0] - a[0], vy = q[1] - a[1], vz = q[2] - a[2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0) b.tri(ids[0], ids[i], ids[i + 1]); else b.tri(ids[0], ids[i + 1], ids[i]);
    }
  }
  // vertical strip from (x0,z0) to (x1,z1), ya..yb, facing (ox,oz); col may be a function of y (moss at the foot), splits = heights where colour knots are
  function vstrip(b, x0, z0, x1, z1, ya, yb, ox, oz, col, o = {}) {
    const tile = o.tile || TL, u0 = (o.u0 || 0) / tile, u1 = u0 + Math.hypot(x1 - x0, z1 - z0) / tile, ys = [ya];
    if (o.splits) for (const s of o.splits) if (s > ya + 0.01 && s < yb - 0.01) ys.push(s);
    ys.push(yb);
    const cf = typeof col === 'function' ? col : () => col;
    for (let i = 0; i < ys.length - 1; i++) {
      const a = ys[i], c = ys[i + 1];
      b.quad(b.v(x0, a, z0, u0, a / tile, cf(a)), b.v(x1, a, z1, u1, a / tile, cf(a)), b.v(x1, c, z1, u1, c / tile, cf(c)), b.v(x0, c, z0, u0, c / tile, cf(c)), [ox, 0, oz]);
    }
  }
  const hcap = (b, pts, y, col, up = true, tile = TL) => poly(b, pts.map(p => [p[0], y, p[1]]), pts.map(p => [p[0] / tile, p[1] / tile]), col, [0, up ? 1 : -1, 0]);
  // an oriented box: centre (cx,cz), length `len` along (tx,tz), width `wid` across, ya..yb. o.top (default true), o.bottom, o.splits
  function obox(b, cx, cz, tx, tz, len, wid, ya, yb, col, o = {}) {
    const nx = -tz, nz = tx, p = (s, t) => [cx + tx * s * len / 2 + nx * t * wid / 2, cz + tz * s * len / 2 + nz * t * wid / 2];
    const c = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
    for (let k = 0; k < 4; k++) { const A = c[k], Bq = c[(k + 1) % 4]; vstrip(b, A[0], A[1], Bq[0], Bq[1], ya, yb, (A[0] + Bq[0]) / 2 - cx, (A[1] + Bq[1]) / 2 - cz, col, { tile: o.tile, u0: k * 3.7, splits: o.splits }); }
    if (o.top !== false) hcap(b, c, yb, typeof col === 'function' ? col(yb) : col, true, o.tile);
    if (o.bottom) hcap(b, c, ya, typeof col === 'function' ? col(ya) : col, false, o.tile);
  }
  // a surface of revolution round (cx,cz): prof = [[r, y], ...] bottom to top, n segments. o.up = how much the front looks up (roofs), o.flip = look inwards
  function lathe(b, cx, cz, prof, n, col, o = {}) {
    const tile = o.tile || TL, cf = typeof col === 'function' ? col : () => col;
    let v0 = 0; const vs = [0];
    for (let j = 1; j < prof.length; j++) { v0 += Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]); vs.push(v0); }
    for (let j = 0; j < prof.length - 1; j++) {
      const [r0, y0] = prof[j], [r1, y1] = prof[j + 1], up = (o.up || 0) * (r0 - r1) / (Math.abs(y1 - y0) + 0.3) + (o.up || 0) * 0.35;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, am = (a0 + a1) / 2, ux0 = i / n * 6.2832 * ((r0 + r1) / 2) / tile, ux1 = (i + 1) / n * 6.2832 * ((r0 + r1) / 2) / tile;
        const A = b.v(cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0, ux0, vs[j] / tile, cf(y0)), Bq = b.v(cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0, ux1, vs[j] / tile, cf(y0));
        const C = b.v(cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1, ux1, vs[j + 1] / tile, cf(y1)), D = b.v(cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1, ux0, vs[j + 1] / tile, cf(y1));
        const s = o.flip ? -1 : 1;
        b.quad(A, Bq, C, D, [Math.cos(am) * s, o.up ? Math.max(0.2, up) * s : 0, Math.sin(am) * s]);
      }
    }
  }
  const ngonPts = (cx, cz, r, n, rot = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(rot + i / n * 6.2832) * r, cz + Math.sin(rot + i / n * 6.2832) * r]);
  // knots for a moss ramp: stone colour fn for a wall standing on `lvl`
  const MOSS = [0.5, 0.66, 0.36];
  const stoneCol = (t, lvl, wet = 0) => y => { const rel = y - lvl; let m = Math.max(0, Math.min(1, 1 - (rel + 0.6) / 4.6)); m = m * m; const dark = rel < -1.2 ? 0.62 : 1; return cMul(cMix([t, t, t * 0.97], cMul(MOSS, t), m * 0.7 + (rel < -0.3 ? wet : 0)), dark); };
  const mossSplits = lvl => [lvl - 1.4, lvl + 0.5, lvl + 2.2, lvl + 4.4];

  function buildCastle(L) {
    const low = quality === 'low', lvl = L.level, base = lvl - 4, W2 = L.toWorld, R = L.rect, rng = mulberry32(ST.seed * 31 + 5), half = ST.roadHalfWidth;
    const B = { stone: geoBuilder(), slate: geoBuilder(), clay: geoBuilder(), thatch: geoBuilder(), wood: geoBuilder(), trim: geoBuilder(), glass: geoBuilder(), cob: geoBuilder(), fa: geoBuilder() }, FL = flagKit();
    const far = { stone: geoBuilder(), thatch: geoBuilder(), trim: geoBuilder() };
    const STONE = (k) => stoneCol(0.86 + 0.1 * hsh(k, 3), lvl), MS = mossSplits(lvl);
    const gapOf = (x, z) => { const n = world.nearest(x, z); return n.i < 0 ? 99 : Math.sqrt(n.d2) - half; };
    const centre = W2((R.u0 + R.u1) / 2, (R.v0 + R.v1) / 2), DARK = [0.08, 0.1, 0.15], WARM = [0.9, 0.58, 0.26];
    const WIND = [Math.cos(0.5), Math.sin(0.5)];                                    // flags stream this way (world x, z)
    const SLATE = [0.82, 0.88, 1.0], SLATE2 = [0.95, 0.62, 0.58], VERD = [0.55, 0.92, 0.78], OAK = [0.6, 0.46, 0.33], IRON = [0.17, 0.17, 0.19], LIGHT = [1.0, 0.98, 0.92];
    let flagN = 0;
    const pennant = (x, y, z, k) => { FL.pennant(x, y, z, WIND, 3.2 + hsh(k, 1) * 0.8, 1.1, BAN.C); flagN++; };
    // a pole with a pennant: base (x,y,z), height h
    const pole = (x, y, z, h, k) => { obox(B.trim, x, z, 1, 0, 0.14, 0.14, y, y + h, OAK, { tile: 1 }); pennant(x, y + h - 0.7, z, k); };

    /* ---- wall frames: p(u, y, w) = a point at u along the wall (left to right seen from outside), y up, w out of the wall ---- */
    const wframe = (x0, z0, x1, z1, ox, oz) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ax = [(x1 - x0) / len, (z1 - z0) / len], n = [ox, oz];
      return { len, ax, n, p: (u, y, w) => [x0 + ax[0] * u + n[0] * w, y, z0 + ax[1] * u + n[1] * w] };
    };
    const wbox = (b, F, u0, u1, y0, y1, w0, w1, col, skip = '') => {
      const P = F.p, uv = (u, y) => [u / TL, y / TL], q = (pts, out, uvs) => poly(b, pts, uvs, col, out);
      q([P(u0, y0, w1), P(u1, y0, w1), P(u1, y1, w1), P(u0, y1, w1)], [F.n[0], 0, F.n[1]], [uv(u0, y0), uv(u1, y0), uv(u1, y1), uv(u0, y1)]);
      if (skip.indexOf('t') < 0) q([P(u0, y1, w1), P(u1, y1, w1), P(u1, y1, w0), P(u0, y1, w0)], [0, 1, 0], [uv(u0, w1), uv(u1, w1), uv(u1, w0), uv(u0, w0)]);
      q([P(u0, y0, w0), P(u0, y0, w1), P(u0, y1, w1), P(u0, y1, w0)], [-F.ax[0], 0, -F.ax[1]], [uv(w0, y0), uv(w1, y0), uv(w1, y1), uv(w0, y1)]);
      q([P(u1, y0, w1), P(u1, y0, w0), P(u1, y1, w0), P(u1, y1, w1)], [F.ax[0], 0, F.ax[1]], [uv(w1, y0), uv(w0, y0), uv(w0, y1), uv(w1, y1)]);
      if (skip.indexOf('b') < 0) q([P(u0, y0, w0), P(u1, y0, w0), P(u1, y0, w1), P(u0, y0, w1)], [0, -1, 0], [uv(u0, w0), uv(u1, w0), uv(u1, w1), uv(u0, w1)]);
    };
    // a pointed or round window (glass is unlit: dark, or warm when lit), stone frame, sill
    const windowAt = (F, u, y, w, h, o = {}) => {
      const hw = w / 2, arch = o.arch !== false, yt = y + h - (arch ? hw : 0), lit = o.lit, nn = [F.n[0], 0, F.n[1]], P = F.p;
      const pts = [P(u - hw, y, 0.03), P(u + hw, y, 0.03)];
      if (arch) for (let k = 0; k <= 5; k++) { const th = Math.PI * k / 5; pts.push(P(u + hw * Math.cos(th), yt + hw * Math.sin(th), 0.03)); } else pts.push(P(u + hw, yt, 0.03), P(u - hw, yt, 0.03));
      poly(B.glass, pts, pts.map(() => [0, 0]), lit ? WARM : DARK, nn);
      const fc = o.fc || LIGHT;
      wbox(B.stone, F, u - hw - 0.3, u - hw, y - 0.1, yt, 0, 0.2, fc, 'tb'); wbox(B.stone, F, u + hw, u + hw + 0.3, y - 0.1, yt, 0, 0.2, fc, 'tb');
      wbox(B.stone, F, u - hw - 0.4, u + hw + 0.4, y - 0.28, y - 0.08, 0, 0.36, fc, 'b');
      if (arch) { for (let k = 0; k < 5; k++) { const a0 = Math.PI * k / 5, a1 = Math.PI * (k + 1) / 5, r0 = hw, r1 = hw + 0.3; poly(B.stone, [P(u + r0 * Math.cos(a0), yt + r0 * Math.sin(a0), 0.12), P(u + r1 * Math.cos(a0), yt + r1 * Math.sin(a0), 0.12), P(u + r1 * Math.cos(a1), yt + r1 * Math.sin(a1), 0.12), P(u + r0 * Math.cos(a1), yt + r0 * Math.sin(a1), 0.12)], [[0, 0], [0, 1], [1, 1], [1, 0]], k % 2 ? fc : cMul(fc, 0.86), nn); } }
      else wbox(B.stone, F, u - hw - 0.3, u + hw + 0.3, yt, yt + 0.28, 0, 0.2, fc, 'b');
      if (!o.noBar) wbox(B.trim, F, u - 0.04, u + 0.04, y, yt + (arch ? hw * 0.5 : 0), 0.02, 0.07, IRON, 'tb');
    };
    const slit = (F, u, y, h = 1.5, w = 0.24) => { const P = F.p; poly(B.glass, [P(u - w / 2, y, 0.03), P(u + w / 2, y, 0.03), P(u + w / 2, y + h, 0.03), P(u - w / 2, y + h, 0.03)], [[0, 0], [0, 0], [0, 0], [0, 0]], DARK, [F.n[0], 0, F.n[1]]); wbox(B.stone, F, u - w / 2 - 0.12, u + w / 2 + 0.12, y - 0.08, y + h + 0.08, 0, 0.08, LIGHT, 'tb'); };
    // an arched door: oak planks with iron straps and studs, stone surround. y0 = floor
    const doorAt = (F, u, y0, w, h, o = {}) => {
      const hw = w / 2, yt = y0 + h - hw, nn = [F.n[0], 0, F.n[1]], P = F.p, col = o.col || OAK;
      const pts = [P(u - hw, y0, 0.08), P(u + hw, y0, 0.08)]; for (let k = 0; k <= 6; k++) { const th = Math.PI * k / 6; pts.push(P(u + hw * Math.cos(th), yt + hw * Math.sin(th), 0.08)); }
      poly(B.wood, pts, pts.map(p => [p[1] * 0.9, (p[0] + p[2]) * 0.9]), col, nn);
      for (let k = 0; k < 6; k++) { const a0 = Math.PI * k / 6, a1 = Math.PI * (k + 1) / 6, r0 = hw, r1 = hw + 0.45; poly(B.stone, [P(u + r0 * Math.cos(a0), yt + r0 * Math.sin(a0), 0.14), P(u + r1 * Math.cos(a0), yt + r1 * Math.sin(a0), 0.14), P(u + r1 * Math.cos(a1), yt + r1 * Math.sin(a1), 0.14), P(u + r0 * Math.cos(a1), yt + r0 * Math.sin(a1), 0.14)], [[0, 0], [0, 1], [1, 1], [1, 0]], k % 2 ? LIGHT : cMul(LIGHT, 0.84), nn); }
      wbox(B.stone, F, u - hw - 0.45, u - hw, y0, yt, 0, 0.22, LIGHT, 'tb'); wbox(B.stone, F, u + hw, u + hw + 0.45, y0, yt, 0, 0.22, LIGHT, 'tb');
      wbox(B.trim, F, u - 0.03, u + 0.03, y0, yt + hw * 0.9, 0.08, 0.14, cMul(OAK, 0.4), 'tb');                         // the join of the two leaves
      if (!low) for (const yy of [y0 + h * 0.2, y0 + h * 0.55]) { wbox(B.trim, F, u - hw, u + hw, yy, yy + 0.2, 0.09, 0.15, IRON, 'tb'); for (let s = -hw + 0.25; s < hw; s += 0.5) wbox(B.trim, F, u + s - 0.05, u + s + 0.05, yy + 0.05, yy + 0.15, 0.15, 0.2, [0.3, 0.3, 0.32], 'tb'); }
    };
    const torch = (x, y, z, ox, oz) => {                                                  // iron bracket on a wall facing (ox,oz) and a flame
      obox(B.trim, x + ox * 0.35, z + oz * 0.35, ox, oz, 0.7, 0.1, y, y + 0.1, IRON, { tile: 1 }); obox(B.trim, x + ox * 0.62, z + oz * 0.62, 1, 0, 0.2, 0.2, y - 0.1, y + 0.5, IRON, { tile: 1 });
      const fx = x + ox * 0.62, fz = z + oz * 0.62, n = 5;
      for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, A = B.glass.v(fx + Math.cos(a0) * 0.16, y + 0.5, fz + Math.sin(a0) * 0.16, 0, 0, [1, 0.5, 0.1]), Bq = B.glass.v(fx + Math.cos(a1) * 0.16, y + 0.5, fz + Math.sin(a1) * 0.16, 0, 0, [1, 0.5, 0.1]), T = B.glass.v(fx, y + 1.15, fz, 0, 0, [1, 0.9, 0.4]); B.glass.tri(A, Bq, T); B.glass.tri(A, T, Bq); }
    };

    /* ---- roofs ---- */
    // gabled roof on a building: T maps local (x, z) to world; hw/hd half sizes; ridge along local x (axisX) or z; steep slate / tile / thatch
    const gable = (rb, wb, K, hw, hd, y, rise, ov, axisX, col, gcol, o = {}) => {
      const T = K.T, P3 = (x, z, yy) => { const w = T(x, z); return [w[0], yy, w[1]]; }, tile = 3;
      const a = axisX ? hw : hd, c = axisX ? hd : hw, e = a + 0.55, cc = c + ov, mk = (aa, ccc) => axisX ? [aa, ccc] : [ccc, aa];
      const q = (p0, p1, p2, p3, out) => poly(rb, [p0, p1, p2, p3], [[0, 0], [(e * 2) / tile, 0], [(e * 2) / tile, Math.hypot(cc, rise) / tile], [0, Math.hypot(cc, rise) / tile]], col, out);
      for (const sd of [-1, 1]) {
        const e0 = mk(-e, sd * cc), e1 = mk(e, sd * cc), r1 = mk(e, 0), r0 = mk(-e, 0), nrm = K.D(axisX ? 0 : sd, 0, axisX ? sd : 0);
        const p0 = P3(...e0, y), p1 = P3(...e1, y), p2 = P3(...r1, y + rise), p3 = P3(...r0, y + rise);
        poly(rb, [p0, p1, p2, p3], [[0, 0], [e * 2 / tile, 0], [e * 2 / tile, Math.hypot(cc, rise) / tile], [0, Math.hypot(cc, rise) / tile]], col, [nrm[0], 0.7, nrm[2]]);
        poly(rb, [p1, p0, P3(...mk(-e, sd * (cc - 0.25)), y - 0.25), P3(...mk(e, sd * (cc - 0.25)), y - 0.25)], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], cMul(col, 0.55), [-nrm[0], -0.5, -nrm[2]]);     // underside lip
      }
      // gable ends (wall colour), ridge
      for (const sd of [-1, 1]) { const m = mk(sd * a, -c), n2 = mk(sd * a, c), mid = mk(sd * a, 0), no = K.D(axisX ? sd : 0, 0, axisX ? 0 : sd); poly(wb, [P3(...m, y), P3(...n2, y), P3(...mid, y + rise * (c / cc))], [[m[0] / TL, y / TL], [n2[0] / TL, y / TL], [mid[0] / TL, (y + rise) / TL]], gcol, no); }
      if (!o.noRidge) { const w0 = T(...mk(-e, 0)), w1 = T(...mk(e, 0)), dx = w1[0] - w0[0], dz = w1[1] - w0[1], l = Math.hypot(dx, dz); obox(B.stone, (w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2, dx / l, dz / l, l, 0.5, y + rise - 0.1, y + rise + 0.25, cMul(col, 0.85), { tile: 2 }); }
    };
    const frameOf = (b) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw); return { T: (x, z) => [b.x + x * c + z * s, b.z - x * s + z * c], D: (x, y, z) => [x * c + z * s, y, -x * s + z * c], c, s }; };
    const sideFrame = (b, K, side) => {                                                     // a wall frame of the building: f (+z) r (+x) k (-z) l (-x)
      const hw = b.w / 2, hd = b.d / 2, T = K.T;
      const s = { f: [[-hw, hd], [hw, hd], [0, 1]], r: [[hw, hd], [hw, -hd], [1, 0]], k: [[hw, -hd], [-hw, -hd], [0, -1]], l: [[-hw, -hd], [-hw, hd], [-1, 0]] }[side];
      const p0 = T(...s[0]), p1 = T(...s[1]), nn = K.D(s[2][0], 0, s[2][1]);
      return wframe(p0[0], p0[1], p1[0], p1[1], nn[0], nn[2]);
    };
    // the walls of a building: stone from the ground with moss at the foot (+ optional upper half in another builder)
    const walls = (b, K, o = {}) => {
      const hw = b.w / 2, hd = b.d / 2, top = lvl + b.h, col = o.col || stoneCol(o.tone || 0.88, lvl), cs = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(p => K.T(...p));
      for (let k = 0; k < 4; k++) { const A = cs[k], Bq = cs[(k + 1) % 4]; vstrip(o.b || B.stone, A[0], A[1], Bq[0], Bq[1], base, o.yTop != null ? o.yTop : top, (A[0] + Bq[0]) / 2 - b.x, (A[1] + Bq[1]) / 2 - b.z, col, { splits: MS, u0: k * 5.3 }); }
      return cs;
    };
    const buttress = (F, u, hgt, wd = 1.3, pr = 0.9, col = LIGHT) => { wbox(B.stone, F, u - wd / 2, u + wd / 2, base, lvl + hgt - 0.9, 0, pr, col, 't'); const P = F.p, y = lvl + hgt - 0.9;
      poly(B.stone, [P(u - wd / 2, y, pr), P(u + wd / 2, y, pr), P(u + wd / 2, y + 0.9, 0.1), P(u - wd / 2, y + 0.9, 0.1)], [[0, 0], [1, 0], [1, 1], [0, 1]], col, [F.n[0], 0.9, F.n[1]]);
      poly(B.stone, [P(u - wd / 2, y, 0), P(u - wd / 2, y, pr), P(u - wd / 2, y + 0.9, 0.1)], [[0, 0], [1, 0], [0, 1]], col, [-F.ax[0], 0, -F.ax[1]]); poly(B.stone, [P(u + wd / 2, y, pr), P(u + wd / 2, y, 0), P(u + wd / 2, y + 0.9, 0.1)], [[0, 0], [1, 0], [0, 1]], col, [F.ax[0], 0, F.ax[1]]); };
    // crenellated parapet round a convex footprint (oriented rectangle), merlons on top
    const crenel = (cx, cz, tx, tz, len, wid, yTop, step, col, rise = 1.15, mh = 1.2, one = false) => {
      const nx = -tz, nz = tx, sds = one ? [0] : [-1, 1];
      for (const sd of sds) { obox(B.stone, cx + nx * sd * (wid / 2 - 0.3), cz + nz * sd * (wid / 2 - 0.3), tx, tz, len, 0.6, yTop, yTop + rise, col, { tile: 2 }); }
      for (let a = step / 2; a < len; a += step) for (const sd of sds) { const s = a - len / 2; obox(B.stone, cx + tx * s + nx * sd * (wid / 2 - 0.3), cz + tz * s + nz * sd * (wid / 2 - 0.3), tx, tz, step * 0.56, 0.7, yTop + rise, yTop + rise + mh, col, { tile: 2 }); }
    };

    /* ================= curtain walls ================= */
    const wallStep = low ? 4.4 : 3.2, wallLen = [];
    L.walls.forEach((w, k) => {
      const dx = w.bx - w.ax, dz = w.bz - w.az, len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len; let nx = -tz, nz = tx;
      const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2; if ((mx - centre[0]) * nx + (mz - centre[1]) * nz < 0) { nx = -nx; nz = -nz; }      // (nx, nz) = away from the courtyard
      const ht = w.thick / 2, T = lvl + w.h, col = STONE(k);
      // body: two faces (outer, inner), the end faces are hidden by towers / gatehouses; walk top
      const o0 = [w.ax + nx * ht, w.az + nz * ht], o1 = [w.bx + nx * ht, w.bz + nz * ht], i0 = [w.ax - nx * ht, w.az - nz * ht], i1 = [w.bx - nx * ht, w.bz - nz * ht];
      vstrip(B.stone, o0[0], o0[1], o1[0], o1[1], base, T, nx, nz, col, { splits: MS, u0: k * 7 });
      vstrip(B.stone, i1[0], i1[1], i0[0], i0[1], base, T, -nx, -nz, col, { splits: MS, u0: k * 7 });
      hcap(B.stone, [o0, o1, i1, i0], T, cMul(LIGHT, 0.92));
      // plinth (batter) on the outer face, string course under the parapet, corbels
      obox(B.stone, (w.ax + w.bx) / 2 + nx * (ht + 0.22), (w.az + w.bz) / 2 + nz * (ht + 0.22), tx, tz, len, 0.44, base, lvl + 1.7, cMul(col(lvl + 3), 0.9), { splits: MS, top: true });
      obox(B.stone, (w.ax + w.bx) / 2 + nx * (ht + 0.12), (w.az + w.bz) / 2 + nz * (ht + 0.12), tx, tz, len, 0.24, T - 1.1, T - 0.5, LIGHT);
      if (!low) for (let a = 1.4; a < len - 1; a += 2.4) obox(B.stone, w.ax + tx * a + nx * (ht + 0.2), w.az + tz * a + nz * (ht + 0.2), tx, tz, 0.5, 0.4, T - 1.9, T - 1.1, LIGHT);
      // battlement both sides, arrow slits (outer face) and a few on the inner side
      crenel((w.ax + w.bx) / 2, (w.az + w.bz) / 2, tx, tz, len, w.thick, T, wallStep, cMul(LIGHT, 0.95), 1.0, 1.3);
      const Fo = wframe(o0[0], o0[1], o1[0], o1[1], nx, nz);
      for (let u = 8 + (k * 3) % 5; u < len - 6; u += 11) slit(Fo, u, lvl + 4.6, 1.7);
      wallLen.push(len);
    });

    /* ================= towers ================= */
    L.towers.forEach((t, k) => {
      const T = lvl + t.h, r = t.r, N = low ? 12 : 20, col = STONE(k + 5), tint = t.kind === 'gate' ? SLATE2 : t.kind === 'corner' ? SLATE : VERD;
      lathe(B.stone, t.x, t.z, [[r, base], [r, lvl - 1.4], [r, lvl + 0.5], [r, lvl + 2.2], [r, lvl + 4.4], [r, T - 2.4], [r + 0.55, T - 1.4], [r + 0.55, T]], N, col);
      hcap(B.stone, ngonPts(t.x, t.z, r + 0.55, N), T, cMul(LIGHT, 0.9));
      // arrow slits round the shaft, a window under the roof
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * 6.2832 + k, nx = Math.cos(a), nz = Math.sin(a);
        const Ft = { len: 1, ax: [-nz, nx], n: [nx, nz], p: (u, y, w) => [t.x + nx * (r + w) - nz * u, y, t.z + nz * (r + w) + nx * u] };
        slit(Ft, 0, lvl + 5 + (i % 2) * 2.5, 1.6); if (t.h > 15 && i % 2 === 0) windowAt(Ft, 0, T - 5.2, 0.9, 2.2, { fc: LIGHT, lit: (k + i) % 3 === 0 });
      }
      if (t.kind === 'mid') {
        for (let i = 0; i < Math.round(6.2832 * r / 2.7); i++) { const a = i / Math.round(6.2832 * r / 2.7) * 6.2832, nx = Math.cos(a), nz = Math.sin(a); obox(B.stone, t.x + nx * (r + 0.2), t.z + nz * (r + 0.2), -nz, nx, 1.5, 0.75, T, T + 2.3, cMul(LIGHT, 0.95), { tile: 2 }); }
        if (!low) pole(t.x, T, t.z, 4.5, k);
      } else {
        const rise = r * (t.kind === 'gate' ? 2.2 : 1.9), rr = r + 0.9;
        lathe(B[t.kind === 'gate' ? 'clay' : 'slate'], t.x, t.z, [[rr, T - 0.05], [rr - 0.25, T + rise * 0.06], [r * 0.82, T + rise * 0.3], [r * 0.5, T + rise * 0.6], [r * 0.22, T + rise * 0.86], [0.05, T + rise]], N, tint, { up: 0.5, tile: 3 });
        hcap(B.trim, ngonPts(t.x, t.z, rr, N), T - 0.05, cMul(OAK, 0.6), false, 2);
        pole(t.x, T + rise - 0.2, t.z, 3.4, k + 40);
        if (!low) obox(B.trim, t.x, t.z, 1, 0, 0.5, 0.5, T + rise - 0.55, T + rise - 0.1, [0.9, 0.72, 0.22], { tile: 1 });
      }
    });

    /* ================= gatehouses ================= */
    const bridges = [];
    for (const g of L.gatehouses) {
      const fx = Math.sin(g.th), fz = Math.cos(g.th), rx = -Math.cos(g.th), rz = Math.sin(g.th), d = g.depth / 2, out = g.which === 1 ? -1 : 1, T = lvl + g.h, col = STONE(g.which * 11);
      const G = (a, l) => [g.x + fx * a + rx * l, g.z + fz * a + rz * l], H = g.half;
      const cpt = 0.9, RA = H + cpt, spring = lvl + g.passageH - Math.sqrt(RA * RA - cpt * cpt);            // pointed arch: two arcs of radius RA, centres cpt either side of the middle
      const archY = l => spring + Math.sqrt(Math.max(0, RA * RA - (Math.abs(l) + cpt) * (Math.abs(l) + cpt)));
      const NA = 16, ls = Array.from({ length: NA + 1 }, (_, i) => -H + 2 * H * i / NA);
      const fr = a => ({ a, o: Math.sign(a) });                                          // a face plane at depth a
      for (const pl of [d, -d]) {
        const so = Math.sign(pl), nf = [fx * so, 0, fz * so];
        // block faces (front and back of each block), tympanum above the arch, voussoir ring
        for (const sd of [-1, 1]) { const A = G(pl, sd * H), Bq = G(pl, sd * (H + g.blockW)); vstrip(B.stone, A[0], A[1], Bq[0], Bq[1], base, T, nf[0], nf[2], col, { splits: MS, u0: sd > 0 ? 0 : 9 }); }
        for (let i = 0; i < NA; i++) { const A = G(pl, ls[i]), Bq = G(pl, ls[i + 1]); poly(B.stone, [[A[0], archY(ls[i]), A[1]], [Bq[0], archY(ls[i + 1]), Bq[1]], [Bq[0], T, Bq[1]], [A[0], T, A[1]]], [[ls[i] / TL, archY(ls[i]) / TL], [ls[i + 1] / TL, archY(ls[i + 1]) / TL], [ls[i + 1] / TL, T / TL], [ls[i] / TL, T / TL]], col(lvl + 8), nf); }
        const SO = 0.05;
        for (let i = 0; i < 18; i++) {                                                  // voussoir ring: alternating stones round the pointed arch
          const side = i < 9 ? 1 : -1, k = i % 9, f0 = Math.acos(Math.min(1, cpt / RA)) * k / 9, f1 = Math.acos(Math.min(1, cpt / RA)) * (k + 1) / 9, ph = Math.acos(cpt / RA);
          const pt = (f, rad) => { const l = side * (-cpt + rad * Math.cos(f)), y = spring + rad * Math.sin(f), q = G(pl + so * SO, l); return [q[0], y, q[1]]; };
          poly(B.stone, [pt(f0, RA), pt(f0, RA + 0.95), pt(f1, RA + 0.95), pt(f1, RA)], [[0, 0], [0, 0.3], [0.3, 0.3], [0.3, 0]], (i % 2 ? [1.0, 0.97, 0.9] : [0.8, 0.78, 0.74]), nf);
        }
        // string course and corbelled overhang at the top of the block, merlons
        if (!low) for (let l = -(H + g.blockW) + 0.6; l < H + g.blockW; l += 1.5) { if (Math.abs(l) < H + 1.0 && Math.abs(l) > 0) { } const A = G(pl + so * 0.22, l); obox(B.stone, A[0], A[1], rx, rz, 0.55, 0.4, T - 2.6, T - 1.1, LIGHT, { tile: 2 }); }
        const mid = G(pl + so * 0.22, 0); obox(B.stone, mid[0], mid[1], rx, rz, 2 * (H + g.blockW), 0.45, T - 1.1, T - 0.4, LIGHT);
        // portcullis: a raised iron grid, its teeth show below the arch. Only on the outer plane (a = out * (d - 1.8))
      }
      // intrados and tunnel walls (the passage)
      for (let i = 0; i < NA; i++) {
        const A = ls[i], Bq = ls[i + 1], a0 = G(-d, A), b0 = G(-d, Bq), a1 = G(d, A), b1 = G(d, Bq), lm = (A + Bq) / 2;
        poly(B.stone, [[a0[0], archY(A), a0[1]], [a1[0], archY(A), a1[1]], [b1[0], archY(Bq), b1[1]], [b0[0], archY(Bq), b0[1]]], [[0, 0], [d * 2 / TL, 0], [d * 2 / TL, 0.3], [0, 0.3]], cMul(col(lvl + 9), 0.8), [rx * (-lm / H) * 0.6, -1, rz * (-lm / H) * 0.6]);
      }
      for (const sd of [-1, 1]) { const A = G(-d, sd * H), Bq = G(d, sd * H); vstrip(B.stone, A[0], A[1], Bq[0], Bq[1], base, spring, -rx * sd, -rz * sd, cMul(col(lvl + 5), 0.85), { splits: MS }); }
      // block outer sides, tops and the merlons round the top
      for (const sd of [-1, 1]) {
        const A = G(-d, sd * (H + g.blockW)), Bq = G(d, sd * (H + g.blockW)); vstrip(B.stone, A[0], A[1], Bq[0], Bq[1], base, T, rx * sd, rz * sd, col, { splits: MS, u0: 4 });
        const c = [G(-d, sd * H), G(d, sd * H), G(d, sd * (H + g.blockW)), G(-d, sd * (H + g.blockW))]; hcap(B.stone, c, T, cMul(LIGHT, 0.9));
      }
      hcap(B.stone, [G(-d, -H), G(d, -H), G(d, H), G(-d, H)], T, cMul(LIGHT, 0.9));
      for (const sd of [-1, 1]) { const m = G(0, sd * (H + g.blockW / 2)); crenel(m[0], m[1], fx, fz, g.depth, g.blockW, T, wallStep, cMul(LIGHT, 0.95), 0.0001, 1.5); }
      { const m = G(0, 0); for (const s2 of [-1, 1]) { const q = G(s2 * (d - 0.35), 0); obox(B.stone, q[0], q[1], rx, rz, 2 * (H + g.blockW), 0.7, T, T + 1.0, cMul(LIGHT, 0.95), { tile: 2 }); for (let l = -(H + g.blockW) + 1; l < H + g.blockW; l += 2.4) { const q2 = G(s2 * (d - 0.35), l); obox(B.stone, q2[0], q2[1], rx, rz, 1.4, 0.7, T + 1.0, T + 2.3, cMul(LIGHT, 0.95), { tile: 2 }); } } void m; }
      // ----- portcullis (raised), at the outer plane -----
      { const ap = out * (d - 1.9), bars = [];
        for (let l = -3.6; l <= 3.61; l += 0.6) bars.push(l);
        for (const l of bars) { const q = G(ap, l), y0 = archY(l) - 1.6, y1 = archY(l) + 0.5;
          obox(B.trim, q[0], q[1], rx, rz, 0.13, 0.13, y0, y1, IRON, { tile: 1 });
          const sp = [[q[0] + 0.1 * rx, q[1] + 0.1 * rz], [q[0] + 0.1 * fx, q[1] + 0.1 * fz], [q[0] - 0.1 * rx, q[1] - 0.1 * rz], [q[0] - 0.1 * fx, q[1] - 0.1 * fz]];
          for (let k = 0; k < 4; k++) { const A = sp[k], Bq = sp[(k + 1) % 4]; poly(B.trim, [[A[0], y0, A[1]], [Bq[0], y0, Bq[1]], [q[0], y0 - 0.42, q[1]]], [[0, 0], [1, 0], [0.5, 1]], IRON, [(A[0] + Bq[0]) / 2 - q[0], -0.3, (A[1] + Bq[1]) / 2 - q[1]]); } }
        for (const dy of [-0.35, -1.15]) for (let i = 0; i < bars.length - 1; i++) { const l = (bars[i] + bars[i + 1]) / 2, q = G(ap, l); obox(B.trim, q[0], q[1], rx, rz, 0.6, 0.12, archY(l) + dy, archY(l) + dy + 0.14, IRON, { tile: 1 }); } }
      // ----- gate leaves swung open against the block faces, torches, banners and a crest -----
      for (const pl of [out * d, -out * d]) {
        const so = Math.sign(pl), nf = [fx * so, 0, fz * so], P = (l, y, a) => { const q = G(pl + so * a, l); return [q[0], y, q[1]]; };
        for (const sd of [-1, 1]) {
          const NS = 8, topAt = lo => archY(H - (Math.abs(lo) - H));
          for (let i = 0; i < NS; i++) {
            const l0 = sd * (H + 4.4 * i / NS), l1 = sd * (H + 4.4 * (i + 1) / NS), t0 = topAt(l0), t1 = topAt(l1);
            poly(B.wood, [P(l0, lvl, 0.18), P(l1, lvl, 0.18), P(l1, t1, 0.18), P(l0, t0, 0.18)], [[lvl * 0.9, i * 0.5], [lvl * 0.9, (i + 1) * 0.5], [t1 * 0.9, (i + 1) * 0.5], [t0 * 0.9, i * 0.5]], OAK, nf);
          }
          if (!low) for (let k = 0; k < 3; k++) {
            const yb = lvl + 0.8 + k * 1.5, lenL = 4.3 * Math.min(1, 0.5 + k * 0.25), qm = G(pl + so * 0.27, sd * (H + lenL / 2 + 0.05));
            obox(B.trim, qm[0], qm[1], rx, rz, lenL, 0.1, yb, yb + 0.26, IRON, { tile: 1 });
            for (let s2 = 0.4; s2 < lenL; s2 += 0.55) { const qs = G(pl + so * 0.3, sd * (H + s2)); obox(B.trim, qs[0], qs[1], rx, rz, 0.13, 0.13, yb + 0.07, yb + 0.2, [0.32, 0.32, 0.34], { tile: 1 }); }
          }
          // torch beside the arch
          const q = G(pl + so * 0.3, sd * (H + 0.9)); torch(q[0], lvl + 5.4, q[1], nf[0], nf[2]);
          // a hanging banner (waves) and the crest in the middle
          const bq = G(pl + so * 0.32, sd * (H + 2.9)); FL.banner(bq[0], lvl + 11.2, bq[1], [rx * sd, rz * sd], [nf[0], nf[2]], 2.6, 4.6, sd > 0 ? BAN.A : BAN.B, 0.3); flagN++;
          obox(B.trim, bq[0] + nf[0] * 0.1, bq[1] + nf[2] * 0.1, rx, rz, 3.0, 0.14, lvl + 11.2, lvl + 11.5, OAK, { tile: 1 });
        }
        const cq = G(pl + so * 0.12, 0); FL.banner(cq[0], lvl + 11.3, cq[1], [rx, rz], [nf[0], nf[2]], 2.4, 2.9, BAN.A, 0); flagN++;
        // windows over the arch
        const Fw = wframe(...G(pl, -H), ...G(pl, H), nf[0], nf[2]);
        void Fw;
      }
      // gate tower banners and wall torches
      for (const sd of [-1, 1]) {
        const tq = G(0, sd * g.towerAt); const dir = [fx * out, fz * out];
        FL.banner(tq[0] + dir[0] * (4.95), lvl + 15.4, tq[1] + dir[1] * 4.95, [rx * sd, rz * sd], dir, 2.0, 5.2, BAN.B, 0.2); flagN++;
      }
      // bridge: timber posts, rails and beams over the causeway on the outer side (look only)
      bridges.push({ g, G, out, fx, fz, rx, rz, d });
    }

    /* ================= courtyard buildings ================= */
    const houses = [];
    for (const b of L.buildings) {
      if (b.builder === 'house') { houses.push({ x: b.x, y: terrain.heightAt(b.x, b.z) + 0.3, z: b.z, yaw: b.yaw, w: b.w, d: b.d, h: b.h, style: 'stone', tint: b.kind === 'gatekeeper' ? [1, 0.9, 0.78] : [1, 0.94, 0.84], roof: b.roof }); continue; }
      const K = frameOf(b), hw = b.w / 2, hd = b.d / 2, top = lvl + b.h, kk = b.x * 0.1 + b.z * 0.07;
      if (b.kind === 'keep') {
        walls(b, K, { tone: 0.9 });
        const F = { f: sideFrame(b, K, 'f'), r: sideFrame(b, K, 'r'), k: sideFrame(b, K, 'k'), l: sideFrame(b, K, 'l') };
        for (const s of 'frkl') { const f = F[s], n = f.len;
          for (const y of [lvl + 9.6, lvl + 18.4]) wbox(B.stone, f, 0, n, y, y + 0.5, 0, 0.35, LIGHT, 'b');                      // string courses
          for (const u of [n * 0.2, n * 0.8, n * 0.5]) { if (s === 'f' && u === n * 0.5) continue; for (let lv = 0; lv < 3; lv++) windowAt(f, u, lvl + 6.2 + lv * 6.9 + (lv === 0 ? 0 : 0.6), 1.3, 3.4, { lit: hsh(u + lv, kk) < 0.25 }); }
          if (!low) for (const u of [n * 0.35, n * 0.65]) buttress(f, u, 28, 1.4, 1.0);
        }
        doorAt(F.f, F.f.len / 2, lvl, 3.6, 5.6);
        for (let i = 0; i < 4; i++) wbox(B.stone, F.f, F.f.len / 2 - 2.6 - i * 0.2, F.f.len / 2 + 2.6 + i * 0.2, lvl, lvl + 0.3 * (4 - i), 0.5, 0.5 + 0.55 * (i + 1), LIGHT, 'b');
        // parapet with merlons, four round corner turrets with conical roofs, a pointed slate roof in the middle, flag
        crenel(...K.T(0, hd - 0.4), K.c, -K.s, b.w, 0.0, top, 3, cMul(LIGHT, 0.95), 1.1, 1.3, true); crenel(...K.T(0, -hd + 0.4), K.c, -K.s, b.w, 0.0, top, 3, cMul(LIGHT, 0.95), 1.1, 1.3, true);
        crenel(...K.T(hw - 0.4, 0), K.s, K.c, b.d, 0.0, top, 3, cMul(LIGHT, 0.95), 1.1, 1.3, true); crenel(...K.T(-hw + 0.4, 0), K.s, K.c, b.d, 0.0, top, 3, cMul(LIGHT, 0.95), 1.1, 1.3, true);
        void 0;
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const c = K.T(sx * hw, sz * hd), r = 2.6, tt = top + 5.5;
          lathe(B.stone, c[0], c[1], [[r, base], [r, lvl + 0.5], [r, lvl + 3], [r, tt - 1.2], [r + 0.5, tt - 0.6], [r + 0.5, tt]], 14, STONE(sx * 3 + sz), {});
          const rise = 8.2; lathe(B.slate, c[0], c[1], [[r + 0.85, tt], [r + 0.6, tt + rise * 0.07], [r * 0.8, tt + rise * 0.32], [r * 0.45, tt + rise * 0.62], [r * 0.18, tt + rise * 0.86], [0.05, tt + rise]], 14, VERD, { up: 0.5, tile: 3 });
          hcap(B.trim, ngonPts(c[0], c[1], r + 0.85, 14), tt - 0.02, cMul(OAK, 0.6), false, 2); pole(c[0], tt + rise - 0.2, c[1], 3, sx * 7 + sz + 30);
        }
        { const c = K.T(0, 0), rise = 7.2; for (let k = 0; k < 4; k++) { const A = K.T(...[[-1, -1], [1, -1], [1, 1], [-1, 1]][k].map((v, i) => v * (i ? hd - 2.6 : hw - 2.6))), Bq = K.T(...[[-1, -1], [1, -1], [1, 1], [-1, 1]][(k + 1) % 4].map((v, i) => v * (i ? hd - 2.6 : hw - 2.6))); const mx = (A[0] + Bq[0]) / 2 - c[0], mz = (A[1] + Bq[1]) / 2 - c[1];
            poly(B.slate, [[A[0], top + 1.2, A[1]], [Bq[0], top + 1.2, Bq[1]], [c[0], top + 1.2 + rise, c[1]]], [[0, 0], [b.w / 3, 0], [b.w / 6, rise / 3]], SLATE, [mx, 0.8, mz]); }
          pole(c[0], top + 1.2 + rise - 0.2, c[1], 5.5, 77); }
        const bq = K.T(0, hd + 0.25); FL.banner(bq[0], lvl + 22.4, bq[1], [K.c, -K.s], [K.s, K.c], 3.2, 8.5, BAN.A, 0.3); flagN++;
        void F;
      } else if (b.kind === 'hall') {
        walls(b, K, { tone: 0.9 });
        const f = sideFrame(b, K, 'f'), bk = sideFrame(b, K, 'k'), le = sideFrame(b, K, 'l'), ri = sideFrame(b, K, 'r');
        for (const [F, nn] of [[f, 0], [bk, 1]]) {
          wbox(B.stone, F, 0, F.len, lvl, lvl + 1.0, 0, 0.3, cMul(LIGHT, 0.9), 'b');
          for (let u = 3; u < F.len - 2; u += 6) { buttress(F, u, b.h + 0.6, 1.1, 0.8); if (u + 3 < F.len - 1) windowAt(F, u + 3, lvl + 3.4, 1.3, 4.4, { lit: hsh(u, kk + nn) < 0.2 }); }
        }
        doorAt(f, f.len / 2, lvl, 3.4, 5.4);
        for (const F of [le, ri]) { windowAt(F, F.len / 2, lvl + 3.4, 1.4, 4.6); windowAt(F, F.len / 2 - 3.6, lvl + 3.4, 1.2, 4.2); windowAt(F, F.len / 2 + 3.6, lvl + 3.4, 1.2, 4.2); }
        gable(B.slate, B.stone, K, hw, hd, top, hd * 0.82, 0.8, true, SLATE, cMul(LIGHT, 0.88));
        // rose windows in the gable ends
        for (const sd of [-1, 1]) { const q = K.T(sd * (hw + 0.04), 0), nn = K.D(sd, 0, 0); const cy = top + 4.2, n = 12; const pts = Array.from({ length: n }, (_, i) => { const a = i / n * 6.2832, d2 = K.D(0, 0, Math.cos(a) * 1.1); return [q[0] + d2[0], cy + Math.sin(a) * 1.1, q[1] + d2[2]]; }); poly(B.glass, pts, pts.map(() => [0, 0]), DARK, nn);
          for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, d0 = K.D(0, 0, Math.cos(a0) * 1.1), d1 = K.D(0, 0, Math.cos(a1) * 1.1), e0 = K.D(0, 0, Math.cos(a0) * 1.5), e1 = K.D(0, 0, Math.cos(a1) * 1.5), P = (dd, rr, a) => [q[0] + dd[0] + nn[0] * 0.05, cy + Math.sin(a) * rr, q[1] + dd[2] + nn[2] * 0.05]; poly(B.stone, [P(d0, 1.1, a0), P(e0, 1.5, a0), P(e1, 1.5, a1), P(d1, 1.1, a1)], [[0, 0], [0, 1], [1, 1], [1, 0]], i % 2 ? LIGHT : cMul(LIGHT, 0.85), nn); } }
        const bq = K.T(hw + 0.3, 0); void bq;
        const bf = K.T(-hw + 9, hd + 0.3); FL.banner(bf[0], lvl + 10.4, bf[1], [K.c, -K.s], [K.s, K.c], 2.2, 3.8, BAN.B, 0.25); flagN++;
        // louvre on the ridge
        { const c = K.T(0, 0), y = top + hd * 0.82; obox(B.wood, c[0], c[1], K.c, -K.s, 2.4, 1.6, y - 0.2, y + 1.6, OAK, { tile: 1 }); lathe(B.slate, c[0], c[1], [[1.5, y + 1.6], [0.9, y + 2.4], [0.05, y + 3.6]], 4, SLATE, { up: 0.5, tile: 3 }); }
      } else if (b.kind === 'stable') {
        const stoneH = 2.2; walls(b, K, { tone: 0.84, yTop: lvl + stoneH });
        const hw2 = hw, cs = [[-hw2, -hd], [hw2, -hd], [hw2, hd], [-hw2, hd]].map(p => K.T(...p));
        for (let k = 0; k < 4; k++) { const A = cs[k], Bq = cs[(k + 1) % 4]; vstrip(B.wood, A[0], A[1], Bq[0], Bq[1], lvl + stoneH, top, (A[0] + Bq[0]) / 2 - b.x, (A[1] + Bq[1]) / 2 - b.z, [0.78, 0.64, 0.5], { tile: 2, u0: k * 3 }); }
        const f = sideFrame(b, K, 'f'), bk = sideFrame(b, K, 'k');
        for (const F of [f, bk]) for (let u = 3.0; u < F.len - 1; u += 4.5) wbox(B.trim, F, u - 0.12, u + 0.12, lvl, top, 0, 0.26, OAK, 't');                // posts
        for (let i = 0; i < 4; i++) {
          const u = 4.5 + i * 8.5; if (u > f.len - 3) break; const P = f.p;
          poly(B.wood, [P(u - 1.5, lvl, 0.12), P(u + 1.5, lvl, 0.12), P(u + 1.5, lvl + 3.5, 0.12), P(u - 1.5, lvl + 3.5, 0.12)], [[0, 0], [3, 0], [3, 3.5], [0, 3.5]], [0.62, 0.46, 0.3], [f.n[0], 0, f.n[1]]);
          wbox(B.trim, f, u - 1.5, u + 1.5, lvl + 3.5, lvl + 3.75, 0, 0.3, OAK, 'b'); wbox(B.trim, f, u - 0.04, u + 0.04, lvl, lvl + 3.5, 0.12, 0.2, cMul(OAK, 0.4), 'tb');
          for (const sd of [-1, 1]) { wbox(B.trim, f, u + sd * 0.8 - 0.07, u + sd * 0.8 + 0.07, lvl + 0.1, lvl + 3.4, 0.12, 0.2, OAK, 'tb'); }
          // hay bales and a trough in front of the doors
          if (i % 2 === 0) for (let k = 0; k < 3; k++) { const q = K.T(-hw + u + (k - 1) * 1.1 + 0.2, hd + 1.2 + (k % 2) * 0.2); obox(B.trim, q[0], q[1], K.c, -K.s, 1.0, 0.65, lvl, lvl + 0.5 + (k === 1 ? 0.5 : 0), [0.86, 0.7, 0.36], { tile: 1 }); }
        }
        // hayloft hatch up in the gable
        gable(B.thatch, B.wood, K, hw, hd, top, hd * 0.62, 0.9, true, [1, 0.95, 0.85], [0.78, 0.64, 0.5]);
        for (const sd of [-1, 1]) { const q = K.T(sd * (hw + 0.05), 0), nn = K.D(sd, 0, 0), P = (z, y) => [q[0] + K.D(0, 0, z)[0], y, q[1] + K.D(0, 0, z)[2]]; poly(B.glass, [P(-0.6, top + 0.8), P(0.6, top + 0.8), P(0.6, top + 2.2), P(-0.6, top + 2.2)], [[0, 0], [0, 0], [0, 0], [0, 0]], [0.1, 0.07, 0.04], nn); }
      } else if (b.kind === 'chapel') {
        walls(b, K, { tone: 0.92 });
        const f = sideFrame(b, K, 'f'), le = sideFrame(b, K, 'l'), ri = sideFrame(b, K, 'r');
        for (const F of [le, ri]) { for (let u = 2.5; u < F.len - 1; u += 4.2) { buttress(F, u - 1.0, b.h + 0.3, 0.9, 0.7); windowAt(F, u + 1.1, lvl + 2.8, 1.1, 4.0); } }
        doorAt(f, f.len / 2, lvl, 2.6, 4.4);
        const ge = hw, ry = top + hd * 0.0;
        gable(B.slate, B.stone, K, hw, hd, top, hw * 1.25, 0.6, false, SLATE, cMul(LIGHT, 0.9));
        // rose window over the door, belfry on the front gable
        { const q = K.T(0, hd + 0.05), nn = K.D(0, 0, 1), cy = top + 2.3, n = 12; const pts = Array.from({ length: n }, (_, i) => { const a = i / n * 6.2832, d2 = K.D(Math.cos(a) * 0.9, 0, 0); return [q[0] + d2[0], cy + Math.sin(a) * 0.9, q[1] + d2[2]]; }); poly(B.glass, pts, pts.map(() => [0, 0]), DARK, nn); void ge; void ry;
          const peak = top + hw * 1.25, c = K.T(0, hd - 1.6), bw = 1.4;
          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = K.T(sx * bw, hd - 1.6 + sz * bw); obox(B.stone, p[0], p[1], K.c, -K.s, 0.55, 0.55, peak - 0.6, peak + 3.2, cMul(LIGHT, 0.95), { tile: 2 }); }
          obox(B.stone, c[0], c[1], K.c, -K.s, 3.4, 3.4, peak + 3.2, peak + 3.6, LIGHT);
          obox(B.trim, c[0], c[1], K.c, -K.s, 0.8, 0.8, peak + 1.4, peak + 2.3, [0.85, 0.65, 0.22], { tile: 1 });
          lathe(B.slate, c[0], c[1], [[2.6, peak + 3.5], [1.6, peak + 4.7], [0.05, peak + 7.2]], 4, VERD, { up: 0.5, tile: 3 }); pole(c[0], peak + 7, c[1], 2.4, 91); }
      } else if (b.kind === 'barracks') {
        walls(b, K, { tone: 0.86 });
        const f = sideFrame(b, K, 'f'), bk = sideFrame(b, K, 'k');
        for (const F of [f, bk]) { for (let u = 2.4; u < F.len - 1; u += 3.8) { if (F === f && Math.abs(u - F.len / 2) < 2.2) continue; windowAt(F, u, lvl + 3.2, 0.8, 1.5, { arch: false, noBar: true, lit: hsh(u, kk) < 0.18 }); wbox(B.wood, F, u - 0.75, u - 0.45, lvl + 3.1, lvl + 4.8, 0.02, 0.1, [0.28, 0.36, 0.5], 'tb'); wbox(B.wood, F, u + 0.45, u + 0.75, lvl + 3.1, lvl + 4.8, 0.02, 0.1, [0.28, 0.36, 0.5], 'tb'); } }
        doorAt(f, f.len / 2, lvl, 2.4, 3.8);
        gable(B.clay, B.stone, K, hw, hd, top, hd * 0.72, 0.8, true, [0.95, 0.9, 0.86], cMul(LIGHT, 0.88));
        for (const u of [-14, -3, 12]) { const q = K.T(u, hd * 0.35); obox(B.stone, q[0], q[1], K.c, -K.s, 1.0, 1.0, top, top + hd * 0.72 + 1.8, [0.8, 0.74, 0.68], { tile: 2 }); obox(B.stone, q[0], q[1], K.c, -K.s, 1.35, 1.35, top + hd * 0.72 + 1.8, top + hd * 0.72 + 2.2, LIGHT, { tile: 2 }); }
        const bf = K.T(-hw + 6, hd + 0.2); FL.banner(bf[0], lvl + 6.0, bf[1], [K.c, -K.s], [K.s, K.c], 1.6, 2.6, BAN.A, 0.2); flagN++;
      }
    }
    // the smithy and the gatekeeper's house are real houses (buildings()). Their own call, NOT the village list: merged with the village the mesh would span 1 km and be drawn everywhere
    if (houses.length) buildings(houses);
    // ---- well: a stone ring, bucket, posts, crank beam and a small tiled roof ----
    { const w = L.well, wy = lvl;
      lathe(B.stone, w.x, w.z, [[w.r, lvl - 1], [w.r, lvl + w.h - 0.05], [w.r + 0.35, lvl + w.h - 0.05], [w.r + 0.35, lvl + w.h + 0.2]], 14, [0.9, 0.88, 0.84], {});
      hcap(B.glass, ngonPts(w.x, w.z, w.r, 14), lvl + 0.5, [0.05, 0.08, 0.1], true);
      hcap(B.stone, ngonPts(w.x, w.z, w.r + 0.35, 14), lvl + w.h + 0.2, [0.95, 0.93, 0.88]);
      for (const sd of [-1, 1]) obox(B.trim, w.x + sd * (w.r - 0.1), w.z, 1, 0, 0.3, 0.3, lvl, lvl + 3.4, OAK, { tile: 1 });
      obox(B.trim, w.x, w.z, 1, 0, 2 * w.r + 0.3, 0.22, lvl + 2.6, lvl + 2.8, OAK, { tile: 1 });
      obox(B.trim, w.x + 0.2, w.z, 1, 0, 0.14, 0.14, lvl + 1.0, lvl + 2.6, [0.62, 0.5, 0.3], { tile: 1 });
      obox(B.trim, w.x + 0.2, w.z, 1, 0, 0.5, 0.5, lvl + 0.7, lvl + 1.15, [0.46, 0.33, 0.2], { tile: 1 });
      const K = { T: (x, z) => [w.x + x, w.z + z], D: (x, y, z) => [x, y, z] };
      gable(B.clay, B.wood, K, w.r + 0.7, w.r + 0.5, lvl + 3.4, 1.5, 0.35, true, [1.0, 0.92, 0.86], [0.7, 0.55, 0.4], { noRidge: true });
      void wy; }
    // ---- cobbled courtyard: one flat sheet just under the road (the road keeps its own polygon offset), vertex-tinted patches skipped (the texture carries it) ----
    { const m = 1.2, c = [W2(R.u0 + m, R.v0 + m), W2(R.u1 - m, R.v0 + m), W2(R.u1 - m, R.v1 - m), W2(R.u0 + m, R.v1 - m)];
      poly(B.cob, c.map(p => [p[0], lvl - 0.01, p[1]]), c.map(p => [p[0] / 3.2, p[1] / 3.2]), [1.0, 0.97, 0.9], [0, 1, 0]); }

    /* ================= props along the courtyard edge (look only: far from the road, nothing here is solid) ================= */
    const inFoot = (x, z, m) => { for (const b of L.buildings) { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < b.w / 2 + m && Math.abs(lz) < b.d / 2 + m) return true; } return false; };
    const nearTower = (x, z, m) => L.towers.some(t => Math.hypot(x - t.x, z - t.z) < t.r + m);
    const nearGate = (x, z) => L.gatehouses.some(g => { const dx = x - g.x, dz = z - g.z, a = dx * Math.sin(g.th) + dz * Math.cos(g.th), l = -dx * Math.cos(g.th) + dz * Math.sin(g.th); return Math.abs(a) < g.depth / 2 + 12 && Math.abs(l) < g.half + g.blockW + 14; });
    const barrel = (x, z, s = 1) => { lathe(B.trim, x, z, [[0.38 * s, lvl], [0.46 * s, lvl + 0.35 * s], [0.46 * s, lvl + 0.65 * s], [0.38 * s, lvl + 1.0 * s]], 8, [0.62, 0.45, 0.28], { tile: 1 }); hcap(B.trim, ngonPts(x, z, 0.38 * s, 8), lvl + 1.0 * s, [0.5, 0.36, 0.22], true, 1);
      for (const y of [0.2, 0.8]) lathe(B.trim, x, z, [[(y < 0.5 ? 0.42 : 0.4) * s, lvl + y * s - 0.04], [(y < 0.5 ? 0.435 : 0.415) * s, lvl + y * s - 0.04], [(y < 0.5 ? 0.435 : 0.415) * s, lvl + y * s + 0.05]], 8, IRON, { tile: 1 }); };
    const crate = (x, z, s, yaw, h = 0.8) => obox(B.trim, x, z, Math.cos(yaw), Math.sin(yaw), s, s, lvl, lvl + h, [0.7, 0.54, 0.34], { tile: 1 });
    const hayBale = (x, z, yaw, y = lvl) => obox(B.trim, x, z, Math.cos(yaw), Math.sin(yaw), 1.1, 0.7, y, y + 0.55, [0.88, 0.72, 0.36], { tile: 1 });
    const sack = (x, z) => lathe(B.trim, x, z, [[0.3, lvl], [0.34, lvl + 0.2], [0.26, lvl + 0.55], [0.1, lvl + 0.7]], 6, [0.78, 0.7, 0.52], { tile: 1 });
    const wheel = (cx, y, cz, ax, az, r) => { const n = 10, ux = -az, uz = ax; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; obox(B.trim, cx + ux * Math.cos(a) * r * 0.5, cz + uz * Math.cos(a) * r * 0.5, ax, az, 0.12, 0.1, y + Math.sin(a) * r * 0.5 - 0.05, y + Math.sin(a) * r * 0.5 + 0.05, OAK, { tile: 1, top: false }); } };
    const cart = (x, z, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw);
      obox(B.trim, x, z, c, s, 2.8, 1.5, lvl + 0.55, lvl + 0.75, [0.55, 0.4, 0.26], { tile: 1 });
      for (const sd of [-1, 1]) { obox(B.trim, x - s * sd * 0.72, z + c * sd * 0.72, c, s, 2.8, 0.1, lvl + 0.75, lvl + 1.3, [0.5, 0.36, 0.22], { tile: 1 }); wheel(x - s * sd * 0.85, lvl + 0.55, z + c * sd * 0.85, c, s, 1.1); }
      obox(B.trim, x + c * 2.4, z + s * 2.4, c, s, 2.4, 0.12, lvl + 0.3, lvl + 0.44, OAK, { tile: 1 });
      for (let k = 0; k < 3; k++) hayBale(x + c * (k - 1) * 0.9, z + s * (k - 1) * 0.9, yaw, lvl + 0.75); };
    const stall = (x, z, yaw, k) => {
      const c = Math.cos(yaw), s = Math.sin(yaw), P = (a, b) => [x + c * a - s * b, z + s * a + c * b], cols = [[0.75, 0.2, 0.18], [0.2, 0.42, 0.55], [0.85, 0.65, 0.2], [0.3, 0.5, 0.3]], cc = cols[k % 4];
      for (const [a, b] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.0], [1.6, 1.0]]) { const p = P(a, b); obox(B.trim, p[0], p[1], 1, 0, 0.14, 0.14, lvl, lvl + (b < 0 ? 2.7 : 2.2), OAK, { tile: 1 }); }
      // striped awning sloping forward
      for (let i = 0; i < 6; i++) { const a0 = -1.8 + i * 0.6, a1 = a0 + 0.6, p0 = P(a0, -1.15), p1 = P(a1, -1.15), p2 = P(a1, 1.25), p3 = P(a0, 1.25); poly(B.trim, [[p0[0], lvl + 2.8, p0[1]], [p1[0], lvl + 2.8, p1[1]], [p2[0], lvl + 2.25, p2[1]], [p3[0], lvl + 2.25, p3[1]]], [[0, 0], [0, 0], [0, 1], [0, 1]], i % 2 ? [0.95, 0.92, 0.84] : cc, [0, 1, 0]);
        poly(B.trim, [[p3[0], lvl + 2.25, p3[1]], [p2[0], lvl + 2.25, p2[1]], [p2[0], lvl + 2.0, p2[1] - 0], [p3[0], lvl + 2.0, p3[1]]], [[0, 0], [0, 0], [0, 0], [0, 0]], i % 2 ? [0.95, 0.92, 0.84] : cc, [c * 0 - s * 1, 0, s * 0 + c * 1]); }
      const t = P(0, 0.6); obox(B.trim, t[0], t[1], c, s, 3.0, 0.9, lvl, lvl + 0.95, [0.6, 0.45, 0.3], { tile: 1 });
      for (let i = 0; i < 5; i++) { const q = P(-1.2 + i * 0.6, 0.6); obox(B.trim, q[0], q[1], c, s, 0.42, 0.42, lvl + 0.95, lvl + 1.22, [[0.85, 0.25, 0.2], [0.9, 0.7, 0.2], [0.4, 0.6, 0.25], [0.7, 0.45, 0.2], [0.75, 0.3, 0.5]][i], { tile: 1 }); } };
    const props = [];
    if (!low) {
      const walls2 = L.walls;
      walls2.forEach((w, wi) => {
        const dx = w.bx - w.ax, dz = w.bz - w.az, len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len; let nx = -tz, nz = tx;
        const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2; if ((mx - centre[0]) * nx + (mz - centre[1]) * nz > 0) { nx = -nx; nz = -nz; }      // inwards
        for (let a = 5 + rng() * 5; a < len - 5; a += 7 + rng() * 6) {
          const off = 3.5 + rng() * 1.6, x = w.ax + tx * a + nx * off, z = w.az + tz * a + nz * off, k = Math.floor(rng() * 6), yaw = Math.atan2(tz, tx);
          if (gapOf(x, z) < 8 || inFoot(x, z, 2.5) || nearTower(x, z, 4) || nearGate(x, z) || Math.hypot(x - L.well.x, z - L.well.z) < 7) continue;
          props.push([k, x, z, Math.atan2(tz, tx), wi]);
        }
      });
      for (const [k, x, z, yaw, wi] of props) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        if (k === 0) stall(x, z, yaw, wi);
        else if (k === 1) cart(x, z, yaw);
        else if (k === 2) { barrel(x, z); barrel(x + 0.9, z + 0.2); barrel(x + 0.4, z - 0.8, 0.9); crate(x - 1, z + 0.4, 0.8, 0.3); }
        else if (k === 3) { for (let i = 0; i < 4; i++) hayBale(x + (i % 2) * 1.2, z + (i >> 1) * 0.8, 0.2 + (i % 3) * 0.1); hayBale(x + 0.6, z + 0.4, 0.4, lvl + 0.55); sack(x - 1.2, z); sack(x - 1.6, z + 0.5); }
        else if (k === 4) { crate(x, z, 0.9, 0.2); crate(x + 1.0, z + 0.2, 0.8, 0.5); crate(x + 0.4, z + 0.1, 0.7, 0.1, 0.6 + 0.7); barrel(x - 0.9, z + 0.4); sack(x + 0.2, z + 1); }
        else { barrel(x, z); barrel(x + 1.0, z); crate(x + 0.5, z + 1.0, 0.8, 0.4); }
      }
    }
    // torches on posts at the well: two
    { const w = L.well; for (const sd of [-1, 1]) { torch(w.x + sd * (w.r - 0.1) + sd * 0.15, lvl + 2.0, w.z, sd, 0); } }

    /* ================= bridges / causeways at the gates ================= */
    for (const br of bridges) {
      const { g, G, out, fx, fz, rx, rz } = br, ay = a => { const q = G(out * a, 0); return terrain.heightAt(q[0], q[1]); };
      const a0 = g.depth / 2 + 0.4, a1 = a0 + 11.6;
      for (const sd of [-1, 1]) {
        const lat = sd * (half + 0.95);
        for (let a = a0; a <= a1 + 0.01; a += 2.9) { const q = G(out * a, lat), y = ay(a); obox(B.trim, q[0], q[1], rx, rz, 0.3, 0.3, y - 3.4, y + 1.15, OAK, { tile: 1 }); }
        for (const h of [0.45, 1.0]) { const m = G(out * (a0 + a1) / 2, lat), y = (ay(a0) + ay(a1)) / 2; obox(B.trim, m[0], m[1], fx, fz, a1 - a0 + 0.3, 0.16, y + h, y + h + 0.16, [0.58, 0.42, 0.26], { tile: 1 }); }
        { const m = G(out * (a0 + a1) / 2, lat), y = (ay(a0) + ay(a1)) / 2; obox(B.trim, m[0], m[1], fx, fz, a1 - a0 + 0.3, 0.5, y - 0.9, y - 0.2, [0.5, 0.36, 0.22], { tile: 1 }); }
      }
      for (let a = a0 + 0.4; a < a1; a += 0.7) { const m = G(out * a, 0), y = ay(a); void y; void m; }
    }

    /* ================= far set: windmill, watchtower, haystacks (non-collidable, well away from the road) ================= */
    const spots = (sA, sB, side, minGap, maxGap, want) => {
      const out2 = []; let best = null;
      for (let s = sA; s <= sB; s += 14) for (let off = minGap; off <= maxGap; off += 14) {
        const i = Math.min(P.length - 1, Math.round(s / 2)), p = P[i], x = p.x + (-Math.cos(p.th)) * side * (half + off), z = p.z + Math.sin(p.th) * side * (half + off);
        if (x < terrain.minX + 30 || x > terrain.maxX - 30 || z < terrain.minZ + 30 || z > terrain.maxZ - 30) continue;
        if (gapOf(x, z) < minGap * 0.9 || castleKeepOut(L, x, z, 70)) continue;
        const y = terrain.heightAt(x, z), sc = want(x, z, y, p); if (!best || sc > best.sc) best = { x, y, z, sc, s, p };
      }
      return best;
    };
    const wm = spots(900, 1300, -1, 60, 200, (x, z, y, p) => y - p.y - Math.abs(terrain.heightAt(x + 8, z) - y) * 3 - Math.abs(terrain.heightAt(x, z + 8) - y) * 3);
    const wt = spots(1800, 2300, 1, 60, 200, (x, z, y, p) => y - p.y - Math.abs(terrain.heightAt(x + 6, z) - y) * 3 - Math.abs(terrain.heightAt(x, z + 6) - y) * 3);
    let sails = null;
    if (wm) {
      const { x, z } = wm, y = wm.y - 0.5, r0 = 3.4, hgt = 11, yaw = Math.atan2(wm.p.x - x, wm.p.z - z);
      lathe(far.stone, x, z, [[r0 + 0.5, y - 3], [r0 + 0.5, y + 0.4], [r0, y + 0.4], [r0 * 0.68, y + hgt]], 8, [1.0, 0.96, 0.86], { tile: 4 });
      lathe(far.thatch, x, z, [[r0 * 0.9, y + hgt - 0.1], [r0 * 0.7, y + hgt + 0.5], [r0 * 0.3, y + hgt + 2.6], [0.05, y + hgt + 3.8]], 8, [0.9, 0.8, 0.7], { up: 0.5, tile: 3 });
      obox(far.trim, x + Math.sin(yaw) * (r0 * 0.7 + 0.1), z + Math.cos(yaw) * (r0 * 0.7 + 0.1), Math.cos(yaw), -Math.sin(yaw), 1.3, 0.3, y, y + 2.6, cMul(OAK, 0.7), { tile: 1 });
      const sb = geoBuilder(), hubY = y + hgt - 1.4;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), arm = (u0, u1, hw, col) => { poly(sb, [[ca * u0 - sa * -hw, sa * u0 + ca * -hw, 0], [ca * u1 - sa * -hw, sa * u1 + ca * -hw, 0], [ca * u1 - sa * hw, sa * u1 + ca * hw, 0], [ca * u0 - sa * hw, sa * u0 + ca * hw, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], col, [0, 0, 1]); poly(sb, [[ca * u0 - sa * hw, sa * u0 + ca * hw, 0], [ca * u1 - sa * hw, sa * u1 + ca * hw, 0], [ca * u1 - sa * -hw, sa * u1 + ca * -hw, 0], [ca * u0 - sa * -hw, sa * u0 + ca * -hw, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], col, [0, 0, -1]); };
        arm(0.6, 11.5, 0.17, OAK); arm(2.4, 11.2, 0.95, [0.93, 0.9, 0.8]); for (let u = 3.2; u < 11; u += 1.5) arm(u, u + 0.12, 0.98, cMul(OAK, 0.8));
      }
      const sm = roadsideMesh(sb.build(), trimTex(), { shadow: false }); sm.material.side = THREE.DoubleSide; stageGroup.remove(sm);
      const grp = new THREE.Group(); grp.position.set(x + Math.sin(yaw) * (r0 * 0.55 + 1.2), hubY, z + Math.cos(yaw) * (r0 * 0.55 + 1.2)); grp.rotation.y = yaw; grp.add(sm); stageGroup.add(grp); sails = sm; castleFx.sails = sm;
      sails.frustumCulled = false;
    }
    if (wt) {
      const { x, z } = wt, y = wt.y - 0.5, rw = 3.0, h = 15, rs = [[rw + 0.4, y - 3], [rw, y + 0.4], [rw * 0.8, y + h]];
      lathe(far.stone, x, z, [[rs[0][0], rs[0][1]], [rw + 0.4, y + 0.6], [rw, y + 0.6], [rw * 0.78, y + h - 0.6], [rw * 1.0, y + h - 0.2], [rw * 1.15, y + h + 0.1]], 6, [0.95, 0.92, 0.86], { tile: 4 });
      lathe(far.trim, x, z, [[rw * 1.15, y + h + 0.1], [rw * 1.2, y + h + 2.0]], 6, [0.55, 0.4, 0.26], { tile: 2 });
      lathe(far.thatch, x, z, [[rw * 1.35, y + h + 1.9], [rw * 0.7, y + h + 3.6], [0.05, y + h + 6.2]], 6, [0.75, 0.6, 0.62], { up: 0.5, tile: 3 });
      obox(far.trim, x, z, 1, 0, 0.12, 0.12, y + h + 5.8, y + h + 9.4, OAK, { tile: 1 });
      if (!low) FL.pennant(x, y + h + 8.8, z, WIND, 3.2, 1.1, BAN.C);
    }
    // haystacks and a few stooks beside the meadow fields (visual only, 14 m or more from the road edge)
    { const stacks = [];
      for (let tries = 0; tries < 400 && stacks.length < (low ? 8 : 22); tries++) {
        const s = (rng() < 0.5 ? 2060 + rng() * 380 : 500 + rng() * 520), p = P[Math.min(P.length - 1, Math.round(s / 2))], side = rng() < 0.5 ? -1 : 1, off = half + 14 + rng() * 40;
        const x = p.x - Math.cos(p.th) * side * off, z = p.z + Math.sin(p.th) * side * off;
        if (x < terrain.minX + 20 || x > terrain.maxX - 20 || z < terrain.minZ + 20 || z > terrain.maxZ - 20 || gapOf(x, z) < 13 || castleKeepOut(L, x, z, 40) || nearHouse(x, z) || slopeAt(x, z) > 0.2) continue;
        if (stacks.some(q => Math.hypot(q[0] - x, q[1] - z) < 6)) continue;
        stacks.push([x, z]);
      }
      castleFx.stacks = stacks.length;
      for (const [x, z] of stacks) { const y = terrain.heightAt(x, z), r1 = 1.5 + rng() * 0.5;
        lathe(far.thatch, x, z, [[r1 * 0.9, y - 0.2], [r1, y + 0.9], [r1 * 0.92, y + 1.7], [r1 * 0.5, y + 2.6], [0.05, y + 3.3]], 8, [0.95 + rng() * 0.1, 0.9 + rng() * 0.1, 0.7], { tile: 2, up: 0.2 }); }
    }

    /* ================= moat water, banners, meshes ================= */
    const mk = (b, map, o = {}) => { const m = new THREE.Mesh(b.build(), lit(Object.assign({ map, vertexColors: true }, o))); m.castShadow = o.castShadow !== false; m.receiveShadow = true; return m; };
    const dressed = [];
    const put = (b, tex, name, o) => { const g = b.build(); if (!g.getAttribute('position').count) return; const m = new THREE.Mesh(g, lit(Object.assign({ map: tex, vertexColors: true }, o && o.mat || {}))); m.name = name; m.castShadow = !(o && o.noShadow); m.receiveShadow = true; add(m); dressed.push(m); return m; };
    put(B.stone, castleStoneTex(), 'castleStone'); put(B.slate, slateTex(), 'castleSlate'); put(B.clay, roofTex(), 'castleClay'); put(B.thatch, thatchTex(), 'castleThatch');
    put(B.wood, woodTex(), 'castleWood'); put(B.trim, trimTex(), 'castleTrim', { noShadow: true });
    { const cm = put(B.cob, cobbleTex(), 'castleCobble', { noShadow: true, mat: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } }); cm.castShadow = false; }
    { const gg = B.glass.build(); if (gg.getAttribute('position').count) { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true })); m.name = 'castleGlass'; add(m); } }
    for (const [fb, nm, tex] of [[far.stone, 'farStone', castleStoneTex()], [far.thatch, 'farThatch', thatchTex()], [far.trim, 'farTrim', trimTex()]]) { const g = fb.build(); if (!g.getAttribute('position').count) continue; const m = new THREE.Mesh(g, lit({ map: tex, vertexColors: true })); m.name = nm; m.castShadow = false; m.receiveShadow = true; add(m); }
    // banners and pennants: one mesh, wind in the vertex shader (high quality); on low they hang still
    { const gg = FL.build(); if (gg) {
      const mat = lit({ map: bannerTex(), side: THREE.DoubleSide });
      if (!low) {
        mat.onBeforeCompile = (s) => {
          s.uniforms.uCT = castleFx.ct;
          s.vertexShader = 'uniform float uCT;\nattribute vec3 wv;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float sw = sin(uCT * 2.6 + wv.z * 7.0 + position.x * 0.5 + position.z * 0.5) + 0.4 * sin(uCT * 5.3 + wv.z * 13.0);\n sw = wv.z < 0.0 ? sw : 0.5 + 0.5 * sw;\n transformed.xz += wv.xy * sw * abs(wv.z) * 0.55;\n transformed.y -= abs(wv.z) * abs(sw) * 0.08;');
        };
        mat.customProgramCacheKey = () => 'castle-flag';
      }
      const m = new THREE.Mesh(gg, mat); m.name = 'castleFlags'; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; add(m); castleFx.flags = m; } }
    // moat: a flat water ring 5 to 17 m outside the walls, sunk into the ditch (see castleHeight in stages.js). A gentle glint from the low sun, the texture drifts slowly
    {
      const y = L.moat.level, corners = d => [[R.u0 - d, R.v0 - d], [R.u1 + d, R.v0 - d], [R.u1 + d, R.v1 + d], [R.u0 - d, R.v1 + d]].map(([u, v]) => W2(u, v));
      const inner = corners(L.moat.d0), outer = corners(L.moat.d1), pos = [], uv = [], idx = [];
      for (const q of inner.concat(outer)) { pos.push(q[0], y, q[1]); uv.push(q[0] / 9, q[1] / 9); }
      for (let i = 0; i < 4; i++) { const a = i, b = (i + 1) % 4, c = 4 + i, d = 4 + (i + 1) % 4; idx.push(a, b, d, a, d, c); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const tex = waterTex(), mat = low ? lit({ map: tex, color: 0x6aa0a4, emissive: 0x1c3a42, side: THREE.DoubleSide }) : new THREE.MeshPhongMaterial({ map: tex, color: 0x6aa0a4, emissive: 0x1c3a42, specular: 0xffe2b0, shininess: 90, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat); m.name = 'castleMoat'; m.receiveShadow = true; add(m); castleFx.water = low ? null : tex;
    }
    // forge and kitchen smoke (high only): soft puffs drifting up from the smithy and the barracks chimneys; cheap, moved on the CPU (about 40 points)
    if (!low) {
      const sm = L.buildings.find(b => b.kind === 'smithy'), br = L.buildings.find(b => b.kind === 'barracks'), srcs = [];
      if (sm) srcs.push([sm.x, lvl + sm.h + 4.2, sm.z]);
      if (br) { const K = frameOf(br); for (const u of [-14, -3, 12]) { const q = K.T(u, br.d / 2 * 0.35); srcs.push([q[0], lvl + br.h + br.d * 0.72 + 2.4, q[1]]); } }
      const n = srcs.length * 10, g = new THREE.BufferGeometry(), c = document.createElement('canvas'); c.width = c.height = 64;
      const cg = c.getContext('2d'), gr = cg.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 64, 64);
      const data = { n, x: [], y: [], z: [], ph: [], wx: WIND[0] * 0.5, wz: WIND[1] * 0.5, c: [0.82, 0.8, 0.78] };
      srcs.forEach(s => { for (let i = 0; i < 10; i++) { data.x.push(s[0]); data.y.push(s[1]); data.z.push(s[2]); data.ph.push(i / 10); } });
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const t = new THREE.CanvasTexture(c); srgb(t);
      const m = new THREE.Points(g, new THREE.PointsMaterial({ map: t, size: 3.2, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
      m.frustumCulled = false; m.userData = data; m.name = 'castleSmoke'; add(m); castleFx.puffs = m;
    }
    castleFx.group = stageGroup;
    for (const ob of castleObstacles(L)) obstacles.push(ob);
    castleFx.stats = { flags: flagN, props: props.length, walls: wallLen.length, windmill: wm ? [Math.round(wm.x), Math.round(wm.z), Math.round(wm.s)] : null, tower: wt ? [Math.round(wt.x), Math.round(wt.z), Math.round(wt.s)] : null };
  }

  // banners and pennants: one geometry, two-sided; attribute `wv` = (wind push x, z, amount) for the vertex shader (negative amount = push both ways)
  function flagKit() {
    const P = [], U = [], A = [], I = [];
    const v = (x, y, z, u, vv, wx, wz, aw) => { P.push(x, y, z); U.push(u, vv); A.push(wx, wz, aw); return P.length / 3 - 1; };
    return {
      // hanging banner: top middle (x,y,z), along = unit horizontal along the width, out = unit horizontal away from the wall, w wide, len long, tail = pointed bottom; slack = how much it may billow
      banner(x, y, z, along, out, w, len, uvr, slack) {
        const cols = 3, rows = 7, id = [];
        for (let j = 0; j <= rows; j++) {
          const t = j / rows, wf = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34 * 0.9;
          for (let i = 0; i <= cols; i++) { const s = (i / cols - 0.5) * w * wf; id.push(v(x + along[0] * s + out[0] * 0.06, y - t * len, z + along[1] * s + out[1] * 0.06, uvr[0] + (uvr[1] - uvr[0]) * (i / cols), 1 - t * 0.99, out[0], out[1], slack * t)); }
        }
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = id[j * (cols + 1) + i], b = id[j * (cols + 1) + i + 1], c = id[(j + 1) * (cols + 1) + i + 1], d = id[(j + 1) * (cols + 1) + i]; I.push(a, b, c, a, c, d); }
      },
      // pennant: root (x,y,z), streams along `dir` (unit x, z), length, height at the root
      pennant(x, y, z, dir, len, h, uvr) {
        const cols = 6, id = [], nx = -dir[1], nz = dir[0];
        for (let i = 0; i <= cols; i++) {
          const t = i / cols, hh = h * (1 - 0.82 * t) * 0.5, u = uvr[0] + (uvr[1] - uvr[0]) * t;
          id.push([v(x + dir[0] * len * t, y + hh, z + dir[1] * len * t, u, 0.9, nx, nz, -t), v(x + dir[0] * len * t, y - hh, z + dir[1] * len * t, u, 0.1, nx, nz, -t)]);
        }
        for (let i = 0; i < cols; i++) I.push(id[i][0], id[i + 1][0], id[i + 1][1], id[i][0], id[i + 1][1], id[i][1]);
      },
      build() {
        if (!P.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('wv', new THREE.Float32BufferAttribute(A, 3));
        g.setIndex(I); g.computeVertexNormals(); return g;
      },
    };
  }
