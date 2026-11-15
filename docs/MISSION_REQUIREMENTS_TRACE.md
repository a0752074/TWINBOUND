# Mission requirements trace

NASA's **Design and Develop Science Missions**, Julie Levri, March 26, 2025, establishes the goal/concept/requirements/design/verification sequence (PDF p. 10), ConOps and validation criteria (p. 13), measurable data and resource requirements (pp. 18–19). Page numbers in this project are one-based PDF pages.

`requirementsTrace` in `src/research/requirements.js` reads the existing `ScienceOperations.report` result and reuses `designChecks` for consistency. It does not create a second mission-success rule.

| Requirement | Measured condition | Evidence |
| --- | --- | --- |
| REQ-SCI-001 | Instrument ID equals the selected objective's instrument | Existing compatibility check |
| REQ-LAUNCH-001 | Dry mass + maximum fuel ≤ selected capacity | Existing mass check, kg |
| REQ-COST-001 | Design price ≤ selected budget | Existing cost check, USD |
| REQ-OPS-001 | Actual simulated duration ≤ scenario lifetime | Existing lifetime check, TDB days |
| REQ-NAV-001 | Flight status is `arrived` | Existing physical arrival result |
| REQ-DATA-001 | Compatible delivered data ≥ required MB | Earth receipts, or the stated Proxima onboard archive |

The Proxima archive criterion uses stored plus transmitted observations, following the existing `ScienceOperations.report` definition. Ground receipt is reported separately.

Each JSON requirement contains its ID, science goal, measured actual value, comparison operator, threshold, units, verification method, result, evidence field and NASA document/page reference. Hardware thresholds and science volumes are the existing educational game values. The NASA presentation supplies the engineering method, not those numerical specifications.

The trace reports `alignedWithGame` and any contradiction between its measurements and the existing result. A trace failure affects the offline analysis only. It never changes score, arrival, photographs or stored progress.

## Reproduce

```sh
npm run evidence
node tools/research.mjs analyze TWINBOUND_mission_report.json mission-analysis
```

`data/evidence/mars/requirements.json` demonstrates a Mars composition mission with a spectrometer. `data/evidence/mars-incompatible/requirements.json` demonstrates the same objective with a camera: the instrument and science requirements fail, while physical arrival remains an arrival. Both use executed controlled flights through the normal dynamics and science classes.
