# Roadmap

Kept up to date by the producer department. Newest changes at the top of each section.

## Done
- **Third car, Nightjar KR** (2026-11-12, owner: "slidey, distinctly different ... built to handle long drifts"): steady 32–34° drift on gravel, dirt and snow, 12–15° on tarmac, never quicker than the other two on the bot. Own long, low body and 4 liveries. Own targets in `CLAUDE.md`; tests check them per car. Owner decided damage stays looks only.
- **Full-game flow test** (2026-11-12, #40): new `flow` test plays menu → finish → replay, championship, pause, rescue, Test Track. The test kit waits longer on a busy machine.
- **Earlier corner warnings** (2026-11-12, #39): hairpin and square calls ~60 m earlier with ", brake!", sharp corners +30 m, orange note box for tight corners.
- **Phone speed pass** (2026-11-12, #38): ground drawn in tiles (about half the triangles per frame, same look), idle dust skipped, auto-drop to Low below ~28 fps. Low particle numbers confirmed.
- **Sharper look** (2026-11-12, #35 test page, #36 live): 4x MSAA, light sharpen, punchier stage colours, smoother edges. Render scale stays 0.72 x dpr on High (1.0 with 4x MSAA timed out the test browser). Owner tried it on the phone: "good".
- **Drift fix** (2026-11-12, #33): in a drift the car follows its nose on the gas, and drifting costs a little speed. Handling rule 5 reworded at the owner's request. Owner tried it on the phone: "good".
- **Effects** (2026-11-12, #34): dust, spray and sparks per surface, scuffs and dirt on the car after hits.
- **Best times and NEW BEST** (2026-11-11, #32): top time per stage and car saved on the device; tilt falls back to buttons when the phone has no sensor.
- **Ghost car** (2026-11-11, #31): ghost of your best run per stage and car, plus a time-gap line (ghost and nearest rival).
- **Phone tests** (2026-11-11, #30): new `phone` test on an emulated Android phone (tilt, multi-touch, rotation, auto gas).
- **Tilt and auto gas** (2026-11-11, #28): proportional tilt steering; auto gas lifts on handbrake and brake tap.
- **PC graphics by default on phones** (2026-11-11, #25): drops to Low by itself when frames stay slow. Test pages #26 and #29 let the owner try it before merging.
- **Chase camera** (2026-11-11, #23, tweak #27): new low, close camera with speed feel, raised a little. All older cameras kept.
- **Stage rough spots** (2026-11-11, #24): SS4 courtyard corner gentler, SS4 gates wider (passage 11.2 m), hay bales solid and soft, SS2 drop-side wall clearance.
- **New sound** (2026-11-11, #22): retuned sound, Modelled engine by default.
- **Menu fits short phones** (2026-11-11, #21): Start and the SS4 card reachable.
- **Dashboard kept live** (2026-11-11, #20): the main session updates it at every step.
- **New arcade driving live** (2026-11-10, branch `live/arcade-driving`): 90s-style arcade slides, weight shown on the body. Owner: "Driving is fine for now." `CLAUDE.md` handling rules and targets updated (owner approved). Tests rewritten for the new driving; the bot aims by direction of travel; new clock-holds check.
- **Test Track** (2026-11-10): practice stage with every surface, for judging the driving.
- **Stages adjusted for the new driving** (2026-11-10): Vulture hairpin wall moved, tarmac "Easy" pace-note radius fixed, Sakura trunks near the road are looks only, Vulture and Sakura clocks +1 s / +2 s, Vulture refTime 104, bot times re-recorded.
- **Graphics overhaul steps 1 to 9 live** (2026-11-05 to 11-09): 3D player cars with 4 liveries each and menu picker, sRGB lighting, rival cars with liveries, 3D buildings (Japanese style for Sakura), 3D trees and nature, spectators, gates and barriers, skies and lighting, road and roadside, small HUD, three.js 0.186.1.
- **SS4 Thornwick Keep** (castle, village, forest, dawn look) and trackside detail on SS1 to SS3 (spectators, gates, marshals, hay, crowds): live.
- **Preview page** with `?gfx=pc` (PC graphics on a phone): live.
- **Round 3: full studio** (2026-11-04): new departments art, audio, ui-mobile, producer; ownership for every file in `src/README.md`, including shared files; PRs are merged as soon as qa says READY TO MERGE.
- **Round 2: game split into parts** (2026-11-04): `src/` holds the game in 33 files grouped by department; `tools/build.js` glues them into `index.html`. The built file is byte-for-byte the old one. New `build` test.
- **Studio foundation** (2026-11-04): rulebook (`CLAUDE.md`), departments handling / tracks / qa, QA test kit (`tests/`), skills ship-a-build and handling-check, this roadmap and the decisions log.
- **Handling rebuilt**: arcade model (`CONFIG.arcade`, `Car.arcadeForces`) with the four handling rules; measured targets hold (see `tests/results/report.md`).
- **Phone controls**: on-screen steer / brake / handbrake / camera / reset / pause, auto gas, tilt steering, landscape layout.
- **4 stages**: SS1 Kettle Ridge (tarmac, gravel, snow), SS2 Vulture Ledge (gravel, dirt, cliffs), SS3 Sakura Touge (tarmac, gravel, neon town), SS4 Thornwick Keep (gravel only, village, forest, through a castle; blockout look, art dresses it next).
- **3 cars**: Kestrel GT4 (grippy, precise), Strada HF (light, loves a slide), Nightjar KR (drift car, 2026-11-12).
- Co-driver pace notes with voice, replays, rescue/respawn, championship mode, 15-car field with rivals on time.

## Waiting on the owner
- Try the Nightjar KR on the test page before it goes live.

## Next (in this order unless the owner says otherwise)
1. **Brighter dust and clearer grass clods**: the dust is modest, and green clods are hard to see on grass. (art)
2. **Fifth stage**: new route, theme and clock; needs bot times recorded. Route and theme to be picked by the producer plan. (tracks, art)

## Settled, no longer open
- Hay bales you can drive through: solved 2026-11-11, hay is solid and soft (#24).
- SS4 castle gates a bit wider: solved 2026-11-11, gate passage 11.2 m (#24).

## Ideas (not planned yet)
- Richer surface audio: more distinct gravel / snow / tarmac sounds. (audio)
- More stages. (tracks, art)
- Weather and time of day variants of existing stages.
- Daily challenge stage with a fixed seed.
- ~~Car damage that affects handling~~: decided 2026-11-12, the owner wants damage to stay looks only.
- Branch preview link so PRs can be tested on the phone before merging.
- Turn the `boot()` parts into real JavaScript modules (each file with its own imports), one folder at a time. Only worth it if the shared-variable setup starts causing mistakes.
