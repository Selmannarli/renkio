# Instant interactions — 2026-11-01

Baseline: 89dd9cf. Revert through Git if needed.

- Both admin support inventories remain unchanged on use; standard inventory and match limits remain authoritative. No special wallet indicator.
- A hint creates normal validated draft placements with a translucent hint flag. Play submits those placements directly; undo and manual placement remain available.
- Removed the redundant board turn pill while retaining the header turn label.
- Account-scoped optimistic queues project support purchases, reward claims, gifts, friend writes and time extensions. Acknowledgements rebase later writes; failures remove only their own projections. Cosmetic purchases preview immediately but are persisted only after ownership confirmation.
- Online moves have a detached provisional board/score projection. No replacement tiles, match result or celebration is manufactured. Rejected moves restore the draft; room snapshots reconcile successful moves. Navigation does not wait for the move response.
- Cached account wallets, conversation lists and direct-message threads render before refresh. Existing receipt-based immediate-message delivery remains in use.

Verification: 276 automated tests passed. Browser tests used an isolated local data directory, a 2500 ms network latency override and blocked action requests. Verified immediate reward/shop counts, retained navigation, transparent hints committed through Play, rejected move rollback and successful online reconciliation. All network and viewport test overrides were restored. The real Android ClientStore installed the 72-file package, verified hashes and retained the revision after restart. This was not a physical Android device test.

Limits: authentication, matchmaking/room identity, prepared joker identity, new rack tiles and final results still require authoritative server data. Projections improve local response; they do not reduce physical network latency or make matches playable offline.
