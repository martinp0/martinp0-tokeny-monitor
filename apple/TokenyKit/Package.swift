// swift-tools-version: 6.2
// Shared, UI-free code for every Tokeny Apple target (iPhone, widgets, Apple Watch, Mac).
// Builds and tests on Linux too (`swift test`), so the logic can be checked without Xcode.
import PackageDescription

let package = Package(
    name: "TokenyKit",
    platforms: [.iOS(.v26), .macOS(.v26), .watchOS(.v26)],
    products: [
        .library(name: "TokenyCore", targets: ["TokenyCore"]),
        .library(name: "TokenyAuth", targets: ["TokenyAuth"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", "3.0.0"..<"5.0.0"),
    ],
    targets: [
        // Models, formatting, budget rules, API client, App Group cache. Foundation only.
        .target(name: "TokenyCore"),
        // Neon Auth (Better Auth) client: e-mail, Sign in with Apple, Keychain session (+ swift-crypto for the Apple nonce).
        .target(
            name: "TokenyAuth",
            dependencies: [
                "TokenyCore",
                .product(name: "Crypto", package: "swift-crypto"),
            ]
        ),
        .testTarget(name: "TokenyCoreTests", dependencies: ["TokenyCore"]),
        .testTarget(name: "TokenyAuthTests", dependencies: ["TokenyAuth"]),
    ]
)
