---
name: handling-check
description: Measure Kettle Ridge Rally's handling against the targets (held-key slide 2-10 degrees, turn-in 67-100 ms, same on all surfaces, no unrequested drifts, bot times and off-road) and show before/after numbers for a change. Use before and after any handling or track change, or when the owner asks how the car drives now.
---

# Handling check

1. **Before.** Note the current branch. Get the "before" numbers from `main`:
   ```bash
   git stash -u   # only if there are uncommitted changes
   git checkout main && node tests/run.js handling bot && cp tests/results/results.json /tmp/before.json
   git checkout - && git stash pop   # if you stashed
   ```
   (If the change is already committed on the branch, just check out `main`, run, copy, and come back.)
2. **After.** On the branch: `node tests/run.js handling bot`, result in `tests/results/results.json`.
3. **Compare** with a short Node one-liner or by reading both JSON files: `data.handling` rows (car, surface, kmh,
   slideDeg, wheelMs, pathMs) and `data.bot` rows (stageName, car, time, offRoadS, driftS).
4. **Show the owner** two small tables, only rows that changed (or "no change"):

```
Skid pad (slide ° / turn-in ms)       before        after
Strada, gravel, 80 km/h              7.7 / 100     6.9 / 100
...
Bot (time s / off-road s)            before        after
Sakura Touge, Strada                 88.13 / 0.0   88.90 / 0.4
```

   Then one plain sentence per table: what it means for how the car feels.
5. **Flag** any target outside its range (slide 2–10°, turn-in 67–100 ms up to 80 km/h, surfaces equal, no
   unrequested drifts, off-road ≤ 8 s) and any bot time that moved more than 3%.
