import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { drawBresenhamFrame } from '../graphics/BresenhamRenderer.js';
import {
  phongVertexShader, phongFragmentShader,
  gouraudVertexShader, gouraudFragmentShader,
  createThreeUniforms, phongChassisUniforms, gouraudButtonUniforms
} from '../graphics/ShaderLibrary.js';

// Web Audio Feedback
let _audioCtx = null;
function playBeep(freq = 1800, duration = 0.06) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, _audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration);
    osc.connect(gain).connect(_audioCtx.destination);
    osc.start(); osc.stop(_audioCtx.currentTime + duration);
  } catch (_) { /* silent fallback */ }
}

// Screen texture
function ATMScreen({ atmState, atmData }) {
  const meshRef = useRef();
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

  const timeRef = useRef(0);

  useFrame(() => {
    timeRef.current += 0.08;
    drawBresenhamFrame(offscreenCanvas, atmState, atmData, timeRef.current);
    texture.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.8, 0.79]}>
      <planeGeometry args={[2.2, 1.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// ATM Body
function ATMChassis({ atmState, atmData }) {
  const uniforms = useMemo(() => createThreeUniforms(phongChassisUniforms, THREE), []);
  const topUniforms = useMemo(() => createThreeUniforms({...phongChassisUniforms, uDiffuseColor: {value: [0.2,0.22,0.28]}}, THREE), []);

  return (
    <group>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, 4.5, 1.5]} />
        <shaderMaterial vertexShader={phongVertexShader} fragmentShader={phongFragmentShader} uniforms={uniforms} />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 2.6, -0.1]} castShadow>
        <boxGeometry args={[3.2, 0.4, 1.7]} />
        <shaderMaterial vertexShader={phongVertexShader} fragmentShader={phongFragmentShader} uniforms={topUniforms} />
      </mesh>
      {/* Screen bezel */}
      <mesh position={[0, 0.8, 0.76]}>
        <boxGeometry args={[2.4, 1.7, 0.05]} />
        <meshStandardMaterial color="#050508" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Actual screen with CanvasTexture */}
      <ATMScreen atmState={atmState} atmData={atmData} />
    </group>
  );
}

// Interactive Button
function ATMButton({ position, label, onClick }) {
  const meshRef = useRef();
  const isHovered = useRef(false);
  const pressAnim = useRef(0);
  const uniforms = useMemo(() => createThreeUniforms({...gouraudButtonUniforms}, THREE), []);

  // Create a simple text sprite for the label
  const labelTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 64, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 24);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [label]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = isHovered.current ? 1.08 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      // Press animation (bounce back)
      if (pressAnim.current > 0) {
        pressAnim.current = Math.max(0, pressAnim.current - delta * 8);
        meshRef.current.position.z = position[2] - pressAnim.current * 0.03;
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    playBeep();
    pressAnim.current = 1;
    onClick?.();
  };

  return (
    <group>
      <mesh ref={meshRef} position={position} castShadow onClick={handleClick}
        onPointerEnter={() => { isHovered.current = true; document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { isHovered.current = false; document.body.style.cursor = 'default'; }}>
        <boxGeometry args={[0.35, 0.25, 0.08]} />
        <shaderMaterial vertexShader={gouraudVertexShader} fragmentShader={gouraudFragmentShader} uniforms={uniforms} />
      </mesh>
      {/* Label floating just in front */}
      <mesh position={[position[0], position[1], position[2] + 0.045]}>
        <planeGeometry args={[0.3, 0.22]} />
        <meshBasicMaterial map={labelTexture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Keypad layout
function ATMKeypad({ onDigit, onEnter, onClear, onCancel }) {
  const digits = [ ['1','2','3'], ['4','5','6'], ['7','8','9'], ['*','0','#'] ];
  const buttons = [];
  digits.forEach((row, ri) => {
    row.forEach((digit, ci) => {
      buttons.push(
        <ATMButton key={digit} position={[-0.45 + ci*0.45, -0.4 - ri*0.32, 0.78]} label={digit}
          onClick={() => { if(digit==='*') onClear?.(); else if(digit==='#') onEnter?.(); else onDigit?.(digit); }} />
      );
    });
  });
  buttons.push(<ATMButton key="enter" position={[0.95, -0.4, 0.78]} label="OK" onClick={onEnter} />);
  buttons.push(<ATMButton key="cancel" position={[0.95, -0.72, 0.78]} label="X" onClick={onCancel} />);
  return <group>{buttons}</group>;
}

// Card slot logic
function CardSlot({ cardProgress }) {
  const cardRef = useRef();
  useFrame(() => {
    if (cardRef.current) cardRef.current.position.z = 0.78 + (1 - cardProgress)*0.5;
  });
  return (
    <group position={[-0.8, -1.6, 0]}>
      <mesh position={[0, 0, 0.76]}><boxGeometry args={[0.8, 0.06, 0.04]} /><meshStandardMaterial color="#020204" /></mesh>
      {cardProgress > 0 && (
        <mesh ref={cardRef} position={[0,0,0.78]}><boxGeometry args={[0.65, 0.04, 0.4]} /><meshStandardMaterial color="#e8d44d" metalness={0.6} roughness={0.3} /></mesh>
      )}
      <mesh position={[0.5, 0, 0.76]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color={cardProgress>0?'#0f0':'#f60'} emissive={cardProgress>0?'#0f0':'#f60'} emissiveIntensity={2} /></mesh>
    </group>
  );
}

// Cash dispensing logic
function CashDispenser({ dispensingProgress }) {
  const cashRef = useRef();

  useFrame(() => {
    if (cashRef.current) {
      // Cash slides out from z=0.76 to z=1.3
      cashRef.current.position.z = 0.76 + dispensingProgress * 0.55;
      cashRef.current.visible = dispensingProgress > 0.01;
    }
  });

  return (
    <group position={[0.7, -1.6, 0]}>
      {/* Cash slot opening */}
      <mesh position={[0, 0, 0.75]}>
        <boxGeometry args={[1.0, 0.08, 0.06]} />
        <meshStandardMaterial color="#020204" />
      </mesh>
      {/* Slot frame glowing accent */}
      <mesh position={[0, 0, 0.74]}>
        <boxGeometry args={[1.1, 0.12, 0.02]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Cash bills stack */}
      <group ref={cashRef} position={[0, 0, 0.76]}>
        {/* Bottom bill */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.01, 0.4]} />
          <meshStandardMaterial color="#2d8c4e" />
        </mesh>
        {/* Middle bill (slightly offset) */}
        <mesh position={[0.02, 0.012, 0.01]}>
          <boxGeometry args={[0.8, 0.01, 0.4]} />
          <meshStandardMaterial color="#3aa85e" />
        </mesh>
        {/* Top bill */}
        <mesh position={[-0.01, 0.024, 0.02]}>
          <boxGeometry args={[0.8, 0.01, 0.4]} />
          <meshStandardMaterial color="#45c56a" />
        </mesh>
        {/* Money label */}
        <mesh position={[0, 0.04, 0.1]}>
          <boxGeometry args={[0.3, 0.005, 0.15]} />
          <meshStandardMaterial color="#1a6b35" />
        </mesh>
      </group>
      {/* Status LED */}
      <mesh position={[0.6, 0, 0.76]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color={dispensingProgress > 0.5 ? '#0f0' : '#222'}
          emissive={dispensingProgress > 0.5 ? '#00ff44' : '#000'}
          emissiveIntensity={dispensingProgress > 0.5 ? 3 : 0}
        />
      </mesh>
    </group>
  );
}

// Main ATM Scene
const ATMScene = ({ atmState, atmData, onDigit, onEnter, onClear, onCancel, cardProgress, dispensingProgress = 0 }) => {
  return (
    <>
      <ambientLight intensity={0.25} color="#c8deff" />
      <directionalLight position={[5, 8, 5]} intensity={1.8} color="#ffffff" castShadow />
      <pointLight position={[0, 0.8, 3]} intensity={1.2} color="#00e87b" distance={8} decay={2} />
      <spotLight position={[0, 5, 4]} angle={0.5} penumbra={0.8} intensity={1.5} color="#00d4ff" castShadow />

      <group rotation={[0, -Math.PI / 12, 0]}>
        <ATMChassis atmState={atmState} atmData={atmData} />
        <ATMKeypad onDigit={onDigit} onEnter={onEnter} onClear={onClear} onCancel={onCancel} />
        <CardSlot cardProgress={cardProgress} />
        <CashDispenser dispensingProgress={dispensingProgress} />
      </group>
    </>
  );
};
export default ATMScene;
