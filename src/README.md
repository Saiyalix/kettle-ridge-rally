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
| `tracks/castle.js` | tracks | SS4 castle **data** (no drawing): `castleLayout(track, ST)` = frame, curtain walls, towers, gatehouses, buildings, well, moat; `castleObstacles`, `castleKeepOut`. Art can rebuild the look from the same data. API in the file's header |
| `tracks/castle-build.js` | tracks (placement) + art (look) | Blockout meshes made from `castleLayout()` (walls, towers, gatehouses, keep, hall, well, moat). Art replaces the look; tracks owns the data and the collision |
| `tracks/scenery.js`, `themes.js`, `stage-load.js` | tracks + art | Where and how many, what you can hit → tracks. Textures, colours, materials, shapes → art |
| `tracks/rivals.js` | tracks + art | Rival pace, start gaps, bumping → tracks. Rival car models and colours → art |
| `art/textures.js`, `art/roadside.js` | art | Generated textures (road per surface, grass/soil, stone, wood, rock, plaster, trim, roof tiles) and look-builders for tracks: `stoneWall`, `woodFence`, `rockFace` (argument docs in the file) |
| `art/buildings.js` | art | `buildings(list)`: 3D houses (plaster, stone, japanese) from a list of footprints; `townDetail(list)`: depth for the SS3 neon town. Argument docs in the file |
| `art/modeller.js` | art | `modeller()`: tiny kit that merges boxes, tubes, spheres, quads and swept profiles into one vertex-coloured geometry (argument docs in the file) |
| `art/people.js` | art | 3D spectators: six poses, palette per person, shader animation, near / far level of detail. `crowdGroup(spot)`, `crowdAdd(list)` for tracks |
| `art/structures.js` | art | 3D gates (inflatable arch, truss), sign boards, sponsor boards, tape lines, guard rails |
| `art/details.js` | art | Builders for tracks to place: `hayBales`/`hayRow`, `flagPoles`, `marshalPosts`, `photographers`, `serviceTents`, `tvTowers`, `portaLoos`, `parkedCars`, `signPosts`, `spectatorGroup` (argument docs in the file) |
| `art/car-model.js` | art | Player car: two modelled bodies (Kestrel, Strada), wheels, brake lights, `applyLivery`, cockpit interior. Rebuilt when car / livery / quality changes |
| `art/car-geo.js`, `art/car-livery.js` | art | Geometry helpers (lofts, parts, livery atlas layout); livery choice API (`liveryList`, `liveryIndex`, `setLivery`) and the livery painter. Livery data: `CONFIG.cars[i].liveries` |
| `art/rival-liveries.js`, `art/rival-model.js` | art | The 14 rival liveries (designs + palettes + sponsors) and the shared rival models with three levels of detail (`updateRivalLOD`, called from `renderFrame`) |
| `art/*` | art | Lights, sky, fog, effects, cameras, post-processing (high quality) |
| `audio/audio.js` | audio | All synthesized sound |
| `core/game-flow.js` | shared | Co-driver voice (`say`, `pickVoice`, `setVoice`) → audio. Game flow (start, rescue, championship) → producer assigns, qa reviews closely |
| `ui/*`, `page/*` | ui-mobile | Menus, HUD, touch, CSS, HTML, `setQuality`; plus every `quality === 'low'` path and the low render scale in `art/post-process.js` |
| `core/helpers.js`, `boot.js`, `debug-replay.js`, `main-loop.js` | shared | Rarely changed. Producer assigns, qa reviews closely |

## Line sizes (to find your way)

| File | Lines | File | Lines |
|---|---|---|---|
| handling/car.js | 497 | tracks/themes.js | 310 |
| page/style.css | 345 | tracks/track.js | 242 |
| art/car-model.js | 477 | handling/config.js | 190 |
| tracks/rivals.js | 166 | audio/audio.js | 155 |
| page/body.html | 126 | tracks/scenery.js | 126 |
| ui/visuals-hud.js | 123 | tracks/stage-build.js | 123 |
