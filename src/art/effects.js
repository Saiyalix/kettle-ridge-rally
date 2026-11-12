  /* ---------- dust particles (custom shader for per-particle fade) ---------- */
  const PMAX = 1000;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pAlpha = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMax = new Float32Array(PMAX), pKind = new Uint8Array(PMAX), pAmp = new Float32Array(PMAX).fill(1);   // 0 dust, 1 spark, 2 gravel chip
  let pNext = 0, dustK = 1, pCap = PMAX, pAny = false;                      // pCap: how many particles may be alive (high 1000, low 360: low is ui-mobile's, kept small)                                  // dustK: dust and chips are dimmed at night (set by applyLook)
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float aAlpha; attribute float aSize; attribute vec3 aColor; uniform float uScale;
      varying float vA; varying vec3 vC;
      void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(pow(vC, vec3(2.2)), vA * (1.0 - d * 2.0) * 1.2); }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  function emit(x, y, z, vx, vy, vz, col, size, life, kind = 0, amp = 1) {
    pAny = true; points.visible = true;
    const i = pNext; pNext = (pNext + 1) % pCap; pKind[i] = kind; pAmp[i] = amp;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    const k = kind === 1 ? 1 : dustK;
    pCol[i * 3] = col[0] * k; pCol[i * 3 + 1] = col[1] * k; pCol[i * 3 + 2] = col[2] * k;
    pSize[i] = size; pLife[i] = life; pMax[i] = life;
  }
  function updateParticles(dt) {
    const cap = quality === 'low' ? 360 : PMAX;
    if (cap !== pCap) { for (let i = 0; i < PMAX; i++) { pLife[i] = 0; pAlpha[i] = 0; } pCap = cap; pNext = 0; pAny = true; }
    if (!pAny) return;                                   // nothing alive (most of a tarmac stage): skip the loop, the 32 KB upload and the draw call
    let live = 0;
    for (let i = 0; i < pCap; i++) {
      if (pLife[i] <= 0) { pAlpha[i] = 0; continue; }
      live++;
      pLife[i] -= dt;
      const t = 1 - pLife[i] / pMax[i];
      if (pKind[i]) {
        // sparks and gravel chips: thrown, fall under gravity, stop at the ground
        pVel[i * 3 + 1] -= 16 * dt;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        pAlpha[i] = pKind[i] === 1 ? 1.8 * (1 - t) : 0.9 * Math.min(1, (1 - t) * 3);
        if (pKind[i] === 1) pSize[i] *= 1 - 2 * dt;
        continue;
      }
      pVel[i * 3] *= 1 - 2.2 * dt; pVel[i * 3 + 2] *= 1 - 2.2 * dt; pVel[i * 3 + 1] = pVel[i * 3 + 1] * (1 - 1.5 * dt) + 0.4 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pSize[i] += dt * 1.8; pPos[i * 3 + 1] += dt * 0.9;       // puffs swell as they thin out, and rise with their growth so the ground never slices them flat
      pAlpha[i] = Math.max(0, 0.8 * pAmp[i] * (1 - t * t) * Math.min(1, t * 6));      // holds its body for most of its life, then thins out
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.aColor.needsUpdate = pGeo.attributes.aAlpha.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
    if (live === 0) { pAny = false; points.visible = false; }   // this pass zeroed every alpha and uploaded it; from the next frame on there is nothing to do
  }
  let emitAcc = [0, 0, 0, 0], chipAcc = [0, 0, 0, 0];
  const GREY = [0.82, 0.82, 0.84], CLOD_G = [0.10, 0.26, 0.07], CLOD_B = [0.19, 0.11, 0.05], SNOWW = [1, 1, 1], SNOW_SHADE = [0.70, 0.79, 0.93];   // darker clods and a cool shaded snow puff, so they read on green grass and white snow

  /* ---------- per-wheel trails (called once per wheel per frame from updateVisuals) ----------
     gravel / dirt: tan or brown dust, grows with speed and slide; rear wheels throw chips
     snow: white spray, lifted higher, white flakes from the rears
     tarmac: thin grey tyre haze, only when the tyres really slide (hard slide or wheelspin)
     grass: brown dust plus green and brown clods from all four wheels
     the 'low' quality emits about half as much (particle cap 360) */
  function wheelFx(dt, i, w) {
    const surf = CONFIG.surfaces[w.surface], low = quality === 'low', rate = low ? 0.5 : 1;
    const slide = Math.abs(Math.sin(car.beta)) * car.speed, tar = !surf.dust;
    let intensity;
    if (tar) intensity = Math.min(1, Math.max(0, (w.slipSpeed - 4.5) * 0.09 + (slide - 7) * 0.06)) * (w.surface === 'tarmac' ? 1 : 0);
    else intensity = Math.min(1, Math.abs(w.vLong) * 0.022 + w.slipSpeed * 0.07 + slide * 0.04) * (car.drift ? 1.2 : 1);
    if (intensity < 0.02) return;
    const sideX = car.right.x * Math.sign(car.beta), sideZ = car.right.z * Math.sign(car.beta);   // the way the car is sliding
    const snow = w.surface === 'snow', grass = w.surface === 'grass';
    emitAcc[i] += dt * intensity * (tar ? 45 : 65) * rate;      // fewer, bigger, longer-lived puffs: the same particle budget fills the screen better
    while (emitAcc[i] > 1) {
      emitAcc[i] -= 1;
      const jx = (Math.random() - 0.5) * 0.4, jz = (Math.random() - 0.5) * 0.4, thr = slide * 0.18;
      const c = tar ? GREY : snow ? SNOW_SHADE : surf.dust, k = tar ? 1 : snow ? 0.9 + Math.random() * 0.15 : 1.12 + Math.random() * 0.15;     // dust is a lighter shade of the surface, or it vanishes on a road of the same colour
      const sz = tar ? 0.5 + intensity * 0.8 + slide * 0.03 : 1.0 + intensity * 1.0 + slide * 0.05;
      emit(w.point.x + jx, w.point.y + 0.15 + sz * 0.3, w.point.z + jz,
        -car.vel.x * 0.3 + sideX * thr + (Math.random() - 0.5) * 1.5, (snow ? 1.2 : 0.6) + Math.random() * 1.2 + slide * 0.04, -car.vel.z * 0.3 + sideZ * thr + (Math.random() - 0.5) * 1.5,
        [c[0] * k, c[1] * k, c[2] * k], sz, tar ? 0.7 + Math.random() * 0.9 + slide * 0.04 : 1.4 + Math.random() * 1.0 + slide * 0.05, 0, tar ? 0.45 : 1);
    }
    if (tar || (w.front && !grass)) return;
    const roost = Math.max(0, w.slipSpeed - 2.5) + slide * 0.5;
    chipAcc[i] += dt * Math.min(40, roost * (snow ? 2 : 3.2)) * rate * (w.front ? 0.5 : 1);
    while (chipAcc[i] > 1) {
      chipAcc[i] -= 1;
      let c = surf.dust, k = 0.45 + Math.random() * 0.2;
      if (grass) { c = Math.random() < 0.5 ? CLOD_G : CLOD_B; k = 0.85 + Math.random() * 0.3; }       // turf clods, green and brown
      else if (snow) { c = SNOWW; k = 0.9; }
      const back = 3 + Math.random() * 3 + roost * 0.25;
      emit(w.point.x, w.point.y + 0.1, w.point.z,
        car.vel.x * 0.55 - car.fwd.x * back + sideX * (1 + Math.random() * 2.5) * (slide > 2 ? 1 : 0.3) + (Math.random() - 0.5) * 2,
        1.6 + Math.random() * 3.2,
        car.vel.z * 0.55 - car.fwd.z * back + sideZ * (1 + Math.random() * 2.5) * (slide > 2 ? 1 : 0.3) + (Math.random() - 0.5) * 2,
        [c[0] * k, c[1] * k, c[2] * k], (grass ? 0.7 : snow ? 0.16 : 0.12) + Math.random() * 0.1, 0.5 + Math.random() * 0.35, 2);
    }
  }

  /* ---------- damage looks (drawn only, no physics): scuffs and scrapes at the spots that were hit, dirt on the paint ----------
     One extra mesh (a pooled ring of 14 flat marks, one draw call, hidden until the first hit); dirt is a tint on the paint colour (no draw call).
     Reset when a stage starts (countdown). A rescue keeps the marks: you did hit that wall. */
  const SCUFF_N = 14, scPos = new Float32Array(SCUFF_N * 12), scCol = new Float32Array(SCUFF_N * 12);
  const scGeo = new THREE.BufferGeometry();
  scGeo.setAttribute('position', new THREE.BufferAttribute(scPos, 3));
  scGeo.setAttribute('color', new THREE.BufferAttribute(scCol, 3));
  { const idx = []; for (let q = 0; q < SCUFF_N; q++) idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); scGeo.setIndex(idx); }
  const scMesh = new THREE.Mesh(scGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  scMesh.frustumCulled = false; scMesh.visible = false; scMesh.renderOrder = 1; carGroup.add(scMesh);
  let scNext = 0, damage = 0, dirt = 0, dirtApplied = -1, dirtMat = null;
  const _v = new THREE.Vector3(), DIRT_COL = new THREE.Color(0x7a5a38), WHITE = new THREE.Color(1, 1, 1);
  let scSeed = 7;
  const scRnd = () => { scSeed = (scSeed * 16807) % 2147483647; return scSeed / 2147483647; };      // own random numbers: the bot's seeded Math.random must not change
  function addScuff(wx, wz, big) {
    _v.set(wx, car.pos.y, wz); carGroup.worldToLocal(_v);
    const hl = carBuilt && carBuilt.ci === 0 ? 2.0 : 1.8;
    const side = _v.x >= 0 ? 1 : -1, lz = clamp(_v.z, -hl, hl);
    const y = -0.02 + scRnd() * 0.2, len = (big ? 0.5 : 0.25) + scRnd() * 0.3, hh = 0.03 + scRnd() * 0.05 * (big ? 2 : 1), x = side * 0.91, i = scNext * 12;
    scNext = (scNext + 1) % SCUFF_N;
    const tilt = (scRnd() - 0.5) * 0.12, dark = scRnd() < 0.6, cc = dark ? [0.08, 0.07, 0.07] : [0.78, 0.76, 0.7];     // scrape: dark scuff or bare-metal streak
    const xs = [x, x, x, x], ys = [y - hh, y + hh + tilt, y + hh - tilt, y - hh], zs = [lz - len / 2, lz - len / 2, lz + len / 2, lz + len / 2];
    for (let k = 0; k < 4; k++) { scPos[i + k * 3] = xs[k]; scPos[i + k * 3 + 1] = ys[k]; scPos[i + k * 3 + 2] = zs[k]; scCol[i + k * 3] = cc[0]; scCol[i + k * 3 + 1] = cc[1]; scCol[i + k * 3 + 2] = cc[2]; }
    scGeo.attributes.position.needsUpdate = scGeo.attributes.color.needsUpdate = true; scMesh.visible = true;
  }
  function resetDamage() {
    scPos.fill(0); scGeo.attributes.position.needsUpdate = true; scMesh.visible = false; scNext = 0; damage = 0; dirt = 0;
  }
  // per frame (cheap): dirt creeps up on loose surfaces, more at speed, and with every hit
  function updateDamage(dt) {
    if (state === 'countdown' && (damage > 0 || dirt > 0)) resetDamage();
    if (state === 'running' && car.speed > 6) {
      const w0 = car.wheels[2]; const sf = w0 && w0.contact ? CONFIG.surfaces[w0.surface] : null;
      if (sf && sf.dust) dirt = Math.min(1, dirt + dt * car.speed * 0.0012 * (w0.surface === 'grass' ? 2 : 1));
    }
    const d = Math.round(dirt * 40) / 40;
    const pm = carMatsLive.find(m => m.map === carTex) || null;
    if (pm && (d !== dirtApplied || pm !== dirtMat)) { dirtApplied = d; dirtMat = pm; pm.color.copy(WHITE).lerp(DIRT_COL, d * 0.9); }     // also after the car is rebuilt (new paint material)
  }

  /* ---------- hits: sound, camera shake, sparks or splinters ---------- */
  let shake = 0, landShakeCool = 0;
  function addShake(a) { shake = Math.min(1.2, Math.max(shake, a)); }
  function onCarHit(fx) {
    if (fx.hit > 1.5) impacts.push(Math.min(1, fx.hit / 12));
    addShake(Math.min(1, fx.hit / 9));
    if (fx.seg) scrapeLevel = Math.max(scrapeLevel, clamp(fx.vt / 14, 0, 1));            // grinding along a wall or rail
    damage += fx.hit; dirt = Math.min(1, dirt + fx.hit * 0.01);
    if (fx.hit > 2.5 || (fx.seg && fx.vt > 3)) addScuff(fx.x, fx.z, fx.hit > 6);
    const n = Math.min(quality === 'low' ? 6 : 14, Math.round(fx.hit * 1.6 + (fx.seg ? fx.vt * 0.35 : 0)));
    for (let k = 0; k < n; k++) {
      const vx = car.vel.x * (fx.seg ? 0.3 : 0.6) + fx.nx * (1 + Math.random() * 3) + (Math.random() - 0.5) * 4;
      const vz = car.vel.z * (fx.seg ? 0.3 : 0.6) + fx.nz * (1 + Math.random() * 3) + (Math.random() - 0.5) * 4;
      if (fx.seg) emit(fx.x, car.pos.y - 0.1 + Math.random() * 0.4, fx.z, vx, 1 + Math.random() * 3, vz, [1, 0.8 + Math.random() * 0.2, 0.4], 0.2 + Math.random() * 0.12, 0.2 + Math.random() * 0.25, 1);
      else emit(fx.x, car.pos.y + Math.random() * 0.8, fx.z, vx * 0.5, 1 + Math.random() * 2.5, vz * 0.5, [0.42, 0.33, 0.22], 0.14 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, 2);
    }
  }

