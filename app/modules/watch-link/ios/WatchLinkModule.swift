import ExpoModulesCore
import WatchConnectivity

public class WatchLinkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchLink")

    OnCreate { WatchLinkSession.shared.activate() }

    AsyncFunction("send") { (config: String, forecast: String) -> Bool in
      WatchLinkSession.shared.send(["config": config, "forecast": forecast])
    }
  }
}

/// Application context keeps only the latest value and is delivered whenever the watch next wakes.
final class WatchLinkSession: NSObject, WCSessionDelegate {
  static let shared = WatchLinkSession()
  private var pending: [String: Any]?

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func send(_ context: [String: Any]) -> Bool {
    guard WCSession.isSupported() else { return false }
    let session = WCSession.default
    guard session.activationState == .activated else { pending = context; return false }
    guard session.isPaired, session.isWatchAppInstalled else { return false }
    return (try? session.updateApplicationContext(context)) != nil
  }

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    if state == .activated, let p = pending { pending = nil; _ = send(p) }
  }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
