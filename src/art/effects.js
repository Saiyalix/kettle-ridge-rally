  /* ---------- dust particles (custom shader for per-particle fade) ---------- */
  const PMAX = 1000;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pAlpha = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMax = new Float32Array(PMAX), pKind = new Uint8Array(PMAX);   // 0 dust, 1 spark, 2 gravel chip
  let pNext = 0, dustK = 1;                                  // dustK: dust and chips are dimmed at night (set by applyLook)
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
  function emit(x, y, z, vx, vy, vz, col, size, life, kind = 0) {
    const i = pNext; pNext = (pNext + 1) % PMAX; pKind[i] = kind;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    const k = kind === 1 ? 1 : dustK;
    pCol[i * 3] = col[0] * k; pCol[i * 3 + 1] = col[1] * k; pCol[i * 3 + 2] = col[2] * k;
    pSize[i] = size; pLife[i] = life; pMax[i] = life;
  }
  function updateParticles(dt) {
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) { pAlpha[i] = 0; continue; }
      pLife[i] -= dt;
      const t = 1 - pLife[i] / pMax[i];
      if (pKind[i]) {
        // sparks and gravel chips: thrown, fall under gravity, stop at the ground
        pVel[i * 3 + 1] -= 16 * dt;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        pAlpha[i] = pKind[i] === 1 ? 1.4 * (1 - t) : 0.9 * Math.min(1, (1 - t) * 3);
        if (pKind[i] === 1) pSize[i] *= 1 - 2 * dt;
        continue;
      }
      pVel[i * 3] *= 1 - 2.2 * dt; pVel[i * 3 + 2] *= 1 - 2.2 * dt; pVel[i * 3 + 1] = pVel[i * 3 + 1] * (1 - 1.5 * dt) + 0.4 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pSize[i] += dt * 2.2;
      pAlpha[i] = Math.max(0, 0.55 * (1 - t) * Math.min(1, t * 8));
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.aColor.needsUpdate = pGeo.attributes.aAlpha.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
  }
  let emitAcc = [0, 0, 0, 0], chipAcc = [0, 0, 0, 0];

  /* ---------- hits: sound, camera shake, sparks or splinters ---------- */
  let shake = 0, landShakeCool = 0;
  function addShake(a) { shake = Math.min(1.2, Math.max(shake, a)); }
  function onCarHit(fx) {
    if (fx.hit > 1.5) impacts.push(Math.min(1, fx.hit / 12));
    addShake(Math.min(1, fx.hit / 9));
    if (fx.seg) scrapeLevel = Math.max(scrapeLevel, clamp(fx.vt / 14, 0, 1));            // grinding along a wall or rail
    const n = Math.min(14, Math.round(fx.hit * 1.6 + (fx.seg ? fx.vt * 0.35 : 0)));
    for (let k = 0; k < n; k++) {
      const vx = car.vel.x * 0.6 + fx.nx * (1 + Math.random() * 3) + (Math.random() - 0.5) * 4;
      const vz = car.vel.z * 0.6 + fx.nz * (1 + Math.random() * 3) + (Math.random() - 0.5) * 4;
      if (fx.seg) emit(fx.x, car.pos.y - 0.1 + Math.random() * 0.4, fx.z, vx, 1 + Math.random() * 3, vz, [1, 0.78 + Math.random() * 0.2, 0.35], 0.16 + Math.random() * 0.1, 0.25 + Math.random() * 0.3, 1);
      else emit(fx.x, car.pos.y + Math.random() * 0.8, fx.z, vx * 0.5, 1 + Math.random() * 2.5, vz * 0.5, [0.42, 0.33, 0.22], 0.14 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, 2);
    }
  }

