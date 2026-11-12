# Decisions log

Every rule, target or expected value gets an entry: date, decision, reason. Newest first.
Values measured from the game on 2026-11-04 (`main` at commit 26e2180, three.js r128).

---

### 2026-11-12 · UI/mobile: phone performance pass (High costs more since #34/#36)
**Decision:**
- Low particle numbers from #34 confirmed: cap **360**, emission **half**, hit sparks **6**. Reason: a full trail on High makes about 360 dust particles a second (4 wheels x 90) living 1 to 2 s, so High needs the 1000 cap; on Low half the rate gives about 180 a second, which is 250 to 300 alive, inside 360, so the ring buffer never overwrites a live puff in normal driving. Low draws the same trail, thinner. Not changed.
- Auto-drop to Low: threshold **40 ms -> 36 ms** smoothed frame time (under 25 fps -> under about 28 fps), still 3 s in a row after 4 s of driving. The aim is 30 fps; a phone locked at 30 shows 33 ms and is safe, one stuck at 25 to 28 fps now drops instead of staying on High. One frame counts as at most 100 ms in the average, so a single hitch (shader build, tab switch) cannot trigger it. Still one-way (never goes back up by itself), saved, so it cannot flip back and forth. Dropping to Low calls `resize()`, which sets MSAA to 0 and `sharp`/`bloom2` are 0 on Low, so the drop also removes them.
- Ground is now square tiles of 64 x 64 cells (was one mesh of up to 750 000 triangles that was drawn whole every frame). Same vertices, same normals, same look; three.js skips tiles outside the view and `cullFar` skips tiles beyond the fog. In the test browser at 800x360: triangles drawn per frame SS1 730 000 -> 380 000 (High) and 645 000 -> 300 000 (Low); SS3 465 000 -> 215 000 (High). Draw calls +9.
- Particles: when none are alive (most of a tarmac stage) the update loop, the 32 KB buffer upload and the draw call are skipped.
**Touched outside ui-mobile:** `src/tracks/stage-build.js` `buildGround` (how the ground is cut up, not where or what it looks like) and `src/art/effects.js` `updateParticles`/`emit` (skip when idle); both keep the High look pixel-for-pixel.

### 2026-11-12 · Art: sharper modern-retro look (High quality only)
**Decision:**
- Sharper: on High the scene is drawn into a 4x multisampled target (smooth road edges, car, fences) and the post pass adds a limited 4-tap sharpen. Render scale stays 0.72 x dpr (a 1.0 scale with MSAA made the software test browser time out). Low is untouched.
- Punchier stage looks (stages.js `look`): stronger saturation (SS1 1.2 -> 1.32, SS2 1.0 -> 1.14, SS3 1.12 -> 1.26, SS4 1.1 -> 1.24), a little more contrast, warmer and stronger sun, cooler shadow lift. Each stage keeps its time of day.
- Cost on High: no extra scene passes or draw calls; +4 texture taps in the post pass, 4x MSAA on the scene target, no change in pixel count.

### 2026-11-12 · Art: surface trails, sparks, damage looks (package 4)
**Decision:** each surface has its own trail (tan dust gravel/dirt, white spray and flakes on snow, grey tyre haze on tarmac only in a hard slide or wheelspin, brown dust plus green/brown clods on grass), scaling with speed and slide.
Sparks on scrapes are brighter and shorter. After hits the car shows dark scuffs and bare-metal streaks (one pooled mesh, 14 marks, one draw call) and dirt builds up as a tint on the paint (no draw call); both reset when a stage starts.
Particle cap: 1000 on High, 360 on Low (Low emits about half as much; ui-mobile owns the Low path and should confirm). Drawn only: no physics change, handling rules and targets untouched.
**Touched outside art:** `src/ui/visuals-hud.js` per-wheel dust block replaced by one call, `wheelFx(dt, i, w)` in `src/art/effects.js` (no behaviour change for the HUD).

### 2026-11-11 · Handling: in a drift the tyres decide where the car goes, and drifting is never the faster way
**Request (owner):** "as soon as you drift the car goes alot quicker ... its like the wheels on the ground dont dictate
where the car goes ... in a drift the car will keep going in a straight line when accelerating, instead of going where
the nose of the car points. Adjust that."

**Causes found (`handling/car.js` `arcadeForces`, measured on the flat skid pad, from `main` 3eb5336):**
- Cornering, and above all sliding, cost no speed. The grip the loose rear loses was handed back as a side force pushing
  exactly square to the travel (`slideCarry`: bends the path, never scrubs), and 60% of what the real tyres scrub was
  handed back (`slideKeep`). Full throttle, 3 s from 80 km/h: a held drift ended 3–4 km/h short of driving dead straight;
  a 90° drift on snow (Strada) ended 1.4 km/h *faster* than driving straight for the same time.
- Throttle took the carried grip away too: the power slide shrank the rear's side grip *and* the carried grip by the same
  friction circle (down to 20%). So on the gas the tail swung but nothing bent the path: the nose pointed in, the car went on
  straight. Held key + full gas for 3 s on gravel: the nose turned 83°, the travel only 53° (Strada).
- Letting go in a drift on the gas: the nose swung back to the old line instead of the car following the nose (path did
  only 19–45% of the straightening).
- Top speed was checked against the speed along the nose, so a slide at high speed could pass the car's top speed.

**Changes (all `src/handling/`):**
- The carried grip still pushes square to the travel (bends the path toward the nose) but now scrubs speed like a tyre
  leaning across the car would; `slideKeep` 0.6 → 0.75 is now the share of *all* slide scrub kept (tyres and carried grip).
- New `powerCarry` 0.9: the share of the rear side grip that throttle takes which still pulls the car round toward the nose
  (fades in with speed like the rear's looseness, `slideFrom`/`slideFull`). Throttle still swings the tail (rule 2).
- Over-speed drag uses the real speed: no slide past top speed.
- `slideCatch` 0.15 → 0.18 (s): keeps the Strada's first swing-out and spin-test margins where they were on snow.
- Tried and dropped: a whole-car traction circle (drive limited by cornering grip) and an engine-push taper by real speed.
  Both made drifts bog down (Strada to 55–57° slide, 80 → 50 km/h) or pushed the held slide past 32° at 140 km/h.

**Measured (skid pad; full throttle; before → after):**
| What | Kestrel GT4 | Strada HF |
|---|---|---|
| 90° turn of the travel from 80 km/h, gravel, steady 60% part steer (phone tilt, small slide): time, km/h lost vs driving straight as long | 4.88 s, 2.3 km/h → 4.35 s, 2.1 | 6.40 s, 2.5 → 4.36 s, 4.5 |
| Same, held-key drift | 3.93 s, 5.2 → 3.48 s, 5.3 | 5.33 s, 2.9 → 3.57 s, 9.1 |
| Same on snow, drift | 4.97 s, 3.8 → 3.91 s, 6.4 | 6.04 s, −1.4 (faster than straight) → 4.05 s, 8.0 |
| Held key + full gas 3 s, gravel: travel / nose turned | 70° / 86° → 79° / 93° | 53° / 83° → 77° / 103° |
| Same, dirt / snow | 67/86 → 78/96; 56/80 → 71/94 | 53/84 → 76/105; 52/83 → 69/101 |
| Let go after 1.5 s of drift on full gas: share of the slide closed by the path (rest by the nose swinging back) | gravel 45 → 57%, dirt 38 → 51%, snow 31 → 43% | gravel 23 → 60%, dirt 19 → 54%, snow 18 → 37% |
| Full gas through a 40 m gravel corner (bot-style aim): runs wide by | 28 m → 23 m | 47 m → 28 m |
| Full gas held drift 3 s from 160 km/h vs straight (snow) | 0.3 → 1.7 km/h slower | 3.2 faster → 0.2 slower |
- A drift now costs about 2× the speed of a gripping corner of the same turn (gravel/dirt/snow), and turns the corner sooner.
- At 160 km/h a full-gas drift still gains about as much as driving straight (it can't pass top speed any more).

**Targets (all still hold, `node tests/run.js`: 227 pass, 0 fail):** held-key slide tarmac 0.1–4.3°, gravel 14.3–27.9°,
dirt 15.8–28.9°, snow 17.9–26.3°, grass 26–36°; first swing-out ≤ 47.8° (was 47.7); spin test max 46°, Strada snow
0.35 → 0.00 s past 45°, grass 0.25 → 0.24 s; letting go ≤ 0.68 s (grass 1.00 s), no overshoot; wind-on unchanged
92/100/108/125 ms on every surface; Strada slides +8°/+8° more than Kestrel on gravel/dirt; handbrake turn 1.02/1.00 →
1.10/1.03 s (auto gas 1.03/1.06 → 1.09/1.12 s, limit 1.2); phone tilt unchanged within 0.5°, part-tilt wobble ≤ 2.7°;
auto gas + brake tap never past 45° (Strada snow 0.49 → 0.00 s), turns 3–14° more than before.

**Bot (unchanged autopilot), old → new s:** Kettle Ridge 90.58 → 90.46 / 90.10 → 90.04; Vulture Ledge 87.47 → 87.39 /
87.37 → 86.94; Sakura Touge 88.21 → 88.51 / 87.93 → 87.93; Thornwick Keep 94.26 → 94.08 / 97.29 → 93.75 (Strada's 3.7 s
off-road gone). 0 spins, 0 rescues, clock margins unchanged (tightest 8.9 s, Vulture Ledge). Times recorded in
`tests/expected.json` → `bot.times` (all within 3% of the old expected times; the Strada at Thornwick moved −2.4%).
No other expected value changed.

**Proposed wording for rule 5 in `CLAUDE.md`** (the main session edits it after the owner says yes; no measured target changes):
> 5. A held slide corners almost as hard as gripping and is the stylish way round a loose corner, but it costs a little
>    speed: it is never faster than a clean line. On the throttle the tyres pull the car where the nose points.

---

### 2026-11-11 · Studio: dashboard updated at every step
**Request (owner):** "Make the dashboard live at all times."
**Decision:** the main session updates the studio dashboard whenever a department starts, finishes or gets stuck, when an
owner question comes up or is answered, when a roadmap item moves, and after every merge (rule in `CLAUDE.md`, "The owner").
Each data file now says how it stays current and shows as stale after 24 h (departments, waiting) or 48 h (roadmap, shipped).
**Why not fully automatic:** the dashboard can only read live data through a claude.ai connector, and no GitHub connector
is available to it. Department status and owner questions live only in the working session, so they can't be read live anyway.
If a GitHub connector becomes available, "Shipped" and "Roadmap" could read straight from GitHub.

---

### 2026-11-10 · Tracks: stages checked and adjusted for the new driving
**Request (owner):** "Make that live, make sure the stages are tested and adjusted for the driving if need be."
**How checked:** the bot plus scripted drivers on all 4 stages, both cars: pushing 17% / 35% over the bot's corner speed, late braking,
handbrake into every hairpin, lifting mid-corner, full-speed jumps. Logged every wall hit, off-road spot, drop and landing.
**Found and fixed:**
- Vulture Ledge hairpin (s 1075-1122): the rock wall on the inside turned into a drop wall half-way round, so a car cutting the inside hit a
  wall and stopped (2 km/h). This was the whole Kestrel-is-6-s-slower problem (Kestrel 93.2 s, Strada 87.0 s). The change from wall to
  drop now happens on the straight after the hairpin (`cliffSides` keys 1080/1125 -> 1122/1175). Kestrel now 87.5 s, 0 hits.
- Pace notes: on tarmac "Easy" needs a 150 m radius (110 m elsewhere). A 110 m tarmac corner is only about 147 km/h in the new driving, so
  Sakura's first sweeper (s 405) now reads "Medium right, downhill" and the r140 corner in town "Medium right".
- Sakura Touge: tree trunks closer than 7 m to the road edge are looks only (a car sliding wide at 150 km/h runs onto open ground).
**Checked and fine:** jumps at full speed on every stage (Kettle 54 m / 3.3 m high, Vulture 0.8 s, Thornwick 0.9 s) land flat, no slide,
no spin. Handbrake into hairpins and lifting mid-corner: no wall hits except scrapes along the outside wall of Vulture's hairpin.
Overspeed (+35%) runs off the road at the outside of corners with open ground, and are slowed by grass, as intended.
**Clocks:** first-checkpoint margin of the bot now >= 8.9 s everywhere (Vulture timeStart 29 -> 30, Sakura 24 -> 26); finish margin >= 25 s.
**refTime** (rivals about 15-20% slower than the bot): Vulture 107 -> 104 (was 22%); Kettle 109 (20%), Sakura 102 (15%), Thornwick 111 (17%) unchanged.
**Bot times old -> new (recorded):** Kettle 91.51 -> 90.85 / 92.55 -> 90.77; Vulture 88.81 -> 87.46 / 88.34 -> 87.52;
Sakura 87.95 -> 88.53 / 88.13 -> 88.63; Thornwick 94.73 -> 94.22 / 95.53 -> 95.13 (Kestrel / Strada).

---

### 2026-11-10 · QA: tests rewritten for the new driving (owner approved the driving and its targets)
**Request (owner):** "Driving is fine for now. Make that live, make sure the stages are tested and adjusted for the driving."
**Handling test** (`tests/handling.test.js`, `tests/lib/skidpad.js`, `expected.json` "handling") now checks the targets of the
2026-11-07 entry, both cars. Worst measured value vs the limit:
- Held-key slide: tarmac 0.1-4.3 deg (0-6); gravel 14.6-28.1, dirt 16.2-28.3, snow 18.8-26.9 (12-32); grass 26.2 / 35.8 (max 40).
- First swing-out: worst Strada grass 47.7 deg, snow 46.9 (max 50).
- Spin test 60/90/120 km/h, every surface: worst max 47 deg (Strada grass), never past 90; worst time past 45 deg 0.35 s (Strada snow 120), limit 0.5.
- Letting go: back under 5 deg in 0.44-0.69 s on gravel/dirt/snow (limit 0.8), overshoot 0 deg (limit 3).
- Steering wound on: 92 / 100 / 108 / 125 ms at 50 / 80 / 110 / 140 km/h, identical on every surface (67-100 up to 80 km/h).
- Strada vs Kestrel average slide: gravel +8.7 deg, dirt +7.2 (needs 4).
- Handbrake 55 km/h gravel: 90 deg turned at 1.02 s (Kestrel), 1.00 s (Strada); peaks 46 / 50 deg, no spin (limit 1.2 s).
- Dropped: "slide 2-10 deg", "no drift from steering" (drifts start naturally now), "car response same on all surfaces" (differs on purpose).
**Value I had to set myself (not in the proposal):** letting go on grass is slower: Kestrel 0.98 s, Strada 1.08 s to get under 5 deg,
so grass gets its own limit of 1.5 s (`recoverS.grass`). Measured, not designed. Handling may tighten it if wanted.
**Bot:** aims by the direction of travel (not the nose), the one-line change from the 2026-11-07 experiment. "Unrequested drifts"
is gone; the clean-run check is now "no spins (past 90 deg), no rescues", plus a new check "clock holds at every checkpoint"
(seconds left on arrival at each checkpoint and the finish must be > 0). Finish, clock and off-road <= 8 s checks unchanged.
**Bot results (times not re-recorded yet; tracks may still change stages):** time s / off-road s / tightest clock margin s:
Kettle Ridge 90.85 / 0.0 / 10.5 (Kestrel), 90.77 / 0.0 / 10.7 (Strada); Vulture Ledge 93.23 / 0.8 / 7.9, 87.03 / 0.0 / 8.2;
Sakura Touge 88.53 / 0.0 / 7.0, 88.63 / 0.0 / 7.3; Thornwick Keep 94.22 / 0.0 / 12.2, 95.13 / 1.2 / 12.4. 0 spins, 0 rescues.
Old time windows: only Vulture Ledge / Kestrel (93.23 vs 86.1-91.5) fails until times are re-recorded.

---

### 2026-11-07 · New driving model: 90s arcade rally slides, weight you can see (PROPOSAL, owner to try the preview)
**Request (owner):** "The game feels static ... take the way the driving is in that video [a 1990s arcade rally game] as
inspiration." What bothered them: (1) on rails, the car never slides or rotates by itself; (2) drifts feel fake (only from
handbrake / brake tap, canned angle); (3) no weight (no lean, dive, squat, bounce). Drifts should start naturally from
steering hard at speed, held by throttle and steering; handbrake for tight turns. Owner approved rewriting the four
handling rules; they try a preview before it goes live. Owner, 2026-11-07: "First focus on the driving ... only after that
worry about the current stages, timings etc." So bot times and stage clocks are reported here, not re-recorded.

**The model (handling/car.js `arcadeForces`, all values in `CONFIG.arcade`):** a two-axle car with simple, forgiving tyres.
- A held key asks the *front* tyres for grip towards that side, measured from where the front axle is going. No key = the
  front wheels follow the slide (automatic countersteer), so letting go straightens the car.
- Each axle has its own grip limit (surface × car × load from the suspension). On loose surfaces the *rear* has less grip
  than the front (`surfaces.*.rear`), so at speed the tail swings out by itself. Throttle (`powerSlide`), a brake tap
  (`brakeSlide`), lifting off (weight forward, `weightShift`) and the handbrake (`handbrakeGrip`) loosen it more.
- As the slide grows, a held key asks for less front grip (`slideHold`, `slideCatch`), so the slide settles at an angle set
  by the surface and the car. The spin guard (`guard`, from 42°) stops the rest; `catchDamp` / `settle` stop swing-back.
- Sliding is the fast way round: the grip lost to the loose rear is handed back as a side force at the centre of mass
  (`slideCarry`), and most of the speed a slide scrubs is kept (`slideKeep`). The engine pushes along the nose.
- Handbrake pull or brake tap while steering = "drift memory" for that corner (`drift.looser`, `drift.holdExtra`): looser
  rear, bigger angle, also on tarmac. Ends after `drift.release` (0.32 s) of neutral steering, on countersteer, or when the slide ends.
- `car.drift` now means "sliding more than 12° at speed" (off below 7°), however it started. HUD / sound / dust / replays use it as before.
- Weight: `car.vis` (roll, pitch, heave) is a spring-damper driven by the car's real accelerations (`arcade.body`), drawn on
  the body mesh only (wheels stay on the road). One 3-line edit in `ui/visuals-hud.js` (ui-mobile's file) applies it to
  `bodyRoot`; level in replays. Physics is unaffected.
- Cars: Kestrel GT4 grip 1.06, rear 1.0, drift 0.85, rearDrive 0.85 (planted 4WD); Strada HF grip 0.97, rear 0.95, drift 1.05,
  turn 1.12 (rotates quicker), rearDrive 1.15 (more power slide). New car stats `rear`, `rearDrive`.
- Unchanged: steering wind-on rates (keys and tilt), top speed, acceleration, braking, jumps (`airFloat`), `maxG` / `top`
  per surface (the bot and rivals read them), suspension, 120 Hz fixed step, determinism.

**Measured (flat skid pad, the `tests/lib/skidpad.js` method plus scratch experiments; both cars):**
| What | Kestrel GT4 | Strada HF |
|---|---|---|
| Held-key slide, tarmac 50–140 km/h | 0.1–3.6° | 2.8–4.3° |
| Held-key slide, gravel / dirt / snow 50–140 km/h | 14.6–18.4 / 16.2–21.0 / 18.8–25.1° | 20.4–28.1 / 20.7–28.3 / 19.1–26.9° |
| Held-key slide, grass 50 km/h | 26° | 36° |
| First swing-out peak while holding a key (60–120 km/h, loose) | 21–35° | 38–47° |
| Time to pass 10° (held key, loose, 60–120 km/h) | 0.47–0.60 s | 0.40–0.57 s |
| Release the key from a held slide: back under 5° | 0.47–0.56 s, overshoot 0° | 0.45–0.68 s, overshoot 0° |
| Catch: 0.2 / 0.35 s opposite key from a gravel slide at 90 | swings past straight 0 / 1° | 0 / 3° |
| Spin test: full lock + full throttle 4 s, 60/90/120, every surface | max 34°, never past 45° | max 46°, 0.35 s past 45° (snow 120), never past 90° |
| Cornering in a held slide (lat g, loose) / limit maxG × grip | 1.03–1.33 g (0.89–0.97 of the limit) | 0.88–1.14 g (0.84–0.92 of the limit) |
| Speed kept: 2 s coasting from 90, held key vs straight | −5 km/h (gravel, 24° slide) | −5 km/h (gravel, 31° slide) |
| Throttle in a gravel slide (half → full) / lift-off | 14 → 15°; lifting tucks the nose in (rotation +7% gravel, +25% tarmac) | 19 → 30°; lift: rotation +12% gravel, +24% tarmac |
| Handbrake hairpin, gravel 55 km/h, HB 0.4 s: 90° turned in | 1.03 s (no HB: 1.99 s), peak 46°, no spin | 0.99 s (no HB: 2.18 s), peak 51° |
| Brake tap mid-corner, tarmac 90 km/h: peak slide | 22° | 33° |
| Steering wound on (key press → full) | 92 / 100 / 108 / 125 ms at 50 / 80 / 110 / 140 km/h, same on every surface (unchanged) | same |
| Tilt steering, gravel 90: 20 / 40 / 70 / 100% tilt | 3 / 6 / 15 / 19° slide | 3 / 7 / 23 / 28° |
| Body (drawn): full braking / full power / cornering on tarmac | nose dips 3.5–4.5°, squats ~2°, leans ~4° (on top of the springs' own movement); landings compress ~0.2 m and bounce once | same |

**Bot (unchanged autopilot; never uses the handbrake), old → new time s / off-road s:**
Kettle Ridge Kestrel 91.51 → 93.33 / 1.7, Strada 92.55 → 98.86 / 8.0; Vulture Ledge Kestrel 88.81 → 89.55 / 0.0, Strada
88.34 → 95.12 / 3.7; Sakura Touge Kestrel 87.95 → 88.68 / 0.0, Strada 88.13 → 89.97 / 0.6; Thornwick Keep Kestrel 94.73 →
96.73 / 0.1, Strada 95.53 → 121.52 / 35.3 (1 rescue). 0 spins everywhere. All beat their stage clock.
The bot aims with the car's *nose*; in a 20–30° slide the nose points inside the corner, so it lets go of the key too early
and runs wide (worst with the slidier Strada). The same bot aiming with the *direction of travel* (scratch experiment, one
line changed) drives every stage clean: 90.76 / 90.77, 90.43 / 87.03, 88.50 / 88.63, 94.13 / 95.13 s, off-road ≤ 1.8 s,
0 spins, 0 rescues. So the car can be driven clean and as fast as before; sliding is not slower. Suggestion for qa (their call):
aim the bot with the direction of travel, then re-record times after the owner approves the feel.

**Proposed replacement for CLAUDE.md "Handling rules" and "Measured targets"** (the main session edits CLAUDE.md after the owner says yes):

> ## Handling rules (do not break without the owner's approval)
>
> 1. Steering asks the front tyres for grip towards the key, measured from where the car is going. With no key the front
>    wheels follow the slide (automatic countersteer), so letting go always straightens the car.
> 2. The rear can let go before the front. On loose surfaces at speed the tail swings out by itself; throttle, a brake tap,
>    lifting off and the handbrake swing it out more. Holding a key settles the slide at an angle set by surface and car.
> 3. Surfaces change grip and how easily the rear lets go, never how fast the steering winds on.
> 4. The car never spins by itself: past 42° of slide it resists the slide growing, and a caught or released slide does
>    not swing back the other way.
> 5. A held slide is the fast way round a loose corner: it corners almost as hard as gripping and keeps its speed.
> 6. The body shows weight (lean, dive, squat, bounce) from the car's real accelerations; it is drawn only and never changes the physics.
>
> Measured targets (flat skid pad per surface, both cars, 50–140 km/h; checked by `tests/handling.test.js` and `tests/bot.test.js`):
> - Held-key slide: tarmac 0–6°; gravel, dirt and snow 12–32°; grass at most 40°.
> - First swing-out while holding a key: at most 50°.
> - Spin test (full lock + full throttle for 4 s from 60 / 90 / 120 km/h, every surface): never past 90°, at most 0.5 s past 45°.
> - Letting go of the key from a held slide: back under 5° within 0.8 s, at most 3° past straight.
> - Steering wound on (key press → full): 67–100 ms up to 80 km/h, the same on every surface at every speed.
> - Strada vs Kestrel: the Strada's held-key slide on gravel and dirt is at least 4° bigger on average.
> - Handbrake: at 55 km/h on gravel, 0.4 s of handbrake with full lock turns the car 90° within 1.2 s, without spinning.
> - Bot: finishes every stage with both cars, 0 spins, 0 rescues, off-road at most 8 s per stage.

**Test results on this branch (`node tests/run.js`, 52 pass / 35 fail):** build, load, mobile pass. Failing, all expected
under the old rules: handling "held-key slide 2–10°" (all surfaces but Strada tarmac; Kestrel tarmac 50 km/h is 0.1°, under the
old 2°), "no drift from steering alone" (loose surfaces and grass), "turn-in same on all surfaces" (the steering part is
identical; the "car response" part now differs by surface on purpose, 117–333 ms). Bot: "unrequested drifts" (1–28 per run:
drifts now start naturally), "time in window" for 3 Strada runs, and Thornwick Keep / Strada off-road 35.3 s and 1 rescue (see bot note above).
**Next:** owner tries the preview (best on the new test stage that tracks is building). If yes: main session puts the rules
above into CLAUDE.md, qa rewrites `tests/handling.test.js` to the new targets (spin test, recovery, car difference), retires
"unrequested drifts", decides on the bot's aim, then re-records times and checks the stage clocks with tracks.

### 2026-11-05 · three.js upgrade: r128 -> 0.186.1, same look on purpose
**Request (owner):** "Upgrade three.js to the newest version."
**Decision:** 0.186.1, not 0.187.0 (released 6 days earlier; we picked the one that has had a little time to settle). Loaded as an ES module through an inline import map from cdn.jsdelivr.net with the exact version; the main script is `<script type="module">`. `tools/build.js` now validates module scripts. The test kit serves r128 and 0.186.1 from `node_modules` (`package.json`: three 0.186.1 + `three-r128` alias) and fails if the game asks for any other version.
**Same look on purpose:** colour management off (`ColorManagement.enabled = false`, LinearSRGB output) and light intensities x pi, which reproduces r128's look; `PCFSoftShadowMap` -> `PCFShadowMap` (soft type removed in r186); one shader fix. Bot and handling results identical (no handling rule or target changed).
**Reason:** the upgrade should change nothing the owner sees, so any difference is a bug and easy to spot; mixing a look change into it would hide problems.
**Follow-up:** a proper colour-managed (sRGB) pipeline, best done in the car-models step when the materials are redone anyway.

### 2026-11-05 · Real 3D models and liveries: owner's choices
**Request (owner):** "make real 3D models for everything ... a modern rendition of [a 1990s arcade rally game]: the retro styling but with higher resolution", and "add different liveries for the player car".
**Owner's choices:** models are built in code (no model files); Kestrel = 1990s Japanese 4WD rally coupe, Strada = boxy hot hatch, handling characters unchanged; 4 original liveries per car, picked in the menu and remembered on the device; rivals get their own liveries.
**Constraint:** original designs only: no real brands, and no copies of that game's cars, liveries or tracks.
**Reason:** code-built models keep the page one self-contained file; unchanged handling means no rule or target is touched.

### 2026-11-05 · HUD redesign: small, phone-first, centre of the screen clear
**Request (owner, after phone testing; game ran fine, no issues):** the HUD clogs the screen and corner calls block the view; make them a lot smaller, redesign the HUD smaller and less cluttered.
**Decision:** design for the phone (800x360) first; the centre of the screen stays clear. Done by ui-mobile together with graphics step 6 "Retro HUD" (so step 6 was done out of order on purpose). Pace note is a one-line chip under the countdown; banners are small and in the upper area; moderate yellow countdown; small italic stage time + position top-left (phone) / position top-right (desktop); only the latest split, fading; thin START-GOAL progress bar replaces "km to go"; smaller minimap; small rev dial + gear + speed bottom-left; keyboard help only for the first 8 s and in the pause menu. Also fixes the known issue "map label overlaps the HB button".
**Measured (HUD share of screen):** 800x360 phone: plain driving 15.5% -> 7.0%, with corner call 19.4% -> 8.4%, with banner 21.6% -> 8.6%; 1280x720 desktop 15.1% -> 5.1%; centre covered by a corner call 33% -> ~4%; pace-note box 299x88 -> 292x24 px.
**Reason:** the HUD hid the road on small screens; readability while driving matters more than a big retro look. No handling rule or target changes.

### 2026-11-04 · Graphics overhaul: plan, style and limits
**Request (owner):** "I want the graphics to be a lot better. Right now they're very basic and not interesting to look at."
The owner shared three screenshots of a 1990s arcade rally game as style inspiration: textured world (stone walls, plaster buildings,
gravel), streaky glossy road with tyre marks, walls / fences / rock faces close to the road, painted skies (clouds, sunset, starry night
with a lit city), dense colourful autumn trees, bold white livery with colour swooshes and sponsor decals, low close chase camera,
chunky retro HUD (big yellow countdown, italic numbers, rev dial, progress bar).
**Owner's answers:**
- Priorities: all four: road and roadside, skies and lighting, trees and nature, car look.
- Texture style: smooth and modern (rich detail, smooth and sharp, not pixelated).
- Phone speed: keep 30 fps on mid-range phones; phones may get a lighter version of the heaviest parts.
- Camera: ADD lower / closer options, keep the current ones (cockpit, far-away, etc.).
- HUD: change to a more retro look, comparable to the reference images.
**Constraint (set by us):** the screenshots are style inspiration only. No real brands (no oil company, tyre or car-maker logos), not the
reference game's livery or track layouts; every design is original. Textures are generated in code (no image files) so the page stays small.
**Reason:** copying another game's look or brands is not ours to do and could cause trouble for the live page; a similar mood
with our own designs gives the owner what they want. Code-made textures keep `index.html` small and the build unchanged.
**Plan (one PR each, in order, qa checks each):** 1 road and roadside (art, tracks); 2 skies and lighting (art); 3 trees and nature
(art, tracks); 4 car look (art); 5 new cameras (art); 6 retro HUD (ui-mobile). Handling tests must pass at every step (graphics do not
change driving); ui-mobile checks phone cost each time. No handling rule or target changes.

### 2026-11-04 · Round 3: PRs are merged as soon as qa says READY TO MERGE
**Decision:** the owner asked: "Merge when QA says it's ready." The main session merges right after qa's `READY TO MERGE`
(merge commit, not squash), checks `main` still builds, and tells the owner. The owner can say "hold" at any time.
Changes to the handling rules or targets still need the owner's yes in chat before merging. If something breaks: revert PR first, fix after.
**Reason:** the owner tests on the live game on the phone anyway; waiting for a manual merge added a step without adding a check.
Because qa's verdict is now final, qa is told to be strict about phones and the live page.

### 2026-11-04 · Round 3: seven departments, shared files split by kind of change
**Decision:** departments producer, handling, tracks, art, audio, ui-mobile, qa. Most files have one owner. Shared files are split by the
*kind* of change: scenery files (placement → tracks, look → art), each stage's `look` block (art), `CONFIG.camera` and car colours (art),
co-driver voice in `core/game-flow.js` (audio), `quality === 'low'` paths (ui-mobile). Table: `src/README.md`.
**Reason:** the code mixes placement and look in the same functions, and splitting those files would change `index.html` and
risk changing how the game behaves, for no gain. Ownership by kind of change keeps every edit with one clear owner.
`CONFIG.camera` stays inside `handling/config.js` for the same reason: moving it would change the built file.
**Models:** art, audio, ui-mobile, producer run on Sonnet (look, sound and layout work is iterative and checked by screenshots
and tests; planning is light). handling stays on Opus.

### 2026-11-04 · Round 2: split by gluing parts, not by rewriting into JavaScript modules
**Decision:** `index.html` is cut into 33 consecutive parts in `src/` (grouped in folders per department). `tools/build.js`
glues them back together in the order of `src/parts.txt`, adding nothing. Real ES modules (`import`/`export`) were not used.
**Reason:** your rule for Round 2 was "the rebuilt game must behave exactly like today's". Gluing is the only way to
*prove* that: the rebuilt `index.html` is byte-for-byte identical to the old one (same SHA-256,
`d558749f…e423a86`), so nothing can behave differently. A real module rewrite would touch hundreds of shared
variables inside `boot()` and could only be shown "probably the same" by tests. The cost: files from `core/boot.js` to
`core/main-loop.js` share `boot()`'s variables, so they are not independent; `CLAUDE.md` warns about this.
Nothing to install: the build uses only Node, which the cloud session has. GitHub Pages still serves the one built file.

### 2026-11-04 · index.html must always match src/
**Decision:** new QA test `build` fails if `index.html` is not exactly what `src/` builds. Edits go in `src/`, never in `index.html`.
**Reason:** two copies of the game (parts and built file) can drift apart. The test makes that impossible to merge by accident.
The build also refuses to produce a page whose script isn't valid JavaScript, and names the file and line of the error.

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

## 2026-11-05 · QA: centre-screen clearance check (mobile test)
Owner complained the co-driver note and banners block the view. New `mobile` check: on 800x360 the note, the (goal-size) banner and the big countdown digit are forced on screen and the middle band (40% wide x 40% high) must stay mostly clear. Thresholds measured on branch `ui/compact-hud` (note 0%, banner 36.2%, countdown 1.3%) and set with headroom: note ≤ 5%, banner ≤ 45%, countdown ≤ 10%. Also removed the knownIssues entry "touch controls do not overlap the HUD" (fixed by the compact HUD).

## 2026-11-05 · Art: graphics step 2, skies and lighting
Stage moods (owner can change them later): SS1 Kettle Ridge = bright day with painted cumulus, SS2 Vulture Ledge = late-afternoon sunset (sun 17 degrees up, long shadows, purple haze), SS3 Sakura Touge = night (stars, moon, lit city on the horizon). SS3 `place` is now "Japan by night" and its blurb says moon / lantern-lit / glowing town; nothing else in the stage data changed.
- Sky is one dome shader plus one wide canvas texture (clouds only, 4096x512; 2048x256 on low) and a far ring with the ridge / skyline picture (4096x256; half on low). Stars, sun and moon discs are drawn by the shader, so they stay sharp. All generated in code, repainted when a stage loads.
- Night uses no extra real-time lights: the road is slightly self-lit, a headlight pool (one additive mesh draped on the ground) follows the car, reflector posts line both road edges (look only, no collision), lamps / lanterns / signs are glow dots (one Points draw call). `scene.fog.color` now follows the stage's horizon colour (before, fog stayed pale cyan on every stage because three.js keeps its own copy of the colour).
- `look` blocks have new keys: `sunEl`/`sunAz` (replace `sunDir`), `sky`, `ridge`, `grade`, `env`, `night`, `nightGlow`, `noPeaks`, `lightEl`/`lightAz`, `dust`, `flare`, `shadowBias`.
- The random cone mountains of SS2 and SS3 are hidden (`noPeaks`; the random numbers are still drawn, so no scenery moved); the volcano at the SS3 finish stays.
- Cameras: the old far rally camera is kept as the default (10.5 high, look-ahead 7). At the owner's request the lower far view (6.8 high, look-ahead 15, shows the sky) is an extra camera, mode 4, last on the C key / CAM button. The cycle length is one constant, `CAM_MODES` in `art/camera.js` (used by `ui/input.js` and `core/debug-replay.js`).
- Meshes beyond the fog distance are not drawn (`cullFar`): they were fog colour anyway; this keeps SS3's draw calls down.
- No expected values changed (handling and bot results identical).

## 2026-11-05 · Art: graphics step 2b, player cars as 3D models with 4 liveries each
Kestrel GT4 (wide low 4WD coupe, big rear wing) and Strada HF (short boxy hatch, roof spoiler) are built in code: lofted body shells, arch tunnels, glass, wheels with spokes. Wheel positions, radius and centre of mass are unchanged (driving identical: handling and bot tests unchanged). Liveries are data in `CONFIG.cars[i].liveries` (4 per car), painted onto one atlas texture (1024x1152 high, 512x576 low). Choice is remembered in localStorage `rallyLivery:<carId>`. `CONFIG.cars[i].paint/stripe/skirt/number` stay = default livery for the menu swatches. Low quality: Lambert materials, no env reflection, coarser mesh, half-size texture. No expected test values changed.

## 2026-11-05 · Art: graphics step 5, colour-managed (sRGB) lighting
Colour management is ON (`ColorManagement.enabled`, output sRGB). Hex colours and every colour canvas texture (road, ground, scenery, signs, livery, plates, dial, env map, backdrop ring) are sRGB and converted to linear for lighting and fog. Vertex and instance colours (authored as display numbers) are decoded by a one-line patch of three's `color_vertex` chunk. The sky dome keeps painting in display colours and converts once at the end of its shader, so its gradients look as before; dust particles decode in their shader.
- The scene is drawn into a linear half-float target (8-bit fallback if the device cannot); the existing post pass does bloom (linear), then tone mapping (Khronos Neutral, chosen because it keeps painted hex colours and only squeezes highlights), then the sRGB conversion once, then the grade (tint, saturation, contrast, vignette) in display space as before. No new pass, also on low.
- Lights are no longer multiplied by pi; `look.sunI` and `look.hemi` are now physical values (about pi times the old ones). New optional `look.exposure`: SS1 1.1, SS2 1.0, SS3 0.85.
- Retuned looks: SS1 greener ground bounce, SS2 stronger low sun and less saturation, SS3 darker moon and sky light; night windows and glow textures adjusted because additive light is now added in linear.
- Car paint env reflection 0.5 to 0.3 (the linear pipeline made the paint pale; **superseded** by the clear-coat paint in the entry below, which has its own env strength). No handling, bot or expected values changed.

## 2026-11-05 · Art: sRGB step follow-up (night pool, car gloss)
- The night headlight pool was never drawn (its triangles faced down and were culled); it is now double-sided, warm-white, narrower, strength 0.35. Street-lamp pools are less orange (they tinted the road pink). Night road self-light 0.36 to 0.8; the moon light on SS3 2.4 to 2.0 (darker blue car).
- High quality car paint is now MeshPhysicalMaterial with clearcoat (roughness 0.4, clearcoat 1) lit by a blurred copy of the stage's sky (PMREM, rebuilt once per stage on high only). Low keeps Lambert. Rival cars unchanged.

## 2026-11-05 · Art: graphics step 6, rival cars as 3D models with their own liveries
The 14 rival crews use the player's two bodies (Kestrel, Strada), each with or without the nose light bar, so four shapes in all, and 14 original liveries (8 designs x palettes, files `art/rival-liveries.js`, `art/rival-model.js`). A design is used by two crews at most, always with another palette and the other body. No real brands or famous liveries (no white with red/green, powder blue with orange, black and gold, stripes in Martini style). Rival behaviour, pace, collision circles and start gaps are untouched (`handling` and `bot` results identical).
- Cost control: geometry is shared by all rivals (built once per shape); only the livery texture (512x576 high, 256x288 low) and the wheel colours differ. Three levels of detail picked per frame: full model (nearest 3 rivals within 42 m, high quality only: clear-coat paint, spinning wheels, plates), coarse model to 80 m (48 m on low), bare shell beyond (about 700 triangles, 3 draw calls); nothing is drawn beyond the fog. Models are painted one rival per rendered frame, never during the physics loop.
- The old rivals were 11 unmerged boxes per car (22 draw calls each); the new ones use 3 to 13 draw calls each, but more triangles.
- `renderer.js`: if a future three.js changes the `color_vertex` chunk, a clear `console.error` is logged (the load test then fails, on purpose). The blurred sky reflection for clear-coat paint is only made when float render targets exist (`hdrOk`, now defined in `renderer.js`); otherwise the paint is plain glossy Phong.
- Superseded: the first sRGB entry's "car paint env reflection 0.5 to 0.3" (replaced by the clear-coat paint).

## 2026-11-05 · Art: graphics step 7, buildings as 3D models (plus shader pre-warm and the texture leak)
- **Houses** (`art/buildings.js`, replaces the old flat-box builder; same list API, new `style: 'japanese'`): windows and doors are real recesses (reveals, frames, sills, lintels, shutters, door step, canopy), balconies, plinth, gutter and downpipe, chimneys, roofs with eaves (hip, gable either way, shed, flat parapet), and three house forms (plain box, front-gable bay with a porch or garage beside it, lean-to). The house stays inside the footprint tracks planned (eaves reach 0.5 to 0.9 m beyond it); nothing about collisions or positions changed. The form, roof and colours come from the house position, not from the stage's random numbers, so every stage looks the same each time and no other scenery moved.
- **Japanese style** (SS3 outskirts): dark timber frame, plaster with a charred-board foot, curved-eave dark tile roof (hip or gable), engawa veranda with sliding paper doors (one storey) or a two-storey house with a lower pent roof, lattice windows, a paper lantern and a stone lantern. `planHouses` in `tracks/scenery.js` now gives every SS3 house `style: 'japanese'` (the style roll is still drawn, so no number after it changed; this is the only placement-data change, and it is `style` only).
- **Night**: window glass and paper screens are an unlit vertex-coloured mesh (some dark, some warm and bright; the bloom does the glow), lanterns and door lamps add glow dots (the existing Points mesh). No extra lights, no emissive textures. The four old facade textures (painted windows and their glow maps) are gone.
- **Draw calls**: one call makes 1 wall mesh and 1 roof mesh per style plus 1 trim mesh and 1 glass mesh for all styles (4 draw calls for a one-style village, 6 for two). Before: 2 per style.
- **SS3 neon town** (`townDetail`, called from `sceneryJapan`): real window frames and sills aligned with the painted windows, floor ledges, corner pilasters, parapets, shop awnings, balconies, air-conditioner boxes, roof clutter (stair hut, water tank, antenna with a red light, an occasional lit sign board). One extra trim mesh and one glass mesh. Look only: same positions and sizes, no random numbers drawn from the stage generator.
- **Low quality**: no mullions, shutter rails, balusters, quoins, gutters, canopies or ledges; half-size textures (the texture cache already did that). Triangles in the stage (static, all of it): SS1 high 495,842 -> 561,446 and low 495,842 -> 511,892; SS3 high 375,374 -> 436,456 and low 375,374 -> 400,316; SS2 unchanged. Texture cache (house textures included): SS1 high 16.6 -> 15.4 MB, SS3 high 23.3 -> 20.7 MB, low 5.5 -> 4.8 MB.
- **Shader pre-warm** (`prewarm()` in `art/post-process.js`): the first rendered frame after a stage loads or the quality changes dresses all 14 rivals at once, uploads their pictures and calls `renderer.compile` against the render target the scene is really drawn into (compiling against the screen would build a second, never-used set of programs: 18 extra). three 0.186 compiles invisible objects too, so rival shapes that are not on screen yet are included. Measured: the first frame in which rivals appear went from 13 to 39 ms down to 1 to 3 ms; programs did not grow when rivals appeared (also not before: the rival materials share programs with the car). The 14 liveries (about 20 MB on high) are now uploaded at stage load instead of one at a time during the race.
- **Texture leak fixed**: `art/car-model.js` declared a second `function disposeTree` in the same scope, which silently replaced the stage's own `disposeTree` (`tracks/stage-build.js`), so no stage texture or material was ever freed. The car one is now `disposeCarTree`; the stage one skips textures flagged `userData.keep` (art texture cache, tree and crowd pictures, sponsor boards) and also frees instanced meshes and custom depth materials. Measured over three rounds of loading all stages: textures in `renderer.info.memory` stay flat from the second round (high 79 / 77 / 80, low 41 / 39 / 42) instead of climbing every round.
- No handling, bot or expected values changed (`tests/run.js` identical to main: 77 pass).


## 2026-11-05 · Art: graphics step 8, trees and nature as 3D models
- **Trees** (`art/trees.js`, new): every tree is a real model made in code with vertex-colour shading (dark under each branch tier or blossom clump, light on top). Species: spruce, fir, snow spruce, snow fir (SS1), tall pine and fir (SS2), two cedars (SS3 pass), autumn broadleaf (SS1 lower forest), cherry with blossom clumps and crooked limbs (SS3). Broadleaf leaf colours are green / yellow-green / gold / orange / red-orange by the tree's position; per-tree tint, stretch and sway come from the position too. Wind is a sin in the vertex shader (one shared time uniform); none on low.
- **Nothing tracks owns moved.** Every tree and rock keeps the same position, scale, turn, collision circle and random draws (the old billboards used `Math.random` for tint and never called `colorFn`, so no stage draw was ever made there). Checked by hash against main, all 3 stages: obstacle lists, all 2600 / 610 / 1142 tree matrices, all rock matrices and rock instance colours are identical. Which species stands on a tree's spot is decided from its position only (`hash2`), so SS1 shows broadleaf trees on 0 to 55 % of the lower forest spots (fading out by s = 1600) instead of conifers there; trunk collision stays the old 0.3 m x scale.
- **Rocks**: faceted (flat-shaded, jittered icosphere, two shapes), a moss cap (SS1, SS3) or snow cap (SS1 snow zone, SS2 above the snow line) on the faces that point up, done in the vertex shader from the world normal, so the cap stays on top whatever the random turn.
- **Ground decoration** (`buildNature`, own generator `ST.seed * 131 + 7`, never collidable, never on the road: exact distance to the road samples at least 1.14 x half width + 0.9 m, off houses and steep ground, none in the town): grass tufts (straw-coloured on SS2), bushes (autumn tones SS1, olive SS2, azalea pink on SS3), flowers in the SS1 meadows (high only), reeds on the SS3 paddy dikes.
- **Level of detail** (decided so trees stay cheap): per species three meshes (near 0 to 46 m with 150 to 300 triangles, middle to 130 m about 30 to 100, far about 10 to 20 triangles, drawn to 93 % of the fog distance). Low: near to 26 m (about 70 to 120 triangles), middle to 80 m, far to 82 % of the fog distance, no shadows, no sway, no flowers, no tall tufts, tufts and bushes only up to 26 / 36 m. Trees are sorted into 40 m squares at stage load; `updateTrees` (called first in `renderFrame`) refills the meshes only when the camera moved 8 m or turned about 11 degrees, copies whole squares, drops squares behind the camera or past the fog, and uploads only the used part. Cost measured in headless Chrome: 0.02 to 0.2 ms per refill (a few per second at most), 0.0003 ms on frames without a refill. The old trees were never culled, so every frame drew all 2600 trees.
- **Numbers** (art commits only, before the denser woods; whole-branch numbers against main are in the 2026-11-06 tracks entry) (renderer.info, whole frame, camera 0): triangles within +/- 8 % of before on all stages, high SS1 541k to 529k / 536k, SS2 848k to 811k, SS3 400k to 405k / 423k / 433k; low SS1 502k to 493k, SS2 812k to 792k, SS3 380k to 380k / 370k / 372k. Draw calls go up: high SS1 72 to 92 (+ shadow passes of 8 tree meshes), low SS1 50 to 59, SS2 low 44 to 53, SS3 low 53 to 62. If a phone shows draw calls matter, the first cut is to drop the middle detail level on low (about 5 calls less).
- **Night (SS3)**: `look.foliageTint` [0.86, 0.6, 0.58] multiplies every plant colour (the blue moon light made the pink blossoms lilac); paddy water [0.27, 0.37, 0.5] and fields x 0.7 at night instead of [0.5, 0.74, 0.92] (stage-build.js, colours only, no random draw). New optional look keys: `foliageTint`, `rockCaps`.
- Removed: `drawPine`, `drawSakura`, `getTreeTex`, `crossedQuads`, `billboards` (the tree pictures); `treeStand` and `rockStand` replace them. The per-stage material for rocks is freed with the stage; the shared plant materials and cached geometries carry `userData.keep`.
- No handling, bot or expected values changed (`tests/run.js`: 77 pass, bot times identical).
- **Follow-up (same day, review fixes):** snow spruce / snow fir are green with white caps on the upper part of each tier only (rims and undersides stay green); conifers 15 % wider with more segments near, broadleaf and cherry canopies fuller (bigger, more detailed clumps), shading floors lifted; cherry foliage tint now [1.0, 0.82, 0.86] plus a faint pink glow (emissive) at night, tint no longer applied to conifers; tufts smaller and closer to the ground colour. Hashes of obstacles and instance matrices against main still identical; 77 pass.

## 2026-11-06 · Tracks: denser woods beside the road (trees step 8 follow-up)
- **What**: `woodExtras` (tracks/scenery.js) plans extra trees with its own generator (`ST.seed * 7919 + salt`), so every older tree, rock, board and wall stays where it was. Rows: near row 5.6 to 8 m beyond the road edge, then rows to 14, 24 and 40 m, bigger trees further back.
- **Forgiveness rule (qa review)**: no NEW collidable trunk closer than 8 m to the road edge (offset 8 m or more and measured distance to the road 8.2 m or more; trunk 0.3 x scale, same on both qualities, up to 14 m, cherries 12 m). The 5.6 to 8 m near row is visual only, only on straights: it is left out from 20 m before each corner to 60 m after it. Main's trees are untouched. Checked in the browser by diffing the obstacle lists against the branch before: new collidable trunks SS1 199, SS2 20, SS3 102, closest 8.25 m, 0 inside 8 m.
- **SS1**: mixed forest bands s 480 to 1750 (village unchanged), snowy spruce groups of 25 to 55 m on the crest. **SS2**: pines on the slope side (11 m or more out on the rock side) and on the valley slope below the road (16 m or more on the drop side), never on the wall. **SS3**: cedar groves on the pass (30 m clear of the torii tunnel), cherries in one or two rows along the country road, paddies open.
- **Kept clear**: gates (24 m), start/finish/village and tight-corner outsides (`frameKeepOut`), houses, existing trees (spacing), the inside of every corner with radius up to 120 m (20 m deep from 30 m before it).
- **Cost, whole branch against main** (qa, headless Chromium, same positions, renderer.info): draw calls low SS1 +11 to +14, SS2 -2 to +9, SS3 +11 to +12; high +10 to +19. They come from the art commits' per-species and detail-level meshes, not from the tracks rows (extra trees share the existing species groups). Triangles high SS1 -3.5 % to +22.8 %, SS2 -4 %, SS3 +34 % to +49.7 % (dense pass, shadows from the near trees); low SS1 -2.9 % to +1.9 %, SS2 -2.6 % to -2.1 %, SS3 -1.2 % to +5.8 %. Refill (`updateTrees`): 0.02 to 0.39 ms (qa's earlier one-off 2.4 ms on high SS1 was not reproduced). Bot times identical, no expected values changed.

## 2026-11-06 · Art: graphics step 9, spectators, gates, boards and trackside detail as 3D
- **Spectators** (`art/people.js`): the flat crowd cut-outs are gone; each crowd spot (same positions, same tape lines) now holds about 15 to 20 low-poly people in three rows behind the tape. Six poses (stand, cheer, point, sit, flag, camera), kids, 16 shirts / 8 trousers / 8 skins / 8 hair colours chosen per person from the position (own generator, none drawn from the stage's), caps and beanies, long hair. Animation is in the vertex shader only; people near the car cheer harder. Level of detail: full model (311 triangles high, 222 low) within 38 m (16 m low), a 56 / 40 triangle figure beyond, nothing past the fog (70 % on low, every second one past 40 m). Near people cast shadows on high only. Updated only when the camera moved 4 m or turned about 10 degrees. `trackside()` only got a `tag` on each spot ('start', 'finish', 'corner', 'jump') to pick the mix; no random draw or obstacle changed.
- **Gates** (`gateModel`): start and finish are inflatable arches (chambered legs, sandbags, blower, guy ropes, pennants; start has countdown lights, finish a chequered banner, flags and beacons), checkpoints are aluminium truss gantries with foam pads, ballast and spot lamps. Same position, width and banner text; the blower and generator stand outside the road. Night: lamps add glow dots.
- **Boards and barriers**: chevron and distance boards have a rim, back plate, bolts, clamps, a steel post and a foot (board moved 12 cm forward so the post is behind it); sponsor boards are framed with A-frame legs and a correctly readable back; tape lines have three stakes and a sagging red / white tape; corner rails have bolted posts and either a corrugated beam (SS3, `style: 'guard'`) or two timber boards. Positions and collision unchanged (the separate sponsor post and tape pole instance lists are folded into the new geometry).
- **Builders for tracks** (`art/details.js`): hay bales, flag poles, marshal post, photographers, service tent, TV tower, portable toilets, parked cars (3 kinds), signposts; arguments documented in the file header.
- **Cost** (renderer.info, whole frame, headless Chromium, before to after, start / near finish): high SS1 619,800 to 727,950 / 515,508 to 554,588, SS2 811,576 to 828,364 / 822,450 to 835,158, SS3 401,316 to 494,332 / 431,770 to 458,278; low SS1 519,074 to 562,326 / 477,596 to 491,740, SS2 794,498 to 804,630, SS3 377,600 to 415,822 / 378,904 to 392,888. Draw calls +1 to +13. Biggest cost is near people at the start crowds. Low was trimmed after these numbers (near 22 to 16 m); ui-mobile should re-check phone frame time. The mid-stage SS3 numbers are not comparable (tree level of detail was refilled differently in the two runs).
- No handling, bot or expected values changed.

## 2026-11-06: event detail placed on SS1-SS3 (tracks, `src/tracks/event-detail.js`)
- Start and finish areas (tents, flags, TV tower, loos, parked cars, signposts, marshals), marshal posts about every 500 m, photographers at hairpins and jumps, hay rows (visual only, 3.2 m from the edge) outside 2 fast corners, extra small spectator groups.
- Own seeded generator (`ST.seed * 131 + 7`); adds no obstacles; nothing placed on a drop side, inside a corner, in a gate zone or behind a wall. SS2 (cliff road) gets almost nothing by design: no flat ground beside the road.
- Low-quality cost: about +2 to 4% triangles, +8 to 13 draw calls on SS1 and SS3, none on SS2. Bot times unchanged (identical).
## 2026-11-06 · Tracks: new stage SS4 Thornwick Keep (gravel only, through a castle)
**Request (owner):** "make one new stage. It should be gravel only, set in a medieval fantasy environment. The track should go through a medieval castle." Name, place text ("Castle hills at dawn"), about 2.4 km and "joins the championship as stage 4" were decided by the main session; the owner may change them.
- **Route** (`STAGES[3]`, `id: 'thornwick'`, `theme: 'castle'`): 2.45 km (finish at s 2451, runoff 150), 20 corners, all gravel, `roadHalfWidth` 4.0 (SS2's narrowest is 3.7). Start below a village street (houses and low stone walls s 140 to 470, like SS1) -> forest with a bridge hump (jump 1.9 m at s 850) -> a climb with one hairpin -> straight approach -> gate 1 (s 1493) -> 40 m straight -> one tight right (Square right, r 18, around the well) -> gate 2 (s 1623) -> winding descent beside the wall and moat -> meadow finish. The pace notes say "..., then gate" on the corner before gate 1 and "Square right, around the well" in the courtyard.
- **Clock and rivals**: `timeStart` 31, `timeExt` [26, 31, 22, 16], checkpoints 560 / 1100 / 1700 / 2120. Bot times 94.73 s (Kestrel) and 95.53 s (Strada), clock 126 s, so 31 s over a clean run (SS1 is 38 s). The bot reaches the checkpoints with 12 / 17 / 22 / 26 s left. `refTime` 111 = 17 % slower than the bot (SS1 19 %, SS2 20 %, SS3 16 %). Bot: 0 spins, 0 rescues, 0 unrequested drifts, 0 collisions, off road 0.0 s and 0.6 s.
- **Expected values**: two new keys in `tests/expected.json` (`Thornwick Keep / ...`), recorded with `node tests/run.js bot --record`. The six old values are identical to before (checked in the record run output).
- **Ground**: new `castleBase` / `castleHeight` in `stages.js`. Gentle rolling country (about +-7 m) with a flat plateau (level 14 m) under the castle that eases down over 300 m; the road follows it, so the biggest climb is 10 % (s 1280, 20 m window) and the steepest drop 7.6 % (the bridge hump's back side 14 %, like the other crests). A ditch (moat) 5 to 17 m outside the walls, 3.4 m deep, crossed by causeways at the two gates because the road's own blend into the ground wins near the road. `track.js` got two optional stage keys, `roadHeight` (ground function for the road without the moat) and `roadSmooth` `{ W, passes }`; without them nothing changes (the other stages' times are identical).
- **Castle data for art** (`src/tracks/castle.js`, pure data, header describes it): `castleLayout(track, ST)` returns the castle frame (origin = middle of gate 1, u straight on, v right), wall rectangle, `walls` (curtain pieces, 3 m thick, 9 m high), `towers` (corner r 5.6, gate r 4.8, mid r 4.1), `gatehouses` (passage clear half width 4.4, clear height 7.0, blocks 7.6 m wide, depth 12 m, height 12.5 m), `buildings` (keep, hall, stable, chapel, barracks as `builder: 'block'`; smithy and gatekeeper as `builder: 'house'` which use `buildings()`), `well`, `moat` (water level, distances). `castleObstacles(layout)` is the collision list, `castleKeepOut` keeps trees, rocks and ground decoration out of the castle (`nearHouse` also checks it). The blockout meshes are in `src/tracks/castle-build.js` (`buildCastle`: stone, roof and moat water, three meshes plus the houses): art can replace them, the data stays. The courtyard ground tint (`castleCourt`) is in `stage-build.js`, and the `look` block in `stages.js` is a placeholder (misty morning) for art.
- **Collision**: walls, gatehouse blocks and buildings are segment obstacles (`h: 99`), towers and the well are circles, all tagged `castle` in the list. The gate passage is 8.8 m clear for an 8 m road, so there is a 0.4 m gap each side between road edge and wall; arch ceiling at 7 m. No hidden snags: apart from the gate walls, towers beside the gate and the wall that frames them, the nearest castle object to the road edge is the well (11.9 m), then the buildings (15.5 m). Camera modes 0 and 4 look through the arch from outside (checked in screenshots, no clipping); mode 1 stays inside the 7 m passage.
- **Forgiveness**: every tree and boulder you can hit is 8.6 m or more from the road edge, measured exactly (`gapOf`, not the terrain grid, which is only good to a few metres; the first version had trunks at 6.8 to 7.8 m). Nearer trees are for looks only. Solid walls in the village are SS1-style low walls. Field walls and fences stand 8.8 m away. Only the usual trackside furniture (boards, tape posts, chevron posts) is closer.
- **Files**: new `src/tracks/castle.js` (before `stages.js` in `parts.txt`) and `castle-build.js` (after `themes.js`); changed `stages.js`, `track.js`, `scenery.js` (houses, walls, keep-out for SS4), `themes.js` (`sceneryCastle`, crowds at the gates), `stage-build.js` (courtyard tint), `stage-load.js` (`castleL`, theme dispatch). No `ui/` or `page/` file was touched: the menu, the championship and the results screens already follow `STAGES.length`.
- **For ui-mobile**: on the 800x360 phone menu the fourth stage card is below the fold (the mobile test still passes: Start is reachable by scrolling, the same as before). Not changed here.
- **For art**: the stone looks very dark in the shade (blockout), the lintel over each arch is a flat box (an arch shape is yours), nothing is on the wall tops but merlons, no flags, no portcullis, no water shader.

## 2026-11-06 · Art: SS4 Thornwick Keep gets its real look (castle, village, dawn)
- **What**: the blockout in `tracks/castle-build.js` is replaced by the real castle, built from the same `castleLayout()` data (no position, size, collision or random draw moved). Obstacles are identical to the blockout commit 032665a (1190 entries, compared one by one; only the internal `_q` query stamp differs). Bot times are untouched (94.73 / 95.53).
- **Castle**: ashlar stone texture (courses, rain streaks, lichen) with moss at the foot (vertex colour ramp), batter plinths, corbels and string courses, crenellated wall walks (merlons + embrasures), arrow slits, 20 round towers (corner and gate towers have conical roofs: slate-blue, crimson tile, verdigris; mid towers are crenellated), pennants on every tower top. Gatehouses: a real pointed arch with a voussoir ring, tunnel vault, a raised portcullis (iron teeth hang below the arch, 3.1 m or more above the road at the edge, 5.5 m in the middle), oak gate leaves swung open flat against the gate blocks with iron straps and studs, torches, heraldic banners (waving) and a crest, banners on the gate towers, timber bridge posts and rails on the causeways. Courtyard: cobbles, keep (square, buttresses, four turrets with verdigris cones, pointed slate roof, banner), hall (steep slate roof, buttresses, lancets, rose windows, louvre), stable (stone foot, plank walls, hay-loft hatch, big doors, hay bales, thatch), chapel (belfry, rose window, buttresses), barracks (shuttered windows, chimneys, clay tiles), well with roof, crank, bucket and torches, market stalls, carts, barrels, crates and hay along the courtyard edge.
- **Heraldry (invented)**: house Thornwick = a golden thorn-ring on crimson (A), a crimson thorn-branch on teal and cream (B), crimson to gold pennant stripes (C). One 256 px picture.
- **Props are look only**: 18 pieces 8 m or more from the road edge (measured with `world.nearest`), outside buildings, towers, gates and the well. Nothing collidable was added.
- **Village and countryside**: new house style `timber` in `art/buildings.js` (half-timber walls from a generated texture, thatched roof); on SS4 only, `planHouses` switches the style value (`timber` instead of `plaster`; the random roll is still drawn, so positions and obstacles do not change). Stone houses on SS4 get a slate roof. Haystacks (22), a windmill (4 slow sails on high) and a watchtower (pennant) far from the road (60 m or more, not collidable, no obstacles).
- **Look block** (`look` in `stages.js`): dawn. Sun el 12, az 232 (behind the player on the approach, so the castle front glows and shadows run long ahead), warm sun 0xffc486, cool blue ambient with a warm ground bounce, peach mist (fog 38 to 330), golden cloud sky, pale ridges, dew-bright meadows. Conifer colours in `sceneryCastle` are a little warmer (same three random draws).
- **Moving parts (high only)**: banners and pennants wave in the vertex shader (one shared time uniform, `castleFx.ct`), moat water has a slow drifting ripple texture and a sun glint (Phong), forge and chimney smoke are 40 soft points moved on the CPU, windmill sails turn. Low: all still, plain Lambert water, no props, no studs and corbels, 12-sided towers, half-size textures. `updateCastleFx(dt)` is called from `renderFrame`; it returns at once on low and on other stages.
- **Cost** (renderer.info, one frame incl. shadow pass, headless Chromium, same places as the blockout): triangles high at the gatehouse 352k -> 401k (+14 %), courtyard 316k -> 358k (+13 %), village 431k -> 428k, descent 373k -> 394k (+5 %); low gatehouse 299k -> 313k (+4 %), courtyard 290k -> 304k (+5 %), village 324k -> 321k, descent 295k -> 297k. Draw calls high +10 to +18 (gatehouse 82 -> 100, courtyard 64 -> 74), low +6 to +9 (gatehouse 51 -> 57, courtyard 37 -> 46). Static castle meshes: stone 17k triangles, trim 9k (no shadow), slate 1.4k, clay 0.8k, wood 0.4k, glass 0.8k, flags 1k; far set 1.6k. Textures on SS4: 92 high / 55 low in `renderer.info.memory` (blockout 84 / 49). The castle houses (smithy, gatekeeper) are their own `buildings()` call: merged into the village list they made one mesh that spans 1 km and is drawn everywhere (+83k triangles, found and fixed). Other stages are unchanged. ui-mobile: please look at the extra calls on low (castle meshes are culled when you are not near the castle).

## 2026-11-07 · Tracks: practice stage "Test Track" (TEST) for judging the driving
**Request (owner):** "When rebuilding the driving model, make a 'test' stage with all surfaces where you can more easily test the driving mechanics."
- **Route** (`STAGES[4]`, `id: 'test'`, `practice: true`): 3.62 km, one open route (no crossings, nearest legs 48 m apart, which is the hairpin itself), 13 labelled sections written as `TEST_SECTIONS` in `stages.js` (surface changes, banners, bumps and the flat area follow the sections). Tarmac: sweeper (S-bend), 90 degree corner, hairpin, chicane. Gravel: two long sweepers, hairpin, slalom, 5 whoops (0.5 m, short) in a 280 m straight. Dirt: three medium corners, a crest jump (1.8 m) with 100 m flat landing. Drift area (gravel, flat, 14 m wide ring of radius 32 m, 188 m round, the grass island and the flat country around it are open, nothing solid). Snow: S-bend, hairpin. `roadHalfWidth` 7.0. Banner over the road at the start of each section (the SS1 gate arch, texts like "GRAVEL - SLALOM").
- **Nothing solid**: no trees, rocks, walls, houses, crowds, tape or sponsor boards; the corner and chevron boards are there for the pace notes but are not solid on this stage. A few non-solid trees 70 m or more back. Obstacle list of the stage: 0 entries. Terrain gentle (+-2 m), flat around the drift area (`flatRoad`).
- **Practice rules** (`practice: true`): no rivals (`setupRivals` clears them, `classify` returns only you), clock `timeStart` 99999 and the HUD shows `--` for clock and position, no checkpoints, start banner says "Test track: no clock, no rivals", results show the time and "Done" (no points table), best time saved under its own key `rallyBest_test`. Championship: `CHAMP_STAGES` (stages that are not practice) replaces `STAGES.length` in `ui/results.js`, so the championship ends at SS4; the TEST card is only reachable from the menu.
- **Tests**: the bot skips practice stages (`stageCount` in `tests/lib/probe.js` counts stages that are not practice), so SS1 to SS4 expected times are untouched and no value is recorded for TEST. The bot drove the Test Track once by hand with the old driving model: finishes with both cars, 0 rescues, 0 off-road, 0 unrequested drifts (about 128 s).
- **Other files touched** (small, for ui-mobile / core to review): `core/game-flow.js` (`startStage`: order and banner), `ui/results.js` (four `STAGES.length` -> `CHAMP_STAGES`, practice finish screen), `ui/visuals-hud.js` (`--` for clock and position), `tracks/track.js` (jump entries can be `[s, h, 'bump']`, "Full circle" pace note), `tracks/stage-load.js`, `themes.js`, `scenery.js`, `rivals.js`.

## 2026-11-11 · Tracks: rough spots (SS4 courtyard, SS2 wall clearance, wider gates, solid hay)
Owner approved the round ("go on with the steps as you described them"). All in `src/tracks/`; no handling change, one new per-obstacle option nobody else uses.
- **SS4 courtyard (late brake before the well)**: the well corner is now `['R', 90, 22]` (was 18) and the well is at `[40, 22]`; the co-driver note before gate 1 now says "..., then gate, brake for the well". The castle is placed from the route, so gate 2, the north wall and the rest of the course moved by a few metres with it (checked by eye at the gates and the courtyard). Late-braking test (both cars, 90/105/120 km/h, brake 0 to 45 m later than a 7 m/s2 stop, with and without handbrake): runs with a hit on something solid after the corner: 4 of 72 before (all at the gate 2 blocks, 44 to 71 km/h), 1 of 72 after (45 m late with the handbrake, 84 km/h at gate 2). The exact "wall near s 1511" slide could not be reproduced with the new driving; what the test did find were hits on the gate 2 blocks and the exit buildings from a wide exit.
- **SS4 gates wider**: `GATE.half` 4.4 to 5.6 (passage 11.2 m for an 8 m road; the blocks still end 12 m from the centre, so `blockW` 7.6 to 6.4 and the towers did not move). Gate test (both cars, both gates, start 3.6 / 2.5 / 0 / -2.5 / -3.6 m off centre at 18 and 30 m/s, 40 runs): runs with a hit 16 before, 2 after (both start at the road edge at 108 km/h and swing 5 m out before the gate).
- **SS2 drop-side walls**: they stood 0.8 m from the road edge (centre line 1.3 m, 0.5 m thick), so a car right on the edge (body radius 0.95) touched them. Now centre line 1.8 m, face 1.3 m (`buildRoadside` and `cliffBarriers`). Two small gaps in the drop wall at the start gate (s 13 to 18) and checkpoint 4 (s 1699 to 1702, the gate frames interrupt the drawn wall) are closed with the invisible wall (`cliffBarriers` now also covers 8 m either side of every gate on a drop side). Scan along the stage: unprotected drop runs 2 before, 0 after. Bot times unchanged.
- **Hay is solid** (`event-detail.js`): every hay row gets a wall of short segments, 1.2 m high (a jump clears it), bounce `e` 0.45 (default 0.18), scraping `mu` 0.12. Test: a car flung at a row at 60/100/130 km/h at 60 degrees keeps 30 to 47 km/h through the contact and is turned along the row, never past 80 degrees of slide; straight on at 90 degrees it bounces back (a car pinned by full throttle at 60 km/h is held for about 3 s, the same as any wall). `collideCar` itself is unchanged: hay uses the existing per-obstacle `e` and `mu`.
- **Bot times** (`--record`): SS1 and SS3 and SS2 unchanged, SS4 Kestrel 94.22 to 94.15 s, Strada 95.13 to 96.09 s (+1.0 %, off-road 1.6 s on the Strada, was under the limit before too). Tightest clock margin SS4 12.2 / 12.5 s, `refTime` 111 is 17.8 % above the Kestrel run, nothing else changed.

## 2026-11-11 · Audio: the retuned sound goes live, Modelled engine is the default
**Owner:** retuned sound is "okay for now"; "Do the default engine for now" (my suggestion: Modelled).
- Sound files copied from `audio/rally-sound` (not merged, it forked before the new driving): `src/audio/*` (engine-dsp.js, engine-samples.js, audio.js), co-driver voice in `core/game-flow.js`, pause-menu engine button and volume sliders, `docs/credits.md`. No physics, track or test file touched.
- Default engine is **Modelled** (no download, no embedded recording, lightest on phones). The player's choice (Modelled/Recorded) and the volume sliders are still saved on the device (`rallyAudio` in localStorage).
- Phone safety: sound starts on the first tap/key, now also wakes again when the tab comes back (`visibilitychange`) and every frame retries if the context is suspended; compressor plus a soft clipper (0.95) at the end of the chain; every path returns if audio is missing. Node count unchanged from the retune.
- Tyre and slide sound read wheel slip, grip use and body angle, which the new driving still provides; levels left as tuned.

## 2026-11-11 · Art: low, close chase camera with speed feel
**Request (owner):** the low, close chase camera ("go on with the steps as you described them").
- **What**: a new view, camera mode 1 in `art/camera.js`, the first one you get when you press C (or the touch camera button) from the default. It sits 4.6 m behind and 1.25 m above the car (old chase: 6.6 / 2.3), pulls back 1.8 m and rises 0.25 m with speed, and widens the field of view from 66 to 82 degrees (0 to 45 m/s, smoothed). It follows 65 % the direction of travel (35 % the nose), so in a slide it looks along the road, and it looks further into the corner you are turning through. Numbers live in `CONFIG.camera` (`close*`). Pure camera: no physics change.
- **Shake**: none on tarmac, 70 % of the usual surface rumble on loose ground, none in replays; none at all if the phone or browser asks for reduced motion (`prefers-reduced-motion`). Landing and hit shake still work (short, small).
- **Numbering**: the old chase view moved from mode 1 to mode 5 so the new one is next after the default; the other modes keep their numbers (cockpit 3 is used by sound, HUD and the blur).
- **Default stays the far rally camera (mode 0).** The new view makes speed read much better and the road edge stays clear, but being low it shows less of the road beyond a hairpin than the far rally view, so it is offered first, not forced. Change the default only after the owner has tried it.

## 2026-11-11 · Handling: phone driving pass (tilt steering and auto gas)
Package 2 "Phone first" (owner: "go on with package 2"). Keyboard driving is unchanged: every keyboard skid-pad number is identical to `main` and the handling rules and targets are untouched.
- **Why**: part tilt was close to all-or-nothing. A small tilt already gave a big slide (Kestrel on grass: 40 % tilt 25°, the same as full tilt; Strada on gravel: 40 % tilt swung out to 33° and wobbled 11°), and on auto gas the handbrake turn on gravel took 2.0 s instead of the 1.2 s target because the gas stayed on.
- **Part steering in the car** (`car.js`, `CONFIG.arcade.partHold` 1.0): a held part key (only tilt can give one) settles the slide at that share of the full key's hold angle. Keys are always 0 or full, so this never runs for them.
- **Tilt reading** (`ui/input.js`, ui-mobile's file, small change): the angle is now measured against the screen's up-down axis too (`atan2`), so it reads the same whether the phone is held upright or leaned back (until it is nearly flat). Re-centre: during the countdown the centre follows how the phone is held (up to 12°), then it stays put. No new button. The mapping moved to `handling/physics-step.js` (`tiltToSteer`).
- **Tilt mapping** (`CONFIG.arcade.phone`): dead zone 2.5° -> 3°, full lock at 22.5° -> 28° of tilt, gentle centre (`tiltCurve` 0.25), 0.05 s smoothing of the sensor (it was raw).
- **Auto gas** (`autoGasOn`): the gas is off while the handbrake is held and for 0.25 s after; after a brake tap (shorter than 0.35 s) it stays off 0.2 s more. Exception: if the car is already sliding more than 36° (`keepGasSlide`) when the brake goes on, the gas stays down through the brake and there is no lift, like holding gas on keys (a lift there pushed a big slide past the spin limit). Holding the gas button overrides all of it.
- **Numbers** (skid pad, 90 km/h, grass 50 km/h, with a ±1.4° hand shake; slide at 20 / 40 / 70 / 100 % of 28° tilt; before = `main` with its old tilt mapping):
  - Kestrel gravel 1.9 / 7.3 / 16.3 / 18.1° -> 0.8 / 2.7 / 7.7 / 17.8°; tarmac 0.5 / 1.4 / 2.5 / 2.9° -> 0.2 / 0.7 / 1.7 / 2.8°; grass 4.1 / 25.1 / 26.8 / 26.2° -> 1.1 / 5.0 / 13.1 / 26.2°.
  - Strada gravel 2.2 / 9.8 / 26.6 / 28.1° -> 0.9 / 3.6 / 11.7 / 28.0°; snow 2.7 / 12.5 / 19.4 / 21.7° -> 1.0 / 4.2 / 12.8 / 21.4°; grass 4.7 / 35.2 / 35.5 / 35.7° -> 1.1 / 6.0 / 17.7 / 35.5°.
  - Wobble at part tilt (20–70 %): up to 19° before (Strada dirt 70 %) -> at most 2.4° (Strada grass 70 %), 1.1° on the road surfaces. Full tilt is a held key, so its wobble is the keyboard one (Strada up to 17°).
  - Phone back to centre: under 5° within 0.63 s (grass 1.08 s), no overshoot.
  - Handbrake turn on auto gas (55 km/h gravel): 2.00 / 1.97 s -> 1.03 / 1.06 s (keys: 1.02 / 1.00 s).
  - Brake tap on auto gas, right button held: Kestrel gravel turns 37.9° -> 39.8° in 1.5 s, dirt 37.0° -> 39.4°; the tap itself already rotated the car (no tap: 31.3° / 30.0°).
- **New checks and expected values** (`tests/expected.json` -> `handling.phone`; cases in `tests/lib/skidpad.js` modes `tilt` and `autogas`, handbrake with `autoGas`): slide grows with tilt (≥ 0.3° a step), part tilt wobble ≤ 3°, 40 % tilt slides at most half as much as full tilt, full tilt inside the held-key range with the usual swing-out and letting-go limits, brake tap on auto gas turns ≥ 3° more on gravel and dirt and never breaks the spin limits, handbrake turn on auto gas meets the keyboard target. `tests/lib/probe.js` hands the skid pad the game's own `tiltToSteer`, `autoGasOn` and `gasStep`; `tests/run.js` prints two phone tables.
- **Big slide + brake tap on auto gas**: Strada on snow, full gas + full lock (about 125 km/h by then, sliding 42°), then a brake tap: main's auto gas (gas off while braking) gave 0.53 s past 45°, a 0.2 s lift on top 0.58 s, both over the 0.5 s limit. With `keepGasSlide` the gas stays down through that tap: 0.49 s, peak 47°, the same as keys holding gas, and it turns 32° in 1.5 s instead of 15–22°. The margin is small (0.01 s) and it is the keyboard's own number; widening it needs a car.js change, a separate handling task. No `knownIssues` entry.

## 2026-11-11 · QA: new `phone` test (real page on an emulated Android phone)
Package 2 "Phone first" (owner: "go on with package 2"). New `tests/phone.test.js` (`node tests/run.js phone`, about 55 s), expected values in `tests/expected.json` → `phone`. Test kit only; no game code touched. The test probe got a small `phone` block (read the controls' state, step the real `physicsStep`).
- **How**: one emulated phone (800x360, touch). Sensor events are sent as `devicemotion` (what the game listens to) with the screen angle faked (90, 270, 0), and the real physics step runs synchronously, so results repeat exactly. Touches are real multi-touch events through Chrome's DevTools protocol, so the game's own pointer code runs.
- **Tilt checks**: countdown re-centre of a phone held 8° off level, upright and leaned back 30° (tilt at GO within 1.5°, steering 0); 10° tilt gives steering 0.05–0.4 the right way, 40° gives ≥ 0.98, for both landscape angles and portrait, upright and leaned back 35°, tilting each way, and the car's heading turns the right way; 2.5° does nothing (dead zone); "Tilt (reversed)" (pressed through the real button) flips it; ±1.5° hand shake on a straight: steering ≤ 0.02 and heading drift ≤ 1°; with an 8° part tilt the steering varies by ≤ 0.12 and the slide wobbles at most 5° more than the same run without shake (measured: steering 0.05, +3.7°); no sensor events at all: steering stays centred, no errors, going back to Buttons brings the steer buttons back; no `DeviceMotionEvent` at all: pressing the Steering button raises no error.
- **Touch checks**: steer + handbrake + brake with three fingers register together; lifting one finger releases only its button; rolling a thumb from right to left switches steering; all fingers up and a cancelled touch leave nothing pressed; pressed buttons light up and go dark; the car really steers from a touch in the live loop; turning to portrait mid-race (finger down) shows the "turn your phone sideways" cover and pauses (the game's own rule); back in landscape the Resume button is on screen (≥ 40 px), tapping it resumes, all controls are on screen and big enough and respond. Auto gas off: GAS + steer + handbrake at once.
- **Auto gas** (80 km/h, right held, tarmac start): untouched gas stays ≥ 0.95; a 0.15 s brake tap and a 0.3 s handbrake press drop the gas to ≤ 0.3 and the car turns ≥ 3° more than without (measured: +15° and +32°); the gas is back ≥ 0.9 after 1.5 s; peak slide ≤ 90°.
- **Not tested on purpose**: frame time at quality Low. Headless Chrome has no GPU, so milliseconds per frame would say nothing about a phone (`gfx.test.js` already covers the auto-drop logic with fake frame times). Also cannot be tested here: the real sensor's noise and the iOS permission prompt.

## 2026-11-11 · UI: PC graphics by default on phones, with an automatic fallback
**Request (owner):** phone speed with PC graphics (`?gfx=pc` on the preview) was "perfect"; Package 2, "Phone first".
- **Default**: graphics quality is **High** on every device, phones included. Before, touch devices defaulted to Low.
- **Saved choice wins**: the Pause button and the auto-drop save to `rallyQualityV2`. The old key `rallyQuality` is read only on non-touch devices, because the old code saved "low" on every phone by itself at start (so it is not a player choice); phones that had it start on High once and can pick Low in Pause.
- **Auto-drop** (`autoQualityTick` in `ui/pause.js`): while driving (not in menu, loading, countdown, pause, replay), after 4 s of driving, if the smoothed frame time stays over **40 ms (under 25 fps) for 3 s in a row**, it switches to Low once, saves it, and shows a 4.5 s message ("Graphics set to Low / for smoother play. Change it in Pause"). It never switches back up by itself. Timers use wall-clock time (the game's own frame step is capped at 0.1 s). This replaces the old "LOW FRAME RATE" nudge (below 40 fps for 5 s) in `core/debug-replay.js`.
- **Switches kept**: `?gfx=pc` / `?gfx=high` = High for this visit only (not saved, no auto-drop) with the FPS counter; `?fps=1` = FPS counter only; new `?autogfx=0` = no auto-drop. These switches existed only on the preview page; they are now in the real game.
- **Test**: `tests/gfx.test.js` fakes slow frames with `window.__fakeFrameMs` (the container has no GPU).

## 2026-11-11 · Art: close chase camera raised a little
**Request (owner):** "place it a tad bit higher so the car blocks less of the screen and the road ahead is better visible."
- `CONFIG.camera` (a first try at 1.85 m alone made the car look bigger; measured and redone; a 6.8 m / 2.5 m version was dropped because it sat further back than the old chase view and stopped being close): `closeDistance` 4.6 to 5.6 m, `closeHeight` 1.25 to 2.2 m, `closeRise` 0.25 to 0.3 m, `closeLookAhead` 7 to 12 m (lower pitch, more road ahead). Pull-back rate, field of view and shake unchanged. Car's on-screen box at 130 km/h, 800x360, settled: Kettle Ridge 9149 to 8425 px (-8 %), Vulture Ledge 9035 to 8068 (-11 %), Sakura 3848 to 3390 (-12 %); the car also sits lower in the frame, so more road and horizon show above it. Default camera unchanged (mode 0). Also fixed the config comment (close cam is mode 1, not 5). Camera only, no physics.

## 2026-11-11 · UI: tilt falls back to buttons; best times per stage and per car
**Request (owner):** approved packages 2 and 3.
- **Tilt fallback** (`ui/input.js`): in tilt mode, if no usable sensor reading arrives within 2 s of the countdown/race (or iOS permission is refused), body gets `tilt-off`: the steer buttons come back and the banner says "Tilt not available / using buttons". The saved `rallyTilt` setting is not changed; switching steering mode retries.
- **Best times** (`core/game-flow.js` `loadBest`/`saveBest`): key `<stage bestKey>_<car id>` = `{ time, splits, v }`. The old per-stage value counts as the best for any car until a car beats it (then that car gets its own record). `v` = stage times version: `st.timesVer` (default 1); tracks bumps it when a stage is re-timed and older times (no `v` counts as 1) are then ignored.
- Menu card shows the selected car's best; finish screen shows "NEW BEST -x.xx s" (first time: "NEW BEST").
- Checks added to `tests/mobile.test.js` (tilt fallback, per-car save, card, NEW BEST). The first context is now closed before the next ones open, because three software-rendered pages at once caused `page.goto` timeouts.

## 2026-11-11 · Tracks: ghost of your best run, and a gap line (Package 3, "Reasons to replay")
**Request (owner):** "go on" on the producer's Package 3 plan.
- **Ghost** (`tracks/ghost.js`): every run is recorded at 10 samples/s (x, y, z, yaw, pitch, roll; 6 int16 per sample, deltas, base64). When a finished run is faster than the saved ghost for that **stage + car**, it is saved in `localStorage` (`rallyGhost1:<stage key>:<car id>`, versioned, try/catch, refused above 90 000 characters; a 91 s stage is about 14 KB). The next run of that stage + car shows it as a translucent blue car (the player car's triangles merged once into one mesh: one extra draw, no shadow, no collision, no per-frame allocation). Pause menu: "Ghost: On/Off" (default On, saved in `rallyGhost`). Hidden in the menu, in replays and after the finish. It touches no physics, no random numbers, no rivals, so bot times are unchanged (new test checks run 1 -> run 2 is identical).
- **Gap line** under the clock: "GHOST -0.1" (green = ahead of your best, red = behind) and the rival closest to you in time at this spot ("TANAKA +0.8"). Live, updated four times a second, only once past 20 m of the stage. Same time basis as the split gaps.
- Hooks outside tracks files, one line each: `ghostFrame();` in `ui/visuals-hud.js` `updateVisuals`; the line is the only change there. The Pause button and gap line are created from `ghost.js`, so page files are untouched. Looks (colour, opacity) are placeholders for art.
- New test `tests/ghost.test.js` (and `ghostInfo` in `tests/lib/probe.js`); `expected.json` unchanged.
