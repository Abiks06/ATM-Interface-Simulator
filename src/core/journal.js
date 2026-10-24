import { sha256Hex } from './security.js';

export const GENESIS = '0'.repeat(64);

const digestOf = (prev, e) => sha256Hex(`${prev}|${e.seq}|${e.at}|${e.kind}|${e.detail}`);

// Electronic journal with a SHA-256 hash chain: every entry commits to the one before it,
// so editing or deleting any past entry breaks every hash after it.
export function createJournal() {
  let entries = [];
  let tail = Promise.resolve();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(entries));

  return {
    get entries() {
      return entries;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    append(kind, detail = '') {
      tail = tail.then(async () => {
        const prev = entries.length ? entries[entries.length - 1].hash : GENESIS;
        const entry = { seq: entries.length + 1, at: new Date().toISOString(), kind, detail, prev };
        entry.hash = await digestOf(prev, entry);
        entries = [...entries, entry];
        emit();
        return entry;
      });
      return tail;
    },
    async verify() {
      await tail;
      let prev = GENESIS;
      for (const e of entries) {
        if (e.prev !== prev || (await digestOf(prev, e)) !== e.hash) return { ok: false, brokenAt: e.seq };
        prev = e.hash;
      }
      return { ok: true, brokenAt: null };
    },
    // Demo only: rewrite an entry's text without re-hashing, as an attacker editing the log would.
    tamper(seq, detail) {
      entries = entries.map((e) => (e.seq === seq ? { ...e, detail } : e));
      emit();
    },
  };
}
