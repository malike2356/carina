package uk.carinaai.mobile

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

class CarinaVisionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val TAG = "CarinaVision"
    const val EVENT_FRAME = "vision_frame"
  }

  private var cameraDevice: CameraDevice? = null
  private var captureSession: CameraCaptureSession? = null
  private var imageReader: ImageReader? = null
  private var backgroundThread: HandlerThread? = null
  private var backgroundHandler: Handler? = null
  private val isCapturing = AtomicBoolean(false)
  private var fpsPeriodMs = 500L
  private var lastFrameTime = 0L

  override fun getName(): String = "CarinaVisionModule"

  @ReactMethod
  fun startCapture(fps: Int, promise: Promise) {
    if (isCapturing.get()) {
      promise.resolve(null)
      return
    }
    fpsPeriodMs = if (fps > 0) (1000L / fps) else 500L
    startBackgroundThread()
    openCamera(promise)
  }

  @ReactMethod
  fun stopCapture(promise: Promise) {
    isCapturing.set(false)
    captureSession?.close()
    cameraDevice?.close()
    imageReader?.close()
    captureSession = null
    cameraDevice = null
    imageReader = null
    stopBackgroundThread()
    promise.resolve(null)
  }

  @ReactMethod
  fun pauseCapture(promise: Promise) {
    isCapturing.set(false)
    promise.resolve(null)
  }

  @ReactMethod
  fun resumeCapture(promise: Promise) {
    isCapturing.set(true)
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(eventName: String) {
  }

  @ReactMethod
  fun removeListeners(count: Int) {
  }

  @SuppressLint("MissingPermission")
  private fun openCamera(promise: Promise) {
    val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    val cameraId = manager.cameraIdList.firstOrNull { id ->
      manager.getCameraCharacteristics(id)
        .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
    } ?: run {
      promise.reject("NO_CAMERA", "No back camera found")
      return
    }

    imageReader = ImageReader.newInstance(640, 480, ImageFormat.JPEG, 2)
    imageReader?.setOnImageAvailableListener({ reader ->
      val now = System.currentTimeMillis()
      if (!isCapturing.get() || now - lastFrameTime < fpsPeriodMs) {
        reader.acquireLatestImage()?.close()
        return@setOnImageAvailableListener
      }
      lastFrameTime = now
      val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
      try {
        val buffer = image.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        emitFrame(b64, now)
      } finally {
        image.close()
      }
    }, backgroundHandler)

    manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
      override fun onOpened(camera: CameraDevice) {
        cameraDevice = camera
        createCaptureSession(promise)
      }

      override fun onDisconnected(camera: CameraDevice) {
        camera.close()
        isCapturing.set(false)
      }

      override fun onError(camera: CameraDevice, error: Int) {
        camera.close()
        promise.reject("CAMERA_ERROR", "Camera error: $error")
      }
    }, backgroundHandler)
  }

  private fun createCaptureSession(promise: Promise) {
    val surface = imageReader!!.surface
    cameraDevice?.createCaptureSession(
      listOf(surface),
      object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          captureSession = session
          val request = cameraDevice!!
            .createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
            .apply { addTarget(surface) }
            .build()
          session.setRepeatingRequest(request, null, backgroundHandler)
          isCapturing.set(true)
          promise.resolve(null)
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
          promise.reject("SESSION_FAILED", "CaptureSession config failed")
        }
      },
      backgroundHandler,
    )
  }

  private fun emitFrame(base64Jpeg: String, timestamp: Long) {
    val params = Arguments.createMap().apply {
      putString("jpeg", base64Jpeg)
      putDouble("timestamp", timestamp.toDouble())
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_FRAME, params)
  }

  private fun startBackgroundThread() {
    backgroundThread = HandlerThread("CarinaVisionThread").also { it.start() }
    backgroundHandler = Handler(backgroundThread!!.looper)
  }

  private fun stopBackgroundThread() {
    backgroundThread?.quitSafely()
    backgroundThread?.join()
    backgroundThread = null
    backgroundHandler = null
  }
}
