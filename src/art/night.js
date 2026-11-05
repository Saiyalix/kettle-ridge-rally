  /* ---------- night lighting extras (looks with `night: true`, i.e. Sakura Touge) ----------
     No extra real-time lights: the road is lit with a few cheap tricks, all in stageGroup (so they go with the stage):
       - the road glows a little by itself (emissive), so corners always read
       - a headlight pool: one additive mesh draped over the ground in front of the car, moved every frame (updateNight)
       - white reflector posts along both road edges (one instanced mesh; look only, the car cannot hit them)
       - glow dots (lamps, lanterns, neon signs) as one Points mesh, and light pools under street lamps / tunnel lanterns
     Other files add glow dots with glowSpots.push({ x, y, z, c: 0xrrggbb, size }) while they build the stage. */
  const glowSpots = [];
  const NIGHT = { pool: null, grid: null };
  function glowTexture(size, falloff) {          // (glow is added in linear light now: the 0.55 power keeps the old brightness)
    const c = skyCanvas(size, size), g = c.getContext('2d'), R = size / 2, gr = g.createRadialGradient(R, R, 0, R, R, R);
    for (let i = 0; i <= 8; i++) { const u = i / 8, v = Math.pow(Math.pow(1 - u, falloff), 0.55); gr.addColorStop(u, `rgba(255,255,255,${v})`); }
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
  const glowPointMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uScale: { value: 300 } },
    vertexShader: 'attribute float aSize; attribute vec3 aCol; uniform float uScale; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(aSize * uScale / -mv.z, 110.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uMap; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * texture2D(uMap, gl_PointCoord).r, 1.0); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });

  function buildNight(L) {
    NIGHT.pool = null;
    const spots = glowSpots.splice(0);
    if (!L.night || !track) return;
    const gl = L.nightGlow || {};
    // 1. the road lights itself a little, so the edges and corners always read
    stageGroup.traverse(o => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m.map && m.alphaTest === 0.5 && m.polygonOffset && m.vertexColors) { m.emissive.setHex(gl.road || 0x7f93c8); m.emissiveMap = m.map; m.emissiveIntensity = gl.roadI != null ? gl.roadI : 0.5; m.needsUpdate = true; }
        else if (m.isMeshLambertMaterial && o.isInstancedMesh && m.color.getHex() === 0xeeeadc) { m.emissive.setHex(0xeeeadc); m.emissiveIntensity = 0.55; m.needsUpdate = true; }
      }
    });
    // 2. reflector posts along both road edges
    const posts = [];
    for (let s = 14; s < track.length - 10; s += 15) for (const side of [-1, 1]) { const p = sampleAt(s), [x, z] = sideXZ(p, side * (half + 1.5)); posts.push({ x, z, y: terrain.heightAt(x, z) }); }
    instanced(new THREE.BoxGeometry(0.11, 0.8, 0.11).translate(0, 0.4, 0), new THREE.MeshBasicMaterial({ color: 0x9db4d8 }), posts, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    // 3. street lamps in town and lanterns in the torii tunnel: a glow dot and a pool of light on the road under each
    const pools = [];
    const city0 = isFinite(track.cityStart) ? track.cityStart : Infinity;
    if (isFinite(city0)) for (const side of [-1, 1]) for (let ls = city0 + 15; ls < track.length - 10; ls += 26) {
      const p = sampleAt(ls), x = sideXZ(p, side * (half + 0.9))[0] + Math.cos(p.th) * side * 0.9, z = sideXZ(p, side * (half + 0.9))[1] - Math.sin(p.th) * side * 0.9;
      const [px, pz] = sideXZ(p, side * half * 0.35);
      spots.push({ x, y: terrain.heightAt(x, z) + 5.6, z, c: 0xffd9a0, size: 1.5 }); pools.push({ x: px, z: pz, y: terrain.heightAt(px, pz) + 0.09, s: 1, c: 0 });
    }
    const tun = ST.toriiTunnel;
    if (tun) {
      const lan = [];
      for (let s = tun[0] + 2; s <= tun[1]; s += 9.2) for (const sd of [-1, 1]) {
        const p = sampleAt(s), [x, z] = sideXZ(p, sd * (half + 0.55)), y = terrain.heightAt(x, z) + 3.2;
        lan.push({ x, y, z }); spots.push({ x, y, z, c: 0xff9a4a, size: 1.3 });
        const [px, pz] = sideXZ(p, sd * half * 0.3); pools.push({ x: px, z: pz, y: terrain.heightAt(px, pz) + 0.09, s: 0.8, c: 1 });
      }
      instanced(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 8), new THREE.MeshBasicMaterial({ color: 0xff7a35 }), lan, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    }
    if (pools.length) {
      const m = new THREE.MeshBasicMaterial({ map: glowTexture(64, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      const warm = [new THREE.Color(0.9, 0.78, 0.55), new THREE.Color(0.95, 0.55, 0.28)];
      const im = instanced(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), m, pools, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(q.s); }, { shadow: false, color: (c, q) => c.copy(warm[q.c]) });
      im.renderOrder = 4;
    }
    // 4. glow dots
    if (spots.length) {
      const pos = new Float32Array(spots.length * 3), col = new Float32Array(spots.length * 3), sz = new Float32Array(spots.length), c = new THREE.Color();
      spots.forEach((s, i) => { pos.set([s.x, s.y, s.z], i * 3); c.setHex(s.c); col.set([c.r, c.g, c.b], i * 3); sz[i] = s.size; });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      if (!glowPointMat.uniforms.uMap.value) glowPointMat.uniforms.uMap.value = glowTexture(64, 3.2);
      const pts = new THREE.Points(geo, glowPointMat); pts.frustumCulled = false; pts.renderOrder = 6; add(pts);
    }
    // 5. headlight pool: a grid draped over the ground in front of the car
    const N = 9, M = 13, geo = new THREE.BufferGeometry(), pp = new Float32Array(N * M * 3), uv = new Float32Array(N * M * 2), idx = [];
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { uv[(j * N + i) * 2] = i / (N - 1); uv[(j * N + i) * 2 + 1] = j / (M - 1); if (i < N - 1 && j < M - 1) { const a = j * N + i; idx.push(a, a + 1, a + N, a + 1, a + N + 1, a + N); } }
    geo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tex = skyCanvas(128, 256), g = tex.getContext('2d'), img = g.createImageData(128, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
      const u = x / 127 * 2 - 1, v = 1 - y / 255, a = Math.exp(-Math.pow((Math.abs(u) - 0.3) / 0.38, 2)), b = Math.exp(-u * u / 0.5), k = (0.4 * a + 0.6 * b) * Math.pow(1 - v, 1.7) * Math.min(1, v * 14 + 0.25) * (1 - Math.pow(Math.abs(u), 3));
      const o = (y * 128 + x) * 4, kk = Math.pow(k, 0.5); img.data[o] = 255 * kk; img.data[o + 1] = 240 * kk; img.data[o + 2] = 205 * kk; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const pt = new THREE.CanvasTexture(tex); pt.wrapS = pt.wrapT = THREE.ClampToEdgeWrapping;
    const pool = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: pt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, opacity: 1 }));
    pool.frustumCulled = false; pool.renderOrder = 5; add(pool);
    NIGHT.pool = pool; NIGHT.grid = { N, M, pos: pp, reach: gl.reach || 40, power: gl.pool != null ? gl.pool : 1 };
    pool.material.color.setScalar(NIGHT.grid.power);
  }
  // every frame: lay the headlight pool on the ground ahead of the car
  function updateNight() {
    const pool = NIGHT.pool; if (!pool || !terrain) return;
    const { N, M, pos, reach } = NIGHT.grid;
    let fx = vFwd.x, fz = vFwd.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const rx = fz, rz = -fx;
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1), z = 1.4 + t * t * (reach - 1.4) * 0.5 + t * (reach - 1.4) * 0.5, hw = 1.5 + z * 0.3;
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1) * 2 - 1) * hw, wx = vPos.x + fx * z + rx * x, wz = vPos.z + fz * z + rz * x, k = (j * N + i) * 3;
        pos[k] = wx; pos[k + 1] = terrain.heightAt(wx, wz) + 0.14; pos[k + 2] = wz;
      }
    }
    pool.geometry.attributes.position.needsUpdate = true;
  }
