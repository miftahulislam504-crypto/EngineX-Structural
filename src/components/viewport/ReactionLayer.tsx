"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { AnalysisNode, ReactionForce } from "@/lib/analysis/runAnalysis";

/**
 * Phase 10n — Reaction Display Layer।
 *
 * শুধু Linear Static এ reactionForces populate হয় (backend, দেখুন
 * useAnalysisVisualizationStore এর reactionForces field comment) —
 * P-Delta/Nonlinear Static/Response Spectrum/Modal/Buckling/Pushover
 * এ এখনো এই field নেই (backend এর inline dict-builder গুলো এখনো এটা
 * পাঠায় না, ভবিষ্যতে একই penalty-method প্যাটার্নে যোগ করা যাবে)।
 *
 * প্রতিটা reaction এ শুধু force component (Fx,Fy,Fz) কে arrow (THREE.js
 * ArrowHelper জ্যামিতি দিয়ে হাতে বানানো cone+cylinder, drei তে
 * প্রস্তুত arrow component নেই) হিসেবে আঁকা হয়, node position থেকে
 * শুরু করে reaction direction এ। Moment reaction (Mx,My,Mz) numeric
 * label এ দেখানো হয় (arrow দিয়ে moment vector আঁকা bending-vs-torsion
 * বিভ্রান্তিকর হতে পারে ছোট viewport এ, তাই সংখ্যা-ই যথেষ্ট স্পষ্ট)।
 *
 * Reaction vector ইতিমধ্যে global coordinate এ (local axis transform
 * লাগে না, backend সরাসরি global DOF থেকে reaction দেয়) — তাই এখানে
 * কোনো localAxisTransform ব্যবহার করা হয়নি, 10m এর diagram থেকে এই
 * দিক থেকে সহজ।
 */

interface ReactionLayerProps {
  nodes: AnalysisNode[];
  reactionForces: ReactionForce[];
  scale: number;
  showMoments: boolean;
}

const ARROW_COLOR = "#22c55e"; // সবুজ — reaction force (support থেকে structure এর উপর প্রযুক্ত)
const MIN_MAGNITUDE_KN = 1e-3; // এর চেয়ে ছোট reaction (numerically শূন্যের কাছাকাছি, যেমন lateral-only support এ vertical) আঁকা হয় না

function ReactionArrow({
  origin,
  direction,
  magnitude,
  scale,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  magnitude: number;
  scale: number;
}) {
  // Arrow দৈর্ঘ্য magnitude ধরে না (visually overwhelming/tiny হতে
  // পারে) — বরং scale prop দিয়ে user-adjustable একটা base length,
  // ETABS এর reaction display এর কাছাকাছি স্টাইল (সব arrow একই আকার,
  // magnitude সংখ্যা label এ)।
  const length = scale;
  const headLength = Math.min(0.2, length * 0.3);
  const headWidth = Math.min(0.1, length * 0.15);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    return q;
  }, [direction]);

  const shaftEnd = origin.clone().add(direction.clone().multiplyScalar(length - headLength));
  const shaftMid = origin.clone().add(direction.clone().multiplyScalar((length - headLength) / 2));
  const headCenter = origin.clone().add(direction.clone().multiplyScalar(length - headLength / 2));

  return (
    <group>
      <mesh position={shaftMid} quaternion={quaternion}>
        <cylinderGeometry args={[0.02, 0.02, length - headLength, 8]} />
        <meshStandardMaterial color={ARROW_COLOR} />
      </mesh>
      <mesh position={headCenter} quaternion={quaternion}>
        <coneGeometry args={[headWidth, headLength, 8]} />
        <meshStandardMaterial color={ARROW_COLOR} />
      </mesh>
      <Text
        position={[shaftEnd.x, shaftEnd.y + 0.15, shaftEnd.z]}
        fontSize={0.15}
        color={ARROW_COLOR}
        anchorX="center"
        anchorY="bottom"
      >
        {magnitude.toFixed(1)} kN
      </Text>
    </group>
  );
}

export function ReactionLayer({ nodes, reactionForces, scale, showMoments }: ReactionLayerProps) {
  return (
    <group>
      {reactionForces.map((r, i) => {
        const node = nodes[r.nodeIndex];
        if (!node) return null; // reaction nodeIndex nodes[] এর বাইরে হলে (defensive — সাধারণত হওয়ার কথা না)

        const forceVec = new THREE.Vector3(r.fx, r.fy, r.fz);
        const magnitude = forceVec.length();
        if (magnitude < MIN_MAGNITUDE_KN) return null;

        const origin = new THREE.Vector3(node.x, node.y, node.z);
        const direction = forceVec.clone().normalize();

        const momentMagnitude = Math.sqrt(r.mx * r.mx + r.my * r.my + r.mz * r.mz);

        return (
          <group key={`reaction-${r.nodeIndex}-${i}`}>
            <ReactionArrow origin={origin} direction={direction} magnitude={magnitude} scale={scale} />
            {showMoments && momentMagnitude > MIN_MAGNITUDE_KN && (
              <Text
                position={[node.x, node.y - 0.25, node.z]}
                fontSize={0.13}
                color="#a78bfa"
                anchorX="center"
                anchorY="top"
              >
                {`M: ${momentMagnitude.toFixed(1)} kN·m`}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}
