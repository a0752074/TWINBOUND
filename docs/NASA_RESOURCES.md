# NASA resources — v10.3.1

A = direct NASA data; B = reused NASA source software; C = executable document/tutorial-derived method; D = design-principle reference; E = link only or not used. No item is classified as B in this release.

The player resource list contains Horizons, mission development, MDL, CubeSat 101, Build It Yourself, Mission Viz and archive imagery. Technical Trace shows implementation files and key functions. Concept-maturity analysis, GMAT preparation, VR and CSA references below are retained for provenance and are not player cards.

The original input audits remain `data/evidence/resource-audit-v101.json` and `resource-audit-v102.json`. The v10.3 runtime map is `data/evidence/resource-audit-v103.json`. `data/nasa-resources.json` contains the concise current player list. The table below retains the original source classifications, including research and background references.

| Resource | 10.1 category | 10.2 category/type | Functions | Original content |
| --- | --- | --- | --- | --- |
| NASA/JPL Horizons | A | A / Data | JplEphemeris.state, JplEphemeris.acceleration, presetForDate, Navigation.advance, linkGeometry | Horizons API vector tables; manifest body headers and parameters |
| Design and Develop Science Missions | C | C / Method | requirementsTrace, designChecks, ScienceOperations.report | PDF pp. 8, 10, 13, 18–19 |
| NASA Goddard Mission Design Lab | C | C / Method | tradeStudy, tradeAlternatives, ScienceOperations.step, Navigation.remainingDV | Tailored Trade Study; MDL Capabilities; MDL Disciplines |
| CubeSat 101 | D | C / Method | cubeSatReview | Sections 2.1–2.4, 2.7, 2.9–2.10, 2.12, 2.16; PDF pp. 19–25, 27, 29–30, 33, 37 |
| Build It Yourself: A Learning Game About Telescopes | C | C / Method | ScienceOperations.report, designChecks | Build It Yourself introduction and Playing Hints |
| Space mission concept development using concept maturity levels | D | C / Method | maturityReview | Paper pp. 2–5, 11, 14 |
| NASA Image and Video Library / Hubble archives | A | A / Data | renderAlbum, finishGame | Image records: PIA13008, PIA12954, PIA00407, PIA02653 and two attributed Proxima Hubble observations |
| General Mission Analysis Tool (GMAT) | E | E / Reference Only | gmatScript, gmatReference, compareGmat | NASA Software Catalog GSC-19468-1 |
| NASA Mission Viz | E | C / Method | tutorialPoint, tutorialRotation, solveKepler, stateToElements, missionVizExport | Generate a flat surface ellipse; Transform the flat ellipse into a 3D orbit; Propagate a Keplerian orbit |
| Visualize a Space Mission Using Virtual Reality (2023) | E | E / Reference Only | None | Challenge overview |
| Canadian Space Agency: Games and activities | E | E / Reference Only | None | Games and activities index |

## Scope

Horizons and archive images are direct data use. Mission-development, MDL, CubeSat, Mission Viz, telescope-game and CML entries are executable method adaptations. GMAT has preparation files but no executed software integration. VR and CSA citations remain in these technical documents.

The existing six mission-success checks, equipment prices, capacities and hardware parameters remain unchanged. Offline analyses expose measured evidence and design alternatives. All fictional hardware inputs are marked Educational Assumption. Mission Viz uses independently written source based on the tutorial, with no repository code reuse.

Source downloads and SHA-256 records are listed in `data/evidence/source-snapshots.json`. PDF pages are one-based; CubeSat citations also include printed page numbers. Source downloads are not needed for offline play or analysis.

See `NASA_INTEGRATION_EVIDENCE.md` for the per-resource evidence and `VALIDATION.md` for the final test scope.


## Retained mission integration and research evidence

| Resource | Player-facing use | Scoring effect | Retained offline evidence |
| --- | --- | --- | --- |
| Design and Develop Science Missions | Required instrument, design checks, readiness, measured flight report | Existing check pass fraction R and actual science D feed the independent bonus | Complete requirements trace |
| Mission Design Lab | Background tradeStudy estimates for mass, delta-v, power, data and cost | Actual minimum battery, final fuel and data integrity feed E; estimates themselves give no points | Full alternative design studies |
| CubeSat 101 | Concise mass, budget, instrument, duration and resource checks | Existing requirements gate full mission completion and qualified cost efficiency | Detailed CubeSat review and document citations |
| Telescope learning game | Objective → compatible instrument → actual result | Incompatible observations earn no science-return credit | Compatibility and data tests |
| Mission Viz | Expandable Trajectory Analysis with departure osculating elements, origin, epoch and units | None; no second orbit line or modified propagator | Kepler, rotations, round trips, full exports |
| Concept Maturity Levels | Measured readiness and report checks | No extra points for opening or ticking a checklist; no official level | Full maturity/evidence analysis |
| JPL Horizons and archive images | Existing live gravity, planning, navigation, signal delay and collection | Existing gameplay behavior retained | Original raw/binary samples, hashes and image bytes |
| GMAT | Technical documentation only | None | Preparation script, matched benchmark and truthful Not Executed status |

The new score weights, 20% reserve thresholds and cost reference are game balancing assumptions. The full formula and measured calibration appear in `MISSION_SCORE.md`. All player records now stay in the local browser; v10.3.1 makes no flight-service or leaderboard API requests. The main page no longer exposes raw JSON download controls. Technical sources and function paths remain expandable under NASA Data & Sources.

Current verification: `VALIDATION_v10.3.1.md`.
