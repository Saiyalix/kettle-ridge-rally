/* =====================================================================
   Collisions. The car is three circles along its centre line; obstacles are
   circles (trees, rocks, posts) or segments (walls, rails, fences, building
   sides). A glancing hit pushes the car out, takes away the speed going into
   the obstacle plus a bit of scraping friction, and gives a small, damped
   twist, so you deflect and carry on instead of stopping dead.
   ===================================================================== */
const COLL = {
  carR: 0.95, offs: [1.35, 0, -1.35],
  e: 0.18,          // bounce
  mu: 0.22,         // scraping friction (share of the impact impulse taken from the speed along the obstacle)
  yawShare: 0.35,   // how much of the physical twist from an off-centre hit is kept
  maxYawKick: 2.0,  // rad/s cap on the twist from a single contact
  align: 0.55,      // glancing wall hits: share of the angle into the wall that is turned away at once
};
function collideCar(car, cands, groundH, fx) {
  const m = CONFIG.car.mass, Iy = CONFIG.car.inertia.yaw;
  let worst = 0, wn = null; const yaw0 = car.angVel.y;
  for (const off of COLL.offs) {
    for (const ob of cands) {
      const cx = car.pos.x + car.fwd.x * off, cz = car.pos.z + car.fwd.z * off;
      let qx, qz;
      const seg = ob.bx !== undefined;
      if (seg) {
        const sx = ob.bx - ob.ax, sz = ob.bz - ob.az, L2 = sx * sx + sz * sz;
        const t = L2 > 0 ? clamp(((cx - ob.ax) * sx + (cz - ob.az) * sz) / L2, 0, 1) : 0;
        qx = ob.ax + sx * t; qz = ob.az + sz * t;
      } else { qx = ob.x; qz = ob.z; }
      const r = ob.r, dx = cx - qx, dz = cz - qz, d = Math.hypot(dx, dz), minD = COLL.carR + r;
      if (d >= minD || d < 1e-4) continue;
      if (car.pos.y - groundH(qx, qz) > (ob.h || 2.5)) continue;          // flying over it
      const nx = dx / d, nz = dz / d;
      car.pos.x += nx * (minD - d); car.pos.z += nz * (minD - d);
      const px = qx + nx * r, pz = qz + nz * r;                           // contact point on the obstacle's surface
      const rx = px - car.pos.x, rz = pz - car.pos.z;
      const vpx = car.vel.x - car.angVel.y * rz, vpz = car.vel.z + car.angVel.y * rx;
      const vn = vpx * nx + vpz * nz;
      if (vn >= 0) continue;
      const rn = rz * nx - rx * nz;
      const jn = -(1 + (ob.e ?? COLL.e)) * vn / (1 / m + COLL.yawShare * rn * rn / Iy);
      car.vel.x += nx * jn / m; car.vel.z += nz * jn / m;
      car.angVel.y += COLL.yawShare * rn * jn / Iy;
      // scraping along it costs speed in proportion to how hard you hit, but never reverses you
      const tx = -nz, tz = nx, vt = car.vel.x * tx + car.vel.z * tz;
      const dvt = Math.min(Math.abs(vt), (ob.mu ?? COLL.mu) * jn / m), sg = Math.sign(vt);
      car.vel.x -= tx * sg * dvt; car.vel.z -= tz * sg * dvt;
      if (-vn > worst) {
        worst = -vn; wn = seg ? [nx, nz] : null;
        if (fx) { fx.hit = Math.max(fx.hit || 0, -vn); fx.x = px; fx.z = pz; fx.nx = nx; fx.nz = nz; fx.vt = Math.abs(vt); fx.seg = seg; }
      }
    }
  }
  // glancing hit on a wall: swing the nose part of the way back along it, so the car doesn't keep grinding in
  car.angVel.y = clamp(car.angVel.y, yaw0 - COLL.maxYawKick, yaw0 + COLL.maxYawKick);
  if (wn && Math.hypot(car.vel.x, car.vel.z) > 4) {
    const into = -(car.fwd.x * wn[0] + car.fwd.z * wn[1]);                 // >0 = nose pointing into the wall
    if (into > 0 && into < 0.6) {
      const tx = -wn[1], tz = wn[0], side = Math.sign(car.fwd.x * tz - car.fwd.z * tx) || 1;
      car.angVel.y = yaw0 - side * Math.asin(into) * COLL.align * 8;      // spread over the next ~1/8 s by the yaw control
    }
  }
  return worst;
}

// Low stone walls on the outside of every corner that has a drop beyond it (cliff stage), as wall segments
function cliffBarriers(track, half) {
  const P = track.samples, at = s => P[clamp(Math.round(s / track.step), 0, P.length - 1)];
  const step = 2.4, n = Math.ceil(track.length / step), off = half + 1.3;
  const want = { [-1]: new Uint8Array(n), [1]: new Uint8Array(n) };
  for (const t of track.turns) {
    const side = t.dir === 'R' ? -1 : 1;                                   // outside of a right turn is the left side
    for (let s = t.s0 - 8; s <= t.s1 + 18; s += step) {
      const i = Math.round(s / step), p = at(s);
      if (i >= 0 && i < n && (side > 0 ? p.upR : p.upL) < 0.4) want[side][i] = 1;
    }
  }
  const blocks = [], segs = [];
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < n; i++) {
      if (!want[side][i]) { prev = null; continue; }
      const p = at(i * step), x = p.x - Math.cos(p.th) * off * side, z = p.z + Math.sin(p.th) * off * side;
      blocks.push({ x, z, th: p.th });
      if (prev) segs.push({ ax: prev[0], az: prev[1], bx: x, bz: z, r: 0.5, mu: 0.25 });
      prev = [x, z];
    }
  }
  return { blocks, segs };
}

