export type MirrorMode = 'left-to-right' | 'right-to-left';
export type ResolutionMode = 'performance' | 'quality';
export type SeamMode = 'hard' | 'soft';
export type FilterMode = 'none' | 'grayscale' | 'high-contrast';

export interface PoseMidline {
  /** X coordinate of the midline in normalized [0,1] space */
  x: number;
  /** Angle of the midline in radians (0 = vertical) */
  angle: number;
  /** Confidence score 0-1 */
  confidence: number;
}

export interface PoseKeypoints {
  leftShoulder: { x: number; y: number; visibility: number } | null;
  rightShoulder: { x: number; y: number; visibility: number } | null;
  leftHip: { x: number; y: number; visibility: number } | null;
  rightHip: { x: number; y: number; visibility: number } | null;
}

export interface RendererOptions {
  mirrorMode: MirrorMode;
  seamMode: SeamMode;
  seamWidth: number;
  splitLineX: number;
  showSkeleton: boolean;
  showCenterline: boolean;
  filter: FilterMode;
  keypoints: PoseKeypoints | null;
}

export interface CalibrationState {
  manualOffset: number;
  smoothing: number;
  seamSoftness: number;
  locked: boolean;
  poseFrequency: number;
}

export interface AppState {
  cameraActive: boolean;
  mirrorMode: MirrorMode;
  resolutionMode: ResolutionMode;
  seamMode: SeamMode;
  filter: FilterMode;
  showSkeleton: boolean;
  showCenterline: boolean;
  calibration: CalibrationState;
  showFirstRun: boolean;
  showSafety: boolean;
  sessionMode: boolean;
  selectedDeviceId: string;
}
