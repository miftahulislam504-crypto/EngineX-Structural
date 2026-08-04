"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { RebarSegment, RebarLoop } from "@/lib/detailing/types";
import type { Point3D } from "@/lib/types/element";

/**
 * RebarMesh — একটা single DetailingResult কে world-space এ render করে।
 *
 * Local → World transform:
 *   Line elements (beam/column) এর জন্য local frame টা
 *   ElementsLayer-এর LineElementMesh যে quaternion ব্যবহার করে (Y-axis
 *   থেকে start→end direction) ঠিক সেটাই পুনর্ব্যবহার করা হয়েছে — তাই
 *   detailing generator-এর local y-axis (bar length বরাবর beam-এ,
 *   height বরাবর column-এ) সরাসরি সেই rotation-এ map হয়।
 *
 *   Area elements (slab/wall/footing) এর জন্য local frame-টা একটা
 *   axis-aligned translation (XZ plane প্রায় world-aligned ধরা হয়েছে,
 *   V1 সরলীকরণ — arbitrary-rotated wall panel পরের রিফাইনমেন্ট)।
 *
 * সব local coordinate মিমি এককে, world scene মিটার এককে — তাই ÷1000।
 */

interface RebarMeshProps {
  longitudinalBars: RebarSegment[];
  transverseBars: RebarLoop[];
  meshBars?: RebarSegment[];
  originWorld: Point3D; // local (0,0,0) কোথায় বসবে world-space এ
  quaternion?: THREE.Quaternion; // line elements এর জন্য rotation, area elements এ undefined (identity)
  visible: boolean;
  showStirrups: boolean;
  showMesh: boolean;
  colorLongitudinal?: string;
  colorTransverse?: string;
}

const DEFAULT_LONG_COLOR = "#facc15"; // amber-yellow, খালি চোখে concrete থেকে সহজে আলাদা করা যায়
const DEFAULT_TRANSVERSE_COLOR = "#38bdf8"; // sky, stirrup/tie আলাদা করে চেনার জন্য

function localToWorld(p: [number, number, number], origin: Point3D, quat?: THREE.Quaternion): THREE.Vector3 {
  const local = new THREE.Vector3(p[0] / 1000, p[1] / 1000, p[2] / 1000);
  if (quat) local.applyQuaternion(quat);
  return local.add(new THREE.Vector3(origin.x, origin.y, origin.z));
}

export function RebarMesh({
  longitudinalBars,
  transverseBars,
  meshBars,
  originWorld,
  quaternion,
  visible,
  showStirrups,
  showMesh,
  colorLongitudinal = DEFAULT_LONG_COLOR,
  colorTransverse = DEFAULT_TRANSVERSE_COLOR,
}: RebarMeshProps) {
  const longSegments = useMemo(
    () =>
      longitudinalBars.map((bar) => {
        const start = localToWorld(bar.startLocal, originWorld, quaternion);
        const end = localToWorld(bar.endLocal, originWorld, quaternion);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        // radius মিটারে, বাস্তব bar diameter অনুযায়ী (mm/2/1000) — খুবই সরু হলে দেখতে কঠিন হয়, তাই ন্যূনতম visual radius রাখা হয়েছে
        const radius = Math.max(bar.diameterMm / 2 / 1000, 0.004);
        return { id: bar.id, mid, quat, length, radius };
      }),
    [longitudinalBars, originWorld, quaternion]
  );

  const meshSegments = useMemo(
    () =>
      (meshBars ?? []).map((bar) => {
        const start = localToWorld(bar.startLocal, originWorld, quaternion);
        const end = localToWorld(bar.endLocal, originWorld, quaternion);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        const radius = Math.max(bar.diameterMm / 2 / 1000, 0.003);
        return { id: bar.id, mid, quat, length, radius };
      }),
    [meshBars, originWorld, quaternion]
  );

  const loopLines = useMemo(
    () =>
      transverseBars.map((loop) => ({
        id: loop.id,
        points: loop.pointsLocal.map((p) => localToWorld(p, originWorld, quaternion)),
      })),
    [transverseBars, originWorld, quaternion]
  );

  if (!visible) return null;

  return (
    <group>
      {longSegments.map((seg) => (
        <mesh key={seg.id} position={seg.mid} quaternion={seg.quat}>
          <cylinderGeometry args={[seg.radius, seg.radius, seg.length, 8]} />
          <meshStandardMaterial color={colorLongitudinal} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}

      {showMesh &&
        meshSegments.map((seg) => (
          <mesh key={seg.id} position={seg.mid} quaternion={seg.quat}>
            <cylinderGeometry args={[seg.radius, seg.radius, seg.length, 6]} />
            <meshStandardMaterial color={colorLongitudinal} metalness={0.2} roughness={0.6} />
          </mesh>
        ))}

      {showStirrups &&
        loopLines.map((loop) => (
          <Line key={loop.id} points={loop.points} color={colorTransverse} lineWidth={1.5} />
        ))}
    </group>
  );
}
