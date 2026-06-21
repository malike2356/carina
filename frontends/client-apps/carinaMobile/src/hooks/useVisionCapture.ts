import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { CameraVision, type VisionFrame } from '@/lib/camera-vision';

interface UseVisionCaptureOptions {
  fps?: number;
  enabled?: boolean;
  onFrame: (frame: VisionFrame) => void;
}

export function useVisionCapture({ fps = 2, enabled = true, onFrame }: UseVisionCaptureOptions) {
  const isCapturing = useRef(false);
  const frameSubRef = useRef<ReturnType<typeof CameraVision.onFrame>>(null);

  const start = useCallback(async () => {
    if (isCapturing.current || !enabled) return;
    await CameraVision.startCapture(fps);
    frameSubRef.current = CameraVision.onFrame(onFrame);
    isCapturing.current = true;
  }, [enabled, fps, onFrame]);

  const stop = useCallback(async () => {
    if (!isCapturing.current) return;
    frameSubRef.current?.remove();
    frameSubRef.current = null;
    await CameraVision.stopCapture();
    isCapturing.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      void stop();
      return;
    }
    void start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        void CameraVision.pauseCapture();
      } else if (state === 'active') {
        void CameraVision.resumeCapture();
      }
    });

    return () => {
      sub.remove();
      void stop();
    };
  }, [enabled, start, stop]);
}
