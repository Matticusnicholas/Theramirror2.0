import type { MirrorMode, ResolutionMode, FilterMode } from '../types';
import type { CameraDevice } from '../hooks/useCamera';

interface ControlsProps {
  cameraActive: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  mirrorMode: MirrorMode;
  onMirrorModeChange: (mode: MirrorMode) => void;
  resolutionMode: ResolutionMode;
  onResolutionChange: (mode: ResolutionMode) => void;
  devices: CameraDevice[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  showCenterline: boolean;
  onToggleCenterline: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sessionMode: boolean;
  onToggleSessionMode: () => void;
  filter: FilterMode;
  onFilterChange: (filter: FilterMode) => void;
  onShowCalibration: () => void;
  onShowSafety: () => void;
  poseLoading: boolean;
  poseError: string | null;
}

export function Controls({
  cameraActive,
  onStartCamera,
  onStopCamera,
  mirrorMode,
  onMirrorModeChange,
  resolutionMode,
  onResolutionChange,
  devices,
  selectedDeviceId,
  onDeviceChange,
  showSkeleton,
  onToggleSkeleton,
  showCenterline,
  onToggleCenterline,
  isFullscreen,
  onToggleFullscreen,
  sessionMode,
  onToggleSessionMode,
  filter,
  onFilterChange,
  onShowCalibration,
  onShowSafety,
  poseLoading,
  poseError,
}: ControlsProps) {
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h1 className="app-title">THERAMIRROR</h1>
        <button className="btn btn-sm btn-ghost" onClick={onShowSafety}>
          About &amp; Safety
        </button>
      </div>

      {poseLoading && (
        <div className="status-bar status-loading">Loading pose detection model...</div>
      )}
      {poseError && (
        <div className="status-bar status-error">{poseError}</div>
      )}

      {/* Camera controls */}
      <div className="control-group">
        <div className="control-row">
          {!cameraActive ? (
            <button className="btn btn-primary btn-lg" onClick={onStartCamera}>
              Start Camera
            </button>
          ) : (
            <button className="btn btn-danger btn-lg" onClick={onStopCamera}>
              Stop Camera
            </button>
          )}
          <button className="btn btn-secondary" onClick={onToggleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>

        {devices.length > 1 && (
          <div className="control-row">
            <label className="control-label">Camera:</label>
            <select
              className="control-select"
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="control-row">
          <label className="control-label">Resolution:</label>
          <div className="btn-group">
            <button
              className={`btn btn-sm ${resolutionMode === 'performance' ? 'btn-active' : ''}`}
              onClick={() => onResolutionChange('performance')}
            >
              Performance
            </button>
            <button
              className={`btn btn-sm ${resolutionMode === 'quality' ? 'btn-active' : ''}`}
              onClick={() => onResolutionChange('quality')}
            >
              Quality
            </button>
          </div>
        </div>
      </div>

      {/* Mirror mode */}
      <div className="control-group">
        <label className="control-label">Mirror Mode:</label>
        <div className="btn-group">
          <button
            className={`btn ${mirrorMode === 'left-to-right' ? 'btn-active' : ''}`}
            onClick={() => onMirrorModeChange('left-to-right')}
          >
            Left &rarr; Right
          </button>
          <button
            className={`btn ${mirrorMode === 'right-to-left' ? 'btn-active' : ''}`}
            onClick={() => onMirrorModeChange('right-to-left')}
          >
            Right &rarr; Left
          </button>
        </div>
      </div>

      {/* Overlays */}
      <div className="control-group">
        <label className="control-label">Overlays:</label>
        <div className="control-row">
          <button
            className={`btn btn-sm ${showCenterline ? 'btn-active' : ''}`}
            onClick={onToggleCenterline}
          >
            Centerline Guide
          </button>
          <button
            className={`btn btn-sm ${showSkeleton ? 'btn-active' : ''}`}
            onClick={onToggleSkeleton}
          >
            Skeleton
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="control-group">
        <label className="control-label">Filter:</label>
        <div className="btn-group">
          <button
            className={`btn btn-sm ${filter === 'none' ? 'btn-active' : ''}`}
            onClick={() => onFilterChange('none')}
          >
            None
          </button>
          <button
            className={`btn btn-sm ${filter === 'grayscale' ? 'btn-active' : ''}`}
            onClick={() => onFilterChange('grayscale')}
          >
            Grayscale
          </button>
          <button
            className={`btn btn-sm ${filter === 'high-contrast' ? 'btn-active' : ''}`}
            onClick={() => onFilterChange('high-contrast')}
          >
            High Contrast
          </button>
        </div>
      </div>

      {/* Calibration & Session */}
      <div className="control-group">
        <div className="control-row">
          <button className="btn btn-secondary" onClick={onShowCalibration}>
            Calibration
          </button>
          <button
            className={`btn ${sessionMode ? 'btn-active' : 'btn-secondary'}`}
            onClick={onToggleSessionMode}
          >
            {sessionMode ? 'Exit Session' : 'Session Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
