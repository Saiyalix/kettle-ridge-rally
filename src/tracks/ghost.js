  /* ---------- ghost: your best run per stage + car, and the time gap to it (and to the nearest rival) ---------- */
  // Recording: 10 samples a second (x, y, z, yaw, pitch, roll), packed as 6 int16 per sample, base64, in localStorage
  // ('rallyGhost1:<stage>:<car>', about 15-40 KB per stage, refused above GHOST_MAX_CHARS). Saved only when the run
  // finishes and beats the saved ghost for that stage + car. The ghost is drawn as ONE translucent mesh (the car's
  // triangles merged once), no shadow, no collision, and nothing here touches the physics, the random numbers or the rivals.
  const GHOST_HZ = 10, GHOST_MAX = 6000, GHOST_MAX_CHARS = 90000, GHOST_NF = 6;
  const gRec = new Float32Array(GHOST_MAX * GHOST_NF);
  let gN = 0, gLastT = 1e9, gOverflow = false, gPlay = null, gPlayKey = null, gOn = true;
  try { gOn = localStorage.getItem('rallyGhost') !== 'off'; } catch (e) { /* storage unavailable */ }
  const gEuler = new THREE.Euler(0, 0, 0, 'YXZ'), gQ = new THREE.Quaternion();
  const ghostKey = () => 'rallyGhost1:' + ST.bestKey + ':' + CONFIG.cars[CONFIG.carIndex].id;

  function ghostEncode(t) {
    const n = gN, q = new Int16Array(n * GHOST_NF);
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < n; i++) {
      const o = i * GHOST_NF, x = Math.round(gRec[o] * 20), y = Math.round(gRec[o + 1] * 20), z = Math.round(gRec[o + 2] * 20);
      q[o] = x - px; q[o + 1] = y - py; q[o + 2] = z - pz; px = x; py = y; pz = z;         // 5 cm steps, deltas (no drift: the running total is rounded)
      q[o + 3] = Math.round(gRec[o + 3] * 1e4); q[o + 4] = Math.round(gRec[o + 4] * 1e4); q[o + 5] = Math.round(gRec[o + 5] * 1e4);
    }
    const u8 = new Uint8Array(q.buffer); let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return JSON.stringify({ v: 1, t: Math.round(t * 1000) / 1000, n, d: btoa(s) });
  }
  function ghostDecode(str) {                       // -> { t, n, x, y, z, yaw, pitch, roll, s } or null
    try {
      const j = JSON.parse(str); if (!j || j.v !== 1 || !(j.n > 2) || !j.d) return null;
      const bin = atob(j.d), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const q = new Int16Array(u8.buffer), n = j.n; if (q.length < n * GHOST_NF) return null;
      const g = { t: j.t, n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), yaw: new Float32Array(n), pitch: new Float32Array(n), roll: new Float32Array(n), s: new Float32Array(n) };
      let px = 0, py = 0, pz = 0, k = 0;
      for (let i = 0; i < n; i++) {
        const o = i * GHOST_NF; px += q[o]; py += q[o + 1]; pz += q[o + 2];
        g.x[i] = px / 20; g.y[i] = py / 20; g.z[i] = pz / 20; g.yaw[i] = q[o + 3] / 1e4; g.pitch[i] = q[o + 4] / 1e4; g.roll[i] = q[o + 5] / 1e4;
        // distance along the road at each sample (so the gap can be read at any point): nearest road point, searching forward
        let bd = 1e18, bi = k; for (let m = Math.max(0, k - 5); m < Math.min(P.length, k + 80); m++) { const dx = P[m].x - g.x[i], dz = P[m].z - g.z[i], d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = m; } }
        if (bd < 40 * 40) k = bi; g.s[i] = Math.max(P[k].s, i ? g.s[i - 1] : 0);
      }
      return g;
    } catch (e) { return null; }
  }
  function ghostLoadPlay() {                        // the ghost to race against: loaded once per stage + car (and again after a new best is saved)
    const key = ghostKey(); if (gPlayKey === key) return;
    gPlayKey = key; gPlay = null;
    try { const str = localStorage.getItem(key); if (str) gPlay = ghostDecode(str); } catch (e) { /* storage unavailable */ }
  }
  function ghostSample(i) {
    const o = i * GHOST_NF;
    gRec[o] = car.pos.x; gRec[o + 1] = car.pos.y; gRec[o + 2] = car.pos.z;
    gEuler.setFromQuaternion(car.q, 'YXZ'); gRec[o + 3] = gEuler.y; gRec[o + 4] = gEuler.x; gRec[o + 5] = gEuler.z;
  }
  // called every physics step while running (checkpoints.js updateProgress): starts a new recording when the clock goes back to the start
  function ghostRecord() {
    if (raceTime < gLastT) { gN = 0; gOverflow = false; ghostLoadPlay(); }
    gLastT = raceTime;
    if (gOverflow) return;
    while (raceTime >= gN / GHOST_HZ) { if (gN >= GHOST_MAX) { gOverflow = true; return; } ghostSample(gN++); }
  }
  // called once when the finish line is crossed
  function ghostFinish(t) {
    gLastT = 1e9;                                    // the next step is a new run
    if (gOverflow || gN < 3) return;
    if (gPlay && !(t < gPlay.t)) return;             // not faster than the saved ghost
    try { const str = ghostEncode(t); if (str.length <= GHOST_MAX_CHARS) { localStorage.setItem(ghostKey(), str); gPlayKey = null; } } catch (e) { /* storage full or unavailable */ }
  }

  /* the ghost car: the player car's triangles merged into one translucent mesh (rebuilt when the car or livery changes) */
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.34, depthWrite: false });
  const ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat);
  ghostMesh.visible = false; ghostMesh.castShadow = false; ghostMesh.receiveShadow = false; ghostMesh.rotation.order = 'YXZ'; ghostMesh.frustumCulled = false; ghostMesh.renderOrder = 5;
  scene.add(ghostMesh);
  let ghostBuiltFor = null;
  function ghostBuild() {
    const parts = [], m4 = new THREE.Matrix4(), add = (geo, mat) => {
      const g = geo.clone(); if (mat) g.applyMatrix4(mat);
      const pos = g.getAttribute('position'), idx = g.index, cnt = idx ? idx.count : pos.count, arr = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) { const v = idx ? idx.getX(i) : i; arr[i * 3] = pos.getX(v); arr[i * 3 + 1] = pos.getY(v); arr[i * 3 + 2] = pos.getZ(v); }
      parts.push(arr); g.dispose();
    };
    for (const c of bodyRoot.children) if (c.geometry && !(c.userData && c.userData.own)) { c.updateMatrix(); add(c.geometry, c.matrix); }
    car.wheels.forEach((w, i) => {
      const fl = wheelMeshes[i].flip, wm = fl && fl.children[0]; if (!wm) return;
      m4.makeRotationY(fl.rotation.y).setPosition(w.local.x, w.local.y, w.local.z); add(wm.geometry, m4);
    });
    let total = 0; for (const a of parts) total += a.length;
    const all = new Float32Array(total); let o = 0; for (const a of parts) { all.set(a, o); o += a.length; }
    ghostMesh.geometry.dispose(); ghostMesh.geometry = new THREE.BufferGeometry(); ghostMesh.geometry.setAttribute('position', new THREE.BufferAttribute(all, 3));
    ghostBuiltFor = carBuilt;
  }
  // ghost time at a distance along the road (binary search over the recorded samples); -1 when the ghost has not got that far
  function ghostTimeAt(g, d) {
    if (d > g.s[g.n - 1] || d < g.s[0]) return -1;
    let lo = 0, hi = g.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (g.s[m] <= d) lo = m; else hi = m; }
    const ds = g.s[hi] - g.s[lo], u = ds > 1e-6 ? (d - g.s[lo]) / ds : 0;
    return (lo + u) / GHOST_HZ;
  }

  /* gap line under the clock: "GHOST -1.2" (green = ahead of your best) and the nearest rival "NAME +0.8" (red = behind) */
  const gapBox = document.createElement('div'), gapG = document.createElement('div'), gapR = document.createElement('div');
  gapBox.id = 'gapBox'; gapBox.className = 'hud'; gapBox.hidden = true;
  gapBox.style.cssText = 'position:static;margin-top:2px;font-family:var(--f-arcade);font-size:calc(var(--d-lbl) + 2px);line-height:1.15;white-space:nowrap';
  gapBox.append(gapG, gapR); $('timing').insertBefore(gapBox, elSplits);
  const gapTxt = { g: '', r: '' };
  let gapNext = 0;
  const fmtGapT = d => (d > 0.005 ? '+' : d < -0.005 ? '−' : '±') + Math.abs(d).toFixed(1);
  function setGap(el, key, txt, d) {
    if (gapTxt[key] === txt) return; gapTxt[key] = txt; el.textContent = txt; el.style.color = d > 0.005 ? '#ff6b5b' : '#6dff8a';
  }
  // pause-menu button, made here so the page files stay untouched
  const ghostBtn = document.createElement('button'); ghostBtn.className = 'ghost'; ghostBtn.id = 'ghostBtn';
  $('debugBtn').parentNode.insertBefore(ghostBtn, $('debugBtn'));
  ghostBtn.addEventListener('click', () => { gOn = !gOn; try { localStorage.setItem('rallyGhost', gOn ? 'on' : 'off'); } catch (e) { /* ignore */ } });
  let ghostLbl = '';

  // once per frame (hook in ui/visuals-hud.js updateVisuals)
  function ghostFrame() {
    const lbl = 'Ghost: ' + (gOn ? 'On' : 'Off'); if (lbl !== ghostLbl) { ghostLbl = lbl; ghostBtn.textContent = lbl; }
    const live = state === 'running' || state === 'countdown' || state === 'paused';     // not in the menu, replays or after the finish
    if (!live) { ghostMesh.visible = false; gapBox.hidden = true; return; }
    if (state === 'countdown') ghostLoadPlay();
    const g = gPlay;
    if (g && gOn) {
      if (ghostBuiltFor !== carBuilt) ghostBuild();
      const f = clamp(raceTime * GHOST_HZ, 0, g.n - 1.001), i = f | 0, u = f - i, j = i + 1;
      let dy = g.yaw[j] - g.yaw[i]; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
      ghostMesh.position.set(g.x[i] + (g.x[j] - g.x[i]) * u, g.y[i] + (g.y[j] - g.y[i]) * u, g.z[i] + (g.z[j] - g.z[i]) * u);
      ghostMesh.rotation.set(g.pitch[i] + (g.pitch[j] - g.pitch[i]) * u, g.yaw[i] + dy * u, g.roll[i] + (g.roll[j] - g.roll[i]) * u);
      ghostMesh.visible = true;
    } else ghostMesh.visible = false;
    // gaps: four times a second, only once the stage is under way
    if (state === 'paused') return;
    const now = performance.now(); if (now < gapNext) return; gapNext = now + 250;
    const s = P[progIdx].s;
    if (state !== 'running' || s < startS + 20) { gapBox.hidden = true; return; }
    let any = false;
    const tg = g ? ghostTimeAt(g, s) : -1;
    if (tg >= 0) { const d = raceTime - tg; setGap(gapG, 'g', 'GHOST ' + fmtGapT(d), d); gapG.hidden = false; any = true; } else gapG.hidden = true;
    let bn = null, bd = 1e9;                         // the rival closest to you in time at this spot
    if (!ST.practice) for (const r of rivals) if (r.tab) { const d = raceTime - timeAtDist(r.tab, s); if (Math.abs(d) < Math.abs(bd)) { bd = d; bn = r.name; } }
    if (bn && Math.abs(bd) < 30) { setGap(gapR, 'r', bn.split(' ').pop().slice(0, 9).toUpperCase() + ' ' + fmtGapT(bd), bd); gapR.hidden = false; any = true; } else gapR.hidden = true;
    gapBox.hidden = !any;
  }
