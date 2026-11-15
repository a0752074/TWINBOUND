# Physics and operations model

## Coordinates and ephemerides

The runtime solar-system path is `dynamics.js` → `planning-v10.js` → `navigation.js`. `JplEphemeris` reads position/velocity samples from NASA/JPL Horizons in Solar System barycentric Ecliptic J2000 coordinates. Positions are AU, velocities AU/day, and time TDB days since 2025-01-01. The displayed date selects 00:00 TDB, not local midnight. Cubic Hermite interpolation uses both sampled positions and velocities. It is an approximation between official samples, with no extrapolation.

The Sun, Mercury, Venus, Earth, Moon, Mars, and five outer-planet/dwarf-planet system barycenters provide eleven moving gravity sources. Pluto represents its system barycenter and uses the combined system GM. Surface collision checks for system barycenters remain approximate.

## Gravity, planning, and integration

For spacecraft position r and body positions r_i, acceleration is:

```text
a(t, r) = sum_i GM_i (r_i(t) - r) / |r_i(t) - r|^3
dr/dt = v
dv/dt = a(t, r)
```

The spacecraft is a massless test particle for gravitational interactions; the massive bodies follow sampled Horizons states. This is not a mutual integration of the entire Solar System. The solver is an embedded Dormand–Prince 5(4) scheme with adaptive steps. It is not DOP853. Step ceilings include gravitational and relative-crossing timescales. The model omits relativity, J2, atmospheres, radiation pressure, and close-body navigation details.

A universal-variable Lambert solution seeds candidate transfers. Differential correction propagates those candidates against all eleven moving gravity sources and adjusts the injection velocity. The chosen preset is an educational reference transfer, not a globally optimized launch window or a guarantee that player maneuvers will succeed.

The launch service provides a post-injection initial state outside Earth. The game does not integrate ground ascent, staging, atmospheric losses, or injection-service propellant. Earth orbital velocity is added to the selected Earth-relative injection velocity. The rendered direction follows the displayed frame-relative velocity, including the Earth orbital contribution for heliocentric maps. Bezier control points use the physical initial tangent.

## Thrust and fuel

For thrust F, specific impulse Isp, standard gravity g0, dry mass m_d, and fuel m_f:

```text
fuel mass flow = F / (Isp * g0)
delta-v = Isp * g0 * ln(m_before / m_after)
acceleration = F / m
```

Engine, hull, and power-unit values retain their original gameplay numbers. A configured mission adds instrument and radio mass to m_d. That changes the attainable delta-v and acceleration without changing the original score multiplier. The 2D lateral/forward inputs project onto the physical trajectory's local 3D basis. Automatic navigation has a small throttle cap, consumes fuel, and is suppressed when the player explicitly coasts.

Each active-second maneuver uses control-time fuel accounting. The rest of the frame's simulated interval is accelerated coasting. A months-long virtual flight therefore does not burn months of fuel for one held-key second. This split is a teaching model, not continuous real-time mission operation.

## Arrival and stability

Stability combines physical position/velocity errors, future miss estimates, and available correction delta-v, then smooths the risk. It can recover after correction. Zero stability ends the flight. It is a game risk indicator, not a conserved quantity or mission reliability probability.

Progress projects the actual position onto the reference path and normalizes its arc length. Reaching 100 percent on the display does not grant arrival. Accepted integration segments are checked against the moving target; short candidate segments use interpolated states and a golden-section closest-approach search. These checks locate numerical events to finite tolerance.

Solar-system success is a flyby: Moon center distance ≤30,000 km; Mars center distance ≤100,000 km; Pluto-system barycentric distance ≤500,000 km. There is no docking-speed, landing, orbit-insertion, or return-flight claim. Physical collisions with modeled bodies end the flight.

## Energy and science

```text
energy change in Wh = (generation W - load W) * control_seconds / 3600
load = original bus and thruster load + active instrument W + transmitting radio W
generated MB = instrument MB_per_control_second * observing_control_seconds
stored MB <= instrument storage capacity
generated = stored + transmitted + dropped
transmitted = received_on_Earth + in_transit
```

Observations run automatically inside a target-dependent window while stability and energy permit. A clock demonstration uses the ideal interstellar route's progress window. A mismatched instrument cannot satisfy the selected goal. Full storage drops newly produced data. Payload/radio power is charged to the existing energy reservoir; prices, power generation, parameters, observation windows, and mission lifetimes are tutorial estimates.

## Communications

The live physical spacecraft state and JPL Earth state give Earth range d. For a tutorial radio with rate R1 at 1 AU:

```text
R(d) = min(R_max, R1 / max(0.01, d_in_AU)^2)
one-way light time = d_km / 299792.458 km_per_second
```

A line segment intersecting the solar radius blocks the link. There are no station schedules, Earth rotation, antenna pointing, weather, noise, bandwidth allocation, coding, or RF link-budget calculations. The inverse-square law is a simplified educational range penalty, with authored rates rather than DSN performance data.

Data generation and transmission volume use control seconds, matching the original energy economy. Packets are grouped over short control-time intervals and receive a physical TDB arrival timestamp based on emission range. Only due packets count as received. Movement during signal flight and relativistic radio frequency shifts are omitted. This mixed clock model is explicit in the UI and exported report.

For Moon/Mars/Pluto the science assessment requires ground receipt before the flight ends. The original arrival/photo rule remains independent. A fast flyby may leave useful data in transit or onboard; that is reported rather than silently credited.

## Ideal interstellar demonstration

Proxima uses the existing 1g proper-acceleration, cruise, and deceleration solution, capped at 0.8c. The local steering/dodge state is separate from the relativistic drive and is not added as a classical velocity to 0.8c. Earth and onboard elapsed times follow the analytic special-relativistic solution. The route does not use a measured Proxima ephemeris or realistic propulsion-energy budget.

For constant proper acceleration a, from rest:

```text
gamma = cosh(a * tau / c)
v/c = tanh(a * tau / c)
t = (c/a) * sinh(a * tau / c)
x = (c^2/a) * [cosh(a * tau / c) - 1]
```

Its science goal is explicitly an onboard archive. Received-on-Earth data remain separate because signal delay is substantial. It is not a feasible contemporary spacecraft mission.

## Game layer and limitations

Random obstacle placement, crystals, instant repair/refueling, encounter black holes, shield cells, and scores are fictional mechanics. The local action view is not a scale map of measured small bodies. Fixed generation does not model solar-distance effects, eclipse, or years of energy autonomy. Historical image rewards are original archive observations, not synthetic scientific results from the spacecraft.

Primary references: [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [NASA orbital basics](https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/), and [NASA specific impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/). Method adaptations are separately traced in `NASA_RESOURCES.md`.

## 3D cockpit and analysis

The optional cockpit adds three-axis translation and spatial encounter checks while leaving the default 2D branch unchanged. Controls project onto the same navigation basis and consume the same normalized engine impulse. A separate 25% cockpit bonus applies to points earned in that mode. See `FLIGHT_3D.md` for the score ledger, perspective projection and local-scene scale.

Mission requirements and science success remain defined by `src/mission.js`. The research modules read its result. Engineering alternatives use the same science class and delta-v function on an explicitly stated reference-track projection. Mission Viz exports use instantaneous osculating conics for analysis; they do not replace the original multi-body prediction.
