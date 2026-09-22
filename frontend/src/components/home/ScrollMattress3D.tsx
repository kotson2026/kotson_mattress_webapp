import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface ScrollMattress3DProps {
  progress: number; // 0 to 1
  prefersReduced: boolean;
  activeLayerId: string | null;
  onHoverLayer?: (id: string | null) => void;
}

// ─── Physics Simulation Calculations ──────────────────────────────────────────
// Progress Ranges:
// 0.00 – 0.15 : Initial exploded overview
// 0.15 – 0.40 : Cotton Zip Cover falls onto Latex Core (light settle)
// 0.40 – 0.75 : Bamboo Cover falls onto Cotton Cover (gravity, compression, micro-rebound)
// 0.75 – 0.90 : Final compression & joint alignment
// 0.90 – 1.00 : Complete unified mattress with subtle interactive perspective inspection

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Calculates dynamic layer Y position based on scroll progress
function calculateLayerY(layer: "core" | "casing" | "cover", progress: number, reducedMotion: boolean) {
  if (reducedMotion) {
    // Static clear exploded view for reduced motion
    if (layer === "core") return 0.22;
    if (layer === "casing") return 1.05;
    if (layer === "cover") return 1.95;
    return 0;
  }

  // 1. Core (Base): Stable anchor. Settles subtly as upper layers add physical weight.
  if (layer === "core") {
    const baseY = 0.24;
    // When cotton lands (progress 0.25 - 0.38) & bamboo lands (progress 0.55 - 0.72), core experiences tiny weight compression (-0.02)
    let weightDip = 0;
    if (progress > 0.3) {
      weightDip += 0.012 * Math.min(1, (progress - 0.3) / 0.1);
    }
    if (progress > 0.65) {
      weightDip += 0.015 * Math.min(1, (progress - 0.65) / 0.15);
    }
    return baseY - weightDip;
  }

  // 2. Cotton Zip Cover (Middle): Thinner, lighter. Falls between progress 0.18 and 0.48.
  if (layer === "casing") {
    const initialY = 1.15; // Exploded start
    const finalY = 0.52; // Sitting atop core

    if (progress <= 0.16) {
      return initialY;
    }
    if (progress < 0.46) {
      const p = (progress - 0.16) / (0.46 - 0.16);
      // Gravity acceleration with slight cushion settle
      const fall = easeInQuad(p);
      let y = initialY - (initialY - finalY) * fall;
      // 2% contact compression on impact around p=0.85
      if (p > 0.85) {
        const impact = (p - 0.85) / 0.15;
        const compression = Math.sin(impact * Math.PI) * 0.018;
        y -= compression;
      }
      return y;
    }
    // Completed state
    return finalY;
  }

  // 3. 100% Pure Bamboo Cover (Top): Starts high, falls between progress 0.42 and 0.78.
  if (layer === "cover") {
    const initialY = 2.15; // High exploded start
    const finalY = 0.66; // Sitting directly atop cotton cover

    if (progress <= 0.4) {
      return initialY;
    }
    if (progress < 0.76) {
      const p = (progress - 0.4) / (0.76 - 0.4);
      // Realistic gravity descent with contact deceleration
      const fall = Math.pow(p, 1.75);
      let y = initialY - (initialY - finalY) * fall;

      // Surface impact: compression dip (3%) followed by micro-settling
      if (p > 0.82) {
        const impact = (p - 0.82) / 0.18;
        // Compression wave: dips down then settles
        const compression = Math.sin(impact * Math.PI * 1.5) * 0.024 * (1 - impact * 0.5);
        y -= Math.max(0, compression);
      }
      return y;
    }
    // Fully assembled joined position with settled tension
    return finalY;
  }

  return 0;
}

// ─── Individual Layer Meshes ──────────────────────────────────────────────────

// 1. Organic Latex Core (Dunlop aerated core with pin-hole zone markings)
function LatexCoreMesh({
  yPos,
  isHighlighted,
}: {
  yPos: number;
  isHighlighted: boolean;
}) {
  const geometry = useMemo(() => new RoundedBoxGeometry(3.2, 0.44, 2.18, 4, 0.06), []);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissive.set(isHighlighted ? "#7C9C59" : "#000000");
    matRef.current.emissiveIntensity = isHighlighted ? 0.28 : 0;
  });

  return (
    <group position={[0, yPos, 0]}>
      {/* Main Organic Latex Core */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={matRef}
          color="#E8DFC8"
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>

      {/* Subtle visual zone indentation grooves on surface to represent 7 anatomical zones */}
      {[-0.9, -0.45, 0, 0.45, 0.9].map((zOffset, idx) => (
        <mesh key={idx} position={[zOffset, 0.222, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.08, 2.14]} />
          <meshBasicMaterial color="#DACFB5" opacity={0.45} transparent />
        </mesh>
      ))}
    </group>
  );
}

// 2. Thin Cotton Zip Cover (Lightweight unbleached organic casing)
function CottonCoverMesh({
  yPos,
  isHighlighted,
}: {
  yPos: number;
  isHighlighted: boolean;
}) {
  const geometry = useMemo(() => new RoundedBoxGeometry(3.24, 0.12, 2.22, 4, 0.04), []);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissive.set(isHighlighted ? "#7C9C59" : "#000000");
    matRef.current.emissiveIntensity = isHighlighted ? 0.26 : 0;
  });

  return (
    <group position={[0, yPos, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={matRef}
          color="#F5EFE4"
          roughness={0.92}
          metalness={0.0}
        />
      </mesh>
      {/* Perimeter zip seam highlight */}
      <mesh position={[0, 0, 1.115]}>
        <boxGeometry args={[3.24, 0.016, 0.005]} />
        <meshStandardMaterial color="#C8BFAB" roughness={0.6} />
      </mesh>
    </group>
  );
}

// 3. 100% Pure Bamboo Cover (Silky quilted surface with subtle green piped perimeter)
function BambooCoverMesh({
  yPos,
  isHighlighted,
}: {
  yPos: number;
  isHighlighted: boolean;
}) {
  const geometry = useMemo(() => new RoundedBoxGeometry(3.28, 0.16, 2.26, 4, 0.05), []);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissive.set(isHighlighted ? "#7C9C59" : "#000000");
    matRef.current.emissiveIntensity = isHighlighted ? 0.28 : 0;
  });

  return (
    <group position={[0, yPos, 0]}>
      {/* Main Quilted Bamboo Knit */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={matRef}
          color="#FAF8F2"
          roughness={0.82}
          metalness={0.01}
        />
      </mesh>

      {/* Signature Kotson sage green piped perimeter border */}
      <mesh position={[0, 0.075, 1.135]}>
        <boxGeometry args={[3.27, 0.018, 0.012]} />
        <meshStandardMaterial color="#7C9C59" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.075, -1.135]}>
        <boxGeometry args={[3.27, 0.018, 0.012]} />
        <meshStandardMaterial color="#7C9C59" roughness={0.6} />
      </mesh>
      <mesh position={[1.635, 0.075, 0]}>
        <boxGeometry args={[0.012, 0.018, 2.26]} />
        <meshStandardMaterial color="#7C9C59" roughness={0.6} />
      </mesh>
      <mesh position={[-1.635, 0.075, 0]}>
        <boxGeometry args={[0.012, 0.018, 2.26]} />
        <meshStandardMaterial color="#7C9C59" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Scene Assembly with Distance-Reacting Contact Shadows ─────────────────────
function AssemblyScene({
  progress,
  prefersReduced,
  activeLayerId,
}: {
  progress: number;
  prefersReduced: boolean;
  activeLayerId: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointerState = useRef<{ x: number; y: number; down: boolean; dragX: number; dragY: number }>({
    x: 0,
    y: 0,
    down: false,
    dragX: 0,
    dragY: 0,
  });

  // Calculate live layer Y coordinates
  const coreY = useMemo(() => calculateLayerY("core", progress, prefersReduced), [progress, prefersReduced]);
  const casingY = useMemo(() => calculateLayerY("casing", progress, prefersReduced), [progress, prefersReduced]);
  const coverY = useMemo(() => calculateLayerY("cover", progress, prefersReduced), [progress, prefersReduced]);

  // Distance between casing and core (tightens shadow)
  const casingGap = Math.max(0, casingY - coreY - 0.28);
  const coverGap = Math.max(0, coverY - casingY - 0.14);

  // Shadow opacity reacts to vertical gap
  const casingShadowOpacity = Math.max(0.12, 0.48 - casingGap * 0.35);
  const coverShadowOpacity = Math.max(0.12, 0.52 - coverGap * 0.32);

  // Restrained desktop perspective tilt after complete assembly (progress > 0.85)
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (progress > 0.82 && !prefersReduced) {
      const targetRotY = 0.48 + pointerState.current.x * 0.24 + pointerState.current.dragX * 0.3;
      const targetRotX = 0.22 - pointerState.current.y * 0.15 + pointerState.current.dragY * 0.2;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotY, 6, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotX, 6, delta);
    } else {
      // Standard iconic isometric 3/4 viewpoint
      const baseRotY = 0.52 - progress * 0.08;
      const baseRotX = 0.24 - progress * 0.04;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, baseRotY, 8, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, baseRotX, 8, delta);
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerMove={(e) => {
        // Normalized -1 to 1 pointer offset
        pointerState.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
        pointerState.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
        if (pointerState.current.down && progress > 0.82) {
          pointerState.current.dragX = Math.max(-0.4, Math.min(0.4, pointerState.current.dragX + e.movementX * 0.003));
          pointerState.current.dragY = Math.max(-0.25, Math.min(0.25, pointerState.current.dragY + e.movementY * 0.003));
        }
      }}
      onPointerDown={() => {
        pointerState.current.down = true;
      }}
      onPointerUp={() => {
        pointerState.current.down = false;
      }}
      onPointerLeave={() => {
        pointerState.current.down = false;
      }}
    >
      {/* 1. Base Layer: GOLS-Certified 100% Organic Latex Core */}
      <LatexCoreMesh yPos={coreY} isHighlighted={activeLayerId === "core"} />

      {/* Dynamic contact shadow between Cotton Cover and Latex Core */}
      <mesh position={[0, coreY + 0.222, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 2.16]} />
        <meshBasicMaterial color="#000000" transparent opacity={casingShadowOpacity} />
      </mesh>

      {/* 2. Middle Layer: Thin Cotton Zip Cover */}
      <CottonCoverMesh yPos={casingY} isHighlighted={activeLayerId === "casing"} />

      {/* Dynamic contact shadow between Bamboo Cover and Cotton Cover */}
      <mesh position={[0, casingY + 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.22, 2.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={coverShadowOpacity} />
      </mesh>

      {/* 3. Top Layer: 100% Pure Bamboo Cover */}
      <BambooCoverMesh yPos={coverY} isHighlighted={activeLayerId === "cover"} />

      {/* Main grounding shadow receiver beneath whole mattress on warm floor */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <shadowMaterial opacity={0.16 + progress * 0.1} />
      </mesh>
    </group>
  );
}

// ─── Root 3D Component Export ─────────────────────────────────────────────────
export default function ScrollMattress3D({
  progress,
  prefersReduced,
  activeLayerId,
}: ScrollMattress3DProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [4.4, 3.4, 4.8], fov: 38 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      style={{ touchAction: "none" }}
      aria-label="Kotson mattress physical 3D layer construction"
    >
      {/* Warm botanical ambient and key lighting */}
      <ambientLight intensity={0.95} color="#FAF7EE" />
      <directionalLight
        position={[-3.8, 6.5, 3.2]}
        intensity={1.3}
        color="#FFFDF7"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[4, 2, -3]} intensity={0.35} color="#EEF4E8" />
      <pointLight position={[0, 4, 0]} intensity={0.25} color="#FAF8F5" />

      <AssemblyScene
        progress={progress}
        prefersReduced={prefersReduced}
        activeLayerId={activeLayerId}
      />
    </Canvas>
  );
}
