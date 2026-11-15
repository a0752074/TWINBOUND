# Changed files — v10.3.1

Compared byte-for-byte with the supplied ZIP: **28 modified, 17 added, 0 removed**. All other original files are identical.

| File | Change | Purpose |
| --- | --- | --- |
| `.github/workflows/pages.yml` | modified | Keep main-branch Pages deployment; remove API configuration; add unit, data and scoring checks. |
| `Dockerfile` | modified | Serve static files and check the game root; remove database setup. |
| `README.md` | modified | Rewrite gameplay, exact physics/scoring, resources, local records, setup and Pages instructions in English. |
| `compose.yml` | modified | Remove the unused API-origin setting and database volume. |
| `data/mission-score-rules.json` | modified | Update gameVersion only; scoring version and every numeric rule remain identical. |
| `data/nasa-resources.json` | modified | Keep seven integrated-resource cards; retain research/background citations in technical documents. |
| `data/validation/v1031-changes.json` | added | Machine-readable source inventory and SHA-256 comparison against the supplied ZIP. |
| `data/validation/v1031-preservation.json` | added | Baseline locks for 165 original core/data/asset files, config and scoring values. |
| `data/validation/v1031/browser-attempt.txt` | added | Record the real-browser launch/connectivity block without claiming success. |
| `data/validation/v1031/former-server-tests.txt` | added | Actual output of the 9 retained former-API Python development tests. |
| `data/validation/v1031/release-checks.txt` | added | Actual final release-verifier output. |
| `data/validation/v1031/scoring-rules.txt` | added | Actual scoring-rule consistency-check output. |
| `data/validation/v1031/static-build.txt` | added | Actual full static-builder output. |
| `data/validation/v1031/unit-tests.txt` | added | Actual output of all 151 executed Node tests. |
| `deploy/env.example` | modified | Limit optional self-hosting configuration to its domain. |
| `docs/AI_USAGE.md` | modified | Point development disclosure to current validation. |
| `docs/CHANGED_FILES_v10.3.1.md` | added | This complete per-file change inventory. |
| `docs/CHANGELOG_v10.3.1.md` | added | Release summary and retained-core statement. |
| `docs/DEPLOYMENT.md` | modified | Complete repository creation/upload, Pages, placeholder and verification instructions. |
| `docs/MISSION_SCORE.md` | modified | Keep equations; identify former validator as optional and document current local storage. |
| `docs/NASA_INTEGRATION_EVIDENCE.md` | modified | Add a current-scope note while retaining original research evidence. |
| `docs/NASA_RESOURCES.md` | modified | Distinguish current player-card subset from retained original research citations. |
| `docs/SUBMISSION.md` | modified | Correct Pages source to GitHub Actions and link the current local-record deployment guide. |
| `docs/VALIDATION_v10.3.1.md` | added | Observed results, test scope and explicit browser/public-deployment limitations. |
| `index.html` | modified | Remove sync/model-documentation controls; promote Local Leaderboard; update subtitle and version. |
| `package.json` | modified | Set release 10.3.1 and expose the optional real-browser test command. |
| `run.py` | modified | Serve the unchanged full game with Python standard-library static HTTP; no API/database dependency. |
| `runtime-config.js` | modified | Leave a harmless compatibility comment; no longer loaded or included in static builds. |
| `src/app.js` | modified | Remove API setup, synchronization triggers and timer; save full records locally and show Flight saved. |
| `src/community-ui.js` | modified | Read local rankings/history, show current-player history and any player report, remove sync UI. |
| `src/config.js` | modified | Change VERSION only; every equipment and navigation value is identical. |
| `src/final.css` | modified | Style the existing leaderboard entry, concise traces and responsive header wrapping. |
| `src/flight-report.js` | modified | Shorten the orbital-analysis explanatory paragraph; preserve every report field. |
| `src/flight-service.js` | modified | Retain FlightArchive; add best-per-player Top 50, stable ties and local report/history reads. |
| `src/mission-ui.js` | modified | Shorten resource cards and show only source use plus implementation files/functions in Trace. |
| `tests/app-flow.test.js` | modified | Adapt original application-flow assertions to release 10.3.1 and local saving. |
| `tests/community-ui.test.js` | added | Exercise A/B table/report access, My Flights switching, Legacy History and flight guards. |
| `tests/flight-service.test.js` | modified | Replace obsolete remote-sync expectations with saved-record persistence and compatibility. |
| `tests/local-leaderboard.test.js` | added | Test best-score replacement, Top 50, four boards, ties, history retention, storage and no networking. |
| `tests/release-preservation.test.js` | added | Verify original numerical/gameplay/asset SHA-256 and unchanged non-version config/rules. |
| `tests/resources-ui.test.js` | added | Verify concise resource uses, real file paths and removal of obsolete controls/text. |
| `tests/static-build.test.js` | added | Serve all built bytes and relative references below /TWINBOUND/; exercise the static launcher. |
| `tools/build_release.py` | modified | Package the requested complete v10.3.1 ZIP name. |
| `tools/build_static.py` | modified | Build the full standalone static game and remove stale runtime API configuration. |
| `tools/test_browser.mjs` | added | Optional reproducible Playwright suite for native IndexedDB, real UI, profiles and subpath. |

The original physics, navigation, mission operations, scoring, encounters, Canvas/SVG rendering, Web Audio, images, JPL data and flight-record schema remain unchanged. `src/config.js` changes only the version; `data/mission-score-rules.json` changes only gameVersion. All original scientific and research documents remain available.

The optional real-browser suite could not start in this environment. See [validation](VALIDATION_v10.3.1.md) for the exact scope and blocker.
