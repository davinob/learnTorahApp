# Android release signing

Release builds read keystore settings from `android/local.properties` (gitignored)
or from env vars: `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

See `android/local.properties.example`. The keystore file lives at the workspace
root: `work/my-release-key.keystore` (also not in git).

Play uploads use `GOOGLE_PLAY_API_KEY` or `googlePlayApiKey` in the same file.

## One-command release

From the repo root:

```bash
./scripts/release-play.sh
```

Bumps the build number in `pubspec.yaml`, builds the AAB, and uploads to production.
See `./scripts/release-play.sh --help` for other tracks and flags.

**History note:** keystore passwords were once committed inside
`android/app/build.gradle.kts` and were removed from git history on 2026-09-15.
If you have not already, rotate the keystore password in Play Console / keytool.
