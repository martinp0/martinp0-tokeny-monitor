import Testing

@testable import TokenyAuth

@Suite("Sign in with Apple nonce")
struct NonceTests {
    @Test func sha256MatchesKnownVector() {
        #expect(AppleSignInNonce.sha256Hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        #expect(AppleSignInNonce(raw: "abc").sha256 == AppleSignInNonce.sha256Hex("abc"))
    }

    @Test func randomNoncesAreLongAndUnique() {
        let a = AppleSignInNonce.random()
        let b = AppleSignInNonce.random()
        #expect(a.raw.count == 32)
        #expect(a != b)
        #expect(AppleSignInNonce.random(length: 4).raw.count == 16)
    }
}
