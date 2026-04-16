import React, { useRef, useEffect, useCallback } from 'react';
import { bresenhamLine, bresenhamRect, bresenhamCircle, generateBankLogo } from '../graphics/ManualMath.js';
import { clipPixels } from '../graphics/ClippingAlgorithm.js';

const SCREEN_WIDTH = 480;
const SCREEN_HEIGHT = 320;
const SCREEN_BOUNDS = { xMin: 0, yMin: 0, xMax: SCREEN_WIDTH - 1, yMax: SCREEN_HEIGHT - 1 };

function renderPixelsToData(data, pixels, color = { r: 0, g: 255, b: 150, a: 255 }) {
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    if (p.x >= 0 && p.x < SCREEN_WIDTH && p.y >= 0 && p.y < SCREEN_HEIGHT) {
      const idx = (p.y * SCREEN_WIDTH + p.x) * 4;
      data[idx] = color.r; data[idx + 1] = color.g; data[idx + 2] = color.b; data[idx + 3] = color.a;
    }
  }
}

const CHAR_MAP = {
  'A': [[0,6],[0,2],[0,2],[2,0],[2,0],[4,2],[4,2],[4,6],[0,4],[4,4]],
  'B': [[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[3,2],[3,2],[0,3],[0,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[0,6]],
  'S': [[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5]],
  'E': [[4,0],[0,0],[0,0],[0,6],[0,6],[4,6],[0,3],[3,3]],
  'C': [[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5]],
  'U': [[0,0],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,0]],
  'R': [[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[0,3],[2,3],[4,6]],
  'N': [[0,6],[0,0],[0,0],[4,6],[4,6],[4,0]],
  'I': [[1,0],[3,0],[2,0],[2,6],[1,6],[3,6]],
  'T': [[0,0],[4,0],[2,0],[2,6]],
  'P': [[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[0,3]],
  'O': [[1,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[0,5],[0,1],[0,1],[1,0]],
  'M': [[0,6],[0,0],[0,0],[2,3],[2,3],[4,0],[4,0],[4,6]],
  'W': [[0,0],[1,6],[1,6],[2,3],[2,3],[3,6],[3,6],[4,0]],
  'G': [[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,3],[4,3],[2,3]],
  'V': [[0,0],[2,6],[2,6],[4,0]],
  '0': [[1,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[0,5],[0,1],[0,1],[1,0],[1,5],[3,1]],
  '1': [[1,1],[2,0],[2,0],[2,6],[1,6],[3,6]],
  '2': [[0,1],[1,0],[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[0,6],[0,6],[4,6]],
  '3': [[0,1],[1,0],[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5]],
  '4': [[0,0],[0,3],[0,3],[4,3],[3,0],[3,6]],
  '5': [[4,0],[0,0],[0,0],[0,3],[0,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[0,6]],
  '6': [[3,0],[1,0],[1,0],[0,1],[0,1],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,4],[4,4],[3,3],[3,3],[0,3]],
  '7': [[0,0],[4,0],[4,0],[2,6]],
  'L': [[0,0],[0,6],[0,6],[4,6]],
  'K': [[0,0],[0,6],[4,0],[0,3],[0,3],[4,6]],
  'D': [[0,0],[0,6],[0,0],[3,0],[3,0],[4,1],[4,1],[4,5],[4,5],[3,6],[3,6],[0,6]],
  'H': [[0,0],[0,6],[4,0],[4,6],[0,3],[4,3]],
  'F': [[4,0],[0,0],[0,0],[0,6],[0,3],[3,3]],
  'Y': [[0,0],[2,3],[4,0],[2,3],[2,3],[2,6]],
  '8': [[1,0],[3,0],[3,0],[4,1],[4,1],[4,2],[4,2],[3,3],[3,3],[1,3],[1,3],[0,2],[0,2],[0,1],[0,1],[1,0],[1,3],[0,4],[0,4],[0,5],[0,5],[1,6],[1,6],[3,6],[3,6],[4,5],[4,5],[4,4],[4,4],[3,3]],
  '9': [[4,3],[4,1],[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[4,3],[4,3],[4,5],[4,5],[3,6],[3,6],[1,6]],
  ' ': [], '-': [[1,3],[3,3]], '.': [[2,5],[2,6]], ':': [[2,2],[2,2],[2,4],[2,4]],
  '$': [[4,1],[3,0],[3,0],[1,0],[1,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[3,3],[3,3],[4,4],[4,4],[4,5],[4,5],[3,6],[3,6],[1,6],[1,6],[0,5],[2,0],[2,6]],
};

// Optimization: Cache static vectors so we don't recalculate thousands of bezier curves a second
let _cachedLogo = null;
let _cachedBounds = null;

function renderBresenhamTextDirect(data, text, startX, startY, scale = 2, color = { r: 0, g: 255, b: 150, a: 255 }) {
  const charWidth = 6 * scale;
  const allPixels = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    const segments = CHAR_MAP[ch];
    if (!segments) continue;
    const ox = startX + i * charWidth;
    for (let s = 0; s < segments.length; s += 2) {
      if (s + 1 >= segments.length) break;
      allPixels.push(...bresenhamLine(ox + segments[s][0]*scale, startY + segments[s][1]*scale, ox + segments[s+1][0]*scale, startY + segments[s+1][1]*scale));
    }
  }
  renderPixelsToData(data, clipPixels(allPixels, SCREEN_BOUNDS), color);
}

const BresenhamCanvas = ({ atmState, atmData }) => {
  const canvasRef = useRef(null);
  const timeRef = useRef(0);
  const animFrame = useRef(null);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    // Increment local time for animations easily
    timeRef.current += 0.1;
    
    // CPU Optimization: Create a single image buffer per frame
    const imageData = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    const data = imageData.data;
    
    // Fill transparent background block
    for(let i=0; i<data.length; i+=4) {
      data[i] = 2; data[i+1] = 6; data[i+2] = 12; data[i+3] = 200; // dark transparent blue
    }

    if (!_cachedBounds) _cachedBounds = clipPixels(bresenhamRect(2, 2, SCREEN_WIDTH - 5, SCREEN_HEIGHT - 5), SCREEN_BOUNDS);
    if (!_cachedLogo) _cachedLogo = clipPixels(generateBankLogo(40, 30, 0.4), SCREEN_BOUNDS);

    renderPixelsToData(data, _cachedBounds, { r: 0, g: 255, b: 150, a: 150 });
    renderPixelsToData(data, _cachedLogo, { r: 0, g: 255, b: 200, a: 255 });
    renderBresenhamTextDirect(data, 'SECURE BANK', 70, 20, 1.5, { r: 0, g: 255, b: 150, a: 255 });

    switch (atmState) {
      case 'IDLE':
        renderBresenhamTextDirect(data, 'INSERT CARD OR PRESS ENTER', SCREEN_WIDTH/2 - 140, 140, 1.8);
        const ay = 200 + Math.sin(timeRef.current) * 10;
        renderPixelsToData(data, clipPixels([...bresenhamLine(SCREEN_WIDTH/2, ay, SCREEN_WIDTH/2-10, ay-10), ...bresenhamLine(SCREEN_WIDTH/2, ay, SCREEN_WIDTH/2+10, ay-10)], SCREEN_BOUNDS));
        break;
      case 'PIN_ENTRY':
        renderBresenhamTextDirect(data, 'ENTER PIN', SCREEN_WIDTH/2 - 60, 100, 2);
        for(let i=0; i<4; i++) {
          renderPixelsToData(data, clipPixels(bresenhamRect(SCREEN_WIDTH/2 - 60 + i*32, 140, 24, 24), SCREEN_BOUNDS), { r: 0, g: 200, b: 200, a: 255 });
          if (atmData?.pin?.length > i) {
            renderPixelsToData(data, clipPixels(bresenhamCircle(SCREEN_WIDTH/2 - 60 + i*32 + 12, 152, 6), SCREEN_BOUNDS));
          }
        }
        if (atmData?.pinAttempts > 0) renderBresenhamTextDirect(data, `TRIES: ${atmData.remainingAttempts}`, SCREEN_WIDTH/2 - 40, 190, 1.5, {r:255, g:100, b:0, a:255});
        break;
      case 'AUTH_FAILED':
        renderBresenhamTextDirect(data, 'WRONG PIN - PRESS ENTER TO RETRY', SCREEN_WIDTH/2 - 160, 150, 1.5, {r:255, g:50, b:50, a:255});
        break;
      case 'MENU':
        renderBresenhamTextDirect(data, '1 WITHDRAW  2 BALANCE', 40, 150, 1.5);
        renderBresenhamTextDirect(data, '3 CANCEL', 40, 200, 1.5, {r:255, g:100, b:50, a:255});
        break;
      case 'BALANCE':
        renderBresenhamTextDirect(data, `BAL $${atmData?.balance}`, SCREEN_WIDTH/2 - 80, 150, 2);
        renderBresenhamTextDirect(data, `PRESS CANCEL TO EXIT`, SCREEN_WIDTH/2 - 100, 200, 1.5, {r:200, g:200, b:200, a:255});
        break;
      case 'WITHDRAWAL':
        renderBresenhamTextDirect(data, 'PRESS AMOUNT ON NUMPAD', 40, 150, 1.5, {r:0, g:255, b:150, a:255});
        break;
      case 'PROCESSING':
      case 'DISPENSING':
        renderBresenhamTextDirect(data, 'PROCESSING...', SCREEN_WIDTH/2 - 60, 150, 2);
        break;
      case 'SUCCESS':
        renderBresenhamTextDirect(data, 'SUCCESS', SCREEN_WIDTH/2 - 40, 150, 2);
        break;
      case 'CARD_EJECTING':
        renderBresenhamTextDirect(data, 'TAKE CARD', SCREEN_WIDTH/2 - 50, 150, 2);
        break;
      default: break;
    }
    
    // CPU Optimization: Single DOM write per frame
    ctx.putImageData(imageData, 0, 0);
    
    animFrame.current = requestAnimationFrame(draw);
  }, [atmState, atmData]);

  useEffect(() => {
    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [draw]);

  return (
    <canvas 
      ref={canvasRef} 
      width={SCREEN_WIDTH} 
      height={SCREEN_HEIGHT} 
      style={{
        width: '480px', height: '320px',
        backgroundColor: 'transparent'
      }} 
    />
  );
};
export default BresenhamCanvas;
