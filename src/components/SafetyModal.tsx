interface SafetyModalProps {
  onClose: () => void;
}

export function SafetyModal({ onClose }: SafetyModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content safety-modal" onClick={(e) => e.stopPropagation()}>
        <h2>About TheraMirror</h2>

        <section>
          <h3>What is Mirror Therapy?</h3>
          <p>
            Mirror therapy is a rehabilitation technique where a mirror (or in
            this case, a digital mirror) creates a visual illusion of the
            missing limb moving. This can help reduce phantom limb pain by
            providing visual feedback to the brain.
          </p>
        </section>

        <section className="safety-warning">
          <h3>Important Safety Information</h3>
          <ul>
            <li>
              <strong>This is not medical advice.</strong> TheraMirror is a tool,
              not a medical device. Consult your healthcare provider before
              starting any therapy.
            </li>
            <li>
              <strong>Stop if pain increases.</strong> If you experience
              increased pain, discomfort, dizziness, or any adverse effects,
              stop using the app immediately and consult your healthcare
              provider.
            </li>
            <li>
              <strong>Use under guidance.</strong> Mirror therapy is most
              effective when used as part of a structured rehabilitation
              program guided by a healthcare professional.
            </li>
          </ul>
        </section>

        <section>
          <h3>Privacy</h3>
          <p>
            <strong>All processing happens locally in your browser.</strong> Your
            webcam feed is never recorded, uploaded, or sent to any server. No
            data leaves your device. The app works entirely offline after the
            initial page load.
          </p>
        </section>

        <section>
          <h3>Technical Details</h3>
          <p>
            TheraMirror uses MediaPipe Pose Landmarker for body tracking and
            HTML5 Canvas for real-time video compositing. The pose detection
            model is loaded from Google's CDN on first use.
          </p>
        </section>

        <button className="btn btn-primary btn-lg" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
