# v10.3.1 — GitHub Pages & Local Leaderboard Edition

Based only on the supplied v10.3.0 Final Mission Edition ZIP.

- Local Leaderboard reads the existing FlightArchive: one best per normalized Player ID per destination, Top 50, deterministic Final Score / mission bonus / date / Flight ID ordering. Complete personal histories remain intact and other players' reports open locally.
- Retained IndexedDB database/store names, player keys, full immutable records and scoring version `10.3.0-1`. Existing archived flights can rank regardless of their former queue-state label. Legacy and incompatible scoring versions are excluded.
- Removed frontend API calls, background sync, status/retry UI and external API configuration. The default Python launcher now serves static files without creating a database.
- Shortened NASA Resources to actual uses and file/function traces. Removed the model-documentation player link and GMAT scaffold, concept-maturity checklist, VR and CSA background cards from the player list. Original research, scientific documents and citations remain.
- Moved Local Leaderboard into the existing top action area, increased its contrast, and changed the home subtitle. The game layout and artwork are retained.
- Continued the existing Pages workflow and static builder, removing backend configuration and adding pre-deployment unit/data/rule checks.
- Rewrote README and deployment instructions around actual controls, physics, exact scoring and browser-local records. Added local-board, resource, static-site, browser and preservation checks.

Physics, navigation, science operations, equipment values, Arcade Score, Mission Bonus, encounter generation, graphics, Web Audio and the flight-record schema are unchanged. `src/config.js` changes only the release version. The exported scoring manifest changes only `gameVersion`; scoring version and numeric rules are identical.

See [validation](VALIDATION_v10.3.1.md) for executed tests and public-deployment limits. Older validation/changelog files describe their original releases, including the retired shared-server design.
