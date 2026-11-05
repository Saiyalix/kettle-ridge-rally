  /* ---------- the 14 rival cars: models, liveries, level of detail ----------
     Same two bodies as the player's cars (art/car-model.js builds the parts), four shapes in all (Kestrel / Strada, with or
     without the nose light bar), each crew in its own livery (art/rival-liveries.js, painted on its own small atlas).
     To stay cheap with up to 14 cars on the road:
       - geometry is built once per shape and shared by every rival (only the livery texture and the wheels' colours differ);
       - three levels: near (inside RIVAL_NEAR metres, the nearest RIVAL_FULL cars only, high quality): full model with clear-coat paint,
         spinning wheels and number plates; middle (to RIVAL_MID): coarse model with the wheels baked in; far: bare shell, about 700 triangles;
       - on low quality there is no full model (and the middle level ends sooner), and the livery texture is smaller;
       - beyond the fog distance nothing is drawn (it would be fog colour anyway).
     The rival's `g` group, its visibility and its `wheels` list belong to tracks/rivals.js; this file only fills `g`. */
  const RIVAL_NEAR = 42, RIVAL_MID = 80, RIVAL_MID_LOW = 48, RIVAL_FULL = 3, RIVAL_WING = 0x1b1d20;
  const rivalShapes = {}, rivalWheelGeos = {};
  let rivalKit = null;                      // { low, hi: materials, lo: materials }
  let rivalTexBytes = 0;

  const mergeParts = (list) => { const o = newPart(); for (const p of list) for (const k of ['pos', 'nor', 'uv', 'col']) for (let i = 0; i < p[k].length; i++) o[k].push(p[k][i]); return o; };
  function partInto(dst, src, m) {                 // copy src into dst through the matrix m (moves and turns, no scaling)
    const v = new THREE.Vector3();
    for (let i = 0; i < src.pos.length; i += 3) { v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(m); dst.pos.push(v.x, v.y, v.z); }
    for (let i = 0; i < src.nor.length; i += 3) { v.set(src.nor[i], src.nor[i + 1], src.nor[i + 2]).transformDirection(m); dst.nor.push(v.x, v.y, v.z); }
    for (const k of ['uv', 'col']) for (let i = 0; i < src[k].length; i++) dst[k].push(src[k][i]);
  }
  const wheelKind = (ci) => ci === 0 ? { spokes: 6, twin: true, w: 0.04 } : { spokes: 5, twin: false, w: 0.07 };
  const RIVAL_WHEELS = [[0.79, 1.24], [-0.79, 1.24], [0.79, -1.33], [-0.79, -1.33]];       // same places as before (x, z); centre height -0.19

  // geometry of one shape ('hi' = full, 'lo' = coarse with wheels baked in); built once, shared
  function rivalShape(ci, pod, low) {
    const key = ci + (pod ? 'p' : 'n') + (low === 2 ? 'far' : low ? 'lo' : 'hi');
    if (rivalShapes[key]) return rivalShapes[key];
    const { P, det } = buildCarParts(ci, { wing: RIVAL_WING, pod }, low, null);
    const s = { det, geo: {}, tris: 0 };
    const paint = mergeParts([P.body, P.cabin]), emit = mergeParts([P.lamp, P.tail]);
    let dark = P.dark, trim = P.trim, glass = P.glass;
    if (low === 2) {                                                 // far: glass is just dark paint, wheels are bare tyres, 3 draw calls
      for (let k = 0; k < glass.col.length; k += 3) { glass.col[k] = 0.16; glass.col[k + 1] = 0.24; glass.col[k + 2] = 0.31; }
      dark = mergeParts([P.dark, P.trim, glass]); trim = glass = null;
      for (const [x, z] of RIVAL_WHEELS) cyl(dark, CONFIG.wheels.radius, 0.25, x, -0.19, z, [0.075, 0.077, 0.082], { rz: Math.PI / 2, low: true });
    } else if (low) {                                                       // coarse: chrome bits are plain dark, wheels (not spinning) baked in
      dark = mergeParts([P.dark, P.trim]); trim = null;
      for (const [x, z] of RIVAL_WHEELS) {                          // a tyre and a rim disc: about 50 triangles each
        cyl(dark, CONFIG.wheels.radius, 0.25, x, -0.19, z, [0.075, 0.077, 0.082], { rz: Math.PI / 2, low: true });
        cyl(dark, 0.2, 0.02, x + Math.sign(x) * 0.125, -0.19, z, [0.7, 0.72, 0.75], { rz: Math.PI / 2, low: true });
      }
    }
    const put = (name, part) => { if (part && part.pos.length) { s.geo[name] = partGeo(part); s.tris += part.pos.length / 9; } };
    put('paint', paint); put('glass', glass); put('dark', dark); put('trim', trim); put('emit', emit);
    return (rivalShapes[key] = s);
  }
  function rivalWheelGeo(ci, rim, band) {
    const key = ci + ':' + rim + ':' + band;
    if (!rivalWheelGeos[key]) { const wp = wheelPart(CONFIG.wheels.radius, rim, band, wheelKind(ci), false); rivalWheelGeos[key] = partGeo(wp); rivalWheelGeos[key].userData.tris = wp.pos.length / 9; }
    return rivalWheelGeos[key];
  }
  function disposeRivalKit() {
    for (const k in rivalShapes) for (const g of Object.values(rivalShapes[k].geo)) g.dispose();
    for (const k in rivalWheelGeos) rivalWheelGeos[k].dispose();
    for (const k in rivalShapes) delete rivalShapes[k]; for (const k in rivalWheelGeos) delete rivalWheelGeos[k];
    if (rivalKit) { for (const set of [rivalKit.hi, rivalKit.lo, { w: rivalKit.wheel }]) if (set) for (const m of new Set(Object.values(set))) if (m && m.dispose) m.dispose(); }
    rivalKit = null;
  }
  function makeRivalKit(low) {
    const lo = carMaterials(true, null); lo.paint.dispose();
    const kit = { low, lo, hi: null, wheel: null };
    if (!low) {
      kit.hi = carMaterials(false, null); kit.hi.paint.dispose();
      kit.wheel = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x666666, shininess: 70, envMap, reflectivity: 0.3, combine: THREE.MixOperation });
    }
    return kit;
  }

  const rivalLiveryOf = (i) => {
    const k = RIVAL_LOOKS[i];
    return Object.assign({ numBg: 0xf4f6f8, numFg: 0x101418, wing: RIVAL_WING, number: String(i + 10) }, k);
  };

  // give rival i its models (replaces any it had)
  function dressRival(r, i) {
    undressRival(r);
    const low = rivalKit.low, look = RIVAL_LOOKS[i], L = rivalLiveryOf(i), ci = look.ci;
    const size = low ? 256 : 512, cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * CT.H / CT.W);
    paintLivery(cv, ci, L);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = low ? 1 : 2; tex.colorSpace = THREE.SRGBColorSpace;
    rivalTexBytes += Math.round(cv.width * cv.height * 4 * 1.33);
    const lod = { tex, bytes: Math.round(cv.width * cv.height * 4 * 1.33), mats: [], casters: [], hi: null, lo: new THREE.Group(), far: new THREE.Group(), plates: [], tris: { lo: 0, hi: 0, far: 0 } };
    const matLo = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }); lod.mats.push(matLo);
    const mk = (grp, geo, mat, shadow) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; if (shadow) lod.casters.push(m); grp.add(m); return m; };
    const lo = rivalShape(ci, look.pod, true); lod.tris.lo = lo.tris;
    mk(lod.lo, lo.geo.paint, matLo, true); mk(lod.lo, lo.geo.dark, rivalKit.lo.dark, true); mk(lod.lo, lo.geo.glass, rivalKit.lo.glass, false); mk(lod.lo, lo.geo.emit, rivalKit.lo.lamp, false);
    const fs = rivalShape(ci, look.pod, 2); lod.tris.far = fs.tris;
    mk(lod.far, fs.geo.paint, matLo, false); mk(lod.far, fs.geo.dark, rivalKit.lo.dark, false); mk(lod.far, fs.geo.emit, rivalKit.lo.lamp, false);
    r.g.add(lod.lo, lod.far); r.wheels = [];
    if (!low) {
      const hs = rivalShape(ci, look.pod, false), K = rivalKit.hi, matHi = glossPaint(tex); lod.mats.push(matHi);
      const g = lod.hi = new THREE.Group(); g.visible = false;
      mk(g, hs.geo.paint, matHi, true); mk(g, hs.geo.dark, K.dark, true); if (hs.geo.trim) mk(g, hs.geo.trim, K.trim, false);
      mk(g, hs.geo.glass, K.glass, false); mk(g, hs.geo.emit, K.lamp, false);
      const wg = rivalWheelGeo(ci, look.wheel, look.a);
      lod.tris.hi = hs.tris + 4 * wg.userData.tris + 4;
      r.wheels = RIVAL_WHEELS.map(([x, z]) => {
        const node = new THREE.Group(); node.position.set(x, -0.19, z);
        const flip = new THREE.Group(); if (x < 0) flip.rotation.y = Math.PI; node.add(flip);
        mk(flip, wg, rivalKit.wheel, false); g.add(node); return node;
      });
      for (const [pt, rear] of [[hs.det.frontPlate, false], [hs.det.rearPlate, true]]) {
        const m = numberPlate(ci, L, rear); m.position.set(pt[0], pt[1], pt[2]); m.rotation.y = pt[3]; g.add(m); lod.plates.push(m);
      }
      r.g.add(g);
    }
    r.lod = lod;
  }
  function undressRival(r) {
    const o = r.lod; if (!o) return;
    r.g.remove(o.lo, o.far); if (o.hi) r.g.remove(o.hi);
    for (const m of o.mats) m.dispose();
    for (const p of o.plates) { p.material.map.dispose(); p.material.dispose(); p.geometry.dispose(); }
    o.tex.dispose(); rivalTexBytes -= o.bytes; r.lod = null; r.wheels = [];
  }

  // once per drawn frame (art/post-process.js): rebuild after a quality change, dress one more rival if any are missing, pick the level of detail
  const _rlod = [];
  function updateRivalLOD() {
    const low = quality === 'low';
    if (rivalKit && rivalKit.low !== low) { for (const r of rivals) undressRival(r); disposeRivalKit(); }
    if (!rivalKit) rivalKit = makeRivalKit(low);
    for (let i = 0; i < rivals.length; i++) if (!rivals[i].lod) { dressRival(rivals[i], i); break; }       // one per frame: spreads the painting out
    const cp = camera.position, far = (scene.fog ? scene.fog.far : 600) + 8; _rlod.length = 0;
    for (const r of rivals) {
      const o = r.lod; if (!o) continue;
      const dx = r.g.position.x - cp.x, dy = r.g.position.y - cp.y, dz = r.g.position.z - cp.z, d2 = dx * dx + dy * dy + dz * dz;
      r.lodD2 = d2;
      const shown = r.g.visible && d2 < far * far, mid = low ? RIVAL_MID_LOW : RIVAL_MID;
      o.lo.visible = shown && d2 < mid * mid; o.far.visible = shown && !o.lo.visible; if (o.hi) o.hi.visible = false;
      if (shown && o.hi && d2 < RIVAL_NEAR * RIVAL_NEAR) _rlod.push(r);
      const sh = d2 < 3600; for (const m of o.casters) m.castShadow = sh;
    }
    if (_rlod.length > RIVAL_FULL) _rlod.sort((a, b) => a.lodD2 - b.lodD2);
    for (let k = 0; k < _rlod.length && k < RIVAL_FULL; k++) { _rlod[k].lod.lo.visible = false; _rlod[k].lod.hi.visible = true; }
  }
