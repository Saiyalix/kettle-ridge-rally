  /* ---------- theme: forest (Kettle Ridge) ---------- */
  function sceneryForest(rng) {
    const trees = scatter(rng, 2600, 12000, (x, z, d, y, s0) => {
      if (d < half + 5) return false;
      if (rng() > (d < 30 ? 0.75 : d < 90 ? 0.45 : 0.18)) return false;
      return nearHouse(x, z) ? false : { snow: s0 > ST.snowFrom - 40 };
    });
    const fin = track.finishS, snowS = ST.snowFrom - 40;
    const lvl = { snow: s0 => s0 > snowS, ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 7 && slopeAt(x, z) < 0.5 };
    const woods = woodExtras(trees, Object.assign({ salt: 1, a: 480, b: snowS, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14, rows: [
      { o0: 5.6, o1: 8.2, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.2 }, { o0: 9, o1: 14, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.4 },
      { o0: 15, o1: 24, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.6 }, { o0: 25, o1: 40, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4 }] }, lvl));
    const crest = woodExtras(trees.concat(woods), Object.assign({ salt: 2, a: snowS, b: fin - 90, minLen: 25, maxLen: 55, gapMin: 70, gapMax: 160, colMax: 14, rows: [
      { o0: 7, o1: 12, step: 5, p: 0.6, s0: 1.0, s1: 1.5, sep: 3.4 }, { o0: 13, o1: 24, step: 5, p: 0.55, s0: 1.1, s1: 1.6, sep: 3.8 }] }, lvl));
    conifers(trees.concat(woods, crest), (c, t) => t.snow ? c.setRGB(0.80 + rng() * 0.1, 0.88 + rng() * 0.08, 0.95) : c.setRGB(0.13 + rng() * 0.06, 0.48 + rng() * 0.12, 0.30 + rng() * 0.06));
    rocks(rng, roadsideRocks(rng, 320).filter(r => !nearHouse(r.x, r.z)));
    cornerRails(t => t.r <= 60, { postColor: 0x6b5238, railColor: 0xff6a1f, solid: true, mu: 0.3 });
  }

  /* ---------- theme: castle (Thornwick Keep) ---------- */
  function sceneryCastle(rng) {
    const C = ST.castle, g1 = C.gate1, g2 = C.gate2, fin = track.finishS, L = castleL;
    // forest thick on the climb, thin round the castle and on the descent, a meadow at the finish. Nothing solid within 8 m of the road edge.
    const gapOf = (x, z) => { const n = world.nearest(x, z); return n.i < 0 ? 99 : Math.sqrt(n.d2) - half; };      // exact distance from the road edge (the terrain grid's is only good to a few metres)
    const dens = s0 => s0 < 470 ? 0.3 : s0 < g1 - 20 ? 1 : s0 < g2 + 40 ? 0.3 : s0 < fin - 330 ? 0.65 : s0 < fin - 130 ? 0.25 : 0.03;
    const trees = scatter(rng, 2300, 14000, (x, z, d, y, s0) => {
      if (d < half + 8.2 || gapOf(x, z) < 8.6) return false;
      if (rng() > (d < 30 ? 0.75 : d < 90 ? 0.45 : 0.18) * dens(s0)) return false;
      return nearHouse(x, z) ? false : true;
    });
    const lvl = { ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 7 && slopeAt(x, z) < 0.5 };
    const rowsA = [{ o0: 5.6, o1: 8.2, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.2 }, { o0: 9, o1: 14, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.4 },
      { o0: 15, o1: 24, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.6 }, { o0: 25, o1: 40, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4 }];
    const woods = woodExtras(trees, Object.assign({ salt: 1, a: 480, b: g1 - 70, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14, rows: rowsA }, lvl));
    const lower = woodExtras(trees.concat(woods), Object.assign({ salt: 2, a: g2 + 70, b: fin - 330, minLen: 80, maxLen: 200, gapMin: 40, gapMax: 110, colMax: 14, rows: [rowsA[1], rowsA[2], rowsA[3]] }, lvl));
    for (const t of woods.concat(lower)) if (t.col && gapOf(t.x, t.z) < 8.6) t.col = false;        // trunks you can hit stay 8 m or more from the road edge; nearer ones are for looks only
    conifers(trees.concat(woods, lower), (c) => c.setRGB(0.18 + rng() * 0.06, 0.50 + rng() * 0.12, 0.27 + rng() * 0.06));      // (art) warmer olive greens for the dawn light; same three random draws
    // boulders: only the ones 8 m or more from the road edge are solid
    rocks(rng, roadsideRocks(rng, 220).filter(r => !nearHouse(r.x, r.z)).map(r => Object.assign(r, { solid: r.solid && gapOf(r.x, r.z) >= 8.6 + r.size })));
    buildCastle(L);
  }

  /* ---------- theme: alpine cliffs (Vulture Ledge) ---------- */
  function sceneryAlpine(rng) {
    const pines = scatter(rng, 1500, 14000, (x, z, d, y) => {
      if (d < half + 7 || y > ST.snowLine - 6 || slopeAt(x, z) > 0.45) return false;
      return rng() < (d < 40 ? 0.4 : d < 140 ? 0.22 : 0.1);
    });
    const upOf = (p, side) => side > 0 ? p.upR : p.upL;
    const ridge = { salt: 3, a: 40, b: track.finishS - 40, minLen: 180, maxLen: 420, gapMin: 12, gapMax: 50, colMax: 14,
      ok: (p, side, off, x, z, y) => { const u = upOf(p, side); if (y > ST.snowLine - 6 || slopeAt(x, z) > 0.5) return false;
        return u > 0.6 ? off >= 11 : u < 0.4 ? off >= 16 && y < p.y - 2 : off >= 13; },
      rows: [{ o0: 9, o1: 16, step: 4, p: 0.85, s0: 1.0, s1: 1.4, sep: 3.6 }, { o0: 17, o1: 28, step: 3.5, p: 0.9, s0: 1.1, s1: 1.6, sep: 4 }, { o0: 29, o1: 48, step: 3.6, p: 0.9, s0: 1.2, s1: 1.8, sep: 4.4 }] };
    const woods = woodExtras(pines, ridge);
    conifers(pines.concat(woods), (c) => c.setRGB(0.10 + rng() * 0.05, 0.38 + rng() * 0.1, 0.30 + rng() * 0.05), { tall: 1.25, wide: 0.8 });
    // boulders at the foot of the rock walls (solid), loose rocks across steep ground
    const wallRocks = roadsideRocks(rng, 160, (p, side) => (side > 0 ? p.upR : p.upL) > 0.6).map(r => Object.assign(r, { size: r.size * 1.6 }));
    const scree = scatter(rng, 420, 9000, (x, z, d, y) => d > half + 6 && slopeAt(x, z) > 0.55 ? { size: 0.4 + rng() * 1.4, solid: false } : false);
    rocks(rng, wallRocks.concat(scree), [0.60, 0.55, 0.62]);
    // drop-side walls and rock faces: see buildRoadside() in scenery.js. The old corner collision stays underneath as a safety layer.
    for (const sg of cliffBarriers(track, half).segs) obstacles.push(sg);
    distantPeaks(rng, 20, ST.look.peak ? ST.look.peak[0] : 0x9aa6d0, ST.look.peak ? ST.look.peak[1] : 0xf4f7ff, { dist: 1350, y: -60, hideRandom: !!ST.look.noPeaks });
  }

  /* ---------- theme: Japan (Sakura Touge) ---------- */
  function sceneryJapan(rng) {
    const city0 = track.cityStart, tun = ST.toriiTunnel;
    const inTunnel = s0 => s0 > tun[0] - 6 && s0 < tun[1] + 6;
    // cherry trees: countryside and around the shrine
    const sakura = scatter(rng, 700, 9000, (x, z, d, y, s0) => {
      if (d < half + 4.5 || s0 > city0 - 40 || (s0 > 700 && s0 < city0 - 300 && rng() < 0.85)) return false;
      if (s0 < 560 && d > half + 7 && d < 170 && slopeAt(x, z) < 0.14) return false;     // keep paddies open
      return rng() < (d < 25 ? 0.6 : d < 80 ? 0.3 : 0.08) && !nearHouse(x, z) ? { s: 0.8 + rng() * 0.5 } : false;
    });
    const lining = woodExtras(sakura, { salt: 4, a: 140, b: tun[0] - 40, minLen: 90, maxLen: 200, gapMin: 50, gapMax: 130, colMax: 12,
      ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 3 && slopeAt(x, z) < 0.4,
      rows: [{ o0: 5, o1: 8, step: 6.5, p: 0.75, s0: 0.9, s1: 1.3, sep: 4.5 }, { o0: 10, o1: 15, step: 9, p: 0.4, s0: 0.9, s1: 1.4, sep: 5 }] });
    const sakuraAll = sakura.concat(lining);
    treeStand(sakuraAll, () => SPECIES.sakura);
    for (const t of sakuraAll) if (t.col !== undefined ? t.col : t.d < 30) obstacles.push({ x: t.x, z: t.z, r: 0.3 * t.s });
    // cedar forest on the mountain pass
    const cedars = scatter(rng, 1800, 12000, (x, z, d, y, s0) => {
      if (d < half + 5 || s0 < 690 || s0 > city0 - 60 || inTunnel(s0)) return false;
      return rng() < (d < 50 ? 0.7 : d < 150 ? 0.4 : 0.15) && !nearHouse(x, z) ? { s: 0.9 + rng() * 0.5 } : false;
    });
    const groves = woodExtras(cedars, { salt: 5, a: tun[1] + 30, b: city0 - 70, minLen: 220, maxLen: 520, gapMin: 12, gapMax: 40, colMax: 14,
      ok: (p, side, off, x, z, y) => Math.abs(y - p.y) < 12 && slopeAt(x, z) < 0.55,
      rows: [{ o0: 6, o1: 9, step: 3.8, p: 0.9, s0: 0.9, s1: 1.3, sep: 3.4 }, { o0: 10, o1: 15, step: 3.4, p: 0.95, s0: 1.0, s1: 1.5, sep: 3.6 },
        { o0: 16, o1: 26, step: 3.2, p: 0.95, s0: 1.1, s1: 1.6, sep: 3.8 }, { o0: 27, o1: 42, step: 3.4, p: 0.9, s0: 1.2, s1: 1.8, sep: 4.2 }] });
    conifers(cedars.concat(groves), (c) => c.setRGB(0.10 + rng() * 0.04, 0.34 + rng() * 0.08, 0.26 + rng() * 0.05), { tall: 1.6, wide: 0.7 });
    rocks(rng, roadsideRocks(rng, 90, p => p.s > 700 && p.s < city0 - 60));
    // white guardrails on the pass
    cornerRails(t => t.r <= 80 && t.s0 > 680 && t.s1 < city0 - 30, { postColor: 0x8d939c, railColor: 0xeef1f5, railH: 0.32, railY: 0.62, offset: 1.4, postH: 0.8, solid: true });

    // tunnel of vermilion torii gates
    const VERM = 0xe2432b, gates = [];
    for (let s = tun[0]; s <= tun[1]; s += 4.6) gates.push(sampleAt(s));
    const span = half + 0.8;
    const pillars = [];
    for (const p of gates) for (const sd of [-1, 1]) { const [x, z] = sideXZ(p, sd * span); pillars.push({ x, z, y: terrain.heightAt(x, z) }); obstacles.push({ x, z, r: 0.32 }); }
    instanced(new THREE.CylinderGeometry(0.24, 0.27, 4.7, 10).translate(0, 2.35, 0), lit({ color: VERM }), pillars, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    const beamY = p => terrain.heightAt(p.x, p.z);
    instanced(new THREE.BoxGeometry(span * 2 + 1.8, 0.34, 0.5).translate(0, 4.75, 0), lit({ color: 0x2a1d22 }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(span * 2 + 1.4, 0.3, 0.42).translate(0, 4.4, 0), lit({ color: VERM }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(span * 2 + 0.6, 0.24, 0.3).translate(0, 3.7, 0), lit({ color: VERM }), gates, (o, p) => { o.position.set(p.x, beamY(p), p.z); o.rotation.set(0, p.th, 0); o.scale.setScalar(1); });

    // shrine beside the tunnel exit: stone platform, hall, hip roof, big torii and stone lanterns
    {
      const p = sampleAt(tun[1] + 30), [sx, sz] = sideXZ(p, -34), sy = terrain.heightAt(sx, sz);
      const shrine = new THREE.Group(); shrine.position.set(sx, sy, sz); shrine.rotation.y = p.th + Math.PI / 2;
      const box = (w, hh, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), lit({ color })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; shrine.add(m); return m; };
      box(16, 1.2, 13, 0xb9b2aa, 0, 0.2, 0);
      box(10, 4.2, 7.5, 0xf3e6cf, 0, 2.9, 0);
      for (const px of [-4.6, -1.6, 1.6, 4.6]) box(0.45, 4.2, 0.45, VERM, px, 2.9, 3.9);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 1, 1, 4, 1), lit({ color: 0x39405a }));
      roof.rotation.y = Math.PI / 4; roof.scale.set(9.5, 3.6, 7.6); roof.position.set(0, 6.8, 0); roof.castShadow = true; shrine.add(roof);
      box(13.5, 0.4, 10.5, 0x39405a, 0, 5.0, 0);
      // approach torii
      for (const px of [-2.6, 2.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 6.5, 10), lit({ color: VERM })); c.position.set(px, 3.25, 13); c.castShadow = true; shrine.add(c); }
      box(7.8, 0.45, 0.7, 0x2a1d22, 0, 6.6, 13); box(7.0, 0.4, 0.6, VERM, 0, 6.15, 13); box(6.0, 0.3, 0.4, VERM, 0, 5.2, 13);
      for (const [lx, lz] of [[-3.5, 9], [3.5, 9], [-3.5, 17], [3.5, 17]]) { box(0.9, 0.5, 0.9, 0xb5b0a8, lx, 0.25, lz); box(0.35, 1.0, 0.35, 0xb5b0a8, lx, 1.0, lz); box(0.9, 0.7, 0.9, 0xc9c3ba, lx, 1.85, lz); box(1.2, 0.3, 1.2, 0x8f8a83, lx, 2.35, lz); }
      add(shrine);
    }

    // utility poles and sagging wires (countryside and town)
    const poles = [];
    for (let s = 20; s < track.length - 20; s += 34) { if (s > 600 && s < city0 - 120) continue; if (inTunnel(s)) continue; const p = sampleAt(s), [x, z] = sideXZ(p, half + 2.8); poles.push({ x, z, y: terrain.heightAt(x, z), th: p.th, s }); obstacles.push({ x, z, r: 0.22 }); }
    instanced(new THREE.CylinderGeometry(0.13, 0.17, 9, 7).translate(0, 4.5, 0), lit({ color: 0x8b8d94 }), poles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, 8.3, 0), lit({ color: 0x5d6068 }), poles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); });
    {
      const verts = [];
      for (let i = 1; i < poles.length; i++) {
        const a = poles[i - 1], b = poles[i]; if (b.s - a.s > 40) continue;
        for (const off of [-0.8, 0, 0.8]) {
          const ox = Math.cos(a.th) * off, oz = -Math.sin(a.th) * off;
          let prev = null;
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, sag = Math.sin(t * Math.PI) * 0.7;
            const v = [a.x + (b.x - a.x) * t + ox, a.y + 8.3 + (b.y - a.y) * t - sag, a.z + (b.z - a.z) * t + oz];
            if (prev) verts.push(...prev, ...v); prev = v;
          }
        }
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2633 })));
    }

    // ----- town -----
    // window texture: 4 × 4 windows per tile, lit windows glow at dusk
    const winTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = '#3b4766'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); g.fillStyle = '#d9d5cf'; g.fillRect(i * 64 + 8, j * 64 + 50, 48, 5); }
    });
    const r2 = mulberry32(77);
    const litTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (r2() < (ST.look.night ? 0.8 : 0.55)) { g.fillStyle = r2() < 0.7 ? '#fff0b8' : '#d4ecff'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); }
    });
    for (const t of [winTex, litTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    const bMat = lit({ map: winTex, emissiveMap: litTex, emissive: 0xffffff, emissiveIntensity: ST.look.night ? 1.05 : 0.85, vertexColors: true });
    const WALLS = [[1.0, 0.96, 0.88], [0.86, 0.88, 0.92], [1.0, 0.84, 0.78], [0.82, 0.90, 1.0], [0.95, 0.90, 0.80], [0.78, 0.80, 0.84]];
    function building(w, d, hh) {
      const g = new THREE.BoxGeometry(w, hh, d); g.translate(0, hh / 2, 0);
      const uv = g.attributes.uv, n = uv.count;
      for (let v = 0; v < n; v++) {
        const face = Math.floor(v / 4), fw = face < 2 ? d : w;
        if (face === 2 || face === 3) uv.setXY(v, 0.01, 0.01);
        else uv.setXY(v, uv.getX(v) * fw / 12.8, uv.getY(v) * Math.max(1, hh - 1) / 13.6);
      }
      const wc = WALLS[Math.floor(rng() * WALLS.length)], cols = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) cols.set(wc, v * 3);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      return g;
    }
    const SIGNS = [['ラーメン', '#e2392b'], ['カラオケ', '#7a3cd6'], ['居酒屋', '#f0a01e'], ['薬局', '#1f9a5a'], ['ホテル', '#e0408a'], ['寿司', '#1d5fd1'], ['喫茶', '#8c5a2b'], ['本屋', '#0f8a8a'], ['ゲーム', '#d6309c'], ['焼鳥', '#c2341f']];
    const signMats = SIGNS.map(([txt, bg]) => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(128, 512, (g, w, hh) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, hh); g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, hh - 16);
      g.fillStyle = '#ffffff'; g.font = '800 84px ' + JP_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = [...txt], step = Math.min(110, (hh - 60) / chars.length);
      chars.forEach((ch, k) => g.fillText(ch, w / 2, hh / 2 + (k - (chars.length - 1) / 2) * step));
    }) }));
    const vendTex = canvasTex(64, 128, (g) => {
      g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#cfe8ff'; g.fillRect(6, 8, 52, 60);
      const cans = ['#e2392b', '#1d5fd1', '#f0a01e', '#1f9a5a', '#ffffff', '#7a3cd6'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { g.fillStyle = cans[(r * 5 + c) % cans.length]; g.fillRect(9 + c * 10, 12 + r * 19, 7, 14); }
      g.fillStyle = '#333a44'; g.fillRect(10, 84, 44, 10); g.fillRect(22, 104, 20, 14);
    });
    const vendMat = new THREE.MeshBasicMaterial({ map: vendTex });
    const lampHeads = [], lampPoles = [], lanterns = [], vends = [];
    const townB = [];                                  // look only: the buildings, for the 3D detail (art/buildings.js townDetail)
    for (const side of [-1, 1]) {
      let s = city0 + 10;
      while (s < track.length - 10) {
        const w = 8 + rng() * 9, d = 10 + rng() * 6, sc = s + w / 2, p = sampleAt(sc);
        const off = side * (half + 3.6 + d / 2), [cx, cz] = sideXZ(p, off);
        const fx = Math.sin(p.th), fz = Math.cos(p.th), rx = -Math.cos(p.th), rz = Math.sin(p.th);
        let ok = true;
        for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) if (terrain.distAt(cx + fx * a + rx * b, cz + fz * a + rz * b) < half + 2.6) ok = false;
        if (!ok || rng() < 0.08) { s += 5; continue; }
        const nearEnd = clamp((sc - city0) / (track.finishS - city0), 0, 1);
        const hh = 7 + rng() * 12 + nearEnd * rng() * 22;
        const y = terrain.heightAt(cx, cz) - 1.5;
        const m = new THREE.Mesh(building(w, d, hh), bMat); m.position.set(cx, y, cz); m.rotation.y = p.th + Math.PI / 2; m.castShadow = m.receiveShadow = true; add(m); townB.push({ x: cx, y, z: cz, yaw: p.th + Math.PI / 2, w, d, h: hh, side });
        { // the footprint as four wall segments (w along the road, d away from it), matching the mesh
          const ax = -Math.cos(p.th) * d / 2, az = Math.sin(p.th) * d / 2, bx = Math.sin(p.th) * w / 2, bz = Math.cos(p.th) * w / 2;
          const c = [[cx + ax + bx, cz + az + bz], [cx + ax - bx, cz + az - bz], [cx - ax - bx, cz - az - bz], [cx - ax + bx, cz - az + bz]];
          for (let k = 0; k < 4; k++) obstacles.push({ ax: c[k][0], az: c[k][1], bx: c[(k + 1) % 4][0], bz: c[(k + 1) % 4][1], r: 0.1, h: 99 });
        }
        // rooftop boxes
        if (rng() < 0.7) { const ac = new THREE.Mesh(new THREE.BoxGeometry(2 + rng() * 2, 1.2, 2), lit({ color: 0xbfc4cc })); ac.position.set(cx, y + hh + 0.6, cz); ac.rotation.y = p.th + rng(); add(ac); }
        // vertical sign sticking out from the facade, readable as you drive up
        if (rng() < 0.75) {
          const [gx, gz] = sideXZ(sampleAt(sc - w * 0.3), side * (half + 3.0));
          const si = Math.floor(rng() * signMats.length), sg = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.6), signMats[si]);
          sg.position.set(gx, terrain.heightAt(gx, gz) + 4.2 + rng() * 3, gz); sg.rotation.y = p.th; add(sg);
          if (ST.look.night) glowSpots.push({ x: gx, y: sg.position.y, z: gz, c: parseInt(SIGNS[si][1].slice(1), 16), size: 2.2 });
        }
        if (rng() < 0.4) for (let k = 0; k < 3; k++) { const [lx, lz] = sideXZ(sampleAt(sc - 2 + k * 2), side * (half + 3.3)); lanterns.push({ x: lx, z: lz, y: terrain.heightAt(lx, lz) + 3.1 }); if (ST.look.night) glowSpots.push({ x: lx, y: terrain.heightAt(lx, lz) + 3.1, z: lz, c: 0xff4a30, size: 1.2 }); }
        if (rng() < 0.25) { const [vx, vz] = sideXZ(sampleAt(sc + 1), side * (half + 2.9)); vends.push({ x: vx, z: vz, y: terrain.heightAt(vx, vz), th: p.th + (side > 0 ? Math.PI / 2 : -Math.PI / 2) }); obstacles.push({ x: vx, z: vz, r: 0.6 }); }
        s += w + 0.6 + rng() * 2;
      }
      for (let ls = city0 + 15; ls < track.length - 10; ls += 26) { const p = sampleAt(ls), [x, z] = sideXZ(p, side * (half + 0.9)), y = terrain.heightAt(x, z); lampPoles.push({ x, z, y, th: p.th, side }); lampHeads.push({ x: x + Math.cos(p.th) * side * 0.9, z: z - Math.sin(p.th) * side * 0.9, y: y + 5.6 }); obstacles.push({ x, z, r: 0.18 }); }
    }
    instanced(new THREE.CylinderGeometry(0.08, 0.1, 5.8, 6).translate(0, 2.9, 0), lit({ color: 0x5d6068 }), lampPoles, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1.0, 0.1, 0.1), lit({ color: 0x5d6068 }), lampPoles, (o, q) => { o.position.set(q.x + Math.cos(q.th) * q.side * 0.45, q.y + 5.75, q.z - Math.sin(q.th) * q.side * 0.45); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), lampHeads, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    instanced(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 10), new THREE.MeshBasicMaterial({ color: 0xff4a36 }), lanterns, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    instanced(new THREE.BoxGeometry(1.0, 1.9, 0.75).translate(0, 0.95, 0), [lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), lit({ color: 0xd8342c }), vendMat, lit({ color: 0xd8342c })], vends, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th, 0); o.scale.setScalar(1); });
    townDetail(townB);
    // zebra crossing just before the finish
    const stripes = [];
    { const p = sampleAt(track.finishS - 25); for (let k = -4; k <= 4; k++) { const [x, z] = sideXZ(p, k * (half / 4.6)); stripes.push({ x, z, y: terrain.heightAt(x, z) + 0.06, th: p.th }); } }
    instanced(new THREE.PlaneGeometry(0.55, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f2ea, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), stripes, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th, 0); o.scale.setScalar(1); }, { shadow: false });
    // a snow-capped volcano on the horizon, straight ahead at the finish
    const pe = sampleAt(track.finishS), fd = 1700;
    distantPeaks(rng, 10, ST.look.peak ? ST.look.peak[0] : 0x8d86c4, ST.look.peak ? ST.look.peak[1] : 0xfff0f4, { dist: 1400, y: -40, hideRandom: !!ST.look.noPeaks, extra: { x: pe.x + Math.sin(pe.th) * fd, z: pe.z + Math.cos(pe.th) * fd, r: 900, h: 720, rot: 0, cap: 0.28 } });
  }

  /* ---------- trackside: spectators behind tape and sponsor boards (all brands invented) ---------- */
  const SPONSORS = [['ROTOR OIL', '#d32f2f', '#ffffff'], ['KAISER TYRES', '#ffd600', '#111111'], ['NOVA FUEL', '#1565c0', '#ffffff'], ['GRIPMAX', '#111111', '#ffd600'],
    ['SOLARIS', '#ef6c00', '#ffffff'], ['TURBO COLA', '#c62828', '#ffe082'], ['VELOCE', '#2e7d32', '#ffffff'], ['ZENITH WATCHES', '#283593', '#ffd54f']];
  let sponsorMats = null, crowdTex = null;
  function getSponsorMats() {
    if (!sponsorMats) sponsorMats = SPONSORS.map(([txt, bg, fg]) => lit({ map: canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
      g.font = 'italic 900 58px "Arial Black", "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(txt, w / 2, h / 2 + 2);
    }), side: THREE.DoubleSide }));
    for (const m of sponsorMats) { m.userData.keep = true; m.map.userData.keep = true; }     // cached for every stage: the stage dispose leaves them
    return sponsorMats;
  }
  function getCrowdTex() {
    if (!crowdTex) {
      crowdTex = makeTex(512, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const r = mulberry32(11), shirts = ['#d32f2f', '#1976d2', '#fbc02d', '#388e3c', '#f5f5f5', '#212121', '#7b1fa2', '#f57c00', '#00897b'], skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
        for (let row = 0; row < 2; row++) for (let i = 0; i < 26; i++) {
          const x = 10 + i * 19.2 + r() * 6 + row * 9, base = h - 4 - row * 26, bh = 34 + r() * 12;
          g.fillStyle = shirts[r() * shirts.length | 0]; g.fillRect(x - 7, base - bh, 14, bh - 12);
          g.fillStyle = '#2b2b33'; g.fillRect(x - 6, base - 14, 12, 14);
          g.fillStyle = skins[r() * skins.length | 0]; g.beginPath(); g.arc(x, base - bh - 6, 6.5, 0, 7); g.fill();
          if (r() < 0.25) { g.fillStyle = shirts[r() * shirts.length | 0]; g.fillRect(x + 4, base - bh - 26, 2, 22); g.fillRect(x + 6, base - bh - 26, 16, 10); }      // flag
          if (r() < 0.2) { g.fillStyle = '#222'; g.fillRect(x - 8, base - bh - 4, 16, 3); }                                                      // cap
        }
      });
      crowdTex.wrapS = THREE.RepeatWrapping; crowdTex.wrapT = THREE.ClampToEdgeWrapping;
    }
    return crowdTex;
  }
  function trackside(rng) {
    const boards = [], crowds = [], tapes = [];
    const groundOk = (x, z, p) => Math.abs(terrain.heightAt(x, z) - p.y) < 2.5 && terrain.distAt(x, z) > half + 2.2;
    const city = isFinite(track.cityStart) ? track.cityStart : Infinity;
    const addBoard = (s0, side) => { const p = sampleAt(s0), off = side * (half + 3.2), [x, z] = sideXZ(p, off); if (groundOk(x, z, p)) { boards.push({ x, z, y: terrain.heightAt(x, z), th: p.th, side, k: boards.length }); obstacles.push({ x, z, r: 0.5 }); } };
    for (let s0 = 26; s0 < 130; s0 += 13) addBoard(s0, (s0 / 13) % 2 < 1 ? 1 : -1);
    for (const cp of ST.checkpoints) for (const d of [-22, -10, 10]) addBoard(cp + d, d < 0 ? -1 : 1);
    for (let s0 = track.finishS - 70; s0 < track.finishS + 30; s0 += 12) { addBoard(s0, 1); addBoard(s0 + 6, -1); }
    // spectators: start, finish, tight corners (outside, well back) and jumps
    const spots = [[30, 1], [44, -1], [track.finishS - 30, -1], [track.finishS + 15, 1]];
    for (const t of track.turns) if (t.r <= 45) spots.push([(t.s0 + t.s1) / 2, t.dir === 'R' ? -1 : 1]);
    for (const [js] of ST.jumps) spots.push([js + 8, 1], [js + 8, -1]);
    if (ST.castle) spots.push([ST.castle.gate1 - 26, 1], [ST.castle.gate1 - 26, -1], [ST.castle.gate2 + 26, 1]);      // SS4: crowds in front of the gatehouse and outside the back gate
    for (const [s0, side] of spots) {
      if (s0 > city - 20 && s0 < track.finishS - 40) continue;
      for (let k = -1; k <= 1; k++) {
        const p = sampleAt(s0 + k * 7.5), off = side * (half + 6.5 + rng() * 1.5), [x, z] = sideXZ(p, off);
        if (!groundOk(x, z, p)) continue;
        crowds.push({ x, z, y: terrain.heightAt(x, z), th: p.th, side, u: rng() });
        const [tx, tz] = sideXZ(p, side * (half + 4.2)); tapes.push({ x: tx, z: tz, y: terrain.heightAt(tx, tz), th: p.th });
        obstacles.push({ x: tx, z: tz, r: 0.2 });
      }
    }
    const mats = getSponsorMats();
    mats.forEach((m, mi) => {
      const list = boards.filter(b => b.k % mats.length === mi);
      instanced(new THREE.PlaneGeometry(6, 1.1).translate(0, 1.15, 0), m, list, (o, b) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.th + (b.side > 0 ? Math.PI / 2 : -Math.PI / 2), 0); o.scale.setScalar(1); });
    });
    instanced(new THREE.BoxGeometry(0.1, 1.7, 0.1).translate(0, 0.85, 0), lit({ color: 0x9aa0a8 }), boards.flatMap(b => [-2.9, 2.9].map(d => ({ x: b.x + Math.sin(b.th) * d, z: b.z + Math.cos(b.th) * d, y: b.y }))), (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    const cm = lit({ map: getCrowdTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    const crowdMesh = instanced(new THREE.PlaneGeometry(7.5, 1.9).translate(0, 0.95, 0), cm, crowds, (o, c) => { o.position.set(c.x, c.y, c.z); o.rotation.set(0, c.th + (c.side > 0 ? Math.PI / 2 : -Math.PI / 2), 0); o.scale.setScalar(1); });
    crowdMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: getCrowdTex(), alphaTest: 0.5 });
    instanced(new THREE.BoxGeometry(7.5, 0.12, 0.02).translate(0, 0.9, 0), lit({ map: canvasTex(64, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e53935'; g.fillRect(i * 8, 0, 8, 8); } }) }), tapes, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.th + Math.PI / 2, 0); o.scale.setScalar(1); }, { shadow: false });
    instanced(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5).translate(0, 0.5, 0), lit({ color: 0xe53935 }), tapes, (o, q) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }, { shadow: false });
    readabilityBoards();
  }

  /* ---------- readability: chevron boards on tight or blind corners, 100/50 m boards before hairpins and squares ---------- */
  function readabilityBoards() {
    const signs = { L: [], R: [], b100: [], b50: [] }, posts = [];
    const city = isFinite(track.cityStart) ? track.cityStart : Infinity;
    const place = (list, s0, side, faceBack = 25) => {
      if (s0 < 30 || s0 > track.finishS - 10) return;
      const p = sampleAt(s0), [x, z] = sideXZ(p, side * (half + 3.0));
      if (terrain.distAt(x, z) < half + 2.2) return;                      // would stand on another stretch of road
      const q = sampleAt(s0 - faceBack), ground = terrain.heightAt(x, z), y = Math.max(ground, p.y - 0.3);
      if (y - ground > 6) return;
      list.push({ x, z, y, rot: Math.atan2(q.x - x, q.z - z) });
      posts.push({ x, z, y0: ground, h: y - ground + 1.9 });
      obstacles.push({ x, z, r: 0.12 });
    };
    for (const t of track.turns) {
      const side = t.dir === 'R' ? -1 : 1;                                 // boards stand on the outside
      if (t.r <= 45 || t.blind) {
        const len = t.s1 - t.s0, n = len > 60 ? 4 : 3;
        for (let k = 0; k < n; k++) place(signs[t.dir], t.s0 + len * (0.08 + 0.8 * k / (n - 1)) * 0.75, side, 22);
      }
      if (t.r <= 32 && t.s0 < city + 400) { place(signs.b100, t.s0 - 100, side, 30); place(signs.b50, t.s0 - 50, side, 30); }
    }
    const chev = right => canvasTex(128, 96, (g) => {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#e8322b'; g.fillRect(6, 6, 116, 84);
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 2; k++) {
        const x0 = 22 + k * 44; g.beginPath();
        if (right) { g.moveTo(x0, 16); g.lineTo(x0 + 20, 16); g.lineTo(x0 + 46, 48); g.lineTo(x0 + 20, 80); g.lineTo(x0, 80); g.lineTo(x0 + 26, 48); }
        else { g.moveTo(x0 + 46, 16); g.lineTo(x0 + 26, 16); g.lineTo(x0, 48); g.lineTo(x0 + 26, 80); g.lineTo(x0 + 46, 80); g.lineTo(x0 + 20, 48); }
        g.closePath(); g.fill();
      }
    });
    const dist = label => canvasTex(96, 128, (g) => {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, 96, 128); g.fillStyle = '#ffffff'; g.fillRect(6, 6, 84, 116);
      g.fillStyle = '#e8322b'; for (let k = 0; k < (label === '100' ? 3 : 2); k++) g.fillRect(14, 74 + k * 15, 68, 9);
      g.fillStyle = '#16181c'; g.font = '800 40px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 48, 40);
    });
    const board = (list, tex, w, h) => instanced(new THREE.PlaneGeometry(w, h).translate(0, 1.9 + h / 2 - 0.3, 0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), list,
      (o, b) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.rot, 0); o.scale.setScalar(1); }, { shadow: false });
    board(signs.R, chev(true), 2.3, 1.7); board(signs.L, chev(false), 2.3, 1.7);
    board(signs.b100, dist('100'), 1.3, 1.75); board(signs.b50, dist('50'), 1.3, 1.75);
    instanced(new THREE.BoxGeometry(0.1, 1, 0.1).translate(0, 0.5, 0), lit({ color: 0x55595f }), posts, (o, q) => { o.position.set(q.x, q.y0, q.z); o.rotation.set(0, 0, 0); o.scale.set(1, q.h, 1); }, { shadow: false });
  }

