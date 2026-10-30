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
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.55.5"),
        .package(url: "https://github.com/apple/swift-crypto.git", "3.0.0"..<"5.0.0"),
    ],
    targets: [
        // Models, formatting, budget rules, API client, App Group cache. Foundation only.
        .target(name: "TokenyCore"),
        // Supabase Auth (Sign in with Apple, e-mail) and session access for the apps and extensions.
        .target(
            name: "TokenyAuth",
            dependencies: [
                "TokenyCore",
                .product(name: "Auth", package: "supabase-swift"),
                .product(name: "Crypto", package: "swift-crypto"),
            ]
        ),
        .testTarget(name: "TokenyCoreTests", dependencies: ["TokenyCore"]),
        .testTarget(name: "TokenyAuthTests", dependencies: ["TokenyAuth"]),
    ]
)
