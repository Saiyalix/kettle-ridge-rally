# Decisions log

Every rule, target or expected value gets an entry: date, decision, reason. Newest first.
Values measured from the game on 2026-11-04 (`main` at commit 26e2180, three.js r128).

---

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
- Car paint env reflection 0.5 to 0.3 (the linear pipeline made the paint pale). No handling, bot or expected values changed.
