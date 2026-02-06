import { useEffect, useRef, useCallback } from 'react';
import { renderFrame } from '../lib/renderer';
import type { MirrorMode, SeamMode, FilterMode, PoseKeypoints } from '../types';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoReady: boolean;
  cameraActive: boolean;
  mirrorMode: MirrorMode;
  seamMode: SeamMode;
  seamWidth: number;
  splitLineNormalized: number;
  showSkeleton: boolean;
  showCenterline: boolean;
  filter: FilterMode;
  keypoints: PoseKeypoints | null;
  onFrame?: (video: HTMLVideoElement, timestamp: number) => void;
  sessionMode: boolean;
  onTap?: () => void;
}

export function CameraView({
  videoRef,
  videoReady,
  cameraActive,
  mirrorMode,
  seamMode,
  seamWidth,
  splitLineNormalized,
  showSkeleton,
  showCenterline,
  filter,
  keypoints,
  onFrame,
  sessionMode,
  onTap,
}: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    // Match canvas size to video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    try {
      // Pose detection callback
      if (onFrame) {
        onFrame(video, performance.now());
      }

      renderFrame(ctx, video, canvas.width, canvas.height, {
        mirrorMode,
        seamMode,
        seamWidth,
        splitLineX: splitLineNormalized,
        showSkeleton,
        showCenterline,
        filter,
        keypoints,
      });
    } catch (err) {
      // Log but don't kill the loop — next frame may succeed
      console.warn('Render frame error:', err);
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [
    videoRef,
    mirrorMode,
    seamMode,
    seamWidth,
    splitLineNormalized,
    showSkeleton,
    showCenterline,
    filter,
    keypoints,
    onFrame,
  ]);

  useEffect(() => {
    if (cameraActive && videoReady) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, videoReady, renderLoop]);

  return (
    <div
      className="camera-view"
      onClick={sessionMode ? onTap : undefined}
    >
      {/* Hidden video element — we render to canvas instead */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        className="mirror-canvas"
      />
      {!cameraActive && (
        <div className="camera-placeholder">
          <div className="placeholder-icon">&#x1F4F7;</div>
          <p>Camera is off</p>
          <p className="placeholder-hint">Press "Start Camera" to begin</p>
        </div>
      )}
    </div>
  );
}
