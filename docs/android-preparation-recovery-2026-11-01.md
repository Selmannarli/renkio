# Android preparation recovery — 2026-11-01

Baseline d7b1108; rollback tag android-preparation-baseline-20261101.

The room/match UI awaited cosmetic profile synchronization before sending a room request. That synchronization can wait on both identity refresh and profile/avatar requests. Account preparation also had no end-to-end deadline, and legacy identity restoration retained a rejected promise across all subsequent attempts in the same page.

Changes: preparation returns a valid account token without waiting for idempotent appearance synchronization (the existing server broadcasts avatar updates after persistence). The account preparation stage has a 20-second deadline. A late authentication result cannot continue into rename/token dispatch and no room request is dispatched after preparation has timed out. SDK work is not forcibly cancelled or logged out; the existing identity is preserved. Failed legacy restores are removed from a SingleFlight slot, allowing retry rather than permanently replaying an old rejection. The existing run/finally releases buttons on the preparation error. Room mutations are not automatically replayed.

Validation: 262 Node tests pass. Six focused cases cover stalled cosmetics, never-settling authentication, late resolution, rejected restore/retry, preserved token and same-page retry. Actual 70-file bundle installed and verified using production Java ClientStore; hashes and pointer survive restart. JS syntax and git diff checks pass. Emulator launch command was rejected by automatic approval review without a detailed reason, so no new Android emulator or physical-device run is claimed for this fix. Previous tutorial/Android checks do not substitute for this recovery test.

This fixes observed code paths that can leave the UI waiting; it does not eliminate free-host cold starts, a user's network outage, or Google identity-provider failures. A physical-phone confirmation remains required. No credentials, account IDs or token values are changed or logged.
