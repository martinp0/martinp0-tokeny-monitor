import AuthenticationServices
import SwiftUI
import TokenyAuth
import TokenyCore

/// Sign in with Apple, or e-mail and password against the same Neon Auth as the web.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var colorScheme

    private enum Mode { case signIn, signUp }

    @State private var mode = Mode.signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var infoText: String?
    @State private var nonce = AppleSignInNonce.random()
    @FocusState private var focused: Field?

    private enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                header
                SignInWithAppleButton(.continue) { request in
                    nonce = AppleSignInNonce.random()
                    request.requestedScopes = [.email]
                    request.nonce = nonce.sha256
                } onCompletion: { result in
                    handleApple(result)
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 50)
                .clipShape(.capsule)
                .disabled(busy)

                divider
                emailForm
                footer
            }
            .padding(24)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.bar.xaxis.ascending")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.tint)
                .padding(18)
                .glassEffect(.regular, in: .circle)
            Text("Tokeny")
                .font(.largeTitle.bold())
            Text("Your AI spend across OpenAI, Anthropic and OpenRouter, in Kč and dollars.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 24)
    }

    private var divider: some View {
        HStack {
            VStack { Divider() }
            Text("or with e-mail")
                .font(.footnote)
                .foregroundStyle(.secondary)
            VStack { Divider() }
        }
    }

    private var emailForm: some View {
        VStack(spacing: 12) {
            TextField("E-mail", text: $email)
                .textContentType(.username)
                .autocorrectionDisabled()
                #if os(iOS)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                #endif
                .focused($focused, equals: .email)
                .submitLabel(.next)
                .onSubmit { focused = .password }
                .fieldStyle()

            SecureField("Password", text: $password)
                .textContentType(mode == .signUp ? .newPassword : .password)
                .focused($focused, equals: .password)
                .submitLabel(.go)
                .onSubmit(submit)
                .fieldStyle()

            if let errorText {
                Label(errorText, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let infoText {
                Label(infoText, systemImage: "envelope.badge")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: submit) {
                Group {
                    if busy {
                        ProgressView()
                    } else {
                        mode == .signIn ? Text("Sign in") : Text("Create account")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(busy || !canSubmit)
            .keyboardShortcut(.defaultAction)

            HStack {
                Button {
                    withAnimation { mode = mode == .signIn ? .signUp : .signIn }
                    errorText = nil
                    infoText = nil
                } label: {
                    mode == .signIn ? Text("Create account") : Text("I have an account")
                }
                Spacer()
                if mode == .signIn {
                    Button("Forgot password?", action: resetPassword)
                        .disabled(busy || !email.contains("@"))
                }
            }
            .font(.footnote)
            .buttonStyle(.borderless)
        }
    }

    private var footer: some View {
        VStack(spacing: 6) {
            Text("Connect your provider keys on the web. The app only reads your totals.")
            Button("Open tokeny.martinpohl.cz") { openURL(model.config.webURL) }
                .buttonStyle(.borderless)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }

    private var canSubmit: Bool {
        email.contains("@") && password.count >= (mode == .signUp ? 8 : 1)
    }

    private func submit() {
        guard canSubmit, !busy else { return }
        run {
            switch mode {
            case .signIn:
                try await model.auth.signIn(email: email, password: password)
                await model.didSignIn()
            case .signUp:
                switch try await model.auth.signUp(email: email, password: password) {
                case .signedIn:
                    await model.didSignIn()
                case .confirmEmail:
                    infoText = String(localized: "Check your inbox and confirm your e-mail, then sign in.")
                    mode = .signIn
                }
            }
        }
    }

    private func resetPassword() {
        run {
            try await model.auth.sendPasswordReset(email: email)
            infoText = String(localized: "We e-mailed you a code. Enter it on the web to set a new password.")
            openURL(model.config.resetPasswordURL(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()))
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                errorText = String(localized: "Sign in with Apple failed. Try again.")
                return
            }
            let nonce = nonce
            run {
                try await model.auth.signInWithApple(idToken: idToken, nonce: nonce)
                await model.didSignIn()
            }
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            errorText = String(localized: "Sign in with Apple failed. Try again.")
        }
    }

    private func run(_ work: @escaping @MainActor () async throws -> Void) {
        busy = true
        errorText = nil
        infoText = nil
        Task {
            defer { busy = false }
            do {
                try await work()
            } catch {
                errorText = AuthErrorText.message(for: error)
            }
        }
    }
}

private extension View {
    func fieldStyle() -> some View {
        textFieldStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.fill.tertiary, in: .rect(cornerRadius: 14))
    }
}
