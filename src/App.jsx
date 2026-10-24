import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAPTERS } from './app/chapters.js';
import { useAtm } from './app/useAtm.js';
import { useLatest } from './app/useLatest.js';
import AttackLab from './components/AttackLab.jsx';
import Inspector from './components/Inspector.jsx';
import Journal from './components/Journal.jsx';
import Operator from './components/Operator.jsx';
import Stage from './components/Stage.jsx';
import TopBar from './components/TopBar.jsx';
import Tour, { ChapterList } from './components/Tour.jsx';
import { createBridge } from './scene/bridge.js';
import { createRig } from './scene/rig.js';

const KEYMAP = { Enter: 'enter', Backspace: 'clear', Delete: 'clear', Escape: 'cancel' };
const FKEYS = { F1: 'L2', F2: 'L3', F3: 'L4', F5: 'R2', F6: 'R3', F7: 'R4' };

export default function App() {
  const iframeRef = useRef(null);
  const [scene, setScene] = useState({ status: 'loading', bridge: null, rig: null });
  const [mode, setMode] = useState('tour');
  const [chapter, setChapter] = useState(0);
  const [autoCamera, setAutoCamera] = useState(true);
  const [panel, setPanel] = useState('atm');

  useEffect(() => {
    const bridge = createBridge(iframeRef.current);
    const rig = createRig(bridge);
    let done = false;
    const failTimer = setTimeout(() => !done && setScene((s) => ({ ...s, status: 'error' })), 30000);
    rig
      .init()
      .then(() => {
        done = true;
        setScene({ status: 'ready', bridge, rig });
      })
      .catch(() => setScene((s) => ({ ...s, status: 'error' })));
    setScene({ status: 'loading', bridge, rig });
    return () => {
      clearTimeout(failTimer);
      bridge.destroy();
    };
  }, []);

  const ready = scene.status === 'ready';
  const atm = useAtm({
    rig: ready ? scene.rig : null,
    active: mode !== 'tour',
    autoCamera,
    homeShot: mode === 'attack' ? 'attack' : 'operate',
  });

  const handleKey = useCallback(
    (key) => {
      if (mode === 'tour') {
        if (key === 'ArrowRight') setChapter((c) => Math.min(c + 1, CHAPTERS.length - 1));
        if (key === 'ArrowLeft') setChapter((c) => Math.max(c - 1, 0));
        return;
      }
      if (/^\d$/.test(key)) atm.pressKey(key);
      else if (KEYMAP[key]) atm.pressKey(KEYMAP[key]);
      else if (FKEYS[key]) atm.pressSlot(FKEYS[key]);
    },
    [mode, atm],
  );

  // Keyboard input from the page, and from the scene when the iframe has focus.
  const keyRef = useLatest(handleKey);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key in FKEYS || e.key === 'Backspace') e.preventDefault();
      keyRef.current(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyRef]);

  // Clicking the 3D scene moves keyboard focus into the iframe, where key presses can't reach
  // the app. Hand focus back once the click has finished (doing it mid-click makes Spline drop
  // the click) so typing on the keyboard keeps working.
  useEffect(() => {
    if (mode === 'tour') return;
    const onBlur = () =>
      setTimeout(() => {
        if (document.activeElement === iframeRef.current) {
          iframeRef.current.blur();
          window.focus();
        }
      }, 400);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [mode]);

  const clickRef = useLatest((name) => mode !== 'tour' && atm.handleSceneClick(name));
  useEffect(() => {
    if (!scene.bridge) return;
    const offEvent = scene.bridge.on('event', (m) => m.event === 'mouseDown' && clickRef.current(m.target?.name));
    const offKey = scene.bridge.on('key', (k) => keyRef.current(k));
    return () => {
      offEvent();
      offKey();
    };
  }, [scene.bridge, clickRef, keyRef]);

  const switchMode = (next) => {
    setMode(next);
    setPanel(next === 'attack' ? 'attack' : 'atm');
  };

  return (
    <div className="app">
      <TopBar mode={mode} onMode={switchMode} />
      <main className="layout">
        <Stage iframeRef={iframeRef} status={scene.status} mode={mode} autoCamera={autoCamera} onAutoCamera={setAutoCamera}>
          {mode === 'tour' && (
            <Tour
              index={chapter}
              onIndex={setChapter}
              rig={ready ? scene.rig : null}
              onFinish={(target) => switchMode(target)}
            />
          )}
        </Stage>

        <aside className="sidebar" aria-label="Control panel">
          {mode === 'tour' ? (
            <ChapterList index={chapter} onIndex={setChapter} onSkip={() => switchMode('use')} />
          ) : (
            <>
              <div className="tabs" role="tablist">
                {(mode === 'attack' ? ['attack', 'atm', 'security', 'journal'] : ['atm', 'security', 'journal']).map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={panel === id}
                    className={panel === id ? 'tab active' : 'tab'}
                    onClick={() => setPanel(id)}
                  >
                    {{ atm: 'ATM', attack: 'Attack lab', security: 'Security', journal: 'Journal' }[id]}
                    {id === 'security' && atm.trace.length > 0 && <span className="badge">{atm.trace.length}</span>}
                  </button>
                ))}
              </div>
              <div className="panel-body">
                {panel === 'atm' && <Operator atm={atm} />}
                {panel === 'attack' && <AttackLab atm={atm} />}
                {panel === 'security' && <Inspector trace={atm.trace} onClear={atm.clearTrace} />}
                {panel === 'journal' && <Journal atm={atm} />}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
