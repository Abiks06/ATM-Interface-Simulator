import {
  constantTimeEqual,
  decryptPinBlock,
  generateArqc,
  hashPin,
  isWeakPin,
  parsePinBlockIso0,
  randomHex,
} from './security.js';

export const TEST_CARD = { pan: '4000 1234 5678 4321', holder: 'JOHN A. DOE', expiry: '09/29', pin: '4826' };
export const DAILY_LIMIT_CENTS = 100_000;
export const MAX_PIN_TRIES = 3;

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function seedAccounts() {
  return {
    CHECKING: {
      balance: 524_050,
      history: [
        { date: daysAgo(1), desc: 'POS PURCHASE', amount: -4_500 },
        { date: daysAgo(2), desc: 'ATM WITHDRAWAL', amount: -20_000 },
        { date: daysAgo(3), desc: 'SALARY CREDIT', amount: 320_000 },
        { date: daysAgo(5), desc: 'TRANSFER OUT', amount: -15_000 },
        { date: daysAgo(6), desc: 'ONLINE PURCHASE', amount: -8_999 },
      ],
    },
    SAVINGS: {
      balance: 1_830_000,
      history: [
        { date: daysAgo(4), desc: 'INTEREST', amount: 1_215 },
        { date: daysAgo(30), desc: 'TRANSFER IN', amount: 50_000 },
      ],
    },
  };
}

// Simulated card issuer ("host"). It holds the only copy of the PIN hash and the card key,
// keeps the PIN retry counter server-side (pulling the card out doesn't reset it) and refuses
// replayed or forged authorisation requests.
export async function createHost({ zoneKey, cardKey, pan = TEST_CARD.pan, pin = TEST_CARD.pin }) {
  const card = {
    pan,
    salt: randomHex(16),
    pinHash: '',
    failed: 0,
    blocked: false,
    lastAtc: 0,
    withdrawnToday: 0,
    accounts: seedAccounts(),
  };
  card.pinHash = await hashPin(pin, card.salt);
  const holds = new Map();

  const held = (account) =>
    [...holds.values()].filter((h) => h.account === account).reduce((s, h) => s + h.amountCents, 0);

  return {
    checkCard() {
      return { status: card.blocked ? 'blocked' : 'active' };
    },

    async verifyPin(encrypted) {
      if (card.blocked) return { ok: false, blocked: true, remaining: 0 };
      const pinFromBlock = parsePinBlockIso0(await decryptPinBlock(zoneKey, encrypted), card.pan);
      const candidate = await hashPin(pinFromBlock, card.salt);
      const ok = constantTimeEqual(candidate, card.pinHash);
      if (ok) card.failed = 0;
      else card.failed += 1;
      if (card.failed >= MAX_PIN_TRIES) card.blocked = true;
      return {
        ok,
        blocked: card.blocked,
        remaining: Math.max(0, MAX_PIN_TRIES - card.failed),
        hashPreview: candidate.slice(0, 16),
      };
    },

    async authorize({ account, amountCents, atc, un, arqc }) {
      if (card.blocked) return { approved: false, reason: 'CARD_BLOCKED' };
      if (atc <= card.lastAtc) return { approved: false, reason: 'REPLAY', lastAtc: card.lastAtc };
      const expected = await generateArqc(cardKey, { pan: card.pan, amountCents, atc, un });
      if (!constantTimeEqual(expected, arqc)) return { approved: false, reason: 'BAD_CRYPTOGRAM' };
      const previousAtc = card.lastAtc;
      card.lastAtc = atc;
      const acct = card.accounts[account];
      if (amountCents > acct.balance - held(account)) return { approved: false, reason: 'INSUFFICIENT_FUNDS' };
      const heldToday = [...holds.values()].reduce((s, h) => s + h.amountCents, 0);
      if (card.withdrawnToday + heldToday + amountCents > DAILY_LIMIT_CENTS) {
        return { approved: false, reason: 'DAILY_LIMIT' };
      }
      const holdId = 'H' + randomHex(4);
      holds.set(holdId, { account, amountCents });
      return { approved: true, holdId, previousAtc };
    },

    // Funds only leave the account once the customer has actually taken the cash.
    complete(holdId) {
      const hold = holds.get(holdId);
      if (!hold) return false;
      holds.delete(holdId);
      const acct = card.accounts[hold.account];
      acct.balance -= hold.amountCents;
      card.withdrawnToday += hold.amountCents;
      acct.history = [{ date: daysAgo(0), desc: 'ATM WITHDRAWAL', amount: -hold.amountCents }, ...acct.history];
      return true;
    },

    reverse(holdId) {
      return holds.delete(holdId);
    },

    balance(account) {
      const acct = card.accounts[account];
      return { ledger: acct.balance, available: acct.balance - held(account) };
    },

    statement(account) {
      return card.accounts[account].history.slice(0, 5);
    },

    async changePin(encrypted) {
      const pin = parsePinBlockIso0(await decryptPinBlock(zoneKey, encrypted), card.pan);
      if (isWeakPin(pin)) return { ok: false, reason: 'WEAK' };
      card.salt = randomHex(16);
      card.pinHash = await hashPin(pin, card.salt);
      return { ok: true };
    },

    // Demo control: the bank unblocks the card after the customer calls in.
    unblock() {
      card.blocked = false;
      card.failed = 0;
    },

    get snapshot() {
      return { blocked: card.blocked, failed: card.failed, lastAtc: card.lastAtc };
    },
  };
}
