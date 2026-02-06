import type { CalibrationState, SeamMode } from '../types';

interface CalibrationPanelProps {
  calibration: CalibrationState;
  seamMode: SeamMode;
  onCalibrationChange: (update: Partial<CalibrationState>) => void;
  onSeamModeChange: (mode: SeamMode) => void;
  onClose: () => void;
  poseConfidence: number;
}

export function CalibrationPanel({
  calibration,
  seamMode,
  onCalibrationChange,
  onSeamModeChange,
  onClose,
  poseConfidence,
}: CalibrationPanelProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content calibration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Calibration</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="calibration-body">
          {/* Pose status */}
          <div className="calibration-status">
            <span>Pose Tracking:</span>
            <span
              className={`status-dot ${
                poseConfidence > 0.5 ? 'status-good' : poseConfidence > 0 ? 'status-partial' : 'status-none'
              }`}
            />
            <span>
              {poseConfidence > 0.5
                ? 'Good'
                : poseConfidence > 0
                ? 'Partial'
                : 'Not detected'}
            </span>
          </div>

          {/* Manual offset */}
          <div className="calibration-control">
            <label>
              Centerline Offset: <strong>{calibration.manualOffset}px</strong>
            </label>
            <input
              type="range"
              min={-200}
              max={200}
              value={calibration.manualOffset}
              onChange={(e) =>
                onCalibrationChange({ manualOffset: Number(e.target.value) })
              }
              className="slider"
            />
            <div className="slider-labels">
              <span>Left -200</span>
              <span>0</span>
              <span>Right +200</span>
            </div>
          </div>

          {/* Smoothing */}
          <div className="calibration-control">
            <label>
              Smoothing: <strong>{calibration.smoothing.toFixed(2)}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.round(calibration.smoothing * 100)}
              onChange={(e) =>
                onCalibrationChange({ smoothing: Number(e.target.value) / 100 })
              }
              className="slider"
            />
            <div className="slider-labels">
              <span>More smooth</span>
              <span>More responsive</span>
            </div>
          </div>

          {/* Seam mode */}
          <div className="calibration-control">
            <label>Seam Blend:</label>
            <div className="btn-group">
              <button
                className={`btn btn-sm ${seamMode === 'hard' ? 'btn-active' : ''}`}
                onClick={() => onSeamModeChange('hard')}
              >
                Hard
              </button>
              <button
                className={`btn btn-sm ${seamMode === 'soft' ? 'btn-active' : ''}`}
                onClick={() => onSeamModeChange('soft')}
              >
                Soft
              </button>
            </div>
          </div>

          {/* Seam softness (only visible in soft mode) */}
          {seamMode === 'soft' && (
            <div className="calibration-control">
              <label>
                Seam Width: <strong>{calibration.seamSoftness}px</strong>
              </label>
              <input
                type="range"
                min={5}
                max={80}
                value={calibration.seamSoftness}
                onChange={(e) =>
                  onCalibrationChange({ seamSoftness: Number(e.target.value) })
                }
                className="slider"
              />
            </div>
          )}

          {/* Pose inference frequency */}
          <div className="calibration-control">
            <label>
              Pose Frequency: every <strong>{calibration.poseFrequency}</strong> frame(s)
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={calibration.poseFrequency}
              onChange={(e) =>
                onCalibrationChange({ poseFrequency: Number(e.target.value) })
              }
              className="slider"
            />
            <div className="slider-labels">
              <span>Every frame (slower)</span>
              <span>Every 10th (faster)</span>
            </div>
          </div>

          {/* Lock centerline */}
          <div className="calibration-control">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={calibration.locked}
                onChange={(e) =>
                  onCalibrationChange({ locked: e.target.checked })
                }
              />
              Lock centerline (stop pose updates)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
