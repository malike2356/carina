package uk.carinaai.mobile

import android.app.PendingIntent
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity

class CarinaMotionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val EVENT_ACTIVITY = "activity_changed"
  }

  private var recognitionClient: ActivityRecognitionClient? = null
  private var pendingIntent: PendingIntent? = null

  override fun getName(): String = "CarinaMotionModule"

  @ReactMethod
  fun startRecognition(promise: Promise) {
    try {
      CarinaMotionBridge.onActivityTransition = { activity, transition, timestamp ->
        emitActivity(activity, transition, timestamp)
      }

      val intent = Intent(reactContext, CarinaActivityReceiver::class.java)
      pendingIntent = PendingIntent.getBroadcast(
        reactContext,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )

      val transitions = listOf(
        DetectedActivity.WALKING,
        DetectedActivity.RUNNING,
        DetectedActivity.STILL,
        DetectedActivity.IN_VEHICLE,
        DetectedActivity.ON_BICYCLE,
      ).flatMap { type ->
        listOf(
          ActivityTransition.Builder()
            .setActivityType(type)
            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
            .build(),
          ActivityTransition.Builder()
            .setActivityType(type)
            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
            .build(),
        )
      }
      val request = ActivityTransitionRequest(transitions)
      recognitionClient = ActivityRecognition.getClient(reactContext)
      recognitionClient?.requestActivityTransitionUpdates(request, pendingIntent!!)
        ?.addOnSuccessListener { promise.resolve(null) }
        ?.addOnFailureListener { e -> promise.reject("ACTIVITY_ERROR", e.message, e) }
    } catch (e: Exception) {
      promise.reject("ACTIVITY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopRecognition(promise: Promise) {
    pendingIntent?.let { recognitionClient?.removeActivityTransitionUpdates(it) }
    CarinaMotionBridge.onActivityTransition = null
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(eventName: String) {
  }

  @ReactMethod
  fun removeListeners(count: Int) {
  }

  private fun emitActivity(type: String, transition: String, timestamp: Long) {
    val params = Arguments.createMap().apply {
      putString("activity", type)
      putString("transition", transition)
      putDouble("timestamp", timestamp.toDouble())
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_ACTIVITY, params)
  }
}
