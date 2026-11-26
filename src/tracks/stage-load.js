  /* ---------- gates: start, checkpoints, finish ---------- */
  // draws one 512 x 64 gate / barrier label at the canvas origin (the caller may translate first)
  function drawLabel(g, text, bg, fg, checker) {
    if (checker) { for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 16, y * 16, 16, 16); } }
    else { g.fillStyle = bg; g.fillRect(0, 0, 512, 64); }
    if (text) {
      g.font = '800 44px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (checker) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(150, 6, 212, 52); }
      g.fillStyle = fg; g.fillText(text, 256, 34);
    }
  }
  function labelTexture(text, bg, fg, checker) { return canvasTex(512, 64, (g) => drawLabel(g, text, bg, fg, checker)); }
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
  // a signboard (blue direction board or black entry board) drawn at the canvas origin, 440 x (56 per line + 24)
  function drawBoard(g, lines, kind) {
    const rowH = 56, W = 440, H = rowH * lines.length + 24;
    g.fillStyle = kind === 'entry' ? '#111' : '#1456a8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f5f5f5'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#fff'; g.font = '800 44px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = kind === 'entry' ? 'center' : 'left'; g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, kind === 'entry' ? W / 2 : 28, 12 + rowH * (i + 0.5)));
  }
  /* All run-in / run-out props of a stage are merged: ONE unlit mesh for every board and label, post and barrier
     (one atlas texture with a white corner for the plain colours; the posts and the red / white bar stripes are boxes with vertex colours). One draw call however many signs there are. */
  function contextProps() {
    const C = ST.context; if (!C) return;
    const boards = [], plates = geoBuilder(), posts = plates, col = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    // a box in a frame placed at (px, py, pz) turned by yaw (same convention as Object3D.rotation.y)
    const frame = (px, py, pz, yaw) => { const c = Math.cos(yaw), sn = Math.sin(yaw); return { c, sn, T: (x, y, z) => [px + x * c + z * sn, py + y, pz - x * sn + z * c], N: (x, y, z) => [x * c + z * sn, y, -x * sn + z * c] }; };
    const box = (b, F, x0, x1, y0, y1, z0, z1, cl) => {
      const f = (pts, n) => b.quad(b.v(...F.T(...pts[0]), 0.99, 0.002, cl), b.v(...F.T(...pts[1]), 0.99, 0.002, cl), b.v(...F.T(...pts[2]), 0.99, 0.002, cl), b.v(...F.T(...pts[3]), 0.99, 0.002, cl), F.N(...n));
      f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]); f([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
      f([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]); f([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
      f([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]); f([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    };
    const plate = (F, cx, cy, cz, w, h, board) => { board.F = F; board.q = [cx, cy, cz, w, h]; boards.push(board); };
    for (const sg of C.signs || []) {                                  // signposts: a grey post and a board facing back down the road
      const p = sampleV(sg.s), off = half + (sg.off != null ? sg.off : 5.5), [x, z] = sideXZ(p, (sg.side < 0 ? -1 : 1) * off), y = terrain.heightAt(x, z);
      const w = sg.kind === 'entry' ? 2.4 : 3.4, h = w * (56 * sg.lines.length + 24) / 440, F = frame(x, y, z, p.th + Math.PI), ph = 2.6 + h / 2;
      box(posts, F, -0.07, 0.07, 0, ph, -0.07, 0.07, col(0x6b6b70));
      plate(F, 0, 2.2 + h / 2, 0.09, w, h, { lines: sg.lines, kind: sg.kind, px: 440, py: 56 * sg.lines.length + 24 });
    }
    // a barrier across the road end: two striped bars on two posts with a ROAD CLOSED board. facing: +1 = seen by a driver going forward (run-out), -1 = seen from the start looking back (run-in)
    const closed = (p, facing) => {
      const hw = half + 0.9, y = Math.max(terrain.heightAt(p.x, p.z), terrain.heightAt(p.x - Math.cos(p.th) * hw, p.z + Math.sin(p.th) * hw));
      const F = frame(p.x, y, p.z, p.th + (facing > 0 ? Math.PI : 0)), red = col('#d02a22'), white = col('#f2f2f2');
      for (const by of [1.0, 0.62]) for (let i = 0; i < 8; i++) box(posts, F, -hw + hw * 2 * i / 8, -hw + hw * 2 * (i + 1) / 8, by - 0.12, by + 0.12, -0.05, 0.05, i % 2 ? white : red);
      for (const px of [-hw, hw]) box(posts, F, px - 0.08, px + 0.08, 0, 1.3, -0.08, 0.08, col(0xe8e8e8));
      plate(F, 0, 1.55, 0.07, 1.9, 0.5, { label: 'ROAD CLOSED', px: 512, py: 64 });
    };
    if (track.ends.lead && track.ends.lead.end === 'gate') closed(track.ends.lead.p, -1);
    if (track.ends.tail && track.ends.tail.end === 'gate') closed(track.ends.tail.p, 1);
    if (!boards.length) return;
    // atlas: boards stacked in one 512 px wide canvas, 8 px apart
    let H = 0; for (const b of boards) { b.y0 = H; H += b.py + 8; }
    H += 8; let AH = 64; while (AH < H) AH *= 2;
    const atlas = canvasTex(512, AH, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 512, AH); for (const b of boards) { g.save(); g.translate(0, b.y0); if (b.label) drawLabel(g, b.label, '#c62828', '#ffffff'); else drawBoard(g, b.lines, b.kind); g.restore(); } });
    for (const b of boards) {
      const [cx, cy, cz, w, h] = b.q, F = b.F, u1 = b.px / 512, v1 = 1 - b.y0 / AH, v0 = 1 - (b.y0 + b.py) / AH;
      plates.quad(plates.v(...F.T(cx - w / 2, cy - h / 2, cz), 0, v0), plates.v(...F.T(cx + w / 2, cy - h / 2, cz), u1, v0), plates.v(...F.T(cx + w / 2, cy + h / 2, cz), u1, v1), plates.v(...F.T(cx - w / 2, cy + h / 2, cz), 0, v1), F.N(0, 0, 1));
    }
    add(new THREE.Mesh(plates.build(), new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, fog: true })));
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
    buildGround(rng); buildSkirt(); buildRoad(); planHouses(frng); planContext(crng); worldPlan();
    if (ST.theme === 'alpine') sceneryAlpine(rng); else if (ST.theme === 'japan') sceneryJapan(rng); else if (ST.theme === 'castle') sceneryCastle(rng); else if (ST.theme === 'desert') sceneryDesert(rng); else if (ST.theme === 'test') sceneryTest(rng); else sceneryForest(rng);
    trackside(rng); buildRoadside(frng); buildNature(); contextRoadside(crng); contextProps(); worldBuild();
    if (ST.id === 'test') settleDemo();                                    // art's settlement-kit showcase (see art/settlement.js); delete this line to remove it
    for (const g of ST.signs || []) makeGate(g.s, g.text, g.bg, g.fg, false, { kind: 'arch', lights: 'cp' });      // practice stage: a big banner over the road at the start of each section
    makeGate(16, ST.code + '  START', '#1f8a4c', '#ffffff', false, { kind: 'arch', lights: 'start' });
    ST.checkpoints.forEach((s, k) => makeGate(s, 'CHECKPOINT ' + (k + 1), '#ffc928', '#0d1216', false, { kind: 'truss', lights: 'cp' }));
    makeGate(track.finishS, 'FINISH', '#111', '#ffc928', true, { kind: 'arch', lights: 'finish' });
    if (!ST.practice) eventDetail();                                      // own generator: start / finish areas, marshals, photographers, hay
    crowdBuild();
    worldSolids();
    hashObstacles();
    buildMinimap();
    applyLook(ST.look);
    onStageLoaded();
    loading = false; setMenuBusy(false);
  }

