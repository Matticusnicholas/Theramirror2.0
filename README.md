# TheraMirror

Browser-based mirror therapy tool for phantom limb pain relief. Uses your webcam to create a real-time mirrored view of your body, with pose-tracking to keep the mirror aligned with your torso centerline.

**All processing happens locally in your browser. No video is uploaded or stored.**

## Features

- **Live mirroring** — mirrors one half of your body onto the other in real time
- **Pose-tracked centerline** — MediaPipe detects your shoulders and hips to compute a dynamic midline
- **Calibration controls** — manual offset, smoothing, seam softness, pose frequency
- **Soft/hard seam** — choose between a sharp or feathered blend at the mirror edge
- **Skeleton overlay** — visualize detected keypoints and torso midline
- **Session mode** — hides UI after 5 seconds for distraction-free therapy; tap to reveal
- **Fullscreen** — fill the screen for an immersive mirror experience
- **Camera selection** — choose between multiple cameras, toggle resolution
- **Filters** — optional grayscale or high-contrast modes
- **Privacy-first** — no server, no uploads, no tracking

## Running Locally

```bash
npm install
npm run dev
```

Open `https://localhost:5173` (camera access requires HTTPS or localhost).

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server.

## Deploying to GitHub Pages

1. Build the project: `npm run build`
2. Push the `dist/` folder to GitHub Pages, or use a GitHub Action:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

3. In repo Settings > Pages, set source to "GitHub Actions".

## Architecture

```
src/
├── hooks/
│   ├── useCamera.ts       # getUserMedia, device enumeration, resolution
│   ├── usePose.ts         # MediaPipe PoseLandmarker integration
│   └── useFullscreen.ts   # Fullscreen API wrapper
├── lib/
│   ├── renderer.ts        # Canvas compositing & mirroring pipeline
│   ├── poseUtils.ts       # Keypoint extraction, midline computation
│   └── smoothing.ts       # Exponential moving average filter
├── components/
│   ├── CameraView.tsx     # Video + canvas display, animation loop
│   ├── Controls.tsx       # Main control panel
│   ├── CalibrationPanel.tsx # Calibration sliders modal
│   ├── FirstRunGuide.tsx  # 3-step onboarding
│   ├── SafetyModal.tsx    # Disclaimer & privacy info
│   └── PermissionPrompt.tsx # Camera permission error handling
├── types.ts               # Shared TypeScript types
├── App.tsx                # Root component, state management
├── App.css                # Application styles
├── index.css              # Global reset & base styles
└── main.tsx               # Entry point
```

### Mirroring Pipeline

Each frame:
1. Draw the camera feed (horizontally flipped for selfie view) onto a canvas
2. Compute the split line from pose-detected shoulder/hip midpoints (smoothed with EMA)
3. Add any manual offset from calibration
4. Extract the source half as image data
5. Draw it mirrored onto the opposite half
6. Optionally apply a soft seam (alpha gradient blend near the split)
7. Draw overlays (centerline guide, skeleton keypoints)

### Pose Detection

Uses MediaPipe PoseLandmarker (lite model, GPU-delegated) running in VIDEO mode. Tracks:
- Left/right shoulders (landmarks 11, 12)
- Left/right hips (landmarks 23, 24)

The midline is the average X position of the shoulder midpoint and hip midpoint. An EMA filter smooths frame-to-frame jitter. The inference frequency is configurable (every 1-10 frames) to trade accuracy for performance.

## Known Limitations & Troubleshooting

### Camera Permissions
- Camera requires HTTPS or localhost. GitHub Pages provides HTTPS.
- If permission is denied, click the lock/camera icon in the address bar to re-enable.

### iOS Safari
- `playsInline` attribute is required for video to play without going fullscreen (handled).
- iOS may prompt for camera permission each session.
- The Fullscreen API has limited support on iOS Safari — the fullscreen button may not work.
- `OffscreenCanvas` may not be available on older iOS versions. If mirroring doesn't work, try updating iOS.

### Android Chrome
- Should work on Android 8+.
- On low-end devices, set Resolution to "Performance" and increase Pose Frequency (e.g., every 5 frames).

### Desktop Chrome/Firefox/Edge
- Fully supported. GPU-accelerated pose detection for best performance.

### Pose Not Detected
- Ensure your shoulders and hips are visible in the frame.
- Stand/sit far enough back that your upper body is fully in view.
- Good lighting improves detection accuracy.

### Performance
- If the frame rate is low, reduce resolution to "Performance" and increase pose frequency.
- Close other tabs using the GPU.
- The soft seam mode uses `getImageData`/`putImageData` which can be slow on large canvases.

## Testing Checklist

### Desktop Chrome
- [ ] Camera starts and shows mirrored selfie view
- [ ] Mirror mode switches between left-to-right and right-to-left
- [ ] Pose detection loads and tracks the midline
- [ ] Centerline guide overlay shows the split position
- [ ] Skeleton overlay shows shoulder/hip keypoints
- [ ] Calibration offset slider moves the split line
- [ ] Soft seam blends the mirror edge
- [ ] Fullscreen toggle works
- [ ] Session mode hides controls after 5s, tap reveals them
- [ ] First-run guide shows on first visit, not after dismissal
- [ ] About & Safety modal displays correctly

### Android Chrome
- [ ] Camera permission prompt appears
- [ ] Camera renders at correct orientation
- [ ] Touch controls are large enough (44px+ tap targets)
- [ ] Scrollable controls panel on small screens
- [ ] Performance mode keeps frame rate acceptable

### iOS Safari
- [ ] Camera permission prompt appears
- [ ] Video plays inline (doesn't go fullscreen automatically)
- [ ] Mirror rendering works
- [ ] Controls are usable with touch

## Safety Disclaimer

TheraMirror is **not a medical device** and does not provide medical advice. It is a tool intended to assist with mirror therapy exercises. Always consult a healthcare professional before starting mirror therapy. Stop immediately if you experience increased pain or discomfort.
