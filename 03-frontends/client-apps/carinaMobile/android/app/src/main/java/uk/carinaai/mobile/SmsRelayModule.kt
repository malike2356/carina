package uk.carinaai.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableNativeMap

class SmsRelayModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SmsRelayModule"

  @ReactMethod
  fun configure(apiUrl: String, deviceToken: String?, apiKey: String?, promise: Promise) {
    try {
      InboundRelayClient.configure(reactContext, apiUrl, deviceToken, apiKey)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CONFIGURE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setSmsRelayEnabled(enabled: Boolean, promise: Promise) {
    SmsRelayManager.getInstance(reactContext).setRelayEnabled(enabled)
    promise.resolve(null)
  }

  @ReactMethod
  fun setCallRelayEnabled(enabled: Boolean, promise: Promise) {
    CallLogRelay(reactContext).setCallRelayEnabled(enabled)
    promise.resolve(null)
  }

  @ReactMethod
  fun setAllowedSenders(senders: ReadableArray, promise: Promise) {
    val set = mutableSetOf<String>()
    for (i in 0 until senders.size()) {
      senders.getString(i)?.let { set.add(it) }
    }
    SmsRelayManager.getInstance(reactContext).setAllowedSenders(set)
    promise.resolve(null)
  }

  @ReactMethod
  fun setPrivacyHours(startHour: Int, endHour: Int, promise: Promise) {
    SmsRelayManager.getInstance(reactContext).setPrivacyHours(startHour, endHour)
    promise.resolve(null)
  }

  @ReactMethod
  fun getSettings(promise: Promise) {
    val sms = SmsRelayManager.getInstance(reactContext)
    val call = CallLogRelay(reactContext)
    val map = WritableNativeMap().apply {
      putBoolean("smsEnabled", sms.isRelayEnabled())
      putBoolean("callEnabled", call.isCallRelayEnabled())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun checkMissedCalls(promise: Promise) {
    try {
      CallLogRelay(reactContext).checkMissedCalls()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CALL_LOG_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
  }

  @ReactMethod
  fun removeListeners(count: Int) {
  }
}
