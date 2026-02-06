import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseKeypoints, PoseMidline } from '../types';
import { extractKeypoints, computeMidline } from '../lib/poseUtils';
import { EMAFilter } from '../lib/smoothing';

// Lazy-loaded MediaPipe types
type PoseLandmarkerType = import('@mediapipe/tasks-vision').PoseLandmarker;

interface UsePoseOptions {
  enabled: boolean;
  smoothingAlpha: number;
  inferenceInterval: number;
}

export function usePose({ enabled, smoothingAlpha, inferenceInterval }: UsePoseOptions) {
  const landmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const smootherRef = useRef(new EMAFilter(smoothingAlpha));
  const frameCountRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [midline, setMidline] = useState<PoseMidline | null>(null);
  const [keypoints, setKeypoints] = useState<PoseKeypoints | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    smootherRef.current.setAlpha(smoothingAlpha);
  }, [smoothingAlpha]);

  const initialize = useCallback(async () => {
    if (landmarkerRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    const initPromise = (async () => {
      setLoading(true);
      setError(null);
      try {
        // Dynamic import — if @mediapipe/tasks-vision fails to load (WASM not
        // supported, network error, etc.) it won't crash the rest of the app.
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        let delegate: 'GPU' | 'CPU' = 'GPU';
        try {
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          landmarkerRef.current = landmarker;
        } catch {
          // GPU delegate can fail on some mobile devices — fall back to CPU
          delegate = 'CPU';
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          landmarkerRef.current = landmarker;
        }
      } catch (err) {
        console.error('Failed to load pose model:', err);
        setError(
          'Failed to load pose detection. The mirror will still work — ' +
          'the centerline just won\'t track your body automatically.'
        );
      } finally {
        setLoading(false);
      }
    })();

    initPromiseRef.current = initPromise;
    return initPromise;
  }, []);

  const detectPose = useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      if (!enabled || !landmarkerRef.current) return;

      frameCountRef.current++;
      if (frameCountRef.current % inferenceInterval !== 0) return;

      try {
        const result = landmarkerRef.current.detectForVideo(video, timestamp);
        if (result.landmarks && result.landmarks.length > 0) {
          const kp = extractKeypoints(result.landmarks[0]);
          setKeypoints(kp);

          const raw = computeMidline(kp);
          if (raw) {
            const smoothedX = smootherRef.current.update(raw.x);
            setMidline({ ...raw, x: smoothedX });
          }
        }
      } catch {
        // Pose inference can occasionally fail on a frame; skip silently
      }
    },
    [enabled, inferenceInterval]
  );

  const resetSmoothing = useCallback(() => {
    smootherRef.current.reset();
    setMidline(null);
    setKeypoints(null);
  }, []);

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  return {
    initialize,
    detectPose,
    resetSmoothing,
    midline,
    keypoints,
    loading,
    error,
  };
}
