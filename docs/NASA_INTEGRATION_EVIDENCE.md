# NASA integration evidence

This document retains the original research evidence and source citations. The physics and science modules remain unchanged in v10.3.1. The current player-card subset is in `data/nasa-resources.json`; current execution results and browser-test limits are in `VALIDATION_v10.3.1.md`.

## Reproduce

```sh
npm test
python tools/verify_release.py
npm run evidence
npm run gmat:prepare
```

Evidence generation executes the actual `Flight`, `Navigation` and `ScienceOperations` classes with the bundled Horizons data. Cases use seed 12, no random encounters and no player burns. These are controlled integration checks.

| Case | Physical result | Science complete | Trace agrees with game | Requirements passed |
| --- | --- | --- | --- | --- |
| moon | arrived | Yes | Yes | 6/6 |
| mars | arrived | Yes | Yes | 6/6 |
| pluto | arrived | Yes | Yes | 6/6 |
| proxima | arrived | Yes | Yes | 6/6 |
| incompatible-instrument | arrived | No | Yes | 4/6 |

Each case contains the observed record, requirement trace, CubeSat-process review, maturity review, eight separate instrument/radio trade-study JSONs and a Mission Viz export. The incompatible Mars camera fails the composition goal without preventing physical arrival. The alternative designs are reference-path projections, identified separately from the observed flight.

## Resource evidence

### NASA/JPL Horizons

- Official source: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Integration: A / Data.
- Original content: Geometric Cartesian position/velocity vectors for eleven bodies, source GM values, query parameters and frame/time metadata.
- Location: Horizons API vector tables; manifest body headers and parameters.
- Use: Bundled sampled positions and velocities set the moving gravity sources, date-specific injection states, trajectory predictions, live navigation, Earth range, and signal delay. Raw API responses, parameters, and hashes are included.
- Code: `data/horizons_v10/manifest.json`, `src/dynamics.js`, `src/navigation.js`, `src/mission.js`.
- Functions: `JplEphemeris.state`, `JplEphemeris.acceleration`, `presetForDate`, `Navigation.advance`, `linkGeometry`.
- Gameplay effect: Yes: ephemeris positions, gravity, planning, navigation, Earth range and light time.
- Reproduce: `npm test`; `python tools/verify_release.py`; `python tools/fetch_horizons_v10.py`.
- Result: Pass: retained date/range/interpolation, moving-gravity, navigation and communications tests; raw and binary hashes verified.
- Evidence: `data/horizons_v10/manifest.json`.
- Limits: Bounded Hermite interpolation over the bundled 2025-01-01 to 2051-01-01 samples; launches limited to 2025-01-01 through 2030-12-31. The existing point-mass multi-body model omits drag, radiation pressure and nonspherical gravity. Selected interpolation fixtures are not a global error bound.

### Design and Develop Science Missions

- Official source: https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf
- Integration: C / Method.
- Original content: Four mission segments; science-to-requirements design process; ConOps validation; measurable requirements and verification planning.
- Location: PDF pp. 8, 10, 13, 18–19.
- Use: Science goals link to six measured requirements, existing game checks, Pass/Fail results and verification evidence. The live score and success rules remain authoritative.
- Code: `src/mission.js`, `src/research/requirements.js`.
- Functions: `requirementsTrace`, `designChecks`, `ScienceOperations.report`.
- Gameplay effect: Existing mission checks; detailed analysis is offline.
- Reproduce: `npm run evidence`; `node --test tests/research.test.js`.
- Result: Pass: six requirements match ScienceOperations.report in four successful cases and one incompatible-instrument case.
- Evidence: `data/evidence/mars/requirements.json`.
- Limits: A mission-design process adaptation; NASA does not supply the game hardware thresholds. The existing game checks remain authoritative; the trace adds no score or success rule.

### NASA Goddard Mission Design Lab

- Official source: https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab
- Integration: C / Method.
- Original content: Tailored studies of requirements and design alternatives across spacecraft disciplines, including mass, power, propulsion, communications and cost.
- Location: Tailored Trade Study; MDL Capabilities; MDL Disciplines.
- Use: Alternatives use the selected craft mass, engine, propellant, power, instrument, radio and budget. Outputs include delta-v, power consumption, storage, data delivery, cost margins and projected feasibility.
- Code: `src/research/trade-study.js`, `src/mission.js`, `src/navigation.js`.
- Functions: `tradeStudy`, `tradeAlternatives`, `ScienceOperations.step`, `Navigation.remainingDV`.
- Gameplay effect: Analysis reads the existing parameters and science model; it does not change them.
- Reproduce: `npm run evidence`; `node --test tests/research.test.js`.
- Result: Pass: eight instrument/radio alternatives per case; measured mass, delta-v, power, storage, radio and cost differences use shared game functions.
- Evidence: `data/evidence/mars/trade-studies/index.json`.
- Limits: Hardware performance, prices and capacities are Educational Assumptions. Alternatives are coast-only reference-track projections with no encounters, pickups or player thrust. Resource rates use control seconds; projections are not full-duration energy-autonomy estimates.

### CubeSat 101

- Official source: https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf
- Integration: C / Method.
- Original content: Concept development, budget reserves, feasibility, design, mission coordination, documentation, ground communications, readiness reviews and operations.
- Location: Sections 2.1–2.4, 2.7, 2.9–2.10, 2.12, 2.16; PDF pp. 19–25, 27, 29–30, 33, 37.
- Use: ConOps, launch accommodation, resource accounting, ground delivery, operations and verification checks map to actual mission values. CubeSat dimensions, licensing and hardware qualification are listed as outside the model.
- Code: `src/research/requirements.js`.
- Functions: `cubeSatReview`.
- Gameplay effect: Offline review; no additional flight restriction.
- Reproduce: `npm run evidence`; `node --test tests/research.test.js`.
- Result: Pass: nine measured process checks, explicit hardware exclusions, and PDF/printed-page mapping verified.
- Evidence: `data/evidence/mars/cubesat-review.json`.
- Limits: Generic spacecraft, not a CubeSat-standard hardware design. Dispenser dimensions, RF licenses, environmental qualification and flight certification are outside the simulation. A 10% cost-reserve check follows the document recommendation when possible; it is advisory and uses the stated project denominator.

### Build It Yourself: A Learning Game About Telescopes

- Official source: https://science.nasa.gov/mission/webb/game-build-it-yourself/
- Integration: C / Method.
- Original content: The educational workflow in which selected science drives compatible instruments and engineering choices.
- Location: Build It Yourself introduction and Playing Hints.
- Use: Adapts its science-first design principle: each objective requires a matching measurement package. An incompatible instrument can still fly, but cannot satisfy the science mission. No source code or art was copied from this game.
- Code: `src/mission.js`, `src/mission-ui.js`.
- Functions: `ScienceOperations.report`, `designChecks`.
- Gameplay effect: Yes: existing objective/instrument compatibility and science-result checks; unchanged in 10.2.
- Reproduce: `node --test tests/mission.test.js tests/research.test.js`.
- Result: Pass: camera selection for the composition objective leaves physical arrival intact and fails the existing instrument/science checks.
- Evidence: `data/evidence/mars-incompatible/requirements.json`.
- Limits: Only the objective-to-measurement design workflow is adapted. No telescope-game source code, assets, wavelength tables or optics model are reused.

### Space mission concept development using concept maturity levels

- Official source: https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299
- Integration: C / Method.
- Original content: Iterative concept development, early feasibility/trades, science data products, evidence checklists and the limits of assigning maturity levels.
- Location: Paper pp. 2–5, 11, 14.
- Use: Mission concept, feasibility, trade studies, requirements, verification evidence and unresolved risks are assessed from the mission record. No official CML level is assigned.
- Code: `src/research/requirements.js`.
- Functions: `maturityReview`.
- Gameplay effect: Offline analysis; no score or result change.
- Reproduce: `npm run evidence`; `node --test tests/research.test.js`.
- Result: Pass: six evidence areas and unresolved risks use actual mission/trade data; officialCML remains null and the score is unchanged.
- Evidence: `data/evidence/mars/maturity.json`.
- Limits: Simplified evidence checklist; the complete original CML matrix is not implemented. No official maturity level, completeness threshold or independent review is claimed.

### NASA Image and Video Library / Hubble archives

- Official source: https://images.nasa.gov/
- Integration: A / Data.
- Original content: Six original NASA/partner archive renditions with image-specific source URLs, credits, file sizes and SHA-256 values.
- Location: Image records: PIA13008, PIA12954, PIA00407, PIA02653 and two attributed Proxima Hubble observations.
- Use: Successful flights unlock target-matched archived observations, retaining original image bytes, source URLs, credits, and SHA-256 hashes. They are not observations produced by the simulation.
- Code: `data/photos.json`, `src/photos.js`, `src/app.js`, `docs/IMAGE_CREDITS.md`.
- Functions: `renderAlbum`, `finishGame`.
- Gameplay effect: Yes: the existing target-matched archive reward collection.
- Reproduce: `npm test`; `python tools/verify_release.py`.
- Result: Pass: original archive image bytes and credit/source records retained; six local image hashes verified.
- Evidence: `data/photos.json`.
- Limits: Archive rewards are existing observations, not imagery produced by the simulated mission. Source credits and original processing descriptions remain applicable.

### General Mission Analysis Tool (GMAT)

- Official source: https://software.nasa.gov/software/GSC-19468-1
- Integration: E / Reference Only.
- Original content: NASA software catalog and R2025a release information used to prepare an optional matched-model benchmark.
- Location: NASA Software Catalog GSC-19468-1.
- Use: A matched Earth point-mass benchmark script, local reference and comparison utility are supplied. GMAT R2025a was not available, so no independent GMAT result is claimed.
- Code: `src/research/gmat.js`, `tools/gmat.mjs`.
- Functions: `gmatScript`, `gmatReference`, `compareGmat`.
- Gameplay effect: None.
- Reproduce: `npm run gmat:prepare`; `node --test tests/research.test.js`.
- Result: Not Executed: no GMAT executable or external output was available. Preparation and comparison-unit checks pass.
- Evidence: `data/evidence/gmat/status.json`.
- Limits: Script syntax and parameter assignments have not been validated by running GMAT. The prepared benchmark uses Earth point-mass gravity only, not the live eleven-body model. The synthetic offset test checks error calculations; it is not GMAT validation.

### NASA Mission Viz

- Official source: https://nasa.github.io/mission-viz/RMarkdown/Elliptical_Orbit_Design.html
- Integration: C / Method.
- Original content: Focus-centered ellipse, sequential Y/Z/X rotation matrices, eccentric/mean anomalies and Keplerian timing from the tutorial.
- Location: Generate a flat surface ellipse; Transform the flat ellipse into a 3D orbit; Propagate a Keplerian orbit.
- Use: The tutorial’s focus-centered ellipse, sequential 3D rotations and Kepler timing support an independent osculating-elements and XYZ export module. Actual JPL-based tracks are retained separately from illustrative ellipses.
- Code: `src/research/mission-viz.js`.
- Functions: `tutorialPoint`, `tutorialRotation`, `solveKepler`, `stateToElements`, `missionVizExport`.
- Gameplay effect: Offline export; the original 3D trajectory prediction is unchanged.
- Reproduce: `npm run evidence`; `node --test tests/research.test.js`.
- Result: Pass: tutorial ellipse agrees with independently integrated two-body motion within 0.001 km; state/element round trips and Kepler residual tests pass.
- Evidence: `data/evidence/moon/mission-viz.json`.
- Limits: Tutorial-derived Implementation; no NASA repository code copied because no applicable repository-wide license was established. Classical Z/X/Z orbital elements are explicitly converted to the tutorial Y/Z/X orientation. JSON/XYZ CSV are project-defined formats, not an official Mission Viz import API. Osculating conics do not replace the live multi-body propagation; relativistic Proxima is excluded.

### Visualize a Space Mission Using Virtual Reality (2023)

- Official source: https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/
- Integration: E / Reference Only.
- Original content: The linked educational challenge description only.
- Location: Challenge overview.
- Use: Background challenge reference. This release has no VR mode.
- Code: None.
- Functions: None.
- Gameplay effect: No.
- Reproduce: Not applicable; no executable integration.
- Result: Not integrated: reference link only.
- Limits: No VR runtime, NASA VR software or VR data are used.

### Canadian Space Agency: Games and activities

- Official source: https://www.asc-csa.gc.ca/eng/activities/
- Integration: E / Reference Only.
- Original content: The linked partner learning-resource collection only.
- Location: Games and activities index.
- Use: Additional space learning activities. No CSA data are used in the calculations.
- Code: None.
- Functions: None.
- Gameplay effect: No.
- Reproduce: Not applicable; no executable integration.
- Result: Not integrated: reference link only.
- Limits: No CSA data, software or executable methods are used.

## Mathematical and source checks

`tests/research.test.js` verifies measured requirements, input immutability, hardware trade relationships, CML scope, orbital-element round trips, Kepler residuals, and the tutorial ellipse against independent two-body integration. Circular, equatorial, polar, retrograde and hyperbolic states have explicit handling. Relativistic Proxima is excluded from Newtonian element conversion.

The Mission Viz tutorial uses Y/Z/X rotations and informal angle names. The independent implementation converts standard classical Z/X/Z orientation into that convention. It generalizes the focus offset to `a*e` and normalizes mean anomaly with `M mod (2*pi)`. Source commit, tree and download hashes are in `data/evidence/source-snapshots.json`.

The retained Horizons checks cover raw/binary hashes, interpolation fixtures, date bounds, moving-source gravity, physical encounter states, Earth range and light-time receipts. No extrapolation or substituted circular orbit is introduced.

GMAT remains Not Executed. Browser and platform checks are scoped in `VALIDATION.md`.
