"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { StructuralElement } from "@/lib/types/element";
import type { ElementEndForce } from "@/lib/analysis/runAnalysis";
import {
  buildDiagramSamples,
  buildDiagramWorldPoints,
  type DiagramQuantity,
} from "@/lib/viewport/forceDiagramGeometry";
import {
  computeVisualizationRenderState,
} from "@/lib/viewport/visualizationElementFilter";

/**
 * Phase 10m — Moment/Shear/Axial Diagram Layer।
 *
 * শুধু line element category (beam/column/brace/pile) কভার করে —
 * backend এর elementEndForces শুধু frame element এর জন্যই আছে (Phase
 * 4a এর standing limitation, shell এর কোনো force recovery নেই, শুধু
 * displacement)। তাই Slab/Wall/ইত্যাদির জন্য কোনো diagram আঁকা হয় না,
 * সাইলেন্টলি বাদ (ভুল ডেটা দেখানোর চেয়ে ভালো)।
 *
 * প্রতিটা element এর জন্য দুইটা independent polyline আঁকা হয় (moment/
 * shear এর জন্য — dual-axis quantity): local Y plane এ একটা curve
 * (Mz/Vy, কমলা রং), local Z plane এ আরেকটা (My/Vz, আকাশি রং)। Axial
 * এর জন্য শুধু Y-plane curve আঁকা হয় (scalar, single value, Z সবসময়
 * 0)। প্রতিটা polyline এর সাথে "rung" line (baseline element axis
 * থেকে diagram curve পর্যন্ত ছোট সংযোগ রেখা) দেওয়া হয় ETABS এর
 * diagram-ribbon স্টাইল অনুকরণ করে, যাতে zero-crossing ও magnitude
 * visually স্পষ্ট বোঝা যায়।
 *
 * elementEndForces একটা flat array যেখানে একই elementId এর একাধিক
 * entry থাকতে পারে (mid-span split, দেখুন ElementEndForce এর doc-
 * comment) — তাই এখানে প্রথমে elementId অনুযায়ী group করা হয়
 * (useMemo তে, প্রতিবার render এ recompute না করতে)।
 */

interface ForceDiagramLayerProps {
  elements: StructuralElement[];
  elementEndForces: ElementEndForce[];
  quantity: DiagramQuantity;
  scale: number;
  categoryVisibility: Record<string, boolean>;
  isolatedStoryId: string | null;
  fadeNonIsolated: boolean;
}

const LINE_CATEGORIES = new Set(["beam", "column", "brace", "pile"]);

const COLOR_Y_PLANE = "#f97316"; // orange — local Y plane (Mz/Vy/axial)
const COLOR_Z_PLANE = "#38bdf8"; // sky blue — local Z plane (My/Vz)

export function ForceDiagramLayer({
  elements,
  elementEndForces,
  quantity,
  scale,
  categoryVisibility,
  isolatedStoryId,
  fadeNonIsolated,
}: ForceDiagramLayerProps) {
  const forcesByElementId = useMemo(() => {
    const map = new Map<string, ElementEndForce[]>();
    for (const f of elementEndForces) {
      const arr = map.get(f.elementId);
      if (arr) arr.push(f);
      else map.set(f.elementId, [f]);
    }
    return map;
  }, [elementEndForces]);

  return (
    <group>
      {elements.map((element) => {
        if (!LINE_CATEGORIES.has(element.category)) return null;
        const forces = forcesByElementId.get(element.elementId);
        if (!forces || forces.length === 0) return null;

        const renderState = computeVisualizationRenderState(element, {
          categoryVisible: categoryVisibility[element.category] ?? true,
          isolatedStoryId,
          fadeNonIsolated,
        });
        if (!renderState.visible) return null;

        // startPoint/endPoint শুধু beam/column/brace/pile (LineElement) এ থাকে,
        // TypeScript union narrowing এর জন্য runtime guard।
        if (!("startPoint" in element) || !("endPoint" in element)) return null;

        const samples = buildDiagramSamples(forces, quantity);
        const worldPoints = buildDiagramWorldPoints(element.startPoint, element.endPoint, samples, scale);

        if (worldPoints.length < 2) return null;

        const baselinePoints = worldPoints.map((p) => p.position);
        const yPlanePoints = worldPoints.map((p) => p.offsetPositionY);
        const zPlanePoints = worldPoints.map((p) => p.offsetPositionZ);

        // Axial এ শুধু Y কম্পোনেন্ট ব্যবহৃত (valueZ সবসময় 0, দেখুন
        // buildDiagramSamples) — তাই Z-plane curve আঁকার দরকার নেই,
        // baseline এর সাথে হুবহু মিলে যাবে (redundant, বিভ্রান্তিকর)।
        const showZPlane = quantity !== "axial";

        const opacity = renderState.opacityMultiplier;

        return (
          <group key={`diagram-${element.elementId}`}>
            {/* Baseline (element axis) reference line, ফিকে */}
            <Line points={baselinePoints} color="#64748b" lineWidth={1} transparent opacity={opacity * 0.5} />

            {/* Y-plane diagram curve */}
            <Line points={yPlanePoints} color={COLOR_Y_PLANE} lineWidth={2} transparent opacity={opacity} />
            {worldPoints.map((p, i) => (
              <Line
                key={`y-${i}`}
                points={[p.position, p.offsetPositionY]}
                color={COLOR_Y_PLANE}
                lineWidth={1}
                transparent
                opacity={opacity * 0.6}
              />
            ))}

            {/* Z-plane diagram curve (moment/shear এর দ্বিতীয় dual-axis component) */}
            {showZPlane && (
              <>
                <Line points={zPlanePoints} color={COLOR_Z_PLANE} lineWidth={2} transparent opacity={opacity} />
                {worldPoints.map((p, i) => (
                  <Line
                    key={`z-${i}`}
                    points={[p.position, p.offsetPositionZ]}
                    color={COLOR_Z_PLANE}
                    lineWidth={1}
                    transparent
                    opacity={opacity * 0.6}
                  />
                ))}
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Named export for the color legend, used by the controls panel.
export const FORCE_DIAGRAM_COLORS = { yPlane: COLOR_Y_PLANE, zPlane: COLOR_Z_PLANE };
