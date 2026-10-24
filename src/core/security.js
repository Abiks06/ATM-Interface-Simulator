// Cryptographic building blocks for the simulator, built on the Web Crypto API.
// They mirror how real ATMs protect a PIN and a transaction, at a teaching scale:
//   - ISO 9564 format 0 PIN blocks, encrypted inside the PIN pad (EPP)
//   - PBKDF2 hashing of the PIN on the bank side, compared in constant time
//   - an EMV-style application cryptogram (ARQC) bound to amount + counter

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();

export const PBKDF2_ITERATIONS = 100_000;

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function randomHex(byteLength) {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

// Constant-time comparison so a timing side channel can't reveal how many characters matched.
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const WEAK_PINS = new Set([
  '1234', '4321', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1212', '1122', '1313', '2000', '2001', '1004', '1010', '6969', '2580', '0852', '1357', '2468',
]);

// Rejects PINs that are trivially guessable: blacklisted, all one digit, or a straight run.
export function isWeakPin(pin) {
  if (!/^\d{4}$/.test(pin)) return true;
  if (WEAK_PINS.has(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = [1, 2, 3].map((i) => (Number(pin[i]) - Number(pin[i - 1]) + 10) % 10);
  return steps.every((s) => s === 1) || steps.every((s) => s === 9);
}

// ISO 9564-1 format 0: (0 | len | PIN | F padding) XOR (0000 | 12 rightmost PAN digits excl. check digit)
export function pinBlockIso0(pin, pan) {
  const pinField = ('0' + pin.length.toString(16) + pin).padEnd(16, 'F');
  const digits = pan.replace(/\D/g, '');
  const panField = '0000' + digits.slice(-13, -1);
  const block = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    block[i] = parseInt(pinField.substr(i * 2, 2), 16) ^ parseInt(panField.substr(i * 2, 2), 16);
  }
  return block;
}

export function parsePinBlockIso0(block, pan) {
  const digits = pan.replace(/\D/g, '');
  const panField = '0000' + digits.slice(-13, -1);
  let pinField = '';
  for (let i = 0; i < 8; i++) {
    pinField += (block[i] ^ parseInt(panField.substr(i * 2, 2), 16)).toString(16).padStart(2, '0');
  }
  const length = parseInt(pinField[1], 16);
  return pinField.slice(2, 2 + length);
}

// The "zone key" shared by the PIN pad and the bank host. Non-extractable: the app can use it
// but can never read its bytes.
export function generateZoneKey() {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptPinBlock(key, block) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, block));
  return { iv: toHex(iv), ciphertext: toHex(ct) };
}

export async function decryptPinBlock(key, { iv, ciphertext }) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromHex(iv) }, key, fromHex(ciphertext));
  return new Uint8Array(pt);
}

export async function hashPin(pin, saltHex, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    base,
    256,
  );
  return toHex(new Uint8Array(bits));
}

// Per-card secret personalised onto the chip and known to the issuer.
export function generateCardKey() {
  return subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export function cryptogramInput({ pan, amountCents, atc, un }) {
  return `${pan.replace(/\D/g, '')}|${amountCents}|${atc}|${un}`;
}

// Simplified ARQC: HMAC-SHA256 over PAN, amount, transaction counter and the terminal's
// unpredictable number, truncated to 8 bytes like a real application cryptogram.
export async function generateArqc(cardKey, fields) {
  const mac = await subtle.sign('HMAC', cardKey, encoder.encode(cryptogramInput(fields)));
  return toHex(new Uint8Array(mac).slice(0, 8));
}

export async function sha256Hex(text) {
  return toHex(new Uint8Array(await subtle.digest('SHA-256', encoder.encode(text))));
}
