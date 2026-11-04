  /* ---------- the car ---------- */
  const car = new Car();
  const carGroup = new THREE.Group();
  const exteriorCabin = [];          // hidden in cockpit view so the camera sees the interior
  const carMats = { paint: paintMat(0xf4f6f8), stripe: paintMat(0xffc928), skirt: paintMat(0x1f4fa3) };
  const numCanvas = document.createElement('canvas'); numCanvas.width = numCanvas.height = 128;
  const numTex = new THREE.CanvasTexture(numCanvas);
  function drawNumber(c, num) {
    const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.fillStyle = '#0d1216'; g.font = '800 84px "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 64, 70);
  }
  function applyLivery() {
    const cdef = CONFIG.cars[CONFIG.carIndex];
    carMats.paint.color.setHex(cdef.paint); carMats.stripe.color.setHex(cdef.stripe); carMats.skirt.color.setHex(cdef.skirt);
    drawNumber(numCanvas, cdef.number); numTex.needsUpdate = true;
  }
  {
    const paint = carMats.paint, accent = carMats.stripe, blue = carMats.skirt;
    const glass = glassMat();
    const dark = lit({ color: 0x1b1d20 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; carGroup.add(m); return m; };
    add(new THREE.BoxGeometry(1.66, 0.5, 4.05), paint, 0, -0.04, 0);
    const cab = new THREE.BoxGeometry(1.56, 0.52, 2.0);
    const cp = cab.attributes.position;
    for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.86); if (cp.getZ(i) > 0) cp.setZ(i, cp.getZ(i) - 0.45); }
    cab.computeVertexNormals();
    exteriorCabin.push(add(cab, glass, 0, 0.47, -0.25));
    exteriorCabin.push(add(new THREE.BoxGeometry(1.3, 0.05, 1.35), paint, 0, 0.74, -0.45));
    add(new THREE.BoxGeometry(1.68, 0.16, 4.07), blue, 0, -0.18, 0);
    add(new THREE.BoxGeometry(0.34, 0.02, 1.4), accent, 0.26, 0.215, 1.25);
    add(new THREE.BoxGeometry(0.34, 0.02, 1.4), accent, -0.26, 0.215, 1.25);
    add(new THREE.BoxGeometry(1.7, 0.06, 0.38), dark, 0, 0.62, -1.9);
    add(new THREE.BoxGeometry(0.06, 0.4, 0.2), dark, 0.6, 0.42, -1.85);
    add(new THREE.BoxGeometry(0.06, 0.4, 0.2), dark, -0.6, 0.42, -1.85);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
    add(new THREE.BoxGeometry(0.34, 0.14, 0.04), lamp, 0.55, 0.0, 2.03);
    add(new THREE.BoxGeometry(0.34, 0.14, 0.04), lamp, -0.55, 0.0, 2.03);
    const tail = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    add(new THREE.BoxGeometry(0.4, 0.12, 0.04), tail, 0.6, 0.05, -2.03);
    add(new THREE.BoxGeometry(0.4, 0.12, 0.04), tail, -0.6, 0.05, -2.03);
    // door number
    const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true });
    const n1 = add(new THREE.PlaneGeometry(0.5, 0.5), numMat, 0.835, 0.0, 0.1); n1.rotation.y = Math.PI / 2; n1.castShadow = false;
    const n2 = add(new THREE.PlaneGeometry(0.5, 0.5), numMat, -0.835, 0.0, 0.1); n2.rotation.y = -Math.PI / 2; n2.castShadow = false;
  }
  const wheelMeshes = car.wheels.map(w => {
    const steerG = new THREE.Group();
    const spinG = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.wheels.radius, CONFIG.wheels.radius, 0.25, 14), lit({ color: 0x18191b }));
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.26, 6), lit({ color: 0xd8dde2 }));
    rim.rotation.z = Math.PI / 2;
    spinG.add(tyre, rim); steerG.add(spinG); carGroup.add(steerG);
    return { steerG, spinG };
  });
  scene.add(carGroup);

  /* ---------- cockpit interior (third camera) ---------- */
  // Car local axes: +x is the car's LEFT, +y up, +z forward. Left-hand drive, so the driver sits at +x.
  const cockpit = new THREE.Group(); cockpit.visible = false; carGroup.add(cockpit);
  const DRV = 0.37;
  const EYE = new THREE.Vector3(DRV, 0.56, -0.3);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const taperCyl = new THREE.CylinderGeometry(0.72, 1, 1, 10);
  const _Y = new THREE.Vector3(0, 1, 0), _bd = new THREE.Vector3();
  function placeBar(m, a, b, r) {
    _bd.subVectors(b, a); const len = _bd.length() || 1e-4;
    m.position.copy(a).addScaledVector(_bd, 0.5); m.scale.set(r, len, r);
    m.quaternion.setFromUnitVectors(_Y, _bd.multiplyScalar(1 / len));
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let wheelTilt, wheelSpin, handRing, needle, shiftLamp, arms = [];
  {
    const mDash = lit({ color: 0x25282c });
    const mTrim = lit({ color: 0x3a3e44 });
    const mCage = lit({ color: 0xbfc5cc });
    const mPaint = lit({ color: 0xe9ecef });
    const mSuede = lit({ color: 0x1d1e21 });
    const mGlove = lit({ color: 0x17181b });
    const mSuit = lit({ color: 0x1f4fa3 });
    const mCuff = lit({ color: 0xd8342c });
    const mYellow = new THREE.MeshBasicMaterial({ color: 0xffc928 });
    const box = (w, h, d, mat, x, y, z, parent = cockpit) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const bar = (a, b, r, mat, parent = cockpit) => { const m = new THREE.Mesh(unitCyl, mat); placeBar(m, a, b, r); parent.add(m); return m; };

    // dashboard, binnacle, console, doors, pillars, roof
    box(1.64, 0.17, 0.5, mDash, 0, 0.27, 0.52);
    box(1.64, 0.03, 0.06, mTrim, 0, 0.355, 0.28);
    box(0.36, 0.1, 0.14, mDash, DRV, 0.415, 0.37);
    box(0.26, 0.2, 0.9, mDash, 0.0, 0.17, -0.05);
    for (const sx of [1, -1]) {
      box(0.1, 0.05, 1.9, mTrim, sx * 0.83, 0.37, -0.35);
      box(0.05, 0.28, 1.9, mTrim, sx * 0.86, 0.22, -0.35);
      bar(V(sx * 0.75, 0.22, 0.74), V(sx * 0.63, 0.74, 0.3), 0.04, mPaint);          // A-pillar
      bar(V(sx * 0.84, 0.38, -1.0), V(sx * 0.69, 0.76, -1.0), 0.045, mPaint);        // B-pillar
      // roll cage
      bar(V(sx * 0.68, 0.18, 0.6), V(sx * 0.58, 0.72, 0.27), 0.02, mCage);
      bar(V(sx * 0.66, 0.18, -0.95), V(sx * 0.6, 0.73, -0.95), 0.022, mCage);
      bar(V(sx * 0.58, 0.72, 0.27), V(sx * 0.6, 0.73, -0.95), 0.02, mCage);
      bar(V(sx * 0.76, 0.2, 0.52), V(sx * 0.76, 0.44, -0.92), 0.02, mCage);           // door bar
    }
    box(1.32, 0.06, 0.08, mPaint, 0, 0.74, 0.3);
    box(1.36, 0.03, 1.6, mTrim, 0, 0.77, -0.5);
    bar(V(0.58, 0.72, 0.27), V(-0.58, 0.72, 0.27), 0.02, mCage);
    bar(V(0.6, 0.73, -0.95), V(-0.6, 0.73, -0.95), 0.022, mCage);
    bar(V(0.6, 0.73, -0.95), V(-0.66, 0.18, -0.95), 0.02, mCage);                     // diagonal in main hoop

    // floor and the driver's legs reaching for the pedals
    box(1.6, 0.02, 1.7, mDash, 0, 0.222, -0.35);
    for (const lx of [0.09, -0.09]) {
      bar(V(DRV + lx, 0.29, -0.5), V(DRV + lx, 0.33, 0.06), 0.065, mSuit);
      bar(V(DRV + lx, 0.33, 0.06), V(DRV + lx, 0.235, 0.42), 0.05, mSuit);
    }
    // sequential gear lever and handbrake
    bar(V(0.1, 0.27, 0.2), V(0.12, 0.39, 0.13), 0.01, mCage);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mDash); knob.position.set(0.12, 0.395, 0.13); cockpit.add(knob);
    bar(V(0.06, 0.27, -0.2), V(0.1, 0.48, -0.08), 0.012, mCage);

    // tacho
    const tc = document.createElement('canvas'); tc.width = tc.height = 256; const tg = tc.getContext('2d');
    tg.fillStyle = '#0c0e10'; tg.beginPath(); tg.arc(128, 128, 126, 0, 7); tg.fill();
    tg.lineCap = 'butt';
    for (let v = 0; v <= 8000; v += 500) {
      const a = (-135 + 270 * v / 8000) * D2R, major = v % 1000 === 0, red = v >= 7000;
      tg.strokeStyle = red ? '#ff4b3e' : '#e9ecef'; tg.lineWidth = major ? 6 : 3;
      const r1 = major ? 92 : 102;
      tg.beginPath(); tg.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); tg.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); tg.stroke();
      if (major) { tg.fillStyle = red ? '#ff4b3e' : '#e9ecef'; tg.font = '700 30px "Saira Condensed", sans-serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(String(v / 1000), 128 + Math.sin(a) * 70, 128 - Math.cos(a) * 70); }
    }
    tg.fillStyle = '#93a2ad'; tg.font = '600 16px "Saira Condensed", sans-serif'; tg.fillText('x1000 rpm', 128, 190);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.058, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tc) }));
    dial.position.set(DRV, 0.425, 0.298); dial.rotation.y = Math.PI; cockpit.add(dial);
    needle = new THREE.Group(); needle.position.z = 0.002; dial.add(needle);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); nm.position.y = 0.022; needle.add(nm);
    shiftLamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
    shiftLamp.position.set(DRV, 0.472, 0.305); cockpit.add(shiftLamp);

    // steering column + wheel (tilted toward the driver)
    bar(V(DRV, 0.28, 0.44), V(DRV, 0.36, 0.13), 0.025, mDash);
    wheelTilt = new THREE.Group(); wheelTilt.position.set(DRV, 0.36, 0.13); wheelTilt.rotation.x = 0.45; cockpit.add(wheelTilt);
    wheelSpin = new THREE.Group(); wheelTilt.add(wheelSpin);
    wheelSpin.add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.021, 10, 36), mSuede));
    box(0.022, 0.03, 0.046, mYellow, 0, 0.175, 0, wheelSpin);                         // centre marker at 12 o'clock
    box(0.15, 0.034, 0.012, mDash, 0.09, -0.005, 0.02, wheelSpin);
    box(0.15, 0.034, 0.012, mDash, -0.09, -0.005, 0.02, wheelSpin);
    box(0.034, 0.15, 0.012, mDash, 0, -0.09, 0.02, wheelSpin);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 16), mDash); hub.rotation.x = Math.PI / 2; hub.position.z = 0.03; wheelSpin.add(hub);

    // gloved hands on the rim at 9 and 3 o'clock (they stay put past ±110° like a driver shuffling)
    handRing = new THREE.Group(); wheelTilt.add(handRing);
    for (const side of [1, -1]) {            // +1 = left hand (driver's left = +x)
      const hand = new THREE.Group(); hand.position.set(side * 0.175, 0, 0); handRing.add(hand);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mGlove); fist.scale.set(0.042, 0.06, 0.047); fist.position.set(side * 0.01, 0, -0.012); hand.add(fist);
      const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.03), mGlove); knuckles.position.set(side * 0.006, 0.002, 0.025); hand.add(knuckles);
      const thumb = new THREE.Mesh(unitCyl, mGlove); placeBar(thumb, V(side * 0.02, 0.025, -0.03), V(-side * 0.035, 0.035, 0.012), 0.013); hand.add(thumb);
      const anchor = new THREE.Object3D(); anchor.position.set(side * 0.02, -0.01, -0.045); hand.add(anchor);
      const upper = new THREE.Mesh(unitCyl, mSuit), fore = new THREE.Mesh(taperCyl, mSuit), cuff = new THREE.Mesh(unitCyl, mCuff);
      cockpit.add(upper, fore, cuff);
      arms.push({ side, anchor, upper, fore, cuff, shoulder: V(DRV + side * 0.21, 0.29, -0.52) });
    }
    cockpit.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }
  const _hw = new THREE.Vector3(), _el = new THREE.Vector3(), _wr = new THREE.Vector3(), _cf = new THREE.Vector3();
  function updateCockpit() {
    const inside = camMode === 3;
    cockpit.visible = inside;
    for (const m of exteriorCabin) m.visible = !inside;
    if (!inside) return;
    const wheelAngle = car.steer * 7;                       // steering ratio for the visual wheel
    wheelSpin.rotation.z = wheelAngle;
    handRing.rotation.z = clamp(wheelAngle, -1.9, 1.9);
    needle.rotation.z = (135 - 270 * clamp(car.rpm / 8000, 0, 1)) * D2R;
    shiftLamp.material.color.setHex(car.rpm > CONFIG.engine.shiftUpRpm - 300 ? 0xff3322 : 0x3a1010);
    carGroup.updateMatrixWorld(true);
    for (const a of arms) {
      a.anchor.getWorldPosition(_hw); cockpit.worldToLocal(_hw);
      _el.copy(a.shoulder).lerp(_hw, 0.5); _el.x += a.side * 0.1; _el.y -= 0.12;
      _wr.copy(_hw);
      _cf.subVectors(_el, _hw).normalize().multiplyScalar(0.055).add(_hw);
      placeBar(a.upper, a.shoulder, _el, 0.052);
      placeBar(a.fore, _el, _cf, 0.045);
      placeBar(a.cuff, _cf, _wr, 0.036);
    }
  }

