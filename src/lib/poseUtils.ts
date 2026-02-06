import type { PoseKeypoints, PoseMidline } from '../types';

const MIN_VISIBILITY = 0.5;

/**
 * Extract relevant keypoints from MediaPipe PoseLandmarker results.
 * Landmark indices: leftShoulder=11, rightShoulder=12, leftHip=23, rightHip=24
 */
export function extractKeypoints(
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>
): PoseKeypoints {
  const get = (idx: number) => {
    const lm = landmarks[idx];
    if (!lm) return null;
    const vis = lm.visibility ?? 0;
    if (vis < MIN_VISIBILITY) return null;
    return { x: lm.x, y: lm.y, visibility: vis };
  };

  return {
    leftShoulder: get(11),
    rightShoulder: get(12),
    leftHip: get(23),
    rightHip: get(24),
  };
}

/**
 * Compute the torso midline from shoulder and hip keypoints.
 * Returns normalized x position (0-1) and angle.
 */
export function computeMidline(kp: PoseKeypoints): PoseMidline | null {
  const points: Array<{ x: number; y: number }> = [];

  // Shoulder midpoint
  if (kp.leftShoulder && kp.rightShoulder) {
    points.push({
      x: (kp.leftShoulder.x + kp.rightShoulder.x) / 2,
      y: (kp.leftShoulder.y + kp.rightShoulder.y) / 2,
    });
  }

  // Hip midpoint
  if (kp.leftHip && kp.rightHip) {
    points.push({
      x: (kp.leftHip.x + kp.rightHip.x) / 2,
      y: (kp.leftHip.y + kp.rightHip.y) / 2,
    });
  }

  if (points.length === 0) return null;

  // Average midline X
  const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;

  // Compute angle if we have both shoulder and hip midpoints
  let angle = 0;
  if (points.length === 2) {
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    angle = Math.atan2(dx, dy); // angle from vertical
  }

  // Confidence based on how many keypoints are visible
  const visibleCount = [kp.leftShoulder, kp.rightShoulder, kp.leftHip, kp.rightHip]
    .filter(Boolean).length;
  const confidence = visibleCount / 4;

  return { x: avgX, angle, confidence };
}

/**
 * Extract keypoints from TF.js MoveNet / COCO format.
 * COCO indices: leftShoulder=5, rightShoulder=6, leftHip=11, rightHip=12
 * MoveNet returns pixel coordinates — we normalize to [0,1] using video dimensions.
 */
export function extractKeypointsCoco(
  keypoints: Array<{ x: number; y: number; score?: number; name?: string }>,
  videoWidth: number,
  videoHeight: number
): PoseKeypoints {
  const MIN_SCORE = 0.3;

  const get = (idx: number) => {
    const kp = keypoints[idx];
    if (!kp) return null;
    const score = kp.score ?? 0;
    if (score < MIN_SCORE) return null;
    return {
      x: videoWidth > 0 ? kp.x / videoWidth : kp.x,
      y: videoHeight > 0 ? kp.y / videoHeight : kp.y,
      visibility: score,
    };
  };

  return {
    leftShoulder: get(5),
    rightShoulder: get(6),
    leftHip: get(11),
    rightHip: get(12),
  };
}
