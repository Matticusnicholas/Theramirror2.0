interface FirstRunGuideProps {
  onClose: () => void;
}

export function FirstRunGuide({ onClose }: FirstRunGuideProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content guide-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome to TheraMirror</h2>
        <p className="guide-subtitle">
          A mirror therapy tool for phantom limb pain relief.
        </p>

        <div className="guide-steps">
          <div className="guide-step">
            <div className="guide-step-number">1</div>
            <div>
              <h3>Position yourself</h3>
              <p>
                Sit or stand centered in front of the camera so your torso is
                visible. The app will detect your body midline automatically.
              </p>
            </div>
          </div>

          <div className="guide-step">
            <div className="guide-step-number">2</div>
            <div>
              <h3>Choose the mirror direction</h3>
              <p>
                Select which side to mirror. If your left limb is missing,
                choose <strong>Right &rarr; Left</strong> to mirror your right
                side onto the left.
              </p>
            </div>
          </div>

          <div className="guide-step">
            <div className="guide-step-number">3</div>
            <div>
              <h3>Calibrate the centerline</h3>
              <p>
                Use the Calibration panel to fine-tune the split line. Enable
                the centerline guide overlay to see where the split occurs.
                Adjust until the mirrored limb looks aligned.
              </p>
            </div>
          </div>
        </div>

        <div className="guide-tip">
          <strong>Tip:</strong> Use "Session Mode" to hide the controls during
          therapy. Tap anywhere to bring them back.
        </div>

        <button className="btn btn-primary btn-lg" onClick={onClose}>
          Get Started
        </button>
      </div>
    </div>
  );
}
