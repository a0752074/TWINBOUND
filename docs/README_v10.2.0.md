# TWINBOUND 10.2.0

A space mission design game with NASA/JPL trajectories, science payloads, resource management, and optional first-person 3D flight.

## Start

Requirements: Python 3.10+ and a modern browser. No pip packages, Node.js, API keys or internet connection are required to play.

1. Extract the complete ZIP.
2. Windows: double-click `start_windows.bat`.
3. macOS/Linux: run `bash start_macos_linux.command`.

Alternatively, run `python run.py` (or `python3 run.py`) in the project folder. Open the printed URL, normally `http://127.0.0.1:8765`. Keep the terminal open; Ctrl+C stops the server. Open the site through the server rather than opening `index.html` directly.

## Play

Choose Moon, Mars, Pluto or Proxima Centauri. Select a launch date and load a reference transfer. Adjust the heading, injection speed and out-of-plane angle, then configure the spacecraft and science mission.

The game starts in the original **2D view**. Use arrows or WASD: left/right/up thrust; down cuts thrust. Releasing the keys coasts. P or Escape pauses.

Press **V**, or the view button beside Pause, to switch between 2D and the **3D cockpit** during flight:

| 3D control | Action |
| --- | --- |
| W / Up | Forward thrust |
| S / Down | Reverse thrust |
| A / Left, D / Right | Left/right thrust |
| Q, E | Descend/ascend |
| Space | Coast; navigation trim is also suppressed |
| V | Change view |
| P / Escape | Pause |

Touch controls are available on touch devices. Diagonal input shares the same engine thrust; adding axes does not multiply available thrust or fuel flow. Points earned while 3D is active receive an additional **25% cockpit bonus**. The original score formula, equipment multipliers, combos and awards remain unchanged. The bonus is recorded separately, and toggling views earns no points.

Use short burns. Momentum remains after release, so counter-thrust is needed to reduce drift. Correct course early: a large trajectory error can exceed the remaining fuel budget. Collect supplies, avoid impact cores, and review both the flight result and delivered science data.

![3D cockpit renderer preview](docs/images/cockpit-desktop.png)

Deterministic preview produced from the actual cockpit drawing code with `tools/render_cockpit.mjs`.

## NASA resources

The existing Horizons dataset, 11-body trajectory model, planning, navigation, science operations, prices and saved-game schema are retained. The new analysis modules run separately from the game.

| Resource | Integration |
| --- | --- |
| NASA/JPL Horizons | Actual position/velocity data for moving gravity sources, date-dependent transfers, navigation, Earth range and light time |
| Design and Develop Science Missions | Measured requirements, verification methods, results and source-page trace |
| Mission Design Lab | Mass, power, delta-v, communications, storage, cost and feasibility trade studies |
| CubeSat 101 | Applicable ConOps, accommodation, operations, communications and verification checks |
| NASA Mission Viz | Tutorial-derived ellipse, 3D rotations, Kepler timing and osculating-element exports |
| Concept Maturity Levels | Simplified evidence and risk checklist; no official CML level |
| GMAT R2025a | Prepared benchmark and comparison tools; **Not Executed** |

See [resource audit](docs/NASA_RESOURCES.md), [integration evidence](docs/NASA_INTEGRATION_EVIDENCE.md), [requirements](docs/MISSION_REQUIREMENTS_TRACE.md), [trade study](docs/ENGINEERING_TRADE_STUDY.md), [physics](docs/PHYSICS.md), [3D flight](docs/FLIGHT_3D.md), and [changes from 10.1](docs/CHANGELOG_v10.2.0.md).

Instrument specifications, radio rates, capacities and prices are **Educational Assumptions**, not NASA hardware specifications. The active solver is Dormand–Prince 5(4). Arrival is a flyby tolerance, not landing. The Proxima route uses an ideal relativistic drive. Archived image rewards retain their original credits.

## Tests and offline analysis

Node.js 18+ is required for these development tools; no npm install is needed.

```sh
npm test
python tools/verify_release.py
npm run evidence
npm run gmat:prepare
```

Analyze a mission report exported by the game:

```sh
node tools/research.mjs analyze TWINBOUND_mission_report.json mission-analysis
```

Reports contain requirements, CubeSat-process checks, eight instrument/radio alternatives, maturity evidence, and Mission Viz data. Bundled examples are in `data/evidence`. Successful and incompatible-instrument examples use actual game classes; trade alternatives are projections on an unchanged reference trajectory.

GMAT is not required to play or run the game tests. See [GMAT benchmark](docs/GMAT_VALIDATION.md) before attempting an external comparison. Research modules are absent from the game's dependency graph, so their failure cannot alter normal flight.

The browser stores progress locally and accepts existing v9/v10 saves. Standard runtime assets are bundled. The complete test scope and platform limits are in [validation](docs/VALIDATION.md). [Development credits](docs/AI_USAGE.md) describe AI assistance. [Submission resource text](docs/SUBMISSION_RESOURCES_EN.md) provides an English description for the project form.
