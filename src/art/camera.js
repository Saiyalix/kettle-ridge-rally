  /* ---------- camera ---------- */
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpD = new THREE.Vector3();
  let camInit = false, camTurn = 0, camSlide = 0, camY = 0, camLookY = 0, shakeT = 0;
  const RUMBLE = { tarmac: 0.004, gravel: 0.016, dirt: 0.02, snow: 0.012, grass: 0.03 };
  const rallyDir = new THREE.Vector3(0, 0, 1), prevVel = new THREE.Vector3(), headOff = new THREE.Vector3(), headTarget = new THREE.Vector3(), worldUp = new THREE.Vector3(0, 1, 0), _qi = new THREE.Quaternion();
  const CAM_MODES = 6;                 // 0 rally far (default), 1 low close chase with speed feel (first press of C), 2 bonnet, 3 cockpit, 4 low far view, 5 original chase (new modes go at the end)
  const REDUCED_MOTION = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let camSpd = 0;
  let orbitA = 0.6;
  // interpolated pose: physics runs at 120 Hz, the screen at whatever rate it has; drawing the car between
  // its last two physics states removes the stutter you get when the two rates don't line up
  const vPos = new THREE.Vector3(), vQ = new THREE.Quaternion(), vFwd = new THREE.Vector3(), vUp = new THREE.Vector3();
  function updateViewPose(alpha) {
    vPos.lerpVectors(car.prevPos, car.pos, alpha); vQ.copy(car.prevQ).slerp(car.q, alpha);
    vFwd.set(0, 0, 1).applyQuaternion(vQ); vUp.set(0, 1, 0).applyQuaternion(vQ);
  }
  function updateCamera(dt) {
    const CC = CONFIG.camera;
    if (state === 'menu') {
      // slow orbit around the car at the start line
      orbitA += dt * 0.11;
      camera.position.set(vPos.x + Math.sin(orbitA) * 9.5, vPos.y + 3.2, vPos.z + Math.cos(orbitA) * 9.5);
      const gh = terrain.heightAt(camera.position.x, camera.position.z) + 1.2; if (camera.position.y < gh) camera.position.y = gh;
      camera.up.set(0, 1, 0); camera.lookAt(vPos.x, vPos.y + 0.4, vPos.z);
      camera.fov = 50; camera.near = 0.1; camera.updateProjectionMatrix(); camInit = false;
      return;
    }
    // shared feel for every view: how fast the car is turning (smoothed), how far it is sliding, shake and surface rumble
    camTurn += ((car.grounded > 0 ? car.angVel.y : camTurn * 0.9) - camTurn) * (1 - Math.exp(-dt * 3));
    camSlide += (clamp(car.beta, -0.8, 0.8) * clamp(car.speed / 15, 0, 1) - camSlide) * (1 - Math.exp(-dt * 2.5));
    shake *= Math.exp(-dt * 5); shakeT += dt;
    landShakeCool -= dt;
    let hardest = 0; for (const w of car.wheels) hardest = Math.max(hardest, w.compVel || 0);
    if (hardest > 2.2 && landShakeCool <= 0 && state !== 'menu' && state !== 'replay') { addShake(Math.min(1, (hardest - 1.6) / 4)); landShakeCool = 0.3; }
    let surf = 'gravel', nC = 0; for (const w of car.wheels) if (w.contact) { nC++; surf = w.surface; }
    const low2 = camMode === 1;                                                // the low close chase: no rumble on tarmac, calmer on loose ground
    const rumble = (low2 ? (surf === 'tarmac' ? 0 : (RUMBLE[surf] || 0.01) * 0.7) : (RUMBLE[surf] || 0.01)) * clamp(car.speed / 40, 0, 1.3) * nC / 4 * (state === 'replay' ? (low2 ? 0 : 0.5) : 1) * (low2 && REDUCED_MOTION ? 0 : 1);
    const amp = shake * shake * 0.5 + rumble;
    const shX = (Math.sin(shakeT * 41) * 0.6 + Math.sin(shakeT * 67 + 1.3) * 0.4) * amp;
    const shY = (Math.sin(shakeT * 53 + 0.7) * 0.6 + Math.sin(shakeT * 83 + 2.1) * 0.4) * amp;
    if (camMode === 0 || camMode === 1 || camMode === 4 || camMode === 5) {
      // chase views: follow a blend of heading and travel so slides read clearly, look into the corner
      // you are turning through, sit a little to the inside of a slide, and ease over crests
      const far = camMode === 0 || camMode === 4, low = camMode === 4, close = camMode === 1;
      camSpd += (clamp(car.speed / 45, 0, 1) - camSpd) * (1 - Math.exp(-dt * 2));   // 0..1 speed feel, smoothed (pull back, widen)
      tmpD.set(vFwd.x, 0, vFwd.z).normalize();
      const hv = Math.hypot(car.vel.x, car.vel.z);
      if (hv > 3 && car.vForward > 0) { tmpV.set(car.vel.x / hv, 0, car.vel.z / hv); tmpD.multiplyScalar(far ? 0.4 : close ? 0.35 : 0.55).addScaledVector(tmpV, far ? 0.6 : close ? 0.65 : 0.45).normalize(); }
      if (far) { rallyDir.lerp(tmpD, 1 - Math.exp(-dt * 2.2)).normalize(); tmpD.copy(rallyDir); }
      const lx = tmpD.z, lz = -tmpD.x;                                         // left of the camera's direction
      let dist = low ? CC.lowDistance : far ? CC.rallyDistance : CC.chaseDistance, height = low ? CC.lowHeight : far ? CC.rallyHeight : CC.chaseHeight;
      if (close) { dist = CC.closeDistance + CC.closePull * camSpd; height = CC.closeHeight + CC.closeRise * camSpd; }
      const inside = -camSlide * (far ? 2.2 : 1.1);                            // towards the inside of the slide
      const want = tmpV.copy(vPos).addScaledVector(tmpD, -dist);
      want.x += lx * inside; want.z += lz * inside;
      let wantY = vPos.y + height;
      if (!far) { const gh = terrain.heightAt(want.x, want.z) + 1.2; if (wantY < gh) wantY = gh; }
      if (!camInit || Math.hypot(camPos.x - want.x, camPos.z - want.z) > 60) { camPos.copy(want); camY = wantY; camLookY = vPos.y; camInit = true; }
      const k = 1 - Math.exp(-dt * (far ? 4 : CC.chaseLag));
      camPos.x += (want.x - camPos.x) * k; camPos.z += (want.z - camPos.z) * k;
      camY += (wantY - camY) * (1 - Math.exp(-dt * (far ? 2.2 : 3)));            // height follows more gently: smooth over crests
      camY = clamp(camY, wantY - 3.5, wantY + 3.5);
      const gMin = terrain.heightAt(camPos.x, camPos.z) + 1.5; if (camY < gMin) camY = gMin;
      camPos.y = camY;
      camLookY += (vPos.y - camLookY) * (1 - Math.exp(-dt * 5));
      const look = clamp(camTurn * (far ? 3.2 : close ? 3.4 : 2.2), -3.5, close ? 4.5 : 3.5);               // positive turn = left
      const ahead = low ? CC.lowLookAhead : far ? CC.rallyLookAhead : close ? CC.closeLookAhead : 2.5;
      camLook.set(vPos.x + tmpD.x * ahead + lx * look, camLookY + (far ? 0 : close ? 0.6 : 0.9), vPos.z + tmpD.z * ahead + lz * look);
      camLook.x += lx * shX * 3; camLook.y += shY * 3; camLook.z += lz * shX * 3;
      camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camLook);
      camera.fov = close ? CC.closeFov + CC.closeFovGain * camSpd : far ? 46 + Math.min(6, car.speed * 0.1) : 62 + Math.min(10, car.speed * 0.2);
    } else if (camMode === 2) {
      camera.position.set(0, 0.78, 0.55).applyQuaternion(vQ).add(vPos);
      camLook.set(shX * 1.2, 0.6 + shY * 1.2, 12).applyQuaternion(vQ).add(vPos);
      camera.up.copy(vUp); camera.lookAt(camLook);
      camera.fov = 70;
      camPos.copy(camera.position);
    } else {
      // cockpit: the driver's head leans against braking, acceleration and cornering forces
      tmpV.subVectors(car.vel, prevVel).divideScalar(Math.max(dt, 1e-3));
      _qi.copy(vQ).invert(); tmpV.applyQuaternion(_qi);
      headTarget.set(clamp(-tmpV.x * 0.0028, -0.05, 0.05), clamp(-tmpV.y * 0.0015, -0.03, 0.03), clamp(-tmpV.z * 0.003, -0.05, 0.05));
      headOff.lerp(headTarget, 1 - Math.exp(-dt * 7));
      camera.position.copy(EYE).add(headOff).applyQuaternion(vQ).add(vPos);
      camLook.set(DRV + shX * 1.4, 0.2 + shY * 1.4, 10).applyQuaternion(vQ).add(vPos);
      tmpD.copy(vUp).lerp(worldUp, 0.3).normalize();
      camera.up.copy(tmpD); camera.lookAt(camLook);
      camera.fov = 74;
      camPos.copy(camera.position);
    }
    prevVel.copy(car.vel);
    camera.near = camMode === 3 ? 0.03 : 0.1;
    camera.updateProjectionMatrix();
  }

