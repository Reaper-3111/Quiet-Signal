package com.quietsignal.wear

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** Sends the saved alert to the first server that answers, twice round. Same request as the phone widgets. */
object Sender {
  fun send(context: Context) {
    val raw = Store.prefs(context).getString("config", "") ?: ""
    if (raw.isEmpty()) return
    Thread {
      val config = JSONObject(raw)
      val body = JSONObject().put("id", UUID.randomUUID().toString())
      config.optJSONObject("loc")?.let { body.put("loc", it) }
      val servers = config.getJSONArray("servers")
      repeat(2) {
        for (i in 0 until servers.length()) {
          val s = servers.getJSONObject(i)
          if (post(s.getString("url") + "/v1/alerts/quick", s.getString("token"), body.toString())) return@Thread
        }
      }
    }.start()
  }

  private fun post(url: String, token: String, body: String): Boolean = try {
    val c = URL(url).openConnection() as HttpURLConnection
    c.requestMethod = "POST"
    c.connectTimeout = 5000
    c.readTimeout = 5000
    c.doOutput = true
    c.setRequestProperty("Content-Type", "application/json")
    c.setRequestProperty("Authorization", "Bearer $token")
    c.outputStream.use { it.write(body.toByteArray()) }
    val ok = c.responseCode == 200
    c.disconnect()
    ok
  } catch (e: Exception) {
    false
  }
}
