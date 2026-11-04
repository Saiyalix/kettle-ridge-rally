  /* ---------- shared scenery pieces ---------- */
  // Billboard trees: two crossed textured quads, the classic trick of the era
  const treeTex = {};
  function drawPine(g, w, h, snowy, narrow) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#5b3d26'; g.fillRect(w * 0.46, h * 0.78, w * 0.08, h * 0.22);
    const tiers = narrow ? 9 : 7, top = h * 0.03, bottom = h * 0.86;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1), y0 = top + (bottom - top) * t * 0.92, y1 = y0 + (bottom - top) * (narrow ? 0.2 : 0.26);
      const half = w * (narrow ? 0.12 + 0.24 * t : 0.1 + 0.38 * t);
      const base = snowy ? [70, 128, 92] : narrow ? [48, 112, 70] : [62, 140, 70];
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      g.beginPath(); g.moveTo(w / 2, y0);
      for (let x = -half; x <= half; x += half / 6) g.lineTo(w / 2 + x, y1 - (Math.abs(x) / half) * 8 + (Math.round(x / half * 6) % 2 ? 6 : 0));
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,220,0.16)'; g.beginPath(); g.moveTo(w / 2, y0 + 4); g.lineTo(w / 2 - half * 0.85, y1 - 6); g.lineTo(w / 2 - half * 0.2, y1 - 8); g.closePath(); g.fill();
      if (snowy) { g.fillStyle = 'rgba(246,250,255,0.92)'; g.beginPath(); g.moveTo(w / 2, y0); g.lineTo(w / 2 - half * 0.7, y0 + (y1 - y0) * 0.55); g.lineTo(w / 2 + half * 0.6, y0 + (y1 - y0) * 0.45); g.closePath(); g.fill(); }
    }
  }
  function drawSakura(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4e3330'; g.fillRect(w * 0.45, h * 0.55, w * 0.1, h * 0.45);
    g.strokeStyle = '#4e3330'; g.lineWidth = 8; g.beginPath(); g.moveTo(w * 0.5, h * 0.62); g.lineTo(w * 0.28, h * 0.42); g.moveTo(w * 0.5, h * 0.6); g.lineTo(w * 0.72, h * 0.4); g.stroke();
    const r = mulberry32(5);
    for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = r(); const x = w / 2 + Math.cos(a) * d * w * 0.4, y = h * 0.36 + Math.sin(a) * d * h * 0.26, rad = 14 + r() * 22;
      g.fillStyle = `rgb(${245 + r() * 10 | 0},${170 + r() * 40 | 0},${200 + r() * 30 | 0})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = w * (0.2 + r() * 0.6), y = h * (0.15 + r() * 0.3); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, y, 5 + r() * 8, 0, 7); g.fill(); }
  }
  function getTreeTex(kind) {
    if (!treeTex[kind]) {
      const t = makeTex(128, 256, (g, w, h) => kind === 'sakura' ? drawSakura(g, w, h) : drawPine(g, w, h, kind === 'snow', kind === 'cedar'));
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; treeTex[kind] = t;
    }
    return treeTex[kind];
  }
  function crossedQuads(w, h) {
    const a = new THREE.PlaneGeometry(w, h), b = new THREE.PlaneGeometry(w, h); b.rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry(), pos = [], uv = [], nrm = [], idx = [];
    [a, b].forEach((q, qi) => {
      const p = q.attributes.position, u = q.attributes.uv;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i) + h / 2, p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nrm.push(0, 1, 0); }
      for (let i = 0; i < q.index.count; i++) idx.push(q.index.getX(i) + qi * 4);
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    return g;
  }
  function billboards(list, kind, w, h) {
    if (!list.length) return;
    const tex = getTreeTex(kind);
    const m = instanced(crossedQuads(w, h), lit({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), list,
      (o, t) => { o.position.set(t.x, t.y - 0.2, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); },
      { color: (c) => { const v = 0.82 + Math.random() * 0.18; c.setRGB(v, v, v); } });
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  }
  function conifers(list, colorFn, shape = {}) {
    const cedar = shape.tall > 1.4;
    billboards(list.filter(t => !t.snow), cedar ? 'cedar' : 'pine', cedar ? 3.8 : 5.0, (cedar ? 12.5 : 8.5) * (shape.tall > 1 && !cedar ? 1.15 : 1));
    billboards(list.filter(t => t.snow), 'snow', 5.0, 8.5);
    for (const t of list) if (t.d < 40) obstacles.push({ x: t.x, z: t.z, r: 0.3 * t.s });
  }
  function scatter(rng, count, tries, accept) {
    const out = [];
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = terrain.minX + rng() * (terrain.maxX - terrain.minX), z = terrain.minZ + rng() * (terrain.maxZ - terrain.minZ);
      const d = terrain.distAt(x, z), y = terrain.heightAt(x, z), s0 = terrain.sAt(x, z);
      const t = accept(x, z, d, y, s0);
      if (t) out.push(Object.assign({ x, z, y, d, s0, r: rng() * 6.28, s: 0.8 + rng() * 0.7 }, t === true ? {} : t));
    }
    return out;
  }
  const slopeAt = (x, z) => Math.hypot(terrain.heightAt(x + 2, z) - terrain.heightAt(x - 2, z), terrain.heightAt(x, z + 2) - terrain.heightAt(x, z - 2)) / 4;
  function rocks(rng, list, color = [0.66, 0.64, 0.68]) {
    instanced(new THREE.DodecahedronGeometry(1, 0), lit({ color: 0xffffff, map: TEX.rock, flatShading: true }), list,
      (o, r) => { o.position.set(r.x, r.y - r.size * 0.3, r.z); o.rotation.set(rng() * 3, rng() * 3, rng() * 3); o.scale.set(r.size * 1.2, r.size * 0.8, r.size); },
      { color: (c) => c.setRGB(color[0] + rng() * 0.1, color[1] + rng() * 0.1, color[2] + rng() * 0.1) });
    for (const r of list) if (r.solid) obstacles.push({ x: r.x, z: r.z, r: r.size * 1.05, mu: 0.35 });
  }
  function roadsideRocks(rng, count, sideOk) {
    const list = [];
    for (let i = 0; i < count * 12 && list.length < count; i++) {
      const p = P[Math.floor(rng() * P.length)], side = rng() < 0.5 ? -1 : 1;
      if (sideOk && !sideOk(p, side)) continue;
      const off = (half + 3 + rng() * 22) * side, [x, z] = sideXZ(p, off);
      if (terrain.distAt(x, z) < half + 2.5) continue;
      const big = rng() < 0.35, size = big ? 0.9 + rng() * 0.8 : 0.25 + rng() * 0.3;
      list.push({ x, z, y: terrain.heightAt(x, z), size, solid: big });
    }
    return list;
  }
  // rails/fences along the outside of corners
  function cornerRails(filter, opt) {
    const posts = [], rails = [];
    for (const t of track.turns) {
      if (!filter(t)) continue;
      const side = t.dir === 'R' ? -1 : 1;       // outside of a right turn is the left side
      let prev = null;
      for (let s = t.s0 - 8; s <= t.s1 + 8; s += opt.spacing || 3) {
        const p = sampleAt(s), [x, z] = sideXZ(p, (half + (opt.offset || 2.6)) * side), y = terrain.heightAt(x, z);
        posts.push([x, y, z]);
        if (prev) { rails.push([prev, [x, y, z]]); if (opt.solid) obstacles.push({ ax: prev[0], az: prev[2], bx: x, bz: z, r: 0.2, mu: opt.mu || 0.2 }); }
        prev = [x, y, z];
      }
    }
    instanced(new THREE.BoxGeometry(0.12, opt.postH || 1.1, 0.12).translate(0, (opt.postH || 1.1) / 2, 0), lit({ color: opt.postColor }), posts,
      (o, p) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
    instanced(new THREE.BoxGeometry(1, opt.railH || 0.5, 0.04), lit({ color: opt.railColor }), rails, (o, [a, b]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (opt.railY || 0.7), (a[2] + b[2]) / 2);
      o.rotation.set(0, Math.atan2(-dz, dx), 0); o.scale.set(Math.hypot(dx, dz), 1, 1);
    });
  }
  // far-off peaks beyond the terrain, drawn without fog in hazy colours
  function distantPeaks(rng, count, base, cap, opts = {}) {
    let cx = 0, cz = 0; for (const p of P) { cx += p.x; cz += p.z; } cx /= P.length; cz /= P.length;
    const g = new THREE.ConeGeometry(1, 1, 7, 1); g.translate(0, 0.5, 0);
    const cg = new THREE.ConeGeometry(1, 1, 7, 1); cg.translate(0, 0.5, 0);
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.3, d = (opts.dist || 1250) + rng() * 300;
      list.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, r: 220 + rng() * 260, h: 260 + rng() * 380, rot: rng() * 6 });
    }
    if (opts.extra) list.push(opts.extra);
    instanced(g, new THREE.MeshBasicMaterial({ color: base, fog: false }), list, (o, m) => { o.position.set(m.x, (opts.y || -40), m.z); o.rotation.set(0, m.rot, 0); o.scale.set(m.r, m.h, m.r); }, { shadow: false });
    instanced(cg, new THREE.MeshBasicMaterial({ color: cap, fog: false }), list, (o, m) => { const f = m.cap || 0.3; o.position.set(m.x, (opts.y || -40) + m.h * (1 - f), m.z); o.rotation.set(0, m.rot, 0); o.scale.set(m.r * f * 1.04, m.h * f, m.r * f * 1.04); }, { shadow: false });
  }

