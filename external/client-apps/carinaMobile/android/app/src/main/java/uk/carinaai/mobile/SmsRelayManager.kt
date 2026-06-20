package uk.carinaai.mobile

import android.content.Context
import java.util.Calendar

class SmsRelayManager private constructor(private val context: Context) {

  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun onSmsReceived(sender: String?, body: String?, timestamp: Long) {
    if (sender.isNullOrBlank() || body.isNullOrBlank()) return
    if (!isRelayEnabled()) return
    if (!isSenderAllowed(sender)) return
    if (!isWithinPrivacyHours()) return

    val redacted = RelayRedaction.apply(body)
    InboundRelayClient.sendInboundEvent(
      context = context,
      type = "sms",
      source = sender,
      content = redacted,
      timestamp = timestamp,
    )
  }

  fun isRelayEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

  fun setRelayEnabled(enabled: Boolean) {
    prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun isSenderAllowed(sender: String): Boolean {
    val allowed = prefs.getStringSet(KEY_ALLOWED_SENDERS, emptySet()) ?: emptySet()
    if (allowed.isEmpty()) return false
    return "ALL" in allowed || sender in allowed
  }

  fun setAllowedSenders(senders: Set<String>) {
    prefs.edit().putStringSet(KEY_ALLOWED_SENDERS, senders).apply()
  }

  fun setPrivacyHours(startHour: Int, endHour: Int) {
    prefs.edit()
      .putInt(KEY_PRIVACY_START, startHour)
      .putInt(KEY_PRIVACY_END, endHour)
      .apply()
  }

  private fun isWithinPrivacyHours(): Boolean {
    val startHour = prefs.getInt(KEY_PRIVACY_START, 7)
    val endHour = prefs.getInt(KEY_PRIVACY_END, 22)
    val current = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return if (startHour <= endHour) {
      current in startHour..endHour
    } else {
      current >= startHour || current <= endHour
    }
  }

  companion object {
    const val PREFS_NAME = "sms_relay_prefs"
    const val KEY_ENABLED = "enabled"
    const val KEY_ALLOWED_SENDERS = "allowed_senders"
    const val KEY_PRIVACY_START = "privacy_start_hour"
    const val KEY_PRIVACY_END = "privacy_end_hour"

    @Volatile
    private var instance: SmsRelayManager? = null

    fun getInstance(context: Context): SmsRelayManager {
      return instance ?: synchronized(this) {
        instance ?: SmsRelayManager(context.applicationContext).also { instance = it }
      }
    }
  }
}
