---
name: tune-handling
description: Change how the car drives in Kettle Ridge Rally (grip, drifting, steering, speed, jumps, spin protection) and prove the effect with the playtest. Use for any handling or physics feel request.
---

# Tune handling

Target feel (owner's brief): **arcade, forgiving, easy to drift, hard to spin.**

1. **Translate the request into knobs.** Write down the feel complaint, then pick the `CONFIG.arcade` /
   `CONFIG.car` values that cause it (map in `CLAUDE.md` → "Handling knobs"). Read `Car.step` / `arcadeForces`
   to confirm what a value really does before changing it.
2. **Get the reference numbers.** `node tools/playtest.js --quick` on the branch before changing anything,
   so you compare against the current code, not only the stored baseline.
3. **Change a few values at a time** (small steps, about 10–20%), with the comment in `CONFIG` updated.
4. **Measure.** Run the quick playtest again and compare per stage:
   - spins must stay 0 and rescues 0;
   - off-road time must not grow (forgiving = stays on the road);
   - "easier drift" should show as more drift time / higher average slide angle;
   - stage time may move a little; more than ~3% faster or slower changes difficulty, so check the clock
     (`timeStart` + `timeExt`) still leaves a margin and rival `refTime` still fits.
5. **Check both cars** (`CONFIG.cars`): the per-car multipliers sit on top of your change.
6. **Check the touch path:** auto-gas and tilt steering go through the same `physicsStep` inputs; a change that
   needs precise keyboard taps is wrong for phones.
7. In the PR, add a before/after table of the handling numbers and a "how to feel it" list
   (e.g. "SS2 hairpin after checkpoint 1: tap handbrake while turning in, the slide should hold longer").
8. If the change is intended and the owner approves it, re-save the baseline in that PR (`npm run baseline`).
