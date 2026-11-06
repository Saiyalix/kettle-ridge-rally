  /* ---------- gates: start, checkpoints, finish ---------- */
  function labelTexture(text, bg, fg, checker) {
    return canvasTex(512, 64, (g) => {
      if (checker) { for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 16, y * 16, 16, 16); } }
      else { g.fillStyle = bg; g.fillRect(0, 0, 512, 64); }
      if (text) {
        g.font = '800 44px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (checker) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(150, 6, 212, 52); }
        g.fillStyle = fg; g.fillText(text, 256, 34);
      }
    });
  }
  // look = { kind: 'arch' | 'truss', lights: 'start' | 'finish' | 'cp' }: the 3D structure is built in art/structures.js (gateModel)
  function makeGate(s, text, bg, fg, checker, look = { kind: 'arch' }) {
    const p = sampleAt(s), g = new THREE.Group(), w = half * 2 + 3.4;
    const M = gateModel(look.kind, w, { c1: cssRGB(bg), c2: cssRGB(fg), checker, lights: look.lights });
    const body = new THREE.Mesh(M.struct, structMat()); body.castShadow = body.receiveShadow = true; g.add(body);
    g.add(new THREE.Mesh(M.beacons, beaconMat()));
    const mat = new THREE.MeshBasicMaterial({ map: labelTexture(text, bg, fg, checker), side: THREE.FrontSide, fog: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(M.bw, M.bh), mat); front.position.set(0, M.bannerY, M.bannerZ);
    const back = front.clone(); back.rotation.y = Math.PI; back.position.z = -M.bannerZ;
    g.add(front, back);
    g.position.set(p.x, terrain.heightAt(p.x, p.z), p.z); g.rotation.y = p.th;
    if (ST.look.night) for (const [lx, ly, lz, c] of M.glows) glowSpots.push({ x: g.position.x + lx * Math.cos(p.th) + lz * Math.sin(p.th), y: g.position.y + ly, z: g.position.z - lx * Math.sin(p.th) + lz * Math.cos(p.th), c, size: 1.4 });
    add(g);
  }

  /* ---------- minimap ---------- */
  function buildMinimap() {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of P) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); }
    const sc = 300 / Math.max(b - a, d - c);
    mmX = x => 170 - (x - (a + b) / 2) * sc;   // mirror x so the map matches driving view (right = -x)
    mmY = z => 170 - (z - (c + d) / 2) * sc;
    const g = mmBase.getContext('2d');
    g.clearRect(0, 0, 340, 340);
    const surfCol = { tarmac: '#7d848a', gravel: '#c49a62', snow: '#e8eef4', dirt: '#a8754a' };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 9; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(mmX(p.x), mmY(p.z)) : g.moveTo(mmX(p.x), mmY(p.z))); g.stroke();
    g.lineWidth = 5;
    for (let i = 1; i < P.length; i++) { g.strokeStyle = surfCol[P[i].surface]; g.beginPath(); g.moveTo(mmX(P[i - 1].x), mmY(P[i - 1].z)); g.lineTo(mmX(P[i].x), mmY(P[i].z)); g.stroke(); }
    const dot = (s, col, r) => { const p = sampleAt(s); g.fillStyle = col; g.beginPath(); g.arc(mmX(p.x), mmY(p.z), r, 0, 7); g.fill(); };
    dot(0, '#1f8a4c', 9); ST.checkpoints.forEach(s => dot(s, '#ffc928', 6)); dot(track.finishS, '#ff4b3e', 9);
  }

  /* ---------- load a stage: tear down the old world, build the new one ---------- */
  async function loadStage(i) {
    if (loading || i === stageIdx) return;
    loading = true; setMenuBusy(true);
    await new Promise(r => setTimeout(r, 40));        // let the "building" label paint first
    if (STAGES[i].theme === 'japan') await fontReady;
    stageIdx = i; ST = STAGES[i]; CONFIG.stage = ST; half = ST.roadHalfWidth;
    if (stageGroup) { scene.remove(stageGroup); disposeTree(stageGroup); }
    stageGroup = new THREE.Group(); scene.add(stageGroup);
    track = buildTrack(ST); terrain = buildTerrain(track, ST); world = makeWorld(track, terrain, ST); P = track.samples;
    obstacles = []; crowdReset();
    const rng = mulberry32(ST.seed);
    const frng = mulberry32(ST.seed * 977 + 13);        // roadside frame has its own generator, so the old scenery stays where it was
    buildGround(rng); buildRoad(); planHouses(frng);
    if (ST.theme === 'alpine') sceneryAlpine(rng); else if (ST.theme === 'japan') sceneryJapan(rng); else sceneryForest(rng);
    trackside(rng); buildRoadside(frng); buildNature();
    makeGate(16, ST.code + '  START', '#1f8a4c', '#ffffff', false, { kind: 'arch', lights: 'start' });
    ST.checkpoints.forEach((s, k) => makeGate(s, 'CHECKPOINT ' + (k + 1), '#ffc928', '#0d1216', false, { kind: 'truss', lights: 'cp' }));
    makeGate(track.finishS, 'FINISH', '#111', '#ffc928', true, { kind: 'arch', lights: 'finish' });
    crowdBuild();
    hashObstacles();
    buildMinimap();
    applyLook(ST.look);
    onStageLoaded();
    loading = false; setMenuBusy(false);
  }

