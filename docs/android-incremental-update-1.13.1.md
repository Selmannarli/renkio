# Android 1.13.1 — nonblocking incremental updates

Baseline: 98866d4. Existing full-bundle endpoint remains compatible with older Android shells.

Observed full update: 8.20 MiB JSON, 6.14 MiB decoded files, about 4.52 MiB gzip over the live network. A one-file UI change previously downloaded that entire snapshot.

The new native shell requests an approximately 9 KiB manifest and reuses hash-verified bundled/cached files. Only missing/changed files are fetched against a pinned revision. The existing ClientStore still validates and atomically commits the complete snapshot. Update failures retain the working client; downloads do not block the startup handshake. Updates ready after the opening phase activate on the next launch.

Cold startup no longer validates every cached file on the UI thread: it authenticates the small manifest there, then verifies each requested file on WebView's request worker before serving any bytes. Corrupt cached resources cause a safe bundled-client fallback. Cached clients from older native builds are not preferred over the new bundled client until verified against the server.

3D runtime imports begin after the opening screen is released; optional font preparation is bounded to 400 ms. Identity, permissions, game rules, saved games and the signing key remain unchanged.

Validation: 284 Node tests passed; Gradle release/debug builds, AAB/APK signing and release lint passed. The native update planner was exercised against 72 actual files: unchanged launch downloads zero game files, changing app.mjs downloads only 132887 bytes, tampered downloads and cached code are rejected. Android emulator startup smoke passed; first-launch measurements were approximately 7–10 seconds on the software-rendered emulator across build stages, so no claim is made about the user's physical phone timing. New and prior release APK certificate SHA-256 match.
