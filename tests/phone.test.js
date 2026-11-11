// (e) Real-phone checks on the REAL page (not the skid pad): an emulated Android phone (touch, 800x360 landscape, then portrait),
// synthetic sensor events (deviceorientation-style gravity readings sent as `devicemotion`, the event the game listens to),
// and real multi-touch through Chrome's DevTools protocol.
//  1 tilt   : countdown re-centre, small tilt -> small steer, full tilt -> full lock, direction, both landscape directions and
//             the portrait angle, phone upright and leaned back, "tilt reversed", hand-shake jitter, no sensor at all.
//  2 touch  : 3 fingers at once, release/cancel leave nothing stuck, thumb rolling, rotating the phone mid-race.
//  3 auto gas: a brake tap and the handbrake lift the gas (the car rotates), the gas comes back.
//  4 frame time: NOT tested. Headless Chrome has no GPU (software rendering), so milliseconds per frame say nothing about a phone.
// The physics are stepped synchronously inside the page (probe.phone.step), so results repeat exactly and run fast.
// All numbers: tests/expected.json -> phone.
'use strict';
const { openGame } = require('./lib/game');

// ---- runs inside the page ----
const pageHelpers = () => {
  window.__ang = 90;
  const def = (o, k) => { try { Object.defineProperty(o, 'angle', { get: () => window.__ang, configurable: true }); } catch (e) { /* ignore */ } };
  try { def(screen.orientation); } catch (e) { /* ignore */ }
  Object.defineProperty(window, 'orientation', { get: () => window.__ang, configurable: true });
  // gravity reading (what a phone's accelerometer reports) for: wheel = degrees turned like a steering wheel (+ = right),
  // pitch = degrees the top is leaned back, angle = screen rotation. Inverse of the game's own screen mapping.
  window.__pose = (wheel, pitch, angle) => {
    const g = 9.81, w = wheel * Math.PI / 180, p = pitch * Math.PI / 180;
    const sx = -g * Math.cos(p) * Math.sin(w), sy = g * Math.cos(p) * Math.cos(w), sz = g * Math.sin(p);
    let x, y;
    if (angle === 90) { x = sy; y = -sx; } else if (angle === 270) { x = -sy; y = sx; } else if (angle === 180) { x = -sx; y = -sy; } else { x = sx; y = sy; }
    window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z: sz } }));
  };
};
const scenario = spec => {
  const P = window.__probe.phone, S = { angle: 90, pitch: 0, rest: 0, wheel: 0, jitter: 0, seconds: 3, kmh: 60, ...spec };
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  window.__ang = S.angle;
  P.start();                                                  // state 'countdown'
  for (let i = 0; i < 240; i++) { window.__pose(S.rest, S.pitch, S.angle); P.step(2); }   // phone held at its own resting angle during the countdown
  const afterCountdown = P.read();
  P.go(); P.resetCar(S.kmh);
  const steer = [], beta = [], head = [], h0 = P.read().heading;
  for (let i = 0; i < Math.round(S.seconds * 60); i++) {
    window.__pose(S.rest + S.wheel + S.jitter * rnd(), S.pitch, S.angle); P.step(2);
    const r = P.read(); steer.push(r.steer); beta.push(r.beta); head.push(r.heading);
  }
  const tail = a => a.slice(Math.floor(a.length / 2)), mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const unwrap = d => ((d + 540) % 360) - 180;
  return { tiltDegAfterCountdown: afterCountdown.tiltDeg, state: afterCountdown.state, steerEnd: mean(tail(steer)), steerMaxAbs: Math.max(...steer.map(Math.abs)),
    steerRange: Math.max(...tail(steer)) - Math.min(...tail(steer)), slideRange: Math.max(...tail(beta)) - Math.min(...tail(beta)),
    headingTurn: unwrap(head[head.length - 1] - h0), maxSlide: Math.max(...beta.map(Math.abs)) };
};
const autoGasScenario = spec => {
  const P = window.__probe.phone, S = { pad: null, ...spec };
  window.__ang = 90; P.start(); P.step(10); P.go(); P.resetCar(S.kmh);
  P.setKeys({ right: true }); P.step(180);                       // 1.5 s holding right on auto gas: settle into the slide
  const before = P.read(), b0 = before.heading;
  const pad = S.pad; if (pad) P.setKeys({ [pad]: true });
  let minGas = 9, minGasAt = -1, peak = 0;
  const n = Math.round(S.holdS * 120);
  for (let i = 0; i < n; i++) { P.step(1); minGas = Math.min(minGas, P.read().throttle); }
  if (pad) P.setKeys({ [pad]: false });
  for (let i = 0; i < 180; i++) { P.step(1); const r = P.read(); minGas = Math.min(minGas, r.throttle); peak = Math.max(peak, Math.abs(r.beta)); if (i === 0) minGasAt = r.throttle; }
  const after = P.read(), unwrap = d => ((d + 540) % 360) - 180;
  P.setKeys({ right: false });
  return { slideBefore: Math.abs(before.beta), peak, turn: unwrap(after.heading - b0), minGas, gasAtEnd: after.throttle, kmhEnd: after.kmh };
};

module.exports = async function phoneTest({ browser, base, expected, shot }) {
  const X = expected.phone, V = expected.mobile.viewport, checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
  const f = (v, d = 2) => (+v).toFixed(d);
  const phoneOpts = storage => ({ probe: true, viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storage });
  const open = async storage => { const g = await openGame(browser, base, phoneOpts(storage)); await g.page.evaluate(pageHelpers); return g; };

  // One page for everything (loading the stage is the slow part). Order matters: no sensor events are sent until the "no sensor" checks are done.
  const g = await open({ rallyTilt: '1' });
  const run = (g, spec) => g.page.evaluate(scenario, spec);
  const clickId = id => g.page.evaluate(i => document.getElementById(i).click(), id);

  // ================= 1c. NO SENSOR (first: the page has not had a single sensor event yet) =================
  const sense = await g.page.evaluate(() => { const p = window.__probe.phone.read(); return { touch: p.isTouch, mode: p.tiltMode, cls: document.body.className }; });
  add('phone: page sees a touch phone with tilt steering on', sense.touch && sense.mode === 1, `touch ${sense.touch}, tilt mode ${sense.mode}, body "${sense.cls}"`);
  const nos = await g.page.evaluate(() => {
    const P = window.__probe.phone; P.start(); P.step(30); P.go(); P.step(240);
    const r = P.read(); return { steer: r.steer, tiltDeg: r.tiltDeg, state: r.state };
  });
  add('no sensor: tilt mode with no sensor events keeps steering centred and the game running, no errors', Math.abs(nos.steer) < 0.001 && nos.state === 'running' && g.errors().length === 0,
    `steering ${f(nos.steer, 3)}, state ${nos.state}, errors ${g.errors().length}`);

  // ================= 1. TILT (normal) =================
  // re-centre: phone held 8° off level and leaned back 30° during the countdown -> centre follows, steering 0 straight after GO
  const rc = await run(g, { rest: 8, pitch: 30, wheel: 0, seconds: 2 });
  add(`tilt: countdown re-centres a phone held 8° off level and leaned back (|tilt| ≤ ${X.recentreMaxDeg}° at GO, steering 0)`,
    Math.abs(rc.tiltDegAfterCountdown) <= X.recentreMaxDeg && rc.steerMaxAbs < 0.001, `tilt at GO ${f(rc.tiltDegAfterCountdown)}°, biggest steering after ${f(rc.steerMaxAbs, 3)}`);
  const rcSmall = await run(g, { rest: 8, pitch: 0, wheel: 0, seconds: 1 });
  add(`tilt: re-centre also works upright (|tilt| ≤ ${X.recentreMaxDeg}° at GO)`, Math.abs(rcSmall.tiltDegAfterCountdown) <= X.recentreMaxDeg, `tilt at GO ${f(rcSmall.tiltDegAfterCountdown)}°`);

  // small / full tilt, both directions, both landscape angles + portrait angle, upright and leaned back
  const rows = [];
  for (const angle of [90, 270, 0]) for (const pitch of [0, 35]) for (const sign of [1, -1]) {
    for (const [label, wheel] of [['small', X.smallTiltDeg], ['full', X.fullTiltDeg]]) {
      const r = await run(g, { angle, pitch, wheel: sign * wheel, seconds: 1.2 });
      rows.push({ angle, pitch, sign, label, steer: r.steerEnd, turn: r.headingTurn });
    }
  }
  const nm = r => `${r.angle}°/${r.pitch}°lean/${r.sign > 0 ? 'right' : 'left'}/${r.label}`;
  const small = rows.filter(r => r.label === 'small'), full = rows.filter(r => r.label === 'full');
  const smallBad = small.filter(r => !(Math.sign(r.steer) === r.sign && Math.abs(r.steer) >= X.smallSteerMin && Math.abs(r.steer) <= X.smallSteerMax));
  add(`tilt: a small tilt (${X.smallTiltDeg}°) gives a small steer (${X.smallSteerMin}–${X.smallSteerMax}) the right way, every screen angle and lean`, smallBad.length === 0,
    smallBad.length ? 'wrong: ' + smallBad.map(r => `${nm(r)} ${f(r.steer)}`).join(', ') : `${small.length} poses, steering ${f(Math.min(...small.map(r => Math.abs(r.steer))))}–${f(Math.max(...small.map(r => Math.abs(r.steer))))}`);
  const fullBad = full.filter(r => !(Math.sign(r.steer) === r.sign && Math.abs(r.steer) >= X.fullSteerMin));
  add(`tilt: a full tilt (${X.fullTiltDeg}°) gives full lock (≥ ${X.fullSteerMin}) the right way, every screen angle and lean`, fullBad.length === 0,
    fullBad.length ? 'wrong: ' + fullBad.map(r => `${nm(r)} ${f(r.steer)}`).join(', ') : `${full.length} poses, steering ${f(Math.min(...full.map(r => Math.abs(r.steer))))}+`);
  const turnBad = full.filter(r => Math.sign(r.turn) !== -r.sign);   // heading angle grows towards the left, so a right turn makes it smaller
  add('tilt: tilting right turns the car right and tilting left turns it left (car heading, not just the steering number)', turnBad.length === 0,
    turnBad.length ? 'wrong: ' + turnBad.map(r => `${nm(r)} turned ${f(r.turn, 0)}°`).join(', ') : `${full.length} poses, car turned ${f(Math.min(...full.map(r => Math.abs(r.turn))), 0)}° or more the right way`);
  // dead zone: just under tiltDead does nothing
  const dz = await run(g, { wheel: X.deadZoneTiltDeg, pitch: 20, seconds: 1.2 });
  add(`tilt: ${X.deadZoneTiltDeg}° (inside the dead zone) gives no steering`, dz.steerMaxAbs < 0.001, `biggest steering ${f(dz.steerMaxAbs, 3)}`);

  // jitter: ±J° hand shake, phone leaned back, no tilt -> car must not wobble; and with a part tilt the slide stays steady
  const calm = await run(g, { pitch: 30, jitter: X.jitterDeg, seconds: 4 });
  const calmRef = await run(g, { pitch: 30, jitter: 0, seconds: 4 });
  add(`tilt: ±${X.jitterDeg}° hand shake on a straight does not steer (steering ≤ ${X.jitterMaxSteer}, heading drift ≤ ${X.jitterMaxHeadingDeg}°)`,
    calm.steerMaxAbs <= X.jitterMaxSteer && Math.abs(calm.headingTurn) <= X.jitterMaxHeadingDeg,
    `biggest steering ${f(calm.steerMaxAbs, 3)}, heading drift ${f(calm.headingTurn, 2)}° (no shake: ${f(calmRef.headingTurn, 2)}°)`);
  const wob = await run(g, { pitch: 30, wheel: X.jitterPartTiltDeg, jitter: X.jitterDeg, seconds: 3, kmh: X.jitterKmh });
  const wobRef = await run(g, { pitch: 30, wheel: X.jitterPartTiltDeg, jitter: 0, seconds: 3, kmh: X.jitterKmh });
  const extra = wob.slideRange - wobRef.slideRange;
  add(`tilt: part tilt (${X.jitterPartTiltDeg}°) with ±${X.jitterDeg}° shake: steering ± ≤ ${X.jitterMaxSteerRange}, slide wobble no more than ${X.jitterMaxSlideRangeDeg}° above the same run without shake`,
    wob.steerRange <= X.jitterMaxSteerRange && extra <= X.jitterMaxSlideRangeDeg,
    `steering varies by ${f(wob.steerRange, 3)}, slide varies by ${f(wob.slideRange, 2)}° (no shake ${f(wobRef.slideRange, 2)}°)`);

  // ================= 1b. TILT REVERSED (press the Steering button once: Tilt -> Tilt reversed) =================
  await clickId('tiltBtn2');
  const rl = await g.page.evaluate(() => document.getElementById('tiltBtn2').textContent);
  const rev = [];
  for (const sign of [1, -1]) { const r = await run(g, { angle: 90, wheel: sign * X.fullTiltDeg, seconds: 1.2 }); rev.push({ sign, steer: r.steerEnd, turn: r.headingTurn }); }
  add('tilt reversed: tilting right steers left and tilting left steers right', rl === 'Steering: Tilt (reversed)' && rev.every(r => Math.sign(r.steer) === -r.sign && Math.abs(r.steer) >= X.fullSteerMin && Math.sign(r.turn) === r.sign),
    `button says "${rl}"; ` + rev.map(r => `tilt ${r.sign > 0 ? 'right' : 'left'} -> steering ${f(r.steer)}, turned ${f(r.turn, 0)}°`).join('; '));
  const rrc = await run(g, { rest: -8, pitch: 25, seconds: 1 });
  add('tilt reversed: countdown re-centre still gives steering 0', Math.abs(rrc.tiltDegAfterCountdown) <= X.recentreMaxDeg && rrc.steerMaxAbs < 0.001, `tilt at GO ${f(rrc.tiltDegAfterCountdown)}°`);
  // one more press = back to Buttons: the steer buttons must come back
  await clickId('tiltBtn2');
  const back0 = await g.page.evaluate(() => { const b = document.querySelector('.tc-steer'); return { label: document.getElementById('tiltBtn2').textContent, mode: window.__probe.phone.read().tiltMode, cls: document.body.className }; });
  add('tilt: pressing the Steering button again goes back to Buttons', back0.mode === 0 && back0.label === 'Steering: Buttons' && !/\btilt\b/.test(back0.cls), `label "${back0.label}", body "${back0.cls}"`);

  // ================= 2. TOUCH =================
  const page = g.page, cdp = await g.ctx.newCDPSession(page);
  await page.evaluate(() => { const P = window.__probe.phone; P.start(); P.step(5); P.go(); });
  await page.waitForTimeout(600);                         // let a frame show the on-screen controls
  const centre = sel => page.evaluate(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
  const pts = {};
  for (const [k, sel] of [['left', '.tc-steer[data-key=left]'], ['right', '.tc-steer[data-key=right]'], ['hb', '.tc-hb'], ['down', '.tc-brake']]) pts[k] = await centre(sel);
  const fingers = new Map();                              // id -> point
  const send = async type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchCancel' ? [] : [...fingers].map(([id, p]) => ({ x: p.x, y: p.y, id })) });
  const down = async (id, key) => { fingers.set(id, pts[key]); await send('touchStart'); };
  const up = async id => { const p = fingers.get(id); fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] }); };
  const moveTo = async (id, p) => { fingers.set(id, p); await send('touchMove'); };
  const keys = async () => (await page.evaluate(() => window.__probe.phone.read().keys));
  const on = k => Object.entries(k).filter(([, v]) => v).map(([n]) => n).sort().join('+') || 'none';

  const lead = await keys();
  add('touch: nothing pressed at the start of the race', on(lead) === 'none', `pressed: ${on(lead)}`);
  await down(1, 'right'); const k1 = await keys();
  add('touch: the right steer button steers right', on(k1) === 'right', `pressed: ${on(k1)}`);
  await down(2, 'hb'); await down(3, 'down'); const k3 = await keys();
  add('touch: steer + handbrake + brake with three fingers at once all register', on(k3) === 'down+hb+right', `pressed: ${on(k3)}`);
  await up(2); const k4 = await keys();
  add('touch: lifting one finger releases only that button', on(k4) === 'down+right', `pressed: ${on(k4)}`);
  await moveTo(1, pts.left); const k5 = await keys();
  add('touch: rolling the thumb from right to left switches steering without lifting', on(k5) === 'down+left', `pressed: ${on(k5)}`);
  await up(1); await up(3); const k6 = await keys();
  add('touch: every finger up -> nothing stays pressed', on(k6) === 'none', `pressed: ${on(k6)}`);
  await down(4, 'left'); await down(5, 'hb'); await send('touchCancel'); fingers.clear();
  const k7 = await keys();
  add('touch: a cancelled touch (system gesture, notification) leaves nothing stuck', on(k7) === 'none', `pressed: ${on(k7)}`);
  // button looks: pressed buttons light up and let go
  await down(6, 'right'); const lit = await page.evaluate(() => document.querySelector('.tc-steer[data-key=right]').classList.contains('on'));
  await up(6); const unlit = await page.evaluate(() => !document.querySelector('.tc-steer[data-key=right]').classList.contains('on'));
  add('touch: a pressed button lights up and goes dark again when released', lit && unlit, `lit while held: ${lit}, dark after: ${unlit}`);
  // in the real loop, a touch makes the car react (frames run in real time)
  await down(7, 'right'); await page.waitForTimeout(900); const hh = await page.evaluate(() => window.__probe.phone.read()); await up(7);
  add('touch: holding the right button for a moment really steers the car right', hh.steer > 0.5, `steering ${f(hh.steer)}`);

  // rotating the phone mid-race with a finger down
  await down(8, 'right'); await page.waitForTimeout(150);
  await page.setViewportSize({ width: V.height, height: V.width });
  await page.waitForTimeout(500);
  const portrait = await page.evaluate(() => { const r = document.getElementById('rotate'); return { shown: getComputedStyle(r).display !== 'none', state: window.__probe.phone.read().state }; });
  await shot(page, 'phone-portrait.png');
  add('rotate: in portrait the "turn your phone sideways" cover shows and the race is not lost', portrait.shown && /running|paused|countdown/.test(portrait.state), `cover shown: ${portrait.shown}, game state: ${portrait.state}`);
  fingers.clear(); await send('touchCancel');       // the finger is gone after rotating
  await page.setViewportSize({ width: V.width, height: V.height });
  await page.waitForTimeout(700);
  const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, ok: q.width >= 40 && q.height >= 40 && q.left >= -1 && q.top >= -1 && q.right <= innerWidth + 1 && q.bottom <= innerHeight + 1 }; }, sel);
  const cover = await page.evaluate(() => ({ hidden: getComputedStyle(document.getElementById('rotate')).display === 'none', state: window.__probe.phone.read().state, stuck: Object.values(window.__probe.phone.read().keys).some(Boolean) }));
  const resume = await rect('#resumeBtn');
  await shot(page, 'phone-after-rotate.png');
  add('rotate: back in landscape the cover is gone, the game waits in pause, and the Resume button is on screen and big enough (nothing stuck)',
    cover.hidden && cover.state === 'paused' && resume && resume.ok && !cover.stuck, `cover hidden ${cover.hidden}, state ${cover.state}, Resume ok ${resume && resume.ok}, key stuck ${cover.stuck}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: resume.x, y: resume.y, id: 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: resume.x, y: resume.y, id: 20 }] });
  await page.waitForTimeout(700);
  const res = await page.evaluate(() => window.__probe.phone.read().state);
  const ctl = []; for (const [k, sel] of [['left', '.tc-steer[data-key=left]'], ['right', '.tc-steer[data-key=right]'], ['hb', '.tc-hb'], ['down', '.tc-brake']]) { const r = await rect(sel); ctl.push({ k, ok: r && r.ok }); if (r) pts[k] = r; }
  add('rotate: tapping Resume brings the race back with all touch controls on screen and big enough', res === 'running' && ctl.every(c => c.ok), `state ${res}, bad controls: ${ctl.filter(c => !c.ok).map(c => c.k).join(', ') || 'none'}`);
  await down(9, 'right'); await down(10, 'hb'); const k8 = await keys(); await up(9); await up(10);
  add('rotate: controls still respond after turning the phone back', on(k8) === 'hb+right', `pressed: ${on(k8)}`);

  // ================= 3. AUTO GAS: brake tap and handbrake give the lift (auto gas is on by default) =================
  const AG = X.autoGas, ag = {};
  ag.none = await page.evaluate(autoGasScenario, { kmh: AG.kmh, holdS: 0.15, pad: null });
  ag.tap = await page.evaluate(autoGasScenario, { kmh: AG.kmh, holdS: 0.15, pad: 'down' });
  ag.hb = await page.evaluate(autoGasScenario, { kmh: AG.kmh, holdS: 0.3, pad: 'hb' });
  add(`auto gas: with no pedal touched the gas stays down (never below ${AG.noLiftMinGas})`, ag.none.minGas >= AG.noLiftMinGas, `lowest gas ${f(ag.none.minGas)}`);
  add(`auto gas: a brake tap lifts the gas (below ${AG.liftMaxGas}) and the car rotates (≥ ${AG.tapExtraTurnDeg}° more than without the tap)`,
    ag.tap.minGas <= AG.liftMaxGas && Math.abs(ag.tap.turn) >= Math.abs(ag.none.turn) + AG.tapExtraTurnDeg,
    `lowest gas ${f(ag.tap.minGas)}, turned ${f(ag.tap.turn, 0)}° vs ${f(ag.none.turn, 0)}° without, peak slide ${f(ag.tap.peak, 0)}° vs ${f(ag.none.peak, 0)}°`);
  add(`auto gas: a handbrake tap lifts the gas (below ${AG.liftMaxGas}) and the car rotates (≥ ${AG.hbExtraTurnDeg}° more than without)`,
    ag.hb.minGas <= AG.liftMaxGas && Math.abs(ag.hb.turn) >= Math.abs(ag.none.turn) + AG.hbExtraTurnDeg,
    `lowest gas ${f(ag.hb.minGas)}, turned ${f(ag.hb.turn, 0)}° vs ${f(ag.none.turn, 0)}° without, peak slide ${f(ag.hb.peak, 0)}°`);
  add(`auto gas: the gas comes back after the lift (≥ ${AG.backMinGas} 1.5 s later), car not spun (peak slide ≤ ${AG.maxSlideDeg}°)`,
    ag.tap.gasAtEnd >= AG.backMinGas && ag.hb.gasAtEnd >= AG.backMinGas && ag.tap.peak <= AG.maxSlideDeg && ag.hb.peak <= AG.maxSlideDeg,
    `gas after tap ${f(ag.tap.gasAtEnd)}, after handbrake ${f(ag.hb.gasAtEnd)}, peaks ${f(ag.tap.peak, 0)}° / ${f(ag.hb.peak, 0)}°`);

  // auto gas OFF (press the Auto gas button): GAS button appears; gas + steer + handbrake at once
  await clickId('autoGasBtn2');
  await page.evaluate(() => { const P = window.__probe.phone; P.start(); P.step(5); P.go(); });
  await page.waitForTimeout(600);
  const pts2 = {}; for (const [k, sel] of [['left', '.tc-steer[data-key=left]'], ['hb', '.tc-hb'], ['up', '.tc-gas']]) pts2[k] = await rect(sel);
  const gasShown = !!pts2.up && pts2.up.ok;
  if (gasShown) {
    const tp = list => list.map(([id, k]) => ({ x: pts2[k].x, y: pts2[k].y, id }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[1, 'left']]) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[1, 'left'], [2, 'up']]) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[1, 'left'], [2, 'up'], [3, 'hb']]) });
  }
  const kk = await page.evaluate(() => window.__probe.phone.read());
  add('touch (auto gas off): GAS button is there, and gas + steer + handbrake at once all register', gasShown && on(kk.keys) === 'hb+left+up' && kk.autoGas === false, `GAS on screen ${gasShown}, pressed: ${on(kk.keys)}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const kk2 = await keys();
  add('touch (auto gas off): all fingers up -> nothing stuck', on(kk2) === 'none', `pressed: ${on(kk2)}`);

  // really no DeviceMotionEvent at all (old / desktop browsers): pressing the Steering button must not throw
  await page.evaluate(() => { try { delete window.DeviceMotionEvent; } catch (e) { /* ignore */ } });
  const cyc = await page.evaluate(() => { document.getElementById('tiltBtn2').click(); document.getElementById('tiltBtn2').click(); return document.getElementById('tiltBtn2').textContent; });
  add('no sensor: pressing the Steering button on a browser without DeviceMotionEvent raises no error', g.errors().length === 0, `label "${cyc}", errors ${g.errors().length}`);
  add('phone: no console errors in the whole phone test', g.errors().length === 0, g.errors().length ? g.errors().slice(0, 3).join(' | ') : '0 errors');
  await g.ctx.close();

  // ================= 4. FRAME TIME =================
  add('frame time on a phone: not tested (headless Chrome has no GPU, so frame times would not say anything about a phone)', true, 'skipped on purpose; check on a real phone');
  return checks;
};
