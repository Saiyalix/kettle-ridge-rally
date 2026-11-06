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
