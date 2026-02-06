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

// Reusable temp canvas — avoids allocating per frame.
// Use a regular <canvas> for broad browser support (OffscreenCanvas unsupported on older Safari).
let _tmpCanvas: HTMLCanvasElement | null = null;
function getTempCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_tmpCanvas) {
    _tmpCanvas = document.createElement('canvas');
  }
  if (_tmpCanvas.width !== w || _tmpCanvas.height !== h) {
    _tmpCanvas.width = w;
    _tmpCanvas.height = h;
  }
  const ctx = _tmpCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  return { canvas: _tmpCanvas, ctx };
}

// Detect ctx.filter support once (Safari < 18 doesn't support it)
let _filterSupported: boolean | null = null;
function supportsCtxFilter(): boolean {
  if (_filterSupported !== null) return _filterSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.filter = 'grayscale(100%)';
    _filterSupported = ctx.filter === 'grayscale(100%)';
  } catch {
    _filterSupported = false;
  }
  return _filterSupported;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  options: RendererOptions
) {
  const { mirrorMode, seamMode, seamWidth, splitLineX, filter } = options;

  ctx.save();

  // Apply filters (only if the browser supports ctx.filter)
  if (filter !== 'none' && supportsCtxFilter()) {
    if (filter === 'grayscale') {
      ctx.filter = 'grayscale(100%)';
    } else if (filter === 'high-contrast') {
      ctx.filter = 'contrast(1.5) saturate(1.2)';
    }
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
    mirrorHalf(ctx, width, height, splitX, 'left', seamMode, seamWidth);
  } else {
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
  if (sourceHalf === 'left') {
    const srcWidth = splitX;
    if (srcWidth <= 0) return;

    // Grab the left half into a temp canvas
    const imageData = ctx.getImageData(0, 0, srcWidth, canvasH);
    const tmp = getTempCanvas(srcWidth, canvasH);
    tmp.ctx.putImageData(imageData, 0, 0);

    // Draw mirrored left onto right
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, canvasW - splitX, canvasH);
    ctx.clip();
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tmp.canvas, 0, 0);
    ctx.restore();

    if (seamMode === 'soft' && seamWidth > 0) {
      applySoftSeam(ctx, splitX, canvasH, seamWidth, canvasW);
    }
  } else {
    const srcWidth = canvasW - splitX;
    if (srcWidth <= 0) return;

    // Grab the right half into a temp canvas
    const imageData = ctx.getImageData(splitX, 0, srcWidth, canvasH);
    const tmp = getTempCanvas(srcWidth, canvasH);
    tmp.ctx.putImageData(imageData, 0, 0);

    // Draw mirrored right onto left
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, canvasH);
    ctx.clip();
    ctx.translate(splitX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-srcWidth, 0);
    ctx.drawImage(tmp.canvas, 0, 0);
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
  const halfSeam = Math.round(seamWidth / 2);
  const left = Math.max(0, splitX - halfSeam);
  const right = Math.min(canvasW, splitX + halfSeam);
  const regionWidth = right - left;

  if (regionWidth <= 0) return;

  const seamData = ctx.getImageData(left, 0, regionWidth, canvasH);
  const data = seamData.data;

  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < regionWidth; x++) {
      const px = left + x;
      const distFromSplit = Math.abs(px - splitX);
      const blendFactor = distFromSplit / halfSeam;
      const idx = (y * regionWidth + x) * 4;
      const alpha = Math.min(1, blendFactor * blendFactor);
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

  drawLine(kp.leftShoulder, kp.rightShoulder, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftHip, kp.rightHip, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftShoulder, kp.leftHip, 'rgba(0, 255, 100, 0.5)');
  drawLine(kp.rightShoulder, kp.rightHip, 'rgba(0, 255, 100, 0.5)');

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

  drawPoint(kp.leftShoulder, '#00ff66');
  drawPoint(kp.rightShoulder, '#00ff66');
  drawPoint(kp.leftHip, '#00ccff');
  drawPoint(kp.rightHip, '#00ccff');

  ctx.restore();
}
