// Home and Lock Screen widget source for the weather decoy. Not yet wired into the build:
// after `npx expo prebuild`, add a Widget Extension target in Xcode, drop this file in, and
// set the extension's bundle ID under the app's (for example com.example.skyline.widget).
//
// Tap areas open the app by URL. The app sends the alert on `skyline://alert` and stays on the
// weather screen, so a tap looks like a normal widget opening its app.
import SwiftUI
import WidgetKit

struct Entry: TimelineEntry { let date: Date }

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date())], policy: .after(Date().addingTimeInterval(1800))))
    }
}

struct WeatherWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: Entry

    var body: some View {
        switch family {
        case .accessoryRectangular, .accessoryCircular:
            // Lock Screen: whole widget is the instant alert.
            Link(destination: URL(string: "skyline://alert")!) {
                VStack(alignment: .leading) {
                    Image(systemName: "cloud.sun.fill")
                    Text("Forecast")
                }
            }
        default:
            VStack(spacing: 10) {
                Link(destination: URL(string: "skyline://")!) {
                    VStack {
                        Text("Today").font(.caption)
                        Image(systemName: "cloud.sun.fill").font(.largeTitle)
                    }
                }
                HStack {
                    Link(destination: URL(string: "skyline://alert")!) { Label("Radar", systemImage: "dot.radiowaves.left.and.right") }
                    Spacer()
                    Link(destination: URL(string: "skyline://hold")!) { Label("Hourly", systemImage: "clock") }
                }
                .font(.caption)
            }
            .padding()
        }
    }
}

@main
struct WeatherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WeatherWidget", provider: Provider()) { entry in
            WeatherWidgetView(entry: entry).containerBackground(.blue.gradient, for: .widget)
        }
        .configurationDisplayName("Weather")
        .description("Local forecast.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}
