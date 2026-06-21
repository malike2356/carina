#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x "$ROOT/gradlew" ]]; then
  echo "Bootstrapping Gradle wrapper..."
  GRADLE_VER="8.5"
  TMP="$(mktemp -d)"
  curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip" -o "$TMP/gradle.zip"
  unzip -q "$TMP/gradle.zip" -d "$TMP"
  "$TMP/gradle-${GRADLE_VER}/bin/gradle" wrapper --gradle-version "$GRADLE_VER"
  rm -rf "$TMP"
fi

chmod +x "$ROOT/gradlew"
"$ROOT/gradlew" buildPlugin --no-daemon

echo ""
echo "Built: $ROOT/build/distributions/"
