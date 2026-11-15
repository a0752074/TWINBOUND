# NASA Data & Resources

TWINBOUND uses NASA/JPL Horizons position and velocity samples for eleven moving gravity sources. The selected launch date changes the celestial geometry and reference transfer. The same ephemerides drive the live spacecraft trajectory, Earth range and signal delay. Original responses, query parameters and SHA-256 records are bundled for verification.

NASA's Design and Develop Science Missions provides the goal-to-requirements and verification workflow. An executable trace links each selected science goal to measurable instrument, mass, budget, lifetime, arrival and data-delivery requirements, using the game's existing mission checks. NASA Goddard Mission Design Lab informs engineering trade studies of actual configured mass, power, propulsion, communications, storage and cost. CubeSat 101 informs applicable mission-operations and verification checks; CubeSat-specific hardware qualification is outside the model.

A tutorial-derived Mission Viz analysis module converts real state vectors into osculating orbital elements, reconstructs oriented ellipses, solves Kepler's equation and exports coordinate data. It is independently implemented and does not replace the live multi-body propagator. The JPL Concept Maturity Levels paper informs an evidence and unresolved-risk checklist without assigning an official CML rating.

Reproducible JSON reports, source sections/pages, numerical tests and regression evidence accompany the code. Equipment specifications and radio rates are educational assumptions. A GMAT R2025a benchmark is prepared but has not been executed; no independent GMAT validation is claimed. NASA/partner archive photographs retain their original attribution.
