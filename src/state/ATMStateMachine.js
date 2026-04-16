// State machine for ATM

export const ATM_STATES = {
  IDLE: 'IDLE',
  CARD_INSERTING: 'CARD_INSERTING',
  CARD_READING: 'CARD_READING',
  LANGUAGE_SELECT: 'LANGUAGE_SELECT',
  PIN_ENTRY: 'PIN_ENTRY',
  AUTHENTICATING: 'AUTHENTICATING',
  AUTH_FAILED: 'AUTH_FAILED',
  CARD_LOCKED: 'CARD_LOCKED',
  ACCOUNT_SELECT: 'ACCOUNT_SELECT',
  MENU: 'MENU',
  BALANCE: 'BALANCE',
  WITHDRAWAL_PRESET: 'WITHDRAWAL_PRESET',
  WITHDRAWAL_CUSTOM: 'WITHDRAWAL_CUSTOM',
  WITHDRAWAL_CONFIRM: 'WITHDRAWAL_CONFIRM',
  MINI_STATEMENT: 'MINI_STATEMENT',
  CHANGE_PIN: 'CHANGE_PIN',
  CHANGE_PIN_NEW: 'CHANGE_PIN_NEW',
  CHANGE_PIN_CONFIRM: 'CHANGE_PIN_CONFIRM',
  PIN_CHANGED: 'PIN_CHANGED',
  PROCESSING: 'PROCESSING',
  DISPENSING: 'DISPENSING',
  RECEIPT_PROMPT: 'RECEIPT_PROMPT',
  PRINTING_RECEIPT: 'PRINTING_RECEIPT',
  SUCCESS: 'SUCCESS',
  ANOTHER_TRANSACTION: 'ANOTHER_TRANSACTION',
  SESSION_TIMEOUT_WARNING: 'SESSION_TIMEOUT_WARNING',
  CARD_EJECTING: 'CARD_EJECTING',
  THANK_YOU: 'THANK_YOU',
};

// Simulated transaction log
function generateTxId() {
  return 'TXN' + Date.now().toString(36).toUpperCase().slice(-8);
}

function getTimestamp() {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Simple hash for PIN display (simulates encryption)
function hashPin(pin) {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

export class ATMStateMachine {
  constructor(onUpdate) {
    this.state = ATM_STATES.IDLE;
    this.pin = '';
    this.newPin = '';
    this.confirmPin = '';
    this.correctPin = '1234';
    this.balance = 5240.50;
    this.cardholderName = 'JOHN A. DOE';
    this.accountNumber = '**** **** **** 4321';
    this.bankName = 'SECURE NATIONAL BANK';
    this.cardType = 'VISA DEBIT';
    this.selectedAccount = '';  // SAVINGS or CURRENT
    this.pinAttempts = 0;
    this.maxAttempts = 3;
    this.customAmount = '';
    this.withdrawalAmount = 0;
    this.sessionId = '';
    this.transactionId = '';
    this.language = 'ENGLISH';
    this.sessionStart = null;
    this.lastActivity = null;
    this.sessionTimeoutMs = 30000; // 30s timeout
    this.timeoutTimer = null;
    this.transactions = [
      { date: '10 Apr', desc: 'POS PURCHASE', amount: -45.00, bal: 5285.50 },
      { date: '09 Apr', desc: 'ATM WITHDRAWAL', amount: -200.00, bal: 5330.50 },
      { date: '08 Apr', desc: 'SALARY CREDIT', amount: 3200.00, bal: 5530.50 },
      { date: '07 Apr', desc: 'TRANSFER OUT', amount: -150.00, bal: 2330.50 },
      { date: '05 Apr', desc: 'ONLINE PURCHASE', amount: -89.99, bal: 2480.50 },
    ];
    this.onUpdate = onUpdate;
  }

  notify() {
    this.lastActivity = Date.now();
    if (this.onUpdate) {
      this.onUpdate(this.getData());
    }
  }

  getState() { return this.state; }

  getData() {
    return {
      state: this.state,
      pin: this.pin,
      newPin: this.newPin,
      confirmPin: this.confirmPin,
      balance: this.balance,
      cardholderName: this.cardholderName,
      accountNumber: this.accountNumber,
      bankName: this.bankName,
      cardType: this.cardType,
      selectedAccount: this.selectedAccount,
      pinAttempts: this.pinAttempts,
      remainingAttempts: this.maxAttempts - this.pinAttempts,
      customAmount: this.customAmount,
      withdrawalAmount: this.withdrawalAmount,
      sessionId: this.sessionId,
      transactionId: this.transactionId,
      language: this.language,
      timestamp: getTimestamp(),
      pinHash: hashPin(this.pin || '0000'),
      transactions: this.transactions,
      sessionDuration: this.sessionStart ? Math.floor((Date.now() - this.sessionStart) / 1000) : 0,
    };
  }

  startSessionTimer() {
    this.stopSessionTimer();
    this.sessionStart = Date.now();
    this.lastActivity = Date.now();
    this.timeoutTimer = setInterval(() => {
      if (this.state !== ATM_STATES.IDLE && this.state !== ATM_STATES.CARD_EJECTING &&
          this.state !== ATM_STATES.THANK_YOU) {
        const elapsed = Date.now() - this.lastActivity;
        if (elapsed > this.sessionTimeoutMs - 10000 && this.state !== ATM_STATES.SESSION_TIMEOUT_WARNING) {
          // Show warning 10s before timeout
          this.prevState = this.state;
          this.transition(ATM_STATES.SESSION_TIMEOUT_WARNING);
        }
        if (elapsed > this.sessionTimeoutMs) {
          // Force eject
          this.stopSessionTimer();
          this.transition(ATM_STATES.CARD_EJECTING);
          setTimeout(() => {
            this.resetSession();
            this.transition(ATM_STATES.IDLE);
          }, 3000);
        }
      }
    }, 1000);
  }

  stopSessionTimer() {
    if (this.timeoutTimer) { clearInterval(this.timeoutTimer); this.timeoutTimer = null; }
  }

  resetSession() {
    this.pin = '';
    this.newPin = '';
    this.confirmPin = '';
    this.customAmount = '';
    this.withdrawalAmount = 0;
    this.pinAttempts = 0;
    this.sessionId = '';
    this.transactionId = '';
    this.selectedAccount = '';
    this.stopSessionTimer();
  }

  transition(newState, delay = 0) {
    if (delay > 0) {
      setTimeout(() => { this.state = newState; this.notify(); }, delay);
    } else {
      this.state = newState;
      this.notify();
    }
  }

  dispatch(action, payload = null) {
    this.lastActivity = Date.now();

    switch (this.state) {
      case ATM_STATES.IDLE:
        if (action === 'INSERT_CARD') {
          this.transition(ATM_STATES.CARD_INSERTING);
          setTimeout(() => {
            this.sessionId = 'S' + Date.now().toString(36).toUpperCase().slice(-6);
            this.transition(ATM_STATES.CARD_READING);
            setTimeout(() => this.transition(ATM_STATES.LANGUAGE_SELECT), 1500);
          }, 1200);
        }
        break;

      case ATM_STATES.LANGUAGE_SELECT:
        if (action === 'SELECT_LANGUAGE') {
          this.language = payload?.lang || 'ENGLISH';
          this.startSessionTimer();
          this.transition(ATM_STATES.PIN_ENTRY);
        }
        break;

      case ATM_STATES.PIN_ENTRY:
        if (action === 'SUBMIT_PIN') {
          this.transition(ATM_STATES.AUTHENTICATING);
          setTimeout(() => {
            if (this.pin === this.correctPin) {
              this.pinAttempts = 0;
              this.transition(ATM_STATES.ACCOUNT_SELECT);
            } else {
              this.pinAttempts++;
              if (this.pinAttempts >= this.maxAttempts) {
                this.stopSessionTimer();
                this.transition(ATM_STATES.CARD_LOCKED);
              } else {
                this.pin = '';
                this.transition(ATM_STATES.AUTH_FAILED);
              }
            }
          }, 1800);
        }
        break;

      case ATM_STATES.AUTH_FAILED:
        if (action === 'RETRY') { this.pin = ''; this.transition(ATM_STATES.PIN_ENTRY); }
        else if (action === 'CANCEL') { this.ejectAndReset(); }
        break;

      case ATM_STATES.CARD_LOCKED:
        // Card retained - auto reset after delay
        setTimeout(() => { this.resetSession(); this.transition(ATM_STATES.IDLE); }, 5000);
        break;

      case ATM_STATES.ACCOUNT_SELECT:
        if (action === 'SELECT_SAVINGS') { this.selectedAccount = 'SAVINGS'; this.transition(ATM_STATES.MENU); }
        else if (action === 'SELECT_CURRENT') { this.selectedAccount = 'CURRENT'; this.transition(ATM_STATES.MENU); }
        break;

      case ATM_STATES.SESSION_TIMEOUT_WARNING:
        if (action === 'CONTINUE_SESSION') {
          this.lastActivity = Date.now();
          this.transition(this.prevState || ATM_STATES.MENU);
        } else if (action === 'CANCEL') { this.ejectAndReset(); }
        break;

      case ATM_STATES.MENU:
        if (action === 'SELECT_WITHDRAWAL') this.transition(ATM_STATES.WITHDRAWAL_PRESET);
        else if (action === 'SELECT_BALANCE') this.transition(ATM_STATES.BALANCE);
        else if (action === 'SELECT_MINI_STATEMENT') this.transition(ATM_STATES.MINI_STATEMENT);
        else if (action === 'SELECT_CHANGE_PIN') this.transition(ATM_STATES.CHANGE_PIN);
        else if (action === 'CANCEL') this.ejectAndReset();
        break;

      case ATM_STATES.BALANCE:
        if (action === 'BACK') this.transition(ATM_STATES.MENU);
        else if (action === 'CANCEL') this.ejectAndReset();
        break;

      case ATM_STATES.MINI_STATEMENT:
        if (action === 'BACK') this.transition(ATM_STATES.MENU);
        else if (action === 'CANCEL') this.ejectAndReset();
        break;

      case ATM_STATES.WITHDRAWAL_PRESET:
        if (action === 'SELECT_AMOUNT') {
          this.withdrawalAmount = payload.amount;
          this.transition(ATM_STATES.WITHDRAWAL_CONFIRM);
        }
        else if (action === 'CUSTOM_AMOUNT') this.transition(ATM_STATES.WITHDRAWAL_CUSTOM);
        else if (action === 'BACK') this.transition(ATM_STATES.MENU);
        break;

      case ATM_STATES.WITHDRAWAL_CUSTOM:
        if (action === 'CONFIRM_CUSTOM') {
          const amt = parseInt(this.customAmount, 10);
          if (amt > 0 && amt <= this.balance && amt % 10 === 0) {
            this.withdrawalAmount = amt;
            this.transition(ATM_STATES.WITHDRAWAL_CONFIRM);
          }
        }
        else if (action === 'BACK') { this.customAmount = ''; this.transition(ATM_STATES.WITHDRAWAL_PRESET); }
        break;

      case ATM_STATES.WITHDRAWAL_CONFIRM:
        if (action === 'CONFIRM') {
          this.transactionId = generateTxId();
          this.balance -= this.withdrawalAmount;
          this.transactions.unshift({
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            desc: 'ATM WITHDRAWAL',
            amount: -this.withdrawalAmount,
            bal: this.balance,
          });
          this.transition(ATM_STATES.PROCESSING);
          setTimeout(() => {
            this.transition(ATM_STATES.DISPENSING);
            setTimeout(() => this.transition(ATM_STATES.RECEIPT_PROMPT), 2500);
          }, 2000);
        }
        else if (action === 'BACK') this.transition(ATM_STATES.WITHDRAWAL_PRESET);
        break;

      case ATM_STATES.CHANGE_PIN:
        if (action === 'SUBMIT_OLD_PIN') {
          if (this.pin === this.correctPin) {
            this.pin = '';
            this.transition(ATM_STATES.CHANGE_PIN_NEW);
          } else {
            this.pin = '';
            this.transition(ATM_STATES.AUTH_FAILED);
          }
        }
        else if (action === 'BACK') { this.pin = ''; this.transition(ATM_STATES.MENU); }
        break;

      case ATM_STATES.CHANGE_PIN_NEW:
        if (action === 'SUBMIT_NEW_PIN') {
          this.transition(ATM_STATES.CHANGE_PIN_CONFIRM);
        }
        else if (action === 'BACK') { this.newPin = ''; this.transition(ATM_STATES.MENU); }
        break;

      case ATM_STATES.CHANGE_PIN_CONFIRM:
        if (action === 'CONFIRM_NEW_PIN') {
          if (this.newPin === this.confirmPin && this.newPin.length === 4) {
            this.correctPin = this.newPin;
            this.newPin = ''; this.confirmPin = '';
            this.transition(ATM_STATES.PIN_CHANGED);
            setTimeout(() => this.transition(ATM_STATES.MENU), 2500);
          } else {
            this.newPin = ''; this.confirmPin = '';
            this.transition(ATM_STATES.CHANGE_PIN_NEW);
          }
        }
        break;

      case ATM_STATES.RECEIPT_PROMPT:
        if (action === 'PRINT_RECEIPT') {
          this.transition(ATM_STATES.PRINTING_RECEIPT);
          setTimeout(() => this.transition(ATM_STATES.ANOTHER_TRANSACTION), 2000);
        }
        else if (action === 'NO_RECEIPT') {
          this.transition(ATM_STATES.ANOTHER_TRANSACTION);
        }
        break;

      case ATM_STATES.ANOTHER_TRANSACTION:
        if (action === 'YES') {
          this.customAmount = '';
          this.withdrawalAmount = 0;
          this.transition(ATM_STATES.MENU);
        }
        else if (action === 'NO') this.ejectAndReset();
        break;

      case ATM_STATES.SUCCESS:
        if (action === 'CONTINUE') this.transition(ATM_STATES.MENU);
        else if (action === 'FINISH') this.ejectAndReset();
        break;
    }
  }

  ejectAndReset() {
    this.transition(ATM_STATES.CARD_EJECTING);
    setTimeout(() => {
      this.transition(ATM_STATES.THANK_YOU);
      setTimeout(() => { this.resetSession(); this.transition(ATM_STATES.IDLE); }, 3000);
    }, 2000);
  }

  addPinDigit(digit) {
    if (this.state === ATM_STATES.PIN_ENTRY || this.state === ATM_STATES.CHANGE_PIN) {
      if (this.pin.length < 4) { this.pin += digit; this.notify(); }
    }
    else if (this.state === ATM_STATES.CHANGE_PIN_NEW) {
      if (this.newPin.length < 4) { this.newPin += digit; this.notify(); }
    }
    else if (this.state === ATM_STATES.CHANGE_PIN_CONFIRM) {
      if (this.confirmPin.length < 4) { this.confirmPin += digit; this.notify(); }
    }
    else if (this.state === ATM_STATES.WITHDRAWAL_CUSTOM) {
      if (this.customAmount.length < 5) { this.customAmount += digit; this.notify(); }
    }
  }

  clearPin() {
    if (this.state === ATM_STATES.PIN_ENTRY || this.state === ATM_STATES.CHANGE_PIN) {
      this.pin = ''; this.notify();
    } else if (this.state === ATM_STATES.CHANGE_PIN_NEW) {
      this.newPin = ''; this.notify();
    } else if (this.state === ATM_STATES.CHANGE_PIN_CONFIRM) {
      this.confirmPin = ''; this.notify();
    } else if (this.state === ATM_STATES.WITHDRAWAL_CUSTOM) {
      this.customAmount = ''; this.notify();
    }
  }
}
