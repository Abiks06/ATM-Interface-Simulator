import { S } from '../core/machine.js';

const KEYS = [
  ['1', '2', '3', 'cancel'],
  ['4', '5', '6', 'clear'],
  ['7', '8', '9', 'enter'],
  [null, '0', null, null],
];
const KEY_LABEL = { cancel: 'Cancel', clear: 'Clear', enter: 'Enter' };

function Mirror({ model, onSlot }) {
  const slot = (id) => model.options.find((o) => o.slot === id);
  const side = (prefix) =>
    ['2', '3', '4'].map((row) => {
      const o = slot(prefix + row);
      return (
        <button
          key={row}
          className={o ? 'fdk' : 'fdk idle'}
          onClick={() => onSlot(prefix + row)}
          aria-label={o ? o.label : `Side key ${prefix}${row}`}
          tabIndex={o ? 0 : -1}
        />
      );
    });

  return (
    <div className="mirror">
      <div className="fdk-col">{side('L')}</div>
      <div className={`lcd tone-${model.tone}`} aria-live="polite">
        <div className="lcd-title">{model.title}</div>
        <div className="lcd-lines">
          {model.lines.map((l, i) => (
            <div key={i} className={i === 0 && model.entry ? 'lcd-entry' : 'lcd-line'}>
              {l || ' '}
            </div>
          ))}
          {model.tone === 'busy' && <div className="lcd-busy" aria-hidden="true" />}
        </div>
        <div className="lcd-options">
          {['2', '3', '4'].map((row) => (
            <div className="lcd-row" key={row}>
              <span>{slot('L' + row)?.label ? `‹ ${slot('L' + row).label}` : ''}</span>
              <span>{slot('R' + row)?.label ? `${slot('R' + row).label} ›` : ''}</span>
            </div>
          ))}
        </div>
        {model.footer && <div className="lcd-footer">{model.footer}</div>}
      </div>
      <div className="fdk-col">{side('R')}</div>
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
