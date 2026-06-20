package uk.carinaai.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

class CarinaActivityReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    for (event in result.transitionEvents) {
      val type = when (event.activityType) {
        DetectedActivity.WALKING -> "WALKING"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.STILL -> "STILL"
        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
        DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
        else -> "UNKNOWN"
      }
      val transition = if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
        "ENTER"
      } else {
        "EXIT"
      }
      CarinaMotionBridge.onActivityTransition?.invoke(
        type,
        transition,
        System.currentTimeMillis(),
      )
    }
  }
}
