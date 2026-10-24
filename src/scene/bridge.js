// Client for the postMessage bridge that lives in the Spline scene's HTML layer.
// The scene is embedded from its public URL (what the Spline free plan allows); the bridge
// relays spline.* calls, camera moves and tweens in, and object clicks and key presses out.

export const SCENE_URL = 'https://my.spline.design/untitled-fi7QL4QNs4vZrFF10dTnEn52/';
export const SCENE_ORIGIN = new URL(SCENE_URL).origin;
const NS = 'secure-atm/v1';

export function createBridge(iframe) {
  let nextId = 1;
  let isReady = false;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  const pending = new Map();
  const listeners = new Map();

  const emit = (type, payload) => (listeners.get(type) || []).forEach((fn) => fn(payload));

  const post = (msg) => {
    const win = iframe.contentWindow;
    if (win) win.postMessage({ ...msg, ns: NS }, SCENE_ORIGIN);
  };

  const onMessage = (ev) => {
    if (ev.origin !== SCENE_ORIGIN || ev.source !== iframe.contentWindow) return;
    const m = ev.data;
    if (!m || m.ns !== NS) return;
    if (m.type === 'ready' && !isReady) {
      isReady = true;
      resolveReady();
      emit('ready');
    } else if (m.type === 'result' || m.type === 'error' || m.type === 'done') {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.type === 'error') p.reject(new Error(m.error));
        else p.resolve(m.result ?? null);
      }
    } else if (m.type === 'event') {
      emit('event', m);
    } else if (m.type === 'key') {
      emit('key', m.key);
    }
  };
  window.addEventListener('message', onMessage);

  // The scene announces itself once; ping until it does in case we attached late.
  const pinger = setInterval(() => (isReady ? clearInterval(pinger) : post({ op: 'ping' })), 500);

  function request(msg, timeoutMs = 6000) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`bridge timeout: ${msg.op} ${msg.method || msg.name || ''}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      post({ ...msg, id });
    });
  }

  return {
    ready,
    get isReady() {
      return isReady;
    },
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
      return () => listeners.set(type, listeners.get(type).filter((f) => f !== fn));
    },
    call: (method, ...args) => request({ op: 'call', method, args }),
    // Fire-and-forget object update; most per-frame writes don't need a reply.
    update: (name, props) => post({ op: 'call', id: 0, method: 'updateObject', args: [name, props] }),
    tween: (name, to, ms = 600, ease = 'inOut') => request({ op: 'tween', name, to, ms, ease }, ms + 4000),
    look: (position, target, ms = 1200, ease = 'inOut') =>
      request({ op: 'look', position, target, ms, ease }, ms + 4000).catch(() => {}),
    destroy() {
      clearInterval(pinger);
      window.removeEventListener('message', onMessage);
      pending.forEach((p) => clearTimeout(p.timer));
      pending.clear();
    },
  };
}
