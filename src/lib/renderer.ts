import type { RendererOptions, PoseKeypoints } from '../types';

/**
 * Core canvas renderer that performs the mirroring compositing.
 *
 * Pipeline per frame:
 * 1. Draw camera frame to canvas
 * 2. Compute pixel-space split line
 * 3. Crop source half, mirror it, composite onto opposite half
 * 4. Apply optional soft seam blending
 * 5. Draw optional overlays (skeleton, centerline)
 */

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  options: RendererOptions
) {
  const { mirrorMode, seamMode, seamWidth, splitLineX, filter } = options;

  ctx.save();

  // Apply filters
  if (filter === 'grayscale') {
    ctx.filter = 'grayscale(100%)';
  } else if (filter === 'high-contrast') {
    ctx.filter = 'contrast(1.5) saturate(1.2)';
  } else {
    ctx.filter = 'none';
  }

  // The video feed from getUserMedia is typically mirrored for a "selfie" view.
  // We draw it mirrored so left/right matches the user's perspective.
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  // Split line in pixel space
  const splitX = Math.round(splitLineX * width);

  // Perform mirroring
  if (mirrorMode === 'left-to-right') {
    // Take left half (user's intact right side in selfie view), mirror onto right half
    mirrorHalf(ctx, width, height, splitX, 'left', seamMode, seamWidth);
  } else {
    // Take right half (user's intact left side in selfie view), mirror onto left half
    mirrorHalf(ctx, width, height, splitX, 'right', seamMode, seamWidth);
  }

  // Draw overlays
  if (options.showCenterline) {
    drawCenterline(ctx, splitX, height);
  }
  if (options.showSkeleton && options.keypoints) {
    drawSkeleton(ctx, options.keypoints, width, height);
  }
}

function mirrorHalf(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  splitX: number,
  sourceHalf: 'left' | 'right',
  seamMode: 'hard' | 'soft',
  seamWidth: number
) {
  // Get the source region image data
  if (sourceHalf === 'left') {
    // Source: [0, splitX], Target: [splitX, canvasW]
    const srcWidth = splitX;
    if (srcWidth <= 0) return;

    // Draw mirrored left onto right
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, canvasW - splitX, canvasH);
    ctx.clip();

    // Mirror transform: flip around the split line
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);

    // Draw only the left portion
    // We need to grab what's currently on canvas in the left region
    // Use drawImage from canvas itself
    const imageData = ctx.getImageData(0, 0, splitX, canvasH);
    const tempCanvas = new OffscreenCanvas(splitX, canvasH);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    // Soft seam blending
    if (seamMode === 'soft' && seamWidth > 0) {
      applySoftSeam(ctx, splitX, canvasH, seamWidth, canvasW);
    }
  } else {
    // Source: [splitX, canvasW], Target: [0, splitX]
    const srcWidth = canvasW - splitX;
    if (srcWidth <= 0) return;

    // Draw mirrored right onto left
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, canvasH);
    ctx.clip();

    const imageData = ctx.getImageData(splitX, 0, srcWidth, canvasH);
    const tempCanvas = new OffscreenCanvas(srcWidth, canvasH);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Mirror: flip around split line
    ctx.translate(splitX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-srcWidth, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    if (seamMode === 'soft' && seamWidth > 0) {
      applySoftSeam(ctx, splitX, canvasH, seamWidth, canvasW);
    }
  }
}

function applySoftSeam(
  ctx: CanvasRenderingContext2D,
  splitX: number,
  canvasH: number,
  seamWidth: number,
  canvasW: number
) {
  // Create a gradient mask along the seam to blend the mirrored edge
  // We'll re-read the original frame from one side and blend it using alpha gradient
  const halfSeam = Math.round(seamWidth / 2);
  const left = Math.max(0, splitX - halfSeam);
  const right = Math.min(canvasW, splitX + halfSeam);
  const regionWidth = right - left;

  if (regionWidth <= 0) return;

  // Get the current seam region
  const seamData = ctx.getImageData(left, 0, regionWidth, canvasH);
  const data = seamData.data;

  // Apply a horizontal alpha fade: full opacity at edges, blended at center
  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < regionWidth; x++) {
      const px = left + x;
      const distFromSplit = Math.abs(px - splitX);
      const blendFactor = distFromSplit / halfSeam;
      // Near the split: lower alpha (more transparent blend)
      // This creates a smooth transition
      const idx = (y * regionWidth + x) * 4;
      const alpha = Math.min(1, blendFactor * blendFactor);
      // Slightly reduce harsh edges by softening RGB near the seam center
      data[idx + 3] = Math.round(data[idx + 3] * (0.5 + 0.5 * alpha));
    }
  }

  ctx.putImageData(seamData, left, 0);
}

function drawCenterline(ctx: CanvasRenderingContext2D, splitX: number, height: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, height);
  ctx.stroke();
  ctx.restore();
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  kp: PoseKeypoints,
  width: number,
  height: number
) {
  ctx.save();

  const drawPoint = (point: { x: number; y: number } | null, color: string) => {
    if (!point) return;
    // Note: keypoints are in normalized [0,1] coordinates
    // and the video is drawn mirrored, so we mirror x
    const px = (1 - point.x) * width;
    const py = point.y * height;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawLine = (
    a: { x: number; y: number } | null,
    b: { x: number; y: number } | null,
    color: string
  ) => {
    if (!a || !b) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo((1 - a.x) * width, a.y * height);
    ctx.lineTo((1 - b.x) * width, b.y * height);
    ctx.stroke();
  };

  // Draw connections
  drawLine(kp.leftShoulder, kp.rightShoulder, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftHip, kp.rightHip, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftShoulder, kp.leftHip, 'rgba(0, 255, 100, 0.5)');
  drawLine(kp.rightShoulder, kp.rightHip, 'rgba(0, 255, 100, 0.5)');

  // Draw midline from shoulder center to hip center
  if (kp.leftShoulder && kp.rightShoulder && kp.leftHip && kp.rightHip) {
    const shoulderMid = {
      x: (kp.leftShoulder.x + kp.rightShoulder.x) / 2,
      y: (kp.leftShoulder.y + kp.rightShoulder.y) / 2,
    };
    const hipMid = {
      x: (kp.leftHip.x + kp.rightHip.x) / 2,
      y: (kp.leftHip.y + kp.rightHip.y) / 2,
    };
    drawLine(shoulderMid, hipMid, 'rgba(255, 200, 0, 0.8)');
  }

  // Draw keypoints
  drawPoint(kp.leftShoulder, '#00ff66');
  drawPoint(kp.rightShoulder, '#00ff66');
  drawPoint(kp.leftHip, '#00ccff');
  drawPoint(kp.rightHip, '#00ccff');

  ctx.restore();
}
