# v2 overhaul: research and design notes

Why the simulator was rebuilt, what changed, and what's still open.

## What v1 got wrong

v1 was a graphics coursework project, so its focus was rendering. As an ATM security simulator it had real gaps:

| Problem in v1 | Effect | v2 fix |
| --- | --- | --- |
| PIN held and compared in plain text; the "hash" was a 32-bit string hash for display | The PIN sat in app state and UI data | PIN digits stay in the PIN pad module and leave only as an encrypted ISO 9564 block; the bank compares a salted PBKDF2 hash in constant time |
| PIN retry counter reset with each session | Unlimited guesses by re-inserting the card | Counter kept on the bank side; three misses block the card |
| Preset withdrawals didn't check the balance | Balance could go negative | Bank checks available funds (balance minus holds) and a daily limit |
| Money stored as floating-point dollars | Rounding errors | Integer cents throughout |
| Un-cancelled `setTimeout` chains in the state machine | Late timers could jump the session to a stale screen | Pure `step()` function; timers carry a sequence number and stale ones are dropped |
| `CARD_LOCKED` only reset after another key press | Machine could hang on the lock screen | Every waiting screen has its own timer |
| Debit before dispensing | Customer charged even if the cash wasn't taken | Hold first, settle when the cash is taken, reverse otherwise |
| Language selection did nothing | Cosmetic only | English, French and Spanish screens |
| Cohen-Sutherland "clipping" was a pixel filter | Report claimed more than the code did | Not carried over (v1 is preserved at the `v1-cs3231` tag) |

## Research: how real ATMs defend themselves

Each item maps to something visible in the walkthrough or attack lab.

- **EMV chip cryptograms.** For every online transaction the chip computes an Application Request Cryptogram (ARQC) from a card-unique key and transaction data, including the Application Transaction Counter. Copied magstripe or chip data can't produce a valid next cryptogram. *Simulated with HMAC-SHA256; real cards use 3DES/AES MACs and issuer-derived keys.*
- **Encrypting PIN Pads (EPPs).** Certified under PCI PTS: the PIN is formatted into an ISO 9564 block and encrypted inside the keypad, and opening the casing erases its keys. *Simulated: the PIN pad module and a non-extractable Web Crypto key. Key management such as DUKPT and TR-31 is out of scope.*
- **Anti-skimming.** Modern card readers emit an electromagnetic field and detect foreign objects on the bezel. The lit throat also makes overlays easier to spot. *Attack lab: attaching the skimmer takes the ATM out of service.*
- **Privacy design.** A keypad shield, a rear-view mirror strip and side keys aligned with screen options all reduce shoulder surfing.
- **Card before cash.** Returning the card first stops people walking away without it. Untaken cash is retracted and the transaction reversed.
- **Electronic journal.** Every event is logged for disputes and audit. *v2 hash-chains the log so tampering is evident.*

## The 3D walkthrough

- **Built in Spline** at true scale (1 m = 400 units), modelled on lobby units like the Diebold DN Series and NCR SelfServ: tilted glass fascia, sloped keypad shelf, card-reader column, safe-style lower cabinet.
- **Free-plan constraints.** No code export, no variables, a daily cap on MCP calls. The scene is embedded from its public URL and driven through a generic message bridge in the scene's HTML layer, so all behaviour lives in this repo and changes don't need Spline edits.
- **Stable names for every moving or clickable part,** with click sensors on keys, side keys, card, cash and receipt.

## Ideas not built yet

- Cardless withdrawal with a one-time code or QR, using WebAuthn on the phone side.
- A deposit module with note validation.
- A visual for ISO 8583 messages between the ATM and the bank.
- Accessibility mode: audio guidance through the headphone jack the model already has.
- Persisting the journal and bank state with IndexedDB across reloads.
