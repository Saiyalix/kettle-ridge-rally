  function updateProgress() {
    let bestD = 1e18, bi = progIdx;
    for (let j = Math.max(0, progIdx - 15); j <= Math.min(P.length - 1, progIdx + 40); j++) {
      const dx = P[j].x - car.pos.x, dz = P[j].z - car.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; bi = j; }
    }
    if (bestD < 35 * 35) progIdx = bi;
    const s = P[progIdx].s;
    if (state === 'running') {
      ghostRecord();
      if (nextCp < ST.checkpoints.length && s >= ST.checkpoints[nextCp]) {
        const ext = ST.timeExt[nextCp];
        timeLeft += ext;
        splits.push(raceTime); lastCpS = ST.checkpoints[nextCp]; nextCp++; renderSplits();
        const cpd = ST.checkpoints[nextCp - 1], sp = racePosition(cpd, raceTime), gap = splitGap(cpd, raceTime);
        banner('EXTENDED TIME  +' + ext, 'ext', 2.4); elBannerSub(`Split P${sp}  ${gap <= 0 ? 'fastest' : '+' + gap.toFixed(1) + ' s'}`);
        cue.checkpoint(); say('Extended time');
      } else if (nextCp === ST.checkpoints.length && s >= track.finishS) { ghostFinish(raceTime); finishStage(); }
    }
    return s;
  }

  // gather obstacles near the car from the grid (segments sit in every cell they cross) and resolve contacts
  let obsStamp = 0; const obsNear = [], hitFx = {};
  function collideObstacles() {
    obsStamp++; obsNear.length = 0;
    const kx = Math.floor(car.pos.x / OH), kz = Math.floor(car.pos.z / OH);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = obsHash.get((kx + a) * 92821 + (kz + b)); if (!list) continue;
      for (const ob of list) if (ob._q !== obsStamp) { ob._q = obsStamp; obsNear.push(ob); }
    }
    if (!obsNear.length) return;
    hitFx.hit = 0;
    collideCar(car, obsNear, terrain.heightAt, hitFx);
    if (hitFx.hit > 0) onCarHit(hitFx);
  }
  function hashObstacles() {
    obsHash = new Map();
    const put = (cx, cz, ob) => { const k = cx * 92821 + cz; if (!obsHash.has(k)) obsHash.set(k, []); obsHash.get(k).push(ob); };
    for (const ob of obstacles) {
      if (ob.bx === undefined) { put(Math.floor(ob.x / OH), Math.floor(ob.z / OH), ob); continue; }
      const r = ob.r + 0.1;
      const x0 = Math.floor((Math.min(ob.ax, ob.bx) - r) / OH), x1 = Math.floor((Math.max(ob.ax, ob.bx) + r) / OH);
      const z0 = Math.floor((Math.min(ob.az, ob.bz) - r) / OH), z1 = Math.floor((Math.max(ob.az, ob.bz) + r) / OH);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, z, ob);
    }
  }

