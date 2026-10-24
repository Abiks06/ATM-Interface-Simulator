import { Fragment } from 'react';
import { S } from '../core/machine.js';
import { SLOTS } from '../core/screens.js';

const KEYS = [
  ['1', '2', '3', 'cancel'],
  ['4', '5', '6', 'clear'],
  ['7', '8', '9', 'enter'],
  [null, '0', null, null],
];
const KEY_LABEL = { cancel: 'Cancel', clear: 'Clear', enter: 'Enter' };

// The screen mirror is a grid: each option row shares a row with its side key, so the button,
// its number shortcut and the lit key always line up.
function Mirror({ model, onSlot }) {
  const slot = (id) => model.options.find((o) => o.slot === id);
  const sideKey = (id, row) => {
    const o = slot(id);
    return (
      <button
        className={o ? 'fdk on' : 'fdk'}
        style={{ gridRow: row, gridColumn: id[0] === 'L' ? 1 : 3 }}
        onClick={() => onSlot(id)}
        aria-label={o ? `Side key: ${o.label}` : 'Side key (unused)'}
        tabIndex={o ? 0 : -1}
      />
    );
  };
  const option = (id) => {
    const o = slot(id);
    if (!o) return <span />;
    const num = <kbd className="opt-num">{SLOTS.indexOf(id) + 1}</kbd>;
    return (
      <button className={id[0] === 'L' ? 'opt left' : 'opt right'} onClick={() => onSlot(id)}>
        {id[0] === 'L' ? (
          <>
            {num}
            <span>{o.label}</span>
          </>
        ) : (
          <>
            <span>{o.label}</span>
            {num}
          </>
        )}
      </button>
    );
  };

  return (
    <div className={`mirror tone-${model.tone}`}>
      <div className="lcd-bg" aria-hidden="true" />
      <div className="lcd-head" aria-live="polite">
        <div className="lcd-title">{model.title}</div>
        {model.lines.map((l, i) => (
          <div key={i} className={i === 0 && model.entry ? 'lcd-entry' : 'lcd-line'}>
            {l || ' '}
          </div>
        ))}
        {model.tone === 'busy' && <div className="lcd-busy" aria-hidden="true" />}
      </div>
      {['2', '3', '4'].map((row, i) => (
        <Fragment key={row}>
          {sideKey('L' + row, i + 2)}
          <div className="opt-row" style={{ gridRow: i + 2 }}>
            {option('L' + row)}
            {option('R' + row)}
          </div>
          {sideKey('R' + row, i + 2)}
        </Fragment>
      ))}
      <div className="lcd-foot">{model.footer || ' '}</div>
    </div>
  );
}

function HardwareActions({ atm }) {
  const { screen, receiptPending } = atm.state;
  const actions = [];
  if (screen === S.IDLE) {
    actions.push(['Insert card', () => atm.insertCard('chip'), 'primary']);
    actions.push(['Tap card', () => atm.insertCard('nfc')]);
  }
  if (screen === S.RETURN_CARD || screen === S.TAKE_CARD) actions.push(['Take card', atm.takeCard, 'primary']);
  if (screen === S.TAKE_CASH) actions.push(['Take cash', atm.takeCash, 'primary']);
  if (receiptPending) actions.push(['Take receipt', atm.takeReceipt]);
  if (!actions.length) return null;
  return (
    <div className="hw-actions">
      {actions.map(([label, fn, kind]) => (
        <button key={label} className={`btn ${kind || 'ghost'}`} onClick={fn}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Operator({ atm }) {
  if (!atm.ready) return <p className="muted">Generating keys and starting the bank host…</p>;
  return (
    <div className="operator">
      <Mirror model={atm.model} onSlot={atm.pressSlot} />
      {atm.model.options.length > 0 && (
        <p className="mirror-hint">
          Tap an option, press its lit side key, or type its number.
        </p>
      )}
      <HardwareActions atm={atm} />
      <div className="keypad" role="group" aria-label="PIN pad">
        {KEYS.flat().map((k, i) =>
          k ? (
            <button key={i} className={`key key-${k}`} onClick={() => atm.pressKey(k)}>
              {KEY_LABEL[k] || k}
            </button>
          ) : (
            <span key={i} className="key blank" aria-hidden="true" />
          ),
        )}
      </div>
      <dl className="facts">
        <div>
          <dt>Session</dt>
          <dd>{atm.state.screen.replace(/_/g, ' ').toLowerCase()}</dd>
        </div>
        <div>
          <dt>Cassettes</dt>
          <dd>
            {Object.entries(atm.cassettes)
              .sort((a, b) => b[0] - a[0])
              .map(([d, n]) => `$${d}×${n}`)
              .join('  ')}
          </dd>
        </div>
        <div>
          <dt>Keyboard</dt>
          <dd>
            Digits · <kbd>Enter</kbd> · <kbd>Backspace</kbd> clear · <kbd>Esc</kbd> cancel
          </dd>
        </div>
      </dl>
    </div>
  );
}
