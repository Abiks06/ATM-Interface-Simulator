import { useState } from 'react';

export default function Journal({ atm }) {
  const [result, setResult] = useState(null);
  const entries = [...atm.journal].reverse();

  const verify = async () => setResult(await atm.verifyJournal());
  const tamper = async () => {
    await atm.tamperJournal();
    setResult(null);
  };

  return (
    <div className="journal">
      <div className="panel-head">
        <div>
          <h2>Electronic journal</h2>
          <p className="muted">Append-only, each entry chained to the previous one by SHA-256.</p>
        </div>
      </div>
      <div className="journal-actions">
        <button className="btn primary small" onClick={verify}>
          Verify chain
        </button>
        <button className="btn ghost small" onClick={tamper} disabled={atm.journal.length < 2}>
          Edit an entry (insider)
        </button>
      </div>
      {result && (
        <p className={result.ok ? 'verdict ok' : 'verdict bad'} role="status">
          {result.ok ? `All ${atm.journal.length} links verified.` : `Chain broken at entry #${result.brokenAt}: the edit is evident.`}
        </p>
      )}
      <ol className="entries">
        {entries.map((e) => (
          <li key={e.seq} className={result && !result.ok && e.seq >= result.brokenAt ? 'entry broken' : 'entry'}>
            <div className="entry-head">
              <span className="seq">#{e.seq}</span>
              <strong>{e.kind.replace(/_/g, ' ')}</strong>
              <time>{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
            </div>
            {e.detail && <div className="entry-detail">{e.detail}</div>}
            <code className="hash" title={e.hash}>
              {e.hash.slice(0, 20)}… ← {e.prev.slice(0, 8)}
            </code>
          </li>
        ))}
      </ol>
    </div>
  );
}
