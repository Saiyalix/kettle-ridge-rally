# Roadmap

Kept up to date by the producer department. Newest changes at the top of each section.

## Done
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
- **2 cars**: Kestrel GT4 (grippy, precise), Strada HF (light, loves a slide).
- Co-driver pace notes with voice, replays, rescue/respawn, championship mode, 15-car field with rivals on time.

## Waiting on the owner
- **New sound** (branch `audio/rally-sound`): pick modelled or recorded engine, then it can go to review. (audio)

## Next (in this order unless the owner says otherwise)
1. **New low, close chase camera**: keep all existing cameras. (art)
2. **SS2 drop wall clearance**: keep the drop-side wall at least 1 m clear of stacked road sections on hairpins. (tracks)
3. **Performance on mid-range phones**: target 30 fps; Sakura Touge's neon town is the heaviest stage. (ui-mobile, art)
4. **Best times leaderboard on the device**: top times per stage and car, saved locally. (ui-mobile)
5. ~~**SS4 tuning**~~ done 2026-11-11 (courtyard corner gentler, wider gates, solid soft hay, Vulture wall clearance): see `docs/decisions.md`.
6. **Menu fit on short phones**: Start button and the SS4 card sit below the fold. (ui-mobile)

## Ideas (not planned yet)
- Engine and surface audio: richer engine, distinct gravel / snow / tarmac sounds. (audio)
- More stages. (tracks, art)
- More cars. (handling, art)
- Weather and time of day variants of existing stages.
- Ghost car of your best run.
- Daily challenge stage with a fixed seed.
- Car damage that affects handling a little (would need owner approval: touches the handling rules).
- Branch preview link so PRs can be tested on the phone before merging.
- Turn the `boot()` parts into real JavaScript modules (each file with its own imports), one folder at a time. Only worth it if the shared-variable setup starts causing mistakes.
