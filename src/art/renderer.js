  /* ---------- renderer, scene, lights ---------- */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);                                      // the post pass renders at a lower internal resolution anyway
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const skyCol = new THREE.Color(0xc4e8ff);                     // horizon haze
  scene.background = skyCol;
  scene.fog = new THREE.Fog(skyCol, 140, 620);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2600);

  /* PS2-era look: per-vertex (Gouraud) lighting, tiled bitmap textures, glossy car paint with a sky reflection */
  const lit = (p) => new THREE.MeshLambertMaterial(p);
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function makeTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; return t;
  }
  const trng = mulberry32(99);
  const wrapDraw = (g, w, h, x, y, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(x + dx, y + dy); };   // seamless tiling
  const TEX = {
    // light, slightly varied ground detail; the vertex colours give it its hue
    ground: makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const x = trng() * w, y = trng() * h, r = 14 + trng() * 30, v = trng() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'; wrapDraw(g, w, h, x, y, (X, Y) => { g.fillStyle = v; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill(); }); }
      for (let i = 0; i < 2600; i++) { const x = trng() * w, y = trng() * h, l = 2 + trng() * 4, d = trng() < 0.55; g.strokeStyle = d ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (trng() - 0.5) * 2, y - l); g.stroke(); }
    }),
    // road surface: loose stones with two darker, packed tyre tracks
    road: makeTex(256, 512, (g, w, h) => {
      g.fillStyle = '#dedede'; g.fillRect(0, 0, w, h);
      for (const u of [0.29, 0.71]) { const grd = g.createLinearGradient((u - 0.09) * w, 0, (u + 0.09) * w, 0); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect((u - 0.09) * w, 0, 0.18 * w, h); }
      for (let i = 0; i < 3200; i++) {
        const x = trng() * w, y = trng() * h, u = x / w, inTrack = Math.abs(u - 0.29) < 0.06 || Math.abs(u - 0.71) < 0.06;
        if (inTrack && trng() < 0.75) continue;
        const r = 0.6 + trng() * (u < 0.08 || u > 0.92 ? 2.4 : 1.6);
        wrapDraw(g, w, h, x, y, (X, Y) => { g.fillStyle = trng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(X, Y, r, r * 0.75, trng() * 3, 0, 7); g.fill(); });
      }
      for (const [a, b] of [[0, 0.05], [0.95, 1]]) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(a * w, 0, (b - a) * w, h); }
    }),
    rock: makeTex(128, 128, (g, w, h) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { g.fillStyle = trng() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'; g.fillRect(trng() * w, trng() * h, 1 + trng() * 4, 1 + trng() * 2); }
    }),
  };
  // tiny cube map of the sky and ground, so car paint and glass catch a reflection
  const envMap = (() => {
    const face = (top) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      if (top === 'sky') { g.fillStyle = '#8ec5ff'; g.fillRect(0, 0, 64, 64); }
      else if (top === 'ground') { g.fillStyle = '#5a6a3a'; g.fillRect(0, 0, 64, 64); }
      else { const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#6fb2ff'); grd.addColorStop(0.48, '#e8f4ff'); grd.addColorStop(0.52, '#7d8a5a'); grd.addColorStop(1, '#4b5a32'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); }
      return c; };
    const t = new THREE.CubeTexture([face('side'), face('side'), face('sky'), face('ground'), face('side'), face('side')]); t.needsUpdate = true; return t;
  })();
  const paintMat = (color) => new THREE.MeshPhongMaterial({ color, specular: 0x666666, shininess: 80, envMap, reflectivity: 0.22, combine: THREE.MixOperation });
  const glassMat = () => new THREE.MeshPhongMaterial({ color: 0x1a2430, specular: 0xaaaaaa, shininess: 120, envMap, reflectivity: 0.55, combine: THREE.MixOperation });

  const skyU = { top: { value: new THREE.Color(0x2f7fe0) }, mid: { value: new THREE.Color(0x7cc2ff) }, bottom: { value: skyCol } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y, 0.0, 1.0); vec3 c = mix(bottom, mid, smoothstep(0.0, 0.18, t)); c = mix(c, top, smoothstep(0.18, 0.7, t)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);

  // Big anime cumulus clouds: flat billboards with a lit top and a cool shadow underside
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMats = [];
  {
    const cloudTex = (seed) => {
      const r = mulberry32(seed), c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      const puffs = [];
      for (let i = 0; i < 9; i++) { const x = 90 + r() * 330, rad = 40 + r() * 55; puffs.push([x, 175 - rad * (0.6 + r() * 0.5), rad]); }
      puffs.push([256, 175, 120]);
      // soft painted puffs: shaded underside, bright tops, feathered edges
      for (const [x, y, rad] of puffs) { const grd = g.createRadialGradient(x, y + rad * 0.3, rad * 0.1, x, y, rad); grd.addColorStop(0, 'rgba(178,196,222,0.95)'); grd.addColorStop(0.7, 'rgba(200,214,236,0.7)'); grd.addColorStop(1, 'rgba(200,214,236,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
      for (const [x, y, rad] of puffs) { const grd = g.createRadialGradient(x - rad * 0.2, y - rad * 0.35, rad * 0.05, x, y - rad * 0.2, rad * 0.85); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y - rad * 0.2, rad * 0.85, 0, 7); g.fill(); }
      return new THREE.CanvasTexture(c);
    };
    const texes = [cloudTex(3), cloudTex(11), cloudTex(29)];
    const rr = mulberry32(5);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.SpriteMaterial({ map: texes[i % 3], fog: false, depthWrite: false, transparent: true });
      cloudMats.push(m);
      const sp = new THREE.Sprite(m);
      const a = rr() * Math.PI * 2, d = 1150 + rr() * 350, sc = 260 + rr() * 280;
      sp.position.set(Math.cos(a) * d, 130 + rr() * 300, Math.sin(a) * d); sp.scale.set(sc, sc / 2, 1);
      clouds.add(sp);
    }
  }

  const hemi = new THREE.HemisphereLight(0xdcefff, 0x6a7fb0, 0.5);   // cool fill: shaded sides go blue, like anime backgrounds
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dc, 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  const sunOffset = new THREE.Vector3(-70, 110, -45);
  const inkColor = new THREE.Color(0x1c2440);

  function applyLook(L) {
    skyU.top.value.setHex(L.skyTop); skyU.mid.value.setHex(L.skyMid); skyCol.setHex(L.horizon);
    scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
    hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemi;
    sun.color.setHex(L.sun); sun.intensity = L.sunI; sunOffset.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]);
    for (const m of cloudMats) m.color.setHex(L.cloud);
    inkColor.setHex(L.ink);
  }

  // Japanese signs need a font with kana/kanji; start fetching it now (falls back to system fonts)
  const JP_FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';
  const fontReady = (document.fonts && document.fonts.load)
    ? Promise.race([document.fonts.load('800 60px "M PLUS Rounded 1c"', 'ラーメン居酒屋カラオケ薬局ホテル寿司喫茶本屋花道町ゲーム焼鳥'), new Promise(r => setTimeout(r, 2500))]).catch(() => {})
    : Promise.resolve();

