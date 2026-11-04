# Decisions log

Every rule, target or expected value gets an entry: date, decision, reason. Newest first.
Values measured from the game on 2026-11-04 (`main` at commit 26e2180, three.js r128).

---

### 2026-11-04 · Department models
**Decision:** `handling` runs on Opus, `tracks` and `qa` on Sonnet.
**Reason:** handling changes are subtle (one value affects several rules at once) and worth the stronger model;
tracks and QA work is more mechanical (data edits, running checks, reading reports) and cheaper on Sonnet.
Change the `model:` line in the agent file to switch.

### 2026-11-04 · Only qa says "READY TO MERGE"
**Decision:** other departments can open PRs, but only the qa department writes the verdict.
**Reason:** the owner can't read code; the verdict is their signal that the checks were run by someone other than the author.

### 2026-11-04 · Tests never change index.html
**Decision:** the tests add a small probe (`tests/lib/probe.js`) to a *temporary copy* of `index.html`, just before
`loadStage(0).then(() => requestAnimationFrame(frame));` inside `boot()`, so the bot can read the game's internals.
**Reason:** Round 1 must not touch the game, and players should never get test code. Cost: if that line changes, the
`load` test fails with a clear message and `PROBE_ANCHOR` in `tests/lib/game.js` needs updating.

### 2026-11-04 · three.js for tests from npm
**Decision:** `package.json` pins `three@0.128.0` (= r128, same release as the cdnjs file). Tests serve that file in place of cdnjs.
**Reason:** cdnjs is blocked in the Claude Code cloud session. The game itself still loads three.js from cdnjs.

### 2026-11-04 · Bot design and expected finish times
**Decision:** a fixed autopilot (aims ahead on the road, picks speed from the curvature ahead, uses gas/brake/steer only,
never the handbrake) drives each stage with each car. Expected time = time measured today, window ±3%.
**Measured:** Kettle Ridge 91.51 s (Kestrel) / 92.55 s (Strada), Vulture Ledge 88.81 / 88.34 s, Sakura Touge 87.95 / 88.13 s.
**Reason:** ±3% catches a real change in speed or grip (a 10% grip change moves times by more), while ignoring tiny
side effects. Never tune the bot to make numbers look better; changing it means re-recording all times in its own PR.

### 2026-11-04 · Bot runs one fresh page per stage + car
**Decision:** each bot run opens a fresh page, resets rival dust counters, and uses seeded random numbers.
**Reason:** measured: the same stage driven twice in one page differed by up to 0.6 s, because the game keeps some
state between runs (a rival's dust counter shifts the random numbers used for contact kicks, and more). Fresh pages
gave identical results to the hundredth, run after run, regardless of timing.

### 2026-11-04 · Off-road limit: 8 s per stage (brief said "about 5 s")
**Decision:** FAIL if the bot spends more than 8 s off the road on a stage.
**Measured:** this bot spends 0.0 s everywhere except Kettle Ridge with the Strada (1.6 s). The "about 5 s" came from
an earlier bot that drove differently. 8 s leaves room for normal variation while still catching a car that won't stay on the road.

### 2026-11-04 · Turn-in definition and speed range
**Decision:** turn-in = time from pressing a steering key until the steering is fully wound on (`car.steerIn` reaches 1).
Target 67–100 ms is checked at 50 and 80 km/h. At 110 and 140 km/h only "same on every surface" is checked.
**Measured:** 92 ms at 50 km/h, 100 ms at 80, 108 at 110, 125 at 140, identical on tarmac/gravel/dirt/snow for both cars.
The game deliberately steers calmer at high speed (`steerAttackFast`), so the 67–100 ms target only holds up to ~80 km/h.
Also reported: "car response" (time until the direction of travel turns at 90% of its steady rate): 75–117 ms,
within 25 ms across surfaces. **Owner: confirm this matches what you meant, or tell qa which speed range the target is for.**

### 2026-11-04 · Held-key slide measured on a flat skid pad
**Decision:** steady slide angle while holding one steering key on a flat pad of each surface, 50/80/110/140 km/h.
Grass only at 50 km/h. Must be 2–10°.
**Measured:** tarmac 2.4°, gravel 7.7°, dirt 8.7°, snow 9.7°, grass 5.6–5.7°, same at every speed, both cars.
**Reason:** a flat pad isolates the car from bumps and corners. Grass is off-road: the car can't hold speed there (drops to ~26 km/h).
On real stages bumps and landings briefly push the slide higher (up to ~50° in the bot runs); that is not a held-key slide.

### 2026-11-04 · Phone layout check at 800×360
**Decision:** menu items must not overlap and Start must be reachable (scrolling the menu is allowed); in a race the
touch controls must exist, be on screen, be at least 40 px, and not overlap each other or the HUD.
**Measured:** on 800×360 the menu is 747 px tall, so Start is below the fold (the menu scrolls, by design). The minimap
distance label overlaps the top of the HB button by ~14 px: logged as a known issue in `tests/expected.json` and on the roadmap.
**Reason:** 40 px is a comfortable thumb target on a phone; the game's smallest buttons (camera/pause/reset) are 46×40.
