  /* ---------- player car liveries: choice (per car, remembered) and the painter ----------
     Data lives in CONFIG.cars[i].liveries (src/handling/config.js). The paint is drawn once per change onto one canvas
     (tiles: left side / right side / top view, layout in art/car-geo.js: CT) that wraps the body, so stripes follow it.
     API for the menu:
       liveryList(carIndex)          -> [{ id, name, swatch: [hex, hex, hex] }]
       liveryIndex(carIndex)         -> chosen livery number for that car (default 0)
       setLivery(carIndex, liveryIx) -> remember (localStorage 'rallyLivery:<carId>' = livery id) and repaint if it is the current car
       applyLivery(carIndex?, ix?)   -> (art/car-model.js) rebuild / repaint the current car; optional args also choose first  */
  const liveryChoice = {};
  function liveryList(ci) { return CONFIG.cars[ci].liveries.map(l => ({ id: l.id, name: l.name, swatch: [l.base, l.a, l.b] })); }
  function liveryIndex(ci) {
    if (liveryChoice[ci] == null) {
      let k = 0;
      try { const id = localStorage.getItem('rallyLivery:' + CONFIG.cars[ci].id); const f = CONFIG.cars[ci].liveries.findIndex(l => l.id === id); if (f >= 0) k = f; } catch (e) { /* ignore */ }
      liveryChoice[ci] = k;
    }
    return liveryChoice[ci];
  }
  function setLivery(ci, li) {
    const list = CONFIG.cars[ci].liveries; li = ((li % list.length) + list.length) % list.length;
    liveryChoice[ci] = li;
    try { localStorage.setItem('rallyLivery:' + CONFIG.cars[ci].id, list[li].id); } catch (e) { /* ignore */ }
    if (ci === CONFIG.carIndex) applyLivery();
  }

  const hexS = (n) => '#' + n.toString(16).padStart(6, '0');
  const LFONT = '"Saira Condensed", "Arial Narrow", Impact, "Arial Black", sans-serif';
  // car-space rectangles of the doors etc., per car, for the shut lines (z front, z rear, belt y, sill y)
  const LV_BODY = [
    { door: [0.16, -0.42], belt: 0.26, sill: -0.27, handle: [-0.3, 0.17], cap: [-1.3, 0.14] },       // Kestrel
    { door: [0.5, -0.58], belt: 0.3, sill: -0.27, handle: [-0.42, 0.2], cap: [-1.55, 0.12] },        // Strada
  ];

  function paintLivery(cv, ci, L) {
    const S = cv.width / CT.W, ppm = CT.ppm * S, g = cv.getContext('2d'), B = LV_BODY[ci];
    const num = L.number || CONFIG.cars[ci].number, C = { base: hexS(L.base), a: hexS(L.a), b: hexS(L.b), c: hexS(L.c), nbg: hexS(L.numBg), nfg: hexS(L.numFg) };
    const TR = { L: [0, 0, CT.W, CT.hSide], R: [0, CT.hSide, CT.W, CT.hSide], T: [0, CT.topY0, CT.W, CT.topH] };
    // tile coordinates: z = along the car (nose +), y = height on the sides, or car x (left +) on the top tile
    const X = (t, z) => (t === 'L' ? CT.zMax - z : z + CT.zMax) * ppm;
    const Y = (t, y) => (t === 'T' ? CT.topY0 + (1 - y) * CT.ppm : (t === 'L' ? 0 : CT.hSide) + (CT.yTop - y) * CT.ppm) * S;
    const poly = (t, pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(X(t, p[0]), Y(t, p[1])) : g.moveTo(X(t, p[0]), Y(t, p[1]))); g.closePath(); g.fill(); };
    const rect = (t, z0, y0, z1, y1, col) => poly(t, [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], col);
    const circ = (t, z, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(X(t, z), Y(t, y), r * ppm, 0, 7); g.fill(); };
    const line = (t, pts, col, w) => { g.strokeStyle = col; g.lineWidth = w * ppm; g.lineJoin = 'miter'; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(X(t, p[0]), Y(t, p[1])) : g.moveTo(X(t, p[0]), Y(t, p[1]))); g.stroke(); };
    // text: h = cap height in metres; reads left to right for whoever looks at that tile (rotated on the top tile so it reads from the front)
    const word = (t, str, z, y, h, col, o = {}) => {
      if (!str || h <= 0) return;
      g.save(); g.translate(X(t, z), Y(t, y)); if (t === 'T') g.rotate(-Math.PI / 2); if (o.skew) g.transform(1, 0, -o.skew, 1, 0, 0);
      g.font = `${o.weight || 900} ${o.italic === false ? '' : 'italic '}${Math.round(h * ppm / 0.7)}px ${LFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (g.letterSpacing !== undefined) g.letterSpacing = Math.round((o.spacing || 0) * ppm) + 'px';
      if (o.stroke) { g.lineWidth = o.strokeW * ppm; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(str, 0, 0); }
      g.fillStyle = col; g.fillText(str, 0, 0); g.restore();
    };
    const tile = (t, fn) => { const r = TR[t]; g.save(); g.beginPath(); g.rect(r[0] * S, r[1] * S, r[2] * S, r[3] * S); g.clip(); fn(t); g.restore(); };
    const all = (fn) => { tile('L', fn); tile('R', fn); tile('T', fn); };
    const sides = (fn) => { tile('L', fn); tile('R', fn); };
    const tops = (fn) => tile('T', fn);
    const gz = (z) => z;                                                      // (readability)
    const spons = L.spons || [];
    // a number panel: round (disc) or square
    const numPanel = (t, z, y, r, square) => {
      if (square) { poly(t, [[z - r, y - r * 0.8], [z + r, y - r * 0.8], [z + r, y + r * 0.8], [z - r, y + r * 0.8]], C.nbg); }
      else { circ(t, z, y, r, C.nfg); circ(t, z, y, r * 0.93, C.nbg); }
      word(t, num, z, y - r * 0.04, r * (num.length > 1 ? 1.0 : 1.25), C.nfg, { italic: false, spacing: -0.01 });
    };

    g.fillStyle = C.base; g.fillRect(0, 0, cv.width, cv.height);
    const D = {
      ridgeline() {          // white car, navy mountain-ridge band along the sill, yellow sun line, navy roof
        sides((t) => {
          const ridge = [], top = (z, k) => -0.02 + (k % 2 ? 0.17 : 0.0) * (1.1 - (z + 2.2) / 6) - 0.06;
          for (let k = 0, z = 2.3; z > -2.4; k++, z -= 0.33) ridge.push([z, top(z, k) + (k % 3 === 0 ? 0.05 : 0)]);
          const outline = (dy) => ridge.map(p => [p[0], p[1] + dy]).concat([[-2.4, -0.8], [2.3, -0.8]]);
          poly(t, outline(0.045), C.a); poly(t, outline(0), C.b);
          rect(t, -2.3, 0.215, 2.3, 0.245, C.a);                                // belt line
          word(t, spons[0], 1.2, -0.2, 0.1, C.base, { spacing: 0.012 });
          word(t, spons[1], -1.2, -0.17, 0.085, C.base, { spacing: 0.01 });
        });
        tops((t) => {
          poly(t, [[2.2, 0.62], [2.2, -0.62], [1.1, -0.2], [1.1, 0.2]], C.b);
          poly(t, [[2.2, 0.5], [2.2, -0.5], [1.25, -0.16], [1.25, 0.16]].map(p => [p[0], p[1] * 0.0 + p[1]]), C.b);
          rect(t, 2.2, 0.08, 0.5, -0.08, C.a); rect(t, 0.4, 0.62, -0.95, -0.62, C.b); rect(t, 0.4, 0.07, -0.95, -0.07, C.a);
          rect(t, -1.4, 0.7, -2.2, -0.7, C.b);
        });
      },
      midnight() {           // navy car, big orange blade from the front arch to the tail, white pin-line, white panels
        sides((t) => {
          const blade = [[1.95, -0.3], [1.3, -0.04], [0.5, 0.1], [-0.6, 0.15], [-1.7, 0.2], [-2.3, 0.215], [-2.3, 0.08], [-1.8, 0.04], [-0.9, -0.02], [0.1, -0.1], [0.9, -0.24], [1.3, -0.3]];
          poly(t, blade, C.a);
          line(t, [[1.9, -0.18], [1.3, 0.05], [0.5, 0.185], [-0.6, 0.235], [-2.3, 0.27]], C.b, 0.018);
          poly(t, [[-1.0, -0.3], [-1.28, -0.3], [-1.05, 0.0], [-0.77, 0.0]], C.b);
          rect(t, -2.3, -0.3, 2.3, -0.24, C.c);
          word(t, spons[0], 1.0, -0.17, 0.085, C.b, { spacing: 0.02 });
          word(t, spons[1], -1.35, 0.07, 0.075, C.c, { spacing: 0.01 });
        });
        tops((t) => {
          for (let k = 0; k < 4; k++) { const z = 2.0 - k * 0.3; poly(t, [[z, 0.0], [z - 0.36, 0.5], [z - 0.52, 0.5], [z - 0.16, 0.0], [z - 0.52, -0.5], [z - 0.36, -0.5]], k % 2 ? C.b : C.a); }
          rect(t, 0.3, 0.62, -1.0, -0.62, C.b); rect(t, 0.3, 0.12, -1.0, -0.12, C.a);
        });
      },
      magma() {              // black car, flame shards rising from the sill, red-hot bonnet slashes
        sides((t) => {
          for (let k = 0; k < 9; k++) {
            const z0 = 2.0 - k * 0.5, h = 0.2 + 0.28 * (0.5 + 0.5 * Math.sin(k * 1.9 + 0.7)) * (1 - k * 0.04);
            poly(t, [[z0, -0.3], [z0 - 0.42, -0.3], [z0 - 0.62, -0.3 + h]], C.a);
            poly(t, [[z0 - 0.04, -0.3], [z0 - 0.3, -0.3], [z0 - 0.42, -0.3 + h * 0.5]], C.b);
          }
          rect(t, -2.3, -0.3, 2.3, -0.26, C.a);
          word(t, spons[0], 1.15, 0.1, 0.085, C.b, { spacing: 0.012 });
          word(t, spons[1], -1.4, 0.1, 0.08, C.b, { spacing: 0.012 });
        });
        tops((t) => {
          for (let k = 0; k < 5; k++) { const z = 2.15 - k * 0.27; poly(t, [[z, 0.8], [z - 0.12, 0.8], [z - 0.3, 0.0], [z - 0.12, -0.0]], C.a); poly(t, [[z, -0.8], [z - 0.12, -0.8], [z - 0.3, 0.0], [z - 0.12, 0.0]], C.a); }
          rect(t, 0.3, 0.62, -1.0, -0.62, C.c); rect(t, 0.3, 0.05, -1.0, -0.05, C.a);
        });
      },
      mint() {               // mint car, purple lower half with a checker strip, white roof
        sides((t) => {
          poly(t, [[2.3, -0.8], [2.3, -0.02], [1.5, -0.02], [0.9, 0.0], [-2.3, 0.0], [-2.3, -0.8]], C.a);
          for (let k = 0; k < 66; k++) { const z = 2.3 - k * 0.07; for (let r = 0; r < 2; r++) if ((k + r) % 2 === 0) rect(t, z, 0.0 + r * 0.07, z - 0.07, 0.07 + r * 0.07 - 0.0, C.b); }
          poly(t, [[0.15, 0.26], [-0.45, 0.26], [-0.9, 0.0], [-0.3, 0.0]], C.a);
          word(t, spons[0], 1.3, -0.17, 0.095, C.b, { spacing: 0.012 });
          word(t, spons[1], -1.45, 0.1, 0.075, C.a, { spacing: 0.01 });
        });
        tops((t) => {
          poly(t, [[2.2, 0.6], [2.2, -0.6], [1.0, -0.38], [1.0, 0.38]], C.a);
          for (let k = 0; k < 18; k++) { const z = 2.2 - k * 0.07; if (k % 2) rect(t, z, 0.64, z - 0.07, 0.57, C.b); else rect(t, z, -0.57, z - 0.07, -0.64, C.b); }
          rect(t, 0.4, 0.62, -1.0, -0.62, C.b); rect(t, 0.4, 0.2, -1.0, 0.14, C.a); rect(t, 0.4, -0.14, -1.0, -0.2, C.a);
        });
      },
      signal() {             // red car, white kick-up wedge, black sills, white twin stripes over the roof
        sides((t) => {
          poly(t, [[2.0, -0.2], [0.6, -0.03], [-1.2, 0.2], [-2.3, 0.3], [-2.3, 0.14], [-1.2, 0.0], [0.4, -0.2], [1.6, -0.3]], C.a);
          poly(t, [[2.3, -0.3], [2.3, -0.23], [1.9, -0.27], [1.7, -0.3]], C.b);
          rect(t, -2.3, -0.3, 2.3, -0.2 - 0.0, C.b);
          line(t, [[2.0, -0.2], [0.6, -0.03], [-1.2, 0.2], [-2.3, 0.3]], C.b, 0.02);
          word(t, spons[0], -1.5, 0.0, 0.085, C.base, { spacing: 0.012, italic: true });
          word(t, spons[1], 1.1, -0.25, 0.07, C.a, { spacing: 0.012 });
        });
        tops((t) => { rect(t, 2.2, 0.28, -2.2, 0.16, C.a); rect(t, 2.2, -0.16, -2.2, -0.28, C.a); rect(t, 2.2, 0.31, -2.2, 0.28, C.b); rect(t, 2.2, -0.28, -2.2, -0.31, C.b); });
      },
      lime() {               // lime car, black speed-hatch bars, teal lower band, black roof
        sides((t) => {
          for (let k = 0; k < 6; k++) { const z = -0.1 - k * 0.3; poly(t, [[z + 0.1, 0.3], [z - 0.06, 0.3], [z - 0.46, -0.3], [z - 0.3, -0.3]], C.a); }
          rect(t, -2.3, -0.3, 2.3, -0.2, C.b); rect(t, -2.3, -0.2, 2.3, -0.17, C.a);
          poly(t, [[2.3, 0.22], [1.0, 0.22], [0.85, 0.06], [2.3, 0.06]], C.a);
          word(t, spons[0], 1.55, 0.14, 0.085, C.base, { spacing: 0.012 });
          word(t, spons[1], 0.1, -0.25, 0.06, C.base, { spacing: 0.012 });
        });
        tops((t) => { poly(t, [[2.2, 0.36], [2.2, -0.36], [0.95, -0.1], [0.95, 0.1]], C.a); for (let k = 0; k < 5; k++) rect(t, 2.1 - k * 0.22, 0.7, 2.0 - k * 0.22, 0.45, C.a), rect(t, 2.1 - k * 0.22, -0.7, 2.0 - k * 0.22, -0.45, C.a); rect(t, 0.4, 0.7, -0.98, -0.7, C.a); });
      },
      violet() {             // purple car, cyan lightning zigzag along the flank, white lines, black-violet roof
        sides((t) => {
          const bolt = [[2.0, -0.05], [1.2, 0.13], [1.35, 0.0], [0.4, 0.2], [0.55, 0.04], [-0.4, 0.22], [-0.25, 0.06], [-1.3, 0.24], [-1.15, 0.08], [-2.3, 0.26]];
          line(t, bolt, C.b, 0.075); line(t, bolt, C.a, 0.045);
          rect(t, -2.3, -0.3, 2.3, -0.2, C.c); rect(t, -2.3, -0.2, 2.3, -0.185, C.a);
          word(t, spons[0], 0.9, -0.255, 0.055, C.b, { spacing: 0.02 });
          word(t, spons[1], -1.5, -0.1, 0.085, C.b, { spacing: 0.012 });
        });
        tops((t) => { line(t, [[2.2, 0.3], [1.6, -0.05], [1.9, -0.05], [1.0, -0.4]], C.a, 0.1); rect(t, 0.4, 0.62, -1.0, -0.62, C.c); rect(t, 0.4, 0.05, -1.0, -0.05, C.a); });
      },
      arctic() {             // ice-blue car, navy shard triangles up from the sill, orange line, navy roof
        sides((t) => {
          for (let k = 0; k < 13; k++) { const z = 2.35 - k * 0.37, h = 0.17 + 0.17 * ((k * 7) % 5) / 4; poly(t, [[z, -0.3], [z - 0.37, -0.3], [z - 0.18, -0.3 + h]], k % 3 === 0 ? C.b : C.a); }
          rect(t, -2.3, -0.3, 2.3, -0.26, C.a);
          for (let k = 0; k < 7; k++) { const z = 2.3 - k * 0.65; poly(t, [[z, 0.26], [z - 0.3, 0.26], [z - 0.62, 0.12], [z - 0.32, 0.12]], k % 2 ? C.a : C.b); }
          word(t, spons[0], 1.3, 0.1, 0.08, C.a, { spacing: 0.012 });
          word(t, spons[1], -1.4, 0.0, 0.08, C.a, { spacing: 0.012 });
        });
        tops((t) => { for (let k = 0; k < 6; k++) { const z = 2.15 - k * 0.2; poly(t, [[z, -0.65], [z - 0.2, -0.65], [z - 0.1, 0.65 - k * 0.0]], k % 2 ? C.a : C.b); } rect(t, 0.4, 0.62, -1.0, -0.62, C.a); rect(t, 0.4, 0.1, -1.0, -0.1, C.b); });
      },
    };
    (D[L.design] || D.ridgeline)();
    // common to every livery: shut lines, handle, fuel cap, number panels
    sides((t) => {
      // wing / spoiler endplate panel (the plates sample this part of the side tile)
      const wl = ((L.wing >> 16) & 255) * 0.3 + ((L.wing >> 8) & 255) * 0.59 + (L.wing & 255) * 0.11, wcol = hexS(L.wing);
      if (ci === 0) { rect(t, -2.1, 0.45, -1.55, 0.9, wcol); word(t, spons[2] || spons[0], -1.83, 0.69, 0.07, wl > 140 ? '#101418' : '#ffffff', { spacing: 0.01, italic: true }); }
      else { rect(t, -1.95, 0.8, -1.4, 0.9, wcol); word(t, 'KRR', -1.68, 0.86, 0.05, wl > 140 ? '#101418' : '#ffffff', { spacing: 0.01, italic: true }); }
      const d = B.door, ln = 'rgba(8,10,14,0.55)';
      line(t, [[d[0], B.belt], [d[0], B.sill]], ln, 0.011); line(t, [[d[1], B.belt], [d[1], B.sill]], ln, 0.011);
      line(t, [[d[0], B.sill], [d[1], B.sill]], ln, 0.008);
      rect(t, B.handle[0] + 0.07, B.handle[1] + 0.012, B.handle[0] - 0.07, B.handle[1] - 0.012, ln);
      circ(t, B.cap[0], B.cap[1], 0.065, ln);
      numPanel(t, (d[0] + d[1]) / 2 - 0.02, ci === 0 ? 0.0 : 0.02, 0.2, ci === 1);
      // second wordmark band above the rear arch for the first two sponsors was drawn per design
    });
    tops((t) => {
      numPanel(t, ci === 0 ? 1.45 : 1.25, 0.0, 0.2, false);
      word(t, 'KRR', ci === 0 ? -0.2 : -0.3, 0.0, 0.09, C.nbg, { italic: true, spacing: 0.02, stroke: C.nfg, strokeW: 0.02 });
      word(t, spons[2] || spons[0], ci === 0 ? 1.92 : 1.72, 0.0, 0.085, C.nbg, { italic: true, spacing: 0.02, stroke: C.nfg, strokeW: 0.02 });
    });
  }

  // number plate texture: a white (front) and a yellow (rear) plate with an invented format
  function paintPlate(text, rear) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = rear ? '#f1c232' : '#f4f4ee'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#16335f'; g.fillRect(0, 0, 40, 64); g.fillStyle = '#fff'; g.font = `800 20px ${LFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KR', 20, 32);
    g.fillStyle = '#111'; g.font = `800 46px ${LFONT}`; g.fillText(text, 150, 35);
    g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  // round door-number disc (also used by the rival cars in tracks/rivals.js)
  function drawNumber(c, num) {
    const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.fillStyle = '#0d1216'; g.font = '800 84px "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 64, 70);
  }
