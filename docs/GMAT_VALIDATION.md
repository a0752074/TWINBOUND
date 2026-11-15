# GMAT comparison preparation

**Status: Not Executed.** GMAT R2025a was not installed in the build environment. The package includes an unexecuted script, an explicit model definition, a local reference and a comparison tool. It contains no claimed GMAT orbit, GMAT execution log or independent GMAT validation result.

The NASA Software Catalog entry is `https://software.nasa.gov/software/GSC-19468-1`. The prepared experiment is deliberately limited to a matched **Earth point-mass, zero-thrust** benchmark. It does not compare a two-body GMAT trajectory with the game's live eleven-body JPL model.

| Setting | Value |
| --- | --- |
| Frame/origin | EarthMJ2000Eq / Earth center |
| Epoch | GMAT TAIModJulian 21545 |
| Independent variable | Elapsed seconds from that epoch |
| Units | km, km/s, seconds |
| GM | 398600.43550702266 km³/s², matching the bundled Earth parameter |
| Initial state | [7000, 0, 0] km; [0, 7.5, 1] km/s |
| Forces | Earth point mass only; no drag, SRP, relativity or thrust |
| Sampling | Every 60 s through 3600 s |

The benchmark's inertial axes are explicitly EarthMJ2000Eq rather than the game's Ecliptic J2000. Both benchmark implementations use that same chosen frame. No civil UTC/TDB conversion is used: only elapsed time in this isolated, time-invariant force model is compared.

## Prepare and execute

```sh
npm run gmat:prepare
```

1. Open `data/evidence/gmat/benchmark.script` in GMAT R2025a and review its settings. The script has not been syntax-validated by a GMAT executable.
2. Confirm that the running application's Earth GM equals `case.json`. If that build requires a different mechanism for setting `Earth.Mu`, set the same value through its supported configuration before running. Do not interpret a GM mismatch as an integration error.
3. Run the mission. Retain the GMAT version, startup/configuration files, script, execution log and raw CSV report.
4. Copy `case.json` to `verified-model.json` and record execution provenance only after checking the actual settings and output.
5. Compare:

```sh
node tools/gmat.mjs compare gmat_raw.csv verified-model.json gmat-comparison
```

The comparison rejects mismatched frame, timescale and force fields. It computes position/velocity RMS and maximum errors at matching elapsed times, retaining raw output and model metadata. Supplying a CSV alone does not establish that GMAT produced it; provenance remains explicit. The local `twinbound-reference.json` is produced by the game's integration kernel and must not be relabeled as GMAT output.

An independent full eleven-body comparison, matched ephemeris kernels and powered-flight validation remain outside the completed evidence.
