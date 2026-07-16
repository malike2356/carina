import AVFoundation
import Foundation
import React
import UIKit

@objc(CarinaVisionModule)
class CarinaVisionModule: RCTEventEmitter, AVCaptureVideoDataOutputSampleBufferDelegate {

  private var captureSession: AVCaptureSession?
  private var captureQueue = DispatchQueue(label: "com.carina.vision")
  private var isCapturing = false
  private var fpsPeriodMs: Double = 500
  private var lastFrameTime: Double = 0

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! { ["vision_frame"] }

  @objc func startCapture(_ fps: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    fpsPeriodMs = fps > 0 ? (1000.0 / Double(fps)) : 500.0
    captureQueue.async {
      self.setupSession()
      self.isCapturing = true
      resolve(nil)
    }
  }

  @objc func stopCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isCapturing = false
    captureSession?.stopRunning()
    captureSession = nil
    resolve(nil)
  }

  @objc func pauseCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isCapturing = false
    resolve(nil)
  }

  @objc func resumeCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isCapturing = true
    resolve(nil)
  }

  private func setupSession() {
    let session = AVCaptureSession()
    session.sessionPreset = .vga640x480
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let input = try? AVCaptureDeviceInput(device: device) else { return }
    session.addInput(input)

    let output = AVCaptureVideoDataOutput()
    output.setSampleBufferDelegate(self, queue: captureQueue)
    output.alwaysDiscardsLateVideoFrames = true
    session.addOutput(output)

    captureSession = session
    session.startRunning()
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard isCapturing else { return }
    let now = Date().timeIntervalSince1970 * 1000
    guard now - lastFrameTime >= fpsPeriodMs else { return }
    lastFrameTime = now

    guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let ciImage = CIImage(cvPixelBuffer: imageBuffer)
    let context = CIContext()
    guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
    let uiImage = UIImage(cgImage: cgImage)
    guard let jpegData = uiImage.jpegData(compressionQuality: 0.5) else { return }
    let b64 = jpegData.base64EncodedString()

    sendEvent(withName: "vision_frame", body: ["jpeg": b64, "timestamp": now])
  }
}
