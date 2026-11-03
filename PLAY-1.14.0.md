# Play-only release 1.14.0 (11400)

This branch contains the native account adapter, compact viewport and anatomical
portrait framing for the Play package. Do not deploy its public directory to the
current Render service or publish it as a legacy Android OTA bundle.

Protocol-2 account endpoints are backward compatible and deployed separately.
The 1.14 updater refuses manifests without accountProtocol=2, retaining the
bundled interface; existing 1.13 installations continue using the legacy bundle.

Native Firebase Auth owns the Android session. Existing WebView credentials are
read once and verified by the server before the same Firebase UID is restored.
No anonymous account is created before an explicit guest choice. After a native
session has existed, signing out cannot resurrect the obsolete WebView session.

Google/email candidates use a separate FirebaseAuth instance until the server
resolves identity and the player confirms any meaningful save conflict. Existing
cloud saves are never overwritten. Inventory/history remain keyed to the logical
player identity, including the existing Selman recovery mapping.

Validation: Node suite, Android release build/lint, real WebView guest migration,
320px whole-interface scaling, six accessorized portraits, canvas continuity,
and additional English/guest-choice smoke checks. Real personal Google sign-in
requires a Google-enabled device; configuration includes the Play signing SHA.

Build using scripts/build-release.ps1 with the existing signing file. Submit the
AAB to the existing Alpha track. Do not replace the signing identity.
