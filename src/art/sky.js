  /* ---------- sky: a painted dome plus a far backdrop ring (hills, mountains, city skyline) ----------
     Everything is drawn once per stage with canvas, in code. Nothing is loaded from files.
     The dome is one sphere with a small shader: smooth gradient + sun/moon disc and glow + night stars, with the
     painted clouds laid on top (one wide texture covering elevation 0..45 degrees, so clouds are sharp).
     The ring is a cylinder around the camera at 1850 m with the ridge silhouettes. Its foot is the fog colour,
     so the far ground melts into it. Both follow the camera, so they never come closer.
     Stage looks set it all in `look.sky` and `look.ridge` (see tracks/stages.js). 'low' draws the same pictures at half size.
     Far landmarks: a stage look may list `landmarks: [ { kind, az, dist, ... } ]`, painted on the ring in front of a ridge layer (nothing is drawn if the look has none).
       kind: 'mast' (lattice radio mast, red lights) | 'dam' (concrete wall) | 'town' (far town: roofs and warm lights) | 'spire' (village church with a spire) |
             'bridge' (a viaduct on arches) | 'tower' (stone lookout / lit tower; lit: true) | 'mesa' (flat-topped red rock) | 'windfarm' (little turbines)
       az: compass bearing in degrees from the world's +z axis towards +x (same as sunAz); dist: metres away (default per kind; size is real metres, so a bigger dist makes it smaller);
       h / w: real height / width in metres (defaults per kind); layer: which ridge layer it stands on (default the nearest, last); col: hex colour; mist: 0..1 haze (default 0.35);
       lit: lights on (always on when the look is `night`). */
  const DEG = Math.PI / 180, RAW = THREE.LinearSRGBColorSpace;           // RAW: take the hex numbers as they are (no sRGB -> linear): the sky shader works in display colours
  const SKY_EL = 45;                                                   // degrees of sky covered by the painted cloud texture
  const RING_R = 1850, RING_LO = -200, RING_HI = 320;                  // ring: radius and the heights (m, relative to the eye) it spans
  const skyU = {
    top: { value: new THREE.Color(0x2f7fe0) }, mid: { value: new THREE.Color(0x7cc2ff) }, bottom: { value: new THREE.Color(0xc4e8ff) },
    tSky: { value: null }, tMoon: { value: null },
    uElMax: { value: Math.sin(SKY_EL * DEG) }, uDrift: { value: 0 }, uTime: { value: 0 }, uStars: { value: 0 }, uMoon: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSunSize: { value: 0.03 }, uSunCos: { value: new THREE.Vector2(0.9, 0.95) },
    uGlowCol: { value: new THREE.Color(1, 0.7, 0.4) }, uGlowAmt: { value: 0 }, uBand: { value: 0 },
    uShade: { value: new THREE.Color(0.6, 0.7, 0.9) }, uLit: { value: new THREE.Color(1, 1, 1) }, uRim: { value: new THREE.Color(1, 0.9, 0.7) },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; varying vec2 vU; void main(){ vP = position; vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform sampler2D tSky; uniform sampler2D tMoon;
      uniform float uElMax; uniform float uDrift; uniform float uTime; uniform float uStars; uniform float uMoon;
      uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunSize; uniform vec3 uGlowCol; uniform float uGlowAmt; uniform float uBand;
      uniform vec3 uShade; uniform vec3 uLit; uniform vec3 uRim; uniform vec2 uSunCos;
      varying vec3 vP; varying vec2 vU;
      float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vP);
        float t = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(bottom, mid, smoothstep(0.0, 0.13, t));
        c = mix(c, top, smoothstep(0.1, 0.7, t));
        float cs = dot(d, uSunDir), pc = max(cs, 0.0);
        c += uGlowCol * uBand * exp(-t * 6.0) * (0.3 + 0.7 * pc) * step(0.0, d.y);                                  // warm band along the horizon, strongest towards the sun
        c += uGlowCol * uGlowAmt * (pow(pc, 6.0) * 0.5 + pow(pc, 60.0) * 0.9);                      // glow around the sun / moon
        if (uStars > 0.5 && d.y > 0.0) {
          vec3 q = d * 64.0; vec3 id = floor(q); vec3 f = q - id;
          float h = h31(id);
          if (h > 0.95) {
            vec3 o = vec3(h31(id + 3.1), h31(id + 7.7), h31(id + 11.3)) * 0.4 + 0.3;
            float big = step(0.99, h);
            float sz = 0.16 + 0.1 * fract(h * 91.0) + big * 0.1;
            float s = smoothstep(sz, 0.0, length(f - o));
            float tw = 0.8 + 0.2 * sin(uTime * (1.5 + 4.0 * fract(h * 13.0)) + h * 50.0);
            c += mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.92, 0.78), fract(h * 7.0)) * s * (0.8 + 1.0 * big) * tw * smoothstep(0.0, 0.12, d.y);
          }
          c += vec3(0.05, 0.06, 0.11) * exp(-pow(dot(d, normalize(vec3(0.5, 0.2, -0.8))) * 4.5, 2.0)) * smoothstep(0.0, 0.3, d.y);   // faint Milky Way
        }
        if (uMoon > 0.5) {
          vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), uSunDir)); vec3 up = cross(uSunDir, rt);
          vec2 m = vec2(dot(d, rt), dot(d, up)) / uSunSize * 0.5 + 0.5;
          vec4 mt = texture2D(tMoon, clamp(m, 0.0, 1.0));
          float inside = step(0.0, cs) * step(abs(m.x - 0.5), 0.5) * step(abs(m.y - 0.5), 0.5);
          c = mix(c, mt.rgb * uSunCol, mt.a * inside);
        } else {
          c = mix(c, uSunCol, smoothstep(uSunCos.x, uSunCos.y, cs));
        }
        vec4 p = texture2D(tSky, vec2(fract(vU.x + 0.25 + uDrift), clamp(t / uElMax, 0.0, 1.0)));       // u from the sphere's own uv (no atan); v = sin(elevation)
        vec3 cc = mix(uShade, uLit, p.r);
        cc = mix(cc, uRim, pow(pc, 3.0) * smoothstep(0.4, 1.0, p.r));
        cc = mix(cc, bottom, (1.0 - smoothstep(0.0, 0.3, t)) * 0.5);                               // far clouds melt into the haze
        c = mix(c, cc, p.a * smoothstep(0.0, 0.03, t));
        gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(2.2)), 1.0);                                // the dome is painted in display colours (gradients, glow, stars all as before); to linear for the scene target
      }`,
  }));
  scene.add(sky);

  const ringMat = new THREE.MeshBasicMaterial({ map: srgb(new THREE.CanvasTexture(document.createElement('canvas'))), transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(RING_R, RING_R, RING_HI - RING_LO, 64, 1, true), ringMat);
  ring.frustumCulled = false; scene.add(ring);

  /* ---- painters ---- */
  const hexCss = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a == null ? 1 : a})`;
  const mixHex = (a, b, t) => { const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
  function skyCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function skyTexture(c) { const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t; }

  // one painted cloud: round puffs, each lit from one side (grey = how much light it gets; the shader colours it). (cx, cy) = bottom centre.
  function paintCloud(g, cx, cy, w, h, r, o) {
    const n = o.puffs || 12, list = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.15 + r() * 0.7) / n, prof = Math.pow(Math.sin(Math.PI * t), o.round || 0.9);
      const rad = h * (0.2 + r() * 0.22) * (0.5 + prof * 0.8);
      list.push([(t - 0.5) * w, -(rad * 0.8 + prof * h * (0.25 + 0.6 * r()) * (o.tall || 1)), rad]);
    }
    for (let i = 0; i < n * 0.7; i++) { const t = r(), prof = Math.sin(Math.PI * (0.05 + 0.9 * t)), rad = h * (0.16 + 0.12 * r()) * (0.6 + prof * 0.6); list.push([(t - 0.5) * w * 0.95, -rad * 0.9, rad]); }
    list.sort((a, b) => a[1] - b[1]);                                        // top puffs first, lower ones overlap them
    g.save(); g.translate(cx, cy); g.scale(1, o.squash || 1);
    if (o.flat) { g.beginPath(); g.rect(-w, -h * 4, w * 2, h * 4 + 1); g.clip(); }
    for (const [x, y, rad] of list) {
      const gr = g.createRadialGradient(x + o.lx * rad, y + o.ly * rad, rad * 0.04, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(226,226,226,1)'); gr.addColorStop(0.82, 'rgba(150,150,150,1)'); gr.addColorStop(0.95, 'rgba(105,105,105,1)'); gr.addColorStop(1, 'rgba(105,105,105,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    if (o.flat) { g.globalCompositeOperation = 'source-atop'; const gr = g.createLinearGradient(0, -h * 0.4, 0, 0); gr.addColorStop(0, 'rgba(70,70,70,0)'); gr.addColorStop(1, 'rgba(70,70,70,0.6)'); g.fillStyle = gr; g.fillRect(-w, -h * 0.4, w * 2, h * 0.4); }
    g.restore();
  }
  function paintSkyLayer(g, W, H, L) {
    const S = L.sky, r = mulberry32(S.seed || 5), pxX = W / 360, yOf = (e) => H * (1 - Math.sin(e * DEG) / Math.sin(SKY_EL * DEG));      // v = sin(elevation)
    g.clearRect(0, 0, W, H);
    if (!S.clouds) return;
    const place = (az, el, wDeg, hDeg, o) => {
      const w = wDeg * pxX / Math.max(0.45, Math.cos(el * DEG)), cy = yOf(el), h = cy - yOf(el + hDeg), x0 = (((az % 360) + 360) % 360 / 360) * W;
      for (const dx of [-W, 0, W]) { const cx = x0 + dx; if (cx + w / 2 < 0 || cx - w / 2 > W) continue; paintCloud(g, cx, cy, w, h, mulberry32(Math.floor(r() * 1e9)), o); }
    };
    const list = [];
    if (S.clouds === 'cumulus') {
      for (let i = 0; i < 16; i++) { const el = 3.5 + r() * 6, wd = 14 + r() * 20; list.push([r() * 360, el, wd, wd * (0.2 + r() * 0.14), { puffs: 13 + Math.floor(wd / 2.2), lx: -0.28, ly: -0.38, flat: true, tall: 1 }]); }   // big towers lining the horizon
      for (let i = 0; i < 14; i++) { const el = 11 + r() * 14, wd = 12 + r() * 20; list.push([r() * 360, el, wd, wd * (0.2 + r() * 0.12), { puffs: 12 + Math.floor(wd / 2.5), lx: -0.28, ly: -0.38, flat: true, tall: 1 }]); }
      for (let i = 0; i < 8; i++) { const el = 24 + r() * 14, wd = 14 + r() * 22; list.push([r() * 360, el, wd, wd * (0.22 + r() * 0.1), { puffs: 12 + Math.floor(wd / 2.5), lx: -0.28, ly: -0.38, flat: true, tall: 1 }]); }
    } else if (S.clouds === 'sunset') {
      for (let i = 0; i < 40; i++) { const el = 3 + Math.pow(r(), 1.25) * 34, wd = (20 + r() * 46) * (0.55 + el / 50); list.push([r() * 360, el, wd, wd * (0.045 + r() * 0.04), { puffs: 16 + Math.floor(wd / 2), lx: 0.05, ly: 0.5, squash: 0.55, tall: 0.5, round: 0.5 }]); }
    } else {
      for (let i = 0; i < 12; i++) { const el = 4 + r() * 30, wd = 25 + r() * 40; list.push([r() * 360, el, wd, wd * 0.05, { puffs: 14, lx: -0.2, ly: -0.5, squash: 0.5, tall: 0.5, round: 0.5 }]); }
    }
    list.sort((a, b) => a[1] - b[1]);
    for (const a of list) place(...a);
    // keep the zenith clean: the clouds fade out towards the top edge of the texture
    g.globalCompositeOperation = 'destination-out'; const gr = g.createLinearGradient(0, 0, 0, H * 0.22); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.22); g.globalCompositeOperation = 'source-over';
  }
  function paintMoon(sz) {
    const c = skyCanvas(sz, sz), g = c.getContext('2d'), r = mulberry32(61), R = sz / 2;
    g.beginPath(); g.arc(R, R, R * 0.97, 0, 7); g.clip();
    const gr = g.createRadialGradient(R * 0.8, R * 0.78, R * 0.1, R, R, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f1f1e6'); gr.addColorStop(1, '#cfd3d6'); g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
    for (let i = 0; i < 7; i++) { const x = R + (r() - 0.5) * R * 1.1, y = R + (r() - 0.5) * R * 1.0, rad = R * (0.14 + r() * 0.2), gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, 'rgba(120,130,150,0.5)'); gg.addColorStop(1, 'rgba(120,130,150,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { const x = R + (r() - 0.5) * R * 1.7, y = R + (r() - 0.5) * R * 1.7, rad = R * (0.025 + r() * 0.05); g.strokeStyle = 'rgba(110,120,140,0.45)'; g.lineWidth = Math.max(1, R * 0.012); g.beginPath(); g.arc(x, y, rad, 0, 7); g.stroke(); }
    return c;
  }

  // periodic value noise (tiles around the full circle): ridge height 0..1 at u in 0..1
  function ridgeFn(seed, per, oct, jag) {
    const layers = [];
    for (let k = 0; k < oct; k++) { const n = per * (1 << k), rr = mulberry32(seed * 31 + k * 17), v = []; for (let i = 0; i < n; i++) v.push(rr()); layers.push({ n, v, a: Math.pow(0.5, k) }); }
    let tot = 0; for (const l of layers) tot += l.a;
    return (u) => {
      let s = 0;
      for (const l of layers) {
        const x = u * l.n, i = Math.floor(x), f = x - i, a = l.v[((i % l.n) + l.n) % l.n], b = l.v[(((i + 1) % l.n) + l.n) % l.n], k = jag ? f : f * f * (3 - 2 * f);
        let n = a + (b - a) * k; if (jag) n = 1 - Math.abs(2 * n - 1) * 0.9; s += n * l.a;
      }
      return s / tot;
    };
  }
  function paintBackdrop(g, W, H, L) {
    const S = L.sky, Y = H / 256, hz = H * (RING_HI / (RING_HI - RING_LO)), haze = L.horizon, r = mulberry32((S.seed || 5) + 99);
    g.clearRect(0, 0, W, H);
    L.ridge.forEach((ly, li) => {
      const f = ridgeFn((S.seed || 5) + li * 7, ly.per, ly.oct, ly.jag), base = hz - ly.base * Y, amp = ly.amp * Y, pts = [];
      for (let x = 0; x <= W; x += 2) pts.push([x, base - f(x / W) * amp]);
      let top = H; for (const p of pts) top = Math.min(top, p[1]);
      const foot = Math.max(hz + 6 * Y, base + 5 * Y), gr = g.createLinearGradient(0, top, 0, foot), kb = clamp((base - top) / (foot - top), 0.05, 0.95);
      gr.addColorStop(0, hexCss(ly.col)); gr.addColorStop(kb, hexCss(mixHex(ly.col, haze, ly.mist))); gr.addColorStop(1, hexCss(haze));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, H); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(W, H); g.closePath(); g.fill();
      if (S.city && li === (S.cityAt || 0)) paintCity(g, W, H, L, hz, Y, r);
      if (L.landmarks) for (const lm of L.landmarks) if ((lm.layer != null ? lm.layer : L.ridge.length - 1) === li) paintLandmark(g, W, H, L, lm, (xx) => base - f(xx / W) * amp, ly.col, hz, haze);
      if (ly.snow) {                                                       // snow caps on the high points
        g.fillStyle = hexCss(ly.snow, 0.9);
        for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], hgt = base - p[1]; if (hgt > amp * 0.62) { g.fillRect(p[0], p[1], 2.4, Math.min((hgt - amp * 0.62) * 0.9, 16 * Y)); } }
      }
      if (ly.trees) {                                                      // a fringe of tiny conifers along the ridge
        g.fillStyle = hexCss(ly.treeCol || ly.col);
        for (let x = 0; x < W; x += 2 + r() * 3) { const yy = base - f(x / W) * amp, hh = (4 + r() * 6) * Y; g.beginPath(); g.moveTo(x - hh * 0.28, yy + 2); g.lineTo(x, yy - hh); g.lineTo(x + hh * 0.28, yy + 2); g.fill(); }
      }
    });
    const low = hz + Math.max(6, ...L.ridge.map(l => 5 - l.base)) * Y; g.fillStyle = hexCss(haze); g.fillRect(0, low, W, H - low);
  }
  // one far landmark standing on the ridge (see the header of this file). Sizes are real metres at lm.dist, scaled to the ring (1850 m) and to the picture's own stretch.
  const LM_DEF = { mast: [3500, 120, 30], dam: [3000, 70, 320], town: [3500, 40, 900], spire: [2500, 45, 40], bridge: [3000, 45, 520], tower: [3000, 60, 22], mesa: [4500, 160, 900], windfarm: [3500, 90, 1200] };
  const LM_BIG = { mast: [3, 2], spire: [3, 2.2], town: [2.5, 1.3] };   // height / width boost so they read as silhouettes from the road
  function paintLandmark(g, W, H, L, lm, ridgeY, ridgeCol, hz, haze) {
    const d = LM_DEF[lm.kind]; if (!d) return;
    const dist = lm.dist || d[0], bigK = lm.scale != null ? [lm.scale, lm.scale] : (LM_BIG[lm.kind] || [1.5, 1.5]), hM = (lm.h || d[1]) * bigK[0], wM = (lm.w || d[2]) * bigK[1], sc = RING_R / dist, ky = H / (RING_HI - RING_LO), kx = W / (2 * Math.PI * RING_R);
    const hp = (m) => m * sc * ky, wp = (m) => m * sc * kx, Y = H / 256, night = !!L.night || !!lm.lit, r = mulberry32(Math.floor((lm.az || 0) * 7) + 3);
    const x0 = (((lm.az || 0) % 360) + 360) % 360 / 360 * W, gy = ridgeY(x0) + 1.5 * Y;
    const base = lm.col != null ? lm.col : mixHex(ridgeCol, 0x12141a, 0.8), col = hexCss(mixHex(base, haze, lm.mist != null ? lm.mist : 0.12)), dark = hexCss(mixHex(base, haze, (lm.mist != null ? lm.mist : 0.12) + 0.15));
    const light = (x, y, c, size) => { g.save(); g.shadowColor = c; g.shadowBlur = (night ? 8 : 4) * Y; g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(1, size * Y), 0, 7); g.fill(); g.restore(); };
    const copies = [-W, 0, W];
    for (const dx of copies) {
      const x = x0 + dx; if (x + wp(wM) < 0 || x - wp(wM) > W) continue;
      g.save(); g.translate(x, gy); g.fillStyle = col; g.strokeStyle = col;
      if (lm.kind === 'mast') {
        const h = hp(hM), bw = Math.max(2, wp(wM) * 0.5);
        g.lineWidth = Math.max(2.5, 2.4 * Y); g.beginPath(); g.moveTo(-bw, 0); g.lineTo(-0.5, -h); g.moveTo(bw, 0); g.lineTo(0.5, -h); g.stroke();
        for (let i = 0; i < 9; i++) { const t0 = i / 9, t1 = (i + 1) / 9, w0 = bw * (1 - t0) + 0.5 * t0, w1 = bw * (1 - t1) + 0.5 * t1; g.beginPath(); g.moveTo(-w0, -h * t0); g.lineTo(w1, -h * t1); g.moveTo(w0, -h * t0); g.lineTo(-w1, -h * t1); g.stroke(); }
        g.fillRect(-bw * 0.5, -h * 0.72, bw, Math.max(1.5, h * 0.03)); g.fillRect(-0.5, -h - h * 0.12, 1, h * 0.12);
        light(0, -h - h * 0.12, '#ff3030', 1.6); light(0, -h * 0.55, '#ff4040', 1.1);
      } else if (lm.kind === 'dam') {
        const h = hp(hM), w = wp(wM);
        g.beginPath(); g.moveTo(-w / 2, 4 * Y); g.lineTo(-w / 2 + w * 0.04, -h); g.lineTo(w / 2 - w * 0.04, -h); g.lineTo(w / 2, 4 * Y); g.closePath(); g.fillStyle = hexCss(mixHex(base, 0xdadada, 0.5)); g.globalAlpha = 0.95; g.fill(); g.globalAlpha = 1;
        g.fillStyle = dark; for (let i = 1; i < 12; i++) g.fillRect(-w / 2 + w * i / 12 - 0.5, -h * 0.95, Math.max(1, w * 0.012), h * 0.9);
        g.fillRect(-w / 2 + w * 0.04, -h, w * 0.92, Math.max(1, h * 0.07)); g.fillStyle = 'rgba(70,110,150,0.5)'; g.fillRect(w * 0.12, -h * 0.25, w * 0.3, h * 0.25);
      } else if (lm.kind === 'town') {
        const w = wp(wM), h = hp(hM), n = Math.max(12, Math.round(w / 2.2));
        if (night) { const gl = g.createRadialGradient(0, -h * 0.4, 0, 0, -h * 0.4, w * 0.6); gl.addColorStop(0, 'rgba(255,190,110,0.45)'); gl.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gl; g.fillRect(-w * 0.7, -h * 2, w * 1.4, h * 2.2); }
        for (let i = 0; i < n; i++) {
          const bx = (r() - 0.5) * w, k = 1 - Math.abs(bx) / (w / 2), bh = (0.25 + r() * 0.75) * h * (0.35 + 0.65 * k), bwid = Math.max(1.6, (1.2 + r() * 2.2) * Y);
          g.fillStyle = col; g.fillRect(bx, -bh, bwid, bh + 1);
          if (r() < 0.3) { g.beginPath(); g.moveTo(bx - 0.5, -bh); g.lineTo(bx + bwid / 2, -bh - bwid * 0.8); g.lineTo(bx + bwid + 0.5, -bh); g.fill(); }
          for (let yy = 2 * Y; yy < bh - 1; yy += 2.6 * Y) if (r() < (night ? 0.65 : 0.1)) { g.fillStyle = night ? ['#ffd890', '#ffc070', '#fff0c0'][Math.floor(r() * 3)] : 'rgba(255,250,230,0.7)'; g.fillRect(bx + 0.4, -yy - Y, Math.max(1, bwid * 0.5), Math.max(1, Y)); }
        }
      } else if (lm.kind === 'spire') {
        const h = hp(hM), w = wp(wM), nh = h * 0.35;
        g.fillRect(-w / 2, -nh, w, nh + 1); g.beginPath(); g.moveTo(-w / 2 - 1, -nh); g.lineTo(0, -nh - h * 0.18); g.lineTo(w / 2 + 1, -nh); g.fill();
        const tw = w * 0.28; g.fillRect(w * 0.2 - tw / 2, -h * 0.62, tw, h * 0.62); g.beginPath(); g.moveTo(w * 0.2 - tw / 2 - 0.6, -h * 0.62); g.lineTo(w * 0.2, -h); g.lineTo(w * 0.2 + tw / 2 + 0.6, -h * 0.62); g.fill(); g.fillStyle = dark; g.fillRect(w * 0.2 - 0.5, -h * 0.5, Math.max(1, tw * 0.2), h * 0.1);
      } else if (lm.kind === 'bridge') {
        const w = wp(wM), h = hp(hM), spans = Math.max(4, Math.round(wM / 60)), sw = w / spans, deck = Math.max(1.5, h * 0.12);
        g.fillRect(-w / 2, -h, w, deck); g.fillStyle = dark;
        for (let i = 0; i <= spans; i++) g.fillRect(-w / 2 + i * sw - Math.max(1, sw * 0.07), -h + deck, Math.max(1.5, sw * 0.14), h - deck + 2 * Y);
        g.strokeStyle = col; g.lineWidth = Math.max(1, sw * 0.07); for (let i = 0; i < spans; i++) { g.beginPath(); g.arc(-w / 2 + (i + 0.5) * sw, -h + deck + (h - deck) * 0.62, sw * 0.42, Math.PI, 0); g.stroke(); }
        if (night) for (let i = 0; i < 9; i++) light(-w / 2 + w * (i + 0.5) / 9, -h - 1, '#ffd890', 0.6);
      } else if (lm.kind === 'tower') {
        const h = hp(hM), w = wp(wM);
        g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w * 0.32, -h * 0.82); g.lineTo(w * 0.32, -h * 0.82); g.lineTo(w / 2, 0); g.closePath(); g.fill();
        g.fillRect(-w * 0.5, -h * 0.98, w, h * 0.16); for (let i = -2; i <= 2; i++) g.fillRect(i * w * 0.22 - w * 0.06, -h * 1.06, w * 0.12, h * 0.09);
        if (night) { g.fillStyle = '#ffe9b0'; g.fillRect(-w * 0.34, -h * 0.9, w * 0.68, Math.max(1, h * 0.05)); light(0, -h * 1.1, '#ff5050', 1.2); for (let i = 0; i < 4; i++) light(0, -h * (0.15 + i * 0.18), '#bfe0ff', 0.7); }
        else { g.fillStyle = dark; g.fillRect(-w * 0.05, -h * 0.9, w * 0.1, h * 0.1); }
      } else if (lm.kind === 'mesa') {
        const w = wp(wM), h = hp(hM);
        g.beginPath(); g.moveTo(-w / 2, 2 * Y); g.lineTo(-w * 0.42, -h * 0.35); g.lineTo(-w * 0.38, -h); g.lineTo(w * 0.34, -h); g.lineTo(w * 0.4, -h * 0.4); g.lineTo(w / 2, 2 * Y); g.closePath(); g.fillStyle = hexCss(mixHex(lm.col != null ? lm.col : 0xa8553a, haze, lm.mist != null ? lm.mist : 0.35)); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.13)'; for (let i = 0; i < 5; i++) g.fillRect(-w * 0.42 + i * w * 0.18, -h * 0.9, w * 0.07, h * 0.9);
      } else if (lm.kind === 'windfarm') {
        const w = wp(wM), h = hp(hM), n = 7; g.lineWidth = Math.max(1, 0.7 * Y);
        for (let i = 0; i < n; i++) { const tx = (i / (n - 1) - 0.5) * w, th = h * (0.75 + 0.25 * r()), a = r() * 6.28; g.beginPath(); g.moveTo(tx, 0); g.lineTo(tx, -th); for (let b = 0; b < 3; b++) { g.moveTo(tx, -th); g.lineTo(tx + Math.cos(a + b * 2.094) * th * 0.45, -th + Math.sin(a + b * 2.094) * th * 0.45); } g.stroke(); if (night) light(tx, -th, '#ff3030', 0.8); }
      }
      g.restore();
    }
  }
  // a far-off lit city: dark towers with window dots, a few glowing blue outlines and red beacons, with a haze of light behind
  function paintCity(g, W, H, L, hz, Y, r) {
    const cl = ridgeFn(77, 6, 2, 0);
    const glow = g.createLinearGradient(0, hz - 60 * Y, 0, hz); glow.addColorStop(0, 'rgba(120,90,200,0)'); glow.addColorStop(1, 'rgba(150,110,220,0.42)'); g.fillStyle = glow; g.fillRect(0, hz - 60 * Y, W, 60 * Y);
    const wins = ['#ffd890', '#ffe9b0', '#bfe0ff', '#9fd0ff', '#ffc070', '#ffffff'];
    for (let x = 0; x < W;) {
      const dens = cl(x / W), w = (5 + r() * 14) * Y, bh = (6 + r() * 52 * dens + (r() < 0.07 ? 40 * dens : 0)) * Y;
      if (dens < 0.38 && r() < 0.7) { x += w * 0.5; continue; }
      const y0 = hz - bh;
      const body = g.createLinearGradient(0, y0, 0, hz); body.addColorStop(0, 'rgb(14,18,48)'); body.addColorStop(1, 'rgb(34,36,86)');
      g.fillStyle = body; g.fillRect(x, y0, w, bh + 2 * Y);
      const neon = r() < 0.22;
      if (neon) { g.save(); g.shadowColor = '#5fb0ff'; g.shadowBlur = 7 * Y; g.fillStyle = '#9fd4ff'; g.fillRect(x, y0, Math.max(1, 1.2 * Y), bh); g.fillRect(x + w - 1.2 * Y, y0, Math.max(1, 1.2 * Y), bh); g.fillRect(x, y0, w, Math.max(1, 1.2 * Y)); g.restore(); }
      for (let wy = y0 + 3 * Y; wy < hz - 2 * Y; wy += 3.6 * Y) for (let wx = x + 1.6 * Y; wx < x + w - 1.6 * Y; wx += 3 * Y) if (r() < 0.38) { g.fillStyle = wins[Math.floor(r() * wins.length)]; g.globalAlpha = 0.45 + r() * 0.5; g.fillRect(wx, wy, Math.max(1, 1.5 * Y), Math.max(1, 1.8 * Y)); }
      g.globalAlpha = 1;
      if (bh > 36 * Y && r() < 0.6) { g.save(); g.shadowColor = '#ff3030'; g.shadowBlur = 6 * Y; g.fillStyle = '#ff5050'; g.fillRect(x + w / 2 - Y, y0 - 3 * Y, 2 * Y, 2 * Y); g.restore(); }
      x += w + (r() < 0.3 ? r() * 6 * Y : 0);
    }
  }

  /* ---- build the sky for a stage look (called by applyLook) ---- */
  let skyBuilt = null;                                                     // { look, low, textures } so a quality switch repaints
  function buildSky(L) {
    const low = quality === 'low', S = L.sky, k = low ? 2 : 1;
    if (skyBuilt) { for (const t of skyBuilt.textures) t.dispose(); }
    const sc = skyCanvas(4096 / k, 512 / k), rc = skyCanvas(4096 / k, 256 / k);
    paintSkyLayer(sc.getContext('2d'), sc.width, sc.height, L);
    paintBackdrop(rc.getContext('2d'), rc.width, rc.height, L);
    const texSky = skyTexture(sc), texRing = srgb(skyTexture(rc)), textures = [texSky, texRing];
    texRing.wrapT = THREE.ClampToEdgeWrapping;
    skyU.tSky.value = texSky; ringMat.map = texRing; ringMat.needsUpdate = true;
    if (S.moon) { const tm = new THREE.CanvasTexture(paintMoon(low ? 128 : 256)); tm.wrapS = tm.wrapT = THREE.ClampToEdgeWrapping; skyU.tMoon.value = tm; textures.push(tm); }
    else skyU.tMoon.value = texSky;
    skyU.top.value.setHex(L.skyTop, RAW); skyU.mid.value.setHex(L.skyMid, RAW); skyU.bottom.value.setHex(L.horizon, RAW);
    const el = L.sunEl * DEG, az = L.sunAz * DEG;
    skyU.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    skyU.uSunCol.value.setHex(S.sunCol, RAW); skyU.uSunSize.value = S.sunSize; skyU.uSunCos.value.set(Math.cos(S.sunSize), Math.cos(S.sunSize * 0.85)); skyU.uMoon.value = S.moon ? 1 : 0;
    skyU.uGlowCol.value.setHex(S.glowCol, RAW); skyU.uGlowAmt.value = S.glowAmt; skyU.uBand.value = S.band || 0;
    skyU.uShade.value.setHex(S.shade, RAW); skyU.uLit.value.setHex(S.lit, RAW); skyU.uRim.value.setHex(S.rim, RAW);
    skyU.uStars.value = S.stars ? 1 : 0;
    skyBuilt = { look: L, low, textures };
  }
  // per frame: dome and ring follow the camera; clouds drift very slowly
  function updateSky(dt) {
    if (skyBuilt && skyBuilt.low !== (quality === 'low')) buildSky(skyBuilt.look);
    skyU.uTime.value += dt; skyU.uDrift.value = (skyU.uDrift.value + dt * 0.0006) % 1;
    sky.position.copy(camera.position); ring.position.set(camera.position.x, camera.position.y + (RING_HI + RING_LO) / 2, camera.position.z);
  }

  /* ---- far-object culling: a mesh that is further away than the fog's far distance is invisible anyway (it is all fog colour),
     so it is not drawn. Saves draw calls in the town stage, where ~200 separate buildings sit ahead of the car. Instanced
     meshes are left alone (one draw call each). ---- */
  let cullStage = null, cullList = [];
  function cullFar() {
    if (!stageGroup) return;
    if (cullStage !== stageGroup) {
      cullStage = stageGroup; cullList = []; stageGroup.updateMatrixWorld(true);
      stageGroup.children.forEach(o => {
        if (!o.isMesh || o.isInstancedMesh || !o.material || Array.isArray(o.material) || o.material.fog === false || !o.geometry) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const bs = o.geometry.boundingSphere, sc = o.matrixWorld.getMaxScaleOnAxis();
        cullList.push({ o, c: bs.center.clone().applyMatrix4(o.matrixWorld), r: bs.radius * sc });
      });
    }
    const far = scene.fog.far, cx = camera.position.x, cz = camera.position.z;
    for (const e of cullList) { const dx = e.c.x - cx, dz = e.c.z - cz, lim = far + e.r; e.o.visible = dx * dx + dz * dz < lim * lim; }
  }
