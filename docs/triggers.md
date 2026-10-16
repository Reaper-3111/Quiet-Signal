# Triggers that need no screen

Both links work from the lock screen once the phone is unlocked for the Shortcut, and neither shows anything on screen beyond the weather app.

| Link | Effect |
| --- | --- |
| `skyline://alert` | Sends an instant alert, stays on the weather screen |
| `skyline://hold` | Opens the hold screen (set up must be finished) |
| `skyline://test` | Sends a TEST alert, for trying a new shortcut safely |

The app walks through this setup itself: Home, **Shortcuts and watch**.

## iPhone

1. Open the Shortcuts app, create a shortcut with one action: **Open URL** with `skyline://alert`. Name it something ordinary, such as "Weather".
2. **Back Tap**: Settings > Accessibility > Touch > Back Tap > Triple Tap > choose the shortcut.
3. **Action Button** (iPhone 15 Pro and later): Settings > Action Button > Shortcut > choose the shortcut.
4. **Apple Watch**: install Skyline on the watch and add its complication (`app/targets/watch`, `app/targets/watch-widget`). One tap on the complication sends the alert; the watch app also has a "Radar" button. The phone hands the watch a send-only token whenever the app opens (`app/modules/watch-link`). The shortcut from step 1 can also be added as a complication.
5. **Siri**: the shortcut's name is the phrase. Pick something that sounds harmless. Skip this if the other person could hear it.

## Android

Use a launcher shortcut or a button-mapping app that opens the URL above. Power-button shortcuts differ by phone maker.

**Wear OS**: a "Weather" tile (`app/targets/wear`). Tapping "Radar" sends the alert from the watch. It needs the phone app (same package name and signing key), which sends it the config over the Wearable Data Layer.

## Widgets

- **iPhone** (`app/targets/widget/`): home (small, medium) and Lock Screen widgets that look like a weather widget and show the real forecast. "Radar" (and the whole Lock Screen widget) sends the alert from the widget itself, so the app never opens. "Hourly" opens the hold screen. If no server answers, the alert waits in the shared App Group and the app sends it the next time it runs. Needs iOS 17. The app refreshes what the widget uses (servers, token, last location) whenever it is opened, so open it now and then.
- **Android** (`app/src/widget/`): a 2x2 weather widget. "Radar" sends the alert in the background, "Hourly" opens the hold screen, the rest opens the app.

Both are built by `npx expo prebuild`; no manual Xcode or Gradle steps.
