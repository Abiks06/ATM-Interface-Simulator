import { S } from './machine.js';
import { strings } from './i18n.js';
import { formatMoney } from './money.js';

// Option slots line up with the physical side keys (FDKs) next to the screen: L2-L4 on the left,
// R2-R4 on the right. Digits 1-6 select them in this order as a keyboard shortcut.
export const SLOTS = ['L2', 'L3', 'L4', 'R2', 'R3', 'R4'];

const dots = (n, len = 4) => Array.from({ length: len }, (_, i) => (i < n ? '•' : '_')).join('  ');
const opt = (id, label, slot) => ({ id, label, slot });

// Turns machine state into what the ATM screen shows. The same model drives the 3D screen
// in Spline and the 2D mirror in the side panel.
export function describe(state) {
  const t = strings(state.lang);
  const m = { title: '', lines: [], options: [], footer: t.footer, tone: 'normal', entry: null };
  const set = (patch) => Object.assign(m, patch);

  switch (state.screen) {
    case S.IDLE:
      set({ title: t.welcome, lines: [t.insertCard, t.toBegin] });
      break;
    case S.OUT_OF_SERVICE:
      set({ title: t.outOfService, lines: [t.tamper, t.sorry], tone: 'alert', footer: '' });
      break;
    case S.READING:
      set({ title: t.reading, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.CARD_BLOCKED:
      set({ title: t.blocked, lines: [t.contactBank], tone: 'alert' });
      break;
    case S.LANGUAGE:
      set({
        title: 'Language  ·  Langue  ·  Idioma',
        options: [opt('en', 'English', 'L2'), opt('fr', 'Français', 'L3'), opt('es', 'Español', 'L4')],
      });
      break;
    case S.PIN:
    case S.NEW_PIN:
    case S.CONFIRM_PIN: {
      const title = { [S.PIN]: t.enterPin, [S.NEW_PIN]: t.newPin, [S.CONFIRM_PIN]: t.confirmPin }[state.screen];
      set({
        title,
        lines: [dots(state.pinLength), state.error ? t[state.error] : '', t.pinHint],
        entry: 'pin',
        tone: state.error ? 'alert' : 'normal',
      });
      break;
    }
    case S.VERIFYING:
      set({ title: t.verifying, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.PIN_ERROR:
      set({
        title: t.wrongPin,
        lines: [t.triesLeft(state.remaining)],
        options: [opt('cancel', t.cancel, 'L4'), opt('retry', t.retry, 'R4')],
        tone: 'alert',
      });
      break;
    case S.RETAINED:
      set({ title: t.retained, lines: [t.retainedBody, t.contactBank], tone: 'alert' });
      break;
    case S.ACCOUNT:
      set({ title: t.chooseAccount, options: [opt('CHECKING', t.CHECKING, 'L3'), opt('SAVINGS', t.SAVINGS, 'R3')] });
      break;
    case S.MENU:
      set({
        title: t.menu,
        options: [
          opt('withdraw', t.withdraw, 'L2'),
          opt('fast', t.fast, 'L3'),
          opt('balance', t.balance, 'L4'),
          opt('statement', t.statement, 'R2'),
          opt('changePin', t.changePin, 'R3'),
          opt('exit', t.exit, 'R4'),
        ],
      });
      break;
    case S.BALANCE:
      set({
        title: t.balanceTitle,
        lines: state.data
          ? [`${t.available}: ${formatMoney(state.data.available)}`, `${t.ledger}: ${formatMoney(state.data.ledger)}`, t[state.account]]
          : [t.pleaseWait],
        options: [opt('menu', t.mainMenu, 'L4'), opt('exit', t.exit, 'R4')],
      });
      break;
    case S.STATEMENT:
      set({
        title: t.statementTitle,
        lines: state.data
          ? state.data.slice(0, 3).map((r) => `${r.date.slice(5)}  ${r.desc}  ${formatMoney(r.amount)}`)
          : [t.pleaseWait],
        options: [opt('menu', t.mainMenu, 'L4'), opt('exit', t.exit, 'R4')],
      });
      break;
    case S.AMOUNT:
      set({
        title: t.selectAmount,
        options: [
          opt('a20', '$20', 'L2'),
          opt('a50', '$50', 'L3'),
          opt('a100', '$100', 'L4'),
          opt('a200', '$200', 'R2'),
          opt('a500', '$500', 'R3'),
          opt('other', t.other, 'R4'),
        ],
      });
      break;
    case S.OTHER:
      set({
        title: t.enterAmount,
        lines: [`$${state.entry || '0'}`, state.error ? t[state.error] : t.amountRules],
        entry: 'amount',
        tone: state.error ? 'alert' : 'normal',
      });
      break;
    case S.CONFIRM:
      set({
        title: t.confirmTitle,
        lines: [formatMoney(state.amountCents), `${t.from} ${t[state.account] || ''}`],
        options: [opt('back', t.back, 'L4'), opt('receipt', t.withReceipt, 'R3'), opt('noReceipt', t.noReceipt, 'R4')],
      });
      break;
    case S.AUTHORIZING:
      set({ title: t.authorizing, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.DECLINED:
      set({
        title: t.declined,
        lines: [t[state.reason] || state.reason || ''],
        options: [opt('menu', t.mainMenu, 'L4'), opt('exit', t.exit, 'R4')],
        tone: 'alert',
      });
      break;
    case S.RETURN_CARD:
      set({ title: t.takeCardFirst, lines: [t.cashFollows] });
      break;
    case S.DISPENSING:
      set({ title: t.counting, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.TAKE_CASH:
      set({ title: t.takeCash, lines: [formatMoney(state.amountCents)], tone: 'success' });
      break;
    case S.CASH_RETRACTED:
      set({ title: t.retracted, lines: [t.retractedBody], tone: 'alert' });
      break;
    case S.PRINTING:
      set({ title: t.printing, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.PIN_CHANGED:
      set({ title: t.pinChanged, tone: 'success' });
      break;
    case S.TIMEOUT_WARNING:
      set({ title: t.moreTime, options: [opt('no', t.no, 'L4'), opt('yes', t.yes, 'R4')] });
      break;
    case S.EJECT:
      set({ title: t.ejecting, lines: [t.pleaseWait], tone: 'busy' });
      break;
    case S.TAKE_CARD:
      set({ title: t.takeCard });
      break;
    case S.CARD_FORGOTTEN:
      set({ title: t.forgotten, lines: [t.forgottenBody], tone: 'alert' });
      break;
    case S.GOODBYE:
      set({ title: t.goodbye, lines: state.receiptPending ? [t.takeReceipt] : [], tone: 'success' });
      break;
    default:
      break;
  }
  m.lines = m.lines.slice(0, 3);
  return m;
}

export const optionForSlot = (model, slot) => model.options.find((o) => o.slot === slot) || null;

export function optionForDigit(model, digit) {
  const slot = SLOTS[Number(digit) - 1];
  return slot ? optionForSlot(model, slot) : null;
}
