import SwiftUI
import TokenyCore

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingDelete = false
    @State private var deleting = false
    @State private var deleteError: String?

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section("Account") {
                    if let email = model.auth.email {
                        LabeledContent("Signed in as", value: email)
                    }
                    if let summary = model.summary {
                        LabeledContent("Plan", value: summary.isPro ? "Pro" : String(localized: "Free"))
                    }
                    Link(destination: model.accountURL) {
                        Label("Manage account on the web", systemImage: "safari")
                    }
                }

                Section {
                    Picker("Main currency", selection: $model.currency) {
                        Text("Czech koruna (Kč)").tag(Currency.czk)
                        Text("US dollar ($)").tag(Currency.usd)
                    }
                    Toggle("Budget alerts", isOn: $model.budgetAlertsEnabled)
                } header: {
                    Text("Display")
                } footer: {
                    Text(
                        "Tokeny notifies you once when you reach your alert threshold and once at 100 % of your monthly budget. Set the budget on the web."
                    )
                }

                Section {
                    Button("Sign out") {
                        Task {
                            await model.signOut()
                            dismiss()
                        }
                    }
                    Button("Delete account…", role: .destructive) { confirmingDelete = true }
                        .disabled(deleting)
                } footer: {
                    if let deleteError {
                        Text(deleteError).foregroundStyle(.red)
                    }
                }

                Section {
                    Link("Privacy", destination: model.config.webURL.appending(path: "privacy"))
                    LabeledContent("Version", value: Bundle.main.versionString)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Delete your Tokeny account?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete account and data", role: .destructive) {
                    deleting = true
                    Task {
                        defer { deleting = false }
                        do {
                            try await model.deleteAccount()
                            dismiss()
                        } catch let error as UsageAPIError {
                            deleteError = error.message
                        } catch {
                            deleteError = UsageAPIError.offline.message
                        }
                    }
                }
            } message: {
                Text(
                    "This permanently deletes your account, provider keys and usage history. If you have Pro, cancel the subscription on the web first."
                )
            }
        }
    }
}
