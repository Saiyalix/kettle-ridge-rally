  /* ---------- generated surface textures: road, ground, roadside materials ----------
     Everything is drawn with canvas in code, once per quality, the first time a stage needs it, then cached.
     "Smooth and modern": detailed, sharp, mipmapped, anisotropic. 'low' draws the same pictures at half size.
     Runs inside boot(): `quality` is already set (src/ui/pause.js) by the time a stage is built. */
  const ROAD_EXT = 1.14;                 // road texture covers across = -1.14 .. +1.14 (the outer 0.14 is the loose spill past the edge)
  const ROAD_TILE = 18;                  // metres of road per texture repeat (v = s / ROAD_TILE)
  const artCache = {};
  function artTex(name, size, draw, seed, aniso) {
    const low = quality === 'low', key = name + (low ? ':l' : ':h');
    if (artCache[key]) return artCache[key];
    const w = low ? size[0] >> 1 : size[0], h = low ? size[1] >> 1 : size[1];
    const t = makeTex(w, h, (g, W, H) => draw(g, W, H, W / size[0], mulberry32(seed)));
    t.anisotropy = Math.min(low ? 2 : (aniso || 8), renderer.capabilities.getMaxAnisotropy());
    t.userData.keep = true;                                         // shared by every stage: the stage dispose leaves it alone
    return (artCache[key] = t);
  }
  // draw fn fn(y) at y and at the wrapped copies, so long marks tile seamlessly in v
  const wrapV = (H, y, ext, fn) => { fn(y); if (y < ext) fn(y + H); if (y > H - ext) fn(y - H); };
  const wrapXY = (W, H, x, y, ext, fn) => { for (const dx of [-W, 0, W]) { if (dx < 0 && x > ext) continue; if (dx > 0 && x < W - ext) continue; for (const dy of [-H, 0, H]) { if (dy < 0 && y > ext) continue; if (dy > 0 && y < H - ext) continue; fn(x + dx, y + dy); } } };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const blot = (g, x, y, rad, col, a) => { const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(1, `rgba(${col},0)`); g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); };

  /* ---- road: one texture per surface; u = across the road (-1.14 .. 1.14), v = along (18 m per repeat) ---- */
  function roadTex(kind) {
    return artTex('road-' + kind, [512, 1024], (g, W, H, S, r) => {
      const X = a => (a + ROAD_EXT) / (2 * ROAD_EXT) * W, PX = a => a * W / (2 * ROAD_EXT);
      const x0 = X(-1), x1 = X(1);
      g.clearRect(0, 0, W, H);
      const spillDot = (n, cols, rmin, rmax, shade) => {            // loose stuff past the road edge (alpha-tested, so the edge is ragged)
        for (let i = 0; i < n; i++) {
          const side = r() < 0.5 ? 0 : 1, f = Math.pow(r(), 1.7), x = side ? x1 + f * (W - x1) : x0 - f * x0, y = r() * H, rad = (rmin + r() * (rmax - rmin)) * S;
          wrapV(H, y, 8, (Y) => { if (shade) { g.fillStyle = shade; g.beginPath(); g.ellipse(x + S, Y + S, rad, rad * 0.8, 0, 0, 7); g.fill(); } g.fillStyle = pick(r, cols); g.beginPath(); g.ellipse(x, Y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); });
        }
      };
      const wheelBand = (a, wA, col, alpha) => { const gr = g.createLinearGradient(X(a - wA), 0, X(a + wA), 0); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${alpha})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(X(a - wA), 0, X(a + wA) - X(a - wA), H); };
      const wobble = (a, amp, lw, col, cycles, phase) => { g.strokeStyle = col; g.lineWidth = lw * S; g.beginPath(); for (let y = 0; y <= H; y += 8) { const x = X(a) + amp * S * Math.sin(y / H * Math.PI * 2 * cycles + phase); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
      const treads = (a, col, n) => { g.strokeStyle = col; g.lineWidth = 1.4 * S; for (let i = 0; i < n; i++) { const y = i * H / n; for (const sx of [-1, 1]) { const x = X(a) + sx * PX(0.07); g.beginPath(); g.moveTo(x - 4 * S * sx, y); g.lineTo(x + 4 * S * sx, y + 5 * S); g.stroke(); } } };

      if (kind === 'tarmac') {
        g.fillStyle = '#585b64'; g.fillRect(x0, 0, x1 - x0, H);
        for (let i = 0; i < 70; i++) { const x = x0 + r() * (x1 - x0), y = r() * H, rad = (40 + r() * 90) * S; wrapV(H, y, rad, (Y) => blot(g, x, Y, rad, r() < 0.5 ? '20,22,30' : '170,176,190', 0.05 + r() * 0.06)); }
        for (const a of [-0.45, 0.45]) { wheelBand(a, 0.26, '16,18,26', 0.42); wheelBand(a, 0.09, '150,170,205', 0.2); }   // worn dark racing line with a glossy bluish sheen
        wheelBand(0, 0.12, '20,20,24', 0.18);                                                                              // oil in the middle
        for (let i = 0; i < 900 * S; i++) {                                                                                 // long streaks along the road
          const a = (r() < 0.6 ? (r() < 0.5 ? -0.45 : 0.45) + (r() - 0.5) * 0.5 : (r() - 0.5) * 1.9), x = X(a), y = r() * H, len = (60 + r() * 320) * S;
          wrapV(H, y, len, (Y) => { g.fillStyle = r() < 0.55 ? 'rgba(10,12,18,0.10)' : 'rgba(170,185,215,0.10)'; g.fillRect(x, Y, (1 + r() * 2.5) * S, len); });
        }
        for (const [a, ph, cyc] of [[-0.5, 0.4, 3], [-0.4, 2.1, 5], [0.4, 1.3, 3], [0.5, 4.0, 4], [-0.45, 5, 2], [0.45, 3, 2]]) wobble(a, 5, 2.5, 'rgba(8,8,12,0.34)', cyc, ph);   // tyre marks
        for (let i = 0; i < 36000 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.20)' : 'rgba(210,215,230,0.16)'; g.fillRect(x0 + r() * (x1 - x0), r() * H, S * (1 + (r() < 0.2)), S); }   // grain
        for (let i = 0; i < 3200 * S * S; i++) { g.fillStyle = `rgba(${150 + r() * 80 | 0},${150 + r() * 80 | 0},${160 + r() * 80 | 0},0.35)`; const x = x0 + r() * (x1 - x0), y = r() * H; g.fillRect(x, y, S * 1.6, S * 1.6); }  // loose chippings
        for (let i = 0; i < 9; i++) {                                                                                       // cracks
          let x = X(-0.9 + r() * 1.8), y = H * (0.05 + r() * 0.8); g.strokeStyle = 'rgba(8,8,12,0.55)'; g.lineWidth = 1.3 * S; g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 14; k++) { x += (r() - 0.5) * 16 * S; y += (4 + r() * 12) * S; g.lineTo(x, y); } g.stroke();
        }
        for (const sx of [-1, 1]) { const gr = g.createLinearGradient(X(0.78 * sx), 0, X(sx), 0); gr.addColorStop(0, 'rgba(40,36,30,0)'); gr.addColorStop(1, 'rgba(40,36,30,0.5)'); g.fillStyle = gr; g.fillRect(Math.min(X(0.78 * sx), X(sx)), 0, Math.abs(X(sx) - X(0.78 * sx)), H); }   // dirty outer edge
        for (const sx of [-1, 1]) {                                                                                         // faded white edge lines
          const xc = X(0.9 * sx), lw = PX(0.05);
          for (let y = 0; y < H;) { const len = (80 + r() * 260) * S, gap = r() < 0.4 ? (6 + r() * 26) * S : 0; g.fillStyle = `rgba(238,236,224,${0.82 + r() * 0.16})`; g.fillRect(xc - lw / 2, y, lw, Math.min(len, H - y)); y += len + gap; }
          for (let i = 0; i < 700 * S * S; i++) { g.fillStyle = 'rgba(60,62,70,0.55)'; g.fillRect(xc - lw / 2 + r() * lw, r() * H, S * (1 + r() * 2), S * (1 + r() * 3)); }   // worn bits
        }
        spillDot(900 * S, ['#6a6860', '#8a8478', '#4c4a46', '#a09886'], 0.8, 2.6, 'rgba(0,0,0,0.35)');
      } else if (kind === 'gravel') {
        g.fillStyle = '#bda37f'; g.fillRect(x0, 0, x1 - x0, H);
        for (let i = 0; i < 80; i++) { const x = x0 + r() * (x1 - x0), y = r() * H, rad = (30 + r() * 80) * S; wrapV(H, y, rad, (Y) => blot(g, x, Y, rad, r() < 0.5 ? '90,70,50' : '240,225,190', 0.07 + r() * 0.07)); }
        const stones = ['#d6c3a0', '#b59a74', '#e4d9c0', '#8f8070', '#a89478', '#cdb892', '#6f6256', '#f0e8d4'];
        for (let i = 0; i < 26000 * S * S; i++) {
          const x = x0 + r() * (x1 - x0), y = r() * H, a = (x / W) * 2 * ROAD_EXT - ROAD_EXT, rut = Math.abs(Math.abs(a) - 0.45) < 0.17, edge = Math.abs(a) > 0.82;
          if (rut && r() < 0.6) continue;
          const rad = (0.9 + r() * (edge ? 3.2 : 2.2)) * S;
          wrapV(H, y, 6, (Y) => { g.fillStyle = 'rgba(40,28,16,0.42)'; g.beginPath(); g.ellipse(x + S * 0.8, Y + S * 0.9, rad, rad * 0.8, 0, 0, 7); g.fill(); g.fillStyle = pick(r, stones); g.beginPath(); g.ellipse(x, Y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); });
        }
        for (const a of [-0.45, 0.45]) { wheelBand(a, 0.2, '70,52,34', 0.34); wheelBand(a, 0.07, '40,30,20', 0.22); treads(a, 'rgba(50,36,22,0.3)', 64); wobble(a - 0.08, 3, 1.6, 'rgba(40,28,18,0.30)', 4, a * 9); wobble(a + 0.08, 3, 1.6, 'rgba(40,28,18,0.30)', 3, a * 7); }
        for (const sx of [-1, 1]) { const gr = g.createLinearGradient(X(0.78 * sx), 0, X(sx), 0); gr.addColorStop(0, 'rgba(255,244,214,0)'); gr.addColorStop(1, 'rgba(255,244,214,0.3)'); g.fillStyle = gr; g.fillRect(Math.min(X(0.78 * sx), X(sx)), 0, Math.abs(X(sx) - X(0.78 * sx)), H); }   // lighter loose berm
        for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${70 + r() * 30 | 0},${100 + r() * 30 | 0},50,0.55)`; const x = X((r() - 0.5) * 0.3), y = r() * H; g.fillRect(x, y, S * 1.5, S * (3 + r() * 4)); }   // weeds down the middle
        spillDot(1700 * S, ['#d6c3a0', '#cdb892', '#e4d9c0', '#b59a74', '#8f8070'], 1.0, 3.2, 'rgba(40,28,16,0.4)');
      } else if (kind === 'dirt') {
        g.fillStyle = '#8c6843'; g.fillRect(x0, 0, x1 - x0, H);
        for (let i = 0; i < 90; i++) { const x = x0 + r() * (x1 - x0), y = r() * H, rad = (30 + r() * 80) * S; wrapV(H, y, rad, (Y) => blot(g, x, Y, rad, r() < 0.5 ? '50,32,18' : '200,160,110', 0.08 + r() * 0.08)); }
        const clods = ['#7a5736', '#9d7650', '#6b4a2e', '#b08a60', '#85603c'];
        for (let i = 0; i < 9000 * S * S; i++) {
          const x = x0 + r() * (x1 - x0), y = r() * H, rad = (1 + r() * 3.2) * S;
          wrapV(H, y, 6, (Y) => { g.fillStyle = 'rgba(30,18,8,0.4)'; g.beginPath(); g.ellipse(x + S, Y + S, rad, rad * 0.75, 0, 0, 7); g.fill(); g.fillStyle = pick(r, clods); g.beginPath(); g.ellipse(x, Y, rad, rad * 0.75, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(x - rad * 0.5, Y - rad * 0.6, rad * 0.8, S * 0.8); });
        }
        for (const a of [-0.42, 0.42]) {                                                                                    // deep ruts with a wet shine at the bottom
          wheelBand(a, 0.2, '34,20,10', 0.6); wheelBand(a, 0.07, '110,150,190', 0.2); treads(a, 'rgba(20,12,6,0.45)', 48);
          wobble(a - 0.1, 3, 2, 'rgba(30,18,8,0.4)', 3, a * 8); wobble(a + 0.1, 3, 2, 'rgba(30,18,8,0.4)', 4, a * 5);
          for (let k = 0; k < 4; k++) { const y = r() * H; wrapV(H, y, 60 * S, (Y) => { g.fillStyle = 'rgba(70,92,120,0.5)'; g.beginPath(); g.ellipse(X(a), Y, PX(0.05), (20 + r() * 26) * S, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(210,225,240,0.35)'; g.beginPath(); g.ellipse(X(a) - S, Y - 5 * S, PX(0.02), 7 * S, 0, 0, 7); g.fill(); }); }
        }
        for (let i = 0; i < 1100 * S * S; i++) { g.fillStyle = pick(r, ['#c8b89a', '#a8998a', '#6e625a']); const x = x0 + r() * (x1 - x0), y = r() * H, rad = (0.8 + r() * 1.6) * S; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
        for (const sx of [-1, 1]) for (let i = 0; i < 260 * S; i++) { const x = X(sx * (0.9 + r() * 0.24)), y = r() * H; g.strokeStyle = pick(r, ['#4c6a2a', '#5f7d33', '#3a5222']); g.lineWidth = S * 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6 * S, y - (4 + r() * 8) * S); g.stroke(); }   // grass creeping in
        spillDot(1500 * S, ['#7a5736', '#9d7650', '#4f6b2b', '#6b4a2e', '#5f7d33'], 1.0, 3.0, 'rgba(30,18,8,0.4)');
      } else {                                                                                                              // snow
        g.fillStyle = '#eef3fb'; g.fillRect(x0, 0, x1 - x0, H);
        for (let i = 0; i < 90; i++) { const x = x0 + r() * (x1 - x0), y = r() * H, rad = (30 + r() * 90) * S; wrapV(H, y, rad, (Y) => blot(g, x, Y, rad, r() < 0.6 ? '150,175,215' : '255,255,255', 0.1 + r() * 0.1)); }
        for (const a of [-0.45, 0.45]) { wheelBand(a, 0.22, '120,140,175', 0.55); wheelBand(a, 0.08, '90,105,135', 0.3); treads(a, 'rgba(70,85,115,0.4)', 56); wobble(a - 0.09, 3, 2, 'rgba(70,85,115,0.3)', 3, a * 6); wobble(a + 0.09, 3, 2, 'rgba(70,85,115,0.3)', 4, a * 4); }
        for (let i = 0; i < 500 * S * S; i++) { const a = (r() < 0.5 ? -0.45 : 0.45) + (r() - 0.5) * 0.3; g.fillStyle = pick(r, ['rgba(110,100,92,0.45)', 'rgba(70,70,80,0.35)']); g.fillRect(X(a), r() * H, S * (1 + r() * 2), S * (1 + r() * 2)); }   // slush and grit in the tracks
        for (const sx of [-1, 1]) { const gr = g.createLinearGradient(X(0.7 * sx), 0, X(sx), 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)'); g.fillStyle = gr; g.fillRect(Math.min(X(0.7 * sx), X(sx)), 0, Math.abs(X(sx) - X(0.7 * sx)), H); }   // brighter banks at the edges
        for (let i = 0; i < 9000 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(150,175,215,0.25)'; g.fillRect(x0 + r() * (x1 - x0), r() * H, S * (1 + r() * 1.4), S); }   // sparkle and drift
        spillDot(1500 * S, ['#ffffff', '#f2f6fc', '#dde7f5'], 1.5, 5.5, 'rgba(140,165,205,0.45)');
      }
    }, kind === 'tarmac' ? 11 : kind === 'gravel' ? 12 : kind === 'dirt' ? 13 : 14, 8);
  }

  /* ---- ground: grass, plus a soil/pebble layer blended in by the ground shader on high quality ---- */
  function grassTex() {
    return artTex('grass', [512, 512], (g, W, H, S, r) => {
      g.fillStyle = '#d4d9c4'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, rad = (25 + r() * 90) * S; wrapXY(W, H, x, y, rad, (X, Y) => blot(g, X, Y, rad, pick(r, ['50,90,30', '255,255,215', '130,100,50', '25,55,20']), 0.14 + r() * 0.12)); }
      for (let i = 0; i < 20000 * S * S; i++) {
        const x = r() * W, y = r() * H, len = (3 + r() * 7) * S, ang = (r() - 0.5) * 0.9;
        g.strokeStyle = pick(r, ['rgba(25,55,12,0.5)', 'rgba(255,255,195,0.5)', 'rgba(90,125,35,0.42)', 'rgba(15,35,8,0.4)']); g.lineWidth = (0.9 + r() * 0.9) * S;
        wrapXY(W, H, x, y, 12 * S, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.sin(ang) * len, Y - Math.cos(ang) * len); g.stroke(); });
      }
      for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H; wrapXY(W, H, x, y, 12 * S, (X, Y) => { g.fillStyle = pick(r, ['rgba(255,255,255,0.85)', 'rgba(255,225,110,0.8)', 'rgba(255,170,190,0.7)']); g.beginPath(); g.arc(X, Y, (1 + r() * 1.5) * S, 0, 7); g.fill(); }); }
      for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, rad = (1 + r() * 2.2) * S; wrapXY(W, H, x, y, 8 * S, (X, Y) => { g.fillStyle = 'rgba(70,64,56,0.4)'; g.beginPath(); g.ellipse(X + S, Y + S, rad, rad * 0.8, 0, 0, 7); g.fill(); g.fillStyle = pick(r, ['#bdb7aa', '#9a948a', '#d6d0c2']); g.beginPath(); g.ellipse(X, Y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); }); }
    }, 21, 8);
  }
  function soilTex() {
    return artTex('soil', [512, 512], (g, W, H, S, r) => {
      g.fillStyle = '#d6cdc0'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 80; i++) { const x = r() * W, y = r() * H, rad = (20 + r() * 70) * S; wrapXY(W, H, x, y, rad, (X, Y) => blot(g, X, Y, rad, r() < 0.5 ? '90,70,50' : '255,245,225', 0.1 + r() * 0.1)); }
      for (let i = 0; i < 3500 * S * S; i++) {                                                           // clods
        const x = r() * W, y = r() * H, rad = (1.2 + r() * 4) * S;
        wrapXY(W, H, x, y, 8 * S, (X, Y) => { g.fillStyle = 'rgba(40,28,18,0.42)'; g.beginPath(); g.ellipse(X + S, Y + S, rad, rad * 0.75, 0, 0, 7); g.fill(); g.fillStyle = pick(r, ['#c4b8a6', '#e2d9ca', '#a99c88', '#d2c6b2']); g.beginPath(); g.ellipse(X, Y, rad, rad * 0.75, r() * 3, 0, 7); g.fill(); });
      }
      for (let i = 0; i < 700 * S * S; i++) { const x = r() * W, y = r() * H, rad = (1 + r() * 2.4) * S; wrapXY(W, H, x, y, 8 * S, (X, Y) => { g.fillStyle = pick(r, ['#8e8a84', '#b8b2a8', '#6d6a66', '#e6e0d4']); g.beginPath(); g.ellipse(X, Y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); }); }   // pebbles
      for (let i = 0; i < 700 * S; i++) { const x = r() * W, y = r() * H, a = r() * 6.28; g.strokeStyle = pick(r, ['rgba(255,240,190,0.5)', 'rgba(70,50,30,0.35)']); g.lineWidth = S * 1.2; wrapXY(W, H, x, y, 12 * S, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * 7 * S, Y + Math.sin(a) * 7 * S); g.stroke(); }); }   // straw and roots
    }, 22, 8);
  }
  // ground material: vertex colours give the hue. With the `soil` vertex attribute (0 = grass, 1 = soil) and high quality,
  // a second texture is blended in next to the road.
  function groundMaterial(hasSoil) {
    const m = lit({ vertexColors: true, map: grassTex() });
    if (hasSoil && quality !== 'low') {
      const st = soilTex();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.soilMap = { value: st };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float soil; varying float vSoil;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoil = soil;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D soilMap; varying float vSoil;')
          .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 texelColor = mix(texture2D(map, vMapUv), texture2D(soilMap, vMapUv * 1.7), smoothstep(0.1, 0.8, vSoil));\n diffuseColor *= texelColor;\n#endif');
      };
      m.customProgramCacheKey = () => 'ground-soil';
    }
    return m;
  }

  /* ---- roadside textures (used by the builders in art/roadside.js) ---- */
  // stone blocks with mortar; 4 x 4 m per repeat; tiles in both directions
  function drawStoneBlocks(g, W, H, S, r, tone) {
    g.fillStyle = '#5c564e'; g.fillRect(0, 0, W, H);
    const rows = 8, rh = H / rows;
    const pal = tone === 'warm' ? [[168, 150, 124], [186, 168, 140], [150, 132, 108], [196, 178, 150]] : [[150, 146, 140], [170, 164, 156], [132, 128, 124], [184, 178, 168]];
    for (let y = 0; y < rows; y++) {
      const h = rh * (0.92 + r() * 0.16) , yy = y * rh;
      const n = 3 + Math.floor(r() * 2); let cuts = [0]; for (let k = 1; k < n; k++) cuts.push(k / n + (r() - 0.5) * 0.12); cuts.push(1); cuts.sort((a, b) => a - b);
      const off = (y % 2) * 0.5 / n;
      for (let k = 0; k < n; k++) {
        let xa = ((cuts[k] + off) * W), xb = ((cuts[k + 1] + off) * W);
        const bx = xa + 3 * S, bw = xb - xa - 6 * S, by = yy + 2.5 * S, bh = rh - 5 * S, c = pick(r, pal), v = 0.9 + r() * 0.2;
        for (const dx of [-W, 0, W]) {
          const x = bx + dx;
          g.fillStyle = `rgb(${c[0] * v | 0},${c[1] * v | 0},${c[2] * v | 0})`; g.fillRect(x, by, bw, bh);
          const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, 'rgba(255,255,240,0.22)'); gr.addColorStop(0.2, 'rgba(255,255,240,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(x, by, bw, bh);
          g.fillStyle = 'rgba(255,255,240,0.2)'; g.fillRect(x, by, 2 * S, bh); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + bw - 2 * S, by, 2 * S, bh);
          for (let i = 0; i < 90 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; g.fillRect(x + r() * bw, by + r() * bh, S * 1.5, S * 1.5); }
          if (r() < 0.25) { g.fillStyle = 'rgba(80,110,50,0.22)'; g.beginPath(); g.ellipse(x + r() * bw, by + bh - 4 * S, (6 + r() * 14) * S, (3 + r() * 4) * S, 0, 0, 7); g.fill(); }     // moss
        }
      }
    }
  }
  function stoneTex() { return artTex('stone', [512, 512], (g, W, H, S, r) => drawStoneBlocks(g, W, H, S, r, 'gray'), 31); }
  function stoneWarmTex() { return artTex('stoneWarm', [512, 512], (g, W, H, S, r) => drawStoneBlocks(g, W, H, S, r, 'warm'), 32); }

  // weathered wood: horizontal boards with grain and knots; 1 m x 1 m per repeat
  function woodTex() {
    return artTex('wood', [256, 256], (g, W, H, S, r) => {
      const boards = 4, bh = H / boards;
      for (let b = 0; b < boards; b++) {
        const v = 0.85 + r() * 0.3, y0 = b * bh;
        g.fillStyle = `rgb(${142 * v | 0},${108 * v | 0},${72 * v | 0})`; g.fillRect(0, y0, W, bh);
        for (let i = 0; i < 26; i++) { const yy = y0 + r() * bh, amp = (1 + r() * 2) * S, cyc = 1 + Math.floor(r() * 3), ph = r() * 6; g.strokeStyle = r() < 0.7 ? 'rgba(60,38,20,0.35)' : 'rgba(230,200,150,0.25)'; g.lineWidth = (0.8 + r()) * S; g.beginPath(); for (let x = 0; x <= W; x += 6) { const y = yy + amp * Math.sin(x / W * 6.283 * cyc + ph); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
        if (r() < 0.8) { const kx = r() * W, ky = y0 + bh * (0.3 + r() * 0.4); for (let k = 3; k > 0; k--) { g.strokeStyle = `rgba(50,30,16,${0.2 + 0.15 * k})`; g.lineWidth = S * 1.2; g.beginPath(); g.ellipse(kx, ky, 3 * k * S, 1.8 * k * S, 0, 0, 7); g.stroke(); } }
        g.fillStyle = 'rgba(205,200,185,0.18)'; g.fillRect(r() * W * 0.5, y0, W * (0.2 + r() * 0.4), bh);   // sun-bleached patch
        g.fillStyle = 'rgba(25,14,6,0.65)'; g.fillRect(0, y0, W, 2 * S); g.fillStyle = 'rgba(255,230,180,0.18)'; g.fillRect(0, y0 + 2 * S, W, S);
      }
    }, 33, 8);
  }

  // layered rock: horizontal strata, joints and chips; 8 x 8 m per repeat
  function rockLayerTex() {
    return artTex('rockLayers', [512, 512], (g, W, H, S, r) => {
      const pal = [[226, 208, 178], [190, 172, 150], [236, 216, 184], [170, 160, 152], [210, 186, 154], [150, 142, 140]];
      let y = 0; const bands = [];
      while (y < H) { const h = Math.min(H - y, (26 + r() * 52) * S); bands.push([y, h]); y += h; }
      if (bands.length > 1 && bands[bands.length - 1][1] < 14 * S) { const l = bands.pop(); bands[bands.length - 1][1] += l[1]; }
      for (const [y0, h] of bands) {
        const c = pick(r, pal);
        const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, `rgb(${Math.min(255, c[0] * 1.12) | 0},${Math.min(255, c[1] * 1.12) | 0},${Math.min(255, c[2] * 1.12) | 0})`); gr.addColorStop(1, `rgb(${c[0] * 0.82 | 0},${c[1] * 0.82 | 0},${c[2] * 0.82 | 0})`);
        g.fillStyle = gr; g.fillRect(0, y0, W, h);
        for (let i = 0; i < 700 * S * S * (h / (40 * S)); i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,250,235,0.14)'; g.fillRect(r() * W, y0 + r() * h, S * (1 + r() * 4), S * (1 + r() * 1.5)); }
        const nj = 2 + Math.floor(r() * 3);
        for (let k = 0; k < nj; k++) { let x = r() * W; g.strokeStyle = 'rgba(25,20,18,0.6)'; g.lineWidth = 1.6 * S; g.beginPath(); g.moveTo(x, y0); for (let t = 1; t <= 4; t++) { x += (r() - 0.5) * 10 * S; g.lineTo(x, y0 + h * t / 4); } g.stroke(); }
        g.fillStyle = 'rgba(20,16,14,0.55)'; g.fillRect(0, y0, W, 2.2 * S); g.fillStyle = 'rgba(255,248,225,0.25)'; g.fillRect(0, y0 + 2.2 * S, W, 1.5 * S);
      }
      for (let i = 0; i < 26; i++) { const x = r() * W, yy = r() * H, rad = (30 + r() * 60) * S; wrapXY(W, H, x, yy, rad, (X, Y) => blot(g, X, Y, rad, r() < 0.5 ? '30,24,20' : '255,250,235', 0.1 + r() * 0.08)); }
      for (let i = 0; i < 12; i++) { const x = r() * W, yy = r() * H; g.fillStyle = 'rgba(86,110,60,0.35)'; g.beginPath(); g.ellipse(x, yy, (6 + r() * 12) * S, (2 + r() * 3) * S, 0, 0, 7); g.fill(); }   // lichen
    }, 34, 8);
  }

  // clay roof tiles; 4 x 4 m per repeat
  function roofTex() {
    return artTex('roof', [256, 256], (g, W, H, S, r) => {
      g.fillStyle = '#7a3a28'; g.fillRect(0, 0, W, H);
      const rows = 8, rh = H / rows, cols = 8, cw = W / cols;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = 0.82 + r() * 0.36, cx = (x + (y % 2) * 0.5) * cw;
        for (const dx of [-W, 0]) {
          g.fillStyle = `rgb(${158 * v | 0},${80 * v | 0},${56 * v | 0})`; g.beginPath(); g.moveTo(cx + dx + 1, y * rh); g.lineTo(cx + dx + cw - 1, y * rh); g.lineTo(cx + dx + cw - 1, y * rh + rh * 0.7); g.arc(cx + dx + cw / 2, y * rh + rh * 0.7, cw / 2 - 1, 0, Math.PI); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(40,12,6,0.55)'; g.lineWidth = 1.4 * S; g.beginPath(); g.arc(cx + dx + cw / 2, y * rh + rh * 0.7, cw / 2 - 1, 0, Math.PI); g.stroke();
        }
      }
      for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(90,110,60,0.2)'; g.beginPath(); g.ellipse(r() * W, r() * H, (4 + r() * 8) * S, (2 + r() * 3) * S, 0, 0, 7); g.fill(); }
    }, 35, 4);
  }

  // plain plaster for house walls (windows, doors and trim are real geometry now, art/buildings.js); 4 m x 4 m per repeat
  function plasterTex() {
    return artTex('plaster', [512, 512], (g, W, H, S, r) => {
      g.fillStyle = '#ece3cf'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 46; i++) { const x = r() * W, y = r() * H, rad = (20 + r() * 60) * S; wrapXY(W, H, x, y, rad, (X, Y) => blot(g, X, Y, rad, r() < 0.5 ? '120,100,70' : '255,255,245', 0.06 + r() * 0.07)); }
      for (let i = 0; i < 9000 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.10)' : 'rgba(255,255,255,0.12)'; g.fillRect(r() * W, r() * H, S * 1.6, S * 1.6); }
      for (let i = 0; i < 3; i++) {                                                                      // a patch of plaster gone, brick showing
        const x = r() * W * 0.8, y = H * (0.1 + r() * 0.7), w = (30 + r() * 50) * S, h = (20 + r() * 36) * S;
        g.fillStyle = 'rgba(70,50,30,0.35)'; g.fillRect(x - 2 * S, y - 2 * S, w + 4 * S, h + 4 * S);
        g.fillStyle = '#b4745a'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(220,190,170,0.6)'; g.lineWidth = S;
        for (let k = 0; k < h; k += 7 * S) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + w, y + k); g.stroke(); }
      }
      for (let i = 0; i < 10; i++) { const x = r() * W; g.fillStyle = 'rgba(40,30,20,0.07)'; g.fillRect(x, 0, (3 + r() * 6) * S, H); }   // rain streaks
    }, 37, 8);
  }
  // neutral painted wood / stone trim, tinted by vertex colours (frames, sills, doors, shutters, beams); 1 m per repeat
  function trimTex() {
    return artTex('trim', [128, 128], (g, W, H, S, r) => {
      g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { const y = r() * H, a = 0.05 + r() * 0.07; g.fillStyle = r() < 0.6 ? `rgba(60,50,40,${a})` : `rgba(255,255,255,${a * 1.4})`; g.fillRect(0, y, W, (0.5 + r() * 1.5) * S); }   // long grain
      for (let i = 0; i < 500 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'; g.fillRect(r() * W, r() * H, S * 1.5, S * 1.5); }
    }, 41, 4);
  }
  // dark glazed roof tiles (kawara) for the Japanese houses: pan and cover tiles run down the slope; 4 m x 4 m per repeat
  function jpRoofTex() {
    return artTex('jpRoof', [512, 512], (g, W, H, S, r) => {
      g.fillStyle = '#3d4350'; g.fillRect(0, 0, W, H);
      const cw = 32 * S, courses = 10, ch = H / courses;
      for (let x = 0; x < W; x += cw) {                                                                 // cover tiles: a rounded ridge every second strip
        const k = Math.round(x / cw) % 2;
        const gr = g.createLinearGradient(x, 0, x + cw, 0);
        if (k) { gr.addColorStop(0, '#2a2f3a'); gr.addColorStop(0.3, '#6a7384'); gr.addColorStop(0.55, '#4b5262'); gr.addColorStop(1, '#232733'); } else { gr.addColorStop(0, '#303644'); gr.addColorStop(0.5, '#262b36'); gr.addColorStop(1, '#303644'); }
        g.fillStyle = gr; g.fillRect(x, 0, cw, H);
      }
      for (let y = 0; y < courses; y++) {                                                               // courses: a shadow under each tile end, a glint above
        const yy = y * ch, gr = g.createLinearGradient(0, yy, 0, yy + ch); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
        g.fillStyle = gr; g.fillRect(0, yy, W, ch);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, yy + ch - 2 * S, W, 2 * S);
      }
      for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rad = (10 + r() * 28) * S; wrapXY(W, H, x, y, rad, (X, Y) => blot(g, X, Y, rad, r() < 0.6 ? '20,22,30' : '150,160,180', 0.07 + r() * 0.08)); }
      for (let i = 0; i < 6000 * S * S; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(200,210,230,0.08)'; g.fillRect(r() * W, r() * H, S * 1.4, S * 1.4); }
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(96,120,80,0.22)'; g.beginPath(); g.ellipse(r() * W, r() * H, (4 + r() * 8) * S, (2 + r() * 3) * S, 0, 0, 7); g.fill(); }   // moss
    }, 42, 8);
  }
