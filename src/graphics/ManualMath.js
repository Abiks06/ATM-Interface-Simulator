export function bresenhamLine(x0, y0, x1, y1) {
  const pixels = [];
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  let x = x0;
  let y = y0;

  while (true) {
    pixels.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (pixels.length > 10000) break;
  }
  return pixels;
}

export function bresenhamRect(x, y, w, h) {
  return [
    ...bresenhamLine(x, y, x + w, y),
    ...bresenhamLine(x + w, y, x + w, y + h),
    ...bresenhamLine(x + w, y + h, x, y + h),
    ...bresenhamLine(x, y + h, x, y),
  ];
}

export function bresenhamCircle(cx, cy, r) {
  const pixels = [];
  let x = 0; let y = r; let d = 1 - r;

  const plot8 = (cx, cy, x, y) => {
    pixels.push({ x: cx + x, y: cy + y }, { x: cx - x, y: cy + y },
                { x: cx + x, y: cy - y }, { x: cx - x, y: cy - y },
                { x: cx + y, y: cy + x }, { x: cx - y, y: cy + x },
                { x: cx + y, y: cy - x }, { x: cx - y, y: cy - x });
  };
  plot8(cx, cy, x, y);

  while (x < y) {
    x++;
    if (d < 0) {
      d += 2 * x + 1;
    } else {
      y--;
      d += 2 * (x - y) + 1;
    }
    plot8(cx, cy, x, y);
  }
  return pixels;
}

export function cubicBezier(p0, p1, p2, p3, segments = 80) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;

    const x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x;
    const y = b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

export function quadraticBezier(p0, p1, p2, segments = 50) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

export function generateBankLogo(centerX, centerY, scale = 1.0) {
  const points = [];
  points.push(...cubicBezier(
    { x: centerX, y: centerY - 40 * scale }, { x: centerX - 35 * scale, y: centerY - 38 * scale },
    { x: centerX - 40 * scale, y: centerY - 20 * scale }, { x: centerX - 38 * scale, y: centerY }, 60
  ));
  points.push(...cubicBezier(
    { x: centerX - 38 * scale, y: centerY }, { x: centerX - 35 * scale, y: centerY + 20 * scale },
    { x: centerX - 20 * scale, y: centerY + 35 * scale }, { x: centerX, y: centerY + 45 * scale }, 60
  ));
  points.push(...cubicBezier(
    { x: centerX, y: centerY + 45 * scale }, { x: centerX + 20 * scale, y: centerY + 35 * scale },
    { x: centerX + 35 * scale, y: centerY + 20 * scale }, { x: centerX + 38 * scale, y: centerY }, 60
  ));
  points.push(...cubicBezier(
    { x: centerX + 38 * scale, y: centerY }, { x: centerX + 40 * scale, y: centerY - 20 * scale },
    { x: centerX + 35 * scale, y: centerY - 38 * scale }, { x: centerX, y: centerY - 40 * scale }, 60
  ));
  points.push(...quadraticBezier(
    { x: centerX + 8 * scale, y: centerY - 18 * scale }, { x: centerX - 15 * scale, y: centerY - 22 * scale },
    { x: centerX - 10 * scale, y: centerY - 5 * scale }, 40
  ));
  points.push(...quadraticBezier(
    { x: centerX - 10 * scale, y: centerY - 5 * scale }, { x: centerX + 15 * scale, y: centerY + 10 * scale },
    { x: centerX - 8 * scale, y: centerY + 18 * scale }, 40
  ));
  points.push(...bresenhamLine(centerX, centerY - 25 * scale, centerX, centerY + 25 * scale));
  return points;
}

export class Mat4 {
  constructor(elements) {
    this.elements = elements ? new Float32Array(elements) : new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
  static identity() { return new Mat4(); }
  static translation(tx, ty, tz) {
    return new Mat4([1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1]);
  }
  static scaling(sx, sy, sz) {
    return new Mat4([sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1]);
  }
  static rotationY(angle) {
    const c = Math.cos(angle); const s = Math.sin(angle);
    return new Mat4([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
  }
  multiply(other) {
    const a = this.elements; const b = other.elements;
    const result = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[row + k * 4] * b[k + col * 4];
        result[row + col * 4] = sum;
      }
    }
    return new Mat4(result);
  }
}
