import SwiftUI
import WidgetKit

struct ForecastEntry: TimelineEntry {
    let date: Date
    let forecast: Forecast
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> ForecastEntry { ForecastEntry(date: Date(), forecast: Forecast.load()) }
    func getSnapshot(in context: Context, completion: @escaping (ForecastEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ForecastEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .after(Date().addingTimeInterval(1800))))
    }
}

struct WeatherWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ForecastEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            // Lock Screen: the whole widget is the instant alert.
            Button(intent: AlertIntent()) { Image(systemName: "cloud.sun.fill") }.buttonStyle(.plain)
        case .accessoryRectangular:
            Button(intent: AlertIntent()) {
                VStack(alignment: .leading) {
                    Text(entry.forecast.temp).font(.headline)
                    Text(entry.forecast.summary).font(.caption)
                }
            }
            .buttonStyle(.plain)
        default:
            VStack(spacing: 8) {
                // Tapping the forecast opens the weather app, like any weather widget.
                Link(destination: URL(string: "skyline://")!) {
                    VStack(spacing: 2) {
                        Text(entry.forecast.place).font(.caption)
                        Text(entry.forecast.temp).font(.system(size: 34, weight: .light))
                        Text(entry.forecast.summary).font(.caption2)
                    }
                    .foregroundStyle(.white)
                }
                HStack {
                    Button(intent: AlertIntent()) { Label("Radar", systemImage: "dot.radiowaves.left.and.right") }
                    Spacer()
                    Link(destination: URL(string: "skyline://hold")!) { Label("Hourly", systemImage: "clock") }
                }
                .font(.caption)
                .foregroundStyle(.white)
                .buttonStyle(.plain)
            }
            .padding(8)
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
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}
