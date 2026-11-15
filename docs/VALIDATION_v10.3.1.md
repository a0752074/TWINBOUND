# Validation — TWINBOUND v10.3.1

## Executed checks

Environment: Node.js 24.22.1, Python 3.12.14, Linux. No public GitHub repository was connected or deployed.

| Command / check | Observed result |
| --- | --- |
| Original supplied v10.3.0 `npm test` | 137 passed, 0 failed before editing |
| v10.3.1 `npm test` | 151 passed, 0 failed |
| `python -m unittest discover -s tests -p test_server.py -v` | 9 passed; retained former-server development tests, not required by the game |
| `node tools/export_score_rules.mjs --check` | Passed; exact exported rules match source |
| `python tools/verify_release.py` | Passed; final check count is recorded in `data/validation/v1031/release-checks.txt` |
| `python tools/build_static.py` | Passed; complete static `dist/` generated |
| Repository-subpath HTTP test | Every built file loaded byte-for-byte under `/TWINBOUND/`; relative module and HTML references resolved; no API configuration in the build |
| Static Python launcher HTTP test | Root and JavaScript returned successfully; `/api/health` returned 404; launcher does not import `server.py` or create SQLite storage |
| Preservation locks | 165 original data, asset and core implementation files match v10.3.0 SHA-256 exactly; config differs only in VERSION and score rules only in gameVersion |

The complete unit output is in `data/validation/v1031/unit-tests.txt`. No tests are silently skipped in that suite. The optional browser suite below is separate and is **not** included in the 151 passes.

## Behavior covered by automated tests

- Four destinations, real JPL-date planning, Hermite interpolation, eleven-source gravity, adaptive Dormand–Prince integration, launch tangency, physical progress, finite thrust/fuel, navigation risk and real flyby arrival.
- Complete controlled science flights for Moon, Mars, Pluto and Proxima; instrument compatibility, power consumption, storage conservation, communications range and packet delay. Controlled science tests omit encounters as stated in their original fixtures; the campaign test separately exercises real randomized encounters.
- Original arcade arithmetic and equipment values against retained v9/v10.2 fixtures; original 3D bonus, 3D collision/visibility behavior, mission bonus and grade calculations.
- The actual application, trajectory Worker and analysis Worker execute in the existing Node DOM harness. Tests cover player entry, mission choices, source cards, view switching, thrust, pause/end, auto-save and report rendering. This harness does not emulate browser layout or rasterized Canvas.
- Local-board tests save A/B records; keep A's best after a lower result; replace its board entry after a higher result; retain all histories; separate four destinations; cap displayed ranks at 50; provide own best beyond 50; repeat ties consistently; exclude legacy/incompatible scoring; read existing archive states.
- Community UI tests show both players, open B's full report while A is active, change My Flights with the active player, preserve Legacy History, refresh locally and block switching during flight.
- Local storage fallback survives constructing a new archive instance. Separate test storage areas remain separate. Network-disabled tests call every local service operation and observe zero fetch calls. Storage quota failure keeps the live report available and reports the failure.

## Native browser and public-deployment limits

A real Chromium/Playwright test was attempted. Chromium failed **before a page could load**, because this execution environment disallows the AF_UNIX socket required by its process singleton (`Operation not permitted`). The available remote browser could not reach the local preview (`ERR_CONNECTION_REFUSED`). See `data/validation/v1031/browser-attempt.txt`.

Consequently, **native browser IndexedDB persistence, real browser-profile isolation, mobile/desktop visual layout, audible audio and the complete real-browser script were not verified here**. The archive database name, version, object store and IndexedDB transaction code remain the existing implementation; only newly saved row state changes from pending to saved. Logic/persistence tests above use the supported localStorage fallback and in-process DOM, not a claim of real IndexedDB execution.

The existing Canvas/SVG and Web Audio source, photos, collision/rendering code and original style sheets are byte-identical. That preservation check does not substitute for visual or listening QA.

GitHub Actions execution, an actual public Pages URL, external source-link reachability, Windows batch execution and Docker/Caddy deployment were not performed. The Windows batch file is unchanged; its Python launcher was exercised on Linux. Static-subpath HTTP checks establish file completeness and path resolution, not public hosting or browser security-policy behavior.

## Re-run real-browser checks

On a normal development computer with Node.js and Python available:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

On Windows, `python` should resolve in that terminal. Elsewhere set the `PYTHON` environment variable if needed. An existing Chromium can be selected with `BROWSER_EXECUTABLE`; `PLAYWRIGHT_MODULE` accepts an absolute path to an installed Playwright `index.mjs`. These are developer-only options, never player requirements.

The script builds the static game, serves `/TWINBOUND/` from a Node HTTP server with no Python API, uses disposable browser contexts, exercises both players and all four launch/end flows, checks IndexedDB best-score/history behavior and reloads, runs complete engine/pilot flights, checks the former retry interval for API traffic, inspects missing requests/errors, and captures desktop/mobile views. If it completes, it writes `data/validation/browser-v1031.json`. **That success file is deliberately absent from this package because the suite could not start here.** Generated screenshots stay outside the project and test player results are not bundled.

After publishing, follow [Deployment: public validation](DEPLOYMENT.md#4-validate-the-public-site). A manual sound check and visual inspection should accompany the automated suite.
