# 2D / 3D encounter consistency

## Reproduced cause

In v10.2, `objectDepth()` assigned a deterministic height near world Z=0 (about ±190 m for rocks). The pilot's vertical position and velocity could grow far beyond that plane. The director followed X and forward Y, but never extended the encounter field along the player's new Z lane. Newly spawned rocks, comets, black holes and supplies consequently remained far above or below the perspective window. They still existed and still appeared in the top-down 2D view. A perspective near-plane and offscreen cull then removed them from the cockpit image.

The new regression test constructs both the untouched v10.2 `Flight` and the corrected flight at Z=+50,000 m and −50,000 m, using the same seed and director calls. It reproduces the old >49,000 m vertical offset and checks the corrected contact field.

## Correction

- The existing director still determines each object's kind, X/Y position, timing, speed, radius and random draw sequence.
- A 3D-born object receives a fixed world height: current pilot height + bounded vertical-velocity look-ahead + the existing deterministic depth spread. This extends the same lane-prediction approach already used in X. No additional random draws are consumed.
- Once created, an object's height never follows the camera. Swept spatial collisions, pickups and fictional gravity use exactly that same position. Existing 3D objects do not teleport when the view changes.
- Objects born in 2D receive their height once, when first entering the cockpit. This avoids returning to an abandoned global plane after a 2D interval at high altitude.
- Existing contacts outside the perspective field receive small edge direction cues. The compact top-down contact radar uses the same live object list as 2D and includes recently passed contacts. An outline/dim contact represents vertical separation; filled contacts are near the current height.
- The background reference bands are relative to the cockpit's current vertical neighborhood.

Perspective naturally changes apparent size, direction and occlusion, so the cockpit is not pixel-identical to the top-down view. The correction preserves encounter awareness and extends new encounters along the actual vertical lane. It adds no extra enemies, rewards, collision forgiveness, drag, altitude reset or changed point formula.

## Preserved behavior and intentional exception

All unmodified 2D runs retain exact v10.2 arcade outcomes for identical seeds, gear and inputs. At the original Z lane, 3D awards and encounter outcomes remain the same. Fuel, thrust, 3D Bonus, momentum, navigation and target-arrival rules are unchanged. The corrected high-altitude 3D encounter stream can change hit/pickup outcomes compared with the buggy version, because those encounters are now present along the flown lane. This is the narrow bug-fix exception, not a general difficulty rebalance.

`tests/cockpit-visibility.test.js` covers both altitude signs, deterministic spawning without RNG drift, all encounter types, frozen coordinates, repeated mode switches, edge/near-plane contacts and finite desktop/mobile drawing. Existing swept-collision tests confirm that vertically separated contacts cannot hit or be collected remotely.

## Render previews

`node tools/render_visibility.mjs` records the actual cockpit Canvas drawing commands into SVG at 1400×840 and 390×700. The old-plane example uses v10.2 spawning with the same new renderer, making the spatial difference directly visible. These are deterministic renderer previews, not browser screenshots or proof of CSS layout.

- `docs/images/visibility-fixed-desktop.svg`
- `docs/images/visibility-old-plane-desktop.svg`
- `docs/images/visibility-fixed-mobile.svg`
- `docs/images/visibility-old-plane-mobile.svg`

The environment's Chromium launch failed on a prohibited Unix socket operation. Real browser keyboard/layout verification was therefore not completed here. The full application-flow tests use the actual Workers and flight modules with a DOM adapter; mathematical, rendering and live HTTP/SQLite checks are reported separately in `VALIDATION_v10.3.0.md`.
