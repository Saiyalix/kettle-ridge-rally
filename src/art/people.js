  /* ---------- spectators and other little people: real low-poly 3D models, instanced, with level of detail (art) ----------
     What a person looks like is here. Where crowds stand (and how many groups) is tracks: tracks/themes.js trackside() hands every crowd spot to
     crowdGroup(), which fills it from its OWN seeded generator (nothing is drawn from the stage's random numbers; no obstacle is added).

     Models: six poses (stand, cheer with both arms up, point, sit on the ground / a wall, hold a flag, take a picture), each one merged geometry with
     vertex colours. WHICH colours come from the instance, not from the model: shirt, trousers, skin and hair are palette numbers on the instance
     (tables below, 16 shirts, 8 trousers, 8 skins, 8 hair colours), so one model makes thousands of different people. Hats and long hair are parts that
     the shader hides or shows per person. Kids are the same model at 0.62 to 0.78 scale.
     Animation is only in the vertex shader (one shared time uniform): a slight sway for everybody, arms waving and a little hop for the cheering
     ones, flags flutter. People near the car cheer harder (distance to the car in the shader). Nothing runs in JavaScript per frame except the level of detail.

     Level of detail: every person is stored once (matrix + palette numbers in typed arrays), grouped in clusters (one per crowd spot).
     updateCrowd() (called from renderFrame) runs when the camera has moved 4 m or turned about 10 degrees: it drops clusters behind the camera or
     beyond the fog, and copies each person into a "near" mesh (full model, per pose) or the "far" mesh (a 40 triangle figure, two kinds: arms down / arms up).
     Low quality: coarser models, near distance 22 m instead of 38, far people are drawn to 70 % of the fog distance and only every second one past 60 m, no shadows.

     For tracks:
       crowdAdd(list)      list of persons {x, z, y?, yaw?, pose?, kid?, shirt?, pants?, skin?, hair?, hat?, long?, amp?, s?}, all of one group (the group is one cluster for culling).
                           y = ground height (default terrain.heightAt), yaw = turn in radians (local +z is the front, so the person looks along (sin yaw, cos yaw)),
                           pose = 'stand' | 'cheer' | 'point' | 'sit' | 'flag' | 'camera' (default stand), kid = true for a small person,
                           shirt / pants / skin / hair = palette numbers (PAL.shirt etc. are the colours; SHIRT_HIVIS = hi-vis orange vest, SHIRT_HIVIS_Y = hi-vis yellow),
                           hat = 0 none, 1 cap, 2 beanie; long = true for long hair; amp = 0..1 how excited (default random); s = scale (default 0.93 to 1.07).
                           Anything not given is chosen at random from a generator seeded by the position, so a stage looks the same every time.
       crowdGroup(spot, opt)  -> list of persons for a crowd spot {x, z, th, side, y} (th = road direction there, side = +1 right / -1 left of the road, x/z/y the middle
                           of the spot, as trackside() has them); opt.tag = 'start' | 'finish' | 'corner' | 'jump' picks the mix; opt.n = slots (default 18); opt.width (7.5 m).
       crowdBuild()        (called from loadStage) makes the meshes from everything added so far. */
  const PAL = {
    shirt: ['#d32f2f', '#1976d2', '#fbc02d', '#388e3c', '#f2f2ee', '#212121', '#7b1fa2', '#f57c00', '#00897b', '#ec407a', '#1a237e', '#78909c', '#ff6a13', '#90caf9', '#8e2430', '#d8e82a'],
    pants: ['#2f4f7a', '#1f2a3a', '#17171a', '#a89472', '#5b6068', '#4a5238', '#243a5e', '#7b6a4c'],
    skin: ['#f6d5bd', '#efc29a', '#dba878', '#c28a5a', '#a36b3e', '#85522c', '#68401f', '#4a2c17'],
    hair: ['#1b1512', '#3a2a1e', '#6a4a30', '#d6ae5c', '#a14f22', '#9a9a9a', '#e9e6df', '#2a3042'],
  };
  const SHIRT_HIVIS = 12, SHIRT_HIVIS_Y = 15;
  const POSE_ID = { stand: 0, cheer: 1, point: 2, sit: 3, flag: 4, camera: 5 }, POSE_UP = [0, 1, 0, 0, 1, 1];     // POSE_UP: which far figure (arms down / up)
  const POSE_N = 6;
  const SKIN_W = [2, 3, 3, 3, 2.2, 1.6, 1.1, 0.8], HAIR_W = [3, 3, 2, 1.5, 0.7, 1, 0.5, 0.5];
  const pickW = (w, r) => { let t = 0; for (const x of w) t += x; r *= t; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };

  const peopleMat = (() => {
    const pal = []; for (const k of ['shirt', 'pants', 'skin', 'hair']) for (const h of PAL[k]) { const c = new THREE.Color(h); pal.push(new THREE.Vector3(c.r, c.g, c.b)); }       // Color converts the sRGB hex to linear
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPal = { value: pal }; sh.uniforms.uWT = WIND.uT; sh.uniforms.uCar = peopleMat.userData.car;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float pt; attribute vec4 tw; attribute vec4 lkA; attribute vec4 lkB;
          uniform vec3 uPal[40]; uniform float uWT; uniform vec2 uCar;`)
        .replace('#include <color_vertex>', `{
            int P = int(pt + 0.5); vec3 c;
            if (P == 4) c = pow(color, vec3(2.2));
            else {
              int sh = int(lkA.x + 0.5);
              int ix = P == 0 ? 24 + int(lkA.z + 0.5) : P == 1 ? sh : P == 2 ? 16 + int(lkA.y + 0.5) : (P == 3 || P == 7) ? 32 + int(lkA.w + 0.5) : (P == 5 || P == 10) ? ((sh == 12 || sh == 15) ? sh : (sh + 5) % 16) : P == 8 ? (sh + 3) % 16 : (sh + 9) % 16;
              c = uPal[ix] * color.r;
            }
            vColor = vec4(c, 1.0);
          }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            int Q = int(pt + 0.5);
            if ((Q == 5 && lkB.x < 0.5) || (Q == 10 && (lkB.x < 0.5 || lkB.x > 1.5)) || (Q == 7 && lkB.y < 0.5)) transformed = vec3(0.0);
            else {
              vec4 ip = instanceMatrix[3];
              float dc = distance(ip.xz, uCar);
              float ex = clamp(lkB.w * 0.45 + (1.0 - smoothstep(10.0, 70.0, dc)) * 0.85, 0.0, 1.0);
              float t = uWT * (2.4 + lkB.w * 1.6) + lkB.z * 6.2831;
              float sg = position.x < 0.0 ? -1.0 : 1.0;
              transformed.y += tw.w * ex * 0.085 * abs(sin(t));
              transformed.y += tw.y * (0.05 + 0.13 * ex) * sin(t + (sg > 0.0 ? 0.0 : 1.6));
              transformed.x += tw.y * sg * 0.05 * ex * sin(t * 0.5);
              transformed.x += tw.x * (0.01 + 0.015 * ex) * sin(t * 0.5 + 1.0);
              transformed.z += tw.z * (0.05 + 0.05 * ex) * sin(uWT * 7.0 + position.x * 9.0 + lkB.z * 6.0);
              transformed.y += tw.z * 0.03 * sin(uWT * 5.0 + position.x * 7.0 + lkB.z * 6.0);
            }
          }`);
    };
    m.customProgramCacheKey = () => 'people';
    m.userData.keep = true; m.userData.car = { value: new THREE.Vector2(1e5, 1e5) };
    return m;
  })();
  // note: peopleMat's own userData.car is referenced above before it exists; onBeforeCompile runs later, at first draw, so it is set by then

  /* ----- one person, one pose, as a merged geometry. y up, feet on y = 0, the front is +z, about 1.75 m tall ----- */
  const PERSON_H = 1.75;
  function buildPerson(pose, low) {
    const m = modeller(), sg = low ? 5 : 6, hs = low ? [5, 3] : [6, 4];
    const SK = 0, SH = 1, PA = 2, HA = 3, HAT = 5, LONG = 7, FLA = 8, FLB = 9, BRIM = 10;
    const hip = pose === 3 ? 0.16 : 0.9, shY = hip + 0.5, headY = shY + 0.23;
    const armK = [0.15, 0.5, 0.05, 0.1, 0.6, 0.0][pose], hop = [0, 1, 0, 0, 0.5, 0][pose];                  // how much the arms move, how much the body hops
    const lean = (x, y) => clamp(y / 1.9, 0, 1) * 0.6;
    const twBody = (x, y, z) => [lean(x, y), 0, 0, hop];
    const arm = (sx, S, E, H) => {
      const tw = (x, y, z) => [lean(x, y), clamp(Math.hypot(x - S[0], y - S[1], z - S[2]) / 0.55, 0, 1) * armK, 0, hop];
      const sleeve = (x, y, z, ny) => { const k = 0.82 + 0.18 * ny; return [k, k, k]; };
      m.cyl(S, E, 0.068, 0.057, sg, sleeve, { part: SH, tw, open: true });
      m.cyl(E, H, 0.05, 0.04, sg, [1, 1, 1], { part: SK, tw, open: true });
      m.sph(H[0], H[1], H[2], 0.052, 0.052, 0.052, hs[0] - 1, hs[1] - 1, [1, 1, 1], { part: SK, tw });
    };
    const shade = (a, b) => (x, y) => { const k = a + (b - a) * clamp((y - hip) / 0.55, 0, 1); return [k, k, k]; };
    const leg = (sx, K, F) => {
      const H = [sx * 0.095, hip, 0];
      m.cyl(H, K, 0.1, 0.074, sg, [0.92, 0.92, 0.92], { part: PA, tw: twBody, open: true });
      m.cyl(K, F, 0.072, 0.056, sg, [0.82, 0.82, 0.82], { part: PA, tw: twBody, open: true });
      m.box(F[0], 0.035, F[2] + 0.05, 0.12, 0.08, 0.29, [0.13, 0.13, 0.15], { part: 4, tw: twBody });
    };
    // torso, neck, head, hair, hat
    m.cyl([0, hip - 0.02, 0], [0, shY, 0], 0.2, 0.25, sg + 1, shade(0.72, 1.0), { part: SH, tw: twBody, ez: 0.62, nobottom: true });
    m.cyl([0, shY - 0.02, 0], [0, shY + 0.1, 0.01], 0.06, 0.055, 5, [1, 1, 1], { part: SK, tw: twBody, open: true });
    const hz = pose === 5 ? 0.05 : 0.01;
    m.sph(0, headY, hz, 0.125, 0.145, 0.13, hs[0], hs[1], (x, y, z, ny) => { const k = 0.9 + 0.1 * ny; return [k, k, k]; }, { part: SK, tw: twBody });
    m.sph(0, headY + 0.012, hz - 0.012, 0.137, 0.155, 0.143, hs[0], Math.max(2, hs[1] - 1), [0.85, 0.85, 0.85], { part: HA, tw: twBody, cap: 1.95, rx: -0.35 });
    m.box(0, headY - 0.11, hz - 0.12, 0.24, 0.3, 0.08, [0.8, 0.8, 0.8], { part: LONG, tw: twBody });
    m.sph(0, headY + 0.025, hz - 0.004, 0.146, 0.15, 0.15, hs[0], Math.max(2, hs[1] - 1), [0.95, 0.95, 0.95], { part: HAT, tw: twBody, cap: 1.65 });
    m.box(0, headY + 0.055, hz + 0.135, 0.17, 0.014, 0.1, [0.85, 0.85, 0.85], { part: BRIM, tw: twBody, rx: 0.15 });
    const SL = [-0.26, shY - 0.04, 0], SR = [0.26, shY - 0.04, 0];
    if (pose === 0) {
      leg(-1, [-0.1, 0.5, 0.02], [-0.115, 0.06, 0]); leg(1, [0.1, 0.5, 0.0], [0.115, 0.06, 0.02]);
      arm(-1, SL, [-0.31, 1.1, 0.02], [-0.32, 0.84, 0.06]); arm(1, SR, [0.31, 1.1, 0.02], [0.32, 0.84, 0.06]);
    } else if (pose === 1) {
      leg(-1, [-0.115, 0.5, 0.03], [-0.15, 0.06, 0]); leg(1, [0.115, 0.5, 0.03], [0.15, 0.06, 0]);
      arm(-1, SL, [-0.37, shY + 0.17, 0.02], [-0.47, shY + 0.45, 0.05]); arm(1, SR, [0.37, shY + 0.17, 0.02], [0.47, shY + 0.45, 0.05]);
    } else if (pose === 2) {
      leg(-1, [-0.1, 0.5, 0.0], [-0.12, 0.06, -0.04]); leg(1, [0.1, 0.5, 0.04], [0.12, 0.06, 0.09]);
      arm(1, SR, [0.3, shY - 0.1, 0.24], [0.2, shY - 0.17, 0.56]);
      arm(-1, SL, [-0.32, 1.17, 0.0], [-0.19, 1.0, 0.07]);
    } else if (pose === 3) {                                                                                // sitting: hips on the ground, knees up
      leg(-1, [-0.12, 0.46, 0.34], [-0.13, 0.05, 0.62]); leg(1, [0.12, 0.46, 0.34], [0.13, 0.05, 0.62]);
      arm(-1, SL, [-0.27, 0.42, 0.14], [-0.15, 0.54, 0.36]); arm(1, SR, [0.27, 0.42, 0.14], [0.15, 0.54, 0.36]);
    } else if (pose === 4) {                                                                                // flag in the right hand
      leg(-1, [-0.1, 0.5, 0.02], [-0.12, 0.06, 0]); leg(1, [0.1, 0.5, 0.02], [0.12, 0.06, 0.02]);
      arm(1, SR, [0.34, shY + 0.02, 0.15], [0.3, shY + 0.3, 0.22]); arm(-1, SL, [-0.3, 1.2, 0.05], [-0.22, 1.0, 0.1]);
      const px = 0.3, pz = 0.22, top = 2.95, fw = 0.78, fh = 0.46, st = low ? 2 : 4;
      m.cyl([px, 1.25, pz], [px, top, pz], 0.014, 0.012, 4, [0.85, 0.78, 0.6], { part: 4, tw: [0.4, 0.4 * 0, 0, hop] });
      for (let i = 0; i < st; i++) {
        const x0 = px + 0.012 + fw * i / st, x1 = px + 0.012 + fw * (i + 1) / st;
        m.quad([x0, top - fh / 2, pz], [x1, top - fh / 2, pz], [x1, top, pz], [x0, top, pz], [1, 1, 1], { part: FLA, tw: (x) => [0.4, 0, (x - px) / fw, 0], two: true });
        m.quad([x0, top - fh, pz], [x1, top - fh, pz], [x1, top - fh / 2, pz], [x0, top - fh / 2, pz], [1, 1, 1], { part: FLB, tw: (x) => [0.4, 0, (x - px) / fw, 0], two: true });
      }
    } else {                                                                                                // camera at the face
      leg(-1, [-0.1, 0.5, 0.02], [-0.12, 0.06, 0]); leg(1, [0.1, 0.5, 0.04], [0.12, 0.06, 0.08]);
      arm(-1, SL, [-0.27, shY - 0.2, 0.2], [-0.07, headY - 0.04, 0.3]); arm(1, SR, [0.27, shY - 0.2, 0.2], [0.07, headY - 0.04, 0.3]);
      m.box(0, headY - 0.03, 0.34, 0.17, 0.11, 0.13, [0.08, 0.08, 0.1], { part: 4, tw: twBody });
      m.cyl([0, headY - 0.03, 0.4], [0, headY - 0.03, 0.52], 0.045, 0.05, 6, [0.16, 0.16, 0.19], { part: 4, tw: twBody });
    }
    return m.geo();
  }
  // far figure: legs, body, a diamond head (hair above, skin below), arms; about 40 triangles
  function buildPersonFar(up, low) {
    const m = modeller(), sg = low ? 4 : 5, SK = 0, SH = 1, PA = 2, HA = 3, tw = (x, y) => [clamp(y / 1.9, 0, 1) * 0.6, 0, 0, up ? 0.8 : 0];
    m.cyl([0, 0, 0], [0, 0.9, 0], 0.17, 0.19, sg, [0.85, 0.85, 0.85], { part: PA, tw, open: true, ez: 0.7 });
    m.cyl([0, 0.9, 0], [0, 1.45, 0], 0.23, 0.26, sg, [0.9, 0.9, 0.9], { part: SH, tw, ez: 0.62, open: true });
    m.sph(0, 1.66, 0, 0.14, 0.17, 0.14, low ? 4 : 5, low ? 2 : 3, [1, 1, 1], { part: (x, y) => (y > 1.66 ? HA : SK), tw });
    if (up) { m.cyl([-0.2, 1.4, 0], [-0.42, 1.85, 0.04], 0.05, 0.045, 4, [0.9, 0.9, 0.9], { part: SH, tw, open: true }); m.cyl([0.2, 1.4, 0], [0.42, 1.85, 0.04], 0.05, 0.045, 4, [0.9, 0.9, 0.9], { part: SH, tw, open: true }); }
    else { m.cyl([-0.23, 1.4, 0], [-0.26, 0.95, 0.04], 0.05, 0.045, 4, [0.9, 0.9, 0.9], { part: SH, tw, open: true }); m.cyl([0.23, 1.4, 0], [0.26, 0.95, 0.04], 0.05, 0.045, 4, [0.9, 0.9, 0.9], { part: SH, tw, open: true }); }
    return m.geo();
  }
  const _pgCache = {};
  function personGeos(low) {
    const k = low ? 'l' : 'h';
    if (!_pgCache[k]) { const near = []; for (let p = 0; p < POSE_N; p++) near.push(buildPerson(p, low)); _pgCache[k] = { near, far: [buildPersonFar(0, low), buildPersonFar(1, low)] }; }
    return _pgCache[k];
  }

  /* ----- people registry for the stage that is loading ----- */
  let crowdState = null;
  const _cs = { x: 0, z: 0, fx: 0, fz: 0, fog: 0, ar: 0, q: '', g: null, n: 0 };
  let crowdList = [], crowdClusters = [], crowdDirty = false;
  function crowdReset() { crowdList = []; crowdClusters = []; crowdState = null; crowdDirty = false; }
  const CROWD_NEAR = { high: 38, low: 22 };
  function crowdAdd(list) {
    if (!list.length) return;
    const dummyO = new THREE.Object3D(), cl = { a: crowdList.length, b: 0, x: 0, z: 0, r: 0 };
    for (const q of list) {
      const rng = mulberry32((Math.round(q.x * 13) * 73856093 ^ Math.round(q.z * 13) * 19349663) >>> 0);
      const kid = q.kid != null ? q.kid : rng() < 0.08, pose = typeof q.pose === 'string' ? POSE_ID[q.pose] : (q.pose || 0);
      const p = {
        x: q.x, z: q.z, y: q.y != null ? q.y : terrain.heightAt(q.x, q.z), yaw: q.yaw || 0, pose,
        s: q.s != null ? q.s : kid ? 0.62 + rng() * 0.16 : 0.93 + rng() * 0.14,
        shirt: q.shirt != null ? q.shirt : (rng() * 16 | 0) % 16, pants: q.pants != null ? q.pants : rng() * 8 | 0, skin: q.skin != null ? q.skin : pickW(SKIN_W, rng()), hair: q.hair != null ? q.hair : pickW(HAIR_W, rng()),
        hat: q.hat != null ? q.hat : rng() < (ST.theme === 'alpine' ? 0.5 : 0.2) ? (rng() < 0.7 ? 1 : 2) : 0, long: q.long != null ? +q.long : +(rng() < 0.3), phase: rng(), amp: q.amp != null ? q.amp : rng(),
      };
      if (p.shirt === SHIRT_HIVIS && q.shirt == null) p.shirt = 11;                   // hi-vis is for marshals only
      if (p.shirt === SHIRT_HIVIS_Y && q.shirt == null) p.shirt = 7;
      crowdList.push(p); cl.x += p.x; cl.z += p.z;
    }
    cl.b = crowdList.length; const n = cl.b - cl.a; cl.x /= n; cl.z /= n;
    for (let i = cl.a; i < cl.b; i++) cl.r = Math.max(cl.r, Math.hypot(crowdList[i].x - cl.x, crowdList[i].z - cl.z));
    cl.r += 3.5; crowdClusters.push(cl); crowdDirty = true;
  }
  // a crowd spot -> list of persons, rows behind the tape (see the header)
  function crowdGroup(c, opt = {}) {
    const rng = mulberry32((Math.round(c.x * 7) * 83492791 ^ Math.round(c.z * 7) * 2654435761) >>> 0), tag = opt.tag || 'corner', n = opt.n || (tag === 'corner' ? 16 : 20), W = opt.width || 7.5;
    const fx = Math.sin(c.th), fz = Math.cos(c.th), ox = -Math.cos(c.th) * c.side, oz = Math.sin(c.th) * c.side;     // along the road / away from it
    const cheer = tag === 'start' || tag === 'finish' ? 0.3 : tag === 'jump' ? 0.3 : 0.2, flag = tag === 'start' || tag === 'finish' ? 0.14 : 0.08, cam = tag === 'corner' ? 0.14 : 0.09;
    const rows = [-1.7, -0.75, 0.2], per = Math.ceil(n / 3), out = [];
    rows.forEach((b, ri) => {
      for (let i = 0; i < per; i++) {
        if (rng() < 0.16) continue;
        const a = -W / 2 + 0.5 + (W - 1) * (i + 0.5 * (ri & 1) + rng() * 0.5) / per, bb = b + (rng() - 0.5) * 0.35;
        const x = c.x + fx * a + ox * bb, z = c.z + fz * a + oz * bb, y = terrain.heightAt(x, z);
        if (Math.abs(y - c.y) > 1.6 || terrain.distAt(x, z) < half + 2.4) continue;
        const r = rng(); let pose = 'stand';
        if (r < cheer) pose = 'cheer'; else if (r < cheer + flag) pose = 'flag'; else if (r < cheer + flag + cam && ri < 2) pose = 'camera'; else if (r < cheer + flag + cam + 0.07) pose = 'point'; else if (r < cheer + flag + cam + 0.07 + 0.12 && ri === 0) pose = 'sit';
        const yaw = Math.atan2(-ox, -oz) + (rng() - 0.5) * 0.7 + (pose === 'point' ? 0.2 : 0);                // look at the road, a bit this way or that
        out.push({ x, z, y, yaw, pose });
      }
    });
    return out;
  }

  /* ----- the meshes ----- */
  function crowdBuild() {
    if (crowdState) { for (const m of crowdState.meshes) { stageGroup.remove(m); m.geometry.dispose(); m.dispose(); } crowdState = null; }
    crowdDirty = false; _cs.g = null;
    const n = crowdList.length; if (!n) return;
    const low = quality === 'low', G = personGeos(low), M = new Float32Array(n * 16), A = new Float32Array(n * 4), B = new Float32Array(n * 4), d = new THREE.Object3D();
    const poseCount = new Array(POSE_N).fill(0), upCount = [0, 0];
    crowdList.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.yaw, 0); d.scale.setScalar(p.s); d.updateMatrix(); d.matrix.toArray(M, i * 16);
      A[i * 4] = p.shirt; A[i * 4 + 1] = p.pants; A[i * 4 + 2] = p.skin; A[i * 4 + 3] = p.hair; B[i * 4] = p.hat; B[i * 4 + 1] = p.long; B[i * 4 + 2] = p.phase; B[i * 4 + 3] = p.amp;
      poseCount[p.pose]++; upCount[POSE_UP[p.pose]]++;
    });
    const meshes = [], mk = (geo, cap, shadow) => {
      const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(geo.index);
      cap = Math.max(1, cap);
      const la = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage), lb = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('lkA', la); g.setAttribute('lkB', lb);
      const m = new THREE.InstancedMesh(g, peopleMat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.visible = false; m.frustumCulled = false;
      m.castShadow = shadow; m.receiveShadow = shadow; m.userData.la = la; m.userData.lb = lb; stageGroup.add(m); meshes.push(m); return m;
    };
    const near = G.near.map((g, i) => mk(g, poseCount[i], !low)), far = G.far.map((g, i) => mk(g, upCount[i], false));
    crowdState = { meshes, near, far, M, A, B, low, n };
  }
    function updateCrowd() {
    if (!stageGroup) return;
    if (crowdDirty || (crowdState && crowdState.low !== (quality === 'low'))) crowdBuild();
    const S = crowdState; if (!S) return;
    peopleMat.userData.car.value.set(car.pos.x, car.pos.z);
    const low = S.low, cp = camera.position; camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements; let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz); if (fl < 0.05) { fx = 1; fz = 0; } else { fx /= fl; fz /= fl; }
    const fog = scene.fog.far;
    if (_cs.g === stageGroup && _cs.q === quality && _cs.fog === fog && _cs.ar === camera.aspect && _cs.n === S.n && Math.hypot(cp.x - _cs.x, cp.z - _cs.z) < 4 && fx * _cs.fx + fz * _cs.fz > 0.985) return;
    _cs.g = stageGroup; _cs.x = cp.x; _cs.z = cp.z; _cs.fx = fx; _cs.fz = fz; _cs.q = quality; _cs.fog = fog; _cs.ar = camera.aspect; _cs.n = S.n;
    const nearD = low ? CROWD_NEAR.low : CROWD_NEAR.high, far = fog * (low ? 0.7 : 0.9), nearD2 = nearD * nearD, thinFrom2 = 60 * 60;
    const tanH = Math.tan(camera.fov * Math.PI / 360) * camera.aspect * 1.12 + 0.25, M = S.M, A = S.A, B = S.B;
    const nM = S.near.map(m => m.instanceMatrix.array), nA = S.near.map(m => m.userData.la.array), nB = S.near.map(m => m.userData.lb.array);
    const fM = S.far.map(m => m.instanceMatrix.array), fA = S.far.map(m => m.userData.la.array), fB = S.far.map(m => m.userData.lb.array);
    const cn = new Array(POSE_N).fill(0), cf = [0, 0];
    for (const cl of crowdClusters) {
      const dx = cl.x - cp.x, dz = cl.z - cp.z, d = Math.hypot(dx, dz);
      if (d - cl.r > far) continue;
      const fwd = dx * fx + dz * fz;
      if (fwd < -cl.r || (d > cl.r + 6 && Math.abs(dx * fz - dz * fx) > Math.max(0, fwd + cl.r) * tanH + cl.r)) continue;
      for (let i = cl.a; i < cl.b; i++) {
        const p = crowdList[i], ex = p.x - cp.x, ez = p.z - cp.z, d2 = ex * ex + ez * ez;
        if (d2 > far * far) continue;
        if (d2 < nearD2) {
          const k = p.pose, o = cn[k]++; nM[k].set(M.subarray(i * 16, i * 16 + 16), o * 16); nA[k].set(A.subarray(i * 4, i * 4 + 4), o * 4); nB[k].set(B.subarray(i * 4, i * 4 + 4), o * 4);
        } else {
          if (low && d2 > thinFrom2 && (i & 1)) continue;
          const k = POSE_UP[p.pose], o = cf[k]++; fM[k].set(M.subarray(i * 16, i * 16 + 16), o * 16); fA[k].set(A.subarray(i * 4, i * 4 + 4), o * 4); fB[k].set(B.subarray(i * 4, i * 4 + 4), o * 4);
        }
      }
    }
    const fin = (m, c) => {
      m.count = c; m.visible = c > 0; if (!c) return;
      for (const at of [m.instanceMatrix, m.userData.la, m.userData.lb]) { at.clearUpdateRanges(); at.addUpdateRange(0, c * at.itemSize); at.needsUpdate = true; }
    };
    S.near.forEach((m, k) => fin(m, cn[k])); S.far.forEach((m, k) => fin(m, cf[k]));
  }
