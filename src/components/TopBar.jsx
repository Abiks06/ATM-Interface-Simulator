const MODES = [
  { id: 'tour', label: 'Walkthrough' },
  { id: 'use', label: 'Use the ATM' },
  { id: 'attack', label: 'Attack lab' },
];

export default function TopBar({ mode, onMode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 21 7v10l-9 5-9-5V7z" />
        </svg>
        <span className="brand-name">Secure ATM</span>
        <span className="brand-tag">v2</span>
      </div>
      <nav className="modes" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'mode active' : 'mode'} aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className="test-card" title="Test card for the simulator">
        Test PIN <kbd>4826</kbd>
      </div>
    </header>
  );
}
