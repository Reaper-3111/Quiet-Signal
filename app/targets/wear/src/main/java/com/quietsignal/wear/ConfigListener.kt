package com.quietsignal.wear

import android.content.Context
import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

object Store {
  fun prefs(c: Context) = c.getSharedPreferences("skyline", Context.MODE_PRIVATE)
}

/** Receives the send-only server config and forecast from the phone (modules/watch-link). Empty values mean the app was wiped. */
class ConfigListener : WearableListenerService() {
  override fun onDataChanged(events: DataEventBuffer) {
    for (e in events) {
      if (e.type != DataEvent.TYPE_CHANGED || e.dataItem.uri.path != "/quiet/config") continue
      val map = DataMapItem.fromDataItem(e.dataItem).dataMap
      Store.prefs(this).edit()
        .putString("config", map.getString("config", ""))
        .putString("forecast", map.getString("forecast", ""))
        .apply()
    }
    TileService.getUpdater(this).requestUpdate(AlertTileService::class.java)
  }
}
