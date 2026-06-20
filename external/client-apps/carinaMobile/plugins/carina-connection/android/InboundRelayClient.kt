package uk.carinaai.mobile

import android.content.Context
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object InboundRelayClient {
  private const val PREFS = "carina_relay_config"
  private const val TAG = "InboundRelay"

  private val client = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .writeTimeout(10, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .build()

  fun configure(context: Context, apiUrl: String, deviceToken: String?, apiKey: String?) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString("api_url", apiUrl.trim().trimEnd('/'))
      .putString("device_token", deviceToken ?: "")
      .putString("api_key", apiKey ?: "")
      .apply()
  }

  fun sendInboundEvent(
    context: Context,
    type: String,
    source: String,
    content: String,
    timestamp: Long,
    title: String? = null,
  ) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val apiUrl = prefs.getString("api_url", null)?.takeIf { it.isNotBlank() } ?: run {
      Log.w(TAG, "Relay skipped: api_url not configured")
      return
    }

    val payload = JSONObject().apply {
      put("type", type)
      put("source", source)
      put("content", content)
      put("timestamp", timestamp)
      if (!title.isNullOrBlank()) put("title", title)
    }

    val requestBuilder = Request.Builder()
      .url("$apiUrl/api/mobile/inbound")
      .post(payload.toString().toRequestBody("application/json".toMediaType()))

    val deviceToken = prefs.getString("device_token", "") ?: ""
    if (deviceToken.isNotBlank()) {
      requestBuilder.header("X-Device-Token", deviceToken)
    }
    val apiKey = prefs.getString("api_key", "") ?: ""
    if (apiKey.isNotBlank()) {
      requestBuilder.header("Authorization", "Bearer $apiKey")
    }

    client.newCall(requestBuilder.build()).enqueue(object : Callback {
      override fun onFailure(call: Call, e: java.io.IOException) {
        Log.w(TAG, "Inbound relay failed: ${e.message}")
      }

      override fun onResponse(call: Call, response: okhttp3.Response) {
        response.close()
        if (!response.isSuccessful) {
          Log.w(TAG, "Inbound relay HTTP ${response.code}")
        }
      }
    })
  }
}
