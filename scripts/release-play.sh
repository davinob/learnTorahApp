#!/usr/bin/env bash
# Bump version, build a signed AAB, and publish Learn Torah to Google Play.
#
# Usage:
#   ./scripts/release-play.sh                     # bump +build, production (100%)
#   ./scripts/release-play.sh --name 1.6.0        # also set the version name
#   ./scripts/release-play.sh --no-bump           # version already bumped manually
#   ./scripts/release-play.sh --dry-run           # show bump only, no build/upload
#   ./scripts/release-play.sh internal            # upload to another track
#
# Requires android/local.properties with signing keys (see local.properties.example)
# and GOOGLE_PLAY_API_KEY or googlePlayApiKey in the same file.
#
# See .notes/android-signing.md for credential setup.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=_release-common.sh
source "$(dirname "$0")/_release-common.sh"

BUMP=1
DRY_RUN=0
VERSION_NAME=""
TRACK="production"
MAX_AAB_BYTES=$((70 * 1024 * 1024))
AAB="build/app/outputs/bundle/release/app-release.aab"

usage() {
  sed -n '3,12p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --name) VERSION_NAME="${2:?--name requires a value}"; shift 2 ;;
    --no-bump) BUMP=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    internal|alpha|beta|production) TRACK="$1"; shift ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

clear_proxy
ensure_java_home
ensure_signing_config
ensure_play_api_key
ensure_flutter

if (( BUMP )); then
  bump_args=()
  [[ -n "$VERSION_NAME" ]] && bump_args+=(--name "$VERSION_NAME")
  (( DRY_RUN )) && bump_args+=(--dry-run)
  python3 scripts/bump_version.py ${bump_args[@]+"${bump_args[@]}"}
fi

if (( DRY_RUN )); then
  echo "Dry run — skipping flutter build and Play upload."
  exit 0
fi

echo "==> flutter build appbundle --release"
flutter build appbundle --release

assert_aab_size "$AAB" "$MAX_AAB_BYTES"

echo "==> Uploading to Play track: $TRACK"
(
  cd android
  ./gradlew :app:publishReleaseBundle \
    --track "$TRACK" \
    --release-status completed \
    --console=plain
)

echo "==> Done. Learn Torah uploaded to '$TRACK'. Play review usually takes a few hours."
