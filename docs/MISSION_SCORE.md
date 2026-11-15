# Mission scoring v10.3.0-1

The new score is computed in `src/mission-score.js`. `Flight.points()` retains the exact original arcade arithmetic. Its added award ledger only observes the already-computed differences; it does not change a multiplier, award, Combo, collision rule or destination difficulty. `record.score` and `arcadeScore` mean the same original rounded total, including earned 3D Bonus. `totalScore` is the new ranking value.

`Final = Arcade + round(LevelBonusCap × Q)`

`Q = 0.15 p R + 0.20 p E + 0.60 D + 0.05 F C`

All fractions are bounded to [0,1]. No new component is multiplied by the arcade equipment, destination, Combo or cockpit multipliers. Reopening reports and switching modes do not award points.

| Input | Measured source |
| --- | --- |
| p | Maximum actual `Navigation.progress` reached during this flight; no wall-clock or click progress |
| R | Passing fraction of the four existing `designChecks`: compatible instrument, wet mass, budget, duration |
| E | `0.40 BatteryHealth + 0.35 FuelHealth + 0.25 DataIntegrity` |
| BatteryHealth | Minimum measured battery reserve divided by 20% of capacity, capped at 1 |
| FuelHealth | Final remaining fuel divided by 20% of capacity, capped at 1 |
| DataIntegrity | `1 − dropped / generated`; zero when no data was generated |
| D | Valid credited data divided by required data, capped at 1 |
| F | 1 only for physical arrival, compatible fulfilled science data, and all existing design requirements; otherwise 0 |
| C | Qualified cost efficiency, described below; zero unless F=1 |

The 20% reserves, weights, caps and equipment prices are **Game Balancing Assumptions**, not NASA standards. NASA resources supply the mission-requirements and engineering-trade methods. No official NASA mission grade or CML level is assigned.

Science credits require actual observation time, generated data, and a compatible instrument. Moon/Mars/Pluto count Earth receipts only; stored and in-transit data earn no receipt credit. Proxima reuses the existing onboard archive criterion (`stored + transmitted`), with Earth delivery stated separately. Its ideal drive is not a measured interstellar mission. Data exceeding the target does not increase D above 1. Failed flights can retain real partial science return, while design and engineering terms are scaled by physical progress. The existing science operations tests preserve storage conservation, receipt delay and compatibility checks.

## Cost efficiency

For each allowed destination/objective pair, enumerate all 27 existing bus kits × 2 radios × 2 launch services with the required instrument. Retain combinations that pass existing instrument, launch-mass and fixed expanded-budget checks. The fixed minimum is the cheapest retained combination; the reference is their median cost. Lifetime is checked against the actual flight in F and R, rather than being invented as a different equipment rule. These values depend on existing versioned equipment data, not on the player's budget selection.

`C = clamp((ReferenceCost − ActualCost) / (ReferenceCost − MinimumValidCost), 0, 1)`

If no design qualifies or the denominator is zero, C=0. An incompatible, over-mass, over-budget, over-lifetime, failed or science-incomplete flight receives no cost award. Expensive equipment may improve engineering outcomes without receiving an automatic science multiplier. The original cheap-equipment arcade multiplier remains intact.

## Calibration

The successful-run medians below come from the recorded 36-flight sweep: three fixed seeds (12, 77, 429), all-Basic / all-Standard / all-Advanced kits, each destination, actual JPL navigation and unchanged encounters. The deterministic look-ahead test controller spends real fuel, takes real damage and collects existing pickups. It injects no health, energy, points, arrival flags or science data. Launch date is fixed to 2026-11-14; the generation timestamp in the evidence is the actual run time.

| Destination | Runs | Arrivals | Failures | Successful Arcade median | Fixed bonus cap (60%) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Moon | 9 | 8 | 1 | 16,599.5 | 9,960 |
| Mars | 9 | 7 | 2 | 37,727 | 22,636 |
| Pluto | 9 | 3 | 6 | 52,006 | 31,204 |
| Proxima Centauri | 9 | 4 | 5 | 81,444 | 48,866 |

This is an initial reproducible balance sample, not a claim about human success rates or perfectly fair difficulty. Different kit choices retain their original risks and arcade multipliers. Separate level boards avoid mixing different destination multipliers.

`data/validation/mission-score-calibration.json` contains every final sweep result, including failures. `mission-score-original-pilot.json` retains the earlier smoke controller's less successful sweep. The controller was improved for measurement; gameplay difficulty was not altered. `tools/calibrate_mission_score.mjs` reproduces the final sweep; it does not silently rewrite runtime caps.

Grades describe the game mission: complete missions earn A (Q≥0.90), B (Q≥0.75), or C. An incomplete flight with valid science earns Partial; a flight with no valid science earns No return. The report also shows physical arrival separately, so arrival alone does not imply science completion.

## Integrity and compatibility

The Local Leaderboard reads full browser archives; no server is required.

`tools/export_score_rules.mjs` exports the exact versioned equipment, objective, cap and cost-benchmark data used by the Python validator. `--check` detects drift. The retained former Python validator independently recomputes score components, checks the award ledger and science-data balance, and rejects invalid/non-finite/oversized inputs and mismatched versions. That developer-only validator is not used by the normal launcher or static site. Player IDs are local nicknames, not authenticated identities.

New records preserve `playerId`, UUID, game/scoring version, arcade/mission/final scores, mission grade/completion, launch configuration, spacecraft, science report, navigation history, gameplay counters, minimum battery reserve, maximum progress, award ledger, rule-based review and orbital analysis. Legacy records remain labeled and excluded from new rankings. Reports are read-only views and never re-award points.
