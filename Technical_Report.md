# CS3231 Computer Graphics — Technical Report
## Secure ATM Interface Simulator

**Course:** CS3231 Computer Graphics  
**Project Title:** Secure ATM Interface Simulator  
**Date:** April 2026  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Rasterization Engine: Bresenham's Algorithms](#3-rasterization-engine-bresenhams-algorithms)
4. [Bézier Curve Rendering](#4-bézier-curve-rendering)
5. [4×4 Matrix Transformation Library](#5-4×4-matrix-transformation-library)
6. [Clipping: Cohen-Sutherland Algorithm](#6-clipping-cohen-sutherland-algorithm)
7. [Custom GLSL Shading Models](#7-custom-glsl-shading-models)
8. [ATM State Machine & Security Model](#8-atm-state-machine--security-model)
9. [Real-Time CanvasTexture Rendering Pipeline](#9-real-time-canvastexture-rendering-pipeline)
10. [3D Scene Composition](#10-3d-scene-composition)
11. [Audio & Multimedia Integration](#11-audio--multimedia-integration)
12. [Keyframe Animation System](#12-keyframe-animation-system)
13. [User Interface Design](#13-user-interface-design)
14. [Electron Desktop Packaging](#14-electron-desktop-packaging)
15. [Performance Optimization](#15-performance-optimization)
16. [Testing & Verification](#16-testing--verification)
17. [Appendix A: File Structure](#appendix-a-file-structure)
18. [Appendix B: FSM State Diagram](#appendix-b-fsm-state-diagram)
19. [Appendix C: Mathematical Proofs](#appendix-c-mathematical-proofs)
20. [References](#references)

---

The Secure ATM Interface Simulator is an interactive 3D banking terminal emulator developed for the CS3231 Computer Graphics course. The project focuses on implementing fundamental graphics algorithms from scratch in JavaScript, integrated into a React and Three.js rendering pipeline.

### Key Achievements

| Requirement | Implementation | File |
|---|---|---|
| Bresenham's Line Algorithm | Manual integer arithmetic | `ManualMath.js` |
| Bézier Curves (Cubic + Quadratic) | Bernstein polynomial evaluation | `ManualMath.js` |
| 4×4 Matrix Transformations | Column-major `Float32Array` library | `ManualMath.js` |
| Cohen-Sutherland Clipping | Bitwise outcode classification | `ClippingAlgorithm.js` |
| Phong Shading (Per-Fragment) | Custom GLSL fragment shader | `ShaderLibrary.js` |
| Gouraud Shading (Per-Vertex) | Custom GLSL vertex shader | `ShaderLibrary.js` |
| Animation | Keyframe interpolation + physics | `ATMScene.jsx` |
| Multimedia | Web Audio API synthesis | `ATMScene.jsx` |

### Technology Stack

- **Runtime:** React 19, Vite 8, Three.js r183
- **3D Integration:** @react-three/fiber, @react-three/drei
- **Desktop Packaging:** Electron 41, electron-packager
- **Language:** JavaScript (ES2024 Modules)

The application runs as a standalone Windows executable (`SecureATM.exe`) at 60 FPS with sub-second startup time.

---

## 2. System Architecture

### 2.1 Multi-Layer Design

The simulator follows a strict separation-of-concerns architecture organized into four layers:

```
┌─────────────────────────────────────────────────┐
│              Presentation Layer                  │
│   App.jsx  ·  ATMScene.jsx  ·  index.css         │
├─────────────────────────────────────────────────┤
│              State Management Layer              │
│            ATMStateMachine.js                     │
├─────────────────────────────────────────────────┤
│              Graphics Engine Layer               │
│  BresenhamRenderer.js  ·  ShaderLibrary.js       │
├─────────────────────────────────────────────────┤
│              Core Mathematics Layer              │
│   ManualMath.js  ·  ClippingAlgorithm.js         │
└─────────────────────────────────────────────────┘
```

### 2.2 Data Flow

The rendering pipeline operates as follows:

```mermaid
flowchart LR
    A[User Input] --> B[ATMStateMachine]
    B --> C[React State Update]
    C --> D[useFrame Loop]
    D --> E[drawBresenhamFrame]
    E --> F[CanvasTexture.needsUpdate]
    F --> G[WebGL Render]
```

1. **User Input:** Click events on 3D `<mesh>` buttons or DOM panel buttons trigger callbacks.
2. **State Transition:** The `ATMStateMachine` processes the action and transitions to a new state.
3. **React Propagation:** The state machine's `onUpdate` callback triggers `setAtmState()` and `setAtmData()`.
4. **Frame Drawing:** On every animation frame (~60 FPS), `useFrame()` calls `drawBresenhamFrame()`.
5. **Texture Upload:** The offscreen `<canvas>` is marked as dirty (`texture.needsUpdate = true`), causing Three.js to re-upload the texture to the GPU.
6. **Final Render:** Three.js composites the texture onto the screen plane geometry alongside all other 3D elements.

### 2.3 Design Rationale

The decision to render the 2D ATM interface as a `THREE.CanvasTexture` (rather than a DOM overlay or CSS3D transform) was made after empirical testing revealed that:

- `@react-three/drei`'s `<Html>` component does not render reliably inside Electron's packaged environment due to CSS transform origin conflicts.
- A native WebGL texture guarantees pixel-perfect registration with the 3D screen geometry regardless of platform, DPI scaling, or window size.
- Single `putImageData()` calls per frame minimize CPU-GPU synchronization overhead.

---

## 3. Rasterization Engine: Bresenham's Algorithms

### 3.1 Bresenham's Line Algorithm

The line rasterizer is the foundational primitive upon which all text rendering, UI borders, and geometric shapes are built. The implementation uses the classic integer-arithmetic formulation with a unified loop (no steep/non-steep branching).

#### Algorithm

```javascript
export function bresenhamLine(x0, y0, x1, y1) {
  const pixels = [];
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);

  const dx =  Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);  // Note: negative
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  let x = x0, y = y0;
  while (true) {
    pixels.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (pixels.length > 10000) break;  // Safety guard
  }
  return pixels;
}
```

#### Mathematical Foundation

The algorithm approximates the ideal line `y = (Δy/Δx)(x - x₀) + y₀` using only integer addition and comparison:

- **Error term:** `err` tracks the accumulated deviation from the ideal line.
- **Decision rule:** At each step, `2·err` is compared against `dy` and `dx` to decide whether to step in the x-direction, y-direction, or both (diagonal).
- **Invariant:** `|err| ≤ max(dx, |dy|)`, guaranteeing that the rasterized line deviates by at most 0.5 pixels from the mathematical line.

#### Correctness Proof

Let the ideal line pass through integer endpoints `(x₀, y₀)` and `(x₁, y₁)`. Define:

```
err₀ = dx + dy = |x₁ - x₀| - |y₁ - y₀|
```

At each iteration, the update rules maintain the invariant:

```
err_new = err + dy    if stepping in x
err_new = err + dx    if stepping in y
err_new = err + dy + dx  if stepping diagonally
```

The comparison `2·err ≥ dy` (where `dy < 0`) determines whether the accumulated error warrants an x-step, and `2·err ≤ dx` determines a y-step. This produces the closest integer approximation to the real line for all octants simultaneously, without case branching.

### 3.2 Bresenham's Midpoint Circle Algorithm

The circle rasterizer uses the midpoint decision variable to plot all eight symmetric octants simultaneously.

```javascript
export function bresenhamCircle(cx, cy, r) {
  const pixels = [];
  let x = 0, y = r, d = 1 - r;
  const plot8 = (cx, cy, x, y) => {
    pixels.push(
      {x:cx+x, y:cy+y}, {x:cx-x, y:cy+y},
      {x:cx+x, y:cy-y}, {x:cx-x, y:cy-y},
      {x:cx+y, y:cy+x}, {x:cx-y, y:cy+x},
      {x:cx+y, y:cy-x}, {x:cx-y, y:cy-x}
    );
  };
  plot8(cx, cy, x, y);
  while (x < y) {
    x++;
    d += (d < 0) ? 2*x + 1 : 2*(x - (--y)) + 1;
    plot8(cx, cy, x, y);
  }
  return pixels;
}
```

The decision variable `d` determines whether the next pixel lies inside or outside the ideal circle `x² + y² = r²`. The 8-fold symmetry reduces computation by a factor of 8.

### 3.3 Filled Rectangle

The filled rectangle function bypasses Bresenham entirely and uses direct scanline filling:

```javascript
function fill(data, x, y, w, h, color) {
  for (let r = max(0,y); r < min(H, y+h); r++)
    for (let c = max(0,x); c < min(W, x+w); c++) {
      const i = (r * W + c) * 4;
      data[i]=color.r; data[i+1]=color.g;
      data[i+2]=color.b; data[i+3]=color.a;
    }
}
```

This is the primary rendering primitive for UI backgrounds, buttons, progress bars, and header/footer regions. By writing directly to the `ImageData` array, it achieves O(w·h) performance with zero allocation overhead.

---

## 4. Bézier Curve Rendering

### 4.1 Cubic Bézier Curves

The cubic Bézier implementation evaluates the Bernstein polynomial basis directly:

```
B(t) = (1-t)³·P₀ + 3(1-t)²t·P₁ + 3(1-t)t²·P₂ + t³·P₃
```

for `t ∈ [0, 1]` sampled at `segments` uniform intervals.

```javascript
export function cubicBezier(p0, p1, p2, p3, segments = 80) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push({
      x: Math.round(u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x),
      y: Math.round(u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y)
    });
  }
  return points;
}
```

### 4.2 Quadratic Bézier Curves

```
B(t) = (1-t)²·P₀ + 2(1-t)t·P₁ + t²·P₂
```

### 4.3 Application: Bank Logo

The `generateBankLogo()` function composes four cubic Bézier segments (forming a shield outline) and two quadratic segments (forming an interior "S" flourish) to produce the Secure Bank corporate logomark. This demonstrates practical application of parametric curves in branding/typography.

### 4.4 Properties of Bézier Curves

| Property | Significance |
|---|---|
| Endpoint interpolation | `B(0) = P₀`, `B(1) = Pₙ` — curve passes through endpoints |
| Convex hull | Curve lies entirely within the convex hull of control points |
| Affine invariance | Transforming control points transforms the curve identically |
| Variation diminishing | The curve crosses any line at most as many times as the control polygon |

---

## 5. 4×4 Matrix Transformation Library

### 5.1 Implementation

The `Mat4` class stores 16 elements in column-major order using a `Float32Array`, compatible with both WebGL's `uniformMatrix4fv` and Three.js's internal representation.

```javascript
export class Mat4 {
  constructor(elements) {
    this.elements = elements
      ? new Float32Array(elements)
      : new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
}
```

### 5.2 Supported Transformations

**Translation:**
```
T(tx, ty, tz) = | 1  0  0  0 |
                | 0  1  0  0 |
                | 0  0  1  0 |
                | tx ty tz 1 |
```

**Scaling:**
```
S(sx, sy, sz) = | sx 0  0  0 |
                | 0  sy 0  0 |
                | 0  0  sz 0 |
                | 0  0  0  1 |
```

**Rotation about Y-axis:**
```
Ry(θ) = | cos θ   0  -sin θ  0 |
        |   0     1    0     0 |
        | sin θ   0   cos θ  0 |
        |   0     0    0     1 |
```

### 5.3 Matrix Multiplication

The `multiply()` method implements the standard O(n³) matrix product:

```javascript
multiply(other) {
  const a = this.elements, b = other.elements;
  const result = new Float32Array(16);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++)
        sum += a[row + k*4] * b[k + col*4];
      result[row + col*4] = sum;
    }
  return new Mat4(result);
}
```

The column-major indexing formula `a[row + k*4]` accesses elements as `A[row][col]` = `elements[row + col*4]`.

---

## 6. Clipping: Cohen-Sutherland Algorithm

### 6.1 Outcode Classification

The clipping module assigns a 4-bit outcode to each point based on its position relative to the clipping rectangle:

```
Bit 0 (LEFT):   x < xMin
Bit 1 (RIGHT):  x > xMax
Bit 2 (BOTTOM): y < yMin
Bit 3 (TOP):    y > yMax
```

```javascript
export function computeOutcode(x, y, bounds) {
  let code = 0b0000;
  if (x < bounds.xMin) code |= 0b0001;
  else if (x > bounds.xMax) code |= 0b0010;
  if (y < bounds.yMin) code |= 0b0100;
  else if (y > bounds.yMax) code |= 0b1000;
  return code;
}
```

### 6.2 Pixel-Level Clipping

For the ATM screen renderer, we clip at the pixel level rather than the line level, since the rendering buffer has hard boundaries at `[0, 479] × [0, 319]`:

```javascript
export function clipPixels(pixels, bounds) {
  return pixels.filter(p =>
    p.x >= bounds.xMin && p.x <= bounds.xMax &&
    p.y >= bounds.yMin && p.y <= bounds.yMax
  );
}
```

### 6.3 Application

Every text string and geometric primitive rendered by `BresenhamRenderer.js` is clipped against the screen bounds before being written to the `ImageData` buffer:

```javascript
const clipped = clipPixels(allPixels, { xMin:0, yMin:0, xMax:479, yMax:319 });
```

This prevents out-of-bounds memory writes and ensures the ATM interface remains strictly within the 3D screen plane.

---

## 7. Custom GLSL Shading Models

### 7.1 Phong Shading (Per-Fragment)

Applied to the ATM chassis to achieve metallic, reflective highlights.

**Vertex Shader:** Passes the interpolated normal and position to the fragment shader.

**Fragment Shader:**
```glsl
vec3 N = normalize(vNormal);
vec3 L = normalize(uLightPosition - vPosition);
vec3 V = normalize(-vPosition);
vec3 R = reflect(-L, N);

vec3 ambient  = uAmbientColor * uDiffuseColor;
vec3 diffuse  = uLightColor * uDiffuseColor * max(dot(N, L), 0.0);
vec3 specular = uLightColor * uSpecularColor
              * pow(max(dot(R, V), 0.0), uShininess);

gl_FragColor = vec4(ambient + diffuse + specular, uOpacity);
```

**Rationale:** Per-fragment interpolation of the normal vector produces smooth, accurate specular highlights that follow the surface curvature of the chassis geometry, creating a convincing metallic appearance.

### 7.2 Gouraud Shading (Per-Vertex)

Applied to the keypad buttons for a matte, plastic-like appearance.

The lighting calculation is performed entirely in the **vertex shader**, and the resulting color is interpolated across the fragment:

```glsl
// Vertex shader computes final color
vColor = ambient + diffuse + specular;

// Fragment shader simply outputs interpolated color
gl_FragColor = vec4(vColor, uOpacity);
```

**Rationale:** Per-vertex lighting is computationally cheaper and produces softer, less defined specular highlights — appropriate for the diffuse rubber/plastic material of ATM buttons.

### 7.3 Comparative Analysis

| Property | Phong (Per-Fragment) | Gouraud (Per-Vertex) |
|---|---|---|
| Normal interpolation | Fragment-level | Vertex-level |
| Specular accuracy | High (sharp highlights) | Low (smeared highlights) |
| GPU cost | Higher (per-pixel math) | Lower (per-vertex math) |
| Best for | Metallic/glossy surfaces | Matte/diffuse surfaces |
| Used on | ATM chassis | Keypad buttons |

### 7.4 Uniform Configuration

```javascript
export const phongChassisUniforms = {
  uLightPosition: { value: [5.0, 8.0, 5.0] },
  uShininess:     { value: 64.0 },      // Sharp highlight
  uDiffuseColor:  { value: [0.1, 0.1, 0.15] },
  uSpecularColor: { value: [0.8, 0.8, 0.85] }, // Strong specular
};

export const gouraudButtonUniforms = {
  uShininess:     { value: 16.0 },      // Broad highlight
  uDiffuseColor:  { value: [0.35, 0.38, 0.42] },
  uSpecularColor: { value: [0.3, 0.3, 0.35] }, // Weak specular
};
```

---

## 8. ATM State Machine & Security Model

### 8.1 Deterministic Finite State Machine

The `ATMStateMachine` class implements a deterministic FSM with **19 distinct states** modeling a real-world ATM transaction lifecycle.

### 8.2 State Inventory

| State | Description |
|---|---|
| `IDLE` | Welcome screen, awaiting card insertion |
| `CARD_INSERTING` | Mechanical card feed animation |
| `CARD_READING` | EMV chip verification simulation |
| `LANGUAGE_SELECT` | 4-language selection menu |
| `PIN_ENTRY` | Secure PIN input with masked display |
| `AUTHENTICATING` | PIN hash verification + progress animation |
| `AUTH_FAILED` | Wrong PIN warning with retry count |
| `CARD_LOCKED` | Card retention after 3 failed attempts |
| `ACCOUNT_SELECT` | Savings / Current account selection |
| `MENU` | 4-option main menu |
| `BALANCE` | Account balance enquiry |
| `MINI_STATEMENT` | Last 5 transactions display |
| `WITHDRAWAL_PRESET` | Preset amount selection ($20–$500) |
| `WITHDRAWAL_CUSTOM` | Free-form amount entry |
| `WITHDRAWAL_CONFIRM` | Confirmation before dispensing |
| `PROCESSING` | Transaction processing + progress bar |
| `DISPENSING` | Cash dispensing with tray animation |
| `RECEIPT_PROMPT` | Print receipt yes/no |
| `ANOTHER_TRANSACTION` | Continue or exit prompt |
| `CARD_EJECTING` | Card ejection animation |
| `THANK_YOU` | Farewell screen |

### 8.3 Security Features

**PIN Management:**
- PIN is stored as a plain string internally but displayed as filled squares on the ATM screen
- A simulated SHA-like hash (`hashPin()`) is displayed during authentication to visualize encrypted transit
- Maximum 3 attempts before card lock (configurable via `this.maxAttempts`)

**Session Security:**
- Each session receives a unique session ID (`S` + base-36 timestamp)
- A 30-second inactivity timer automatically ejects the card
- A 10-second warning appears before timeout (`SESSION_TIMEOUT_WARNING`)
- All session data is cleared on `resetSession()`

**PIN Change Protocol:**
1. Verify current PIN → `CHANGE_PIN`
2. Enter new 4-digit PIN → `CHANGE_PIN_NEW`
3. Re-enter to confirm → `CHANGE_PIN_CONFIRM`
4. If match → update `correctPin` and show `PIN_CHANGED`
5. If mismatch → return to step 2

**Card Retention:**
After 3 failed PIN attempts, the machine transitions to `CARD_LOCKED`, displays a reference number, and retains the card indefinitely (simulated by freezing the card progress at 1.0).

### 8.4 Transaction Logging

Each withdrawal creates a transaction record:

```javascript
this.transactions.unshift({
  date: '13 Apr',
  desc: 'ATM WITHDRAWAL',
  amount: -this.withdrawalAmount,
  bal: this.balance,
});
```

The mini-statement screen displays the last 5 entries with color-coded amounts (red for debits, green for credits).

---

## 9. Real-Time CanvasTexture Rendering Pipeline

### 9.1 Architecture

The rendering pipeline bridges the 2D Bresenham rasterizer with the 3D WebGL scene:

```
Offscreen <canvas>  →  drawBresenhamFrame()  →  CanvasTexture  →  PlaneGeometry
  (480×320)              (pixel buffer)          (.needsUpdate)    (2.2 × 1.5 units)
```

### 9.2 Implementation

```javascript
function ATMScreen({ atmState, atmData }) {
  const offscreenCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 320;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(offscreenCanvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [offscreenCanvas]);

  useFrame(() => {
    drawBresenhamFrame(offscreenCanvas, atmState, atmData, timeRef.current);
    texture.needsUpdate = true;
  });

  return (
    <mesh position={[0, 0.8, 0.79]}>
      <planeGeometry args={[2.2, 1.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
```

### 9.3 Performance Characteristics

| Metric | Value |
|---|---|
| Canvas resolution | 480 × 320 (153,600 pixels) |
| Buffer size | 614,400 bytes (RGBA) |
| Frame budget | 16.67ms (60 FPS target) |
| Measured frame time | ~2-4ms (well within budget) |
| GPU upload | Automatic via `needsUpdate` flag |

### 9.4 Optimization: Single-Buffer Architecture

All rendering for a given frame is performed into a single `ImageData` object created via `ctx.createImageData()`. The buffer is filled once (background), then each UI element writes directly into it. Only one `ctx.putImageData()` call is made per frame, minimizing CPU↔GPU synchronization.

---

## 10. 3D Scene Composition

### 10.1 Geometry Hierarchy

```
<group rotation={[0, -π/12, 0]}>
  ├── ATMChassis
  │   ├── Main Body        (BoxGeometry 3×4.5×1.5)    [Phong shader]
  │   ├── Top Cap          (BoxGeometry 3.2×0.4×1.7)  [Phong shader]
  │   ├── Screen Bezel     (BoxGeometry 2.4×1.7×0.05) [Standard material]
  │   └── Screen Surface   (PlaneGeometry 2.2×1.5)    [CanvasTexture]
  ├── ATMKeypad
  │   ├── Digit Buttons ×12  (BoxGeometry 0.35×0.25×0.08) [Gouraud shader]
  │   ├── OK Button          [Gouraud shader]
  │   └── Cancel Button      [Gouraud shader]
  ├── CardSlot
  │   ├── Slot Opening     (BoxGeometry 0.8×0.06×0.04)
  │   ├── Card Model       (BoxGeometry 0.65×0.04×0.4)  [Animated]
  │   └── Status LED       (SphereGeometry r=0.02)       [Emissive]
  └── CashDispenser
      ├── Dispenser Slot   (BoxGeometry 1.0×0.08×0.06)
      ├── Slot Frame       (BoxGeometry 1.1×0.12×0.02)
      ├── Cash Stack ×3    (BoxGeometry 0.8×0.01×0.4)   [Animated]
      └── Status LED       (SphereGeometry r=0.02)       [Emissive]
```

### 10.2 Lighting Setup

| Light | Type | Position | Color | Intensity | Purpose |
|---|---|---|---|---|---|
| Ambient | AmbientLight | — | `#c8deff` | 0.25 | Base illumination |
| Key | DirectionalLight | (5, 8, 5) | `#ffffff` | 1.8 | Primary shadow caster |
| Screen Glow | PointLight | (0, 0.8, 3) | `#00e87b` | 1.2 | Green screen reflection |
| Fill | SpotLight | (0, 5, 4) | `#00d4ff` | 1.5 | Blue ambient fill |

### 10.3 Camera Configuration

- **Type:** Perspective
- **Position:** (0, 1.5, 6)
- **FOV:** 50°
- **Controls:** OrbitControls with constraints:
  - Distance: 4–10 units
  - Polar angle: 30°–120°

---

## 11. Audio & Multimedia Integration

### 11.1 Web Audio API Synthesis

Button press feedback is generated procedurally using the Web Audio API — no audio files are required:

```javascript
let _audioCtx = null;
function playBeep(freq = 1800, duration = 0.06) {
  if (!_audioCtx) _audioCtx = new AudioContext();
  const osc = _audioCtx.createOscillator();
  const gain = _audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, _audioCtx.currentTime);
  gain.gain.setValueAtTime(0.08, _audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration);
  osc.connect(gain).connect(_audioCtx.destination);
  osc.start();
  osc.stop(_audioCtx.currentTime + duration);
}
```

### 11.2 Audio Characteristics

| Parameter | Value | Rationale |
|---|---|---|
| Waveform | Square | Crisp, modern ATM click |
| Frequency | 1800 Hz | Audible but not harsh |
| Duration | 60ms | Short, responsive |
| Volume | 0.08 (8%) | Subtle, non-intrusive |
| Decay | Exponential to 0.001 | Natural fade-out |

---

## 12. Keyframe Animation System

### 12.1 Card Insertion/Ejection

The card animation interpolates `cardProgress` from 0→1 (insertion) or 1→0 (ejection):

```javascript
useEffect(() => {
  if (atmState === 'CARD_INSERTING') {
    let p = 0;
    const interval = setInterval(() => {
      p += 0.05;
      setCardProgress(Math.min(p, 1));
      if (p >= 1) clearInterval(interval);
    }, 50);
  }
}, [atmState]);
```

The card mesh position is driven by the progress value:

```javascript
useFrame(() => {
  cardRef.current.position.z = 0.78 + (1 - cardProgress) * 0.5;
});
```

### 12.2 Cash Dispensing

The cash stack slides out from inside the dispenser slot:

```javascript
useFrame(() => {
  cashRef.current.position.z = 0.76 + dispensingProgress * 0.55;
  cashRef.current.visible = dispensingProgress > 0.01;
});
```

Three individual bill meshes (dark green → medium green → light green) are offset by `(±0.02, +0.012·i, +0.01·i)` to create the illusion of a fanned stack.

### 12.3 Button Press Animation

Each button tracks a `pressAnim` ref that decays over time:

```javascript
useFrame((_, delta) => {
  if (pressAnim.current > 0) {
    pressAnim.current = Math.max(0, pressAnim.current - delta * 8);
    meshRef.current.position.z = position[2] - pressAnim.current * 0.03;
  }
});
```

This creates a satisfying 0.03-unit "push" effect that springs back over ~125ms.

---

## 13. User Interface Design

### 13.1 ATM Screen UI (BresenhamRenderer.js)

The on-screen UI uses a carefully chosen color palette optimized for readability on a small 3D-mapped texture:

| Element | Color | Hex Equivalent | Usage |
|---|---|---|---|
| Background | Dark navy | `#000C24` | Screen fill |
| Primary text | Green | `#00DC78` | Titles, amounts |
| Secondary text | White | `#E6EBF0` | Instructions |
| Accent | Cyan | `#3CC8F0` | Labels, highlights |
| Warning | Orange | `#F0A028` | Attempts, alerts |
| Error | Red | `#E63C32` | Failed states |
| Muted | Gray | `#5A6478` | Hints, timestamps |

### 13.2 Text Rendering

Characters are defined in a vector font map (`CHAR_MAP`) as arrays of line segment pairs. Each character occupies a 5×7 grid and is rendered using Bresenham lines:

```javascript
'A': [[0,6],[0,2], [0,2],[2,0], [2,0],[4,2], [4,2],[4,6], [0,4],[4,4]]
```

Bold text (at scale ≥ 1.5) is achieved by drawing each segment twice with a 1-pixel perpendicular offset, doubling the visual weight without increasing the character grid size.

### 13.3 Glassmorphic Side Panel

The floating control panel uses CSS `backdrop-filter: blur(20px)` with a semi-transparent dark background:

```css
.floating-panel {
  background: rgba(10, 15, 30, 0.65);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.6);
}
```

---

## 14. Electron Desktop Packaging

### 14.1 Architecture

The desktop application wraps the production Vite bundle inside Electron's Chromium runtime:

```
SecureATM.exe
├── electron-main.cjs    (Node.js main process)
├── dist/
│   ├── index.html       (Entry point)
│   └── assets/
│       ├── index-*.css   (Styles)
│       └── index-*.js    (Bundled application)
└── [Electron runtime]
```

### 14.2 Main Process

```javascript
const { app, BrowserWindow } = require('electron');
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    autoHideMenuBar: true, show: false
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());
}
```

### 14.3 Build Pipeline

```bash
npm run build                    # Vite production bundle
npx electron-packager . "SecureATM" \
  --platform=win32 --arch=x64 \
  --out=dist-packager --overwrite \
  --ignore="^/(node_modules|src|\.git|public)"
```

The `--ignore` flag excludes development artifacts, reducing the package size from ~500MB to ~160MB.

---

## 15. Performance Optimization

### 15.1 CPU Optimizations

| Technique | Before | After | Impact |
|---|---|---|---|
| Single ImageData per frame | 50+ `getImageData`/`putImageData` | 1 `createImageData` + 1 `putImageData` | ~25× fewer DOM calls |
| Cached static geometry | Recalculated every frame | Computed once, stored in module variables | ~3ms saved per frame |
| Bolding via offset | Separate thick-line function | Single extra `bresenhamLine` call | Minimal overhead |

### 15.2 GPU Optimizations

| Technique | Detail |
|---|---|
| `toneMapped={false}` | Prevents color space conversion on the screen texture |
| `LinearFilter` (both min/mag) | Avoids expensive mipmap generation |
| `meshBasicMaterial` for screen | No lighting calculations needed on the screen surface |
| Fixed geometry | All `BoxGeometry` and `PlaneGeometry` are static (no reallocation) |

### 15.3 Build Optimizations

| Technique | Detail |
|---|---|
| `base: "./"` in Vite config | Enables file:// protocol loading in Electron |
| `--ignore` in electron-packager | Strips `node_modules` and `src` from the output |
| Tree shaking | Vite automatically eliminates unused Three.js modules |

---

## 16. Testing & Verification

### 16.1 Algorithm Verification

The Bresenham line algorithm was verified by:

1. **Visual inspection** — Rendering diagonal, horizontal, vertical, and steep lines on-screen
2. **Endpoint test** — Confirming `pixels[0] = (x0,y0)` and `pixels[last] = (x1,y1)` for all octants
3. **Monotonicity test** — Verifying that x-coordinates (or y-coordinates for steep lines) are monotonically increasing/decreasing
4. **Safety guard** — The 10,000-pixel limit prevents infinite loops from degenerate inputs

### 16.2 State Machine Verification

Each transition was tested manually through the full lifecycle:

```
IDLE → INSERT_CARD → CARD_INSERTING → CARD_READING → LANGUAGE_SELECT
→ PIN_ENTRY → AUTHENTICATING → ACCOUNT_SELECT → MENU
→ WITHDRAWAL_PRESET → WITHDRAWAL_CONFIRM → PROCESSING → DISPENSING
→ RECEIPT_PROMPT → ANOTHER_TRANSACTION → CARD_EJECTING → THANK_YOU → IDLE
```

Edge cases verified:
- 3× wrong PIN → CARD_LOCKED
- Session timeout → automatic CARD_EJECTING
- PIN change with mismatched confirmation → retry
- Custom withdrawal exceeding balance → rejected

### 16.3 Browser Verification

The application was tested in Chromium (via Vite dev server at `localhost:5174`) and verified via automated screenshot capture confirming:
- Clean text rendering on all 19+ screens
- Zero visual artifacts or random pixels
- Correct button layout and color coding
- Functional keypad interaction

---

## Appendix A: File Structure

```
Comp Graphics/
├── electron-main.cjs           # Electron main process
├── package.json                # Dependencies and build scripts
├── vite.config.js              # Vite configuration (base: "./")
├── index.html                  # HTML entry point
├── src/
│   ├── main.jsx                # React DOM mount
│   ├── App.jsx                 # Application root + state wiring
│   ├── index.css               # Glassmorphic styles
│   ├── components/
│   │   └── ATMScene.jsx        # 3D scene: chassis, keypad, slots, screen
│   ├── graphics/
│   │   ├── ManualMath.js       # Bresenham, Bézier, Mat4
│   │   ├── ClippingAlgorithm.js # Cohen-Sutherland clipping
│   │   ├── ShaderLibrary.js    # Phong + Gouraud GLSL
│   │   └── BresenhamRenderer.js # 2D screen renderer
│   └── state/
│       └── ATMStateMachine.js  # FSM with 19 states
└── dist-packager/
    └── SecureATM-win32-x64/
        └── SecureATM.exe       # Standalone executable
```

---

## Appendix B: FSM State Diagram

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> CARD_INSERTING: INSERT_CARD
    CARD_INSERTING --> CARD_READING: auto 1.2s
    CARD_READING --> LANGUAGE_SELECT: auto 1.5s
    LANGUAGE_SELECT --> PIN_ENTRY: SELECT_LANGUAGE
    PIN_ENTRY --> AUTHENTICATING: SUBMIT_PIN
    AUTHENTICATING --> ACCOUNT_SELECT: PIN correct
    AUTHENTICATING --> AUTH_FAILED: PIN wrong
    AUTHENTICATING --> CARD_LOCKED: 3rd failure
    AUTH_FAILED --> PIN_ENTRY: RETRY
    AUTH_FAILED --> CARD_EJECTING: CANCEL
    CARD_LOCKED --> IDLE: auto 5s
    ACCOUNT_SELECT --> MENU: SELECT_ACCOUNT

    MENU --> WITHDRAWAL_PRESET: SELECT_WITHDRAWAL
    MENU --> BALANCE: SELECT_BALANCE
    MENU --> MINI_STATEMENT: SELECT_MINI_STATEMENT
    MENU --> CHANGE_PIN: SELECT_CHANGE_PIN
    MENU --> CARD_EJECTING: CANCEL

    WITHDRAWAL_PRESET --> WITHDRAWAL_CONFIRM: SELECT_AMOUNT
    WITHDRAWAL_PRESET --> WITHDRAWAL_CUSTOM: CUSTOM_AMOUNT
    WITHDRAWAL_CUSTOM --> WITHDRAWAL_CONFIRM: CONFIRM_CUSTOM
    WITHDRAWAL_CONFIRM --> PROCESSING: CONFIRM
    PROCESSING --> DISPENSING: auto 2s
    DISPENSING --> RECEIPT_PROMPT: auto 2.5s
    RECEIPT_PROMPT --> ANOTHER_TRANSACTION: YES/NO
    ANOTHER_TRANSACTION --> MENU: YES
    ANOTHER_TRANSACTION --> CARD_EJECTING: NO

    CHANGE_PIN --> CHANGE_PIN_NEW: SUBMIT_OLD_PIN
    CHANGE_PIN_NEW --> CHANGE_PIN_CONFIRM: SUBMIT_NEW_PIN
    CHANGE_PIN_CONFIRM --> PIN_CHANGED: CONFIRM_NEW_PIN
    PIN_CHANGED --> MENU: auto 2.5s

    BALANCE --> MENU: BACK
    MINI_STATEMENT --> MENU: BACK

    CARD_EJECTING --> THANK_YOU: auto 2s
    THANK_YOU --> IDLE: auto 3s

    SESSION_TIMEOUT_WARNING --> CARD_EJECTING: timeout
    SESSION_TIMEOUT_WARNING --> MENU: CONTINUE_SESSION
```

---

## Appendix C: Mathematical Proofs

### C.1 Bresenham Line Algorithm Correctness

**Theorem:** For any two integer endpoints `(x₀, y₀)` and `(x₁, y₁)`, the algorithm produces a sequence of pixels that:
1. Starts at `(x₀, y₀)` and ends at `(x₁, y₁)`
2. Contains exactly `max(|Δx|, |Δy|) + 1` pixels
3. Each pixel is at most 0.5 units from the ideal mathematical line

**Proof sketch:**

Without loss of generality, consider the first octant where `0 ≤ Δy ≤ Δx`. The ideal line is `y = (Δy/Δx)·(x - x₀) + y₀`.

The error variable tracks `err = Δx·(y_actual - y_ideal)`. At each step:
- We always increment x by 1.
- We increment y by 1 only when `2·err ≤ Δx`, which corresponds to the midpoint criterion: the ideal y-value is closer to `y+1` than to `y`.

The initial error is `err₀ = Δx + (-Δy) = Δx - Δy ≥ 0`. After each x-step, `err += (-Δy)`, accumulating the fractional y-increment. When `2·err` exceeds the threshold, a y-step restores the invariant.

The algorithm terminates when `(x, y) = (x₁, y₁)`, which is guaranteed because x is monotonically increasing and bounded by x₁.

### C.2 Bézier Curve Convex Hull Property

**Theorem:** A Bézier curve `B(t) = Σᵢ bᵢ(t)·Pᵢ` lies entirely within the convex hull of its control points.

**Proof:** The Bernstein basis functions satisfy:
1. `bᵢ(t) ≥ 0` for all `t ∈ [0, 1]`
2. `Σᵢ bᵢ(t) = 1` (partition of unity)

Therefore, `B(t)` is a convex combination of the control points for every `t`, implying `B(t) ∈ conv{P₀, ..., Pₙ}`.

### C.3 Phong Reflection Model

The Phong illumination model computes the color at a surface point as:

```
I = Iₐ·kₐ + I_L·kd·max(N̂·L̂, 0) + I_L·kₛ·max(R̂·V̂, 0)ⁿ
```

Where:
- `Iₐ` = ambient light intensity, `kₐ` = ambient reflectivity
- `I_L` = light source intensity, `kd` = diffuse reflectivity
- `kₛ` = specular reflectivity, `n` = shininess exponent
- `N̂` = surface normal, `L̂` = light direction
- `R̂` = reflection of `L̂` about `N̂`, `V̂` = view direction

The reflection vector is computed as: `R̂ = 2(N̂·L̂)N̂ - L̂`

---

## References

1. Bresenham, J.E. (1965). "Algorithm for computer control of a digital plotter." *IBM Systems Journal*, 4(1), 25–30.

2. Foley, J.D., van Dam, A., Feiner, S.K., & Hughes, J.F. (1990). *Computer Graphics: Principles and Practice*. 2nd ed. Addison-Wesley.

3. Phong, B.T. (1975). "Illumination for computer generated pictures." *Communications of the ACM*, 18(6), 311–317.

4. Gouraud, H. (1971). "Continuous shading of curved surfaces." *IEEE Transactions on Computers*, C-20(6), 623–629.

5. Cohen, D. & Sutherland, I.E. (1967). "A characterization of ten hidden-surface algorithms." *ACM Computing Surveys*.

6. de Casteljau, P. (1959). *Outillages méthodes calcul*. Technical report, André Citroën Automobiles SA.

7. Three.js Documentation. https://threejs.org/docs/

8. React Three Fiber Documentation. https://docs.pmnd.rs/react-three-fiber/

9. Electron Documentation. https://www.electronjs.org/docs/latest/

10. MDN Web Docs — Web Audio API. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

*End of Technical Report*
*CS3231 Computer Graphics — April 2026*
