import { beforeEach, describe, expect, it } from 'vitest';
import { createHost, TEST_CARD } from './bank.js';
import { createJournal } from './journal.js';
import { createPinPad } from './pinpad.js';
import {
  constantTimeEqual,
  generateArqc,
  generateCardKey,
  generateZoneKey,
  isWeakPin,
  parsePinBlockIso0,
  pinBlockIso0,
  toHex,
} from './security.js';
import { planDispense } from './dispenser.js';

describe('ISO 9564 format 0 PIN block', () => {
  it('matches a hand-computed block', () => {
    // PIN field 041234FFFFFFFFFF XOR PAN field 0000198765432109
    // (12 rightmost PAN digits, check digit dropped)
    const block = pinBlockIso0('1234', '4321987654321098');
    expect(toHex(block)).toBe('04122D789ABCDEF6');
    expect(parsePinBlockIso0(block, '4321987654321098')).toBe('1234');
  });

  it('round-trips every 4-digit PIN for the test card', () => {
    for (const pin of ['0000', '4826', '9999', '1357']) {
      expect(parsePinBlockIso0(pinBlockIso0(pin, TEST_CARD.pan), TEST_CARD.pan)).toBe(pin);
    }
  });

  it('XORs with the PAN so the same PIN on different cards gives different blocks', () => {
    expect(toHex(pinBlockIso0('4826', '4000123456784321'))).not.toBe(toHex(pinBlockIso0('4826', '5100987654321234')));
  });
});

describe('PIN policy', () => {
  it.each(['1234', '0000', '7777', '4567', '9876', '2580'])('rejects %s', (pin) => {
    expect(isWeakPin(pin)).toBe(true);
  });
  it.each(['4826', '9182', '3071'])('accepts %s', (pin) => {
    expect(isWeakPin(pin)).toBe(false);
  });
});

describe('constant-time compare', () => {
  it('compares equal and unequal strings', () => {
    expect(constantTimeEqual('ABCD', 'ABCD')).toBe(true);
    expect(constantTimeEqual('ABCD', 'ABCE')).toBe(false);
    expect(constantTimeEqual('ABC', 'ABCD')).toBe(false);
  });
});

describe('host', () => {
  let zoneKey, cardKey, host, pad;
  beforeEach(async () => {
    zoneKey = await generateZoneKey();
    cardKey = await generateCardKey();
    host = await createHost({ zoneKey, cardKey });
    pad = createPinPad(zoneKey);
  });

  const typePin = (pin) => [...pin].forEach((d) => pad.press(d));

  it('verifies the right PIN from an encrypted block', async () => {
    typePin(TEST_CARD.pin);
    const enc = await pad.encrypt(TEST_CARD.pan);
    expect(enc.ciphertext).not.toContain(TEST_CARD.pin);
    expect(pad.length).toBe(0);
    expect((await host.verifyPin(enc)).ok).toBe(true);
  });

  it('blocks the card after three wrong PINs, even across sessions', async () => {
    for (let i = 0; i < 3; i++) {
      typePin('9182');
      const r = await host.verifyPin(await pad.encrypt(TEST_CARD.pan));
      expect(r.ok).toBe(false);
      expect(r.remaining).toBe(2 - i);
    }
    expect(host.checkCard().status).toBe('blocked');
    typePin(TEST_CARD.pin);
    expect((await host.verifyPin(await pad.encrypt(TEST_CARD.pan))).ok).toBe(false);
  });

  async function request(amountCents, atc) {
    const un = 'A1B2C3D4';
    const arqc = await generateArqc(cardKey, { pan: TEST_CARD.pan, amountCents, atc, un });
    return { account: 'CHECKING', amountCents, atc, un, arqc };
  }

  it('approves a valid cryptogram and debits only after completion', async () => {
    const before = host.balance('CHECKING');
    const r = await host.authorize(await request(10_000, 1));
    expect(r.approved).toBe(true);
    expect(host.balance('CHECKING').available).toBe(before.available - 10_000);
    expect(host.balance('CHECKING').ledger).toBe(before.ledger);
    host.complete(r.holdId);
    expect(host.balance('CHECKING').ledger).toBe(before.ledger - 10_000);
  });

  it('releases the hold on reversal', async () => {
    const before = host.balance('CHECKING');
    const r = await host.authorize(await request(10_000, 1));
    host.reverse(r.holdId);
    expect(host.balance('CHECKING')).toEqual(before);
  });

  it('rejects a replayed request', async () => {
    const req = await request(10_000, 1);
    expect((await host.authorize(req)).approved).toBe(true);
    const again = await host.authorize(req);
    expect(again).toMatchObject({ approved: false, reason: 'REPLAY' });
  });

  it('rejects a tampered amount', async () => {
    const req = await request(2_000, 1);
    const r = await host.authorize({ ...req, amountCents: 50_000 });
    expect(r).toMatchObject({ approved: false, reason: 'BAD_CRYPTOGRAM' });
  });

  it('enforces the daily limit', async () => {
    const a = await host.authorize(await request(60_000, 1));
    host.complete(a.holdId);
    const b = await host.authorize(await request(50_000, 2));
    expect(b).toMatchObject({ approved: false, reason: 'DAILY_LIMIT' });
  });

  it('refuses a weak new PIN', async () => {
    typePin('1111');
    expect(await host.changePin(await pad.encrypt(TEST_CARD.pan))).toEqual({ ok: false, reason: 'WEAK' });
  });
});

describe('PIN pad', () => {
  it('caps the PIN length and compares a stashed entry internally', async () => {
    const pad = createPinPad(await generateZoneKey());
    '482699'.split('').forEach((d) => pad.press(d));
    expect(pad.length).toBe(4);
    pad.stash();
    expect(pad.length).toBe(0);
    '4826'.split('').forEach((d) => pad.press(d));
    expect(pad.matchesStash()).toBe(true);
    pad.backspace();
    pad.press('0');
    expect(pad.matchesStash()).toBe(false);
  });
});

describe('dispenser', () => {
  it('uses the fewest notes', () => {
    expect(planDispense(380)).toEqual({ count: 6, notes: { 100: 3, 50: 1, 20: 1, 10: 1 } });
  });
  it('works around an empty cassette', () => {
    expect(planDispense(200, { 100: 0, 50: 0, 20: 10, 10: 0 })).toEqual({ count: 10, notes: { 20: 10 } });
  });
  it('returns null when the inventory cannot make the amount', () => {
    expect(planDispense(30, { 100: 5, 50: 5, 20: 5, 10: 0 })).toBeNull();
    expect(planDispense(25)).toBeNull();
  });
});

describe('journal', () => {
  it('detects an edited entry', async () => {
    const j = createJournal();
    await j.append('CARD_PRESENTED', 'chip');
    await j.append('PIN_VERIFIED');
    await j.append('CASH_TAKEN', '10000 cents');
    expect(await j.verify()).toEqual({ ok: true, brokenAt: null });
    j.tamper(2, 'nothing to see here');
    expect(await j.verify()).toEqual({ ok: false, brokenAt: 2 });
  });
});
