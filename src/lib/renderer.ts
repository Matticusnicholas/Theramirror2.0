import type { RendererOptions, PoseKeypoints } from '../types';

/**
 * Canvas mirroring renderer.
 *
 * Pipeline (all GPU-accelerated drawImage, NO getImageData):
 * 1. Draw video (flipped for selfie view) to an offscreen temp canvas
 * 2. Draw the full temp canvas onto the visible canvas (base layer)
 * 3. Clip to the target half, apply flip transform, draw full temp canvas again
 *    — the clip + transform automatically selects the source half and mirrors it
 * 4. Optional soft seam: redraw a thin strip of the original near the split
 * 5. Draw overlays (centerline, skeleton)
 */

// Persistent offscreen buffer — avoids allocation per frame
let _buffer: HTMLCanvasElement | null = null;
let _bufferCtx: CanvasRenderingContext2D | null = null;

function ensureBuffer(w: number, h: number) {
  if (!_buffer) {
    _buffer = document.createElement('canvas');
  }
  if (_buffer.width !== w || _buffer.height !== h) {
    _buffer.width = w;
    _buffer.height = h;
  }
  if (!_bufferCtx) {
    _bufferCtx = _buffer.getContext('2d')!;
  }
  return { canvas: _buffer, ctx: _bufferCtx };
}

// Detect ctx.filter support once (Safari < 18 doesn't have it)
let _filterOk: boolean | null = null;
function canUseFilter(): boolean {
  if (_filterOk !== null) return _filterOk;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d')!;
    x.filter = 'grayscale(100%)';
    _filterOk = x.filter === 'grayscale(100%)';
  } catch {
    _filterOk = false;
  }
  return _filterOk;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  options: RendererOptions
) {
  const { mirrorMode, seamMode, seamWidth, splitLineX, filter } = options;
  const buf = ensureBuffer(width, height);

  // --- Step 1: draw selfie view into the buffer ---
  buf.ctx.save();
  if (filter !== 'none' && canUseFilter()) {
    buf.ctx.filter =
      filter === 'grayscale' ? 'grayscale(100%)' : 'contrast(1.5) saturate(1.2)';
  }
  // Flip horizontally for selfie / mirror view
  buf.ctx.translate(width, 0);
  buf.ctx.scale(-1, 1);
  buf.ctx.drawImage(video, 0, 0, width, height);
  buf.ctx.restore();

  // --- Step 2: draw base layer to visible canvas ---
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(buf.canvas, 0, 0);

  // --- Step 3: mirror one half ---
  const splitX = Math.round(splitLineX * width);

  if (mirrorMode === 'left-to-right') {
    // Clip to the RIGHT half, flip the buffer around splitX.
    // The transform maps (x) → (2·splitX − x), so only pixels with
    // source x ≤ splitX end up in the clip region — i.e. the LEFT half
    // of the selfie view gets mirrored onto the RIGHT half.
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, width - splitX, height);
    ctx.clip();
    ctx.translate(2 * splitX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(buf.canvas, 0, 0);
    ctx.restore();
  } else {
    // Clip to the LEFT half, flip around splitX.
    // Source pixels with x ≥ splitX (right half) end up in [0, splitX].
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, height);
    ctx.clip();
    ctx.translate(2 * splitX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(buf.canvas, 0, 0);
    ctx.restore();
  }

  // --- Step 4: soft seam (optional) ---
  if (seamMode === 'soft' && seamWidth > 0) {
    drawSoftSeam(ctx, buf.canvas, splitX, width, height, seamWidth);
  }

  // --- Step 5: overlays ---
  if (options.showCenterline) {
    drawCenterline(ctx, splitX, height);
  }
  if (options.showSkeleton && options.keypoints) {
    drawSkeleton(ctx, options.keypoints, width, height);
  }
}

/**
 * Soft seam: blend the original frame back in near the split line
 * using multiple thin strips at decreasing opacity.
 * No getImageData — just globalAlpha + drawImage slices.
 */
function drawSoftSeam(
  ctx: CanvasRenderingContext2D,
  original: HTMLCanvasElement,
  splitX: number,
  width: number,
  height: number,
  seamWidth: number
) {
  const halfSeam = Math.round(seamWidth / 2);
  const steps = Math.min(halfSeam, 20); // cap iterations for perf
  if (steps <= 0) return;

  ctx.save();
  for (let i = 0; i < steps; i++) {
    const t = i / steps; // 0 at center, approaches 1 at edge
    const alpha = (1 - t) * 0.6; // strongest at center, fades out
    const offset = Math.round(t * halfSeam);

    ctx.globalAlpha = alpha;

    // Draw thin strips from the original (unmirrored) frame at the split ± offset
    const lx = splitX - offset;
    const rx = splitX + offset;
    if (lx >= 0 && lx < width) {
      ctx.drawImage(original, lx, 0, 1, height, lx, 0, 1, height);
    }
    if (rx >= 0 && rx < width) {
      ctx.drawImage(original, rx, 0, 1, height, rx, 0, 1, height);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
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

  const drawPoint = (pt: { x: number; y: number } | null, color: string) => {
    if (!pt) return;
    // Keypoints are in normalized [0,1]; video is drawn mirrored so flip x
    const px = (1 - pt.x) * width;
    const py = pt.y * height;
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

  // Torso connections
  drawLine(kp.leftShoulder, kp.rightShoulder, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftHip, kp.rightHip, 'rgba(0, 255, 100, 0.7)');
  drawLine(kp.leftShoulder, kp.leftHip, 'rgba(0, 255, 100, 0.5)');
  drawLine(kp.rightShoulder, kp.rightHip, 'rgba(0, 255, 100, 0.5)');

  // Midline
  if (kp.leftShoulder && kp.rightShoulder && kp.leftHip && kp.rightHip) {
    const sMid = {
      x: (kp.leftShoulder.x + kp.rightShoulder.x) / 2,
      y: (kp.leftShoulder.y + kp.rightShoulder.y) / 2,
    };
    const hMid = {
      x: (kp.leftHip.x + kp.rightHip.x) / 2,
      y: (kp.leftHip.y + kp.rightHip.y) / 2,
    };
    drawLine(sMid, hMid, 'rgba(255, 200, 0, 0.8)');
  }

  drawPoint(kp.leftShoulder, '#00ff66');
  drawPoint(kp.rightShoulder, '#00ff66');
  drawPoint(kp.leftHip, '#00ccff');
  drawPoint(kp.rightHip, '#00ccff');

  ctx.restore();
}
