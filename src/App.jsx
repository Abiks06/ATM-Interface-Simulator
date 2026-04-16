import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ATMScene from './components/ATMScene.jsx';
import { ATMStateMachine, ATM_STATES } from './state/ATMStateMachine.js';
import './index.css';

function App() {
  const [atmData, setAtmData] = useState(null);
  const [atmState, setAtmState] = useState(ATM_STATES.IDLE);
  const [cardProgress, setCardProgress] = useState(0);
  const [dispensingProgress, setDispensingProgress] = useState(0);

  const stateMachineRef = useRef(null);

  useEffect(() => {
    const sm = new ATMStateMachine((data) => {
      setAtmData({ ...data });
      setAtmState(data.state);
    });
    stateMachineRef.current = sm;
    setAtmData(sm.getData());
  }, []);

  // Hardware animations
  useEffect(() => {
    let interval;
    if (atmState === ATM_STATES.CARD_INSERTING) {
      let p = 0;
      interval = setInterval(() => { p += 0.05; setCardProgress(Math.min(p, 1)); if (p >= 1) clearInterval(interval); }, 50);
    } else if (atmState === ATM_STATES.CARD_EJECTING) {
      let p = 1;
      interval = setInterval(() => { p -= 0.05; setCardProgress(Math.max(p, 0)); if (p <= 0) clearInterval(interval); }, 50);
    } else if (atmState === ATM_STATES.DISPENSING) {
      let p = 0;
      interval = setInterval(() => { p += 0.025; setDispensingProgress(Math.min(p, 1)); if (p >= 1) clearInterval(interval); }, 40);
    } else if (atmState === ATM_STATES.IDLE || atmState === ATM_STATES.THANK_YOU) {
      setDispensingProgress(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [atmState]);

  const handleDigit = useCallback((digit) => {
    const sm = stateMachineRef.current;
    if (!sm) return;
    const st = sm.getState();

    // PIN entry states
    if (st === ATM_STATES.PIN_ENTRY || st === ATM_STATES.CHANGE_PIN ||
        st === ATM_STATES.CHANGE_PIN_NEW || st === ATM_STATES.CHANGE_PIN_CONFIRM ||
        st === ATM_STATES.WITHDRAWAL_CUSTOM) {
      sm.addPinDigit(digit);
      return;
    }

    // Language selection
    if (st === ATM_STATES.LANGUAGE_SELECT) {
      sm.dispatch('SELECT_LANGUAGE', { lang: digit === '1' ? 'ENGLISH' : digit === '2' ? 'FRANCAIS' : digit === '3' ? 'ESPANOL' : 'DEUTSCH' });
      return;
    }

    // Account selection
    if (st === ATM_STATES.ACCOUNT_SELECT) {
      if (digit === '1') sm.dispatch('SELECT_SAVINGS');
      else if (digit === '2') sm.dispatch('SELECT_CURRENT');
      return;
    }

    // Main menu
    if (st === ATM_STATES.MENU) {
      if (digit === '1') sm.dispatch('SELECT_WITHDRAWAL');
      else if (digit === '2') sm.dispatch('SELECT_BALANCE');
      else if (digit === '3') sm.dispatch('SELECT_MINI_STATEMENT');
      else if (digit === '4') sm.dispatch('SELECT_CHANGE_PIN');
      return;
    }

    // Withdrawal preset
    if (st === ATM_STATES.WITHDRAWAL_PRESET) {
      const amounts = { '1': 20, '2': 50, '3': 100, '4': 200, '5': 500 };
      if (amounts[digit]) sm.dispatch('SELECT_AMOUNT', { amount: amounts[digit] });
      else if (digit === '6') sm.dispatch('CUSTOM_AMOUNT');
      return;
    }

    // Withdrawal confirm
    if (st === ATM_STATES.WITHDRAWAL_CONFIRM) {
      if (digit === '1') sm.dispatch('CONFIRM');
      else if (digit === '2') sm.dispatch('BACK');
      return;
    }

    // Receipt prompt
    if (st === ATM_STATES.RECEIPT_PROMPT) {
      if (digit === '1') sm.dispatch('PRINT_RECEIPT');
      else if (digit === '2') sm.dispatch('NO_RECEIPT');
      return;
    }

    // Another transaction
    if (st === ATM_STATES.ANOTHER_TRANSACTION) {
      if (digit === '1') sm.dispatch('YES');
      else if (digit === '2') sm.dispatch('NO');
      return;
    }

    // Timeout warning
    if (st === ATM_STATES.SESSION_TIMEOUT_WARNING) {
      sm.dispatch('CONTINUE_SESSION');
      return;
    }
  }, []);
  
  const handleEnter = useCallback(() => {
    const sm = stateMachineRef.current;
    if (!sm) return;
    const st = sm.getState();
    if (st === ATM_STATES.IDLE) sm.dispatch('INSERT_CARD');
    else if (st === ATM_STATES.LANGUAGE_SELECT) sm.dispatch('SELECT_LANGUAGE', { lang: 'ENGLISH' });
    else if (st === ATM_STATES.PIN_ENTRY && sm.pin.length === 4) sm.dispatch('SUBMIT_PIN');
    else if (st === ATM_STATES.AUTH_FAILED) sm.dispatch('RETRY');
    else if (st === ATM_STATES.ACCOUNT_SELECT) sm.dispatch('SELECT_SAVINGS');
    else if (st === ATM_STATES.CHANGE_PIN && sm.pin.length === 4) sm.dispatch('SUBMIT_OLD_PIN');
    else if (st === ATM_STATES.CHANGE_PIN_NEW && sm.newPin.length === 4) sm.dispatch('SUBMIT_NEW_PIN');
    else if (st === ATM_STATES.CHANGE_PIN_CONFIRM && sm.confirmPin.length === 4) sm.dispatch('CONFIRM_NEW_PIN');
    else if (st === ATM_STATES.WITHDRAWAL_CUSTOM) sm.dispatch('CONFIRM_CUSTOM');
    else if (st === ATM_STATES.WITHDRAWAL_CONFIRM) sm.dispatch('CONFIRM');
    else if (st === ATM_STATES.RECEIPT_PROMPT) sm.dispatch('PRINT_RECEIPT');
    else if (st === ATM_STATES.ANOTHER_TRANSACTION) sm.dispatch('YES');
    else if (st === ATM_STATES.SUCCESS) sm.dispatch('FINISH');
    else if (st === ATM_STATES.SESSION_TIMEOUT_WARNING) sm.dispatch('CONTINUE_SESSION');
  }, []);
  
  const handleClear = useCallback(() => stateMachineRef.current?.clearPin(), []);
  const handleCancel = useCallback(() => {
    const sm = stateMachineRef.current;
    if (!sm) return;
    const st = sm.getState();
    if (st === ATM_STATES.BALANCE || st === ATM_STATES.MINI_STATEMENT) sm.dispatch('BACK');
    else if (st === ATM_STATES.WITHDRAWAL_PRESET) sm.dispatch('BACK');
    else if (st === ATM_STATES.WITHDRAWAL_CUSTOM) sm.dispatch('BACK');
    else if (st === ATM_STATES.WITHDRAWAL_CONFIRM) sm.dispatch('BACK');
    else if (st === ATM_STATES.CHANGE_PIN) sm.dispatch('BACK');
    else if (st === ATM_STATES.CHANGE_PIN_NEW) sm.dispatch('BACK');
    else sm.dispatch('CANCEL');
  }, []);

  const handleInsertCard = useCallback(() => {
    if (stateMachineRef.current?.getState() === ATM_STATES.IDLE) stateMachineRef.current.dispatch('INSERT_CARD');
  }, []);

  // Determine contextual instruction
  const getInstruction = () => {
    switch (atmState) {
      case ATM_STATES.IDLE: return 'Insert your card to begin a secure banking session.';
      case ATM_STATES.PIN_ENTRY: return 'Enter your 4-digit PIN using the keypad. PIN: 1234';
      case ATM_STATES.MENU: return 'Press 1-4 on the keypad to select an option.';
      case ATM_STATES.LANGUAGE_SELECT: return 'Press 1-4 to select your language.';
      case ATM_STATES.ACCOUNT_SELECT: return 'Press 1 for Savings, 2 for Current.';
      case ATM_STATES.WITHDRAWAL_PRESET: return 'Press 1-5 for preset amounts, 6 for custom.';
      case ATM_STATES.WITHDRAWAL_CUSTOM: return 'Enter amount using keypad. # to confirm.';
      case ATM_STATES.WITHDRAWAL_CONFIRM: return 'Press 1 to confirm, 2 to go back.';
      case ATM_STATES.RECEIPT_PROMPT: return 'Press 1 for receipt, 2 to skip.';
      case ATM_STATES.ANOTHER_TRANSACTION: return 'Press 1 for another transaction, 2 to exit.';
      default: return 'Use the 3D keypad or side panel to interact.';
    }
  };

  return (
    <div className="app-container">
      <div className="scene-container">
        <Canvas shadows camera={{ position: [0, 1.5, 6], fov: 50 }} onCreated={({ gl }) => gl.setClearColor('#050510')}>
          <ATMScene 
            atmState={atmState} 
            atmData={atmData} 
            onDigit={handleDigit} onEnter={handleEnter} onClear={handleClear} onCancel={handleCancel}
            cardProgress={cardProgress} 
            dispensingProgress={dispensingProgress}
          />
          <OrbitControls minDistance={4} maxDistance={10} minPolarAngle={Math.PI/6} maxPolarAngle={Math.PI/1.5} />
        </Canvas>
      </div>

      <div className="floating-panel">
        <div className="panel-header">
          <h2>Secure ATM</h2>
          <span className={`status-badge ${atmState !== 'IDLE' ? 'active' : ''}`}>{atmState.replace(/_/g, ' ')}</span>
        </div>
        
        <div className="panel-content">
          <p className="instruction">{getInstruction()}</p>

          <div className="actions">
            {atmState === ATM_STATES.IDLE && (
              <button className="glass-btn primary" onClick={handleInsertCard}>💳 Insert Test Card</button>
            )}
            {atmState === ATM_STATES.MENU && (
              <div className="menu-sim">
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('SELECT_WITHDRAWAL')}>💵 Withdrawal</button>
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('SELECT_BALANCE')}>💰 Balance</button>
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('SELECT_MINI_STATEMENT')}>📋 Statement</button>
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('SELECT_CHANGE_PIN')}>🔒 Change PIN</button>
              </div>
            )}
            {atmState === ATM_STATES.WITHDRAWAL_PRESET && (
              <div className="menu-sim">
                {[20,50,100,200,500].map(a => (
                  <button key={a} className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('SELECT_AMOUNT', { amount: a })}>${a}</button>
                ))}
              </div>
            )}
            {atmState === ATM_STATES.WITHDRAWAL_CONFIRM && (
              <button className="glass-btn confirm" onClick={() => stateMachineRef.current?.dispatch('CONFIRM')}>✅ Confirm ${atmData?.withdrawalAmount}</button>
            )}
            {(atmState === ATM_STATES.BALANCE || atmState === ATM_STATES.MINI_STATEMENT) && (
              <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('BACK')}>← Back to Menu</button>
            )}
            {atmState === ATM_STATES.ANOTHER_TRANSACTION && (
              <div className="menu-sim">
                <button className="glass-btn primary" onClick={() => stateMachineRef.current?.dispatch('YES')}>Yes, Continue</button>
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('NO')}>No, Exit</button>
              </div>
            )}
            {atmState === ATM_STATES.RECEIPT_PROMPT && (
              <div className="menu-sim">
                <button className="glass-btn primary" onClick={() => stateMachineRef.current?.dispatch('PRINT_RECEIPT')}>🖨️ Print Receipt</button>
                <button className="glass-btn secondary" onClick={() => stateMachineRef.current?.dispatch('NO_RECEIPT')}>Skip</button>
              </div>
            )}
          </div>
        </div>

        <div className="panel-footer">
          <p>* = Clear | # = Enter | OK = Submit | X = Cancel</p>
          <p>Test PIN: 1234</p>
        </div>
      </div>
    </div>
  );
}

export default App;
