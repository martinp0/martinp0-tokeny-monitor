import SwiftUI

/// Server + token form, used on Mac and iPhone.
struct TokenSettingsForm: View {
    var onSave: () -> Void
    var onCancel: (() -> Void)? = nil

    @State private var server = TokenySettings.serverURL.absoluteString
    @State private var token = ""
    @State private var hasToken = Keychain.readToken() != nil
    @State private var currency = TokenySettings.currency
    @State private var testing = false
    @State private var result: String?

    var body: some View {
        Form {
            Section {
                SecureField(hasToken ? "Uložený token (beze změny)" : "orm_…", text: $token)
                    .autocorrectionDisabled()
                if hasToken {
                    Button("Smazat token", role: .destructive) { Keychain.saveToken(nil); hasToken = false; token = "" }
                }
            } header: { Text("Osobní token") } footer: {
                Text("Vytvoř ho na tokeny.pohl.uk v Nastavení → MCP tokeny (pojmenuj ho třeba „Mac“). Ukládá se jen do Klíčenky a appka s ním jen čte souhrn.")
            }
            Section("Server") {
                TextField("https://<projekt>.supabase.co", text: $server).autocorrectionDisabled()
                Picker("Měna", selection: $currency) {
                    ForEach(Currency.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            Section {
                Button { Task { await test() } } label: {
                    HStack { Text("Ověřit připojení"); if testing { Spacer(); ProgressView().controlSize(.small) } }
                }
                .disabled(testing || TokenySettings.normalize(server) == nil || (token.isEmpty && !hasToken))
                if let result { Text(result).font(.footnote) }
            }
            HStack {
                if let onCancel { Button("Zrušit", action: onCancel) }
                Spacer()
                Button("Uložit") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(TokenySettings.normalize(server) == nil)
            }
        }
    }

    private func currentToken() -> String? {
        token.isEmpty ? Keychain.readToken() : token.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func test() async {
        guard let url = TokenySettings.normalize(server), let t = currentToken() else { return }
        testing = true
        defer { testing = false }
        do {
            let s = try await TokenyAPI(baseURL: url, token: t).fetchSummary()
            result = "✅ Funguje. Tento měsíc \(Fmt.cost(s.month.cost_usd, currency, rate: Fmt.rate(s)))."
        } catch {
            result = "❌ \(error.localizedDescription)"
        }
    }

    private func save() {
        guard let url = TokenySettings.normalize(server) else { return }
        TokenySettings.serverURL = url
        TokenySettings.currency = currency
        if !token.isEmpty { Keychain.saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines)) }
        token = ""
        hasToken = Keychain.readToken() != nil
        onSave()
    }
}

/// Budget bar used by the Mac popover and iPhone.
struct BudgetBar: View {
    let summary: UsageSummary
    let model: SummaryModel

    var body: some View {
        if let b = summary.budget, let f = summary.budgetFraction {
            VStack(alignment: .leading, spacing: 4) {
                ProgressView(value: min(f, 1))
                    .tint(f >= 1 ? .red : summary.overThreshold ? .orange : Color.tokenyPrimary)
                Text("Rozpočet: \(model.cost(summary.month.cost_usd, decimals: 0)) z \(model.cost(b.monthly_usd, decimals: 0)) (\(Int((f * 100).rounded())) %)")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}
