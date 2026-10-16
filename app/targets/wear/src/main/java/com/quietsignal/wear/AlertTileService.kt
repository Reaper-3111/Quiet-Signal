package com.quietsignal.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders.Box
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.FontStyle
import androidx.wear.protolayout.LayoutElementBuilders.Text
import androidx.wear.protolayout.ModifiersBuilders.Clickable
import androidx.wear.protolayout.ModifiersBuilders.Modifiers
import androidx.wear.protolayout.ModifiersBuilders.Padding
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

private const val ALERT = "radar"

/**
 * A weather tile. Tapping "Radar" reloads the tile with that id, and the reload sends the saved
 * alert in the background. Nothing on the tile changes.
 */
class AlertTileService : TileService() {
  override fun onTileRequest(req: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
    if (req.currentState.lastClickableId == ALERT) Sender.send(this)
    val p = (Store.prefs(this).getString("forecast", "") ?: "").split("|")
    val radar = Box.Builder()
      .setModifiers(
        Modifiers.Builder()
          .setClickable(Clickable.Builder().setId(ALERT).setOnClick(ActionBuilders.LoadAction.Builder().build()).build())
          .setPadding(Padding.Builder().setAll(dp(8f)).build())
          .build()
      )
      .addContent(text("Radar", 16f))
      .build()
    val layout = Column.Builder()
      .addContent(text(if (p.size == 3) p[0] else "--", 40f))
      .addContent(text(if (p.size == 3) p[1] else "Updating", 14f))
      .addContent(radar)
      .build()
    val tile = TileBuilders.Tile.Builder()
      .setResourcesVersion("1")
      .setFreshnessIntervalMillis(30 * 60 * 1000L)
      .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout))
      .build()
    return Futures.immediateFuture(tile)
  }

  override fun onTileResourcesRequest(req: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
    Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())

  private fun text(s: String, size: Float) =
    Text.Builder().setText(s).setFontStyle(FontStyle.Builder().setSize(sp(size)).build()).build()
}
