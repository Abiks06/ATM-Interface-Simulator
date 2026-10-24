// The guided 3D walkthrough: one chapter per layer of defence. Each chapter frames a part of
// the machine, puts something on the ATM screen and plays a short demo on the hardware.

const screen = (title, lines = [], tone = 'normal', footer = 'Shield your PIN  ·  Help 24/7') => ({
  title,
  lines,
  options: [],
  footer,
  tone,
});

export const CHAPTERS = [
  {
    id: 'machine',
    kicker: 'Overview',
    title: 'A machine built for a hostile street',
    body: 'An ATM stands in public around the clock, so its design assumes people will touch it, film it and try to tamper with it. This tour walks through each layer of defence, from the card slot to the bank’s ledger.',
    points: [
      'Physical: shields, sensors and a safe for the cash',
      'Cryptographic: the PIN and every transaction are sealed',
      'Procedural: limits, timeouts and an audit trail',
    ],
    shot: 'overview',
    screen: screen('Welcome to Secure Bank', ['Insert or tap your card', 'to begin']),
  },
  {
    id: 'chip',
    kicker: 'Card reader',
    title: 'The chip, not the stripe',
    body: 'The reader talks to the card’s EMV chip, which holds a secret key that never leaves it. For every withdrawal the chip signs the amount and a counter, producing a one-time cryptogram (ARQC) that the bank checks.',
    points: [
      'Copied card data can’t produce the next cryptogram',
      'The lit throat makes a glued-on overlay easy to spot',
      'An anti-skimming field detects foreign devices on the slot',
    ],
    shot: 'card',
    screen: screen('Reading your card', ['Please wait…'], 'busy'),
    async run(rig, alive) {
      rig.showCard();
      await rig.insertCard();
      if (!alive()) return;
      await new Promise((r) => setTimeout(r, 1400));
      if (!alive()) return;
      await rig.ejectCard();
    },
  },
  {
    id: 'nfc',
    kicker: 'Contactless',
    title: 'Tap instead of insert',
    body: 'Contactless uses the same chip and the same cryptogram, over a radio link that only works at a few centimetres. The card never leaves your hand, so there’s nothing to forget or have swallowed.',
    points: [
      'Range of about 4 cm, so it can’t be read from across a room',
      'Same one-time cryptogram as an inserted chip',
      'No card in the slot means a skimmer has nothing to read',
    ],
    shot: 'nfc',
    screen: screen('Hold your card', ['near the contactless symbol']),
    async run(rig) {
      rig.hideCard();
      await rig.tapCard();
    },
  },
  {
    id: 'epp',
    kicker: 'PIN pad',
    title: 'Your PIN is encrypted in the keypad',
    body: 'The keypad is an Encrypting PIN Pad (EPP). Each digit is kept inside it, formatted as an ISO 9564 PIN block, and encrypted before anything leaves the pad. The ATM’s own software only ever handles ciphertext.',
    points: [
      'PIN block = PIN XOR card number, then AES-encrypted',
      'The bank compares a salted PBKDF2 hash in constant time',
      'Real EPPs erase their keys if the casing is opened',
    ],
    shot: 'keypad',
    screen: screen('Enter your PIN', ['_  _  _  _', '', 'Press ENTER when done']),
    async run(rig, alive) {
      const dots = (n) => Array.from({ length: 4 }, (_, i) => (i < n ? '•' : '_')).join('  ');
      const keys = ['4', '8', '2', '6'];
      for (let i = 0; i < keys.length; i++) {
        await new Promise((r) => setTimeout(r, 450));
        if (!alive()) return;
        rig.pressKey(`Key ${keys[i]}`);
        rig.renderScreen(screen('Enter your PIN', [dots(i + 1), '', 'Press ENTER when done']));
      }
      await new Promise((r) => setTimeout(r, 450));
      if (!alive()) return;
      rig.pressKey('Key Enter');
      rig.renderScreen(screen('Verifying your PIN', ['Please wait…'], 'busy'));
    },
  },
  {
    id: 'privacy',
    kicker: 'Privacy',
    title: 'Designed against shoulder surfing',
    body: 'The cowl around the keypad blocks hidden cameras and onlookers, the mirror strip above the screen shows who is behind you, and the side keys line up with on-screen options so menus never need typing.',
    points: [
      'Privacy shield on three sides of the keypad',
      'Rear-view mirror strip above the display',
      'Sessions time out after 30 seconds of inactivity',
    ],
    shot: 'screen',
    screen: screen('Shield your PIN', ['Cover the keypad with your hand', 'Check the mirror for anyone behind you']),
  },
  {
    id: 'cash',
    kicker: 'Dispenser',
    title: 'Card first, then cash',
    body: 'Your card is returned before the notes come out, so it can’t be left behind. The bank only places a hold during the transaction; the money is debited when the presenter confirms you took the notes.',
    points: [
      'The fewest notes the cassettes allow, planned exactly',
      'Untaken cash is pulled back in and the hold reversed',
      'Daily withdrawal limit enforced by the bank',
    ],
    shot: 'cash',
    screen: screen('Please take your cash', ['$100.00'], 'success'),
    async run(rig, alive) {
      await rig.presentCash();
      if (!alive()) return;
      await new Promise((r) => setTimeout(r, 2200));
      if (!alive()) return;
      await rig.retractCash();
    },
  },
  {
    id: 'journal',
    kicker: 'Audit',
    title: 'A receipt for you, a journal for the bank',
    body: 'Every event, from card inserted to cash taken, is written to an electronic journal. Each entry includes the SHA-256 hash of the previous one, so editing or deleting any line breaks the chain from that point on.',
    points: [
      'Hash-chained, append-only event log',
      'Verification pinpoints the first altered entry',
      'Receipts never print the full card number',
    ],
    shot: 'receipt',
    screen: screen('Printing your receipt', ['Please wait…'], 'busy'),
    async run(rig, alive) {
      await rig.printReceipt();
      if (!alive()) return;
      await new Promise((r) => setTimeout(r, 1600));
      if (!alive()) return;
      await rig.takeReceipt();
    },
  },
  {
    id: 'attack',
    kicker: 'Attacks',
    title: 'When thieves try anyway',
    body: 'Here a skimmer has been glued over the card slot. The anti-skimming sensor notices, and the ATM takes itself out of service. In the attack lab you can also replay captured transactions and brute-force a PIN, and watch each one fail.',
    points: [
      'Skimmers trip the reader’s anti-skimming sensor',
      'Replayed or altered requests fail the bank’s checks',
      'Three wrong PINs: card retained and blocked at the bank',
    ],
    shot: 'attack',
    screen: screen('Temporarily out of service', ['Card reader tampering detected'], 'alert', ''),
    async run(rig) {
      rig.setSkimmer(true);
      rig.alarm(true);
    },
    leave(rig) {
      rig.setSkimmer(false);
      rig.alarm(false);
    },
  },
  {
    id: 'finale',
    kicker: 'Your turn',
    title: 'Try the machine yourself',
    body: 'Insert the test card, enter the PIN and take out some cash. The security inspector shows what each step encrypts, signs and logs as it happens.',
    points: ['Test card PIN: 4826', 'Click the 3D keys, or type on your keyboard', 'Digits 1-6 pick on-screen options'],
    shot: 'front',
    screen: screen('Welcome to Secure Bank', ['Insert or tap your card', 'to begin']),
    cta: true,
  },
];
