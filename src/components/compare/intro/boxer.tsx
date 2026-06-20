"use client";

import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { Winner } from "@/lib/compare";

import { easeInOut, PUNCH_BEATS, pulse, ramp, T } from "./choreography";

/** Loads an avatar as a texture (crossOrigin). Returns null on failure so the
 * badge can fall back to a flat color disc — no canvas read-back, so a CORS
 * taint just means the image silently doesn't appear. */
function useAvatarTexture(url: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        if (alive) setTex(t);
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return tex;
}

/**
 * One low-poly boxer built entirely from primitives. Faces +X (local forward,
 * toward the opponent at center); the scene places + y-rotates it. All motion is
 * transform-based off the shared scene clock — no skeletons.
 */
export function Boxer({
  side,
  winner,
  color,
  avatar,
}: {
  side: "a" | "b";
  winner: Winner;
  color: string;
  avatar: string | null;
}) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const frontGlove = useRef<THREE.Mesh>(null);
  const rearGlove = useRef<THREE.Mesh>(null);

  const tex = useAvatarTexture(avatar);
  const col = useMemo(() => new THREE.Color(color), [color]);
  const trim = useMemo(() => col.clone().multiplyScalar(0.45), [col]);

  const isLoser = winner !== "tie" && winner !== side;
  const isWinner = winner !== "tie" && winner === side;
  const phase = side === "a" ? 0 : Math.PI * 0.5;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!body.current || !head.current || !frontGlove.current || !rearGlove.current) return;

    const bob = Math.sin(t * 4 + phase) * 0.035;

    // Jabs this fighter throws; recoil from the opponent's that land.
    let punch = 0;
    let recoil = 0;
    for (const beat of PUNCH_BEATS) {
      if (beat.side === side) punch = Math.max(punch, pulse(t, beat.t, 0.34));
      else recoil = Math.max(recoil, pulse(t, beat.t + 0.12, 0.3));
    }

    // Close the distance after the face-off so punches actually land, then hold
    // at fighting range. Each fighter starts 1.5 from center; closing 1.0 leaves
    // them ~1.0 apart — within reach once the gloves extend.
    const CLOSE = 1.0;
    const approach = easeInOut(ramp(t, 0.8, 2.3)) * CLOSE;

    const lunge = isWinner ? pulse(t, T.koImpact - 0.12, 0.55) : 0;

    let x = approach + punch * 0.14; // step into each punch
    let tilt = -punch * 0.1; // lean into the punch
    let drop = 0;
    let gloveUp = 0;

    if (winner === "tie") {
      x -= easeInOut(ramp(t, T.exchangeEnd, T.koEnd)) * 0.5; // break apart
    } else if (isLoser) {
      const k = easeInOut(ramp(t, T.koImpact, T.koEnd));
      tilt = k * 1.5; // fall backward
      drop = k * 0.55;
      x -= k * 0.8; // knocked back by the finishing blow
      recoil = Math.max(recoil, pulse(t, T.koImpact, 0.45));
    } else if (isWinner) {
      gloveUp = easeInOut(ramp(t, T.koEnd, T.victoryEnd));
      x += lunge * 0.55 - gloveUp * 0.45; // lunge in for the KO, then settle back
    }

    body.current.position.x = x;
    body.current.position.y = bob - drop;
    body.current.rotation.z = tilt;

    head.current.position.x = -recoil * 0.12;
    head.current.rotation.z = recoil * 0.22;

    // Front glove drives forward on jabs + the finishing blow; both raise on victory.
    frontGlove.current.position.x = 0.34 + (punch + lunge) * 0.62;
    frontGlove.current.position.y = 1.0 + gloveUp * 0.7;
    rearGlove.current.position.x = 0.26 + gloveUp * 0.1;
    rearGlove.current.position.y = 1.02 + gloveUp * 0.7;
  });

  return (
    <group ref={body}>
      {/* legs */}
      <mesh position={[0, 0.28, 0.16]} castShadow>
        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
        <meshStandardMaterial color={trim} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.28, -0.16]} castShadow>
        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
        <meshStandardMaterial color={trim} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* torso */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.46, 6, 12]} />
        <meshStandardMaterial
          color={col}
          roughness={0.4}
          metalness={0.2}
          emissive={col}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* head */}
      <group ref={head} position={[0, 1.45, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color={trim} roughness={0.5} metalness={0.15} />
        </mesh>
        {/* headguard ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.05, 8, 20]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
      </group>

      {/* gloves */}
      <mesh ref={frontGlove} position={[0.34, 1.0, 0.2]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.25} roughness={0.35} />
      </mesh>
      <mesh ref={rearGlove} position={[0.26, 1.02, -0.2]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.25} roughness={0.35} />
      </mesh>

      {/* avatar badge — billboard above the head, faces the camera */}
      <Billboard position={[0, 2.05, 0]}>
        <mesh>
          <circleGeometry args={[0.26, 32]} />
          <meshBasicMaterial color={tex ? "#ffffff" : col} map={tex ?? undefined} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <ringGeometry args={[0.26, 0.31, 32]} />
          <meshBasicMaterial color={col} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}
