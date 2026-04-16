// Cohen-Sutherland clipping logic

const INSIDE = 0b0000;
const LEFT   = 0b0001;
const RIGHT  = 0b0010;
const BOTTOM = 0b0100;
const TOP    = 0b1000;

export function computeOutcode(x, y, bounds) {
  let code = INSIDE;
  if (x < bounds.xMin) code |= LEFT;
  else if (x > bounds.xMax) code |= RIGHT;
  if (y < bounds.yMin) code |= BOTTOM;
  return code;
}

export function clipPixels(pixels, bounds) {
  return pixels.filter(p =>
    p.x >= bounds.xMin && p.x <= bounds.xMax &&
    p.y >= bounds.yMin && p.y <= bounds.yMax
  );
}
