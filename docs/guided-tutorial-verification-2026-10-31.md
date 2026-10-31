# Guided onboarding tutorial — local verification, 2026-10-31

Branch: feature/guided-tutorial-2026-10-31. Baseline tag: tutorial-baseline-20261031 (119bf65). No push, Render deployment, Play submission or production account-data migration was performed.

## Behavior
Three guided human moves and two fixed bot replies use production engine.validate/play and production Canvas Board. The independent TutorialGame state machine teaches same colour, same shape, and a crossing worth four points. Wrong selections, targets and out-of-order actions cannot advance. Miko uses the existing Three.js portrait/emote layer. Existing reduced-motion preferences apply.

The tutorial owns its game/hand/board and does not enter the practice cache, multiplayer room or match archive. The account-owned ledger lives at social.profiles[id].tutorial = {version:1,status:'completed'|'skipped',at}. Existing persistence writes this field through the same snapshot/Firestore system; no profile-reset migration is necessary. Both missing and older-version records qualify regardless of account age, scores or match count. Completion/skip is terminal for the current version. Replays remain available without resetting the ledger.

Authenticated POST /api/tutorial reads the caller's ledger. POST /api/tutorial/finish accepts only the current version and terminal states. No client-supplied owner ID is trusted. Device-local terminal records are an account-keyed outbox: they prevent repeat prompts when saving is temporarily offline and sync at the next suitable home-screen opportunity. A second device cannot learn an offline completion before the first device has synchronized it.

Automatic offering waits for startup and session restoration, the home page, and absence of other dialogs/searches. Active boards and lobbies are excluded. Navigating into a game interrupts the tutorial without scoring or finishing it. Incomplete sessions can start again; native closure does not repeatedly reopen the dialog in that same session. Escape/Atla explicitly skips. Main-menu Nasıl oynanır and the existing rules page offer manual replay.

## Verification completed
- Full Node suite: 256 passed, zero failed (work/tutorial-full-tests-final.txt). Seven tutorial state/ledger/gating checks cover legal script, wrong moves, new/old profiles, terminal states, restart/replay, independent-device persistence semantics, and active-game deferral.
- scripts/verify-tutorial-auth.mjs: two temporary real anonymous Firebase identities against an isolated local server. One profile was seeded as pre-existing with 73 wins and 777 diamonds. Both initially received a missing ledger; complete/skip were persisted, read through independent HTTP sessions, remained terminal after duplicate finishing and server restart. Invalid auth/version rejected. Wins, wallet and match archive remained unchanged. Test identities were removed; no production Firestore writes.
- Desktop browser: automatic offer, wrong selection, all three real moves, both bot replies, final four-point crossing, completion, reload without auto-repeat, and main-menu replay. Final console contained no errors.
- Android emulator WebView: full Turkish and English flows at both 320x544 and 412x842 CSS viewport sizes; wrong-choice guard, three moves, controlled bot, finish, manual replay and skip. Captured welcome, all lessons and completion and inspected screenshots. Controls stayed within dialog/viewport horizontally and vertically. Final native logs: tutorial-native-tr-small-final.txt and tutorial-native-en-long-final.txt; complementary runs cover TR-long/EN-small.
- Actual 69-file Java ClientStore package: complete hashes, atomic install and retained revision after restart verified. No release APK/AAB was published. Debug APKs were only used on the local emulator.
- Emulator display overrides reset, previous client cache restored, test language returned to Turkish, network restored, app stopped and emulator closed.

## Limits
No physical handset or two physical-device run was performed; cross-device ledger behavior was exercised through authenticated independent HTTP clients. Production Firestore was not written during verification. Offline terminal progress only propagates to other devices after reconnection. No zero-defect or frame-rate guarantee is made.

Preview: http://localhost:4213/ . Entry: main-menu Nasıl oynanır?. The test preview account has already completed the tutorial, so manual replay is expected there.
Screenshots: workspace work/tutorial-visual/ .
