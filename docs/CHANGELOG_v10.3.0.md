# TWINBOUND v10.3.0 — Final Mission Edition

Based exclusively on the supplied v10.2.0 project. This release adds persistent shared mission results and fixes the reproduced high-altitude cockpit encounter failure.

## Player experience

- One Player ID welcome form, case-insensitive public nicknames, remembered ID, separate local profiles, and disabled switching during flight.
- A shared, per-destination Top 50 leaderboard with one best flight per player, deterministic tie ordering, own-best rank and paginated My Flights.
- Automatic UUID flight reports saved on the device and shared server, with a visible pending/rejected/synced state. Offline play and retry preserve results; device-only flights never masquerade as globally ranked.
- Readable report access from results, history and leaderboard. Reports retain spacecraft, launch, navigation, science, award ledger, score breakdown, orbital analysis and rule-based improvement suggestions.
- Separate NASA Mission Bonus and Final Score. The existing Arcade Score remains independently visible, and `record.score` keeps its original meaning.
- Compatible-instrument feedback, existing design checks, concise readiness, background reference-transfer estimates and compact actual science progress.
- Player JSON exports and raw verification-data links removed. Source URLs, technical traces, raw scientific data and research tools retained.

## Cockpit correction

The original 3D height allocation remained near world Z=0 while the pilot could move far away. New encounters now extend the existing predicted lane in Z. Objects keep their fixed world positions after creation; view switching does not move already assigned objects. Offscreen cues and a shared top-down contact radar retain awareness across perspective changes. No extra RNG draws, point multipliers, drag, free fuel, altered 2D difficulty, or changed navigation/arrival rules were introduced. See `COCKPIT_VISIBILITY_FIX.md` and the old/new render previews.

## Server and persistence

- `server.py`: Python standard-library HTTP API, SQLite WAL, parameterized SQL, bounded JSON input, independent score/data checks, request limits, immutable UUID idempotency, deterministic rankings and paginated queries.
- `run.py`: retained static asset service plus API, configurable external database path, local/LAN operation, explicit frontend-origin allowlist and no new game dependencies.
- `src/flight-service.js`: persistent IndexedDB flight archive, a localStorage fallback when IndexedDB is absent, pending queue, timeout/retry and confirmed-sync handling.
- Original browser save data remains intact. The first local ID adopts old settings and collections; legacy records are preserved separately and excluded from new ranking.
- Public deployment files for a persistent Docker/Caddy server and a separate GitHub Pages frontend. No live public deployment is claimed.

## Scores and evidence

`src/mission-score.js` owns all new pure scoring. A passive arcade award ledger, minimum battery history and maximum physical progress are added to `Flight`; the original arithmetic and snapshot meaning are preserved. Versioned rules exported to `data/mission-score-rules.json` support independent server validation.

The 36-flight seed/equipment calibration retains both successes and failures. Fixed per-level caps are 60% of successful Arcade medians. The earlier test-controller sweep is retained as well. No balance evidence is fabricated or omitted because it failed.

The NASA/JPL sample files, image bytes, original research functions, orbit integrator, navigation module, sprites, sounds and base styles are retained. Mission Viz mathematics are now also used for read-only report elements. Full trade studies execute in a Worker, while full requirements/CubeSat/CML exports and GMAT preparation remain available offline. GMAT execution status stays Not Executed.

## Compatibility and verification

New records use game version 10.3.0 and score version 10.3.0-1. Legacy `score` values are not retroactively given a mission bonus. Exact v10.2 seed/input/kit tests preserve 2D scores and encounters. 3D at the original lane height also preserves baseline awards; corrected high-altitude 3D encounters intentionally differ from the invisible-lane bug.

The historical byte-lock test was narrowed only for intentionally extended `storage.js`; unchanged physics/navigation/rendering assets remain locked. The old export-button UI test was replaced with welcome/save/report/player-isolation coverage, while actual Workers and all destinations remain exercised. Mission Viz is the only research mathematics added to the main module graph; full trade studies remain off the main thread.

See `VALIDATION_v10.3.0.md` for exact executed checks and limitations, and `DIFF_v10.2.0_to_v10.3.0.patch` plus `data/validation/changes-v103.json` for concrete file changes.
