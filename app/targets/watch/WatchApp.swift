import SwiftUI
import WatchConnectivity
import WidgetKit

// Must match ios.entitlements["com.apple.security.application-groups"] in app.json.
let appGroup = "group.com.example.skyline"
let alertURL = URL(string: "skylinewatch://alert")!

/// A weather glance on the wrist. "Radar" (or tapping the complication) sends the saved alert
/// straight to the servers with the send-only token the phone handed over. Nothing changes on screen.
@main
struct SkylineWatchApp: App {
    @WKApplicationDelegateAdaptor private var delegate: WatchDelegate

    var body: some Scene {
        WindowGroup {
            WeatherView()
                .onOpenURL { url in
                    if url == alertURL { Task { await sendAlert() } }
                }
        }
    }
}

struct WeatherView: View {
    @AppStorage("forecast", store: UserDefaults(suiteName: appGroup)) private var forecast = ""

    var body: some View {
        let p = forecast.components(separatedBy: "|")
        VStack(spacing: 6) {
            Text(p.count == 3 ? p[2] : "").font(.footnote)
            Text(p.count == 3 ? p[0] : "--").font(.system(size: 44, weight: .light))
            Text(p.count == 3 ? p[1] : "Updating").font(.footnote).foregroundStyle(.secondary)
            Button("Radar") { Task { await sendAlert() } }
        }
    }
}

struct WatchConfig: Decodable {
    struct Server: Decodable { let url: String; let token: String }
    struct Loc: Codable { let lat: Double; let lng: Double; let address: String? }
    let servers: [Server]
    let loc: Loc?
}

/// Tries each server twice. The watch has no queue: if none answers, use the phone.
func sendAlert() async {
    let defaults = UserDefaults(suiteName: appGroup)
    guard let raw = defaults?.string(forKey: "config"),
          let config = try? JSONDecoder().decode(WatchConfig.self, from: Data(raw.utf8)) else { return }
    var body: [String: Any] = ["id": UUID().uuidString.lowercased()]
    if let loc = config.loc {
        var l: [String: Any] = ["lat": loc.lat, "lng": loc.lng]
        if let a = loc.address { l["address"] = a }
        body["loc"] = l
    }
    guard let payload = try? JSONSerialization.data(withJSONObject: body) else { return }
    for _ in 0..<2 {
        for server in config.servers {
            guard let url = URL(string: server.url + "/v1/alerts/quick") else { continue }
            var req = URLRequest(url: url, timeoutInterval: 5)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer " + server.token, forHTTPHeaderField: "Authorization")
            req.httpBody = payload
            if let (_, res) = try? await URLSession.shared.data(for: req),
               (res as? HTTPURLResponse)?.statusCode == 200 { return }
        }
    }
}

/// Receives the config and forecast the phone sends (modules/watch-link). Empty values mean the app was wiped.
final class WatchDelegate: NSObject, WKApplicationDelegate, WCSessionDelegate {
    func applicationDidFinishLaunching() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        store(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        store(context)
    }

    private func store(_ context: [String: Any]) {
        guard let defaults = UserDefaults(suiteName: appGroup), !context.isEmpty else { return }
        for key in ["config", "forecast"] {
            let value = context[key] as? String ?? ""
            if value.isEmpty { defaults.removeObject(forKey: key) } else { defaults.set(value, forKey: key) }
        }
        WidgetCenter.shared.reloadAllTimelines()
    }
}
