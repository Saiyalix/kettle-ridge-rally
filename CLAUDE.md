# Kettle Ridge Rally: studio rulebook

Every department (subagent) follows this file. If a department file and this file disagree, this file wins.

## The game

- 3D arcade rally game in the browser. One self-contained file: `index.html` (~256 KB). three.js r128 from cdnjs. No build step.
- Live on GitHub Pages from the `main` branch root: https://saiyalix.github.io/kettle-ridge-rally/
  **Whatever lands on `main` is live for players.**
- 3 stages (SS1 Kettle Ridge, SS2 Vulture Ledge, SS3 Sakura Touge), 2 cars (Kestrel GT4, Strada HF),
  surfaces tarmac / gravel / dirt / snow / grass, co-driver pace notes, replays, rescue/respawn,
  touch controls for Android (auto gas, tilt steering, on-screen buttons).
- Physics at a fixed 120 Hz with render interpolation. Driving uses the arcade model (`CONFIG.arcade`, `Car.arcadeForces`).

## The owner

- Not a developer. Uses only the browser: GitHub web, claude.ai/code, the GitHub Pages link. **Cannot install or run
  anything locally.** Everything (tests included) must run inside the Claude Code cloud session.
- Wants plain language, small steps, practical output. No corporate language, no filler.
- Merges pull requests themselves.

## Handling rules (do not break without the owner's approval)

1. Steering bends the direction of travel, capped at 97% of the surface grip limit (`CONFIG.arcade.gripUse = 0.97`).
2. The car's angle is controlled separately: a small "look" slide on loose surfaces, a big angle only in a deliberate drift.
3. Surfaces change grip only, never how responsive the steering is.
4. Drifts start only on purpose: handbrake while steering, or a brake tap while already steering.
   They end after 0.32 s of neutral steering (`drift.release`) or by countersteering.

Measured targets (checked by `tests/handling.test.js` and `tests/bot.test.js`):
- Slide from holding a steering key: 2–10° on every surface.
- Turn-in (key press → steering fully wound on): 67–100 ms up to 80 km/h, and the same on every surface at every speed.
- No unrequested drifts.
- Bot off-road time per stage: at most 8 s (see `docs/decisions.md` for why this differs from the old "about 5 s").

## File layout

| Path | What |
|---|---|
| `index.html` | The whole game: CSS, HUD/menu HTML, and one script. Changing it changes the live game once merged. |
| `CLAUDE.md` | This rulebook. |
| `.claude/agents/` | Departments: `handling`, `tracks`, `qa`. |
| `.claude/skills/` | `ship-a-build`, `handling-check`. |
| `docs/roadmap.md` | Done / next / ideas. |
| `docs/decisions.md` | Design decisions with date and reason. Add an entry for every rule, target or expected value you set or change. |
| `tests/` | QA test kit (owned by qa). `expected.json` holds every expected value. |
| `package.json` | Test-only: pins three 0.128.0 so tests run when cdnjs is blocked. The game never uses `node_modules`. |

Inside `index.html` (search for these names, line numbers drift):

| Area | Names |
|---|---|
| Tunables | `const CONFIG` → `arcade` (the live driving model), `cars`, `surfaces`, `camera`; older sim sections (`tyre`, `engine`, `drivetrain`, …) |
| Stages | `const STAGES` (segments, `surfaceChanges`, `checkpoints`, `timeStart`, `timeExt`, `refTime`, `jumps`), height functions `forestHeight`, `rockNoise`, `japanHeight` |
| Track | `buildTrack`, `buildTerrain`, `makeWorld`, `paceNote` |
| Physics | `class Car` → `step`, `arcadeForces`; `physicsStep` (inside `boot`) |
| Collisions | `collideCar`, `cliffBarriers`, `collideObstacles`, `hashObstacles`, `collideRivals` |
| Inside `boot()` | scenery (`sceneryForest`, `sceneryAlpine`, `sceneryJapan`, `trackside`, `readabilityBoards`), `loadStage`, car model and livery, particles, rivals (`simulateRival`, `setupRivals`, `updateRivals`), audio (`initAudio`, `updateAudio`), input (`KEYMAP`, touch pad), game flow (`startStage`, `finishStage`, `gameOver`, championship), replay, debug overlay (F1), camera, `updateVisuals`, `renderFrame`, `frame` |

Department ownership is in each `.claude/agents/*.md` file. Round 2 will split `index.html` into module files and give
each department its own files.

## How to test

Run in the cloud session (never ask the owner to run anything):

```bash
npm install          # once per session: three 0.128.0 for the test browser
node tests/run.js    # everything, ~2 minutes. Or pick: node tests/run.js handling bot
```

Prints PASS / FAIL per check and writes `tests/results/report.md` plus screenshots. Exit code 1 = something failed.
`KNOWN` = a failure listed in `tests/expected.json` → `knownIssues`; it does not block, and stays visible until fixed.

| Test | Checks |
|---|---|
| `load` | Menu loads, a stage starts and drives, no console errors, the test probe still attaches |
| `bot` | Autopilot drives each stage with each car: finishes, time inside ±3% of the recorded time, beats the clock, off-road ≤ 8 s, no spins / rescues / unrequested drifts |
| `handling` | Flat skid pad per surface, both cars, 50–140 km/h: held-key slide, turn-in time, turn-in equal across surfaces, no drift from steering |
| `mobile` | 800×360 touch screen: menu items don't overlap and Start is reachable; touch controls present, on screen, ≥ 40 px, not overlapping each other or the HUD |

The tests never change `index.html`: `tests/lib/game.js` adds a probe to a temporary copy just before the line
`loadStage(0).then(() => requestAnimationFrame(frame));`. If that line changes, the `load` test says so; update `PROBE_ANCHOR`.

Changing an expected value: only in a PR whose purpose is that change, with a `docs/decisions.md` entry.
Bot times after an intended handling or track change: `node tests/run.js bot --record`.

## Pull request rules

1. Never push to `main`. One branch per task, one topic per PR.
2. Run `node tests/run.js` before opening the PR. Paste the summary line and any FAIL/KNOWN lines.
3. PR description, plain language, short:
   - **What changed** (2–4 lines).
   - **Why.**
   - **Test results** (pass / fail / known, plus before → after numbers when gameplay changed).
   - **How to test on your phone**: the link, which stage, what to do, what you should notice.
   - **Risk**: say plainly if you are not sure a change is safe.
4. Before the owner merges, the `qa` department reviews the PR and writes the verdict: `READY TO MERGE` or `NOT READY` with reasons.
   Only qa may write `READY TO MERGE`.
5. Never change the handling rules or targets above without the owner saying yes in the chat.

## Definition of done

A change is done when all of these hold:
- [ ] The game loads with no console errors (`load` test).
- [ ] It plays on a phone-sized screen: touch controls work and nothing new overlaps (`mobile` test).
- [ ] Handling targets still hold (`handling` and `bot` tests), or the owner approved the change and `docs/decisions.md` says so.
- [ ] `node tests/run.js` shows no FAIL.
- [ ] `docs/roadmap.md` updated if a roadmap item moved; `docs/decisions.md` updated if a rule, target or expected value changed.
- [ ] qa wrote `READY TO MERGE` on the PR.

## Routing owner requests

The owner talks in high-level requests ("the Strada feels too twitchy", "make Sakura more interesting").
1. Pick the department: car feel → `handling`; layout, scenery, pace notes, checkpoints, time limits, barriers → `tracks`.
   Anything that touches both: handling first, then tracks, same branch.
2. The department does the work on a branch and runs the tests.
3. `qa` reviews and gives the verdict.
4. One PR to the owner.
