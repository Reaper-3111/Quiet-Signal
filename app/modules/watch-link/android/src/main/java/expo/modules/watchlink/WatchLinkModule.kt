package expo.modules.watchlink

import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WatchLinkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WatchLink")

    // A data item syncs to every paired Wear OS watch, now or whenever it next connects.
    AsyncFunction("send") { config: String, forecast: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val request = PutDataMapRequest.create("/quiet/config").apply {
        dataMap.putString("config", config)
        dataMap.putString("forecast", forecast)
        dataMap.putLong("at", System.currentTimeMillis()) // forces a change event even if nothing else changed
      }.asPutDataRequest().setUrgent()
      Wearable.getDataClient(context).putDataItem(request)
      true
    }
  }
}
