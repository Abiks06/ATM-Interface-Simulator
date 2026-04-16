# Secure ATM Interface Simulator

![Secure ATM Preview](src/assets/screenshots/github_preview.png)

A high-fidelity, production-grade 3D ATM simulator developed for the **CS3231 Computer Graphics** course. This project demonstrates mastery of fundamental graphics algorithms by implementing them from scratch in JavaScript, while delivering a modern, state-driven user experience through Three.js and React.

**Author:** Abioye  
**Date:** April 2026

---

## 🎨 Graphics Engineering (Manual Implementation)

To meet the rigorous requirements of CS3231, all core graphics primitives were implemented from scratch without using high-level utility libraries:

- **Rasterization (Bresenham's Algorithms)**: Custom integer-based line, circle, and rectangle rasterizers that write directly to an `ImageData` buffer.
- **Parametric Curves (Bézier)**: Cubic and Quadratic Bézier implementations using Bernstein polynomials (used for the Secure Bank logo).
- **Transformation Library (Mat4)**: A 4x4 matrix library for translation, scaling, and rotation (Y-axis) in column-major order.
- **Clipping (Cohen-Sutherland)**: Bitwise outcode classification for pixel-perfect clipping of the 2D UI within the 3D screen plane.
- **Shading Models (GLSL)**: Custom **Phong (Per-Fragment)** shading for the metallic chassis and **Gouraud (Per-Vertex)** shading for the matte keypad buttons.

## 🛠️ System Features

- **19-State Security FSM**: A deterministic state machine managing the full ATM lifecycle (PIN entry, authentication, withdrawal preset/custom, mini-statements, session timeouts, and card retention).
- **Native Desktop Integration**: Packaged as a standalone Windows executable using **Electron**.
- **Web Audio Feedback**: Synthetic 1800Hz digital beeps for keypad interaction via the Web Audio API.
- **Keyframe Animation**: Smooth, frame-driven animations for card insertion/ejection, cash dispensing, and button presses.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/abioye/secure-atm-simulator.git
cd secure-atm-simulator

# Install dependencies
npm install
```

### Execution
```bash
# Run in development mode (Vite internal browser)
npm run dev

# Build and package for Windows (Electron)
npm run electron:build
```

---

## 📄 Documentation

For a deep dive into the mathematical proofs, algorithm derivations, and system architecture, see the full **[Technical Report](Technical_Report.md)**.

## ⚖️ License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
