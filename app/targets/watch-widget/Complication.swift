import SwiftUI
import WidgetKit

// Must match ios.entitlements["com.apple.security.application-groups"] in app.json.
let appGroup = "group.com.example.skyline"

struct Entry: TimelineEntry {
    let date: Date
    let temp: String
}

struct Provider: TimelineProvider {
    private func current() -> Entry {
        let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "forecast") ?? ""
        let p = raw.components(separatedBy: "|")
        return Entry(date: Date(), temp: p.count == 3 ? p[0] : "--")
    }
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), temp: "--") }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(current()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(1800))))
    }
}

/// Looks like a temperature complication. One tap opens the watch app with the alert link,
/// which sends the alert at once (see WatchApp.swift), the same as "Radar" on the phone widget.
@main
struct SkylineComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkylineComplication", provider: Provider()) { entry in
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "cloud.sun.fill").opacity(0.25)
                Text(entry.temp).font(.headline)
            }
            .widgetURL(URL(string: "skylinewatch://alert"))
            .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Weather")
        .description("Current temperature")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
