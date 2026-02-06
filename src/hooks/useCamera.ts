import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolutionMode } from '../types';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export type CameraPermission = 'prompt' | 'granted' | 'denied' | 'error';

const RESOLUTION_CONSTRAINTS: Record<ResolutionMode, MediaTrackConstraints> = {
  performance: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 },
  },
  quality: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

export function useCamera(resolutionMode: ResolutionMode, selectedDeviceId: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<CameraPermission>('prompt');
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setDevices(videoDevices);
    } catch {
      // Silently ignore enumeration errors
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          ...RESOLUTION_CONSTRAINTS[resolutionMode],
          ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' }),
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // playsInline is critical for iOS Safari
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        await videoRef.current.play();
        setVideoReady(true);
      }

      setPermission('granted');
      setIsActive(true);
      await enumerateDevices();
    } catch (err) {
      const error = err as DOMException;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermission('denied');
      } else {
        setPermission('error');
      }
      setIsActive(false);
      setVideoReady(false);
    }
  }, [resolutionMode, selectedDeviceId, enumerateDevices]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setVideoReady(false);
  }, []);

  // Restart camera when resolution or device changes while active
  useEffect(() => {
    if (isActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolutionMode, selectedDeviceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    videoRef,
    permission,
    devices,
    isActive,
    videoReady,
    startCamera,
    stopCamera,
  };
}
