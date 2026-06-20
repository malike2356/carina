package uk.carinaai.mobile

import android.content.Context
import android.provider.CallLog

class CallLogRelay(private val context: Context) {

  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun checkMissedCalls() {
    if (!isCallRelayEnabled()) return

    val projection = arrayOf(
      CallLog.Calls.NUMBER,
      CallLog.Calls.TYPE,
      CallLog.Calls.DATE,
      CallLog.Calls.DURATION,
    )
    val selection = "${CallLog.Calls.TYPE} = ? AND ${CallLog.Calls.DATE} > ?"
    val args = arrayOf(
      CallLog.Calls.MISSED_TYPE.toString(),
      lastCheckedTimestamp().toString(),
    )

    context.contentResolver.query(
      CallLog.Calls.CONTENT_URI,
      projection,
      selection,
      args,
      "${CallLog.Calls.DATE} DESC",
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        val number = cursor.getString(0) ?: continue
        val date = cursor.getLong(2)
        InboundRelayClient.sendInboundEvent(
          context = context,
          type = "missed_call",
          source = number,
          content = "Missed call",
          timestamp = date,
        )
      }
    }
    saveLastCheckedTimestamp()
  }

  fun isCallRelayEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

  fun setCallRelayEnabled(enabled: Boolean) {
    prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
    if (enabled) {
      CallLogRelayScheduler.schedule(context)
    } else {
      CallLogRelayScheduler.cancel(context)
    }
  }

  private fun lastCheckedTimestamp(): Long =
    prefs.getLong(KEY_LAST_CHECKED, System.currentTimeMillis() - 3600_000)

  private fun saveLastCheckedTimestamp() {
    prefs.edit().putLong(KEY_LAST_CHECKED, System.currentTimeMillis()).apply()
  }

  companion object {
    const val PREFS_NAME = "call_relay_prefs"
    const val KEY_ENABLED = "enabled"
    const val KEY_LAST_CHECKED = "last_checked"
  }
}
