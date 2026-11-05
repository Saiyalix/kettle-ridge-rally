# Kettle Ridge Rally: studio rulebook

Every department (subagent) follows this file. If a department file and this file disagree, this file wins.

## The game

- 3D arcade rally game in the browser. Players get one self-contained file, `index.html` (~256 KB), with three.js 0.186.1 (loaded as an ES module from jsdelivr through an import map).
  Since Round 2 that file is **built** from the parts in `src/` by `tools/build.js` (plain gluing, no tools to install).
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
- Decided 2026-11-04: once qa writes `READY TO MERGE`, the main session merges the PR itself and tells the owner.
  The owner can say "hold" or "don't merge" in chat at any time; that wins.

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
| `src/` | **The game's source, in parts.** Edit here. Map and ownership: `src/README.md`. Order: `src/parts.txt`. |
| `index.html` | The built game that GitHub Pages serves. **Never edit it by hand**: run `node tools/build.js`. |
| `tools/build.js` | Glues `src/` into `index.html`. `--check` = is it up to date, `--where N` = which src file is line N. |
| `CLAUDE.md` | This rulebook. |
| `.claude/agents/` | Departments: `producer`, `handling`, `tracks`, `art`, `audio`, `ui-mobile`, `qa`. |
| `.claude/skills/` | `ship-a-build`, `handling-check`. |
| `docs/roadmap.md` | Done / next / ideas. |
| `docs/decisions.md` | Design decisions with date and reason. Add an entry for every rule, target or expected value you set or change. |
| `tests/` | QA test kit (owned by qa). `expected.json` holds every expected value. |
| `package.json` | Test-only: three 0.186.1 plus `three-r128` (alias for the old version) so tests run when the CDN is blocked. The game never uses `node_modules`. |

## Changing the game: edit, build, test

1. Edit the file(s) in `src/` that own the thing you change (see `src/README.md`).
2. `node tools/build.js`. It refuses to build if the glued script isn't valid JavaScript and tells you which file and line.
3. `node tests/run.js`.
4. Commit `src/` **and** `index.html` together. The `build` test fails if they don't match.

The files from `src/core/boot.js` to `src/core/main-loop.js` all live inside one function, `boot()`, and share its
variables (`car`, `track`, `P`, `state`, `keys`, …). A file there is not a standalone module: a variable used in one file
may be declared in another. Search all of `src/` before renaming or removing anything. Keep the order in `parts.txt`
unless you mean to change when code runs.

Where things are (search for these names in `src/`):

| Area | File | Names |
|---|---|---|
| Tunables | `handling/config.js` | `CONFIG` → `arcade` (live driving model), `cars`, `surfaces`, `camera`; older sim sections (`tyre`, `engine`, …) |
| Stages | `tracks/stages.js` | `STAGES` (segments, `surfaceChanges`, `checkpoints`, `timeStart`, `timeExt`, `refTime`, `jumps`), `forestHeight`, `rockNoise`, `japanHeight` |
| Track | `tracks/track.js` | `paceNote`, `buildTrack`, `buildTerrain`, `makeWorld` |
| Physics | `handling/car.js`, `handling/physics-step.js` | `class Car` → `step`, `arcadeForces`; `physicsStep` |
| Collisions | `tracks/collisions.js`, `tracks/checkpoints.js`, `tracks/rivals.js` | `collideCar`, `cliffBarriers`; `collideObstacles`, `hashObstacles`; `collideRivals` |
| Scenery | `tracks/scenery.js`, `tracks/themes.js`, `tracks/stage-load.js` | `conifers`, `rocks`, `cornerRails`; `sceneryForest/Alpine/Japan`, `trackside`, `readabilityBoards`; `makeGate`, `loadStage` |
| Rivals | `tracks/rivals.js` | `simulateRival`, `setupRivals`, `updateRivals`, `racePosition` |
| Look | `art/*.js` | `applyLook`, car model + `applyLivery`, particles `emit`, `onCarHit`, `updateCamera`, `renderFrame`, `resize` |
| Sound | `audio/audio.js` | `initAudio`, `updateAudio`, `cue` |
| Controls & HUD | `ui/*.js`, `page/*` | `KEYMAP`, touch pad, tilt, `renderMenu`, `finishStage`, `gameOver`, pause menu, `updateVisuals`, all CSS and HTML |
| Game flow | `core/game-flow.js`, `core/main-loop.js` | `state`, `startStage`, `rescue`, championship, `frame` |

Department ownership is in each `.claude/agents/*.md` file and in `src/README.md`.

## How to test

Run in the cloud session (never ask the owner to run anything):

```bash
npm install          # once per session: three 0.186.1 + three-r128 for the test browser
node tests/run.js    # everything, ~2 minutes. Or pick: node tests/run.js build handling bot
```

Prints PASS / FAIL per check and writes `tests/results/report.md` plus screenshots. Exit code 1 = something failed.
`KNOWN` = a failure listed in `tests/expected.json` → `knownIssues`; it does not block, and stays visible until fixed.

| Test | Checks |
|---|---|
| `build` | `index.html` is exactly what `src/` builds (nobody edited it by hand or forgot to build) |
| `load` | Menu loads, a stage starts and drives, no console errors, the test probe still attaches |
| `bot` | Autopilot drives each stage with each car: finishes, time inside ±3% of the recorded time, beats the clock, off-road ≤ 8 s, no spins / rescues / unrequested drifts |
| `handling` | Flat skid pad per surface, both cars, 50–140 km/h: held-key slide, turn-in time, turn-in equal across surfaces, no drift from steering |
| `mobile` | 800×360 touch screen: menu items don't overlap and Start is reachable; touch controls present, on screen, ≥ 40 px, not overlapping each other or the HUD |

The tests never change `index.html`: `tests/lib/game.js` adds a probe to a temporary copy just before the line
`loadStage(0).then(() => requestAnimationFrame(frame));` (in `src/core/main-loop.js`). If that line changes, the `load` test says so; update `PROBE_ANCHOR`.

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
4. The `qa` department reviews every PR and writes the verdict on it: `READY TO MERGE` or `NOT READY` with reasons.
   Only qa may write `READY TO MERGE`.
5. **Merging:** when qa says `READY TO MERGE`, the main session merges the PR (merge commit, not squash), checks that
   `main` still passes `node tools/build.js --check`, and tells the owner: the PR link, what to try on the phone, and that
   the live game updates in about a minute. Never merge with a FAIL, a NOT READY, or when the owner said to hold.
   Changes to the handling rules or targets are merged only after the owner said yes to that change in chat.
6. **Undo:** if the owner says something broke after a merge, open a revert PR for that merge right away (qa checks
   the revert with the tests), merge it, then find the cause on a new branch.
7. Never change the handling rules or targets above without the owner saying yes in the chat.

## Definition of done

A change is done when all of these hold:
- [ ] Changes are in `src/`, `index.html` was rebuilt with `node tools/build.js`, and both are committed (`build` test).
- [ ] The game loads with no console errors (`load` test).
- [ ] It plays on a phone-sized screen: touch controls work and nothing new overlaps (`mobile` test).
- [ ] Handling targets still hold (`handling` and `bot` tests), or the owner approved the change and `docs/decisions.md` says so.
- [ ] `node tests/run.js` shows no FAIL.
- [ ] `docs/roadmap.md` updated if a roadmap item moved; `docs/decisions.md` updated if a rule, target or expected value changed.
- [ ] qa wrote `READY TO MERGE` on the PR, and after merging `main` still passes the `build` check.

## Routing owner requests

The owner talks in high-level requests ("the Strada feels too twitchy", "make Sakura more interesting").

| The request is about… | Department |
|---|---|
| How the car drives: grip, drift, steering, speed, car stats | `handling` |
| The stages: layout, corners, jumps, surfaces, scenery placement, pace-note text, checkpoints, time limits, barriers, rivals | `tracks` |
| How it looks: car and rival models, colours, scenery textures, lighting, sky, effects, cameras | `art` |
| What you hear: engine, surfaces, impacts, beeps, co-driver voice | `audio` |
| Menus, HUD, touch controls, phone layout, graphics quality, frame rate on phones | `ui-mobile` |
| A bug report or "is this working?" | `qa` reproduces it first, then the owning department fixes it |
| Vague, big, or more than one of the above; "what's next?" | `producer` breaks it into tasks first |

1. Small and clearly one department: send it there. Otherwise ask `producer` for a task plan first.
2. Departments work on one branch for the request, in the producer's order, each in its own files, and run the tests.
3. `qa` reviews and gives the verdict.
4. One PR to the owner; merge when qa says `READY TO MERGE` (see Pull request rules).
5. `producer` updates `docs/roadmap.md` and `docs/decisions.md` in the same PR.

Some files are shared, split by *kind* of change (details in `src/README.md`): in the scenery files, *where and how many*
is tracks and *what it looks like* is art; each stage's `look` block is art; `CONFIG.camera` and car colours are art;
the co-driver voice is audio; `quality === 'low'` paths are ui-mobile. A change that needs both kinds: both departments, in one PR.
