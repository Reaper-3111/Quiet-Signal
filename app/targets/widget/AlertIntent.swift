import AppIntents
import Foundation

/// Runs when the widget's "Radar" button is tapped. It sends the alert from the widget process,
/// so the app never opens and nothing changes on screen. If no server answers, the request is
/// parked in the App Group and the app delivers it the next time it runs.
struct AlertIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh radar"
    static var isDiscoverable: Bool = false
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: appGroup)
        guard let raw = defaults?.string(forKey: "config"),
              let config = try? JSONDecoder().decode(WidgetConfig.self, from: Data(raw.utf8)) else {
            return .result()
        }
        let id = UUID().uuidString.lowercased()
        var body: [String: Any] = ["id": id]
        if let loc = config.loc {
            var l: [String: Any] = ["lat": loc.lat, "lng": loc.lng]
            if let a = loc.address { l["address"] = a }
            body["loc"] = l
        }
        let payload = try JSONSerialization.data(withJSONObject: body)

        for server in config.servers {
            guard let url = URL(string: server.url + "/v1/alerts/quick") else { continue }
            var req = URLRequest(url: url, timeoutInterval: 3)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer " + server.token, forHTTPHeaderField: "Authorization")
            req.httpBody = payload
            if let (_, res) = try? await URLSession.shared.data(for: req),
               (res as? HTTPURLResponse)?.statusCode == 200 {
                return .result()
            }
        }

        // Nobody answered: leave it for the app to send.
        var queue = (defaults?.string(forKey: "queue")).flatMap { try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [[String: Any]] } ?? []
        var item = body
        item["at"] = ISO8601DateFormatter().string(from: Date())
        queue.append(item)
        if let data = try? JSONSerialization.data(withJSONObject: queue) {
            defaults?.set(String(decoding: data, as: UTF8.self), forKey: "queue")
        }
        return .result()
    }
}
