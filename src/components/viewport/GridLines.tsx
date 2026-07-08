"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import type { StructuralGrid, StructuralStory } from "@/lib/types/geometry";

interface GridLinesProps {
  grids: StructuralGrid[];
  stories: StructuralStory[];
  selectedGridId: string | null;
  onSelectGrid: (gridId: string) => void;
  /**
   * true হলে (draw mode চালু) এই লাইনগুলো ক্লিক-নিষ্ক্রিয় হয়ে যায় —
   * onClick prop-ই বসানো হয় না, শুধু handler কে no-op করা হয় না।
   * কারণ: onClick থাকলে Three.js raycasting hit করলেই
   * event.stopPropagation() কল হয়ে যায় (নিচে দেখুন), যা draw mode এ
   * DrawPlane পর্যন্ত ক্লিক পৌঁছাতে বাধা দিত — ইউজার একটা grid line এর
   * কাছাকাছি vertex বসাতে চাইলেও ব্যর্থ হতো। onClick prop সম্পূর্ণ বাদ
   * দিলে raycasting এই object কে হিট হিসেবে গণ্যই করে না, তাই ক্লিক
   * সরাসরি নিচের DrawPlane এ চলে যায়।
   */
  interactionDisabled?: boolean;
}

/**
 * গ্রিড লাইন render করে — প্রতিটা গ্রিড একটা সরলরেখা যা মডেলের সর্বনিম্ন
 * থেকে সর্বোচ্চ story elevation পর্যন্ত বিস্তৃত (একটা প্লেন হিসেবে না,
 * কারণ Phase 1-এ এখনো কোনো structural element নেই — শুধু reference
 * লাইন দেখানোই যথেষ্ট)।
 *
 * X-direction গ্রিড একটা উলম্ব প্লেনে Y-অক্ষ বরাবর প্রসারিত রেখা,
 * Y-direction গ্রিড X-অক্ষ বরাবর। এটা standard CAD convention:
 * "X grid" মানে X-কোঅর্ডিনেট নির্দেশ করে এমন গ্রিড, যেটা Y-দিকে চলে।
 */
export function GridLines({
  grids,
  stories,
  selectedGridId,
  onSelectGrid,
  interactionDisabled = false,
}: GridLinesProps) {
  const elevationRange = useMemo(() => {
    if (stories.length === 0) {
      return { min: 0, max: 3 }; // কোনো story না থাকলে ৩ মিটার ডিফল্ট উচ্চতা দেখানো হয়
    }
    const elevations = stories.map((s) => s.elevation);
    return { min: Math.min(...elevations), max: Math.max(...elevations) };
  }, [stories]);

  // গ্রিডের বিস্তৃতি viewport এ কতদূর দেখানো হবে তার জন্য একটা যুক্তিসঙ্গত
  // ডিফল্ট span — আসল মডেল এলিমেন্ট (Phase 2) আসার পর এটা bounding box
  // থেকে হিসাব করা হবে।
  const span = 20;

  const visibleGrids = grids.filter((g) => g.visible);

  return (
    <group>
      {visibleGrids.map((grid) => {
        const isSelected = grid.gridId === selectedGridId;
        const color = isSelected ? "#38bdf8" : grid.color ?? "#64748b";

        // X-direction গ্রিড: coordinate টা X-অক্ষে অবস্থান, লাইনটা Y-অক্ষ বরাবর চলে
        const points: [number, number, number][] =
          grid.direction === "X"
            ? [
                [grid.coordinate, elevationRange.min, -span / 2],
                [grid.coordinate, elevationRange.min, span / 2],
              ]
            : [
                [-span / 2, elevationRange.min, grid.coordinate],
                [span / 2, elevationRange.min, grid.coordinate],
              ];

        const labelPosition: [number, number, number] =
          grid.direction === "X"
            ? [grid.coordinate, elevationRange.min - 0.6, -span / 2 - 0.8]
            : [-span / 2 - 0.8, elevationRange.min - 0.6, grid.coordinate];

        return (
          <group key={grid.gridId}>
            <Line
              points={points}
              color={color}
              lineWidth={isSelected ? 2.5 : 1.5}
              onClick={
                interactionDisabled
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelectGrid(grid.gridId);
                    }
              }
            />
            <Text
              position={labelPosition}
              fontSize={0.35}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {grid.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
