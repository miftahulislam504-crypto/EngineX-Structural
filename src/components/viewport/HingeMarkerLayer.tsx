"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import type { StructuralElement } from "@/lib/types/element";
import type { PlasticHingeState } from "@/lib/analysis/runAnalysis";

/**
 * Phase 10r — Crack Prediction / Failure Visualization, honest partial।
 *
 * সততার সাথে সীমাবদ্ধতা: PlasticHingeState শুধু চূড়ান্ত converged
 * অবস্থা দেয় (Nonlinear Static এর শেষ load step এর পরে, বা Pushover
 * এর finalHingeStates — শেষ push step এর পরে)। কোনো step-by-step
 * progressive animation তথ্য এখানে নেই — backend প্রতিটা intermediate
 * push step এ hinge state আলাদা করে রাখে না, শুধু শেষ অবস্থা। তাই এই
 * layer একটা static snapshot marker দেখায় (yielded/not-yielded),
 * "ক্রমান্বয়ে কোন হিঞ্জ কোন লোড লেভেলে yield করলো" এমন animation না
 * — সেটা ভবিষ্যতের কাজ (backend এ প্রতিটা push step এর hinge state
 * সংরক্ষণ করতে হবে, বড় ডেটা volume বৃদ্ধি পাবে তাই আলাদা সিদ্ধান্ত
 * প্রয়োজন)।
 *
 * "Crack Prediction" নামেও honest সীমাবদ্ধতা: আমাদের কোনো real crack-
 * width বা concrete cracking model নেই — plastic hinge yielded হওয়া
 * মানেই সেই লোকেশনে concrete crack করবে এটা একটা reasonable proxy
 * (হিঞ্জ yield করা মানে reinforcement yield stress এ পৌঁছেছে, যেটা
 * flexural crack এর সাথে সম্পর্কিত), কিন্তু এটা কোনো ACI/BNBC crack-
 * width formula থেকে আসেনি। শুধু yielded/not-yielded একটা binary
 * indicator, crack width বা spacing না।
 */

interface HingeMarkerLayerProps {
  elements: StructuralElement[];
  hingeStates: PlasticHingeState[];
  showLabels: boolean;
}

const COLOR_YIELDED = "#ef4444"; // লাল — yielded (concrete crack/rebar yield প্রত্যাশিত)
const COLOR_NOT_YIELDED = "#64748b"; // ধূসর — hinge assigned কিন্তু yield করেনি (elastic, তুলনামূলক ফিকে)

export function HingeMarkerLayer({ elements, hingeStates, showLabels }: HingeMarkerLayerProps) {
  const elementById = useMemo(() => {
    const map = new Map<string, StructuralElement>();
    for (const el of elements) map.set(el.elementId, el);
    return map;
  }, [elements]);

  return (
    <group>
      {hingeStates.map((h, i) => {
        const element = elementById.get(h.elementId);
        if (!element || !("startPoint" in element) || !("endPoint" in element)) return null;

        const position = h.isAtStartNode ? element.startPoint : element.endPoint;
        const color = h.yielded ? COLOR_YIELDED : COLOR_NOT_YIELDED;
        const size = h.yielded ? 0.12 : 0.08;

        return (
          <group key={`hinge-${h.elementId}-${h.isAtStartNode ? "start" : "end"}-${i}`}>
            <mesh position={[position.x, position.y, position.z]}>
              <sphereGeometry args={[size, 12, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={h.yielded ? 0.5 : 0.1} />
            </mesh>
            {showLabels && h.yielded && (
              <Text
                position={[position.x, position.y + 0.2, position.z]}
                fontSize={0.12}
                color={COLOR_YIELDED}
                anchorX="center"
                anchorY="bottom"
              >
                {`θp: ${h.plasticRotationRad.toFixed(4)} rad`}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}
