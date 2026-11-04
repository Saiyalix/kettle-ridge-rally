# Kettle Ridge Rally: guide for the development agent

Arcade rally game in the spirit of 90s arcade rally games, with PS2-era graphics, running in the browser
(keyboard on desktop, touch on phones). Hosted on GitHub Pages from `main`: **whatever is on `main` is live.**

## The owner's brief (decisions already made, do not re-ask)

- **Feel:** arcade. Forgiving, easy to drift, hard to spin. Never punish a held steering key with a spin.
- **Targets:** runs in a web browser. 60 fps on desktop, 30 fps or better on a mid-range phone.
- **Current focus:** 1) handling and physics, 2) graphics and performance.
- **three.js:** currently r128. Upgrading is approved *if it makes the game better*. Do it as its own pull request,
  with before/after screenshots and playtest numbers, never mixed with other work.
- **Workflow:** the owner gives tasks in chat sessions. You work on a branch and open a pull request; the owner
  plays it and merges. Never push to `main`.
- The owner is not a programmer. Explain results in plain language: what changed, how it feels, the numbers.

## Hard rules

1. **No build step.** The game must keep working by opening `index.html` / GitHub Pages. Plain JS (ES modules are fine).
   `package.json` exists only for the playtest; the game must never import from `node_modules`.
2. **Phones must keep working:** touch controls, landscape layout, safe areas, the low-quality path (`quality === 'low'`).
3. **Run the playtest before every commit** that touches the game (see below) and paste its summary into the PR.
4. **One topic per pull request.** Refactors change no behaviour: the handling numbers must match the baseline exactly.
5. Original game only: no names, art, music or tracks from existing games.
6. Keep `CONFIG` as the single home for tunable numbers, with a comment on what each does and which way is "more".
7. Update `tools/baseline.json` (`npm run baseline`) only in a PR whose purpose is to change those numbers, and say so.

## Testing: `tools/playtest.js`

```bash
npm install                    # once: fetches three.js 0.128.0 for the test browser (CDNs may be blocked)
node tools/playtest.js --quick # ~1 min: handling sims on all stages + one desktop screenshot
node tools/playtest.js         # ~4 min: + real-time desktop and phone runs, screenshots of every stage
node tools/playtest.js --save-baseline   # after an intended change, to record new reference numbers
```

Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions; locally `npm i -g playwright && npx playwright install chromium`).

Output: `tools/results/summary.md`, `latest.json` and screenshots (`desktop-stageN.png`, `phone-stageN.png`, menus).
**Look at the screenshots** after visual changes; a passing run can still look wrong.

What the numbers mean:
- **Handling:** an autopilot (`TEST.botKeys` in index.html) drives every stage at the fixed 120 Hz physics rate.
  Deterministic: same code, same result to the hundredth. Stage time, top speed, time off road, drift time,
  average slide angle, spins, rescues. The bot is intentionally dumb and fixed; never tune the bot to make
  numbers look better. Change the bot only in its own PR, and re-save the baseline there.
- **Performance:** "work ms" is CPU time per frame. Phone profile = CPU slowed 4x, budget 25 ms; desktop budget 8 ms.
  The fps column is meaningless in a container without a GPU (software rendering). Real fps: F1 debug overlay
  in a real browser.
- Fails (exit 1) on any page error or a stage the bot cannot finish. Warnings flag changes vs `tools/baseline.json`.

The test hook (`window.__rally`) only exists with `?test` in the URL. Keep it that way, and keep it working
when you change the code it touches (`physicsStep`, `startStage`, `loadStage`, `goMenu`, `state`, `car`, `P`, `curvS`).

## Code map (`index.html`)

Everything is in one file today (planned split below). Search for these names; line numbers drift.

| Area | Where |
|---|---|
| CSS / HUD layout | `<style>` at the top; colours are tokens on `:root` |
| All tunables | `const CONFIG` (car, suspension, tyre, engine, drivetrain, brakes, steering, **`arcade`**, cars, surfaces, camera) |
| Stages | `const STAGES` (segments, surfaces, checkpoints, clock `timeStart`/`timeExt`, `refTime` for rivals) + `forestHeight` / `rockNoise` / `japanHeight` |
| Track & terrain | `buildTrack`, `buildTerrain`, `makeWorld` (surface and ground queries), `paceNote` |
| Car physics | `class Car` → `step()`. `CONFIG.model === 'arcade'` path is the live one (`arcadeForces`); the tyre-sim path is kept but unused |
| Collisions | `collideCar`, `cliffBarriers`, `collideObstacles`, `hashObstacles` |
| Everything else | inside `boot()`: textures, scenery per theme (`sceneryForest/Alpine/Japan`), `trackside`, `loadStage`, car model + livery, cockpit, particles, rivals (`simulateRival`, `setupRivals`, `updateRivals`), audio (`initAudio`, `updateAudio`, synthesized, no files), input (`KEYMAP`, touch pad), game flow (`startStage`, `finishStage`, `gameOver`, championship), replay, debug overlay (F1), `physicsStep`, camera, `updateVisuals`, `renderFrame` (post-processing), `frame()` main loop |

Handling knobs, arcade model (`CONFIG.arcade`):
- Grip / cornering: `surfaces.*.maxG`, `gripUse`. Top speed: `topSpeed`, `surfaces.*.top`. Acceleration: `accel`.
- Drift: `drift.*` (`minSpeed` to start, `angle`, `grip` and `wideArc` for the arc, `release`, `drag`).
- Spin protection: `CONFIG.car.stability`, `stabilityAngle`; rotation: `yawResponse`, `yawAccelMax`, `alignRate`.
- Steering feel: `steerAttackSlow/Fast`, `steerReturn`, `steerReverse`, `minRadius`.
- Jumps: `airFloat`, `airLevel`, `airAlign`. Per-car character: `CONFIG.cars[].accel/top/grip/drift/turn`.

## Baseline (2026-11-04, three.js r128, before any agent changes)

Autopilot stage times: Kettle Ridge 91.51 s, Vulture Ledge 88.73 s, Sakura Touge 87.93 s. 0 spins, 0 rescues.
CPU work per frame, phone profile: 19 / 14 / 27 ms. **Sakura Touge (neon town) is over the 25 ms phone budget** → first performance target.

## Plan (update this list as work lands)

1. [x] Playtest harness + baseline + this file.
2. [ ] Split `index.html` into ES modules without behaviour change (`src/config.js`, `stages.js`, `track.js`,
       `car.js`, `scenery.js`, `rivals.js`, `audio.js`, `hud.js`, `main.js`). Handling numbers must match the baseline exactly.
       Do it in a few steps, running the quick playtest after each step.
3. [ ] Performance: Sakura Touge on phone under budget (draw calls, instancing, cheaper post-processing on low quality).
4. [ ] Handling: more forgiving and easier drifts, judged by the owner playing and by the playtest numbers
       (more drift time, no spins, no extra off-road time).
5. [ ] Evaluate three.js upgrade (r128 → current): needs ES-module import map, colour-management and light-intensity
       changes (r152/r155), `Geometry` removals. Only ship if it looks better or runs faster on the phone profile.

## Working routine

1. Read the task; if it's unclear in a way that changes what you build, ask one short question.
2. Branch from latest `main` (`git fetch origin main`), named after the task.
3. Make the change. Keep diffs focused.
4. `node tools/playtest.js` (quick for small changes, full before the PR). Read the summary, look at the screenshots.
5. Commit with a clear message, push, open a PR: what and why, how it should feel, playtest summary, screenshots if visual,
   and "how to test by hand" (which stage, what to try).
6. Tell the owner in plain words what to play to judge it.
