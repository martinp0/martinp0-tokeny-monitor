import Foundation
import TokenyCore

extension UsageAPIError {
    var message: String {
        switch self {
        case .unauthorized: String(localized: "You've been signed out. Please sign in again.")
        case .proRequired: String(localized: "This needs Tokeny Pro.")
        case .notDeployed: String(localized: "The Tokeny server is being updated. Try again in a few minutes.")
        case .server: String(localized: "The server had a problem. Try again later.")
        case .offline: String(localized: "You're offline. Showing the last data.")
        case .badResponse: String(localized: "Unexpected response from the server. Update the app.")
        }
    }
}

/// User-facing text for sign-in errors from Supabase.
enum AuthErrorText {
    static func message(for error: any Error) -> String {
        let text = String(describing: error).lowercased()
        if text.contains("invalid login credentials") || text.contains("invalid_credentials") {
            return String(localized: "Wrong e-mail or password.")
        }
        if text.contains("email not confirmed") || text.contains("email_not_confirmed") {
            return String(localized: "Confirm your e-mail first. We sent you a link.")
        }
        if text.contains("already registered") || text.contains("user_already_exists") {
            return String(localized: "This e-mail already has an account. Sign in instead.")
        }
        if text.contains("password") && (text.contains("weak") || text.contains("short") || text.contains("at least")) {
            return String(localized: "Choose a longer password (at least 8 characters).")
        }
        if let urlError = error as? URLError, urlError.code == .notConnectedToInternet {
            return String(localized: "You're offline.")
        }
        return String(localized: "Sign-in failed. Try again.")
    }
}
