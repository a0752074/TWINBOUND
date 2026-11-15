# Changes from 10.1.0

| Area | 10.2.0 behavior |
| --- | --- |
| Default play | Original 2D flight, controls, encounters and game rules |
| Cockpit | Optional first-person perspective with three translation axes and six thrust directions |
| Score | Original base formula retained; separate 25% bonus on awards earned during 3D flight |
| Physics and data | Horizons bytes, core dynamics, planning, navigation, original orbit renderer, art and audio retained |
| Science | Existing goal, instrument, mass, energy, storage and delivery rules retained |
| NASA analysis | Offline requirements, trade studies, CubeSat-process review, CML-informed checklist and Mission Viz exports |
| GMAT | Prepared matched benchmark; Not Executed |
| Text | Concise English instructions, source sections, equations and development credits |

The original `Flight.step`, `points`, `snapshot`, navigation/science methods and browser-save key remain available. `setFlightMode('2d' | '3d')` and `totalScore` are additive APIs. A flight that uses 3D adds `flightMode`, `baseScore`, `threeDBonus`, `threeDBonusRaw`, `threeDSeconds` and `localDepth` to its result. Existing save/record fields and the version-10 storage schema are retained. Record `score` includes the optional bonus; the separate fields provide the breakdown.

Same-seed, same-equipment and same-input tests compare the default 2D implementation with a 10.1 fixture, including full linked navigation/science reports. Research code is not imported by the game. The original `src/style.css` and `src/render.js` remain byte-identical; cockpit styles are a separate stylesheet. Required visible additions are the view button, 3D-only controls/bonus, revised help and source descriptions.
