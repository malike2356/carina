package uk.carinaai.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CarinaConnectionService : Service() {

  companion object {
    const val CHANNEL_ID = "carina_connection"
    const val NOTIF_ID = 1001
    const val TAG = "CarinaConn"
    const val ACTION_START = "uk.carinaai.mobile.START_CONNECTION"
    const val ACTION_STOP = "uk.carinaai.mobile.STOP_CONNECTION"
    const val PREFS_NAME = "carina_connection"
    const val PREF_WS_URL = "wsUrl"
    const val PREF_RUNNING = "running"
    var reactContext: ReactContext? = null
  }

  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var webSocket: WebSocket? = null
  private var client: OkHttpClient? = null
  private var connectJob: Job? = null
  private var wsUrl: String = ""
  private var reconnectAttempt = 0
  private val maxBackoffSeconds = 30L
  private var isRunning = false
  private var connectivityManager: ConnectivityManager? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    registerNetworkCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        promoteToForeground("Connecting...")
        val requestedUrl = intent.getStringExtra("wsUrl")?.trim().orEmpty()
        if (requestedUrl.isBlank()) {
          Log.w(TAG, "Ignoring connection start without a websocket URL")
          persistConnectionState(running = false, url = null)
          stopSelf(startId)
          return START_NOT_STICKY
        }
        if (isRunning && requestedUrl == wsUrl) {
          Log.d(TAG, "Connection service already running for requested URL")
          return START_STICKY
        }
        wsUrl = requestedUrl
        persistConnectionState(running = true, url = wsUrl)
        isRunning = true
        scheduleConnect()
      }
      ACTION_STOP -> {
        isRunning = false
        persistConnectionState(running = false, url = null)
        connectJob?.cancel()
        connectJob = null
        webSocket?.close(1000, "Service stopped")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    return START_STICKY
  }

  private fun promoteToForeground(text: String) {
    val notification = buildNotification(text)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun scheduleConnect(delayMs: Long = 0L) {
    connectJob?.cancel()
    connectJob = scope.launch {
      if (delayMs > 0L) {
        delay(delayMs)
      }
      connect()
    }
  }

  private fun persistConnectionState(running: Boolean, url: String?) {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(PREF_RUNNING, running)
      .putString(PREF_WS_URL, url)
      .apply()
  }

  private fun backoffDelay(): Long {
    val delay = minOf((1L shl reconnectAttempt), maxBackoffSeconds)
    reconnectAttempt = minOf(reconnectAttempt + 1, 5)
    return delay * 1000L
  }

  private suspend fun connect() {
    if (!isRunning) return

    val batteryLow = isBatteryLow()
    val pingIntervalSeconds = if (batteryLow) 60L else 20L
    Log.d(TAG, "Connecting with ping interval ${pingIntervalSeconds}s (batteryLow=$batteryLow)")

    client = OkHttpClient.Builder()
      .pingInterval(pingIntervalSeconds, TimeUnit.SECONDS)
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .build()

    val request = Request.Builder().url(wsUrl).build()
    val listener = object : WebSocketListener() {
      override fun onOpen(ws: WebSocket, response: Response) {
        reconnectAttempt = 0
        webSocket = ws
        updateNotification("Carina is running")
        emitMap("connection_state_change") { map ->
          map.putString("state", "connected")
          map.putString("url", wsUrl)
        }
      }

      override fun onMessage(ws: WebSocket, text: String) {
        emitMap("message_received") { map ->
          map.putString("raw", text)
        }
        try {
          val obj = JSONObject(text)
          if (obj.has("event")) {
            emitMap("agent_event") { map ->
              map.putString("event", obj.getString("event"))
              map.putString("data", obj.opt("data")?.toString() ?: "null")
            }
          }
        } catch (_: Exception) {
        }
      }

      override fun onClosing(ws: WebSocket, code: Int, reason: String) {
        emitMap("connection_state_change") { map ->
          map.putString("state", "closing")
          map.putInt("code", code)
          map.putString("reason", reason)
        }
      }

      override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
        Log.w(TAG, "WebSocket failure: ${t.message}")
        emitMap("connection_state_change") { map ->
          map.putString("state", "disconnected")
          map.putString("error", t.message ?: "unknown")
        }
        if (isRunning) {
          val waitMs = backoffDelay()
          updateNotification("Reconnecting in ${waitMs / 1000}s...")
          scheduleConnect(waitMs)
        }
      }
    }

    client?.newWebSocket(request, listener)
  }

  private fun isBatteryLow(): Boolean {
    val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    return level in 0 until 20
  }

  private fun registerNetworkCallback() {
    networkCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        Log.d(TAG, "Network available; triggering reconnect")
        webSocket?.close(1001, "Network change")
        reconnectAttempt = 0
        if (isRunning) scheduleConnect()
      }

      override fun onLost(network: Network) {
        emitMap("connection_state_change") { map ->
          map.putString("state", "disconnected")
          map.putString("reason", "network_lost")
        }
      }
    }
    val req = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()
    connectivityManager?.registerNetworkCallback(req, networkCallback!!)
  }

  private fun emitMap(event: String, builder: (WritableMap) -> Unit) {
    val map = Arguments.createMap()
    builder(map)
    reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit(event, map)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Carina Connection",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Maintains Carina agent connection"
      }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(text: String): Notification {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Carina")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(pi)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(text: String) {
    getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(text))
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    super.onDestroy()
    networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
    scope.cancel()
    client?.dispatcher?.executorService?.shutdown()
  }
}
