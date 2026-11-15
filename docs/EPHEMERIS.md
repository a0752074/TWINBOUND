# Ephemeris data

The active runtime dataset is `data/horizons_v10`, not the older `data/ephemeris.bin` compatibility dataset. Each active body has a binary table, a compressed original Horizons JSON response, and metadata in `manifest.json`.

| Property | Value |
| --- | --- |
| Origin | Solar System barycenter, `CENTER=500@0` |
| Plane and reference | Ecliptic J2000 / ICRF |
| State type | Geometric Cartesian position and velocity, no light-time correction |
| Timescale | TDB |
| Units | AU and AU/day |
| Data interval | 2025-01-01 to 2051-01-01 |
| Launch-date interval | 2025-01-01 to 2030-12-31 |
| Interpolation | Cubic Hermite position and velocity |

Cadence is three hours for the Moon, six hours for Earth/Mercury, twelve hours for Venus, one day for Sun/Mars/Jupiter, and two days for the outer system barycenters. Exact values, sample counts, target IDs, GM values, radii, and query parameters are in the manifest. Bodies using system barycenters are not separate integrations of all their satellites.

`tools/fetch_horizons_v10.py` can refresh the data using the official API with Python's standard library and network access. Refreshing is unnecessary to play. The raw API signature and hashes let a reviewer trace the bundled data. `tools/verify_release.py` verifies hashes and sample sizes without contacting the API.

The midpoint query fixtures and interpolation reports remain in `data/validation`. Those are finite checks at selected samples, not a global error bound over every supported date or trajectory. `src/dynamics.js` rejects states outside the data interval.

The older `ephemeris.bin`, `ephemeris.json`, and `gravity_v3.json` remain for compatibility tests and historical tools. They are not the source used by the v10.1 player interface. Do not describe Proxima as a Horizons-based route.
