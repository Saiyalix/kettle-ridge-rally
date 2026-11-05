# Roadmap

Kept up to date by the producer department. Newest changes at the top of each section.

## Done
- **Graphics step 3: three.js upgrade** (2026-11-05, PR #7): r128 -> 0.186.1, ES module + import map, same look by design.
- **Graphics step 2: Skies and lighting** (2026-11-05, PR #6): SS1 painted-cloud day, SS2 sunset, SS3 night (stars, moon, city skyline, lit windows, lamps, headlight pool, reflector posts); far hills ring, per-stage colour grade; fog now follows each stage. Old far camera kept as default, a lower far view added as camera mode 4 (owner's choice).
- **Graphics step 6: Retro HUD / compact HUD** (2026-11-05, branch `ui/compact-hud`, done out of order because the owner asked after phone testing): HUD covers 15.5% -> 7.0% of an 800x360 phone screen (19.4% -> 8.4% with a corner call, 21.6% -> 8.6% with a banner); desktop 15.1% -> 5.1%; a corner call no longer covers the centre (33% -> ~4%). One-line pace-note chip, small banners, thin START-GOAL progress bar, small rev dial + gear + speed, smaller minimap. Also fixes the known issue "map label overlaps the HB button" and covers "Better HUD".
- **Graphics step 1: Road and roadside** (2026-11-05, PR #4): per-surface road textures; roadside walls, fences, rock faces and village houses placed close to the road and solid; SS2 drop side covered 1766/1776 samples (582 before). Owner tested on phone: "Game runs fine. No issues on phone."
- **Round 3: full studio** (2026-11-04): new departments art, audio, ui-mobile, producer; ownership for every file in `src/README.md`, including shared files; PRs are merged as soon as qa says READY TO MERGE.
- **Round 2: game split into parts** (2026-11-04): `src/` holds the game in 33 files grouped by department; `tools/build.js` glues them into `index.html`. The built file is byte-for-byte the old one. New `build` test.
- **Studio foundation** (2026-11-04): rulebook (`CLAUDE.md`), departments handling / tracks / qa, QA test kit (`tests/`), skills ship-a-build and handling-check, this roadmap and the decisions log.
- **Handling rebuilt**: arcade model (`CONFIG.arcade`, `Car.arcadeForces`) with the four handling rules; measured targets hold (see `tests/results/report.md`).
- **Phone controls**: on-screen steer / brake / handbrake / camera / reset / pause, auto gas, tilt steering, landscape layout.
- **3 stages**: SS1 Kettle Ridge (tarmac, gravel, snow), SS2 Vulture Ledge (gravel, dirt, cliffs), SS3 Sakura Touge (tarmac, gravel, neon town).
- **2 cars**: Kestrel GT4 (grippy, precise), Strada HF (light, loves a slide).
- Co-driver pace notes with voice, replays, rescue/respawn, championship mode, 15-car field with rivals on time.

## Next (in this order unless the owner says otherwise)
**Graphics overhaul** (owner request 2026-11-04, extended 2026-11-05 with real 3D models built in code; one PR per step; qa checks each, then it is merged).
Style: a modern rendition of a 1990s arcade rally look, retro styling at higher resolution; original designs only. Handling tests must still pass at every step.
Phone cost (30 fps target, lighter version on phones) is checked by ui-mobile with each step. Steps 1, 2, 3 and 6 are done.
1. **Player cars as detailed 3D models + 4 liveries each, menu picker** (branch `gfx/4-cars-liveries`): in review; will be Done on merge. Kestrel GT4 = wide 4WD coupe (two-element wing, splitter, lit pop-up-style headlights), Strada HF = boxy hatch (bolted box flares, roof spoiler); glossy sky-reflecting paint, brake lights; 4 liveries each (Kestrel: Ridgeline, Midnight Blue, Magma, Alpine Mint; Strada: Signal Red, Lime Rush, Violet Storm, Arctic Shard), "Paint" picker in the menu, remembered per car; simpler car on Low quality. (art, ui-mobile)
2. **Colour-managed (sRGB) lighting pipeline**: follow-up from the three.js upgrade, split out of the cars step to keep it reviewable. (art)
3. **Rival cars with their own liveries.** (art)
4. **Buildings as 3D models, including Japanese-style for Sakura Touge.** (art, tracks)
5. **Trees and nature**: denser, layered trees, grass, rocks; night colours of sakura trees and rice paddies. (art, tracks)
6. **Spectators, signs, gates and barriers as 3D models.** (art, tracks)
7. **New low, close chase camera**: keep all existing cameras. (art)
8. **SS2 drop wall clearance**: keep the drop-side wall at least 1 m clear of stacked road sections on hairpins. (tracks)
9. **Performance on mid-range phones**: target 30 fps; Sakura Touge's neon town is the heaviest stage. Checked with every graphics step; this item is for anything left over. (ui-mobile, art)
10. **Best times leaderboard on the device**: top times per stage and car, saved locally. (ui-mobile)

## Ideas (not planned yet)
- Menu polish pass: on short landscape phones the Start button sits below the fold. (ui-mobile)
- Engine and surface audio: richer engine, distinct gravel / snow / tarmac sounds. (audio)
- More stages. (tracks, art)
- More cars. (handling, art)
- Weather and time of day variants of existing stages.
- Ghost car of your best run.
- Daily challenge stage with a fixed seed.
- Car damage that affects handling a little (would need owner approval: touches the handling rules).
- Branch preview link so PRs can be tested on the phone before merging.
- Turn the `boot()` parts into real JavaScript modules (each file with its own imports), one folder at a time. Only worth it if the shared-variable setup starts causing mistakes.
