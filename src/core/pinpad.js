import { encryptPinBlock, isWeakPin, pinBlockIso0 } from './security.js';

// Encrypting PIN Pad (EPP). Digits are buffered inside this closure and leave it only as an
// encrypted ISO 9564 PIN block, so the rest of the app (state machine, UI, logs) only ever
// knows how many digits were typed, never which ones.
export function createPinPad(zoneKey, { length = 4 } = {}) {
  let buffer = '';
  let stash = '';

  return {
    get length() {
      return buffer.length;
    },
    press(digit) {
      if (/^\d$/.test(digit) && buffer.length < length) buffer += digit;
      return buffer.length;
    },
    backspace() {
      buffer = buffer.slice(0, -1);
      return buffer.length;
    },
    clear() {
      buffer = '';
    },
    clearAll() {
      buffer = '';
      stash = '';
    },
    isWeak() {
      return isWeakPin(buffer);
    },
    // Keep the first entry of a new PIN so the second entry can be compared inside the pad.
    stash() {
      stash = buffer;
      buffer = '';
    },
    matchesStash() {
      return stash.length === length && buffer === stash;
    },
    async encrypt(pan) {
      const block = pinBlockIso0(buffer, pan);
      const result = await encryptPinBlock(zoneKey, block);
      buffer = '';
      stash = '';
      return result;
    },
  };
}
