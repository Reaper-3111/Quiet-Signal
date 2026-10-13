# Triggers that need no screen

Both links work from the lock screen once the phone is unlocked for the Shortcut, and neither shows anything on screen beyond the weather app.

| Link | Effect |
| --- | --- |
| `skyline://alert` | Sends an instant alert, stays on the weather screen |
| `skyline://hold` | Opens the hold screen (set up must be finished) |

## iPhone

1. Open the Shortcuts app, create a shortcut with one action: **Open URL** with `skyline://alert`. Name it something ordinary, such as "Weather".
2. **Back Tap**: Settings > Accessibility > Touch > Back Tap > Triple Tap > choose the shortcut.
3. **Action Button** (iPhone 15 Pro and later): Settings > Action Button > Shortcut > choose the shortcut.
4. **Apple Watch**: the shortcut appears in the Shortcuts app on the watch; add it as a complication.
5. **Siri**: the shortcut's name is the phrase. Pick something that sounds harmless. Skip this if the other person could hear it.

## Android

Use a launcher shortcut or a button-mapping app that opens the URL above. Power-button shortcuts differ by phone maker.

## Widgets

`app/native/ios-widget/WeatherWidget.swift` has the iOS home and Lock Screen widget. It is source only until it is added as a Widget Extension target after `expo prebuild`.
