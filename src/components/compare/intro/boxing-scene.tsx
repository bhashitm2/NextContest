"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { BoxingCast } from "@/lib/compare-cast";

import { Boxer } from "./boxer";
import { pulse, ramp, T } from "./choreography";

const X = 1.5; // fighter offset from center

/** Resolve a CSS color (incl. `var(--x)`) to a concrete string, else fallback. */
function resolveColor(css: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const m = css.match(/var\((--[\w-]+)\)/);
  if (!m) return css;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || fallback;
}

function lerp3(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  out.copy(a).lerp(b, t);
}

type Key = { t: number; pos: [number, number, number]; look: [number, number, number] };

function CameraRig({ winner }: { winner: BoxingCast["winner"] }) {
  const winnerX = winner === "a" ? -X : winner === "b" ? X : 0;
  const keys = useMemo<Key[]>(
    () => [
      { t: 0.0, pos: [0, 2.7, 7.4], look: [0, 1.2, 0] },
      { t: 1.0, pos: [0, 1.95, 5.2], look: [0, 1.2, 0] },
      { t: 2.0, pos: [3.1, 1.7, 4.0], look: [0, 1.1, 0] },
      { t: 5.0, pos: [1.9, 1.6, 4.4], look: [0, 1.1, 0] },
      { t: T.koImpact, pos: [1.0, 1.45, 3.1], look: [winnerX * 0.5, 1.1, 0] },
      { t: T.koEnd, pos: [1.5, 1.75, 3.7], look: [winnerX * 0.5, 1.2, 0] },
      { t: T.victoryEnd, pos: [winnerX * 0.7, 1.95, 3.9], look: [winnerX * 0.5, 1.3, 0] },
    ],
    [winnerX],
  );

  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }) => {
    const t = Math.min(clock.getElapsedTime(), T.victoryEnd);
    let i = 0;
    while (i < keys.length - 1 && t > keys[i + 1].t) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const span = k1.t - k0.t || 1;
    const raw = (t - k0.t) / span;
    const e = raw * raw * (3 - 2 * raw); // smoothstep

    lerp3(va.set(...k0.pos), vb.set(...k1.pos), e, pos);
    camera.position.copy(pos);
    lerp3(va.set(...k0.look), vb.set(...k1.look), e, look);
    camera.lookAt(look);
  });

  return null;
}

/** Center light that flashes on punches + the KO for impact. */
function ImpactLight({ winner }: { winner: BoxingCast["winner"] }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.getElapsedTime();
    const ko = winner === "tie" ? 0 : pulse(t, T.koImpact, 0.5) * 6;
    const jab = pulse(t, 2.4, 0.2) + pulse(t, 3.5, 0.2) + pulse(t, 4.55, 0.2);
    light.current.intensity = 0.4 + ko + jab * 1.5;
  });
  return <pointLight ref={light} position={[0, 1.4, 0.6]} color="#ffffff" intensity={0.4} distance={6} />;
}

/** Expanding shock ring at the KO moment. */
function ShockRing({ winner }: { winner: BoxingCast["winner"] }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !mat.current || winner === "tie") return;
    const p = ramp(clock.getElapsedTime(), T.koImpact, T.koImpact + 0.7);
    const s = 0.2 + p * 3.2;
    ref.current.scale.set(s, s, s);
    mat.current.opacity = (1 - p) * 0.7;
  });
  return (
    <mesh ref={ref} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.04, 8, 40]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0} toneMapped={false} />
    </mesh>
  );
}

function Ring() {
  const post = (x: number, z: number) => (
    <mesh key={`${x},${z}`} position={[x, 0.6, z]} castShadow>
      <cylinderGeometry args={[0.07, 0.07, 1.2, 10]} />
      <meshStandardMaterial color="#cfd6e6" metalness={0.5} roughness={0.4} />
    </mesh>
  );
  const R = 2.3;
  // Top rail as a thin square outline (4 long boxes).
  const rail = (pos: [number, number, number], horiz: boolean) => (
    <mesh key={`${pos.join()}-${horiz}`} position={pos}>
      <boxGeometry args={horiz ? [R * 2, 0.03, 0.03] : [0.03, 0.03, R * 2]} />
      <meshStandardMaterial color="#8b93a7" emissive="#8b93a7" emissiveIntensity={0.15} />
    </mesh>
  );
  return (
    <group>
      {/* canvas mat */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[5.4, 0.08, 5.4]} />
        <meshStandardMaterial color="#1a2030" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[4.8, 0.02, 4.8]} />
        <meshStandardMaterial color="#222a3d" roughness={0.9} />
      </mesh>
      {[
        [-R, -R],
        [R, -R],
        [R, R],
        [-R, R],
      ].map(([x, z]) => post(x, z))}
      {[0.7, 1.05].flatMap((y) => [
        rail([0, y, -R], true),
        rail([0, y, R], true),
        rail([-R, y, 0], false),
        rail([R, y, 0], false),
      ])}
    </group>
  );
}

export default function BoxingScene({ cast }: { cast: BoxingCast }) {
  const colorA = resolveColor(cast.a.colorCss, cast.a.colorHex);
  const colorB = resolveColor(cast.b.colorCss, cast.b.colorHex);
  const bg = resolveColor("var(--cp-bg)", "#0b0e16");

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 2.7, 7.4], fov: 42 }}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 7, 16]} />

      <hemisphereLight intensity={0.25} color="#dfe6ff" groundColor="#0a0d14" />
      <spotLight
        position={[0, 6, 2.5]}
        angle={0.6}
        penumbra={0.8}
        intensity={3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#ffffff"
      />
      <pointLight position={[-3.5, 2, 2]} intensity={2.2} distance={10} color={colorA} />
      <pointLight position={[3.5, 2, 2]} intensity={2.2} distance={10} color={colorB} />
      <ImpactLight winner={cast.winner} />

      <Ring />
      <ShockRing winner={cast.winner} />

      <group position={[-X, 0.09, 0]} rotation={[0, 0, 0]}>
        <Boxer side="a" winner={cast.winner} color={colorA} avatar={cast.a.avatar} />
      </group>
      <group position={[X, 0.09, 0]} rotation={[0, Math.PI, 0]}>
        <Boxer side="b" winner={cast.winner} color={colorB} avatar={cast.b.avatar} />
      </group>

      <CameraRig winner={cast.winner} />
    </Canvas>
  );
}
