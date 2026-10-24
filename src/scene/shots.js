// Camera shots in Spline world units (1 m ≈ 400). Each is a camera position and a look-at target.
export const SHOTS = {
  overview: { position: { x: -330, y: 600, z: 900 }, target: { x: 0, y: 400, z: 120 } },
  front: { position: { x: 0, y: 560, z: 1000 }, target: { x: 0, y: 400, z: 100 } },
  operate: { position: { x: 20, y: 650, z: 600 }, target: { x: 10, y: 450, z: 150 } },
  card: { position: { x: 240, y: 540, z: 430 }, target: { x: 88, y: 470, z: 190 } },
  nfc: { position: { x: 210, y: 500, z: 420 }, target: { x: 88, y: 445, z: 186 } },
  keypad: { position: { x: -40, y: 600, z: 410 }, target: { x: -40, y: 430, z: 225 } },
  screen: { position: { x: 0, y: 610, z: 500 }, target: { x: 0, y: 530, z: 140 } },
  cash: { position: { x: -90, y: 380, z: 560 }, target: { x: -37, y: 345, z: 170 } },
  receipt: { position: { x: 230, y: 440, z: 400 }, target: { x: 88, y: 404, z: 190 } },
  attack: { position: { x: 300, y: 560, z: 520 }, target: { x: 70, y: 460, z: 185 } },
  side: { position: { x: 760, y: 640, z: 720 }, target: { x: 0, y: 380, z: 0 } },
};
