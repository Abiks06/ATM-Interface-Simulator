import { SCENE_URL } from '../scene/bridge.js';

export default function Stage({ iframeRef, status, mode, autoCamera, onAutoCamera, children }) {
  return (
    <section className="stage" aria-label="3D ATM">
      <iframe
        ref={iframeRef}
        className="scene"
        src={SCENE_URL}
        title="Interactive 3D ATM built in Spline"
        allow="autoplay; fullscreen"
      />
      {status !== 'ready' && (
        <div className="stage-veil" role="status">
          {status === 'error' ? (
            <>
              <strong>The 3D scene didn’t load</strong>
              <span>The simulator still works from the side panel. Check your connection and reload to try again.</span>
            </>
          ) : (
            <>
              <span className="spinner" aria-hidden="true" />
              <span>Loading the 3D ATM…</span>
            </>
          )}
        </div>
      )}
      {mode !== 'tour' && status === 'ready' && (
        <div className="stage-tools">
          <label className="toggle">
            <input type="checkbox" checked={autoCamera} onChange={(e) => onAutoCamera(e.target.checked)} />
            <span>Follow the action</span>
          </label>
          <span className="stage-hint">Click the card, keys and side buttons in 3D</span>
        </div>
      )}
      {children}
    </section>
  );
}
