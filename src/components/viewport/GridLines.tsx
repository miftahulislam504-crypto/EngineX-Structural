"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import type { StructuralGrid, StructuralStory } from "@/lib/types/geometry";
import type { ModelExtent } from "@/lib/geometry/deriveGridsFromElements";

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
  /**
   * মডেলের bounding box (deriveGridsFromElements.computeModelExtent
   * থেকে) — গ্রিড লাইনের span এখন হার্ডকোডেড ২০মি না, বরং element+grid
   * এর প্রকৃত বিস্তৃতির উপর ভিত্তি করে (কিছুটা padding সহ), ঠিক ETABS-এ
   * grid line গুলো model extent-এর সামান্য বাইরে পর্যন্ত টানা থাকে
   * তেমন। না দিলে (undefined) পুরনো ২০মি ডিফল্ট আচরণ বজায় থাকে।
   */
  extent?: ModelExtent;
  /**
   * true হলে dimension label (দুই adjacent গ্রিডের মধ্যে স্প্যান, মিটারে)
   * গ্রিড লাইনের বাইরের প্রান্তে দেখানো হয় — ETABS/AutoCAD এ যেমন
   * gridline-এর পাশে spacing "৪.০০" লেখা থাকে।
   */
  showDimensions?: boolean;
}

const AUTO_GRID_COLOR = "#94a3b8"; // slate-400 — auto-derived গ্রিড কিছুটা হালকা, যাতে manual গ্রিড থেকে আলাদা বোঝা যায়
const MANUAL_GRID_COLOR = "#475569"; // slate-600 — manual গ্রিড কিছুটা গাঢ়, ইচ্ছাকৃতভাবে বসানো তাই বেশি জোরালো

/**
 * গ্রিড লাইন render করে — প্রতিটা গ্রিড একটা সরলরেখা যা মডেলের সর্বনিম্ন
 * থেকে সর্বোচ্চ story elevation পর্যন্ত বিস্তৃত।
 *
 * X-direction গ্রিড একটা উলম্ব প্লেনে Z-অক্ষ বরাবর প্রসারিত রেখা,
 * Y-direction গ্রিড X-অক্ষ বরাবর। এটা standard CAD convention:
 * "X grid" মানে X-কোঅর্ডিনেট নির্দেশ করে এমন গ্রিড।
 *
 * Auto-derived grid (grid.gridId "auto-grid-" দিয়ে শুরু, দ্র.
 * deriveGridsFromElements.ts) হালকা রঙে ও ড্যাশড স্টাইলে দেখানো হয়,
 * যাতে ইঞ্জিনিয়ার বুঝতে পারেন কোনটা তিনি নিজে বসিয়েছেন (manual, গাঢ়
 * solid) আর কোনটা element geometry থেকে automatically বের হয়েছে
 * (halকা)। উভয়ই click-selectable ও সমান functional — শুধু visual cue।
 */
export function GridLines({
  grids,
  stories,
  selectedGridId,
  onSelectGrid,
  interactionDisabled = false,
  extent,
  showDimensions = true,
}: GridLinesProps) {
  const elevationRange = useMemo(() => {
    if (stories.length === 0) {
      return { min: 0, max: 3 }; // কোনো story না থাকলে ৩ মিটার ডিফল্ট উচ্চতা দেখানো হয়
    }
    const elevations = stories.map((s) => s.elevation);
    return { min: Math.min(...elevations), max: Math.max(...elevations) };
  }, [stories]);

  // Extent দেওয়া থাকলে model bounding box থেকে span নেওয়া হয় (+২মি
  // padding, ETABS এ grid যেমন সবচেয়ে বাইরের element এর কিছুটা বাইরে
  // পর্যন্ত টানা থাকে), না থাকলে পুরনো ২০মি ডিফল্ট।
  const span = extent ? extent.span + 4 : 20;

  const visibleGrids = grids.filter((g) => g.visible);
  const sortedX = useMemo(
    () => visibleGrids.filter((g) => g.direction === "X").sort((a, b) => a.coordinate - b.coordinate),
    [visibleGrids]
  );
  const sortedY = useMemo(
    () => visibleGrids.filter((g) => g.direction === "Y").sort((a, b) => a.coordinate - b.coordinate),
    [visibleGrids]
  );

  return (
    <group>
      {visibleGrids.map((grid) => {
        const isSelected = grid.gridId === selectedGridId;
        const isAuto = grid.gridId.startsWith("auto-grid-");
        const color = isSelected
          ? "#38bdf8"
          : grid.color ?? (isAuto ? AUTO_GRID_COLOR : MANUAL_GRID_COLOR);

        // X-direction গ্রিড: coordinate টা X-অক্ষে অবস্থান, লাইনটা Z-অক্ষ বরাবর চলে
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

        // ETABS-এর মতো: গ্রিড লেবেল একটা বৃত্তের ভেতরে বসানো হয় (bubble),
        // যাতে dense grid এও লেবেল আলাদা করে চেনা যায় সরাসরি লেখার
        // চেয়ে বেশি স্পষ্টভাবে।
        return (
          <group key={grid.gridId}>
            <Line
              points={points}
              color={color}
              lineWidth={isSelected ? 2.5 : 1.5}
              dashed={isAuto && !isSelected}
              dashSize={isAuto ? 0.25 : undefined}
              gapSize={isAuto ? 0.15 : undefined}
              onClick={
                interactionDisabled
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelectGrid(grid.gridId);
                    }
              }
            />
            <GridLabelBubble position={labelPosition} color={color} label={grid.label} />
          </group>
        );
      })}

      {showDimensions && (
        <>
          <DimensionChain
            grids={sortedX}
            axis="X"
            elevation={elevationRange.min}
            span={span}
          />
          <DimensionChain
            grids={sortedY}
            axis="Y"
            elevation={elevationRange.min}
            span={span}
          />
        </>
      )}
    </group>
  );
}

/** ETABS-স্টাইল গ্রিড লেবেল বাবল — একটা রিং (torus, পাতলা) + কেন্দ্রে টেক্সট। */
function GridLabelBubble({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.025, 8, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text fontSize={0.3} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

/**
 * পাশাপাশি গ্রিডগুলোর মধ্যে spacing (মিটারে) দেখায় — একটা dimension
 * line + arrow-এর মতো tick + মাঝে সংখ্যা, ETABS/AutoCAD এর dimension
 * chain এর সরলীকৃত ভার্সন। মডেলের একটা প্রান্তে (elevationRange.min এর
 * নিচে/বাইরে) একসারিতে বসে যাতে গ্রিড লাইনের সাথে গুলিয়ে না যায়।
 */
function DimensionChain({
  grids,
  axis,
  elevation,
  span,
}: {
  grids: StructuralGrid[];
  axis: "X" | "Y";
  elevation: number;
  span: number;
}) {
  if (grids.length < 2) return null;

  // dimension chain টা গ্রিড লেবেল বাবল-এর আরেকটু বাইরে বসে, নাহলে
  // ওভারল্যাপ করবে।
  const offset = span / 2 + 1.6;
  const dimColor = "#0ea5e9"; // sky-500, গ্রিড লাইনের চেয়ে distinguishable

  return (
    <group>
      {grids.slice(0, -1).map((grid, i) => {
        const next = grids[i + 1];
        const spacing = next.coordinate - grid.coordinate;
        const mid = (grid.coordinate + next.coordinate) / 2;

        const linePoints: [number, number, number][] =
          axis === "X"
            ? [
                [grid.coordinate, elevation, -offset],
                [next.coordinate, elevation, -offset],
              ]
            : [
                [-offset, elevation, grid.coordinate],
                [-offset, elevation, next.coordinate],
              ];

        const textPos: [number, number, number] =
          axis === "X" ? [mid, elevation, -offset - 0.35] : [-offset - 0.35, elevation, mid];

        return (
          <group key={`${grid.gridId}-${next.gridId}`}>
            <Line points={linePoints} color={dimColor} lineWidth={1} />
            <Text
              position={textPos}
              rotation={axis === "Y" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
              fontSize={0.22}
              color={dimColor}
              anchorX="center"
              anchorY="middle"
            >
              {spacing.toFixed(2)}m
            </Text>
          </group>
        );
      })}
    </group>
  );
}
