// Full-game flow: clicks through the game the way a player does and checks that every screen leads to the next one.
// menu -> stage + car -> countdown -> driving -> finish screen -> replay -> menu; championship stage 1 -> stage 2 with standings;
// pause / resume / restart / quit; rescue (off the road, flipped, fell); the practice Test Track; no console errors anywhere.
// Runs small (640x360) at Low graphics so that slow test machines still get through the real-time countdown.
// Real clicks and real key presses are used for everything a player does. The probe (tests/lib/probe.js, `flow`) is used only to
// read the game's state and to drive the long stretch of a stage quickly with the autopilot.
'use strict';
const { openGame, patience } = require('./lib/game');

module.exports = async function flowTest({ browser, base, shot: realShot }) {
  const checks = [];
  const T0 = Date.now(), log = m => process.stdout.write(`  flow ${((Date.now() - T0) / 1000).toFixed(0)}s: ${m}\n`);
  const shot = async (page, name) => { try { await Promise.race([realShot(page, name), new Promise((_, r) => setTimeout(() => r(new Error('screenshot timeout')), 15000))]); } catch (e) { /* screenshots are a bonus here */ } };
  let lastAdded = '';
  const add = (name, pass, detail) => { lastAdded = name; checks.push({ name: 'flow: ' + name, pass: !!pass, detail: String(detail) }); };
  const info = page => page.evaluate(() => window.__probe.flow.info());
  const until = async (page, fn, arg, what, ms = 40000) => {            // wait for a game state; never throw, report instead
    try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; }
  };
  const stateIs = (page, st, ms) => until(page, s => window.__probe.flow.info().state === s, st, st, ms);
  const hidden = (page, id) => page.evaluate(i => document.getElementById(i).hidden, id);
  const finishShown = page => until(page, () => !document.getElementById('finishScreen').hidden, null, 'finish screen', 60000);
  const fresh = async (opts = {}) => openGame(browser, base, { probe: true, viewport: { width: 640, height: 360 }, storage: { rallyQualityV2: 'low' }, ...opts });
  const section = async (name, fn) => { log(name); try { await fn(); } catch (e) { add(name + ' ran to the end', false, String(e.message || e).split('\n')[0] + ' (after check: ' + lastAdded + ')'); } };

  await section('menu to finish to replay', async () => {
    const g = await fresh(), page = g.page;
    let i = await info(page);
    add('game opens on the menu', i.state === 'menu' && !(await hidden(page, 'menu')), `state ${i.state}`);
    const cards = await page.locator('.stage-card').count(), chips = await page.locator('#carPick .car-chip').count();
    add('menu lists the stages and both cars', cards >= 5 && chips >= 2, `${cards} stage cards, ${chips} cars`);
    await page.locator('.stage-card').nth(1).click();                                   // SS2
    await page.waitForFunction(() => { const b = document.getElementById('startBtn'); return b && !b.disabled; }, null, { timeout: patience(60000) });
    await page.locator('#carPick .car-chip').nth(1).click();                            // Strada HF
    i = await info(page);
    const lbl = await page.textContent('#stageLbl');
    add('picking a stage and a car sticks', i.stageIdx === 1 && i.carIndex === 1 && /SS2/.test(lbl), `stage ${i.stageIdx} "${lbl}", car ${i.carIndex}`);
    await shot(page, 'flow-menu-picked.png');
    await page.click('#startBtn');
    add('Race button starts the countdown', await stateIs(page, 'countdown', 3000), `menu hidden: ${await hidden(page, 'menu')}`);
    add('countdown ends and the race runs', await stateIs(page, 'running', 60000) && await page.evaluate(() => document.body.classList.contains('race-on')), 'state running, controls on');
    await page.keyboard.down('KeyW');
    await until(page, () => { const f = window.__probe.flow.info(); return f.kmh > 15 && f.raceTime > 1; }, null, 'moving', 60000);
    i = await info(page);
    await page.keyboard.up('KeyW');
    add('driving: car moves and the clock runs', i.kmh > 15 && i.raceTime > 1, `${i.kmh.toFixed(0)} km/h, race time ${i.raceTime.toFixed(1)} s`);
    // drive the rest with the autopilot
    const endState = await page.evaluate(() => window.__probe.flow.botUntil(400));
    add('stage can be driven to the finish', endState === 'finished', `ended in state ${endState}`);
    add('finish screen appears with result and time', await finishShown(page) && /1|2|3|4|5|6|7|8|9/.test(await page.textContent('#resPos')) && /\d:\d\d/.test(await page.textContent('#finalTime')),
      `position "${await page.textContent('#resPos')}", time "${await page.textContent('#finalTime')}"`);
    add('finish screen has a result table', (await page.locator('#resultTable .classif span').count()) > 8, `${await page.locator('#resultTable .classif span').count()} cells`);
    await shot(page, 'flow-finish.png');
    // replay
    await page.click('#replayBtn');
    add('Watch replay starts', await stateIs(page, 'replay', 3000) && !(await hidden(page, 'replayBar')) && await hidden(page, 'finishScreen'), 'replay bar shown');
    await until(page, () => window.__probe.flow.info().replayF > 10, null, 'replay frames', 60000);
    i = await info(page);
    add('replay plays forward', i.replayF > 10, `frame ${i.replayF && i.replayF.toFixed(0)}`);
    await shot(page, 'flow-replay.png');
    await page.evaluate(() => window.__probe.flow.replayToEnd()); await page.waitForTimeout(800);
    await page.keyboard.press('Escape');            // the on-screen Back button is only for touch screens
    add('replay ends and returns to the finish screen', await stateIs(page, 'finished', 3000) && !(await hidden(page, 'finishScreen')) && await hidden(page, 'replayBar'), 'finish screen back, replay bar hidden');
    // race again from the finish screen
    await page.click('#againBtn');
    add('Race again restarts the stage', await stateIs(page, 'countdown', 3000), 'countdown');
    await stateIs(page, 'running', 60000);
    await page.evaluate(() => window.__probe.flow.botUntil(400));
    await finishShown(page);
    await page.click('#menuBtn');
    i = await info(page);
    add('Stage select returns to the menu', i.state === 'menu' && !(await hidden(page, 'menu')) && await hidden(page, 'finishScreen'), `state ${i.state}`);
    // and the menu still works: start again
    await page.click('#startBtn');
    add('a new race can be started after returning to the menu', await stateIs(page, 'countdown', 3000), 'countdown');
    const errs = g.errors(); await g.ctx.close();
    add('no console errors (menu to finish to replay)', errs.length === 0, errs.slice(0, 4).join(' | ') || '0 errors');
  });

  await section('championship', async () => {
    const g = await fresh(), page = g.page;
    await page.click('#champBtn');
    add('championship: starts stage 1 with a countdown', await stateIs(page, 'countdown', 60000), 'countdown');
    let i = await info(page);
    add('championship: stage 1 is SS1 and a championship is active', i.stageIdx === 0 && i.champ && i.champ.idx === 0, `stage ${i.stageIdx}, champ ${JSON.stringify(i.champ)}`);
    await stateIs(page, 'running', 60000);
    const endState = await page.evaluate(() => window.__probe.flow.botUntil(400));
    add('championship: stage 1 finished', endState === 'finished', `ended in state ${endState}`);
    await finishShown(page);
    const nextVisible = !(await hidden(page, 'nextBtn')), againHidden = await hidden(page, 'againBtn');
    const eyebrow = await page.textContent('#resEyebrow'), tableText = await page.textContent('#resultTable');
    add('championship: standings are shown with a Next stage button', nextVisible && againHidden && /Championship standings/.test(tableText) && /Championship/.test(eyebrow),
      `next ${nextVisible}, "${eyebrow}", standings ${/Championship standings/.test(tableText)}`);
    i = await info(page);
    const pts = Object.values(i.champ.points).reduce((a, b) => a + b, 0);
    add('championship: points were awarded', pts > 0 && i.champ.results === 1, `${pts} points handed out, ${i.champ.results} result(s)`);
    await shot(page, 'flow-champ-standings.png');
    await page.click('#nextBtn');
    await until(page, () => { const f = window.__probe.flow.info(); return !f.loading && f.state === 'countdown'; }, null, 'stage 2', 60000);
    i = await info(page);
    const lbl = await page.textContent('#stageLbl');
    add('championship: stage 2 follows', i.stageIdx === 1 && i.state === 'countdown' && i.champ.idx === 1 && /SS2/.test(lbl), `stage ${i.stageIdx} "${lbl}", state ${i.state}, champ idx ${i.champ && i.champ.idx}`);
    await stateIs(page, 'running', 60000);
    i = await info(page);
    add('championship: stage 2 starts running with a fresh clock', i.state === 'running' && i.raceTime < 5 && i.timeLeft > 5, `race time ${i.raceTime.toFixed(1)} s, ${i.timeLeft.toFixed(0)} s left`);
    // Esc in a championship, then quit: championship must end cleanly
    await page.keyboard.press('Escape'); await page.click('#quitBtn');
    i = await info(page);
    add('championship: quitting to the menu ends it', i.state === 'menu' && i.champ === null, `state ${i.state}, champ ${JSON.stringify(i.champ)}`);
    const errs = g.errors(); await g.ctx.close();
    add('no console errors (championship)', errs.length === 0, errs.slice(0, 4).join(' | ') || '0 errors');
  });

  await section('pause and rescue', async () => {
    const g = await fresh(), page = g.page;
    await page.click('#startBtn');
    await stateIs(page, 'running', 60000);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    // pause with Esc, resume with the button
    let before = await info(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    let i = await info(page);
    add('pause: Esc opens the pause menu and stops the game', i.state === 'paused' && !(await hidden(page, 'pauseMenu')), `state ${i.state}`);
    await page.waitForTimeout(1200);
    const frozen = await info(page);
    add('pause: the clock and the car stand still', Math.abs(frozen.raceTime - i.raceTime) < 0.02 && Math.abs(frozen.s - i.s) < 0.1, `race time ${i.raceTime.toFixed(2)} -> ${frozen.raceTime.toFixed(2)} s`);
    await shot(page, 'flow-pause.png');
    await page.click('#resumeBtn');
    await until(page, t => window.__probe.flow.info().raceTime > t + 0.2, frozen.raceTime, 'clock moves', 60000);
    i = await info(page);
    add('pause: Resume continues the race', i.state === 'running' && await hidden(page, 'pauseMenu') && i.raceTime > frozen.raceTime, `state ${i.state}, race time ${frozen.raceTime.toFixed(2)} -> ${i.raceTime.toFixed(2)} s`);
    // Esc twice = pause and resume by key
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    i = await info(page);
    add('pause: Esc again resumes', i.state === 'running' && await hidden(page, 'pauseMenu'), `state ${i.state}`);
    // restart
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.click('#restartBtn');
    await page.waitForTimeout(300);
    i = await info(page);
    add('pause: Restart stage goes back to the start with a countdown', i.state === 'countdown' && i.raceTime === 0 && i.s < 15 && await hidden(page, 'pauseMenu'), `state ${i.state}, race time ${i.raceTime}, ${i.s.toFixed(0)} m along`);
    await stateIs(page, 'running', 60000);
    // quit to menu
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.click('#quitBtn');
    i = await info(page);
    add('pause: Stage select quits to the menu', i.state === 'menu' && !(await hidden(page, 'menu')) && await hidden(page, 'pauseMenu'), `state ${i.state}`);

    // rescue: three kinds of trouble, each one must end with the car on the road and the clock still going
    // (the game clock only moves when frames are drawn, so everything below waits for game time, not wall time)
    await page.click('#startBtn'); await stateIs(page, 'running', 60000);
    await page.evaluate(() => window.__probe.flow.botUntil(100, 120));               // get ~120 m down the road as quickly as possible
    await until(page, () => { const f = window.__probe.flow.info(); return f.lastGoodS > f.s - 5 && f.lastGoodS > 100; }, null, 'game notices the road position', 60000);
    for (const [how, what, viaKey] of [['off', 'off the road (R key)', true], ['flip', 'upside down (R key)', true], ['flip', 'upside down (waiting, automatic)', false], ['drop', 'fell off the edge (automatic)', false]]) {
      const pre = await info(page);
      await page.evaluate(h => window.__probe.flow.wreck(h), how);
      // wait until the game really sees the trouble (it only updates when a frame has run), so a car that was never in trouble cannot pass
      const trouble = await until(page, h => { const f = window.__probe.flow.info(); return h === 'off' ? Math.abs(f.lateral) > f.half + 5 : h === 'flip' ? f.upY < 0.35 : f.y < f.roadY - 5; }, how, 'trouble seen', 30000);
      const bad = await info(page);
      add(`rescue: ${what} -> the trouble is real`, trouble, `${Math.abs(bad.lateral).toFixed(0)} m from the centre, upY ${bad.upY.toFixed(2)}, ${(bad.roadY - bad.y).toFixed(0)} m below the road`);
      if (viaKey) await page.keyboard.press('KeyR');
      const ok = await until(page, () => { const f = window.__probe.flow.info(); return !f.rescuePending && Math.abs(f.lateral) < f.half + 0.5 && f.upY > 0.8; }, null, 'rescued', 90000);
      const t1 = await info(page);
      await until(page, t => window.__probe.flow.info().raceTime > t + 0.5, t1.raceTime, 'clock moves', 60000);
      const t2 = await info(page);
      add(`rescue: ${what} -> back on the road`, ok && t1.state === 'running' && t1.s >= pre.s - 30 && t1.s <= pre.s + 30,
        `before wreck ${pre.s.toFixed(0)} m; wrecked ${Math.abs(bad.lateral).toFixed(0)} m from the centre, upY ${bad.upY.toFixed(2)}; after: ${t1.s.toFixed(0)} m, ${Math.abs(t1.lateral).toFixed(1)} m from the centre, upY ${t1.upY.toFixed(2)}, state ${t1.state}`);
      add(`rescue: ${what} -> clock keeps going`, t2.raceTime > t1.raceTime + 0.4 && t2.timeLeft < t1.timeLeft && t2.state === 'running', `race time ${t1.raceTime.toFixed(1)} -> ${t2.raceTime.toFixed(1)} s, time left ${t1.timeLeft.toFixed(1)} -> ${t2.timeLeft.toFixed(1)} s`);
      await until(page, () => { const f = window.__probe.flow.info(); return f.lastGoodS > f.s - 5; }, null, 'settled', 30000);
    }
    const errs = g.errors(); await g.ctx.close();
    add('no console errors (pause and rescue)', errs.length === 0, errs.slice(0, 4).join(' | ') || '0 errors');
  });

  await section('test track', async () => {
    const g = await fresh(), page = g.page;
    const n = await page.locator('.stage-card').count();
    await page.locator('.stage-card').nth(n - 1).click();
    await page.waitForFunction(() => { const b = document.getElementById('startBtn'); return b && !b.disabled; }, null, { timeout: patience(60000) });
    let i = await info(page);
    add('Test Track: can be picked from the menu', i.practice, `stage "${i.stageName}"`);
    await page.click('#startBtn');
    add('Test Track: countdown and driving start', await stateIs(page, 'countdown', 3000) && await stateIs(page, 'running', 60000), 'running');
    await page.keyboard.down('KeyW'); await until(page, () => window.__probe.flow.info().kmh > 20, null, 'moving', 60000); i = await info(page); await page.keyboard.up('KeyW');
    add('Test Track: the car drives', i.kmh > 20, `${i.kmh.toFixed(0)} km/h`);
    await shot(page, 'flow-testtrack.png');
    await page.keyboard.press('Escape'); await page.click('#quitBtn');
    i = await info(page);
    add('Test Track: back to the menu', i.state === 'menu', `state ${i.state}`);
    const errs = g.errors(); await g.ctx.close();
    add('no console errors (Test Track)', errs.length === 0, errs.slice(0, 4).join(' | ') || '0 errors');
  });
  return checks;
};
