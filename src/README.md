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

| Folder / file | Department | Notes |
|---|---|---|
| `handling/config.js` | handling | All `CONFIG` tunables, except: `CONFIG.camera` and car colours in `CONFIG.cars` (`paint`, `stripe`, `skirt`, `number`) → art |
| `handling/car.js`, `handling/physics-step.js` | handling | Car physics; 120 Hz step, input → car |
| `tracks/stages.js` | tracks | Except each stage's `look: { … }` block (lighting, colours) → art |
| `tracks/track.js`, `collisions.js`, `checkpoints.js`, `stage-build.js` | tracks | Road, terrain, pace-note text, collisions, checkpoints |
| `tracks/scenery.js`, `themes.js`, `stage-load.js` | tracks + art | Where and how many, what you can hit → tracks. Textures, colours, materials, shapes → art |
| `tracks/rivals.js` | tracks + art | Rival pace, start gaps, bumping → tracks. Rival car models and colours → art |
| `art/*` | art | Lights, sky, fog, car model, effects, cameras, post-processing (high quality) |
| `audio/audio.js` | audio | All synthesized sound |
| `core/game-flow.js` | shared | Co-driver voice (`say`, `pickVoice`, `setVoice`) → audio. Game flow (start, rescue, championship) → producer assigns, qa reviews closely |
| `ui/*`, `page/*` | ui-mobile | Menus, HUD, touch, CSS, HTML, `setQuality`; plus every `quality === 'low'` path and the low render scale in `art/post-process.js` |
| `core/helpers.js`, `boot.js`, `debug-replay.js`, `main-loop.js` | shared | Rarely changed. Producer assigns, qa reviews closely |

## Line sizes (to find your way)

| File | Lines | File | Lines |
|---|---|---|---|
| handling/car.js | 497 | tracks/themes.js | 310 |
| page/style.css | 345 | tracks/track.js | 242 |
| art/car-model.js | 185 | handling/config.js | 174 |
| tracks/rivals.js | 166 | audio/audio.js | 155 |
| page/body.html | 126 | tracks/scenery.js | 126 |
| ui/visuals-hud.js | 123 | tracks/stage-build.js | 123 |
