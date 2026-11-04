---
name: perf-pass
description: Make Kettle Ridge Rally run faster (frame rate on desktop and mid-range phones) without changing how it plays or looking worse. Use for performance, frame rate, lag, or "runs badly on my phone" tasks.
---

# Performance pass

Targets: 60 fps desktop, 30 fps mid-range phone. In the playtest that means CPU work per frame under
8 ms (desktop) and 25 ms (phone profile, CPU slowed 4x). The fps column is meaningless without a GPU.

1. **Measure first.** Full `node tools/playtest.js`. Find the stage/profile with the highest work ms.
2. **Find the cost.** Add temporary timing (`performance.now()`) around suspects in `frame()`: `physicsStep` loop,
   `updateRivals`, `updateVisuals`, particles, `updateCockpit`, minimap, `renderFrame` (post-processing).
   Count draw calls with `renderer.info.render.calls` and triangles with `.triangles`, per stage. Remove the
   temporary timing before committing.
3. **Usual wins, in order of safety:** merge static scenery into fewer meshes or `InstancedMesh`; share materials
   and textures; cut hidden or tiny distant objects; lower particle counts on `quality === 'low'`; skip HUD/canvas
   redraws when nothing changed; cheaper post-processing on low quality; lower shadow map size.
4. **Do not change gameplay.** The handling numbers must be identical to before (they are deterministic).
   If they moved, you changed behaviour: find out why.
5. **Do not make it look worse on desktop high quality.** Compare `desktop-stageN.png` before and after side by side.
   Low quality may lose detail; say what was dropped.
6. PR: a before/after table of work ms and draw calls per stage/profile, plus the screenshots.
