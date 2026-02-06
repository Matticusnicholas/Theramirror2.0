import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { PoseKeypoints, PoseMidline } from '../types';
import { extractKeypoints, computeMidline } from '../lib/poseUtils';
import { EMAFilter } from '../lib/smoothing';

interface UsePoseOptions {
  enabled: boolean;
  smoothingAlpha: number;
  inferenceInterval: number; // Run pose every N frames
}

export function usePose({ enabled, smoothingAlpha, inferenceInterval }: UsePoseOptions) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const smootherRef = useRef(new EMAFilter(smoothingAlpha));
  const frameCountRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [midline, setMidline] = useState<PoseMidline | null>(null);
  const [keypoints, setKeypoints] = useState<PoseKeypoints | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Update smoother alpha when it changes
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
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        landmarkerRef.current = landmarker;
      } catch (err) {
        console.error('Failed to load pose model:', err);
        setError('Failed to load pose detection model. Check your connection.');
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

  // Cleanup on unmount
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
