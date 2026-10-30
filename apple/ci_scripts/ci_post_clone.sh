#!/bin/sh
# Xcode Cloud: runs right after the clone, before Xcode resolves packages.
# The .xcodeproj is not committed, so generate it from project.yml here.
set -eu

cd "$CI_PRIMARY_REPOSITORY_PATH/apple"

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
if ! command -v xcodegen >/dev/null 2>&1; then
  brew install xcodegen
fi
xcodegen generate --spec project.yml

# Xcode Cloud builds with automatic package resolution disabled, so the project needs a
# Package.resolved. The app's only package is the local TokenyKit, whose pins are committed in
# TokenyKit/Package.resolved; start from those and let xcodebuild confirm or update them.
RESOLVED_DIR="Tokeny.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
mkdir -p "$RESOLVED_DIR"
cp TokenyKit/Package.resolved "$RESOLVED_DIR/Package.resolved"
xcodebuild -resolvePackageDependencies -project Tokeny.xcodeproj -scheme Tokeny
