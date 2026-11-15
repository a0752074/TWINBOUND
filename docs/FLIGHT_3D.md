# 3D cockpit

## Controls and score

Flight starts in 2D. V or the view button activates the cockpit. W/S applies forward/reverse thrust, A/D lateral thrust, and Q/E downward/upward thrust. Space coasts. P/Escape pauses. The six directions represent translation along three axes; the controls do not implement six independent translational/rotational degrees of freedom.

The original base award remains:

```text
base award = amount × level multiplier × equipment multiplier
             × (1 + min(combo, 12) × 0.035)
```

Only an award earned while the cockpit is active adds `0.25 × base award` to a separate ledger. Switching modes grants no points. Final integer rounding allocates the residual to the displayed cockpit bonus, so `score = baseScore + threeDBonus`. `threeDBonusRaw` retains the fractional ledger. Ordinary 2D reports keep their existing fields and values.

## Local scene

`src/cockpit.js` renders a first-person view of a three-coordinate encounter scene. Objects have fixed world heights based on the current vertical lane plus deterministic `objectDepth` spread, without consuming the obstacle generator's random stream. Newly created encounters continue along the pilot's current height and bounded vertical-velocity look-ahead. Perspective is:

```text
screen_x = center_x + focal_length × (object_x - camera_x) / forward_depth
screen_y = center_y - focal_length × (object_z - camera_z) / forward_depth
```

Objects behind the perspective near plane are clipped; the shared contact radar retains recently passed contacts, and offscreen contacts have direction cues. The cockpit, stars, rocks, crystals and gravity traps are drawn procedurally. This local encounter scene is a game representation rather than a scale rendering of measured small-body observations. The original 2D renderer remains unchanged.

The extra vertical coordinate and velocity persist across view switches. They are suspended in the 2D encounter layer, whose original collision rules remain in force. The authoritative physical navigation state is never reset, moved or given free delta-v by switching views. Stored cockpit motion resumes on return to 3D. This keeps the original 2D interaction while retaining 3D-flight consequences in the actual navigation state.

## Physical coupling

The three input components are normalized before computing thrust and fuel use. Fuel flow is the existing `F/(Isp g0)` relation. The resulting rocket-equation delta-v is projected onto the navigation basis's right, forward and normal vectors. Existing 11-body gravity and navigation continue to propagate the same spacecraft state.

Local collision checks use the closest distance of a swept 3D segment to the obstacle center. A rock or pickup at a different height does not count as a collision or collection. Fictional black-hole forces also include their vertical component in cockpit mode. Vertical guidance is derived from the existing navigation correction vector; the normal 2D hint is retained in 2D.

Local scene coordinates and time-compressed navigation have different scales, as in the original 2D action layer. The cockpit's local vertical display is not a measurement of distance above a planetary surface. The physical speed and range fields continue to come from navigation.

## Verification

`tests/flight-3d.test.js` checks baseline equivalence, fuel normalization, opposite controls, inertial coasting, physical normal-axis delta-v, view-switch state preservation, spatial collision/collection, bonus accounting and depth determinism. The interface test exercises keyboard mapping, mode switching, all four destinations and the saved, reopenable flight report with the actual workers.

`node tools/render_cockpit.mjs` records the real drawing routine as SVG for desktop and mobile sizes. PNG previews were rasterized from those SVG files. This verifies a controlled renderer scene, not a complete browser layout or GPU performance test.
