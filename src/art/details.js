  /* ---------- trackside detail builders (art): small 3D things for tracks to place ----------
     tracks decides WHERE and HOW MANY; each builder here only decides how the thing looks. Every builder takes a list of items and makes one
     instanced mesh per kind (one draw call; up to 3-4 for builders with printed faces), adds it to the stage and returns what it made.
     None of them adds an obstacle: if the car can hit it, push your own `obstacles` entry (a circle {x, z, r} or a segment).
     No builder draws from the stage's random generator. Ground height is looked up with terrain.heightAt unless you give y.

     Every item has:  x, z (world), yaw (radians; the thing's local +z, its "front", looks along (sin yaw, cos yaw); the road direction p.th works for things
     that should stand parallel to the road, p.th +/- PI/2 for things that face it), y (optional ground height), s (optional scale, default 1),
     color (optional hex, only where stated). Sizes below are in metres at s = 1.

       hayBales(list)        a straw bale 0.9 x 0.45 x 0.5 (long side along local x), roped. Extra: layer (0, 1, 2 = stacked on top, each 0.45 m up), color (straw tint, default none).
       hayRow(pts, opt)      -> list for hayBales: pts = [{x, z}, ...] path points; opt.rows (1..3 layers high, default 2), opt.gap (default 0.05 m), opt.stagger (true:
                             brick pattern); bales are laid along the path, turned to follow it.
       flagPoles(list)       a 4.2 m flag pole with a flag 1.3 x 0.8 that flutters in the shader. Extra: color (hex of the flag's top half, default red; lower half white).
       marshalPosts(list)    a marshal point: hi-vis marshal (3D person), warning post with orange board, two cones, folding chair, red triangle. Extra: flag (true: the marshal holds a
                             yellow / black flag up). The marshal stands 1.1 m to the local +x side.
       photographers(list)   a spectator in a hi-vis bib with a big camera at the face (3D person). Extra: kid, shirt (palette number, default hi-vis).
       serviceTents(list)    a 3 x 3 m gazebo with a coloured roof and valance, back and side wall, table with tools, two chairs, tyre stack, fuel cans.
                             Extra: color (roof, default red), w (width 3 or 4.5; stretches the tent).
       tvTowers(list)        a scaffold tower 2.6 x 2.6 m, 7 m high, ladder, platform with rail and a TV camera on a tripod. Extra: none.
       portaLoos(list)       a portable toilet cabin 1.15 x 1.15 x 2.4 m, door facing local +z. Extra: color (cabin, default light blue).
       parkedCars(list)      a spectator car, 4.2 x 1.7 m. Extra: kind 'hatch' (default) | 'estate' | 'pickup', color (paint, hex; default picked from a palette by position).
       signPosts(list)       a 2.6 m post with a direction board 1.3 x 0.5 m (printed both sides), the arrow points to the RIGHT as you face the board.
                             Extra: kind 'spectator' (green) | 'parking' (blue P) | 'service' (orange) | 'wc' (navy).
       spectatorGroup(spot, opt)   adds a group of 3D spectators: spot = {x, z, th, side, y?} (th = road direction, side = +1 right / -1 left of the road); opt = see crowdGroup in people.js.
     People themselves (stand, cheer, point, sit, flag, camera poses; palettes) are in art/people.js: crowdAdd(list) places any list of individuals. */
  const dHash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  let _detailMat = null;
  function detailMat() {
    if (_detailMat) return _detailMat;
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWT = WIND.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 tw;\nuniform float uWT;')
        .replace('#include <color_vertex>', `
          #ifdef USE_INSTANCING_COLOR
            vec3 icol = pow(instanceColor.rgb, vec3(2.2));
          #else
            vec3 icol = vec3(1.0);
          #endif
          vColor = vec4(pow(color, vec3(2.2)) * mix(vec3(1.0), icol, tw.x), 1.0);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            if (tw.z > 0.0) { float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
              transformed.z += tw.z * 0.1 * sin(uWT * 5.0 + position.x * 5.0 + ph); transformed.y += tw.z * 0.045 * sin(uWT * 4.0 + position.x * 6.0 + ph); }
          #endif`);
    };
    m.customProgramCacheKey = () => 'detail'; m.userData.keep = true;
    return _detailMat = m;
  }
  const dPlace = (o, it) => { o.position.set(it.x, it.y != null ? it.y : terrain.heightAt(it.x, it.z), it.z); o.rotation.set(0, it.yaw || 0, 0); o.scale.setScalar(it.s || 1); };
  const dColor = (def) => (c, it) => { c.setRGB(...hexRGB(it.color != null ? it.color : def)); };
  const dMesh = (geo, list, opt) => instanced(geo, detailMat(), list, dPlace, opt || {});
  const TW1 = [1, 0, 0, 0];                                                   // "multiply by the instance colour"

  function hayBales(list) {
    const m = modeller(), L = 0.9, H = 0.45, D = 0.5;
    m.box(0, H / 2, 0, L, H, D, (x, y, z, ny) => { const k = 0.82 + 0.18 * ny; return [0.88 * k, 0.74 * k, 0.38 * k]; }, { tw: TW1 });
    for (const x of [-0.27, 0.27]) m.box(x, H / 2, 0, 0.03, H + 0.014, D + 0.014, [0.42, 0.3, 0.14]);
    if (quality !== 'low') for (const [x, z] of [[-0.3, 0.1], [0.05, -0.12], [0.34, 0.15]]) m.box(x, H + 0.01, z, 0.16, 0.025, 0.05, [0.95, 0.82, 0.45], { ry: x * 3, tw: TW1 });
    const it = list.map(b => Object.assign({}, b, { y: (b.y != null ? b.y : terrain.heightAt(b.x, b.z)) + (b.layer || 0) * H }));
    return instanced(m.geo(), detailMat(), it, dPlace, { color: (c, b) => { const t = b.color != null ? hexRGB(b.color) : [1, 0.96 + 0.04 * dHash(b.x, b.z), 0.92 + 0.08 * dHash(b.z, b.x)]; c.setRGB(t[0], t[1], t[2]); } });
  }
  function hayRow(pts, opt = {}) {
    const rows = opt.rows || 2, gap = opt.gap != null ? opt.gap : 0.05, step = 0.9 + gap, out = [];
    let acc = 0, k = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 1e-3) continue;
      const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);                                  // local +x along the path
      for (let d = acc; d + 0.45 <= len; d += step, k++) {
        const t = (d + 0.45) / len;
        for (let r = 0; r < rows; r++) { const sh = opt.stagger !== false && (r & 1) ? step / 2 : 0, tt = t + sh / len; if (tt > 1) continue; out.push({ x: a.x + (b.x - a.x) * tt, z: a.z + (b.z - a.z) * tt, yaw, layer: r }); }
        acc = d + step - len;
      }
      if (acc < 0) acc = 0;
    }
    return out;
  }

  function flagPoles(list) {
    const m = modeller(), low = quality === 'low', H = 4.2, st = low ? 3 : 6, fw = 1.3, fh = 0.8;
    m.cyl([0, 0, 0], [0, 0.12, 0], 0.22, 0.2, 8, [0.4, 0.4, 0.42]);
    m.cyl([0, 0.1, 0], [0, H, 0], 0.05, 0.026, 6, [0.8, 0.82, 0.86]); m.sph(0, H + 0.04, 0, 0.05, 0.05, 0.05, 6, 4, [0.95, 0.85, 0.3]);
    m.cyl([0, 0.1, 0], [0, 0.5, 0], 0.08, 0.055, 6, [0.55, 0.57, 0.6]);
    for (let i = 0; i < st; i++) {
      const x0 = 0.05 + fw * i / st, x1 = 0.05 + fw * (i + 1) / st, tw = (x) => [0, 0, (x - 0.05) / fw, 0];
      m.quad([x0, H - fh / 2, 0], [x1, H - fh / 2, 0], [x1, H - 0.1, 0], [x0, H - 0.1, 0], [1, 1, 1], { two: true, tw: (x) => [1, 0, (x - 0.05) / fw, 0] });
      m.quad([x0, H - fh - 0.1, 0], [x1, H - fh - 0.1, 0], [x1, H - fh / 2, 0], [x0, H - fh / 2, 0], [0.96, 0.96, 0.94], { two: true, tw });
    }
    return instanced(m.geo(), detailMat(), list, dPlace, { color: dColor(0xd32f2f) });
  }

  function marshalPosts(list) {
    const m = modeller(), low = quality === 'low', orange = [1, 0.42, 0.08], white = [0.96, 0.96, 0.94];
    // warning post with an orange / white striped board
    m.cyl([0, 0, 0], [0, 2.3, 0], 0.045, 0.045, 6, [0.5, 0.52, 0.56]); m.cyl([0, 0, 0], [0, 0.1, 0], 0.2, 0.17, 8, [0.4, 0.4, 0.42]);
    m.box(0, 2.05, 0.04, 0.9, 0.5, 0.04, [0.12, 0.13, 0.16]);
    for (let i = 0; i < 6; i++) m.quad([-0.42 + i * 0.14, 1.82, 0.065], [-0.28 + i * 0.14, 1.82, 0.065], [-0.14 + i * 0.14, 2.28, 0.065], [-0.28 + i * 0.14, 2.28, 0.065], i % 2 ? white : orange);
    // cones, chair, triangle, first-aid box
    for (const [x, z] of [[-0.9, 0.9], [0.5, 1.2]]) { m.cyl([x, 0.0, z], [x, 0.5, z], 0.17, 0.04, low ? 6 : 8, orange); m.cyl([x, 0.2, z], [x, 0.3, z], 0.12, 0.1, low ? 6 : 8, white, { open: true }); m.box(x, 0.012, z, 0.4, 0.025, 0.4, [0.1, 0.1, 0.12]); }
    m.box(-0.6, 0.42, -0.5, 0.45, 0.04, 0.42, [0.12, 0.3, 0.7]); m.box(-0.6, 0.66, -0.7, 0.45, 0.45, 0.04, [0.12, 0.3, 0.7]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) m.cyl([-0.6 + a * 0.2, 0, -0.5 + b * 0.18], [-0.6 + a * 0.2, 0.42, -0.5 + b * 0.18], 0.015, 0.015, 3, [0.7, 0.72, 0.76], { open: true });
    m.box(0.9, 0.16, -0.4, 0.4, 0.3, 0.25, [0.9, 0.9, 0.9]); m.box(0.9, 0.17, -0.274, 0.2, 0.06, 0.01, [0.85, 0.1, 0.1]); m.box(0.9, 0.17, -0.274, 0.06, 0.2, 0.01, [0.85, 0.1, 0.1]);
    const tri = (s) => { m.tri([0, 0.0, 1.4 + s], [0.3, 0.0, 1.4 - 0.1 + s], [0.15, 0.32, 1.4 + s], [0.85, 0.1, 0.1], { two: true }); };
    m.at(1.2, 0, 0.3, 0.5, () => tri(0));
    const geo = m.geo(), mesh = instanced(geo, detailMat(), list, dPlace, {});
    const people = list.map(it => { const yaw = it.yaw || 0, s = it.s || 1, ox = Math.cos(yaw) * 1.1 * s, oz = -Math.sin(yaw) * 1.1 * s;
      return { x: it.x + ox, z: it.z + oz, y: it.y, yaw: yaw + 0.4, pose: it.flag ? 'flag' : 'stand', shirt: SHIRT_HIVIS, hat: 1, kid: false, s: 1.0, amp: 0.5 }; });
    crowdAdd(people);
    return mesh;
  }
  function photographers(list) {
    crowdAdd(list.map(it => ({ x: it.x, z: it.z, y: it.y, yaw: it.yaw || 0, pose: 'camera', shirt: it.shirt != null ? it.shirt : SHIRT_HIVIS, hat: it.hat != null ? it.hat : 1, kid: !!it.kid, amp: 0.3 })));
  }
  function spectatorGroup(spot, opt) { crowdAdd(crowdGroup(spot, opt)); }

  function serviceTents(list) {
    const m = modeller(), low = quality === 'low', alu = [0.78, 0.8, 0.84], W = 3.0, D = 3.0, hs = 2.35, hp = 3.3;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * W / 2, z = sz * D / 2;
      m.box(x, hs / 2, z, 0.07, hs, 0.07, alu); m.box(x, 0.02, z, 0.2, 0.04, 0.2, [0.4, 0.4, 0.42]);
      m.cyl([x, hs - 0.2, z], [x * 0.55, hs + 0.35, z * 0.55], 0.025, 0.025, 4, alu, { open: true });
    }
    const roof = [0.95, 0.95, 0.95], rc = { tw: TW1 }, E = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const eave = E.map(([a, b]) => [a * (W / 2 + 0.25), hs + 0.35, b * (D / 2 + 0.25)]), peak = [0, hp + 0.15, 0];
    for (let i = 0; i < 4; i++) m.tri(eave[i], eave[(i + 1) % 4], peak, (x, y) => [roof[0], roof[1], roof[2]], Object.assign({ two: true }, rc));
    for (let i = 0; i < 4; i++) {                                                                       // valance
      const a = eave[i], b = eave[(i + 1) % 4];
      m.quad([a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], [b[0], b[1], b[2]], [a[0], a[1], a[2]], [0.97, 0.97, 0.96], { two: true });
      m.quad([a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], [b[0], b[1] - 0.2, b[2]], [a[0], a[1] - 0.2, a[2]], [0.15, 0.16, 0.2], { two: true });
    }
    m.quad([-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, hs, -D / 2], [-W / 2, hs, -D / 2], [0.92, 0.93, 0.95], { two: true });          // back and left wall
    m.quad([-W / 2, 0, D / 2], [-W / 2, 0, -D / 2], [-W / 2, hs, -D / 2], [-W / 2, hs, D / 2], [0.9, 0.91, 0.94], { two: true });
    m.box(0.1, 0.78, -0.95, 2.1, 0.05, 0.8, [0.7, 0.55, 0.38]); for (const a of [-1, 1]) for (const b of [-1, 1]) m.box(0.1 + a * 0.95, 0.38, -0.95 + b * 0.32, 0.05, 0.76, 0.05, alu);
    m.box(-0.5, 0.92, -0.95, 0.5, 0.22, 0.3, [0.8, 0.12, 0.1]); m.box(0.5, 0.88, -0.9, 0.35, 0.14, 0.35, [0.2, 0.22, 0.26]); m.box(0.9, 0.9, -1.0, 0.2, 0.18, 0.2, [0.95, 0.75, 0.1]);
    for (const x of [-0.5, 0.4]) { m.box(x, 0.42, 0.15, 0.42, 0.04, 0.4, [0.15, 0.3, 0.6]); m.box(x, 0.66, -0.04, 0.42, 0.45, 0.04, [0.15, 0.3, 0.6]); }
    for (let k = 0; k < 3; k++) m.cyl([1.0, 0.1 + k * 0.22, 0.8], [1.0, 0.3 + k * 0.22, 0.8], 0.33, 0.33, low ? 8 : 12, [0.1, 0.1, 0.11]);
    m.box(-1.1, 0.25, 0.9, 0.3, 0.5, 0.12, [0.7, 0.12, 0.1]); m.box(-0.8, 0.25, 1.0, 0.3, 0.5, 0.12, [0.7, 0.12, 0.1], { ry: 0.5 });
    return instanced(m.geo(), detailMat(), list.map(t => Object.assign({}, t, { s: t.s })), (o, t) => { dPlace(o, t); o.scale.set((t.w || 3) / 3 * (t.s || 1), t.s || 1, t.s || 1); }, { color: dColor(0xd32f2f) });
  }

  function tvTowers(list) {
    const m = modeller(), low = quality === 'low', S = 1.3, steel = [0.62, 0.64, 0.68], H = 7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { m.cyl([sx * S, 0.05, sz * S], [sx * S, H, sz * S], 0.045, 0.045, 5, steel); m.box(sx * S, 0.03, sz * S, 0.3, 0.06, 0.3, [0.35, 0.36, 0.4]); }
    const bay = 1.4;
    for (let y = 0; y < H - 0.5; y += bay) for (let f = 0; f < 4; f++) {
      const a = [[-S, -S], [S, -S], [S, S], [-S, S]][f], b = [[-S, -S], [S, -S], [S, S], [-S, S]][(f + 1) % 4];
      m.cyl([a[0], y + bay, a[1]], [b[0], y + bay, b[1]], 0.025, 0.025, 4, steel, { open: true });
      if (f !== 0) { m.cyl([a[0], y, a[1]], [b[0], y + bay, b[1]], 0.018, 0.018, 3, steel, { open: true }); if (!low) m.cyl([b[0], y, b[1]], [a[0], y + bay, a[1]], 0.018, 0.018, 3, steel, { open: true }); }
    }
    for (let y = 0.4; y < H - 0.8; y += low ? 0.7 : 0.35) m.box(0, y, -S - 0.06, 0.5, 0.03, 0.03, steel);                // ladder on the -z face
    for (const sx of [-0.25, 0.25]) m.box(sx, H / 2, -S - 0.06, 0.04, H - 0.5, 0.04, steel);
    m.box(0, H - 0.5, 0, 2 * S + 0.3, 0.1, 2 * S + 0.3, [0.66, 0.5, 0.32]);                                          // platform
    for (const [x, z, w, d] of [[0, S + 0.12, 2 * S + 0.3, 0.04], [-S - 0.12, 0, 0.04, 2 * S + 0.3], [S + 0.12, 0, 0.04, 2 * S + 0.3]]) { m.box(x, H + 0.1, z, w, 0.05, d, steel); m.box(x, H - 0.2, z, w, 0.04, d, steel); }
    for (const [x, z] of [[-S, S], [S, S]]) m.box(x, H + 0.4, z, 0.06, 0.8, 0.06, steel);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.5; m.cyl([Math.cos(a) * 0.5, H - 0.4, Math.sin(a) * 0.5], [0, H + 0.45, 0], 0.025, 0.02, 4, [0.1, 0.1, 0.12], { open: true }); }       // tripod
    m.box(0, H + 0.62, 0.0, 0.42, 0.34, 0.8, [0.9, 0.9, 0.92]); m.cyl([0, H + 0.64, 0.4], [0, H + 0.64, 1.0], 0.12, 0.17, 8, [0.12, 0.12, 0.14]); m.box(0, H + 0.82, -0.1, 0.26, 0.12, 0.3, [0.1, 0.1, 0.12]);
    m.box(1.0, H + 0.55, -0.3, 0.5, 0.5, 0.45, [0.95, 0.6, 0.1]);                                                   // a flight case
    return instanced(m.geo(), detailMat(), list, dPlace, { shadow: true });
  }

  function portaLoos(list) {
    const m = modeller(), W = 1.15, H = 2.3;
    m.box(0, 0.09, 0, W + 0.06, 0.18, W + 0.06, [0.3, 0.32, 0.36]);
    m.box(0, H / 2 + 0.18, 0, W, H, W, (x, y, z, ny) => { const k = 0.88 + 0.12 * (y / H); return [0.55 * k, 0.78 * k, 0.95 * k]; }, { tw: TW1 });
    m.box(0, H + 0.22, 0, W + 0.12, 0.08, W + 0.12, [0.95, 0.95, 0.96]); m.cyl([0.3, H + 0.26, -0.3], [0.3, H + 0.55, -0.3], 0.07, 0.07, 6, [0.8, 0.82, 0.86]);
    m.box(0, 1.1, W / 2 + 0.012, 0.85, 1.9, 0.03, [0.98, 0.98, 0.98], { tw: [0.35, 0, 0, 0] });
    for (let k = 0; k < 4; k++) m.box(0, 2.0 + k * 0.06, W / 2 + 0.032, 0.5, 0.02, 0.01, [0.1, 0.1, 0.12]);
    m.box(0.3, 1.1, W / 2 + 0.04, 0.05, 0.14, 0.04, [0.2, 0.2, 0.24]); m.box(0.3, 1.32, W / 2 + 0.035, 0.07, 0.09, 0.02, [0.15, 0.75, 0.25]);
    m.box(0, 2.35, W / 2 + 0.01, 0.4, 0.14, 0.01, [0.1, 0.3, 0.7]);
    return instanced(m.geo(), detailMat(), list, dPlace, { color: dColor(0xffffff) });
  }

  const CAR_PROFILES = {
    hatch: { len: 4.1, p: [[0.25, -2.0], [0.5, -2.05], [0.95, -1.98], [1.32, -1.2], [1.42, -0.5], [1.42, 0.45], [1.02, 1.05], [0.92, 2.0], [0.55, 2.08], [0.25, 1.95]], win: [-1.15, 0.95], wy: [1.02, 1.36] },
    estate: { len: 4.5, p: [[0.25, -2.2], [0.5, -2.25], [1.05, -2.2], [1.45, -1.95], [1.5, 0.35], [1.04, 1.1], [0.92, 2.1], [0.55, 2.18], [0.25, 2.05]], win: [-1.9, 0.9], wy: [1.04, 1.4] },
    pickup: { len: 4.6, p: [[0.3, -2.3], [0.55, -2.35], [0.98, -2.3], [0.98, -0.7], [1.5, -0.55], [1.5, 0.45], [1.04, 1.0], [0.95, 2.1], [0.55, 2.2], [0.3, 2.05]], win: [-0.5, 0.9], wy: [1.08, 1.42] },
  };
  const CAR_PAINT = [0xc0392b, 0x2e6fb7, 0xd9d9d9, 0x3a3d45, 0x2f8f5b, 0xe0a82e, 0x9aa0a8, 0x7e57c2, 0xd35400, 0x4a78b5, 0xf0f0ea, 0x7a2f2f];
  function carGeo(kind) {
    const m = modeller(), K = CAR_PROFILES[kind] || CAR_PROFILES.hatch, hw = 0.86, low = quality === 'low', pr = K.p;
    m.sweep(pr, -hw, hw, (x, y, z, ny) => { const k = 0.8 + 0.2 * clamp(ny + 0.5, 0, 1); return [k, k, k]; }, { tw: TW1 });
    let cy = 0, cz = 0; for (const [y, z] of pr) { cy += y; cz += z; } cy /= pr.length; cz /= pr.length;
    for (const sx of [-1, 1]) for (let i = 0; i < pr.length; i++) {                                  // side panels (fan from the middle)
      const a = pr[i], b = pr[(i + 1) % pr.length], x = sx * hw, c = (x, y, z) => { const k = 0.9; return [k, k, k]; };
      const sgn = ((a[0] - cy) * (b[1] - cz) - (a[1] - cz) * (b[0] - cy)) * sx;
      if (sgn > 0) m.tri([x, cy, cz], [x, a[0], a[1]], [x, b[0], b[1]], [0.92, 0.92, 0.92], { tw: TW1 }); else m.tri([x, cy, cz], [x, b[0], b[1]], [x, a[0], a[1]], [0.92, 0.92, 0.92], { tw: TW1 });
    }
    const glass = [0.16, 0.22, 0.3], [z0, z1] = K.win, [y0, y1] = K.wy;
    for (const sx of [-1, 1]) { const x = sx * (hw + 0.012); m.quad([x, y0, z0], [x, y0, z1], [x, y1, z1 - 0.3], [x, y1, z0 + 0.25], glass, { two: true }); }
    m.quad([-0.76, y1 - 0.02, z1 - 0.32], [0.76, y1 - 0.02, z1 - 0.32], [0.76, y0 - 0.0, z1 + 0.02], [-0.76, y0 - 0.0, z1 + 0.02], glass, { two: true });
    for (const sx of [-1, 1]) for (const z of [-K.len / 2 + 0.85, K.len / 2 - 0.85]) {
      const x = sx * 0.79; m.cyl([x - 0.13, 0.31, z], [x + 0.13, 0.31, z], 0.31, 0.31, low ? 8 : 12, [0.1, 0.1, 0.11]); m.cyl([x + sx * 0.13, 0.31, z], [x + sx * 0.14, 0.31, z], 0.17, 0.17, low ? 6 : 8, [0.72, 0.74, 0.78]);
    }
    for (const sx of [-1, 1]) { m.box(sx * 0.62, 0.7, K.len / 2 + 0.01, 0.3, 0.12, 0.05, [1, 0.97, 0.85]); m.box(sx * 0.66, 0.72, -K.len / 2 - 0.02, 0.28, 0.1, 0.04, [0.8, 0.1, 0.08]); }
    m.box(0, 0.4, -K.len / 2 - 0.03, 0.5, 0.12, 0.03, [0.95, 0.95, 0.9]);
    if (kind === 'pickup') { m.box(0, 1.07, -1.5, 1.5, 0.03, 1.6, [0.14, 0.14, 0.16]); for (const sx of [-1, 1]) m.box(sx * 0.8, 1.14, -1.5, 0.07, 0.16, 1.7, [0.5, 0.5, 0.54]); m.box(0, 1.14, -2.3, 1.7, 0.16, 0.07, [0.5, 0.5, 0.54]); }
    return m.geo();
  }
  function parkedCars(list) {
    const out = [];
    for (const kind of ['hatch', 'estate', 'pickup']) {
      const l = list.filter(c => (c.kind || 'hatch') === kind); if (!l.length) continue;
      out.push(instanced(carGeo(kind), detailMat(), l, dPlace, { color: (c, it) => { const h = it.color != null ? it.color : CAR_PAINT[Math.floor(dHash(it.x, it.z) * CAR_PAINT.length)]; c.setRGB(...hexRGB(h)); } }));
    }
    return out;
  }

  const SIGN_KINDS = { spectator: [0, '#1f8a4c', '#ffffff', 'SPECTATORS'], parking: [1, '#1d5fd1', '#ffffff', 'P'], service: [2, '#f0a01e', '#16181c', 'SERVICE'], wc: [3, '#1a2a5a', '#ffffff', 'WC'] };
  let _signTex = null;
  function signAtlas() {
    if (_signTex) return _signTex;
    _signTex = canvasTex(512, 256, (g) => {
      for (const [id, bg, fg, txt] of Object.values(SIGN_KINDS)) {
        const cx = (id % 2) * 256, cy = Math.floor(id / 2) * 128;
        g.fillStyle = '#16181c'; g.fillRect(cx, cy, 256, 128); g.fillStyle = bg; g.fillRect(cx + 5, cy + 5, 246, 118);
        g.fillStyle = fg; g.font = '800 ' + (txt.length > 4 ? 40 : 66) + 'px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx + 108, cy + 66);
        g.beginPath(); g.moveTo(cx + 196, cy + 28); g.lineTo(cx + 240, cy + 64); g.lineTo(cx + 196, cy + 100); g.lineTo(cx + 196, cy + 78); g.lineTo(cx + 170, cy + 78); g.lineTo(cx + 170, cy + 50); g.lineTo(cx + 196, cy + 50); g.closePath(); g.fill();
      }
    });
    _signTex.userData.keep = true; return _signTex;
  }
  function signPosts(list) {
    const m = modeller(), bw = 1.3, bh = 0.5, by = 2.3, steel = [0.55, 0.58, 0.62];
    m.cyl([0, 0, 0], [0, 2.7, 0], 0.045, 0.045, 6, steel); m.cyl([0, 0, 0], [0, 0.12, 0], 0.16, 0.14, 7, [0.45, 0.45, 0.43]);
    m.box(0, by, 0, bw + 0.08, bh + 0.08, 0.04, [0.12, 0.13, 0.16]);
    for (const sy of [-0.15, 0.15]) m.box(0, by + sy, -0.035, 0.12, 0.06, 0.04, [0.85, 0.86, 0.9]);
    const mesh = instanced(m.geo(), detailMat(), list, dPlace, {}), meshes = [mesh];
    for (const [kind, [id]] of Object.entries(SIGN_KINDS)) {
      const l = list.filter(s => (s.kind || 'spectator') === kind); if (!l.length) continue;
      const cell = (flip) => { const g = new THREE.PlaneGeometry(bw, bh); g.translate(0, by, 0); const uv = g.attributes.uv, u0 = (id % 2) / 2, v0 = 1 - (Math.floor(id / 2) + 1) / 2;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
        if (flip) { g.rotateY(Math.PI); g.translate(0, 0, -0.026); } else g.translate(0, 0, 0.026); return g; };
      meshes.push(instanced(mergeGeos([cell(false), cell(true)]), new THREE.MeshBasicMaterial({ map: signAtlas() }), l, dPlace, { shadow: false }));
    }
    return meshes;
  }
