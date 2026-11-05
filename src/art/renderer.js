  /* ---------- renderer, scene, lights ---------- */
  const canvas = document.getElementById('scene');
  // Colour-managed pipeline: hex colours and canvas textures are sRGB (what you see in a paint program), three.js converts
  // them to linear for lighting and fog. The scene is drawn into a linear (half-float) target; the post pass does the
  // tone mapping and the sRGB conversion once, at the very end (art/post-process.js). Stage looks set `exposure`.
  THREE.ColorManagement.enabled = true;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;               // only the post pass draws to the screen
  renderer.toneMapping = THREE.NeutralToneMapping;                // Khronos PBR Neutral: keeps the painted colours, only squeezes highlights
  renderer.toneMappingExposure = 1;
  // Vertex colours and instance colours in this game are authored as sRGB-looking numbers (0..1). three.js treats the
  // attribute as linear, so decode it in the shader (one cheap pow per vertex), once for every material.
  THREE.ShaderChunk.color_vertex = THREE.ShaderChunk.color_vertex.replace(/(\bvColor\.rgb \*= color;)/, 'vColor.rgb *= pow(color, vec3(2.2));').replace(/(\bvColor\.rgb \*= instanceColor\.rgb;)/, 'vColor.rgb *= pow(instanceColor.rgb, vec3(2.2));');
  const srgb = (t) => { t.colorSpace = THREE.SRGBColorSpace; return t; };           // mark a colour texture (data textures stay linear)
  renderer.setPixelRatio(1);                                      // the post pass renders at a lower internal resolution anyway
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; return srgb(t);
  }
  const trng = mulberry32(99);
  const wrapDraw = (g, w, h, x, y, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(x + dx, y + dy); };   // seamless tiling
  const TEX = {
    // ground and road textures are generated per surface in art/textures.js
    rock: makeTex(128, 128, (g, w, h) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { g.fillStyle = trng() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'; g.fillRect(trng() * w, trng() * h, 1 + trng() * 4, 1 + trng() * 2); }
    }),
  };
  // tiny cube map of the sky and ground, so car paint and glass catch a reflection (repainted per stage by paintEnv)
  const envFaces = [0, 1, 2, 3, 4, 5].map(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; });
  const envMap = srgb(new THREE.CubeTexture(envFaces));
  function paintEnv(top, horizon, ground) {
    const hex = (n) => '#' + n.toString(16).padStart(6, '0'), mix = (a, b, t) => { const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
    envFaces.forEach((c, i) => {
      const g = c.getContext('2d');
      if (i === 2) { g.fillStyle = hex(top); g.fillRect(0, 0, 64, 64); }
      else if (i === 3) { g.fillStyle = hex(ground); g.fillRect(0, 0, 64, 64); }
      else { const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, hex(top)); grd.addColorStop(0.48, hex(horizon)); grd.addColorStop(0.52, hex(mix(ground, horizon, 0.3))); grd.addColorStop(1, hex(ground)); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); }
    });
    envMap.needsUpdate = true;
  }
  paintEnv(0x8ec5ff, 0xe8f4ff, 0x5a6a3a);
  const paintMat = (color) => new THREE.MeshPhongMaterial({ color, specular: 0x666666, shininess: 80, envMap, reflectivity: 0.22, combine: THREE.MixOperation });
  const glassMat = () => new THREE.MeshPhongMaterial({ color: 0x1a2430, specular: 0xaaaaaa, shininess: 120, envMap, reflectivity: 0.55, combine: THREE.MixOperation });

  const clouds = new THREE.Group(); scene.add(clouds);       // (kept empty: the sky is painted in art/sky.js)

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

  let curLook = null;
  function applyLook(L) {
    curLook = L;
    skyCol.setHex(L.horizon); scene.fog.color.setHex(L.horizon);        // (the fog keeps its own copy of the colour)
    scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
    hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemi;
    // the sun (or the moon at night): colour, strength and direction, from an elevation and compass bearing in degrees
    const el = (L.lightEl != null ? L.lightEl : L.sunEl) * Math.PI / 180, az = (L.lightAz != null ? L.lightAz : L.sunAz) * Math.PI / 180;      // lightEl / lightAz: when the light comes from somewhere other than the disc in the sky
    sun.color.setHex(L.sun); sun.intensity = L.sunI; renderer.toneMappingExposure = L.exposure != null ? L.exposure : 1;
    sunOffset.set(Math.sin(az) * Math.cos(el) * 140, Math.sin(el) * 140, Math.cos(az) * Math.cos(el) * 140);
    sun.shadow.bias = L.shadowBias != null ? L.shadowBias : -0.0008; sun.shadow.normalBias = L.shadowNormal || 0;
    inkColor.setHex(L.ink); dustK = L.dust != null ? L.dust : 1;
    paintEnv(L.env[0], L.env[1], L.env[2]);
    buildSky(L);                       // art/sky.js
    buildNight(L);                     // art/night.js (does nothing by day)
    applyGrade(L);                     // art/post-process.js
    const fl = document.getElementById('flare'); if (fl) fl.style.display = L.flare === false ? 'none' : '';
  }

  // Japanese signs need a font with kana/kanji; start fetching it now (falls back to system fonts)
  const JP_FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';
  const fontReady = (document.fonts && document.fonts.load)
    ? Promise.race([document.fonts.load('800 60px "M PLUS Rounded 1c"', 'ラーメン居酒屋カラオケ薬局ホテル寿司喫茶本屋花道町ゲーム焼鳥'), new Promise(r => setTimeout(r, 2500))]).catch(() => {})
    : Promise.resolve();

