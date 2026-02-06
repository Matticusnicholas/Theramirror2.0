import { useState, useCallback, useEffect, useRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { usePose } from './hooks/usePose';
import { useFullscreen } from './hooks/useFullscreen';
import { CameraView } from './components/CameraView';
import { Controls } from './components/Controls';
import { CalibrationPanel } from './components/CalibrationPanel';
import { FirstRunGuide } from './components/FirstRunGuide';
import { SafetyModal } from './components/SafetyModal';
import { PermissionPrompt } from './components/PermissionPrompt';
import type {
  MirrorMode,
  ResolutionMode,
  SeamMode,
  FilterMode,
  CalibrationState,
} from './types';
import './App.css';

const FIRST_RUN_KEY = 'theramirror_seen_guide';

function App() {
  // Core state
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('left-to-right');
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('performance');
  const [seamMode, setSeamMode] = useState<SeamMode>('hard');
  const [filter, setFilter] = useState<FilterMode>('none');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showCenterline, setShowCenterline] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [sessionMode, setSessionMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);

  // First run guide
  const [showFirstRun, setShowFirstRun] = useState(() => {
    return !localStorage.getItem(FIRST_RUN_KEY);
  });

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationState>({
    manualOffset: 0,
    smoothing: 0.2,
    seamSoftness: 30,
    locked: false,
    poseFrequency: 2,
  });

  // Hooks
  const camera = useCamera(resolutionMode, selectedDeviceId);
  const pose = usePose({
    enabled: !calibration.locked,
    smoothingAlpha: calibration.smoothing,
    inferenceInterval: calibration.poseFrequency,
  });
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Compute the effective split line: pose midline + manual offset
  const computedSplitLine = (() => {
    const poseMidX = pose.midline?.x ?? 0.5;
    const canvasWidth = camera.videoRef.current?.videoWidth || 640;
    const offsetNormalized = calibration.manualOffset / canvasWidth;
    return Math.max(0.05, Math.min(0.95, poseMidX + offsetNormalized));
  })();

  // Initialize pose when camera starts
  const handleStartCamera = useCallback(async () => {
    await camera.startCamera();
    await pose.initialize();
  }, [camera, pose]);

  const handleStopCamera = useCallback(() => {
    camera.stopCamera();
    pose.resetSmoothing();
  }, [camera, pose]);

  // Pose detection callback — called each animation frame
  const handleFrame = useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      if (!calibration.locked) {
        pose.detectPose(video, timestamp);
      }
    },
    [pose, calibration.locked]
  );

  // Session mode: hide controls after 5 seconds of inactivity
  useEffect(() => {
    if (sessionMode) {
      const hideTimer = () => {
        clearTimeout(sessionTimerRef.current);
        setControlsVisible(true);
        sessionTimerRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 5000);
      };
      hideTimer();
      return () => clearTimeout(sessionTimerRef.current);
    } else {
      setControlsVisible(true);
      clearTimeout(sessionTimerRef.current);
    }
  }, [sessionMode]);

  const handleSessionTap = useCallback(() => {
    if (!sessionMode) return;
    setControlsVisible(true);
    clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 5000);
  }, [sessionMode]);

  const handleCloseFirstRun = useCallback(() => {
    setShowFirstRun(false);
    localStorage.setItem(FIRST_RUN_KEY, 'true');
  }, []);

  const handleCalibrationChange = useCallback((update: Partial<CalibrationState>) => {
    setCalibration((prev) => ({ ...prev, ...update }));
  }, []);

  return (
    <div className={`app ${sessionMode ? 'session-active' : ''}`}>
      <CameraView
        videoRef={camera.videoRef}
        videoReady={camera.videoReady}
        cameraActive={camera.isActive}
        mirrorMode={mirrorMode}
        seamMode={seamMode}
        seamWidth={calibration.seamSoftness}
        splitLineNormalized={computedSplitLine}
        showSkeleton={showSkeleton}
        showCenterline={showCenterline}
        filter={filter}
        keypoints={pose.keypoints}
        onFrame={handleFrame}
        sessionMode={sessionMode}
        onTap={handleSessionTap}
      />

      <PermissionPrompt
        permission={camera.permission}
        onRetry={handleStartCamera}
      />

      {/* Controls — hidden in session mode after timeout */}
      <div className={`controls-wrapper ${!controlsVisible ? 'controls-hidden' : ''}`}>
        <Controls
          cameraActive={camera.isActive}
          onStartCamera={handleStartCamera}
          onStopCamera={handleStopCamera}
          mirrorMode={mirrorMode}
          onMirrorModeChange={setMirrorMode}
          resolutionMode={resolutionMode}
          onResolutionChange={setResolutionMode}
          devices={camera.devices}
          selectedDeviceId={selectedDeviceId}
          onDeviceChange={setSelectedDeviceId}
          showSkeleton={showSkeleton}
          onToggleSkeleton={() => setShowSkeleton((v) => !v)}
          showCenterline={showCenterline}
          onToggleCenterline={() => setShowCenterline((v) => !v)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          sessionMode={sessionMode}
          onToggleSessionMode={() => setSessionMode((v) => !v)}
          filter={filter}
          onFilterChange={setFilter}
          onShowCalibration={() => setShowCalibration(true)}
          onShowSafety={() => setShowSafety(true)}
          poseLoading={pose.loading}
          poseError={pose.error}
        />
      </div>

      {/* Modals */}
      {showCalibration && (
        <CalibrationPanel
          calibration={calibration}
          seamMode={seamMode}
          onCalibrationChange={handleCalibrationChange}
          onSeamModeChange={setSeamMode}
          onClose={() => setShowCalibration(false)}
          poseConfidence={pose.midline?.confidence ?? 0}
        />
      )}

      {showFirstRun && <FirstRunGuide onClose={handleCloseFirstRun} />}
      {showSafety && <SafetyModal onClose={() => setShowSafety(false)} />}
    </div>
  );
}

export default App;
