# TWINBOUND — Space Mission Design Game

**[Play TWINBOUND Online](https://a0752074.github.io/TWINBOUND/)**

TWINBOUND combines NASA data and mission-design methods with spacecraft engineering, date-dependent orbital simulation and a 2D / 3D flight game. Choose a destination, configure a spacecraft and science objective, plan a trajectory, fly through an encounter field, and review the mission's science return and score. Friends can take turns on the same computer and compare their best flights.

**[Watch the 30-second Gameplay Demo](https://youtu.be/T0G1cfsGDY8)**

## How to play

1. **Enter a Player ID.** Use 2–20 letters, digits, underscores or hyphens, beginning with a letter or digit. Spaces at either end are removed; case is ignored. No account or password is required.
2. **Choose a destination:** Moon (Beginner), Mars (Intermediate), Pluto (Hard), or Proxima Centauri (Expert).
3. **Design your spacecraft.** Choose engine, hull and power tiers. Price, mass, fuel, protection, energy and the arcade multiplier differ.
4. **Select your science mission.** Match the instrument to the objective; choose a radio, injection service and budget. Check Mission Readiness and the configuration estimate.
5. **Set a launch date.** Supported launch dates are 2025-01-01 through 2030-12-31.
6. **Plan the trajectory.** Start with **Load reference transfer**, then adjust heading, injection speed and out-of-plane angle or drag the launch arrow. Inspect predicted closest approach and encounter time. Proxima uses a cruise-speed limit instead of injection speed.
7. **Launch.** Player switching is disabled during flight.
8. **Fly in 2D or 3D.** Make short thrust corrections and follow navigation guidance.
9. **Avoid obstacles and collect resources.** Fuel and energy crystals replenish reserves; repair pickups restore one hull cell. Comet halos contain supplies. Black holes are fictional game hazards.
10. **Complete or end the flight and review the result.** Science observations run automatically when conditions allow. Arrival and science completion are assessed separately. The complete flight report is saved automatically.
11. **Open Local Leaderboard.** Compare best scores or open **My Flights** for all of the current player's reports. Use **Switch Player** for the next person.

| Action | 2D | 3D cockpit |
| --- | --- | --- |
| Left / right thrust | A / D or Left / Right | A / D or Left / Right |
| Forward thrust | W or Up | W or Up |
| Reverse thrust | — | S or Down |
| Descend / ascend | — | Q / E |
| Explicit coast | S or Down | Space |
| Switch view | V or view button | V or view button |
| Pause / resume | P or Escape | P or Escape |

On-screen controls provide the same actions. Releasing thrust preserves momentum. Explicit coast also suppresses automatic correction; simply releasing keys permits limited navigation assistance. Switching views preserves the flight, objects, fuel and score. Spatial depth and three-axis collision checks apply in 3D.

## Physics and mathematics

See [Physics](docs/PHYSICS.md), [Ephemerides](docs/EPHEMERIS.md) and [3D flight](docs/FLIGHT_3D.md) for details and assumptions.

### NASA/JPL ephemerides

Bundled NASA/JPL Horizons geometric position and velocity vectors cover **2025-01-01 to 2051-01-01**. They use **Solar System barycentric Ecliptic J2000**, **TDB**, **AU** and **AU/day**. The chosen launch date sets **00:00 TDB**, rather than the player's local midnight. Cubic Hermite interpolation uses sampled positions and velocities without extrapolation. Sampling intervals vary by body from 0.125 to 2 days. Raw responses, query parameters and hashes accompany the binary samples in `data/horizons_v10/`.

### N-body gravity

For spacecraft position $\mathbf r$, source positions $\mathbf r_i(t)$ and gravitational parameters $GM_i$:

$$
\mathbf a(t,\mathbf r)=\sum_i GM_i\frac{\mathbf r_i(t)-\mathbf r}{|\mathbf r_i(t)-\mathbf r|^3},\qquad
\dot{\mathbf r}=\mathbf v,\quad \dot{\mathbf v}=\mathbf a.
$$

Eleven moving sources are used: Sun, Mercury, Venus, Earth, Moon, Mars, and the Jupiter, Saturn, Uranus, Neptune and Pluto system barycenters. Their motion follows Horizons samples; the spacecraft is a test particle and does not perturb them. This point-mass Newtonian model omits atmosphere, nonspherical gravity, radiation pressure and relativistic orbital corrections. Pluto's position and GM represent its system. The game begins after injection outside Earth; ground ascent and staging are not simulated. Implementation: `src/dynamics.js`.

### Integration and trajectory prediction

`src/orbit.js` implements **Dormand–Prince 5(4) adaptive integration**, with gravitational and relative-crossing step ceilings in `src/dynamics.js`. A universal-variable **Lambert transfer** seeds reference trajectories; **differential correction** adjusts injection velocity using eleven-source propagation (`src/planning-v10.js`). Closest approach is refined with cubic state interpolation and a golden-section search over candidate intervals. The flight and periodic Worker forecasts use the same dynamics. These are educational reference transfers, not globally optimal launch windows.

### Propulsion

$$
\dot m_{\rm prop}=\frac{F}{I_{sp}g_0},\qquad
\Delta v=I_{sp}g_0\ln\!\left(\frac{m_0}{m_f}\right),\qquad a=\frac{F}{m},\qquad g_0=9.80665\ {\rm m\,s^{-2}}.
$$

Instrument and radio mass increase dry mass. Fuel use changes total mass, available delta-v and maneuver response. Normalized keyboard inputs project onto the trajectory's local three-dimensional basis. Maneuvers use active control seconds; the rest of the physical interval is accelerated coasting. One held-key second therefore does not consume months of propellant. Implementations: `src/physics.js`, `src/navigation.js`, `src/mission.js`.

### Navigation and arrival

**Physical progress** projects the actual state onto the reference path's normalized arc length; Proxima uses distance projected along its ideal route. It is not a probability of mission completion. **Route stability** smooths position error, velocity error, projected miss distance and remaining correction capacity. Correcting course can restore stability; zero ends the flight.

Limited automatic correction consumes fuel and is capped at 1.2% throttle. It can correct the normal direction and small in-plane deviations; explicit coast disables it. Navigation arrows indicate a suggested correction. Solar-system arrival requires an actual flyby within the center-distance tolerance: **30,000 km Moon**, **100,000 km Mars**, **500,000 km Pluto system**. Accepted integration segments are checked for between-step encounters. There is **no docking-speed threshold**: arrival is a flyby, not docking or orbit insertion. A displayed 100% progress alone cannot trigger arrival. Proxima additionally checks its analytic journey endpoint, target range and local deviation.

Hull destruction, battery depletion, black-hole capture, modeled celestial collision, zero route stability or integration failure ends a flight. A player may also end it from Pause. There is no fixed ten-minute win timer. Implementation: `src/navigation.js`, `src/physics.js`.

### Energy, science and communications

The existing power systems generate a **fixed authored power**. Solar-wing generation does not vary with Sun distance or eclipse. Energy uses control seconds:

$$
\Delta E_{\rm Wh}=(P_{\rm gen}-P_{\rm load})\frac{\Delta t_{\rm control}}{3600}.
$$

Baseline load is 1,800 W, plus up to 600 W from propulsion throttle and active instrument/radio loads. Science data are produced at the instrument's MB per control second inside its observation window, with sufficient energy and stability above 20. Storage is finite; excess production is dropped. Instrument compatibility determines whether the data meet the chosen objective.

$$
R(d)=\min\!\left(R_{\max},\frac{R_{1\rm AU}}{\max(0.01,d_{\rm AU})^2}\right),\qquad
 t_{\rm light}=\frac{d_{\rm km}}{299792.458}.
$$

The **inverse-square penalty applies to radio rate**, not electrical generation. Earth range uses the propagated spacecraft and JPL Earth positions. Solar occultation blocks transmission. Production and transmission volumes use control time; packet arrival uses physical TDB time. Stored, transmitted, received, dropped and in-transit data remain distinct. Moon/Mars/Pluto require valid data **received on Earth before flight end**; Proxima credits the compatible **onboard archive**, implemented as stored plus transmitted data. Hardware and radio rates are educational assumptions, not NASA equipment or DSN specifications. Implementation: `src/mission.js`.

### Relativistic travel

Proxima is a **one-way idealized** 4.2465-light-year journey with an external drive: $1g$ proper acceleration, cruise, then symmetric deceleration, with a selectable cap of 0.3–0.8$c$. For achieved peak Lorentz factor $\gamma$:

$$
\gamma=\frac{1}{\sqrt{1-\beta^2}},\quad
 t_{\rm acc}=\frac{c}{a}\sqrt{\gamma^2-1},\quad
 \tau_{\rm acc}=\frac{c}{a}\operatorname{acosh}(\gamma),\quad
 x_{\rm acc}=\frac{c^2}{a}(\gamma-1).
$$

$$
 t_{\rm cruise}=\frac{\max(0,L-2x_{\rm acc})}{\beta c},\quad
 t_{\rm total}=2t_{\rm acc}+t_{\rm cruise},\quad
 \tau_{\rm total}=2\tau_{\rm acc}+\frac{t_{\rm cruise}}{\gamma}.
$$

If the route is too short to reach the selected cap, the peak is reduced. Local avoidance controls remain separate from the analytic relativistic drive. This level does not use a measured Proxima ephemeris, a feasible propulsion-energy budget or a general-relativistic engine. Implementation: `relativisticLeg` in `src/orbit.js` and `src/navigation.js`.

## Scoring system

### Original Arcade Score

Every award in `Flight.points()` follows this order:

$$
 A_j=b_j\,M_{\rm destination}\,M_{\rm equipment}\,
 \left(1+0.035\min(\mathrm{Combo},12)\right).
$$

| Source | Raw award $b_j$ | Trigger |
| --- | ---: | --- |
| Survival | $13\Delta t_{\rm control}$ | Each active flight step |
| Fuel, energy or repair pickup | 80 | Each collection, even if the relevant reserve is full |
| Comet supplies | 250 | One harvest per comet halo |
| Near miss | 90 | One qualifying close pass per obstacle |
| Gravity-trap escape | 700 | Leaving an entered trap behind |
| Physical arrival | 2,000 | Navigation confirms arrival |

Destination multipliers are **Moon 1.00**, **Mars 1.35**, **Pluto 1.80**, **Proxima 2.30**. Equipment multiplier is $1+$ the selected engine, hull and power bonuses: each Basic component adds **0.35**, Standard **0.16**, Advanced **0**. Instrument, radio, injection service and budget add no arcade multiplier.

Collections and near misses increment Combo **before** their award; each extends its timeout to 12 control seconds. A direct impact or expiration resets it. Other awards use the current Combo. Awards earned while 3D is active add **25% of that already-multiplied award** to a separate 3D bonus. Switching views alone earns nothing. The final Arcade Score rounds the accumulated base plus 3D bonus once; the displayed base/3D breakdown preserves that rounded total. Physical progress itself has no separate arcade award; survival accrues over play time and arrival has the award above. Implementation: `src/physics.js`, `src/flight-3d.js`, `src/config.js`.

### NASA Mission Bonus and Final Score

$$
\mathrm{Final\ Score}=\mathrm{Arcade\ Score}+\mathrm{NASA\ Mission\ Bonus}
$$

$$
\mathrm{NASA\ Mission\ Bonus}=\operatorname{round}(\mathrm{Level\ Bonus\ Cap}\times Q),\qquad
Q=0.15pR+0.20pE+0.60D+0.05FC.
$$

| Input | Exact meaning |
| --- | --- |
| $p$ | Maximum measured physical progress reached during the flight, clamped to [0,1] |
| $R$ | Passing fraction of four design checks: matching instrument, launch wet mass, budget and actual elapsed mission lifetime |
| $E$ | $0.40B+0.35U+0.25I$: battery reserve, fuel reserve and data integrity |
| $B$ | Minimum battery energy measured during flight / 20% of battery capacity, clamped to [0,1] |
| $U$ | Final fuel / 20% of fuel capacity, clamped to [0,1] |
| $I$ | $1-\mathrm{droppedMB}/\mathrm{generatedMB}$, clamped to [0,1]; zero if no data were generated |
| $D$ | Valid credited science MB / required MB, clamped to [0,1]; requires a compatible instrument, actual generation and observation time |
| $F$ | 1 only for physical arrival, all four design checks and the required valid science return; otherwise 0 |
| $C$ | Qualifying cost efficiency; zero unless $F=1$ |

For Moon/Mars/Pluto, credited data are Earth receipts; stored and in-transit data do not count toward $D$. Proxima uses stored plus transmitted data. Exceeding the science target cannot raise $D$ above 1. Partial flights can earn measured science return; the design and engineering terms scale with progress.

| Destination | Level Bonus Cap |
| --- | ---: |
| Moon | 9,960 |
| Mars | 22,636 |
| Pluto | 31,204 |
| Proxima Centauri | 48,866 |

The cost benchmark enumerates 27 bus kits × 2 radios × 2 injection services using the objective's required instrument. Designs must pass the existing checks against the **fixed expanded budget** (with duration zero for this hardware enumeration). The cheapest qualifying design defines $K_{\min}$ and the median defines $K_{\rm ref}$:

$$
 C=\operatorname{clamp}\!\left(\frac{K_{\rm ref}-K_{\rm actual}}{K_{\rm ref}-K_{\min}},0,1\right).
$$

A zero denominator gives $C=0$. The selected budget cannot inflate the reference cost; it only changes the budget check. A lower-cost design receives cost credit only after full mission success. Mission Bonus is added **after** Arcade Score and receives no destination, equipment, Combo or 3D multiplier.

**Science Mission Grade:** complete missions earn A for $Q\ge0.90$, B for $Q\ge0.75$, otherwise C. Incomplete missions earn Partial if $D>0$, otherwise No return. These grades, thresholds, prices, caps and weights are game rules, not NASA certification. See `src/mission-score.js` and [Mission scoring](docs/MISSION_SCORE.md).

## How to get a higher score

- **Match the instrument to the objective.** An incompatible payload cannot earn valid science-return credit, even if it generates data.
- **Meet wet-mass, budget and lifetime limits.** These directly affect $R$ and determine eligibility for $F$ and cost credit. Raising the budget can fix a failed requirement; it gives no additional award once the requirement passes. Dedicated injection increases capacity and cost, not engine thrust.
- **Preserve fuel and battery.** Short corrections, explicit coasting and timely pickups support arrival. Final fuel and the lowest battery reserve also affect $E$ directly. Recharging later does not undo an earlier minimum battery reserve.
- **Return usable data.** Storage loss reduces integrity. A faster radio can empty storage and deliver more data before arrival, but adds mass, power and cost. Data still in transit at the end earns no Earth-return credit. Observe long enough to reach the target; excess above the target does not raise $D$.
- **Stay on course and reach the destination.** Stability supports observation and survival; it is not a separate score award. Progress raises the design/engineering terms; arrival adds arcade points and can unlock full mission/cost qualification.
- **Collect supplies and maintain Combo.** These award arcade points directly. Near misses and trap escapes also score, but a risky pass can end a run. 3D awards receive the existing 25% extra when earned in that view.
- **Compare complete designs.** Basic bus equipment has a larger arcade multiplier and lower cost, with less fuel efficiency, protection or energy endurance. Higher-performance equipment may enable more science and successful arrival, while costing more and reducing the multiplier. Neither the cheapest nor the most expensive design automatically maximizes Final Score.

## NASA data and resources

These are data sources or adapted methods, not claims that NASA software runs the entire game. The in-game **Data & sources → Technical trace** lists implementation files and key functions.

| Official resource | Actual use | Relevant implementation |
| --- | --- | --- |
| [NASA/JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Bundled state vectors and GM values for gravity, launch dates, predictions, Earth range and light time | `data/horizons_v10/manifest.json`, `src/dynamics.js`, `src/planning-v10.js`, `src/navigation.js`, `src/mission.js` |
| [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | Science goals mapped to measurable requirements, design checks and verification results | `src/mission.js`, `src/mission-ui.js`, `src/mission-score.js`, `src/research/requirements.js` |
| [Goddard Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab) | Multidisciplinary design trade method used in Worker-based configuration estimates | `src/research/trade-study.js`, `src/mission-analysis-worker.js` |
| [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | Systems-engineering approach to mass, budget, mission readiness and documented checks | `src/mission.js`, `src/mission-ui.js`, `src/research/requirements.js` |
| [Build It Yourself: A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | Science-first objective/instrument matching; an adapted design principle | `src/mission.js`, `src/mission-ui.js` |
| [NASA Mission Viz: Elliptical Orbit Design](https://nasa.github.io/mission-viz/RMarkdown/Elliptical_Orbit_Design.html) | Tutorial-derived orbital mathematics and departure-state elements in flight-report Trajectory Analysis | `src/research/mission-viz.js`, `src/flight-record.js`, `src/flight-report.js` |
| [NASA images](https://images.nasa.gov/) and [Hubble archives](https://science.nasa.gov/mission/hubble/multimedia/) | Credited destination-matched collection rewards from original archive images | `data/photos.json`, `src/photos.js`, `src/app.js`, `assets/photos/` |

See [NASA resources and citations](docs/NASA_RESOURCES.md), [integration evidence](docs/NASA_INTEGRATION_EVIDENCE.md), [image credits](docs/IMAGE_CREDITS.md) and [License](LICENSE). 

## Local Leaderboard

## Installation and development

### Play online

Open the Pages link at the top. **No Python, Anaconda, Node.js, API token or download is needed to play online.** All physics, Workers, images and data run from the static site; audio is generated with Web Audio after interaction.

### Run locally on Windows

Install Python 3.10+ only if you want to serve the downloaded project locally. Extract the entire ZIP, then double-click `start_windows.bat`, or open Command Prompt / Anaconda Prompt in the extracted folder:

```bat
python run.py
```

Keep the console open and use its printed URL, normally `http://127.0.0.1:8765`. No pip packages are required. Keep the same port when returning to reuse the same browser archive. Do not open `index.html` through `file://`; ES modules and Workers need HTTP or HTTPS. macOS/Linux can use `python3 run.py` or `start_macos_linux.command`.

### Repository and development setup

```sh
git clone https://github.com/a0752074/TWINBOUND.git
cd TWINBOUND
python run.py --no-browser
```

Modern Chrome, Edge or Firefox is recommended. Development checks use Node.js 18+ and Python 3.10+; no npm dependencies are required for the unit suite:

```sh
npm test
node tools/export_score_rules.mjs --check
python tools/verify_release.py
python tools/build_static.py
```

`dist/` is the complete standalone website. Preview it at `http://127.0.0.1:9000/` with `python -m http.server 9000 --directory dist`. Optional real-browser tests, including a `/TWINBOUND/` subpath, are documented in [Validation](docs/VALIDATION_v10.3.1.md).




## AI assistance and credits

OpenAI ChatGPT / Codex assisted with code development, corrections, testing, English text and documentation. The participant directed the concept, visual style, gameplay and revisions. [AI disclosure](docs/AI_USAGE.md) describes this involvement. NASA/JPL data and archive images retain their original provenance and credits.

TWINBOUND is an independent educational project for the Space Mission Design Game challenge. It is not an official NASA product or endorsement. Graphics and sound effects are generated by the included Canvas/SVG and Web Audio code. See [License](LICENSE) and [Image credits](docs/IMAGE_CREDITS.md).
