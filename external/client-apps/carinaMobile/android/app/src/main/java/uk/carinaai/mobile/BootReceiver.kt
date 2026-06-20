package uk.carinaai.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

    val prefs = context.getSharedPreferences(CarinaConnectionService.PREFS_NAME, Context.MODE_PRIVATE)
    val wsUrl = prefs.getString(CarinaConnectionService.PREF_WS_URL, null) ?: return
    if (!prefs.getBoolean(CarinaConnectionService.PREF_RUNNING, false)) return

    val serviceIntent = Intent(context, CarinaConnectionService::class.java).apply {
      action = CarinaConnectionService.ACTION_START
      putExtra("wsUrl", wsUrl)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}
