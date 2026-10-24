// The ATM session as a pure state machine: step(state, event) -> { state, effects }.
// No timers, crypto or 3D calls happen here; they are returned as effect descriptions and
// run by the controller, which feeds results back in as events. That keeps every
// transition deterministic and unit-testable.
//
// Every screen change bumps `seq`. Timer events carry the seq they were scheduled for and
// are dropped if the session has moved on, so a late timeout can never yank the user to an
// unrelated screen.

export const S = Object.freeze({
  IDLE: 'IDLE',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
  READING: 'READING',
  CARD_BLOCKED: 'CARD_BLOCKED',
  LANGUAGE: 'LANGUAGE',
  PIN: 'PIN',
  VERIFYING: 'VERIFYING',
  PIN_ERROR: 'PIN_ERROR',
  RETAINED: 'RETAINED',
  ACCOUNT: 'ACCOUNT',
  MENU: 'MENU',
  BALANCE: 'BALANCE',
  STATEMENT: 'STATEMENT',
  AMOUNT: 'AMOUNT',
  OTHER: 'OTHER',
  CONFIRM: 'CONFIRM',
  AUTHORIZING: 'AUTHORIZING',
  DECLINED: 'DECLINED',
  RETURN_CARD: 'RETURN_CARD',
  DISPENSING: 'DISPENSING',
  TAKE_CASH: 'TAKE_CASH',
  CASH_RETRACTED: 'CASH_RETRACTED',
  PRINTING: 'PRINTING',
  NEW_PIN: 'NEW_PIN',
  CONFIRM_PIN: 'CONFIRM_PIN',
  PIN_CHANGED: 'PIN_CHANGED',
  TIMEOUT_WARNING: 'TIMEOUT_WARNING',
  EJECT: 'EJECT',
  TAKE_CARD: 'TAKE_CARD',
  CARD_FORGOTTEN: 'CARD_FORGOTTEN',
  GOODBYE: 'GOODBYE',
});

export const TIMING = Object.freeze({
  read: 1400,
  blockedNotice: 3500,
  pinError: 5000,
  retained: 6000,
  declined: 10000,
  takeCard: 20000,
  count: 1800,
  takeCash: 25000,
  retracted: 5000,
  print: 1600,
  goodbye: 3500,
  eject: 1200,
  pinChanged: 2500,
  timeoutWarning: 10000,
  forgotten: 5000,
});

export const PIN_LENGTH = 4;
export const MAX_WITHDRAWAL_DOLLARS = 1000;
export const FAST_CASH_CENTS = 10_000;
const PRESETS = { a20: 2_000, a50: 5_000, a100: 10_000, a200: 20_000, a500: 50_000 };

// Screens where a customer is expected to act; idling on these triggers the timeout prompt.
export const INTERACTIVE = new Set([
  S.LANGUAGE, S.PIN, S.ACCOUNT, S.MENU, S.BALANCE, S.STATEMENT, S.AMOUNT, S.OTHER, S.CONFIRM,
  S.DECLINED, S.NEW_PIN, S.CONFIRM_PIN, S.PIN_ERROR,
]);

const SESSION_DEFAULTS = {
  lang: 'en',
  method: null,
  pinLength: 0,
  entry: '',
  account: null,
  amountCents: 0,
  receipt: false,
  remaining: 3,
  error: null,
  reason: null,
  returnTo: null,
  busy: false,
  data: null,
};

export function initialState() {
  return { screen: S.IDLE, seq: 0, tamper: false, receiptPending: false, ...SESSION_DEFAULTS };
}

const enter = (s, screen, patch = {}) => ({ ...s, ...patch, screen, seq: s.seq + 1 });
const timer = (s, ms) => ({ type: 'timer', ms, seq: s.seq });
const hw = (cmd) => ({ type: 'hw', cmd });
const audit = (kind, detail = '') => ({ type: 'audit', kind, detail });
const pad = (op, digit) => ({ type: 'pinpad', op, digit });
const out = (state, ...effects) => ({ state, effects: effects.flat().filter(Boolean) });
const same = (s) => ({ state: s, effects: [] });
const isDigit = (k) => typeof k === 'string' && /^\d$/.test(k);

function toIdle(s) {
  const next = enter(s, s.tamper ? S.OUT_OF_SERVICE : S.IDLE, SESSION_DEFAULTS);
  return out(next, hw('idle'));
}

function endSession(s, why = 'customer') {
  const base = [pad('clearAll'), audit('SESSION_END', why)];
  if (s.method === 'chip') {
    const next = enter(s, S.EJECT);
    return out(next, base, hw('ejectCard'), timer(next, TIMING.eject));
  }
  const next = enter(s, S.GOODBYE);
  return out(next, base, timer(next, TIMING.goodbye));
}

// Typing into the PIN pad: the digits go to the EPP effect, the state only counts them.
function pinKeys(s, key) {
  if (isDigit(key)) {
    if (s.pinLength >= PIN_LENGTH) return same(s);
    return out({ ...s, pinLength: s.pinLength + 1, error: null }, pad('press', key));
  }
  if (key === 'clear') {
    if (!s.pinLength) return same(s);
    return out({ ...s, pinLength: s.pinLength - 1 }, pad('backspace'));
  }
  return null;
}

export function step(s, event) {
  // Events that apply regardless of screen.
  switch (event.type) {
    case 'TIMER':
      if (event.seq !== s.seq) return same(s);
      break;
    case 'SET_TAMPER': {
      const next = { ...s, tamper: event.on };
      if (event.on && s.screen === S.IDLE) {
        const oos = enter(next, S.OUT_OF_SERVICE);
        return out(oos, audit('TAMPER_DETECTED', 'Foreign device on card reader'), hw('alarm'));
      }
      if (!event.on && s.screen === S.OUT_OF_SERVICE) {
        return out(enter(next, S.IDLE), audit('TAMPER_CLEARED', 'Card reader inspected'), hw('idle'));
      }
      return same(next);
    }
    case 'RECEIPT_TAKEN':
      if (!s.receiptPending) return same(s);
      return out({ ...s, receiptPending: false }, hw('takeReceipt'));
    case 'INACTIVITY':
      if (!INTERACTIVE.has(s.screen) || s.busy) return same(s);
      {
        const next = enter(s, S.TIMEOUT_WARNING, { returnTo: s.screen });
        return out(next, timer(next, TIMING.timeoutWarning));
      }
    case 'RESET':
      return out({ ...initialState(), tamper: s.tamper, seq: s.seq + 1, screen: s.tamper ? S.OUT_OF_SERVICE : S.IDLE },
        pad('clearAll'), hw('idle'));
    default:
      break;
  }

  const { type } = event;
  const key = event.key;
  const opt = event.id;

  switch (s.screen) {
    case S.IDLE:
      if (type === 'CARD_INSERT') {
        if (s.tamper) return out(enter(s, S.OUT_OF_SERVICE), audit('TAMPER_BLOCKED', 'Card refused'), hw('alarm'));
        const next = enter(s, S.READING, { method: event.method, busy: true });
        return out(
          next,
          hw(event.method === 'nfc' ? 'tapCard' : 'insertCard'),
          audit('CARD_PRESENTED', event.method === 'nfc' ? 'Contactless tap' : 'Chip inserted'),
          timer(next, TIMING.read),
        );
      }
      return same(s);

    case S.OUT_OF_SERVICE:
      return same(s);

    case S.READING:
      if (type === 'TIMER') return out(s, { type: 'checkCard' });
      if (type === 'CARD_STATUS') {
        if (event.status === 'blocked') {
          const next = enter(s, S.CARD_BLOCKED, { busy: false });
          return out(next, audit('CARD_BLOCKED', 'Issuer reports card blocked'), timer(next, TIMING.blockedNotice));
        }
        return same(enter(s, S.LANGUAGE, { busy: false }));
      }
      return same(s);

    case S.CARD_BLOCKED:
      if (type === 'TIMER') return endSession(s, 'card blocked');
      return same(s);

    case S.LANGUAGE:
      if (type === 'OPTION' && ['en', 'fr', 'es'].includes(opt)) {
        return out(enter(s, S.PIN, { lang: opt, pinLength: 0 }), pad('clear'));
      }
      if (type === 'KEY' && key === 'cancel') return endSession(s);
      return same(s);

    case S.PIN: {
      if (type !== 'KEY') return same(s);
      const typed = pinKeys(s, key);
      if (typed) return typed;
      if (key === 'enter' && s.pinLength === PIN_LENGTH) {
        return out(enter(s, S.VERIFYING, { busy: true }), { type: 'verifyPin' });
      }
      if (key === 'cancel') return endSession(s);
      return same(s);
    }

    case S.VERIFYING:
      if (type !== 'PIN_RESULT') return same(s);
      if (event.ok) {
        return out(enter(s, S.ACCOUNT, { busy: false, remaining: event.remaining }), audit('PIN_VERIFIED'));
      }
      if (event.blocked) {
        const next = enter(s, S.RETAINED, { busy: false, remaining: 0 });
        return out(next, audit('CARD_RETAINED', 'PIN tries exhausted'), pad('clearAll'), hw('retainCard'),
          timer(next, TIMING.retained));
      }
      {
        const next = enter(s, S.PIN_ERROR, { busy: false, remaining: event.remaining, pinLength: 0 });
        return out(next, audit('PIN_REJECTED', `${event.remaining} tries left`), timer(next, TIMING.pinError));
      }

    case S.PIN_ERROR:
      if (type === 'TIMER' || (type === 'OPTION' && opt === 'retry') || (type === 'KEY' && key === 'enter')) {
        return out(enter(s, S.PIN, { pinLength: 0 }), pad('clear'));
      }
      if ((type === 'OPTION' && opt === 'cancel') || (type === 'KEY' && key === 'cancel')) return endSession(s);
      return same(s);

    case S.RETAINED:
      if (type === 'TIMER') return toIdle(s);
      return same(s);

    case S.ACCOUNT:
      if (type === 'OPTION' && (opt === 'CHECKING' || opt === 'SAVINGS')) return same(enter(s, S.MENU, { account: opt }));
      if (type === 'KEY' && key === 'cancel') return endSession(s);
      return same(s);

    case S.MENU:
      if (type === 'KEY' && key === 'cancel') return endSession(s);
      if (type !== 'OPTION') return same(s);
      switch (opt) {
        case 'withdraw':
          return same(enter(s, S.AMOUNT, { error: null }));
        case 'fast':
          return same(enter(s, S.CONFIRM, { amountCents: FAST_CASH_CENTS }));
        case 'balance':
          return out(enter(s, S.BALANCE, { data: null }), { type: 'fetch', what: 'balance' });
        case 'statement':
          return out(enter(s, S.STATEMENT, { data: null }), { type: 'fetch', what: 'statement' });
        case 'changePin':
          return out(enter(s, S.NEW_PIN, { pinLength: 0, error: null }), pad('clearAll'));
        case 'exit':
          return endSession(s);
        default:
          return same(s);
      }

    case S.BALANCE:
    case S.STATEMENT:
      if (type === 'DATA') return same({ ...s, data: event.data });
      if ((type === 'OPTION' && opt === 'menu') || (type === 'KEY' && key === 'cancel')) return same(enter(s, S.MENU));
      if (type === 'OPTION' && opt === 'exit') return endSession(s);
      return same(s);

    case S.AMOUNT:
      if (type === 'OPTION' && PRESETS[opt]) return same(enter(s, S.CONFIRM, { amountCents: PRESETS[opt] }));
      if (type === 'OPTION' && opt === 'other') return same(enter(s, S.OTHER, { entry: '', error: null }));
      if (type === 'KEY' && key === 'cancel') return same(enter(s, S.MENU));
      return same(s);

    case S.OTHER:
      if (type !== 'KEY') return same(s);
      if (isDigit(key)) {
        if (s.entry.length >= 4 || (s.entry === '' && key === '0')) return same(s);
        return same({ ...s, entry: s.entry + key, error: null });
      }
      if (key === 'clear') return same({ ...s, entry: s.entry.slice(0, -1) });
      if (key === 'cancel') return same(enter(s, S.AMOUNT));
      if (key === 'enter') {
        const dollars = Number(s.entry);
        if (!dollars || dollars % 10 !== 0 || dollars > MAX_WITHDRAWAL_DOLLARS) {
          return same({ ...s, error: 'amountRules', entry: '' });
        }
        return same(enter(s, S.CONFIRM, { amountCents: dollars * 100 }));
      }
      return same(s);

    case S.CONFIRM:
      if ((type === 'OPTION' && (opt === 'receipt' || opt === 'noReceipt')) || (type === 'KEY' && key === 'enter')) {
        const receipt = opt === 'receipt';
        return out(enter(s, S.AUTHORIZING, { receipt, busy: true }), { type: 'authorize' });
      }
      if ((type === 'OPTION' && opt === 'back') || (type === 'KEY' && key === 'cancel')) return same(enter(s, S.AMOUNT));
      return same(s);

    case S.AUTHORIZING:
      if (type !== 'AUTH_RESULT') return same(s);
      if (!event.approved) {
        const next = enter(s, S.DECLINED, { busy: false, reason: event.reason });
        return out(next, audit('AUTH_DECLINED', event.reason), timer(next, TIMING.declined));
      }
      if (s.method === 'chip') {
        // Card before cash: the card comes back first so it can't be left behind.
        const next = enter(s, S.RETURN_CARD, { busy: false });
        return out(next, audit('AUTH_APPROVED', `${s.amountCents} cents`), hw('ejectCard'), timer(next, TIMING.takeCard));
      }
      {
        const next = enter(s, S.DISPENSING, { busy: false });
        return out(next, audit('AUTH_APPROVED', `${s.amountCents} cents`), hw('countCash'), timer(next, TIMING.count));
      }

    case S.DECLINED:
      if (type === 'TIMER' || (type === 'OPTION' && opt === 'menu') || (type === 'KEY' && key === 'cancel')) {
        return same(enter(s, S.MENU, { reason: null }));
      }
      if (type === 'OPTION' && opt === 'exit') return endSession(s);
      return same(s);

    case S.RETURN_CARD:
      if (type === 'CARD_TAKEN') {
        const next = enter(s, S.DISPENSING);
        return out(next, hw('takeCard'), hw('countCash'), timer(next, TIMING.count));
      }
      if (type === 'TIMER') {
        const next = enter(s, S.CARD_FORGOTTEN);
        return out(next, hw('retainCard'), { type: 'reverse' }, audit('CARD_RETAINED', 'Card not taken; hold reversed'),
          timer(next, TIMING.forgotten));
      }
      return same(s);

    case S.DISPENSING:
      if (type === 'TIMER') {
        const next = enter(s, S.TAKE_CASH);
        return out(next, hw('presentCash'), timer(next, TIMING.takeCash));
      }
      return same(s);

    case S.TAKE_CASH:
      if (type === 'CASH_TAKEN') {
        const effects = [hw('takeCash'), { type: 'complete' }, audit('CASH_TAKEN', `${s.amountCents} cents`)];
        if (s.receipt) {
          const next = enter(s, S.PRINTING, { receiptPending: true });
          return out(next, effects, hw('printReceipt'), timer(next, TIMING.print));
        }
        const next = enter(s, S.GOODBYE);
        return out(next, effects, audit('SESSION_END', 'withdrawal complete'), timer(next, TIMING.goodbye));
      }
      if (type === 'TIMER') {
        const next = enter(s, S.CASH_RETRACTED);
        return out(next, hw('retractCash'), { type: 'reverse' }, audit('CASH_RETRACTED', 'Not taken; hold reversed'),
          timer(next, TIMING.retracted));
      }
      return same(s);

    case S.CASH_RETRACTED: {
      if (type !== 'TIMER') return same(s);
      const next = enter(s, S.GOODBYE);
      return out(next, audit('SESSION_END', 'cash retracted'), timer(next, TIMING.goodbye));
    }

    case S.PRINTING: {
      if (type !== 'TIMER') return same(s);
      const next = enter(s, S.GOODBYE);
      return out(next, audit('SESSION_END', 'withdrawal complete'), timer(next, TIMING.goodbye));
    }

    case S.NEW_PIN:
    case S.CONFIRM_PIN: {
      if (type === 'NEW_PIN_CHECKED' && s.screen === S.NEW_PIN) {
        if (event.weak) return out({ ...s, busy: false, pinLength: 0, error: 'weakPin' }, pad('clear'));
        return out(enter(s, S.CONFIRM_PIN, { busy: false, pinLength: 0, error: null }), pad('stash'));
      }
      if (type === 'PIN_CHANGE_RESULT' && s.screen === S.CONFIRM_PIN) {
        if (event.ok) {
          const next = enter(s, S.PIN_CHANGED, { busy: false });
          return out(next, audit('PIN_CHANGED'), timer(next, TIMING.pinChanged));
        }
        const error = event.reason === 'WEAK' ? 'weakPin' : 'pinMismatch';
        return out(enter(s, S.NEW_PIN, { busy: false, pinLength: 0, error }), pad('clearAll'));
      }
      if (type !== 'KEY' || s.busy) return same(s);
      if (key === 'cancel') return out(enter(s, S.MENU, { pinLength: 0, error: null }), pad('clearAll'));
      const typed = pinKeys(s, key);
      if (typed) return typed;
      if (key === 'enter' && s.pinLength === PIN_LENGTH) {
        return out({ ...s, busy: true }, { type: s.screen === S.NEW_PIN ? 'checkNewPin' : 'confirmNewPin' });
      }
      return same(s);
    }

    case S.PIN_CHANGED:
      if (type === 'TIMER') return same(enter(s, S.MENU));
      return same(s);

    case S.TIMEOUT_WARNING:
      if (type === 'OPTION' && opt === 'yes') return same(enter(s, s.returnTo, { returnTo: null }));
      if (type === 'TIMER' || (type === 'OPTION' && opt === 'no') || (type === 'KEY' && key === 'cancel')) {
        return endSession(s, 'timeout');
      }
      return same(s);

    case S.EJECT:
      if (type === 'TIMER') {
        const next = enter(s, S.TAKE_CARD);
        return out(next, timer(next, TIMING.takeCard));
      }
      return same(s);

    case S.TAKE_CARD:
      if (type === 'CARD_TAKEN') {
        const next = enter(s, S.GOODBYE);
        return out(next, hw('takeCard'), timer(next, TIMING.goodbye));
      }
      if (type === 'TIMER') {
        const next = enter(s, S.CARD_FORGOTTEN);
        return out(next, hw('retainCard'), audit('CARD_RETAINED', 'Card not taken'), timer(next, TIMING.forgotten));
      }
      return same(s);

    case S.CARD_FORGOTTEN:
    case S.GOODBYE:
      if (type === 'TIMER') return toIdle(s);
      return same(s);

    default:
      return same(s);
  }
}
