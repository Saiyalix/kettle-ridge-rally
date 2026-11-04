# src/: the game, in parts

The live game is `index.html` in the repo root. It is **built** from these files:

```bash
node tools/build.js           # glue src/ into index.html
node tools/build.js --check   # is index.html up to date? (also a QA test)
node tools/build.js --where 1400   # which src file is line 1400 of index.html?
```

**Edit here, never in `index.html`.** Then build, then commit `src/` and `index.html` together.

How it works: `parts.txt` lists the files in order; the build glues them together exactly as they are, nothing added.
So each file is one consecutive piece of the old single file. Everything from `core/boot.js` to `core/main-loop.js`
runs inside one function (`boot()`), so those files share variables and only make sense glued together.
The build checks that the glued script is valid JavaScript and says which file an error is in.

## Who owns what

| Folder | Department | Files |
|---|---|---|
| `handling/` | handling | `config.js` (all `CONFIG` tunables; `CONFIG.camera` belongs to art), `car.js` (Car physics), `physics-step.js` (120 Hz step, input → car) |
| `tracks/` | tracks | `stages.js`, `track.js`, `collisions.js`, `stage-build.js` (ground, road), `scenery.js`, `themes.js`, `stage-load.js`, `rivals.js`, `checkpoints.js` |
| `art/` | art (Round 3) | `renderer.js` (lights, sky, fog), `car-model.js`, `effects.js` (particles, hit effects), `camera.js`, `post-process.js` |
| `audio/` | audio (Round 3) | `audio.js` |
| `ui/` | ui-mobile (Round 3) | `hud.js`, `input.js` (keyboard, touch, tilt), `menu.js`, `results.js`, `pause.js`, `visuals-hud.js` (per-frame HUD, pace-note display, minimap, dust) |
| `page/` | ui-mobile (Round 3) | `head.html`, `style.css` (all CSS), `body.html` (HUD/menu/touch HTML), `end.html` |
| `core/` | shared, qa reviews closely | `helpers.js`, `boot.js`, `game-flow.js` (state, start, rescue, championship), `debug-replay.js`, `main-loop.js` |

Until Round 3 creates art, audio and ui-mobile, the main session handles those folders, with a qa review as usual.

## Line sizes (to find your way)

| File | Lines | File | Lines |
|---|---|---|---|
| handling/car.js | 497 | tracks/themes.js | 310 |
| page/style.css | 345 | tracks/track.js | 242 |
| art/car-model.js | 185 | handling/config.js | 174 |
| tracks/rivals.js | 166 | audio/audio.js | 155 |
| page/body.html | 126 | tracks/scenery.js | 126 |
| ui/visuals-hud.js | 123 | tracks/stage-build.js | 123 |
