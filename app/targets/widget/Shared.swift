import Foundation

// Must match ios.entitlements["com.apple.security.application-groups"] in app.json.
let appGroup = "group.com.example.skyline"

/// What the app saves for the widget: server URLs with tokens, and the last known location.
struct WidgetConfig: Decodable {
    struct Server: Decodable { let url: String; let token: String }
    struct Loc: Codable { let lat: Double; let lng: Double; let address: String? }
    let servers: [Server]
    let loc: Loc?
}

struct Forecast {
    let temp: String
    let summary: String
    let place: String

    static func load() -> Forecast {
        let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "forecast") ?? ""
        let p = raw.components(separatedBy: "|")
        return p.count == 3 ? Forecast(temp: p[0], summary: p[1], place: p[2]) : Forecast(temp: "--", summary: "Updating", place: "")
    }
}
