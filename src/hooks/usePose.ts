import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseKeypoints, PoseMidline } from '../types';
import { extractKeypoints, computeMidline, extractKeypointsCoco } from '../lib/poseUtils';
import { EMAFilter } from '../lib/smoothing';

/**
 * Unified pose interface — wraps either MediaPipe or MoveNet.
 */
interface PoseBackend {
  detect(video: HTMLVideoElement, timestamp: number): PoseKeypoints | null;
  name: string;
}

interface UsePoseOptions {
  enabled: boolean;
  smoothingAlpha: number;
  inferenceInterval: number;
}

export function usePose({ enabled, smoothingAlpha, inferenceInterval }: UsePoseOptions) {
  const backendRef = useRef<PoseBackend | null>(null);
  const smootherRef = useRef(new EMAFilter(smoothingAlpha));
  const frameCountRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [midline, setMidline] = useState<PoseMidline | null>(null);
  const [keypoints, setKeypoints] = useState<PoseKeypoints | null>(null);
  const [backendName, setBackendName] = useState<string>('');
  const initPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    smootherRef.current.setAlpha(smoothingAlpha);
  }, [smoothingAlpha]);

  const initialize = useCallback(async () => {
    if (backendRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    const initPromise = (async () => {
      setLoading(true);
      setError(null);

      // --- Try MediaPipe first (best quality, 33 landmarks) ---
      try {
        const backend = await initMediaPipe();
        backendRef.current = backend;
        setBackendName(backend.name);
        setLoading(false);
        return;
      } catch (e) {
        console.warn('MediaPipe init failed, trying MoveNet fallback:', e);
      }

      // --- Fall back to TF.js MoveNet (wider browser compat) ---
      try {
        const backend = await initMoveNet();
        backendRef.current = backend;
        setBackendName(backend.name);
        setLoading(false);
        return;
      } catch (e) {
        console.warn('MoveNet init also failed:', e);
      }

      // Both failed
      setError(
        'Pose detection unavailable on this browser. ' +
        'The mirror still works — use the Calibration panel to set the centerline manually.'
      );
      setLoading(false);
    })();

    initPromiseRef.current = initPromise;
    return initPromise;
  }, []);

  const detectPose = useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      if (!enabled || !backendRef.current) return;

      frameCountRef.current++;
      if (frameCountRef.current % inferenceInterval !== 0) return;

      try {
        const kp = backendRef.current.detect(video, timestamp);
        if (kp) {
          setKeypoints(kp);
          const raw = computeMidline(kp);
          if (raw) {
            const smoothedX = smootherRef.current.update(raw.x);
            setMidline({ ...raw, x: smoothedX });
          }
        }
      } catch {
        // Skip failed frames silently
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
      backendRef.current = null;
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
    backendName,
  };
}

// ─── MediaPipe backend ──────────────────────────────────────────────────

async function initMediaPipe(): Promise<PoseBackend> {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let landmarker: any;

  try {
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  return {
    name: 'MediaPipe',
    detect(video, timestamp) {
      const result = landmarker.detectForVideo(video, timestamp);
      if (result.landmarks && result.landmarks.length > 0) {
        return extractKeypoints(result.landmarks[0]);
      }
      return null;
    },
  };
}

// ─── TF.js MoveNet backend (fallback for iOS Safari, etc.) ──────────────

async function initMoveNet(): Promise<PoseBackend> {
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();

  const poseDetection = await import('@tensorflow-models/pose-detection');
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    }
  );

  // MoveNet's estimatePoses() is async, but our detect() is called
  // synchronously from the rAF loop. Solution: fire-and-forget the
  // async detection and return the most recent cached result.
  let lastResult: PoseKeypoints | null = null;
  let detecting = false;

  return {
    name: 'MoveNet',
    detect(video) {
      if (!detecting) {
        detecting = true;
        detector.estimatePoses(video).then(poses => {
          if (poses.length > 0) {
            lastResult = extractKeypointsCoco(
              poses[0].keypoints,
              video.videoWidth || video.width,
              video.videoHeight || video.height
            );
          }
          detecting = false;
        }).catch(() => {
          detecting = false;
        });
      }
      return lastResult;
    },
  };
}
