# Launch-direction alignment

The display draws a projected orbit in either XY or XZ coordinates. Its initial direction must use the spacecraft velocity relative to that display frame.

For a geocentric Moon map, subtract Earth velocity. For a heliocentric map, subtract Sun velocity; this includes the Earth's heliocentric velocity in addition to the selected Earth-relative injection velocity. A heading slider alone therefore does not directly give the heliocentric tangent.

`src/orbit-view.js` constructs Bezier segments with control points derived from physical positions and velocities. The rocket marker lies on the visible path, and its axis and direction line use the same local tangent. `src/render.js` uses the active route settings while a new worker request is pending, avoiding a temporary mismatch between a new slider value and an old path.

Dragging the arrow inverts the displayed velocity including the frame velocity offset. The drawing also handles a projection where the route collapses; an XZ view of a purely Y-directed interstellar route can overlap.

`tests/launch-alignment.test.js` checks frame-relative motion, Earth orbital velocity, XY/XZ tangent agreement, Canvas rocket rotation, pending settings, and drag inversion. The associated baseline audit remains in `data/validation/tangent_fix_report.json`.
