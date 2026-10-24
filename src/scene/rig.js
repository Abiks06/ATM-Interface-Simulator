import { SHOTS } from './shots.js';

// High-level choreography for the ATM hardware in the Spline scene: card, cash, receipt,
// keys, LEDs, the screen and the camera. Object names match the scene built in Spline.

const KEY_GROUPS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Cancel', 'Clear', 'Enter', 'Blank L', 'Blank R', 'Blank F'];
const FDKS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
const MOVING = ['Card', 'Cash Stack', 'Cash Shutter', 'Receipt', ...KEY_GROUPS.map((k) => `Key ${k}`), ...FDKS.map((f) => `FDK ${f}`)];

// Frames and alignment are re-sent with every text change: Spline shrinks a text frame to
// its first contents, which would make longer strings wrap. Align codes: 0 left, 2 right, 3 centre
// (horizontal); 2 middle (vertical).
const SCREEN_TEXT = {
  title: { name: 'Screen Title', size: 9, width: 140, height: 12, align: 3 },
  line0: { name: 'Screen Line 1', size: 7, width: 140, height: 10, align: 3 },
  line1: { name: 'Screen Line 2', size: 6, width: 140, height: 9, align: 3 },
  line2: { name: 'Screen Line 3', size: 6, width: 140, height: 9, align: 3 },
  footer: { name: 'Screen Footer', size: 4.5, width: 140, height: 7, align: 3 },
  L2: { name: 'Screen Opt L2', size: 6, width: 66, height: 9, align: 0 },
  L3: { name: 'Screen Opt L3', size: 6, width: 66, height: 9, align: 0 },
  L4: { name: 'Screen Opt L4', size: 6, width: 66, height: 9, align: 0 },
  R2: { name: 'Screen Opt R2', size: 6, width: 66, height: 9, align: 2 },
  R3: { name: 'Screen Opt R3', size: 6, width: 66, height: 9, align: 2 },
  R4: { name: 'Screen Opt R4', size: 6, width: 66, height: 9, align: 2 },
};

const TONES = { normal: '#0b2238', busy: '#0b2238', alert: '#3b1016', success: '#0d3324' };
const COLORS = { teal: '#13e0a0', amber: '#ff9a1f', green: '#2bd46b', red: '#ff3344', off: '#2a2f36' };

const add = (a, b) => ({ x: a.x + (b.x || 0), y: a.y + (b.y || 0), z: a.z + (b.z || 0) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createRig(bridge) {
  const base = {};
  const shown = {};
  let blinkTimer = null;
  let cameraEnabled = true;

  async function init() {
    await bridge.ready;
    const snaps = await Promise.all(MOVING.map((n) => bridge.call('findObjectByName', n).catch(() => null)));
    snaps.forEach((s, i) => {
      if (s) base[MOVING[i]] = { position: s.position, rotation: s.rotation };
    });
  }

  const pos = (name, offset = {}) => add(base[name]?.position || { x: 0, y: 0, z: 0 }, offset);
  const move = (name, offset, ms, ease) => (base[name] ? bridge.tween(name, { position: pos(name, offset) }, ms, ease) : Promise.resolve());
  const place = (name, offset = {}, extra = {}) => base[name] && bridge.update(name, { position: pos(name, offset), ...extra });
  const color = (name, value) => bridge.update(name, { material: { color: value } });

  function blinkLed(on) {
    clearInterval(blinkTimer);
    blinkTimer = null;
    if (!on) return;
    let lit = false;
    blinkTimer = setInterval(() => {
      lit = !lit;
      color('Card LED', lit ? COLORS.green : COLORS.off);
    }, 450);
  }

  const rig = {
    init,
    // `shift` slides the camera sideways (as a fraction of its distance) so the subject sits
    // off-centre, e.g. beside an overlay panel. Positive values move the subject to the right.
    look(shot, ms = 1400, { shift = 0 } = {}) {
      const s = typeof shot === 'string' ? SHOTS[shot] : shot;
      if (!s || !cameraEnabled) return Promise.resolve();
      let { position, target } = s;
      if (shift) {
        const f = { x: target.x - position.x, z: target.z - position.z };
        const flat = Math.hypot(f.x, f.z) || 1;
        const dist = Math.hypot(f.x, target.y - position.y, f.z);
        const k = -shift * dist;
        const offset = { x: (-f.z / flat) * k, z: (f.x / flat) * k };
        position = add(position, offset);
        target = add(target, offset);
      }
      return bridge.look(position, target, ms);
    },
    setCameraEnabled(on) {
      cameraEnabled = on;
    },

    // --- card -----------------------------------------------------------------------------
    showCard() {
      place('Card', {}, { visible: true, rotation: base.Card?.rotation });
    },
    hideCard() {
      bridge.update('Card', { visible: false });
    },
    async insertCard() {
      blinkLed(false);
      color('Card LED', COLORS.green);
      place('Card', {}, { visible: true, rotation: base.Card?.rotation });
      await move('Card', { z: -54 }, 900, 'inOut');
    },
    async tapCard() {
      const tapPose = { position: pos('Card', { y: -36, z: -43 }), rotation: { x: 90, y: 0, z: 0 } };
      bridge.update('Card', { visible: true });
      await bridge.tween('Card', tapPose, 650, 'out');
      color('Card LED', COLORS.green);
      await wait(700);
      await bridge.tween('Card', { position: pos('Card'), rotation: base.Card?.rotation || { x: 0, y: 0, z: 0 } }, 650, 'inOut');
      rig.hideCard();
    },
    async ejectCard() {
      place('Card', { z: -54 }, { visible: true });
      await move('Card', { z: 0 }, 900, 'out');
      blinkLed(true);
    },
    async takeCard() {
      blinkLed(false);
      color('Card LED', COLORS.amber);
      await move('Card', { z: 70, y: 10 }, 500, 'inOut');
      rig.hideCard();
    },
    async retainCard() {
      blinkLed(false);
      color('Card LED', COLORS.red);
      await move('Card', { z: -110 }, 1200, 'inOut');
      rig.hideCard();
    },

    // --- cash -----------------------------------------------------------------------------
    resetCash() {
      place('Cash Stack', {}, { visible: true });
      place('Cash Shutter');
    },
    async presentCash() {
      rig.resetCash();
      await move('Cash Shutter', { z: -8 }, 300, 'out');
      await move('Cash Stack', { z: 60 }, 1300, 'out');
    },
    async takeCash() {
      await move('Cash Stack', { z: 150, y: 20 }, 600, 'inOut');
      bridge.update('Cash Stack', { visible: false });
      await move('Cash Shutter', {}, 300);
      rig.resetCash();
    },
    async retractCash() {
      await move('Cash Stack', {}, 1100, 'inOut');
      await move('Cash Shutter', {}, 300);
    },

    // --- receipt --------------------------------------------------------------------------
    resetReceipt() {
      place('Receipt', {}, { visible: true });
    },
    async printReceipt() {
      rig.resetReceipt();
      await move('Receipt', { z: 45 }, 1400, 'linear');
    },
    async takeReceipt() {
      await move('Receipt', { z: 110, y: 15 }, 450, 'inOut');
      bridge.update('Receipt', { visible: false });
      await wait(200);
      rig.resetReceipt();
    },

    // --- keys -----------------------------------------------------------------------------
    async pressKey(groupName) {
      if (!base[groupName]) return;
      await move(groupName, { z: -1.8 }, 60, 'out');
      await move(groupName, {}, 110, 'out');
    },

    // --- security hardware ---------------------------------------------------------------
    setSkimmer(on) {
      bridge.update('Skimmer', { visible: on });
    },
    setPinhole(on) {
      bridge.update('Pinhole Camera', { visible: on });
    },
    alarm(on) {
      color('Card Throat', on ? COLORS.red : COLORS.teal);
      color('Card LED', on ? COLORS.red : COLORS.amber);
    },
    awaitingCard(on) {
      blinkLed(on);
      if (!on) color('Card LED', COLORS.amber);
    },

    // --- screen ---------------------------------------------------------------------------
    renderScreen(model) {
      const values = { title: model.title, footer: model.footer };
      [0, 1, 2].forEach((i) => (values[`line${i}`] = model.lines[i] || ''));
      ['L2', 'L3', 'L4', 'R2', 'R3', 'R4'].forEach((slot) => {
        const o = model.options.find((x) => x.slot === slot);
        values[slot] = o ? (slot[0] === 'L' ? `‹ ${o.label}` : `${o.label} ›`) : '';
      });
      for (const [k, text] of Object.entries(values)) {
        const spec = SCREEN_TEXT[k];
        const value = text || ' ';
        if (shown[k] === value) continue;
        shown[k] = value;
        // Shrink long strings so they stay inside their frame instead of wrapping.
        const fontSize = Math.min(spec.size, spec.width / (Math.max(value.length, 1) * 0.56));
        bridge.update(spec.name, {
          geometry: {
            text: value,
            fontSize: Math.round(fontSize * 10) / 10,
            width: spec.width,
            height: spec.height,
            horizontalAlign: spec.align,
            verticalAlign: 2,
          },
        });
      }
      if (shown.tone !== model.tone) {
        shown.tone = model.tone;
        color('ATM Screen', TONES[model.tone] || TONES.normal);
      }
    },

    // Put every moving part back where the scene file has it.
    reset({ skimmer = false, pinhole = false } = {}) {
      blinkLed(false);
      rig.alarm(false);
      rig.showCard();
      rig.resetCash();
      rig.resetReceipt();
      rig.setSkimmer(skimmer);
      rig.setPinhole(pinhole);
    },
  };
  return rig;
}
