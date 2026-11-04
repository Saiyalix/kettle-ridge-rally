# Roadmap

Kept up to date by every department (from Round 3: by the producer). Newest changes at the top of each section.

## Done
- **Studio foundation** (2026-11-04): rulebook (`CLAUDE.md`), departments handling / tracks / qa, QA test kit (`tests/`), skills ship-a-build and handling-check, this roadmap and the decisions log.
- **Handling rebuilt**: arcade model (`CONFIG.arcade`, `Car.arcadeForces`) with the four handling rules; measured targets hold (see `tests/results/report.md`).
- **Phone controls**: on-screen steer / brake / handbrake / camera / reset / pause, auto gas, tilt steering, landscape layout.
- **3 stages**: SS1 Kettle Ridge (tarmac, gravel, snow), SS2 Vulture Ledge (gravel, dirt, cliffs), SS3 Sakura Touge (tarmac, gravel, neon town).
- **2 cars**: Kestrel GT4 (grippy, precise), Strada HF (light, loves a slide).
- Co-driver pace notes with voice, replays, rescue/respawn, championship mode, 15-car field with rivals on time.

## Next (in this order unless the owner says otherwise)
1. **Round 2: split `index.html` into modules** with a build script that stitches them back into one `index.html`; behaviour identical, proven by the test kit.
2. **Round 3: more departments**: art, audio, ui-mobile, producer.
3. **Fix: map label overlaps the HB button** on short phones (800×360): known issue in the test kit. (ui-mobile)
4. **Performance on mid-range phones**: target 30 fps; Sakura Touge's neon town is the heaviest stage.
5. **Best times leaderboard on the device**: top times per stage and car, saved locally (today only one best time per stage).
6. **Menu polish pass**: on short landscape phones the Start button sits below the fold (the menu scrolls); make Start visible without scrolling.
7. **Better HUD**: readability on small screens, cleaner minimap label.
8. **Engine and surface audio**: richer engine, distinct gravel / snow / tarmac sounds.
9. **More stages.**
10. **More cars.**

## Ideas (not planned yet)
- Weather and time of day variants of existing stages.
- Ghost car of your best run.
- Daily challenge stage with a fixed seed.
- Car damage that affects handling a little (would need owner approval: touches the handling rules).
- Branch preview link so PRs can be tested on the phone before merging.
