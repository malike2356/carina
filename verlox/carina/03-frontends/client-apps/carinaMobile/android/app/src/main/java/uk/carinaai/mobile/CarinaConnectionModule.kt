package uk.carinaai.mobile

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CarinaConnectionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CarinaConnectionService"

  @ReactMethod
  fun startService(wsUrl: String, promise: Promise) {
    try {
      CarinaConnectionService.reactContext = reactContext
      val intent = Intent(reactContext, CarinaConnectionService::class.java).apply {
        action = CarinaConnectionService.ACTION_START
        putExtra("wsUrl", wsUrl)
      }
      reactContext.startService(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopService(promise: Promise) {
    try {
      val intent = Intent(reactContext, CarinaConnectionService::class.java).apply {
        action = CarinaConnectionService.ACTION_STOP
      }
      reactContext.startService(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("STOP_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
  }

  @ReactMethod
  fun removeListeners(count: Int) {
  }
}
