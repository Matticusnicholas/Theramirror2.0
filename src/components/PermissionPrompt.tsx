import type { CameraPermission } from '../hooks/useCamera';

interface PermissionPromptProps {
  permission: CameraPermission;
  onRetry: () => void;
}

export function PermissionPrompt({ permission, onRetry }: PermissionPromptProps) {
  if (permission === 'granted' || permission === 'prompt') return null;

  return (
    <div className="permission-prompt">
      {permission === 'denied' && (
        <>
          <h3>Camera Access Denied</h3>
          <p>
            TheraMirror needs camera access to work. Please allow camera
            permissions in your browser settings and try again.
          </p>
          <div className="permission-help">
            <p><strong>How to enable:</strong></p>
            <ul>
              <li>Chrome: Click the lock icon in the address bar &rarr; Camera &rarr; Allow</li>
              <li>Safari: Settings &rarr; Safari &rarr; Camera &rarr; Allow</li>
              <li>Firefox: Click the lock icon &rarr; Permissions &rarr; Camera &rarr; Allow</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={onRetry}>
            Try Again
          </button>
        </>
      )}
      {permission === 'error' && (
        <>
          <h3>Camera Error</h3>
          <p>
            Unable to access the camera. This may be because:
          </p>
          <ul>
            <li>No camera is connected to this device</li>
            <li>Another app is using the camera</li>
            <li>Your browser doesn't support camera access</li>
          </ul>
          <button className="btn btn-primary" onClick={onRetry}>
            Try Again
          </button>
        </>
      )}
    </div>
  );
}
