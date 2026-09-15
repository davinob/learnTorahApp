# Shared helpers for Play release scripts. Source from release-play.sh — do not run directly.

clear_proxy() {
  export http_proxy="" HTTP_PROXY=""
  export https_proxy="" HTTPS_PROXY=""
  export all_proxy="" ALL_PROXY=""
}

ensure_java_home() {
  if [[ -n "${JAVA_HOME:-}" ]]; then
    return 0
  fi
  for candidate in \
    "/opt/homebrew/opt/openjdk@17" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/usr/lib/jvm/java-17-openjdk-amd64"; do
    if [[ -d "$candidate" ]]; then
      export JAVA_HOME="$candidate"
      return 0
    fi
  done
  echo "JAVA_HOME is not set and no JDK 17 was found." >&2
  echo "Set JAVA_HOME to a full JDK 17 (needs jlink), e.g. /opt/homebrew/opt/openjdk@17" >&2
  exit 1
}

default_play_api_key() {
  if [[ -n "${GOOGLE_PLAY_API_KEY:-}" ]]; then
    echo "$GOOGLE_PLAY_API_KEY"
    return 0
  fi
  local p="/Users/davidb/.config/unlokid/play-publisher.json"
  if [[ -f "$p" ]]; then
    echo "$p"
    return 0
  fi
  echo ""
}

ensure_play_api_key() {
  local key
  key="$(default_play_api_key)"
  if [[ -z "$key" ]]; then
    echo "Missing Play credentials. Set GOOGLE_PLAY_API_KEY or googlePlayApiKey in android/local.properties." >&2
    exit 1
  fi
  export GOOGLE_PLAY_API_KEY="$key"
}

ensure_signing_config() {
  local props="android/local.properties"
  if [[ ! -f "$props" ]]; then
    echo "Missing $props — copy android/local.properties.example and fill in signing keys." >&2
    exit 1
  fi
  for key in KEYSTORE_FILE KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
    if ! grep -q "^${key}=" "$props"; then
      echo "Missing $key in $props (see android/local.properties.example)." >&2
      exit 1
    fi
  done
}

ensure_flutter() {
  if ! command -v flutter >/dev/null 2>&1; then
    echo "flutter not found on PATH." >&2
    exit 1
  fi
}

assert_aab_size() {
  local aab="$1"
  local max_bytes="$2"
  if [[ ! -f "$aab" ]]; then
    echo "REFUSING Play upload: no AAB at $aab" >&2
    exit 1
  fi
  local bytes
  bytes="$(stat -f%z "$aab" 2>/dev/null || stat -c%s "$aab")"
  echo "==> AAB $(basename "$aab") is $bytes bytes"
  if (( bytes > max_bytes )); then
    echo "REFUSING to upload $aab ($bytes bytes > ${max_bytes}-byte cap)." >&2
    exit 1
  fi
}
