  /* ---------- stage building helpers ---------- */
  const add = (...objs) => { for (const o of objs) stageGroup.add(o); };
  const sampleAt = s => P[clamp(Math.round(s / track.step), 0, P.length - 1)];
  const sideXZ = (p, off) => [p.x - Math.cos(p.th) * off, p.z + Math.sin(p.th) * off];   // off > 0 = right of the road
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const dummy = new THREE.Object3D(), tmpCol = new THREE.Color();
  // frees what a stage made on the graphics card. Textures and materials that are kept on purpose and shared by every stage
  // (art textures, tree / crowd / sponsor pictures) carry userData.keep = true and are skipped.
  // (Until round 8 this function was shadowed by the car's own disposeTree, so no stage texture was ever freed.)
  function disposeTree(root) {
    const freeMat = (m) => {
      if (!m || m.userData.keep) return;
      for (const key of ['map', 'emissiveMap', 'alphaMap']) if (m[key] && !m[key].userData.keep) m[key].dispose();
      m.dispose();
    };
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) freeMat(m);
      if (o.customDepthMaterial) freeMat(o.customDepthMaterial);
    });
  }
  const keepTex = (t) => { t.userData.keep = true; return t; };
  function instanced(geo, mat, items, place, opts = {}) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    items.forEach((it, i) => { place(dummy, it, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (opts.color) { opts.color(tmpCol, it, i); m.setColorAt(i, tmpCol); } });
    m.count = items.length;
    m.castShadow = opts.shadow !== false; m.receiveShadow = true;
    add(m); return m;
  }
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return srgb(t); };

  /* ---------- ground ---------- */
  function buildGround(rng) {
    const { nx, nz, cell, minX, minZ, h, dist, nearS } = terrain;
    const L = ST.look, alpine = ST.theme === 'alpine', japan = ST.theme === 'japan';
    const snowFrom = ST.snowFrom != null ? ST.snowFrom : Infinity;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), soil = new Float32Array(nx * nz);
    for (let iz = 0, k = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++, k++) {
      const x = minX + ix * cell, z = minZ + iz * cell, d = dist[k], s0 = nearS[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h[k]; pos[k * 3 + 2] = z;
      const kx0 = ix > 0 ? k - 1 : k, kx1 = ix < nx - 1 ? k + 1 : k, kz0 = iz > 0 ? k - nx : k, kz1 = iz < nz - 1 ? k + nx : k;
      const steep = Math.hypot((h[kx1] - h[kx0]) / (Math.max(1, kx1 - kx0) * cell), (h[kz1] - h[kz0]) / (Math.max(1, (kz1 - kz0) / nx) * cell));
      const n1 = 0.5 + 0.5 * Math.sin(x * 0.05 + Math.sin(z * 0.043) * 2.0), n2 = rng() * 0.06;
      let c = mixc(L.grassA, L.grassB, n1); c = [c[0] + n2, c[1] + n2, c[2]];
      if (alpine) {
        const rockT = smoothstep(clamp((steep - 0.5) / 0.45, 0, 1));
        const strata = 0.86 + 0.16 * Math.sign(Math.sin(h[k] * 0.55 + Math.sin(x * 0.02) * 1.5));   // layered rock bands
        c = mixc(c, [L.rock[0] * strata + n2, L.rock[1] * strata + n2, L.rock[2] * strata + n2], rockT);
        c = mixc(c, L.snow, smoothstep(clamp((h[k] - ST.snowLine) / 25, 0, 1)) * (1 - rockT * 0.5));
      }
      let sb = 0;
      if (isFinite(snowFrom)) { sb = smoothstep(clamp((s0 - (snowFrom - 70)) / 90, 0, 1)); if (sb > 0) c = mixc(c, [L.snow[0] - n2 * 0.5, L.snow[1] - n2 * 0.5, L.snow[2]], sb); }
      let city = false;
      if (japan) {
        if (s0 < 560 && d > half + 6 && d < 170 && steep < 0.14) {           // rice paddies: flooded and planted fields with dikes
          const fx = x / 16, fz = z / 16, fi = Math.floor(fx), fj = Math.floor(fz);
          const dike = (fx - fi) < 0.22 || (fz - fj) < 0.22;
          const t = ((fi * 73856093) ^ (fj * 19349663)) & 3;
          const nk = L.night ? 0.7 : 1;                                        // at night the moon does not light the paddies as bright as the day paints them
          const field = t === 0 || t === 3 ? (L.night ? [0.27, 0.37, 0.5] : [0.50, 0.74, 0.92]) : t === 1 ? [0.46 * nk, 0.80 * nk, 0.30 * nk] : [0.30 * nk, 0.62 * nk, 0.26 * nk];
          c = mixc(c, dike ? [0.58, 0.50, 0.30] : field, smoothstep(clamp((d - half - 6) / 6, 0, 1)));
        }
        if (s0 > track.cityStart - 30 && d < 48) {                            // town: sidewalks and paving
          city = true;
          c = d < half + 3.4 ? [0.80, 0.78, 0.76] : mixc([0.62, 0.60, 0.62], c, smoothstep(clamp((d - 34) / 14, 0, 1)));
        }
      }
      if (castleL) { const cm = castleCourt(castleL, x, z); if (cm > 0) c = mixc(c, [0.52, 0.47, 0.39], cm * 0.9); }        // courtyard: trodden earth (blockout colour, art may change it)
      const shoulder = 1 - smoothstep(clamp((d - half) / 3.5, 0, 1));
      if (shoulder > 0 && !city) c = mixc(c, sb > 0.5 ? mixc(L.snow, [0, 0, 0], 0.08) : L.dirt, shoulder * 0.8);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      soil[k] = city ? 0 : shoulder;                                    // how much soil texture to blend in (art/textures.js)
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let q = 0;
    for (let iz = 0; iz < nz - 1; iz++) for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('soil', new THREE.BufferAttribute(soil, 1));
    const uvs = new Float32Array(nx * nz * 2);
    for (let k = 0; k < nx * nz; k++) { uvs[k * 2] = pos[k * 3] / 11; uvs[k * 2 + 1] = pos[k * 3 + 2] / 11; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, groundMaterial(true));
    mesh.position.y = -0.07;
    mesh.receiveShadow = true;
    add(mesh);
  }

  /* ---------- road ribbon: one texture per surface (art/textures.js), loose spill past the edge ---------- */
  const ROAD_TINT = { tarmac: 1, gravel: 1, snow: 1, dirt: 1 };      // the textures carry the colour; this only dims or brightens a surface
  function buildRoad() {
    const across = [-ROAD_EXT, -1, -0.7, -0.35, 0.35, 0.7, 1, ROAD_EXT];
    const n = P.length, A = across.length;
    const pos = new Float32Array(n * A * 3), col = new Float32Array(n * A * 3), uv = new Float32Array(n * A * 2);
    for (let i = 0; i < n; i++) {
      const p = P[i], tint = ROAD_TINT[p.surface] || 1;
      for (let j = 0; j < A; j++) {
        const k = i * A + j, [x, z] = sideXZ(p, across[j] * half), shade = tint * (Math.abs(across[j]) > 1 ? 0.92 : 1);
        uv[k * 2] = (across[j] + ROAD_EXT) / (2 * ROAD_EXT); uv[k * 2 + 1] = p.s / ROAD_TILE;
        pos[k * 3] = x; pos[k * 3 + 1] = terrain.heightAt(x, z) + 0.03; pos[k * 3 + 2] = z;
        col[k * 3] = shade; col[k * 3 + 1] = shade; col[k * 3 + 2] = shade;
      }
    }
    const idx = [], kinds = [], groups = [];
    for (let i = 0; i < n - 1; i++) {
      const kind = P[i].surface;
      if (!groups.length || groups[groups.length - 1].kind !== kind) groups.push({ kind, start: idx.length, count: 0 });
      for (let j = 0; j < A - 1; j++) { const a = i * A + j, b = a + 1, c = a + A, d = c + 1; idx.push(a, b, c, b, d, c); }
      groups[groups.length - 1].count = idx.length - groups[groups.length - 1].start;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mats = {};
    for (const g of groups) { if (!mats[g.kind]) { mats[g.kind] = kinds.length; kinds.push(lit({ vertexColors: true, map: roadTex(g.kind), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); } geo.addGroup(g.start, g.count, mats[g.kind]); }
    const road = new THREE.Mesh(geo, kinds);
    road.receiveShadow = true;
    add(road);
    // dashed centre line on tarmac
    const dashGeo = new THREE.PlaneGeometry(0.16, 3); dashGeo.rotateX(-Math.PI / 2);
    const dashes = [];
    for (let s = 20; s < track.length - 10; s += 9) if (sampleAt(s).surface === 'tarmac') dashes.push(sampleAt(s));
    instanced(dashGeo, lit({ color: 0xeeeadc, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), dashes,
      (o, p) => { o.position.set(p.x, terrain.heightAt(p.x, p.z) + 0.05, p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); }, { shadow: false });
  }

