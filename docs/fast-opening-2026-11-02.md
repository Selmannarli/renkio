# Bounded opening — 2026-11-02

Baseline: ebf3ee2.

The opening screen previously awaited account/home network preparation for up to 20 seconds, then unbounded character/font preparation and a native update status callback. If the native refresh was ignored while the activity was not yet foreground, the opening could remain until its 120-second retry watchdog.

Changes: account/social preparation remains in the background; optional graphics/fonts have a 1500 ms wait budget. The native bridge is retried once after 750 ms if no ready status has arrived; after 6000 ms an initialized cached client may proceed while the existing atomic updater continues. The actual app-ready barrier remains required. Native activation still uses its existing home-only check. Main module load failure reveals retry after 15 seconds. Cached stable player tags skip the profile lookup on known account restoration. No native signing, identity, game or server rules changed.

Validation: 283 automated tests passed. A fake native bridge exercised an ignored first call followed by successful retry without reload; missing-callback gate recovery and uninitialized-app protection were tested. In the actual local browser, profile/reward/game endpoints and the character runtime were blocked, then a reload reached an enabled home screen with no opening overlay in 839 ms. Network overrides were removed and the normal opening retested. This is not a measurement on the user's Android phone.
