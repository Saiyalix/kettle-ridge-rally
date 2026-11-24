# Region bible: Varnholm

Owner request (2026-11-24): "Make the tracks more in tune with the area around ... Make them fit into a context, like it's in a real world."
Answers: Rich (towns, farms, power lines, trains, chimney smoke, cattle, many buildings, far landmarks); full region map with the same place names on signposts across stages and a map in the menu; run-in and run-out roads are scenery only, not drivable.

Owners of this file: producer (names, distances, map). tracks places things and writes pace-note text, art draws them, ui-mobile draws the menu map, from this file. Names and distances here win; change them here first.

## 1. The region

**Varnholm** is an invented island country, about 400 km from north to south and 180 km across. Hundreds of years ago it was a patchwork of small kingdoms, each settled by a different people, and traders from across the sea opened one harbour in the east. That is why the districts look nothing alike: a timber hill country, a high alpine spine, a stone-and-castle border land, a harbour coast with a very different building style, and a dry red plateau in the south. Roads and a single railway tie them together.

Every autumn the **Varnholm Grand Tour** runs five special stages, one per district, in a loop around the island. The tour is why one country has five very different stages. The pace-note voice, HUD and menu can call it "the Tour". Stage order on the map is SS1 north, then clockwise east, south, west.

Districts (map key colour hint in brackets):

| District | Where | Character | Stage |
|---|---|---|---|
| Kettle Wold (green) | north-centre | forest hills, sawmills, farms, cattle, snow on the high gravel | SS1 |
| Highgate Alps (grey-blue) | centre-east spine | high mountains, dams, cliffs, power lines | SS2 |
| Kazemi Coast (pink) | east coast | harbour towns, Japanese-style roofs, rail line, lit at night | SS3 |
| Cinder Reach (red) | south | dry plateau, mesas, old mines, dust | SS5 |
| Thornwick Marches (brown) | west | castle border land, stone villages, mill streams, forest | SS4 |

Central hub for all districts: **Port Varn** (the one big city, on the River Wend). It appears on signs in every stage.

## 2. Stages

Distances are road km as the signs show them. They are fixed: use exactly these on every sign (the table in "Shared names" below is the single source). The stage road itself is short (a few km); signs show the real-world road length to the named place, so signs never count down to the stage end.

### SS1 Kettle Ridge (Kettle Wold, forest hills)
- **Start:** Alderby (market village, church spire, farms). **Finish:** Sawmill Gap (sawmill, log stacks, river weir).
- **Connects:** the farm valley to the timber pass; the stage runs up out of Alderby and over the ridge.
- **Signs (3 to 6):** Sawmill Gap 6, Alderby 2 (behind the start), Highgate 38, Port Varn 71, Fenmouth 98.
- **Landmarks:** Kettle Tower (stone lookout on the ridge, far landmark, seen from the whole stage), church spire at Alderby, the sawmill chimney (smoke) at the finish, a pylon line crossing the valley.
- **Land use:** meadows with cattle and sheep at the start, farms and barns, then conifer forest, log yards, a timber railway siding, snow on the high gravel section. Run-in: farm road and cottages behind the start line. Run-out: sawmill yard and a village road behind the finish.

### SS2 Vulture Ledge (Highgate Alps, high mountains)
- **Start:** Highgate Lodge (ski-style lodge, car park, power sub-station). **Finish:** Coldwater Dam (concrete dam, spillway, visitor hut).
- **Connects:** the lodge valley to the reservoir over a cliff-side shelf road.
- **Signs:** Coldwater Dam 9, Highgate 1 (behind the start), Alderby 38, Port Varn 64, Kazemi 52 (via the pass).
- **Landmarks:** Vulture Crag (the pale cliff the road is cut into), Coldwater Dam wall at the finish, a cable car line, pylons over the pass, a small chapel at the lodge.
- **Land use:** bare rock, scree, alpine meadow, goat and cattle on the lower slopes, mountain huts, hydro station. Few trees. Run-in: lodge buildings and car park. Run-out: dam access road and the dam wall.

### SS3 Sakura Touge (Kazemi Coast, Japan at night)
- **Start:** Shimokaze (hillside onsen town, paper lanterns). **Finish:** Minato (the harbour, cranes, ferry pier).
- **Connects:** the hill town to the port down a mountain pass ("touge").
- **Signs:** Minato 8, Shimokaze 1 (behind the start), Kazemi 12, Port Varn 78, Highgate 52.
- **Landmarks:** Kazemi Tower (lit tower in Kazemi town, far landmark across the bay), the harbour cranes and a ferry at Minato, a railway viaduct with a passing train, a pagoda on the hill, neon shop streets.
- **Land use:** terraced fields and tea slopes, dense small houses, vending-machine lights, harbour industry. Night look: lit windows, street lamps, train windows. Run-in: lantern street. Run-out: harbour front.

### SS4 Thornwick Keep (Thornwick Marches, castle hills at dawn)
- **Start:** Thornwick (stone village, green, inn). **Finish:** Harl Mill (the mill, mill pond, bridge).
- **Connects:** the village to the mill through the castle gatehouse, along the border stream.
- **Signs:** Harl Mill 7, Thornwick 1 (behind the start), Port Varn 44, Fenmouth 51, Alderby 90.
- **Landmarks:** Thornwick Keep (the castle the route passes through), the mill wheel and chimney at the finish, a ruined watch tower on the far hill, a stone bridge, a church tower.
- **Land use:** village cottages and walls, small fields with sheep, woodland, chimney smoke at dawn, mist in the low ground. Run-in: the village green and inn. Run-out: mill yard and the mill pond.

### SS5 Cinder Wells (Cinder Reach, desert; planned, not built yet)
- **Start:** Cinder Wells (dusty oasis town, water tower, a few flat roofs). **Finish:** Red Mesa mine head (head frame, ore bins, rail spur).
- **Connects:** the town to the abandoned mine across the plateau.
- **Signs:** Red Mesa 8, Cinder Wells 1 (behind the start), Port Varn 82, Fenmouth 120, Dry Fork 15.
- **Landmarks:** Red Mesa (the big flat-topped rock, far landmark), the mine head frame, a water tower, windmill pumps, a long freight train on the plateau, a wind farm on the horizon.
- **Land use:** red sand, scrub, cattle ranch, mine buildings, rusting machinery, dry river bed. Run-in: the edge of town. Run-out: mine yard.

### Shared names (the single distance table)

Signs use these numbers whichever stage you are on. If a sign says a place, the number is from this table (nearest stage-road-centre; stage-specific numbers above are the same table read from that stage).

| Place | What | Appears on |
|---|---|---|
| **Port Varn** | the only city, hub | every stage |
| **Fenmouth** | west-coast fishing port | SS1, SS4, SS5 |
| **Highgate** | alpine town below the lodge | SS1, SS2, SS3 |
| **Alderby** | SS1 start village | SS1, SS2, SS4 |
| **Kazemi** | bay town, tower | SS2, SS3 |
| **Dry Fork** | crossroads in the south | SS5 and SS4 (as DRY FORK 112) |
| Sawmill Gap, Coldwater Dam, Minato, Harl Mill, Red Mesa | stage finishes | own stage, plus one far sign each: Sawmill Gap on SS2 (44), Coldwater Dam on SS1 (47), Minato on SS2 (60), Harl Mill on SS1 (96) |

Road km between hubs (use these when you need a new sign): Port Varn to Alderby 71, to Highgate 64, to Kazemi 78, to Thornwick 44, to Fenmouth 40, to Cinder Wells 82, to Dry Fork 70. Alderby to Highgate 38. Highgate to Kazemi 52. Thornwick to Fenmouth 51. Cinder Wells to Fenmouth 120. Keep sums honest: a far sign is never shorter than the straight map distance (1 grid unit is about 4 km).

## 3. Map layout for the menu (ui-mobile)

Grid 0..100 in x (west to east) and y (north to south, 0 at the top). Draw stylised: flat colour land, blue sea, simple lines. Keep it readable at 800x360: labels in short uppercase text, no more than about 14 labels.

**Coast** (land is inside this outline; sea outside). Closed polygon, clockwise from the north tip:
(42,4) (62,5) (78,12) (88,22) (92,36) (90,50) (94,62) (91,76) (80,88) (64,95) (46,96) (30,92) (16,84) (9,70) (8,56) (10,42) (16,28) (28,14).
Bay: an inlet at the Kazemi Coast, cut in around (92,60) to (82,66) and back to (92,72), so Kazemi and Minato sit on water.

**Mountains** (Highgate Alps, a grey ridge of small triangles): along (58,28) (66,32) (74,36) (82,42) (86,48). Add a few triangles at (45,18) for the Kettle Ridge hills (smaller, green).

**Rivers** (blue lines):
- River Wend: (74,40) (64,46) (50,52) Port Varn (34,58) (20,64) (9,68) at the west coast.
- River Aldwater: (60,16) Sawmill Gap (52,10) (46,5) to the north coast.
- Coldwater Reservoir: a small blue blob around (78,34).

**Towns** (dot plus label; stage start/finish points are marked separately below):

| Name | x | y | Dot |
|---|---|---|---|
| PORT VARN | 50 | 52 | big |
| FENMOUTH | 14 | 62 | small |
| KAZEMI | 84 | 56 | small |
| HIGHGATE | 66 | 40 | small |
| DRY FORK | 50 | 72 | small |

**Stages** (start = flag, finish = chequered dot, a short thick line between them showing the stage; the stage line is drawn straight or slightly curved):

| Stage | Start x,y | Finish x,y |
|---|---|---|
| SS1 | ALDERBY 46,24 | SAWMILL GAP 58,16 |
| SS2 | HIGHGATE LODGE 70,36 | COLDWATER DAM 78,32 |
| SS3 | SHIMOKAZE 86,64 | MINATO 90,72 |
| SS4 | THORNWICK 24,40 | HARL MILL 30,48 |
| SS5 | CINDER WELLS 42,82 | RED MESA 58,88 |

Label only the stage code and the start name on the map (for example "SS1 ALDERBY"); put the full stage name in the card the player taps. Colour each district's land patch slightly differently (see the table in section 1).

**Main roads** (thin lines, drawn under the stages): Port Varn to Alderby (50,52) (48,38) (46,24); Alderby to Highgate (46,24) (56,30) (66,40); Highgate to Kazemi (66,40) (76,50) (84,56); Port Varn to Highgate (50,52) (66,40); Port Varn to Thornwick (50,52) (36,46) (24,40); Port Varn to Fenmouth (50,52) (30,58) (14,62); Port Varn to Dry Fork (50,52) (50,72); Dry Fork to Cinder Wells (50,72) (42,82). One railway as a dashed line: Fenmouth, Port Varn, Highgate, Kazemi (same points as the roads).

## 4. Signpost text style

- UPPERCASE place names, a space, then the number in km, no "km" on small boards, "KM" on the big blue route boards. Arrows are the characters `<` `>` `^` drawn as arrow shapes by art; the text file keeps a plain arrow word if the font cannot draw it.
- Place names first, then the distance. One line per place, maximum 3 lines on a board, 4 to 8 characters per line when possible (for example "PORT VARN 71", never "The City of Port Varn, 71 kilometres").
- Two board types: (1) **direction board** (white on blue, place + km + arrow), (2) **village entry board** (white on black, place name only, used at the start and finish villages).
- Boards face the direction of travel. Place only the signs from the stage list. Use the exact numbers from section 2.
- The start and finish places appear on village entry boards just behind the start line and just after the finish.

Example boards:

| Stage | Board | Lines |
|---|---|---|
| SS1 | direction, just past the start | `SAWMILL GAP 6 >` / `HIGHGATE 38` / `PORT VARN 71` |
| SS1 | entry, start village | `ALDERBY` |
| SS2 | direction | `COLDWATER DAM 9 ^` / `ALDERBY 38` |
| SS2 | far, at the lodge | `KAZEMI 52 >` / `PORT VARN 64` |
| SS3 | direction | `MINATO 8 >` / `KAZEMI 12` / `PORT VARN 78` |
| SS3 | entry, start | `SHIMOKAZE` |
| SS4 | direction | `HARL MILL 7 ^` / `PORT VARN 44` / `FENMOUTH 51` |
| SS4 | entry, start | `THORNWICK` |
| SS5 | direction | `RED MESA 8 >` / `DRY FORK 15` / `PORT VARN 82` |
| SS5 | entry, start | `CINDER WELLS` |

## 5. Rules

1. **Invented names only.** No real places, countries, roads, brands, shops, car makes or teams on any sign, wall, billboard or map. Japanese-style words (Shimokaze, Minato, Kazemi, touge) are fine as invented names of an invented coast; do not copy real town names. If a name might exist, change it.
2. **Short and readable on a phone.** Place names at most 12 characters (two words only when needed, like PORT VARN), no accents, no punctuation. Sign text at least the size the HUD notes use.
3. **One source.** Every name and distance comes from this file. A stage may not invent a nearby named place; to add a place, add it here first (with grid position and distances) in the same PR.
4. **Not drivable.** Run-in and run-out roads, towns, farms and landmarks are scenery only. They never change the stage road, checkpoints, collision or clock, and must not move the bot times. Scenery stays out of the driving line (tracks owns placement and checks the bot).
5. **Phone cost.** Rich is the goal, but phones come first: the scenery follows the existing `quality === 'low'` paths (ui-mobile may thin it) and must not push the phone below the frame-rate limit from the roadmap's phone speed pass.
6. **Order of work:** one stage per PR: SS1 first, then SS4, SS2, SS3, SS5, then the region map in the menu. Each stage PR adds its signs and landmarks from this file only.
