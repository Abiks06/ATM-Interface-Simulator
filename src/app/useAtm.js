import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createHost, TEST_CARD } from '../core/bank.js';
import { DEFAULT_CASSETTES, describeNotes, planDispense, takeNotes } from '../core/dispenser.js';
import { createJournal } from '../core/journal.js';
import { initialState, INTERACTIVE, S, step } from '../core/machine.js';
import { formatMoney } from '../core/money.js';
import { createPinPad } from '../core/pinpad.js';
import { describe, optionForDigit, optionForSlot } from '../core/screens.js';
import { generateArqc, generateCardKey, generateZoneKey, PBKDF2_ITERATIONS, randomHex } from '../core/security.js';
import { sounds } from './sound.js';
import { useLatest } from './useLatest.js';

const INACTIVITY_MS = 30_000;

const SCREEN_SHOTS = {
  [S.RETURN_CARD]: 'card',
  [S.EJECT]: 'card',
  [S.TAKE_CARD]: 'card',
  [S.CARD_FORGOTTEN]: 'card',
  [S.RETAINED]: 'card',
  [S.DISPENSING]: 'cash',
  [S.TAKE_CASH]: 'cash',
  [S.CASH_RETRACTED]: 'cash',
  [S.PRINTING]: 'receipt',
};

const KEY_GROUP = { enter: 'Key Enter', clear: 'Key Clear', cancel: 'Key Cancel' };
const keyGroup = (key) => KEY_GROUP[key] || `Key ${key}`;

async function createServices() {
  const zoneKey = await generateZoneKey();
  const cardKey = await generateCardKey();
  const host = await createHost({ zoneKey, cardKey });
  return { zoneKey, cardKey, host, pad: createPinPad(zoneKey), journal: createJournal(), card: { ...TEST_CARD, atc: 0 } };
}

// Controller: owns the state machine, runs its effects (timers, crypto, bank calls, 3D
// hardware) and turns user input from the scene, keyboard or side panel into events.
export function useAtm({ rig, active, autoCamera, homeShot = 'operate' }) {
  const [state, setState] = useState(initialState);
  const [trace, setTrace] = useState([]);
  const [journal, setJournal] = useState([]);
  const [attack, setAttack] = useState({ skimmer: false, pinhole: false });
  const [services, setServices] = useState(null);
  const [cassettes, setCassettes] = useState(DEFAULT_CASSETTES);

  const stateRef = useRef(state);
  const svc = useRef(null);
  const timerRef = useRef(null);
  const holdRef = useRef(null);
  const lastRequest = useRef(null);
  const lastInput = useRef(0);
  const cassettesRef = useLatest(cassettes);
  const rigRef = useLatest(rig);
  const activeRef = useLatest(active);
  const attackRef = useLatest(attack);

  const model = useMemo(() => describe(state), [state]);

  const log = useCallback((title, body = '', tone = 'info', code = '') => {
    setTrace((t) => [{ id: `${Date.now()}-${Math.random()}`, at: new Date(), title, body, tone, code }, ...t].slice(0, 60));
  }, []);

  useEffect(() => {
    let cancelled = false;
    createServices().then((s) => {
      if (cancelled) return;
      svc.current = s;
      s.journal.subscribe(setJournal);
      s.journal.append('POWER_ON', 'Secure ATM v2 self-test passed');
      setServices(s);
    });
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, []);

  // `dispatch` and `runEffects` call each other, so they go through refs.
  const dispatchRef = useRef(null);
  const dispatch = useCallback((event) => dispatchRef.current?.(event), []);

  const runHardware = useCallback((cmd) => {
    const r = rigRef.current;
    if (!r || !activeRef.current) return;
    const run = {
      idle: () => {
        r.reset(attackRef.current);
        r.awaitingCard(true);
      },
      insertCard: () => r.insertCard(),
      tapCard: () => r.tapCard(),
      ejectCard: () => r.ejectCard(),
      takeCard: () => r.takeCard(),
      retainCard: () => r.retainCard(),
      countCash: () => {},
      presentCash: () => r.presentCash(),
      takeCash: () => r.takeCash(),
      retractCash: () => r.retractCash(),
      printReceipt: () => r.printReceipt(),
      takeReceipt: () => r.takeReceipt(),
      alarm: () => r.alarm(true),
    }[cmd];
    run?.();
  }, [rigRef, activeRef, attackRef]);

  const runEffect = useCallback(
    async (e) => {
      const s = svc.current;
      if (!s) return;
      const cur = () => stateRef.current;
      switch (e.type) {
        case 'timer':
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => dispatch({ type: 'TIMER', seq: e.seq }), e.ms);
          break;
        case 'hw':
          runHardware(e.cmd);
          break;
        case 'audit':
          s.journal.append(e.kind, e.detail);
          break;
        case 'pinpad':
          if (e.op === 'press') s.pad.press(e.digit);
          else s.pad[e.op]?.();
          break;
        case 'checkCard': {
          const { status } = s.host.checkCard();
          log('Card read', `Chip application selected · PAN ${s.card.pan.slice(0, 4)} •••• ${s.card.pan.slice(-4)} · status ${status}`);
          dispatch({ type: 'CARD_STATUS', status });
          break;
        }
        case 'verifyPin': {
          const enc = await s.pad.encrypt(s.card.pan);
          log(
            'PIN encrypted inside the PIN pad',
            'ISO 9564 format 0 block (PIN XOR PAN), sealed with AES-256-GCM using the non-extractable zone key. The digits never leave the pad.',
            'secure',
            `iv ${enc.iv}\nct ${enc.ciphertext}`,
          );
          const r = await s.host.verifyPin(enc);
          log(
            r.ok ? 'Host verified the PIN' : 'Host rejected the PIN',
            `Decrypted the block, PBKDF2-SHA256 × ${PBKDF2_ITERATIONS.toLocaleString()} with a per-card salt, constant-time compare. Server-side tries left: ${r.remaining}.`,
            r.ok ? 'ok' : 'warn',
            r.hashPreview ? `hash ${r.hashPreview}…` : '',
          );
          if (!r.ok) sounds.error();
          dispatch({ type: 'PIN_RESULT', ...r });
          break;
        }
        case 'fetch': {
          const { account } = cur();
          const data = e.what === 'balance' ? s.host.balance(account) : s.host.statement(account);
          dispatch({ type: 'DATA', data });
          break;
        }
        case 'authorize': {
          const { amountCents, account } = cur();
          const plan = planDispense(amountCents / 100, cassettesRef.current);
          if (!plan) {
            log('Dispense check failed', `The cassettes can't make ${formatMoney(amountCents)} right now.`, 'warn');
            dispatch({ type: 'AUTH_RESULT', approved: false, reason: 'CANNOT_DISPENSE' });
            break;
          }
          s.card.atc += 1;
          const un = randomHex(4);
          const arqc = await generateArqc(s.cardKey, { pan: s.card.pan, amountCents, atc: s.card.atc, un });
          const request = { account, amountCents, atc: s.card.atc, un, arqc };
          lastRequest.current = request;
          log(
            'Chip generated a cryptogram (ARQC)',
            'HMAC-SHA256 with the card key over PAN, amount, transaction counter (ATC) and the terminal’s unpredictable number. Changing any field invalidates it.',
            'secure',
            `ATC ${request.atc} · UN ${un}\nARQC ${arqc}`,
          );
          const r = await s.host.authorize(request);
          if (r.approved) {
            holdRef.current = { holdId: r.holdId, notes: plan.notes, amountCents };
            log('Host approved and placed a hold', `ATC ${request.atc} > last seen ${r.previousAtc} · cryptogram valid · funds held, not yet debited. Plan: ${describeNotes(plan.notes)}.`, 'ok');
          } else {
            log('Host declined', r.reason, 'warn');
            sounds.error();
          }
          dispatch({ type: 'AUTH_RESULT', ...r });
          break;
        }
        case 'complete': {
          const hold = holdRef.current;
          if (!hold) break;
          s.host.complete(hold.holdId);
          setCassettes((c) => takeNotes(c, hold.notes));
          log('Cash taken: hold settled', `${formatMoney(hold.amountCents)} debited only after the presenter confirmed the notes were removed.`, 'ok');
          holdRef.current = null;
          break;
        }
        case 'reverse': {
          const hold = holdRef.current;
          if (!hold) break;
          s.host.reverse(hold.holdId);
          log('Hold reversed', `${formatMoney(hold.amountCents)} released: the cash or card was never taken.`, 'warn');
          holdRef.current = null;
          break;
        }
        case 'checkNewPin':
          dispatch({ type: 'NEW_PIN_CHECKED', weak: s.pad.isWeak() });
          break;
        case 'confirmNewPin': {
          if (!s.pad.matchesStash()) {
            s.pad.clearAll();
            dispatch({ type: 'PIN_CHANGE_RESULT', ok: false, reason: 'MISMATCH' });
            break;
          }
          const enc = await s.pad.encrypt(s.card.pan);
          const r = await s.host.changePin(enc);
          log(r.ok ? 'PIN changed' : 'New PIN refused', 'Compared inside the PIN pad, sent encrypted, re-hashed with a fresh salt by the host.', r.ok ? 'ok' : 'warn');
          dispatch({ type: 'PIN_CHANGE_RESULT', ...r });
          break;
        }
        default:
          break;
      }
    },
    [dispatch, log, runHardware, cassettesRef],
  );

  useLayoutEffect(() => {
    dispatchRef.current = (event) => {
      const { state: next, effects } = step(stateRef.current, event);
      stateRef.current = next;
      setState(next);
      effects.forEach((e) => runEffect(e));
    };
  }, [runEffect]);

  // Mirror the screen and camera into the 3D scene while the simulator owns it.
  useEffect(() => {
    if (!active || !rig) return;
    rig.renderScreen(model);
  }, [active, rig, model]);

  const lastShot = useRef(null);
  useEffect(() => {
    if (!active || !rig || !autoCamera) return;
    const shot = state.screen === S.READING ? (state.method === 'nfc' ? 'nfc' : 'card') : SCREEN_SHOTS[state.screen] || homeShot;
    if (shot !== lastShot.current) {
      lastShot.current = shot;
      rig.look(shot, 1300);
    }
  }, [active, rig, autoCamera, homeShot, state.screen, state.method]);

  // When the simulator takes over the scene, put the hardware back to match the session.
  useEffect(() => {
    if (!active || !rig) return;
    lastShot.current = null;
    rig.reset(attackRef.current);
    rig.awaitingCard(stateRef.current.screen === S.IDLE);
    if (stateRef.current.screen === S.OUT_OF_SERVICE) rig.alarm(true);
    rig.renderScreen(describe(stateRef.current));
  }, [active, rig, attackRef]);

  useEffect(() => {
    const t = setInterval(() => {
      if (INTERACTIVE.has(stateRef.current.screen) && Date.now() - lastInput.current > INACTIVITY_MS) {
        lastInput.current = Date.now();
        dispatch({ type: 'INACTIVITY' });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [dispatch]);

  const touch = () => (lastInput.current = Date.now());

  const pressKey = useCallback(
    (key) => {
      if (!svc.current) return;
      touch();
      sounds.key();
      rigRef.current?.pressKey(keyGroup(key));
      const cur = stateRef.current;
      const m = describe(cur);
      if (/^\d$/.test(key) && !m.entry && m.options.length) {
        const o = optionForDigit(m, key);
        if (o) dispatch({ type: 'OPTION', id: o.id });
        return;
      }
      if (cur.screen === S.IDLE && key === 'enter') {
        dispatch({ type: 'CARD_INSERT', method: 'chip' });
        return;
      }
      dispatch({ type: 'KEY', key });
    },
    [dispatch, rigRef],
  );

  const pressSlot = useCallback(
    (slot) => {
      touch();
      sounds.key();
      rigRef.current?.pressKey(`FDK ${slot}`);
      const o = optionForSlot(describe(stateRef.current), slot);
      if (o) dispatch({ type: 'OPTION', id: o.id });
    },
    [dispatch, rigRef],
  );

  const chooseOption = useCallback(
    (id) => {
      touch();
      sounds.key();
      const o = describe(stateRef.current).options.find((x) => x.id === id);
      if (o) rigRef.current?.pressKey(`FDK ${o.slot}`);
      dispatch({ type: 'OPTION', id });
    },
    [dispatch, rigRef],
  );

  const insertCard = useCallback(
    (method = 'chip') => {
      touch();
      if (stateRef.current.screen === S.IDLE) dispatch({ type: 'CARD_INSERT', method });
    },
    [dispatch],
  );
  const takeCard = useCallback(() => (touch(), dispatch({ type: 'CARD_TAKEN' })), [dispatch]);
  const takeCash = useCallback(() => (touch(), dispatch({ type: 'CASH_TAKEN' })), [dispatch]);
  const takeReceipt = useCallback(() => (touch(), dispatch({ type: 'RECEIPT_TAKEN' })), [dispatch]);

  // Clicks on scene objects arrive by name from the Spline bridge.
  const handleSceneClick = useCallback(
    (name) => {
      if (!name) return;
      const screen = stateRef.current.screen;
      let m;
      if ((m = name.match(/^Key (.+?) (Cap|Label|Dot)$/))) {
        const k = m[1];
        if (/^\d$/.test(k)) pressKey(k);
        else if (KEY_GROUP[k.toLowerCase()]) pressKey(k.toLowerCase());
        else rigRef.current?.pressKey(`Key ${k}`);
      } else if ((m = name.match(/^FDK ([LR]\d)$/))) {
        pressSlot(m[1]);
      } else if (/^(Card (Body|Chip|Stripe|Slot|Throat|Reader Bezel))$/.test(name)) {
        if (screen === S.IDLE) insertCard('chip');
        else if (screen === S.RETURN_CARD || screen === S.TAKE_CARD) takeCard();
      } else if (name.startsWith('NFC Pad')) {
        insertCard('nfc');
      } else if (name.startsWith('Cash')) {
        if (screen === S.TAKE_CASH) takeCash();
      } else if (name === 'Receipt') {
        takeReceipt();
      } else if (name.startsWith('Skimmer')) {
        log('That is a skimmer', 'A fake bezel glued over the card slot to copy the magstripe. The anti-skimming sensor already took the ATM out of service.', 'warn');
      }
    },
    [insertCard, log, pressKey, pressSlot, takeCard, takeCash, takeReceipt, rigRef],
  );

  // --- attack lab -------------------------------------------------------------------------
  const setSkimmer = useCallback(
    (on) => {
      setAttack((a) => ({ ...a, skimmer: on }));
      rigRef.current?.setSkimmer(on);
      if (on) {
        log('Skimmer attached', 'A thief glues a fake bezel with a magstripe reader over the card slot.', 'warn');
        setTimeout(() => {
          dispatch({ type: 'SET_TAMPER', on: true });
          log(
            'Anti-skimming sensor tripped',
            'The reader’s electromagnetic field detects a foreign device. The ATM goes out of service and refuses cards until it is cleared.',
            'secure',
          );
        }, 1200);
      } else {
        rigRef.current?.alarm(false);
        dispatch({ type: 'SET_TAMPER', on: false });
        log('Skimmer removed', 'Card reader inspected and cleared; the ATM returns to service.', 'ok');
      }
    },
    [dispatch, log, rigRef],
  );

  const setPinhole = useCallback(
    (on) => {
      setAttack((a) => ({ ...a, pinhole: on }));
      rigRef.current?.setPinhole(on);
      if (on) {
        log(
          'Pinhole camera planted',
          'A camera bar under the screen aims at the keypad. Defences: the privacy shield blocks its view, and even a filmed PIN is useless without the card, because the chip can’t be cloned.',
          'warn',
        );
      }
    },
    [log, rigRef],
  );

  const replayAttack = useCallback(async () => {
    const s = svc.current;
    const req = lastRequest.current;
    if (!s) return;
    if (!req) {
      log('Nothing captured yet', 'Make a withdrawal first, so there is an authorisation request to replay.', 'info');
      return;
    }
    const replay = await s.host.authorize(req);
    log('Replayed a captured request', `Same ARQC, same counter (ATC ${req.atc}). Host: ${replay.reason}. Counters only go up, so a recording can’t be reused.`, 'secure');
    const forged = await s.host.authorize({ ...req, atc: req.atc + 1000, amountCents: 99_900 });
    log('Forged the amount and counter', `Bumped the ATC and asked for ${formatMoney(99_900)} with the old cryptogram. Host: ${forged.reason}. Only the card key can produce a valid MAC.`, 'secure');
  }, [log]);

  const waitFor = (pred, ms = 8000) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const t = setInterval(() => {
        if (pred(stateRef.current) || Date.now() - t0 > ms) {
          clearInterval(t);
          resolve(stateRef.current);
        }
      }, 100);
    });
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  const bruteForce = useCallback(async () => {
    const guesses = ['0000', '1111', '2580', '9999', '1212'];
    log('Brute-force attempt started', 'Typing common PINs on a stolen card.', 'warn');
    if (stateRef.current.screen === S.IDLE) insertCard('chip');
    await waitFor((st) => st.screen === S.LANGUAGE || st.screen === S.CARD_BLOCKED || st.screen === S.OUT_OF_SERVICE);
    if (stateRef.current.screen === S.LANGUAGE) chooseOption('en');
    for (const guess of guesses) {
      const st = await waitFor((x) => x.screen === S.PIN || x.screen === S.PIN_ERROR || x.screen === S.RETAINED || x.screen === S.IDLE, 9000);
      if (st.screen === S.PIN_ERROR) {
        pressKey('enter');
        await waitFor((x) => x.screen === S.PIN);
      } else if (st.screen !== S.PIN) break;
      for (const d of guess) {
        pressKey(d);
        await pause(220);
      }
      pressKey('enter');
      await waitFor((x) => x.screen !== S.VERIFYING && x.screen !== S.PIN);
      if (stateRef.current.screen === S.RETAINED) break;
    }
    if (stateRef.current.screen === S.RETAINED || svc.current?.host.snapshot.blocked) {
      log('Brute force stopped', 'Three wrong PINs: the card is retained and blocked at the bank. The counter lives on the host, so re-inserting the card doesn’t reset it.', 'secure');
    }
  }, [chooseOption, insertCard, log, pressKey]);

  const unblockCard = useCallback(() => {
    svc.current?.host.unblock();
    log('Card unblocked', 'The bank reset the PIN counter after verifying the customer by phone.', 'ok');
  }, [log]);

  const tamperJournal = useCallback(async () => {
    const s = svc.current;
    if (!s || s.journal.entries.length < 2) return;
    const victim = s.journal.entries[Math.max(1, s.journal.entries.length - 3)];
    s.journal.tamper(victim.seq, victim.detail + ' (edited)');
    log('Journal entry edited', `An insider changed entry #${victim.seq} without access to re-hash the chain.`, 'warn');
  }, [log]);

  const verifyJournal = useCallback(async () => {
    const r = await svc.current?.journal.verify();
    if (!r) return null;
    log(r.ok ? 'Journal chain verified' : `Journal broken at entry #${r.brokenAt}`,
      r.ok ? 'Every SHA-256 link matches.' : 'The stored hash no longer matches the entry contents, so the edit is evident.',
      r.ok ? 'ok' : 'warn');
    return r;
  }, [log]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return {
    ready: !!services,
    state,
    model,
    trace,
    journal,
    attack,
    cassettes,
    pressKey,
    pressSlot,
    chooseOption,
    insertCard,
    takeCard,
    takeCash,
    takeReceipt,
    handleSceneClick,
    setSkimmer,
    setPinhole,
    replayAttack,
    bruteForce,
    unblockCard,
    tamperJournal,
    verifyJournal,
    reset,
    clearTrace: () => setTrace([]),
  };
}
