package uk.carinaai.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    for (message in messages) {
      SmsRelayManager.getInstance(context).onSmsReceived(
        sender = message.displayOriginatingAddress,
        body = message.messageBody,
        timestamp = message.timestampMillis,
      )
    }
  }
}
