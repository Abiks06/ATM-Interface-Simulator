const TONE_LABEL = { secure: 'Crypto', ok: 'Pass', warn: 'Alert', info: 'Info' };

export default function Inspector({ trace, onClear }) {
  return (
    <div className="inspector">
      <div className="panel-head">
        <div>
          <h2>Security inspector</h2>
          <p className="muted">What each step encrypts, signs and checks, newest first.</p>
        </div>
        {trace.length > 0 && (
          <button className="btn ghost small" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {trace.length === 0 ? (
        <p className="empty">Insert the card and enter the PIN to watch the PIN block and cryptograms appear here.</p>
      ) : (
        <ol className="trace">
          {trace.map((t) => (
            <li key={t.id} className={`trace-item tone-${t.tone}`}>
              <div className="trace-head">
                <span className="pill">{TONE_LABEL[t.tone] || t.tone}</span>
                <strong>{t.title}</strong>
                <time>{t.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              </div>
              {t.body && <p>{t.body}</p>}
              {t.code && <pre>{t.code}</pre>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
