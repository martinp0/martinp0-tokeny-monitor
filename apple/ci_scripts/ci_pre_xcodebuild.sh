#!/bin/sh
# Xcode Cloud: runs before each xcodebuild action. Stamps the build number so every TestFlight
# upload is unique (all targets share CURRENT_PROJECT_VERSION, so the extensions match the apps).
set -eu

cd "$CI_PRIMARY_REPOSITORY_PATH/apple"

if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  agvtool new-version -all "$CI_BUILD_NUMBER" >/dev/null
  echo "Build number set to $CI_BUILD_NUMBER"
fi
