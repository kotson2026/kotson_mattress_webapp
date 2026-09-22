import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Bottom-to-top real structure: frame → support base → organic latex core → cotton casing → bamboo cover → pillows.
interface Layer {
  id: string;
  name: string;
  color: string;
  size: [number, number, number];
  yEnd: number;
  delay: number;
}

const LAYERS: Layer[] = [
  { id: "frame", name: "Teak slatted platform", color: "#785338", size: [3.4, 0.28, 2.4], yEnd: 0.14, delay: 0 },
  { id: "support", name: "Support base (high-density latex)", color: "#C9BBA4", size: [3.2, 0.34, 2.2], yEnd: 0.45, delay: 0.5 },
  { id: "core", name: "Organic latex core — 7 zones", color: "#E6DEC9", size: [3.1, 0.5, 2.1], yEnd: 0.87, delay: 1.1 },
  { id: "casing", name: "Organic cotton casing", color: "#F3EDE0", size: [3.16, 0.22, 2.16], yEnd: 1.23, delay: 1.8 },
  { id: "cover", name: "Bamboo knit cover", color: "#EDF2E4", size: [3.2, 0.14, 2.2], yEnd: 1.41, delay: 2.4 },
  { id: "pillow", name: "Organic latex pillows", color: "#FBFAF6", size: [1.1, 0.22, 0.7], yEnd: 1.62, delay: 3.0 },
];

function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

function LayerMesh({ layer, reducedMotion, highlight }: { layer: Layer; reducedMotion: boolean; highlight: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const startY = layer.yEnd + 7;
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion) {
      mesh.position.y = layer.yEnd;
      return;
    }
    const t = clock.getElapsedTime();
    const p = Math.min(1, Math.max(0, (t - layer.delay) / 1.1));
    mesh.position.y = startY + (layer.yEnd - startY) * easeOutBounce(p);
  });
  const geometry = useMemo(
    () => new RoundedBoxGeometry(layer.size[0], layer.size[1], layer.size[2], 3, Math.min(0.12, layer.size[1] / 2)),
    [layer.size]
  );
  return (
    <mesh ref={ref} geometry={geometry} position={[layer.id === "pillow" ? 0.9 : 0, layer.yEnd + 7, 0]} castShadow>
      <meshStandardMaterial
        color={layer.color}
        roughness={0.85}
        emissive={highlight ? new THREE.Color("#7C9C59") : new THREE.Color("#000000")}
        emissiveIntensity={highlight ? 0.35 : 0}
      />
    </mesh>
  );
}

function Scene({ reducedMotion, highlightId }: { reducedMotion: boolean; highlightId: string | null }) {
  const group = useRef<THREE.Group>(null);
  const drag = useRef<{ down: boolean; x: number }>({ down: false, x: 0 });
  useFrame((_, delta) => {
    if (!group.current) return;
    if (!drag.current.down && !reducedMotion) group.current.rotation.y += delta * 0.18; // slow auto-rotate, paused while interacting
  });
  return (
    <group
      ref={group}
      onPointerDown={(e: { clientX: number }) => {
        drag.current = { down: true, x: e.clientX };
      }}
      onPointerUp={() => (drag.current.down = false)}
      onPointerLeave={() => (drag.current.down = false)}
      onPointerMove={(e: { clientX: number }) => {
        if (drag.current.down && group.current) {
          group.current.rotation.y += (e.clientX - drag.current.x) * 0.01;
          drag.current.x = e.clientX;
        }
      }}
    >
      {LAYERS.map((l) => (
        <LayerMesh key={l.id} layer={l} reducedMotion={reducedMotion} highlight={highlightId === l.id} />
      ))}
    </group>
  );
}

export default function MattressAssembly3D({ highlightId }: { highlightId: string | null }) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (webgl === null) return <div className="h-full w-full animate-pulse rounded-2xl bg-brand-sand" aria-hidden="true" />;
  if (!webgl) return null; // Home renders the static fallback in this slot

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [4.6, 3.2, 5.4], fov: 40 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      style={{ touchAction: "pan-y" }}
      aria-label="Interactive 3D mattress assembly — drag to rotate"
    >
      <ambientLight intensity={0.85} color="#FFFDF5" />
      <directionalLight position={[-4, 6, 3]} intensity={1.2} />
      <pointLight position={[3, 2, -3]} intensity={0.4} color="#9EC379" />
      <Scene reducedMotion={reducedMotion} highlightId={highlightId} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
    </Canvas>
  );
}

export { LAYERS };
