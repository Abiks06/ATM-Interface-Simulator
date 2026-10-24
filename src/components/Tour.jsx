import { useEffect } from 'react';
import { CHAPTERS } from '../app/chapters.js';

export default function Tour({ index, onIndex, rig, onFinish }) {
  const ch = CHAPTERS[index];

  // Play the chapter in 3D: frame the camera, set the screen, run the demo.
  useEffect(() => {
    if (!rig) return;
    let live = true;
    rig.reset();
    rig.hideCard();
    rig.renderScreen(ch.screen);
    // On wide stages the chapter card covers the left; slide the subject to the right of it.
    const wide = window.matchMedia('(min-width: 1100px)').matches;
    rig.look(ch.shot, 1500, { shift: wide ? 0.2 : 0 });
    const t = setTimeout(() => live && ch.run?.(rig, () => live), 900);
    return () => {
      live = false;
      clearTimeout(t);
      ch.leave?.(rig);
    };
  }, [rig, ch]);

  return (
    <div className="chapter-card" key={ch.id}>
      <div className="chapter-meta">
        <span className="kicker">{ch.kicker}</span>
        <span className="count">
          {index + 1} / {CHAPTERS.length}
        </span>
      </div>
      <h1>{ch.title}</h1>
      <p>{ch.body}</p>
      <ul className="points">
        {ch.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="chapter-nav">
        <button className="btn ghost" onClick={() => onIndex(index - 1)} disabled={index === 0}>
          Back
        </button>
        <div className="dots" aria-hidden="true">
          {CHAPTERS.map((c, i) => (
            <span key={c.id} className={i === index ? 'dot on' : i < index ? 'dot seen' : 'dot'} />
          ))}
        </div>
        {ch.cta ? (
          <div className="cta">
            <button className="btn ghost" onClick={() => onFinish('attack')}>
              Attack lab
            </button>
            <button className="btn primary" onClick={() => onFinish('use')}>
              Use the ATM
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => onIndex(index + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export function ChapterList({ index, onIndex, onSkip }) {
  return (
    <div className="chapter-list">
      <h2>Walkthrough</h2>
      <p className="muted">Each stop frames one layer of defence on the machine. Use the arrow keys to move between them.</p>
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button className={i === index ? 'chapter-link active' : 'chapter-link'} onClick={() => onIndex(i)}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="kicker">{c.kicker}</span>
                <span className="link-title">{c.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button className="btn primary block" onClick={onSkip}>
        Skip to the simulator
      </button>
    </div>
  );
}
