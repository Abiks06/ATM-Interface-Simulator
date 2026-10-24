import { describe, expect, it } from 'vitest';
import { initialState, S, step } from './machine.js';

// Runs a list of events through the machine and returns the final state plus all effects.
function run(events, state = initialState()) {
  const effects = [];
  for (const e of events) {
    const r = step(state, e);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}

const timerFor = (state) => ({ type: 'TIMER', seq: state.seq });
const key = (k) => ({ type: 'KEY', key: k });
const option = (id) => ({ type: 'OPTION', id });
const pin = (n = 4) => Array.from({ length: n }, () => key('7'));

function toMenu(method = 'chip') {
  let { state } = run([{ type: 'CARD_INSERT', method }]);
  ({ state } = run([timerFor(state), { type: 'CARD_STATUS', status: 'active' }, option('en'), ...pin(), key('enter')], state));
  ({ state } = run([{ type: 'PIN_RESULT', ok: true, remaining: 3 }, option('CHECKING')], state));
  return state;
}

describe('card entry', () => {
  it('reads the card, then asks for a language', () => {
    let { state, effects } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    expect(state.screen).toBe(S.READING);
    expect(effects).toContainEqual({ type: 'hw', cmd: 'insertCard' });
    ({ state, effects } = run([timerFor(state)], state));
    expect(effects).toContainEqual({ type: 'checkCard' });
    ({ state } = run([{ type: 'CARD_STATUS', status: 'active' }], state));
    expect(state.screen).toBe(S.LANGUAGE);
  });

  it('refuses cards while a skimmer is detected', () => {
    const { state } = run([{ type: 'SET_TAMPER', on: true }, { type: 'CARD_INSERT', method: 'chip' }]);
    expect(state.screen).toBe(S.OUT_OF_SERVICE);
  });

  it('comes back into service once the reader is clear', () => {
    const { state } = run([{ type: 'SET_TAMPER', on: true }, { type: 'SET_TAMPER', on: false }]);
    expect(state.screen).toBe(S.IDLE);
  });

  it('ejects a blocked card after the notice', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    ({ state } = run([timerFor(state), { type: 'CARD_STATUS', status: 'blocked' }], state));
    expect(state.screen).toBe(S.CARD_BLOCKED);
    ({ state } = run([timerFor(state)], state));
    expect(state.screen).toBe(S.EJECT);
  });
});

describe('PIN entry', () => {
  it('never puts PIN digits in state, only their count', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    let effects;
    ({ state, effects } = run([timerFor(state), { type: 'CARD_STATUS', status: 'active' }, option('en'), key('4'), key('8')], state));
    expect(state.pinLength).toBe(2);
    expect(JSON.stringify(state)).not.toMatch(/48/);
    expect(effects).toContainEqual({ type: 'pinpad', op: 'press', digit: '4' });
  });

  it('only submits a complete PIN', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    ({ state } = run([timerFor(state), { type: 'CARD_STATUS', status: 'active' }, option('en'), ...pin(3), key('enter')], state));
    expect(state.screen).toBe(S.PIN);
    const r = step(state, key('7'));
    const r2 = step(r.state, key('enter'));
    expect(r2.state.screen).toBe(S.VERIFYING);
    expect(r2.effects).toContainEqual({ type: 'verifyPin' });
  });

  it('retains the card when the host reports the PIN tries are used up', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    ({ state } = run([timerFor(state), { type: 'CARD_STATUS', status: 'active' }, option('en'), ...pin(), key('enter')], state));
    const r = step(state, { type: 'PIN_RESULT', ok: false, blocked: true, remaining: 0 });
    expect(r.state.screen).toBe(S.RETAINED);
    expect(r.effects).toContainEqual({ type: 'hw', cmd: 'retainCard' });
  });

  it('shows remaining tries after a wrong PIN', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    ({ state } = run([timerFor(state), { type: 'CARD_STATUS', status: 'active' }, option('en'), ...pin(), key('enter')], state));
    ({ state } = run([{ type: 'PIN_RESULT', ok: false, blocked: false, remaining: 2 }], state));
    expect(state.screen).toBe(S.PIN_ERROR);
    expect(state.remaining).toBe(2);
    ({ state } = run([key('enter')], state));
    expect(state.screen).toBe(S.PIN);
    expect(state.pinLength).toBe(0);
  });
});

describe('withdrawal', () => {
  it('returns the card before the cash on chip sessions', () => {
    let state = toMenu();
    ({ state } = run([option('withdraw'), option('a100'), option('receipt')], state));
    expect(state.screen).toBe(S.AUTHORIZING);
    expect(state.receipt).toBe(true);
    let effects;
    ({ state, effects } = run([{ type: 'AUTH_RESULT', approved: true }], state));
    expect(state.screen).toBe(S.RETURN_CARD);
    expect(effects).toContainEqual({ type: 'hw', cmd: 'ejectCard' });
    ({ state } = run([{ type: 'CARD_TAKEN' }, timerFor(state)], state));
    expect(state.screen).toBe(S.DISPENSING);
    ({ state } = run([timerFor(state)], state));
    expect(state.screen).toBe(S.TAKE_CASH);
    ({ state, effects } = run([{ type: 'CASH_TAKEN' }], state));
    expect(effects).toContainEqual({ type: 'complete' });
    expect(state.screen).toBe(S.PRINTING);
    expect(state.receiptPending).toBe(true);
  });

  it('reverses the hold if the cash is not taken', () => {
    let state = toMenu('nfc');
    ({ state } = run([option('fast'), key('enter'), { type: 'AUTH_RESULT', approved: true }], state));
    expect(state.screen).toBe(S.DISPENSING);
    ({ state } = run([timerFor(state)], state));
    const r = step(state, timerFor(state));
    expect(r.state.screen).toBe(S.CASH_RETRACTED);
    expect(r.effects).toContainEqual({ type: 'reverse' });
  });

  it('validates custom amounts', () => {
    let state = toMenu();
    ({ state } = run([option('withdraw'), option('other'), key('1'), key('5'), key('enter')], state));
    expect(state.screen).toBe(S.OTHER);
    expect(state.error).toBe('amountRules');
    ({ state } = run([key('2'), key('5'), key('0'), key('enter')], state));
    expect(state.screen).toBe(S.CONFIRM);
    expect(state.amountCents).toBe(25_000);
  });

  it('caps custom amounts at $1,000', () => {
    let state = toMenu();
    ({ state } = run([option('withdraw'), option('other'), key('2'), key('0'), key('0'), key('0'), key('enter')], state));
    expect(state.screen).toBe(S.OTHER);
  });

  it('shows the decline reason and returns to the menu', () => {
    let state = toMenu();
    ({ state } = run([option('fast'), key('enter'), { type: 'AUTH_RESULT', approved: false, reason: 'DAILY_LIMIT' }], state));
    expect(state.screen).toBe(S.DECLINED);
    expect(state.reason).toBe('DAILY_LIMIT');
    ({ state } = run([timerFor(state)], state));
    expect(state.screen).toBe(S.MENU);
  });
});

describe('timers', () => {
  it('drops a timer scheduled for an earlier screen', () => {
    let { state } = run([{ type: 'CARD_INSERT', method: 'chip' }]);
    const stale = timerFor(state);
    ({ state } = run([stale, { type: 'CARD_STATUS', status: 'active' }], state));
    expect(state.screen).toBe(S.LANGUAGE);
    ({ state } = run([stale], state));
    expect(state.screen).toBe(S.LANGUAGE);
  });

  it('warns on inactivity and resumes the same screen', () => {
    let state = toMenu();
    ({ state } = run([{ type: 'INACTIVITY' }], state));
    expect(state.screen).toBe(S.TIMEOUT_WARNING);
    ({ state } = run([option('yes')], state));
    expect(state.screen).toBe(S.MENU);
  });

  it('ends the session if the timeout prompt is ignored', () => {
    let state = toMenu();
    ({ state } = run([{ type: 'INACTIVITY' }], state));
    ({ state } = run([timerFor(state)], state));
    expect(state.screen).toBe(S.EJECT);
  });

  it('retains a card left in the slot', () => {
    let state = toMenu();
    ({ state } = run([option('exit')], state));
    ({ state } = run([timerFor(state)], state));
    expect(state.screen).toBe(S.TAKE_CARD);
    const r = step(state, timerFor(state));
    expect(r.state.screen).toBe(S.CARD_FORGOTTEN);
  });
});

describe('PIN change', () => {
  it('rejects weak PINs and mismatched confirmations', () => {
    let state = toMenu();
    ({ state } = run([option('changePin'), ...pin(), key('enter')], state));
    expect(state.busy).toBe(true);
    ({ state } = run([{ type: 'NEW_PIN_CHECKED', weak: true }], state));
    expect(state.error).toBe('weakPin');
    ({ state } = run([...pin(), key('enter'), { type: 'NEW_PIN_CHECKED', weak: false }], state));
    expect(state.screen).toBe(S.CONFIRM_PIN);
    ({ state } = run([...pin(), key('enter'), { type: 'PIN_CHANGE_RESULT', ok: false, reason: 'MISMATCH' }], state));
    expect(state.screen).toBe(S.NEW_PIN);
    expect(state.error).toBe('pinMismatch');
  });
});
