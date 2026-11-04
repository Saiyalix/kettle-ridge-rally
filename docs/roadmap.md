# Roadmap

Kept up to date by the producer department. Newest changes at the top of each section.

## Done
- **Round 3: full studio** (2026-11-04): new departments art, audio, ui-mobile, producer; ownership for every file in `src/README.md`, including shared files; PRs are merged as soon as qa says READY TO MERGE.
- **Round 2: game split into parts** (2026-11-04): `src/` holds the game in 33 files grouped by department; `tools/build.js` glues them into `index.html`. The built file is byte-for-byte the old one. New `build` test.
- **Studio foundation** (2026-11-04): rulebook (`CLAUDE.md`), departments handling / tracks / qa, QA test kit (`tests/`), skills ship-a-build and handling-check, this roadmap and the decisions log.
- **Handling rebuilt**: arcade model (`CONFIG.arcade`, `Car.arcadeForces`) with the four handling rules; measured targets hold (see `tests/results/report.md`).
- **Phone controls**: on-screen steer / brake / handbrake / camera / reset / pause, auto gas, tilt steering, landscape layout.
- **3 stages**: SS1 Kettle Ridge (tarmac, gravel, snow), SS2 Vulture Ledge (gravel, dirt, cliffs), SS3 Sakura Touge (tarmac, gravel, neon town).
- **2 cars**: Kestrel GT4 (grippy, precise), Strada HF (light, loves a slide).
- Co-driver pace notes with voice, replays, rescue/respawn, championship mode, 15-car field with rivals on time.

## Next (in this order unless the owner says otherwise)
**Graphics overhaul** (owner request 2026-11-04; one PR per step, in this order; qa checks each, then it is merged).
Style: smooth and modern, all textures generated in code, original designs only. Handling tests must still pass at every step.
Phone cost (30 fps target, lighter version on phones) is checked by ui-mobile with each step.
1. **Road and roadside**: road textures (streaky, tyre marks, loose gravel edges), wall / fence / building / rock-face looks (art); placing them close to the road, barriers so the car can hit walls (tracks).
2. **Skies and lighting**: painted cloud skies, a sunset look, a night look with a distant lit city. (art)
3. **Trees and nature**: denser, colourful, layered trees; better grass and rocks. (art, tracks)
4. **Car look**: bold original livery with invented sponsors and number plate, shinier finish. (art)
5. **New cameras**: add a low, close chase camera; keep all existing cameras. (art)
6. **Retro HUD**: big countdown digits, italic numbers, rev dial, start-to-goal progress bar; also covers readability on small screens and a cleaner minimap label (replaces "Better HUD"). (ui-mobile)

Then:
7. **Fix: map label overlaps the HB button** on short phones (800×360): known issue in the test kit. (ui-mobile)
8. **Performance on mid-range phones**: target 30 fps; Sakura Touge's neon town is the heaviest stage. Checked with every graphics step above; this item is for anything left over. (ui-mobile, art)
9. **Best times leaderboard on the device**: top times per stage and car, saved locally (today only one best time per stage). (ui-mobile)
10. **Menu polish pass**: on short landscape phones the Start button sits below the fold (the menu scrolls); make Start visible without scrolling. (ui-mobile)
11. **Engine and surface audio**: richer engine, distinct gravel / snow / tarmac sounds. (audio)
12. **More stages.** (tracks, art)
13. **More cars.** (handling, art)

## Ideas (not planned yet)
- Weather and time of day variants of existing stages.
- Ghost car of your best run.
- Daily challenge stage with a fixed seed.
- Car damage that affects handling a little (would need owner approval: touches the handling rules).
- Branch preview link so PRs can be tested on the phone before merging.
- Turn the `boot()` parts into real JavaScript modules (each file with its own imports), one folder at a time. Only worth it if the shared-variable setup starts causing mistakes.
