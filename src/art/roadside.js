  /* ---------- roadside look-builders (art) ----------
     Each builder makes ONE merged mesh (one draw call per call), adds it to the stage, and returns it.
     They only decide how a piece LOOKS. Where it goes and what the car can hit is up to tracks:
     none of these adds an obstacle, so push your own `obstacles` (segments {ax,az,bx,bz,r,mu} work well for walls and fences).
     Paths are arrays of points {x, y, z} (use terrain.heightAt for y, one point every 2-4 m so the piece follows the ground).
     Textures are generated in code on first use (art/textures.js); on 'low' they are half size. */
  function geoBuilder() {
    const P = [], U = [], C = [], I = [];
    return {
      v(x, y, z, u, v, c) { P.push(x, y, z); U.push(u, v); c = c || [1, 1, 1]; C.push(c[0], c[1], c[2]); return P.length / 3 - 1; },
      tri(a, b, c) { I.push(a, b, c); },
      // quad a,b,c,d (vertex indices); flipped if needed so its front side looks along `out` = [x,y,z]
      quad(a, b, c, d, out) {
        const o = (i) => i * 3, ux = P[o(b)] - P[o(a)], uy = P[o(b) + 1] - P[o(a) + 1], uz = P[o(b) + 2] - P[o(a) + 2];
        const wx = P[o(c)] - P[o(a)], wy = P[o(c) + 1] - P[o(a) + 1], wz = P[o(c) + 2] - P[o(a) + 2];
        const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
        if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
      },
    };
  }
  function roadsideMesh(geo, map, opts = {}) {
    const mat = lit({ map, vertexColors: true, side: THREE.FrontSide });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = opts.shadow !== false; m.receiveShadow = true; add(m); return m;
  }
  // horizontal unit tangent at each point of a path
  function pathTangents(pts) {
    return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; });
  }
  // a box between A and B (3-arrays) with half width hw along `side` and half height hh along `up` (unit vectors); 6 faces, uv in metres / tile
  function orientedBox(b, A, B, side, up, hw, hh, tile, col) {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), u1 = len / tile;
    const cn = (p, sx, sy) => [p[0] + side[0] * hw * sx + up[0] * hh * sy, p[1] + side[1] * hw * sx + up[1] * hh * sy, p[2] + side[2] * hw * sx + up[2] * hh * sy];
    const fwd = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const face = (p, q, uA, uB, w, h, out) => {
      const i0 = b.v(...p[0], uA, 0, col), i1 = b.v(...p[1], uB, 0, col), i2 = b.v(...p[2], uB, h / tile, col), i3 = b.v(...p[3], uA, h / tile, col);
      b.quad(i0, i1, i2, i3, out);
    };
    const neg = (v) => [-v[0], -v[1], -v[2]];
    face([cn(A, 1, -1), cn(B, 1, -1), cn(B, 1, 1), cn(A, 1, 1)], 0, 0, u1, 0, hh * 2, side);
    face([cn(A, -1, -1), cn(B, -1, -1), cn(B, -1, 1), cn(A, -1, 1)], 0, 0, u1, 0, hh * 2, neg(side));
    face([cn(A, -1, 1), cn(B, -1, 1), cn(B, 1, 1), cn(A, 1, 1)], 0, 0, u1, 0, hw * 2, up);
    face([cn(A, -1, -1), cn(B, -1, -1), cn(B, 1, -1), cn(A, 1, -1)], 0, 0, u1, 0, hw * 2, neg(up));
    face([cn(A, -1, -1), cn(A, 1, -1), cn(A, 1, 1), cn(A, -1, 1)], 0, 0, hw * 2 / tile, 0, hh * 2, neg(fwd));
    face([cn(B, -1, -1), cn(B, 1, -1), cn(B, 1, 1), cn(B, -1, 1)], 0, 0, hw * 2 / tile, 0, hh * 2, fwd);
  }

  /* stoneWall(pts, opt): a dry-stone / mortar block wall following a path, built as one mesh.
       pts: [{x,y,z}, ...] along the wall (points every 2-4 m; bends are mitred, so it stays closed on corners)
       opt.height (1.1 m above the ground at each point), opt.thick (0.6), opt.sink (0.5: how far it goes into the ground),
       opt.warm (true = sandy stone, false = grey), opt.tint ([r,g,b] 0..1 multiplier, default white).
     Returns the mesh. Block size on the wall is about 0.5 m, so it looks right at height 0.8 .. 2 m. */
  function stoneWall(pts, opt = {}) {
    const H = opt.height || 1.1, T = (opt.thick || 0.6) / 2, sink = opt.sink != null ? opt.sink : 0.5, tint = opt.tint || [1, 1, 1], TILE = 4;
    const b = geoBuilder(), tan = pathTangents(pts), n = pts.length;
    const off = pts.map((p, i) => { const a = tan[Math.max(0, i - 1)], c = tan[Math.min(n - 1, i + 1)]; let nx = -(a[1] + c[1]), nz = a[0] + c[0]; const l = Math.hypot(nx, nz) || 1, mit = clamp(2 / l, 1, 1.8); return [nx / l * mit, nz / l * mit]; });
    let u = 0;
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1], len = Math.hypot(q.x - p.x, q.z - p.z), u0 = u / TILE, u1 = (u + len) / TILE; u += len;
      const sh = 0.9 + 0.1 * Math.sin(i * 1.7), col = [tint[0] * sh, tint[1] * sh, tint[2] * sh];
      const w = (pt, k, s, y, uu, vv) => b.v(pt.x + off[k][0] * T * s, y, pt.z + off[k][1] * T * s, uu, vv, col);
      const yb = (pt) => pt.y - sink, yt = (pt) => pt.y + H, vb = -sink / TILE, vt = H / TILE;
      for (const s of [1, -1]) b.quad(w(p, i, s, yb(p), u0, vb), w(q, i + 1, s, yb(q), u1, vb), w(q, i + 1, s, yt(q), u1, vt), w(p, i, s, yt(p), u0, vt), [off[i][0] * s, 0, off[i][1] * s]);
      b.quad(w(p, i, 1, yt(p), u0, 0), w(q, i + 1, 1, yt(q), u1, 0), w(q, i + 1, -1, yt(q), u1, 0.15), w(p, i, -1, yt(p), u0, 0.15), [0, 1, 0]);
      if (i === 0) { const tx = -tan[0][0], tz = -tan[0][1]; b.quad(w(p, i, 1, yb(p), 0, vb), w(p, i, -1, yb(p), 0.15, vb), w(p, i, -1, yt(p), 0.15, vt), w(p, i, 1, yt(p), 0, vt), [tx, 0, tz]); }
      if (i === n - 2) b.quad(w(q, i + 1, 1, yb(q), 0, vb), w(q, i + 1, -1, yb(q), 0.15, vb), w(q, i + 1, -1, yt(q), 0.15, vt), w(q, i + 1, 1, yt(q), 0, vt), [tan[n - 1][0], 0, tan[n - 1][1]]);
    }
    return roadsideMesh(b.build(), opt.warm ? stoneWarmTex() : stoneTex());
  }

  /* woodFence(pts, opt): weathered wood posts and rails along a path, one mesh.
       pts: [{x,y,z}, ...] (points every 2-4 m)
       opt.height (1.1: post height), opt.rails (2 or 3 rails), opt.postEvery (2.5 m between posts), opt.tint ([r,g,b]).
     Posts are 0.14 m square, rails 0.1 m x 0.18 m. Returns the mesh. */
  function woodFence(pts, opt = {}) {
    const H = opt.height || 1.1, rails = opt.rails || 2, every = opt.postEvery || 2.5, tint = opt.tint || [1, 1, 1];
    const b = geoBuilder(), up = [0, 1, 0], post = [];
    let acc = every;                                                                     // a post at the first point, then every `every` m
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); }
      if (i === 0 || i === pts.length - 1 || acc >= every) { post.push(pts[i]); acc = 0; }
    }
    post.forEach((p, i) => {
      const t = 0.88 + 0.12 * Math.sin(i * 2.3), col = [tint[0] * t, tint[1] * t, tint[2] * t];
      orientedBox(b, [p.x, p.y - 0.4, p.z], [p.x, p.y + H, p.z], [1, 0, 0], [0, 0, 1], 0.07, 0.07, 1, col);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, side = [-dz / l, 0, dx / l];
      for (let k = 0; k < rails; k++) {
        const hy = H * (rails === 1 ? 0.8 : 0.45 + 0.5 * k / (rails - 1)), t = 0.92 + 0.08 * Math.sin(i * 1.3 + k);
        orientedBox(b, [p.x, p.y + hy, p.z], [q.x, q.y + hy, q.z], side, up, 0.05, 0.09, 1.2, [tint[0] * t, tint[1] * t, tint[2] * t]);
      }
    }
    return roadsideMesh(b.build(), woodTex());
  }

  /* buildings(list, opt): detailed 3D houses (plaster, stone, japanese) live in art/buildings.js. facingYaw is used to turn a house to the road:
       yaw = facingYaw(x, z, roadX, roadZ) makes the FRONT (local +z) look at the point (roadX, roadZ). */
  const facingYaw = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  /* rockFace(pts, opt): a layered cliff face (strata, joints), faceted, one mesh. Good for the rock wall beside the road or a backdrop.
       pts: [{x,y,z}, ...] along the FOOT of the cliff (points every 4-8 m)
       opt.side   +1 = the rock rises to the right of the path direction, -1 = to the left (the face looks back at the road)
       opt.height (12 m), opt.lean (0..1.2, how much it leans back as it rises, default 0.35), opt.rough (1.2 m of random bulge),
       opt.rows (5), opt.tint ([r,g,b]), opt.seed (any integer, changes the bumps).
     Returns the mesh. */
  function rockFace(pts, opt = {}) {
    const H = opt.height || 12, side = opt.side || 1, lean = opt.lean != null ? opt.lean : 0.35, rough = opt.rough != null ? opt.rough : 1.2, rows = opt.rows || 5, tint = opt.tint || [1, 1, 1];
    const rng = mulberry32((opt.seed || 7) * 7919), n = pts.length, tan = pathTangents(pts), b = geoBuilder();
    const grid = [], sink = 1.5;
    let u = 0;
    for (let i = 0; i < n; i++) {
      if (i) u += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const nx = -tan[i][1] * side, nz = tan[i][0] * side, col = [];           // nx,nz: points into the rock
      for (let k = 0; k <= rows; k++) {
        const t = k / rows, back = t * H * lean + (k && k < rows ? (rng() - 0.3) * rough : k === rows ? rng() * rough : 0), up = k === 0 ? -sink : t * H + (k < rows ? (rng() - 0.5) * H * 0.06 : rng() * 1.2);
        const shade = (0.86 + 0.14 * t) * (0.94 + rng() * 0.12);
        col.push([pts[i].x + nx * back, pts[i].y + up, pts[i].z + nz * back, shade, nx, nz]);
      }
      grid.push({ u, col });
    }
    const TILE = 8, vOf = (k) => (k === 0 ? -sink : k / rows * H) / TILE;
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < rows; k++) {
      const A = grid[i].col[k], B = grid[i + 1].col[k], C = grid[i + 1].col[k + 1], D = grid[i].col[k + 1];
      const cc = (p) => [tint[0] * p[3], tint[1] * p[3], tint[2] * p[3]], out = [-A[4], 0.15, -A[5]];
      b.quad(b.v(A[0], A[1], A[2], grid[i].u / TILE, vOf(k), cc(A)), b.v(B[0], B[1], B[2], grid[i + 1].u / TILE, vOf(k), cc(B)), b.v(C[0], C[1], C[2], grid[i + 1].u / TILE, vOf(k + 1), cc(C)), b.v(D[0], D[1], D[2], grid[i].u / TILE, vOf(k + 1), cc(D)), out);
    }
    for (let i = 0; i < n - 1; i++) {                                           // flat top so it never looks hollow from above
      const A = grid[i].col[rows], B = grid[i + 1].col[rows], dA = [A[4] * 5, A[5] * 5], dB = [B[4] * 5, B[5] * 5], cA = [tint[0] * A[3], tint[1] * A[3], tint[2] * A[3]];
      b.quad(b.v(A[0], A[1], A[2], 0, 0, cA), b.v(B[0], B[1], B[2], 1, 0, cA), b.v(B[0] + dB[0], B[1], B[2] + dB[1], 1, 1, cA), b.v(A[0] + dA[0], A[1], A[2] + dA[1], 0, 1, cA), [0, 1, 0]);
    }
    return roadsideMesh(b.build(), rockLayerTex(), {});
  }
