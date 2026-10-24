import { useState } from 'react';

function Attack({ title, children, action }) {
  return (
    <section className="attack">
      <div className="attack-head">
        <h3>{title}</h3>
        {action}
      </div>
      <p>{children}</p>
    </section>
  );
}

export default function AttackLab({ atm }) {
  const [busy, setBusy] = useState(false);
  const run = (fn) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="attack-lab">
      <div className="panel-head">
        <div>
          <h2>Attack lab</h2>
          <p className="muted">Stage real-world ATM attacks and watch the defences respond. Results land in the Security tab.</p>
        </div>
      </div>

      <Attack
        title="Card skimmer"
        action={
          <label className="switch">
            <input type="checkbox" checked={atm.attack.skimmer} onChange={(e) => atm.setSkimmer(e.target.checked)} />
            <span>{atm.attack.skimmer ? 'Attached' : 'Attach'}</span>
          </label>
        }
      >
        Glue a fake bezel over the card slot. The anti-skimming sensor should take the ATM out of service.
      </Attack>

      <Attack
        title="Pinhole camera"
        action={
          <label className="switch">
            <input type="checkbox" checked={atm.attack.pinhole} onChange={(e) => atm.setPinhole(e.target.checked)} />
            <span>{atm.attack.pinhole ? 'Planted' : 'Plant'}</span>
          </label>
        }
      >
        Hide a camera bar under the screen, aimed at the keypad. See why the privacy shield and the chip make this a weak attack.
      </Attack>

      <Attack
        title="Brute-force the PIN"
        action={
          <button className="btn danger small" disabled={busy || atm.attack.skimmer} onClick={run(atm.bruteForce)}>
            Run
          </button>
        }
      >
        A stolen card, five common PINs. The bank should retain and block the card after three misses.
      </Attack>

      <Attack
        title="Replay a transaction"
        action={
          <button className="btn danger small" disabled={busy} onClick={run(atm.replayAttack)}>
            Replay
          </button>
        }
      >
        Resend the last captured authorisation, then try it with a bigger amount. Make a withdrawal first.
      </Attack>

      <Attack
        title="Edit the journal"
        action={
          <button className="btn danger small" disabled={busy} onClick={run(async () => {
            await atm.tamperJournal();
            await atm.verifyJournal();
          })}>
            Tamper
          </button>
        }
      >
        Change a past journal entry the way an insider might, then verify the hash chain.
      </Attack>

      <div className="lab-reset">
        <button className="btn ghost small" onClick={atm.unblockCard}>
          Unblock test card
        </button>
        <button className="btn ghost small" onClick={atm.reset}>
          Reset session
        </button>
      </div>
    </div>
  );
}
