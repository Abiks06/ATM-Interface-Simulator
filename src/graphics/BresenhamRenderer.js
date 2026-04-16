import { bresenhamLine, bresenhamRect, bresenhamCircle } from './ManualMath.js';
import { clipPixels } from './ClippingAlgorithm.js';

const W = 480;
const H = 320;
const B = { xMin: 0, yMin: 0, xMax: W - 1, yMax: H - 1 };

// Color Palette
const C = {
  bg:      { r: 0,   g: 12,  b: 36,  a: 255 },
  header:  { r: 0,   g: 20,  b: 50,  a: 255 },
  footer:  { r: 0,   g: 15,  b: 40,  a: 255 },
  btn:     { r: 5,   g: 30,  b: 70,  a: 255 },
  btnHi:   { r: 10,  g: 45,  b: 95,  a: 255 },
  green:   { r: 0,   g: 220, b: 120, a: 255 },
  cyan:    { r: 60,  g: 200, b: 240, a: 255 },
  white:   { r: 230, g: 235, b: 240, a: 255 },
  dim:     { r: 90,  g: 100, b: 120, a: 255 },
  orange:  { r: 240, g: 160, b: 40,  a: 255 },
  red:     { r: 230, g: 60,  b: 50,  a: 255 },
  yellow:  { r: 240, g: 220, b: 50,  a: 255 },
  redBg:   { r: 50,  g: 8,   b: 8,   a: 255 },
  greenBg: { r: 5,   g: 40,  b: 20,  a: 255 },
};

// Pixel Helpers
function fill(data, x, y, w, h, color) {
  x = Math.round(x); y = Math.round(y);
  for (let r = Math.max(0, y); r < Math.min(H, y + h); r++)
    for (let c = Math.max(0, x); c < Math.min(W, x + w); c++) {
      const i = (r * W + c) * 4;
      data[i] = color.r; data[i+1] = color.g; data[i+2] = color.b; data[i+3] = color.a;
    }
}

// Character Map
const CM = {
  'A':[[0,6],[0,2],[0,2],[2,0],[2,0],[4,2],[4,2],[4,6],[0,4],[4,4]],
  'B':[[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[3,2],[3,2],[0,3],[0,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[0,6]],
  'S':[[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5]],
  'E':[[4,0],[0,0],[0,0],[0,6],[0,6],[4,6],[0,3],[3,3]],
  'C':[[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5]],
  'U':[[0,0],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,0]],
  'R':[[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[0,3],[2,3],[4,6]],
  'N':[[0,6],[0,0],[0,0],[4,6],[4,6],[4,0]],
  'I':[[1,0],[3,0],[2,0],[2,6],[1,6],[3,6]],
  'T':[[0,0],[4,0],[2,0],[2,6]],
  'P':[[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[0,3]],
  'O':[[1,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[0,5],[0,1],[0,1],[1,0]],
  'M':[[0,6],[0,0],[0,0],[2,3],[2,3],[4,0],[4,0],[4,6]],
  'W':[[0,0],[1,6],[1,6],[2,3],[2,3],[3,6],[3,6],[4,0]],
  'G':[[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,3],[4,3],[2,3]],
  'V':[[0,0],[2,6],[2,6],[4,0]],
  'X':[[0,0],[4,6],[4,0],[0,6]],
  'Z':[[0,0],[4,0],[4,0],[0,6],[0,6],[4,6]],
  'Q':[[1,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[0,5],[0,1],[0,1],[1,0],[3,4],[4,6]],
  'J':[[0,0],[4,0],[2,0],[2,5],[2,5],[1,6],[1,6],[0,5]],
  'K':[[0,0],[0,6],[4,0],[0,3],[0,3],[4,6]],
  'D':[[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[0,6]],
  'H':[[0,0],[0,6],[4,0],[4,6],[0,3],[4,3]],
  'F':[[4,0],[0,0],[0,0],[0,6],[0,3],[3,3]],
  'L':[[0,0],[0,6],[0,6],[4,6]],
  'Y':[[0,0],[2,3],[4,0],[2,3],[2,3],[2,6]],
  '0':[[1,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[0,5],[0,1],[0,1],[1,0]],
  '1':[[1,1],[2,0],[2,0],[2,6],[1,6],[3,6]],
  '2':[[0,1],[1,0],[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[0,6],[0,6],[4,6]],
  '3':[[0,1],[1,0],[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5]],
  '4':[[0,0],[0,3],[0,3],[4,3],[3,0],[3,6]],
  '5':[[4,0],[0,0],[0,0],[0,3],[0,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[0,6]],
  '6':[[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,4],[4,4],[3,3],[3,3],[0,3]],
  '7':[[0,0],[4,0],[4,0],[2,6]],
  '8':[[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[1,3],[1,3],[0,2],[0,2],[0,1],[0,1],[1,0],[1,3],[0,4],[0,4],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,4],[4,4],[3,3]],
  '9':[[4,3],[4,1],[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[4,3],[4,3],[4,5],[4,5],[3,6],[3,6],[1,6]],
  ' ':[], '-':[[1,3],[3,3]], '.':[[2,5],[2,6]], ':':[[2,2],[2,2],[2,4],[2,4]],
  '$':[[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[2,0],[2,6]],
  '*':[[1,1],[3,5],[3,1],[1,5],[0,3],[4,3]],
  '#':[[1,0],[1,6],[3,0],[3,6],[0,2],[4,2],[0,4],[4,4]],
  '/':[[4,0],[0,6]], '?':[[0,1],[1,0],[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[2,3],[2,5],[2,5],[2,6]],
  '!':[[2,0],[2,4],[2,5],[2,6]], '>':[[0,0],[2,3],[2,3],[0,6]], '<':[[4,0],[2,3],[2,3],[4,6]],
};

// Bold text using doubled lines
function txt(data, text, x, y, scale = 2, color = C.white) {
  const cw = 6 * scale;
  const px = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    const segs = CM[ch];
    if (!segs) continue;
    const ox = x + i * cw;
    for (let s = 0; s < segs.length; s += 2) {
      if (s + 1 >= segs.length) break;
      const x0 = ox + segs[s][0]*scale, y0 = y + segs[s][1]*scale;
      const x1 = ox + segs[s+1][0]*scale, y1 = y + segs[s+1][1]*scale;
      px.push(...bresenhamLine(x0, y0, x1, y1));
      // Bold: offset by 1px
      if (scale >= 1.5) {
        const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
        if (dx >= dy) px.push(...bresenhamLine(x0, y0+1, x1, y1+1));
        else px.push(...bresenhamLine(x0+1, y0, x1+1, y1));
      }
    }
  }
  const clipped = clipPixels(px, B);
  for (let j = 0; j < clipped.length; j++) {
    const p = clipped[j];
    const idx = (p.y * W + p.x) * 4;
    data[idx] = color.r; data[idx+1] = color.g; data[idx+2] = color.b; data[idx+3] = color.a;
  }
}

// Clean UI Components
function btn(data, x, y, w, h, label, txtColor = C.white, bg = C.btn) {
  fill(data, x, y, w, h, bg);
  const tw = label.length * 12;
  txt(data, label, x + Math.max(8, Math.floor((w - tw) / 2)), y + Math.floor((h - 14) / 2), 2, txtColor);
}

function pinBoxes(data, len, cx, cy) {
  for (let i = 0; i < 4; i++) {
    const bx = cx - 80 + i * 44;
    fill(data, bx, cy, 34, 34, C.btn);
    if (len > i) fill(data, bx + 10, cy + 10, 14, 14, C.green);
  }
}

function bar(data, x, y, w, h, progress) {
  fill(data, x, y, w, h, { r: 10, g: 20, b: 45, a: 255 });
  if (progress > 0) fill(data, x + 2, y + 2, Math.floor((w - 4) * Math.min(progress, 1)), h - 4, C.green);
}

// Header / Footer
function header(data, d) {
  fill(data, 0, 0, W, 36, C.header);
  txt(data, 'SECURE BANK', 12, 8, 2, C.green);
  if (d?.timestamp) txt(data, d.timestamp, W - 200, 12, 1.2, C.dim);
  fill(data, 0, H - 20, W, 20, C.footer);
}

// Main Renderer
export function drawBresenhamFrame(canvas, atmState, atmData, timeVal) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  // Fill background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = C.bg.r; data[i+1] = C.bg.g; data[i+2] = C.bg.b; data[i+3] = 255;
  }

  const d = atmData;
  header(data, d);
  const Y = 44;

  switch (atmState) {
    case 'IDLE': {
      txt(data, 'WELCOME', W/2 - 62, Y + 30, 3, C.green);
      txt(data, 'INSERT YOUR CARD', W/2 - 95, Y + 75, 2, C.white);
      txt(data, 'TO BEGIN', W/2 - 45, Y + 100, 2, C.white);
      // Simple pulsing dot
      const pulse = Math.sin(timeVal * 3) > 0;
      if (pulse) fill(data, W/2 - 5, Y + 140, 10, 10, C.green);
      txt(data, 'ENCRYPTED SESSION', W/2 - 90, H - 14, 1.2, C.dim);
      break;
    }

    case 'CARD_READING': {
      txt(data, 'READING CARD', W/2 - 85, Y + 40, 2.5, C.cyan);
      txt(data, 'PLEASE WAIT', W/2 - 60, Y + 75, 2, C.white);
      bar(data, 60, Y + 110, W - 120, 14, Math.min((timeVal % 3) / 2, 1));
      txt(data, 'DO NOT REMOVE CARD', W/2 - 100, H - 14, 1.2, C.red);
      break;
    }

    case 'LANGUAGE_SELECT': {
      txt(data, 'SELECT LANGUAGE', W/2 - 92, Y + 8, 2.2, C.green);
      btn(data, 30,  Y + 45, 200, 40, '1  ENGLISH', C.white, C.btnHi);
      btn(data, 250, Y + 45, 200, 40, '2  FRANCAIS');
      btn(data, 30,  Y + 95, 200, 40, '3  ESPANOL');
      btn(data, 250, Y + 95, 200, 40, '4  DEUTSCH');
      txt(data, 'PRESS 1-4', W/2 - 45, H - 14, 1.2, C.dim);
      break;
    }

    case 'PIN_ENTRY': {
      txt(data, 'ENTER YOUR PIN', W/2 - 85, Y + 10, 2.2, C.green);
      pinBoxes(data, d?.pin?.length || 0, W/2, Y + 55);
      if (d?.pinAttempts > 0) {
        fill(data, W/2 - 120, Y + 100, 240, 22, C.redBg);
        txt(data, 'ATTEMPTS LEFT: ' + d.remainingAttempts, W/2 - 95, Y + 104, 1.5, C.orange);
      }
      txt(data, '* CLEAR   # ENTER', W/2 - 90, Y + 140, 1.5, C.dim);
      txt(data, 'PIN IS ENCRYPTED', W/2 - 80, H - 14, 1.2, C.dim);
      break;
    }

    case 'AUTHENTICATING': {
      txt(data, 'AUTHENTICATING', W/2 - 90, Y + 35, 2.5, C.cyan);
      txt(data, 'VERIFYING PIN', W/2 - 70, Y + 70, 2, C.white);
      bar(data, 80, Y + 105, W - 160, 14, Math.min((timeVal % 4) / 2.5, 1));
      txt(data, 'DO NOT REMOVE CARD', W/2 - 100, H - 14, 1.2, C.red);
      break;
    }

    case 'AUTH_FAILED': {
      fill(data, 30, Y + 15, W - 60, 45, C.redBg);
      txt(data, 'WRONG PIN', W/2 - 58, Y + 25, 2.5, C.red);
      txt(data, d?.remainingAttempts + ' ATTEMPTS LEFT', W/2 - 90, Y + 80, 2, C.orange);
      btn(data, W/2 - 110, Y + 120, 220, 40, 'OK TO RETRY', C.white, C.btnHi);
      txt(data, 'OR CANCEL TO EXIT', W/2 - 90, H - 14, 1.2, C.dim);
      break;
    }

    case 'CARD_LOCKED': {
      fill(data, 20, Y + 10, W - 40, 55, C.redBg);
      txt(data, 'CARD LOCKED', W/2 - 72, Y + 18, 2.5, C.red);
      txt(data, 'TOO MANY ATTEMPTS', W/2 - 100, Y + 45, 1.8, C.red);
      txt(data, 'CARD HAS BEEN RETAINED', W/2 - 120, Y + 85, 2, C.orange);
      txt(data, 'CONTACT YOUR BANK', W/2 - 95, Y + 120, 2, C.white);
      break;
    }

    case 'ACCOUNT_SELECT': {
      txt(data, 'SELECT ACCOUNT', W/2 - 86, Y + 10, 2.2, C.green);
      txt(data, d?.cardholderName || '', W/2 - 70, Y + 38, 1.5, C.cyan);
      btn(data, 30,  Y + 65, 200, 50, '1  SAVINGS', C.white, C.btnHi);
      btn(data, 250, Y + 65, 200, 50, '2  CURRENT');
      txt(data, 'PRESS 1 OR 2', W/2 - 60, H - 14, 1.2, C.dim);
      break;
    }

    case 'MENU': {
      txt(data, 'MAIN MENU', W/2 - 58, Y, 2.2, C.green);
      fill(data, 10, Y + 24, W - 20, 16, C.header);
      txt(data, d?.cardholderName || '', 18, Y + 27, 1, C.cyan);
      txt(data, (d?.selectedAccount || '') + ' ACCT', W - 130, Y + 27, 1, C.cyan);

      btn(data, 15,  Y + 48,  220, 38, '1  WITHDRAWAL', C.white, C.btnHi);
      btn(data, 245, Y + 48,  220, 38, '2  BALANCE');
      btn(data, 15,  Y + 96,  220, 38, '3  STATEMENT');
      btn(data, 245, Y + 96,  220, 38, '4  CHANGE PIN', C.white, C.btn);
      txt(data, 'X  CANCEL TO EXIT', W/2 - 90, H - 14, 1.2, C.orange);
      break;
    }

    case 'BALANCE': {
      txt(data, 'BALANCE ENQUIRY', W/2 - 92, Y + 8, 2.2, C.green);
      fill(data, 30, Y + 38, W - 60, 16, C.header);
      txt(data, (d?.selectedAccount || '') + '  ' + (d?.accountNumber || ''), 40, Y + 40, 1.2, C.cyan);
      fill(data, 30, Y + 62, W - 60, 55, C.greenBg);
      txt(data, 'AVAILABLE', 50, Y + 68, 2, C.white);
      txt(data, '$' + (d?.balance?.toFixed(2) || '0.00'), 50, Y + 92, 2.5, C.green);
      txt(data, 'AS OF ' + (d?.timestamp || ''), W/2 - 75, Y + 135, 1.2, C.dim);
      txt(data, 'X  CANCEL TO RETURN', W/2 - 95, H - 14, 1.2, C.orange);
      break;
    }

    case 'MINI_STATEMENT': {
      txt(data, 'MINI STATEMENT', W/2 - 85, Y, 2, C.green);
      fill(data, 10, Y + 24, W - 20, 16, C.header);
      txt(data, 'DATE    DESCRIPTION       AMT', 18, Y + 27, 1, C.cyan);
      const txns = d?.transactions || [];
      txns.slice(0, 5).forEach((t, i) => {
        const ty = Y + 44 + i * 22;
        if (i % 2 === 0) fill(data, 10, ty, W - 20, 20, { r: 2, g: 15, b: 42, a: 255 });
        txt(data, t.date, 18, ty + 3, 1.2, C.white);
        txt(data, t.desc.substring(0, 14), 100, ty + 3, 1.2, C.white);
        txt(data, (t.amount < 0 ? '-' : '+') + '$' + Math.abs(t.amount).toFixed(0), 370, ty + 3, 1.2, t.amount < 0 ? C.red : C.green);
      });
      txt(data, 'X  CANCEL TO RETURN', W/2 - 95, H - 14, 1.2, C.orange);
      break;
    }

    case 'WITHDRAWAL_PRESET': {
      txt(data, 'SELECT AMOUNT', W/2 - 80, Y + 2, 2.2, C.green);
      btn(data, 15,  Y + 35, 145, 36, '1  $20');
      btn(data, 168, Y + 35, 145, 36, '2  $50');
      btn(data, 321, Y + 35, 145, 36, '3  $100');
      btn(data, 15,  Y + 80, 145, 36, '4  $200');
      btn(data, 168, Y + 80, 145, 36, '5  $500');
      btn(data, 321, Y + 80, 145, 36, '6  OTHER', C.white, C.btnHi);
      fill(data, 15, Y + 128, W - 30, 16, C.header);
      txt(data, 'BAL: $' + (d?.balance?.toFixed(2) || ''), 25, Y + 130, 1.2, C.dim);
      txt(data, 'X  CANCEL', W/2 - 42, H - 14, 1.2, C.orange);
      break;
    }

    case 'WITHDRAWAL_CUSTOM': {
      txt(data, 'ENTER AMOUNT', W/2 - 75, Y + 10, 2.2, C.green);
      txt(data, 'MULTIPLES OF $10', W/2 - 80, Y + 38, 1.5, C.dim);
      fill(data, 80, Y + 60, 320, 45, C.btn);
      txt(data, '$  ' + (d?.customAmount || '---'), 100, Y + 70, 2.8, C.white);
      txt(data, 'AVAIL $' + (d?.balance?.toFixed(2) || ''), W/2 - 65, Y + 120, 1.5, C.dim);
      txt(data, '#  CONFIRM     *  CLEAR', W/2 - 115, H - 14, 1.2, C.dim);
      break;
    }

    case 'WITHDRAWAL_CONFIRM': {
      txt(data, 'CONFIRM?', W/2 - 52, Y + 5, 2.5, C.green);
      fill(data, 60, Y + 40, W - 120, 55, C.greenBg);
      txt(data, 'WITHDRAW', 80, Y + 46, 2, C.white);
      txt(data, '$' + (d?.withdrawalAmount || 0), 80, Y + 70, 2.8, C.yellow);
      txt(data, 'FROM ' + (d?.selectedAccount || 'SAVINGS'), 80, Y + 105, 1.5, C.dim);
      btn(data, 25,  Y + 130, 210, 38, '1  CONFIRM', C.white, C.greenBg);
      btn(data, 245, Y + 130, 210, 38, '2  CANCEL', C.white, C.redBg);
      break;
    }

    case 'CHANGE_PIN': {
      txt(data, 'CHANGE PIN', W/2 - 65, Y + 10, 2.2, C.green);
      txt(data, 'ENTER CURRENT PIN', W/2 - 95, Y + 45, 2, C.white);
      pinBoxes(data, d?.pin?.length || 0, W/2, Y + 75);
      txt(data, '#  SUBMIT     *  CLEAR', W/2 - 110, H - 14, 1.2, C.dim);
      break;
    }

    case 'CHANGE_PIN_NEW': {
      txt(data, 'CHANGE PIN', W/2 - 65, Y + 10, 2.2, C.green);
      txt(data, 'ENTER NEW PIN', W/2 - 72, Y + 45, 2, C.white);
      pinBoxes(data, d?.newPin?.length || 0, W/2, Y + 75);
      txt(data, '#  SUBMIT     *  CLEAR', W/2 - 110, H - 14, 1.2, C.dim);
      break;
    }

    case 'CHANGE_PIN_CONFIRM': {
      txt(data, 'CONFIRM PIN', W/2 - 70, Y + 10, 2.2, C.green);
      txt(data, 'RE-ENTER NEW PIN', W/2 - 90, Y + 45, 2, C.white);
      pinBoxes(data, d?.confirmPin?.length || 0, W/2, Y + 75);
      txt(data, '#  CONFIRM     *  CLEAR', W/2 - 115, H - 14, 1.2, C.dim);
      break;
    }

    case 'PIN_CHANGED': {
      fill(data, 40, Y + 40, W - 80, 55, C.greenBg);
      txt(data, 'PIN UPDATED', W/2 - 70, Y + 50, 2.2, C.green);
      txt(data, 'SUCCESSFULLY', W/2 - 72, Y + 75, 2, C.white);
      txt(data, 'RETURNING TO MENU', W/2 - 90, Y + 120, 1.5, C.dim);
      break;
    }

    case 'PROCESSING': {
      txt(data, 'PROCESSING', W/2 - 65, Y + 30, 2.5, C.cyan);
      txt(data, 'PLEASE WAIT', W/2 - 60, Y + 65, 2, C.white);
      if (d?.transactionId) txt(data, 'TXN ' + d.transactionId, W/2 - 65, Y + 92, 1.2, C.dim);
      bar(data, 60, Y + 115, W - 120, 14, Math.min((timeVal % 5) / 3, 1));
      txt(data, 'DO NOT REMOVE CARD', W/2 - 100, H - 14, 1.2, C.red);
      break;
    }

    case 'DISPENSING': {
      txt(data, 'DISPENSING', W/2 - 65, Y + 20, 2.5, C.green);
      fill(data, W/2 - 60, Y + 55, 120, 35, C.greenBg);
      txt(data, '$' + (d?.withdrawalAmount || 0), W/2 - 40, Y + 62, 2.5, C.yellow);
      txt(data, 'TAKE YOUR CASH', W/2 - 80, Y + 105, 2, C.white);
      txt(data, 'FROM BELOW', W/2 - 55, Y + 130, 2, C.white);
      // Simple pulsing indicator
      if (Math.sin(timeVal * 5) > 0) fill(data, W/2 - 5, Y + 160, 10, 10, C.green);
      break;
    }

    case 'RECEIPT_PROMPT': {
      txt(data, 'PRINT RECEIPT?', W/2 - 85, Y + 20, 2.2, C.green);
      btn(data, 30,  Y + 65, 200, 50, '1  YES', C.white, C.greenBg);
      btn(data, 250, Y + 65, 200, 50, '2  NO', C.white, C.btn);
      break;
    }

    case 'PRINTING_RECEIPT': {
      txt(data, 'PRINTING', W/2 - 52, Y + 40, 2.5, C.cyan);
      txt(data, 'PLEASE WAIT', W/2 - 60, Y + 75, 2, C.white);
      bar(data, 80, Y + 105, W - 160, 14, Math.min((timeVal % 4) / 2, 1));
      break;
    }

    case 'ANOTHER_TRANSACTION': {
      txt(data, 'ANOTHER TXN?', W/2 - 78, Y + 20, 2.2, C.green);
      btn(data, 30,  Y + 65, 200, 50, '1  YES', C.white, C.greenBg);
      btn(data, 250, Y + 65, 200, 50, '2  NO EXIT', C.white, C.btn);
      break;
    }

    case 'SESSION_TIMEOUT_WARNING': {
      fill(data, 20, Y + 15, W - 40, 45, C.redBg);
      txt(data, 'SESSION TIMEOUT', W/2 - 92, Y + 25, 2.2, C.red);
      const blink = Math.sin(timeVal * 6) > 0;
      if (blink) txt(data, 'ARE YOU THERE?', W/2 - 82, Y + 80, 2, C.orange);
      btn(data, W/2 - 115, Y + 115, 230, 40, 'PRESS ANY KEY', C.white, C.btnHi);
      break;
    }

    case 'CARD_EJECTING': {
      txt(data, 'TAKE YOUR CARD', W/2 - 88, Y + 50, 2.5, C.yellow);
      const blink = Math.sin(timeVal * 6) > 0;
      if (blink) fill(data, W/2 - 5, Y + 100, 10, 10, C.yellow);
      fill(data, 40, Y + 125, W - 80, 22, C.redBg);
      txt(data, 'DO NOT FORGET CARD', W/2 - 98, Y + 128, 1.5, C.red);
      break;
    }

    case 'THANK_YOU': {
      txt(data, 'THANK YOU', W/2 - 60, Y + 35, 3, C.green);
      txt(data, 'FOR USING', W/2 - 52, Y + 80, 2, C.white);
      txt(data, 'SECURE BANK', W/2 - 65, Y + 108, 2, C.cyan);
      txt(data, 'HAVE A GREAT DAY', W/2 - 90, Y + 150, 2, C.white);
      break;
    }

    default: break;
  }

  ctx.putImageData(img, 0, 0);
}
