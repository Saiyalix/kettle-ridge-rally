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

  /* ---------- run-in / run-out props (ST.context): ROAD CLOSED barrier, signposts ----------
     Visual only: no collision, nothing the clock or the bot can see. Placeholder look (art may restyle).
     ST.context.signs: [{ s, side, kind: 'entry' | 'direction', lines: ['ALDERBY'], off }]   s may be < 0 or > length; names and km from docs/region.md. */
  function boardTexture(lines, kind) {
    const rowH = 56, W = 440, H = rowH * lines.length + 24;
    return canvasTex(W, H, (g) => {
      g.fillStyle = kind === 'entry' ? '#111' : '#1456a8'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#f5f5f5'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle = '#fff'; g.font = '800 44px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = kind === 'entry' ? 'center' : 'left'; g.textBaseline = 'middle';
      lines.forEach((t, i) => g.fillText(t, kind === 'entry' ? W / 2 : 28, 12 + rowH * (i + 0.5)));
    });
  }
  function roadSign(sg) {
    const p = sampleV(sg.s), off = half + (sg.off != null ? sg.off : 5.5), [x, z] = sideXZ(p, (sg.side < 0 ? -1 : 1) * off), y = terrain.heightAt(x, z);
    const w = sg.kind === 'entry' ? 2.4 : 3.4, h = w * (56 * sg.lines.length + 24) / 440, g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6 + h / 2, 0.14), lit({ color: 0x6b6b70 })); post.position.y = (2.6 + h / 2) / 2;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: boardTexture(sg.lines, sg.kind), fog: true }));
    board.position.set(0, 2.2 + h / 2, 0.09);
    g.add(post, board);
    g.position.set(x, y, z); g.rotation.y = p.th + Math.PI;         // faces back down the road: the driver going forward reads it
    add(g);
  }
  // a barrier across the road end: striped bar on two posts with a ROAD CLOSED board. facing: +1 = seen by a driver going forward (run-out), -1 = seen from the start looking back (run-in)
  function roadClosed(p, facing) {
    const hw = half + 0.9, g = new THREE.Group(), stripe = canvasTex(128, 16, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f2f2f2' : '#d02a22'; c.fillRect(i * 16, 0, 16, 16); } });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.24, 0.1), lit({ map: stripe })); bar.position.y = 1.0;
    const bar2 = bar.clone(); bar2.position.y = 0.62;
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), lit({ color: 0xe8e8e8 })); lp.position.set(-hw, 0.65, 0);
    const rp = lp.clone(); rp.position.x = hw;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('ROAD CLOSED', '#c62828', '#ffffff'), fog: true }));
    sign.position.set(0, 1.55, 0.07);
    g.add(bar, bar2, lp, rp, sign);
    const y = Math.max(terrain.heightAt(p.x, p.z), terrain.heightAt(p.x - Math.cos(p.th) * hw, p.z + Math.sin(p.th) * hw));
    g.position.set(p.x, y, p.z); g.rotation.y = p.th + (facing > 0 ? Math.PI : 0);
    add(g);
  }
  function contextProps() {
    const C = ST.context; if (!C) return;
    for (const sg of C.signs || []) roadSign(sg);
    if (track.ends.lead && track.ends.lead.end === 'gate') roadClosed(track.ends.lead.p, -1);
    if (track.ends.tail && track.ends.tail.end === 'gate') roadClosed(track.ends.tail.p, 1);
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
    castleL = ST.castle ? castleLayout(track, ST) : null;      // SS4: the castle, planned before the ground so the courtyard can be tinted
    const rng = mulberry32(ST.seed);
    const frng = mulberry32(ST.seed * 977 + 13);        // roadside frame has its own generator, so the old scenery stays where it was
    const crng = mulberry32(ST.seed * 131 + 11);       // run-in / run-out dressing (ST.context) has its own generator too
    buildGround(rng); buildRoad(); planHouses(frng); planContext(crng);
    if (ST.theme === 'alpine') sceneryAlpine(rng); else if (ST.theme === 'japan') sceneryJapan(rng); else if (ST.theme === 'castle') sceneryCastle(rng); else if (ST.theme === 'test') sceneryTest(rng); else sceneryForest(rng);
    trackside(rng); buildRoadside(frng); buildNature(); contextRoadside(crng); contextProps();
    for (const g of ST.signs || []) makeGate(g.s, g.text, g.bg, g.fg, false, { kind: 'arch', lights: 'cp' });      // practice stage: a big banner over the road at the start of each section
    makeGate(16, ST.code + '  START', '#1f8a4c', '#ffffff', false, { kind: 'arch', lights: 'start' });
    ST.checkpoints.forEach((s, k) => makeGate(s, 'CHECKPOINT ' + (k + 1), '#ffc928', '#0d1216', false, { kind: 'truss', lights: 'cp' }));
    makeGate(track.finishS, 'FINISH', '#111', '#ffc928', true, { kind: 'arch', lights: 'finish' });
    if (!ST.practice) eventDetail();                                      // own generator: start / finish areas, marshals, photographers, hay
    crowdBuild();
    hashObstacles();
    buildMinimap();
    applyLook(ST.look);
    onStageLoaded();
    loading = false; setMenuBusy(false);
  }

