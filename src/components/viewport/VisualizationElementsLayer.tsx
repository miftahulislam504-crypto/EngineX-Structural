"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { StructuralElement } from "@/lib/types/element";
import {
  computeVisualizationRenderState,
  type VisualizationRenderState,
} from "@/lib/viewport/visualizationElementFilter";
import type { VisualizationRenderMode } from "@/lib/viewport/useVisualizationViewStore";
import {
  lookupNodeDisplacement,
  type NodeTranslation,
} from "@/lib/viewport/nodeDisplacementLookup";
import { dcrRatioToColor } from "@/lib/viewport/dcrColorScale";
import { stressProxyToColor } from "@/lib/viewport/stressContourColorScale";
import type { DcrElementRecord } from "@/lib/design/useDcrStore";
import { buildPlanarPolygonMesh } from "@/lib/viewport/planarPolygonMesh";

interface VisualizationElementsLayerProps {
  elements: StructuralElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  categoryVisibility: Record<string, boolean>;
  isolatedStoryId: string | null;
  fadeNonIsolated: boolean;
  renderMode: VisualizationRenderMode;
  /**
   * Phase 10l — non-null হলে line/shell element গুলো তাদের endpoint/
   * vertex এর matching analysis node displacement দিয়ে অফসেট হয়ে
   * আঁকা হয় (deformed shape)। null মানে undeformed geometry (10i এর
   * পূর্ববর্তী আচরণ)। শুধু beam/column/brace/pile (line) ও slab/wall/
   * shear-wall/core-wall (shell — backend এর SHELL_ELEMENT_CATEGORIES
   * এর সাথে হুবহু মেলে) এই deform প্রয়োগ পায়। Mat-Foundation/Footing/
   * Pile-Cap/ইত্যাদি বাদ — এরা backend এ FE node হিসেবে solve হয় না,
   * তাদের কোনো displacement result নেই।
   */
  deformationLookup: Map<string, NodeTranslation> | null;
  /** deformationLookup non-null হলে effective multiplier (deformationScale, animation চালু থাকলে sin-modulated)। */
  deformationScale: number;
  /**
   * Phase 10o — non-null হলে DCR Heat Map mode active — প্রতিটা
   * element এর baseColor সেই element এর useDcrStore record এর
   * governingRatio অনুযায়ী override হয় (dcrRatioToColor)। যে element
   * এর কোনো record নেই (design এখনো চালানো হয়নি সেই element এ) সেটা
   * তার normal category color এই থাকে, heat map color পায় না — যাতে
   * "design করা হয়নি" আর "design করে safe (green)" এর মধ্যে বিভ্রান্তি
   * না হয়।
   */
  dcrRecords: Record<string, DcrElementRecord> | null;
  /**
   * Phase 10q — non-null হলে Stress/Strain Contour mode active —
   * প্রতিটা shell element এর color এই lookup এর normalized (0-1)
   * magnitude অনুযায়ী override হয় (stressProxyToColor)। dcrRecords এর
   * সাথে conflict হলে (দুটোই non-null) dcrRecords অগ্রাধিকার পায় —
   * VisualizationViewport এ UI level এ mutually exclusive রাখা
   * হয়েছে, কিন্তু defensive ordering হিসেবে এখানেও রাখা holo। শুধু
   * real shell category (slab/wall/shear-wall/core-wall) — line
   * element বা mat-foundation/footing এ প্রযোজ্য না, কারণ এই contour
   * শুধু shell displacement magnitude থেকে আসে (10l এর মতোই scope)।
   */
  stressContourLookup: Map<string, number> | null;
}

const COLOR_BEAM = "#f97316";
const COLOR_COLUMN = "#eab308";
const COLOR_BRACE = "#ec4899";
const COLOR_PILE = "#7c2d12";
const COLOR_SLAB = "#94a3b8";
const COLOR_WALL = "#78716c";
const COLOR_SHEAR_WALL = "#dc2626";
const COLOR_CORE_WALL = "#b91c1c";
const COLOR_STAIR = "#a855f7"; // purple — ElementsLayer.tsx এর COLOR_STAIR এর সাথে সামঞ্জস্যপূর্ণ
const COLOR_STAIR_LANDING = "#c084fc"; // ElementsLayer.tsx এর COLOR_STAIR_LANDING এর সাথে সামঞ্জস্যপূর্ণ
const COLOR_PARAPET = "#57534e"; // ElementsLayer.tsx এর COLOR_PARAPET এর সাথে সামঞ্জস্যপূর্ণ
const COLOR_FOOTING = "#a16207";
const COLOR_COMBINED_FOOTING = "#b45309";
const COLOR_STRIP_FOOTING = "#92400e";
const COLOR_MAT_FOUNDATION = "#78350f";
const COLOR_PILE_CAP = "#854d0e";
const COLOR_PILE_GROUP = "#57534e";
const COLOR_SELECTED = "#38bdf8";

/**
 * Phase 10i — Visualization viewport এর জন্য element layer।
 *
 * এটা components/viewport/ElementsLayer.tsx (Phase 2a-2c, geometry-
 * editing viewport এর জন্য) থেকে ইচ্ছাকৃতভাবে একটা আলাদা component,
 * duplicate/wrapper না। কারণ:
 *   1. ElementsLayer এর দায়িত্ব শুধু geometry রেন্ডার + click-to-select
 *      (editing context) — এখানে view-mode (opacity fade, wireframe,
 *      x-ray, story isolation) এর কোনো concept নেই এবং থাকা উচিতও না,
 *      কারণ geometry editing এ এসবের দরকার নেই।
 *   2. এই component টাই হবে 10j (rebar 3D model) এর ভিত্তি — rebar
 *      cage rendering এই layer এর প্রতিটা element mesh এর indices/ref
 *      এর সাথে সরাসরি যুক্ত হবে, তাই এখানে view-mode logic গুলো এখনই
 *      সঠিক জায়গায় বসানো holistic ভবিষ্যৎ কাজকে সহজ করবে।
 *   3. একটাই ElementsLayer কে দুই context এর জন্য conditional prop
 *      দিয়ে overload করাও বিবেচনা করা হয়েছিল, কিন্তু তাতে editing-only
 *      ও visualization-only concern এক ফাইলে মিশে যেত (interactionDisabled
 *      prop টা draw-mode-এর জন্য ইতিমধ্যে একটা edge case যোগ করেছে,
     *      আরও prop যোগ করলে সেটা maintainability কমাবে)।
 *
 * mesh geometry construction (cylinder for line elements, extruded
 * shape for area elements, box for point/footing elements) ElementsLayer
 * এর সাথে সামঞ্জস্যপূর্ণ রাখা হয়েছে যাতে দুই viewport এ একই element
 * দেখতে একই রকম লাগে (elevation/scale সব একই)।
 *
 * Phase 10l: deformationLookup/deformationScale prop যোগ হয়েছে —
 * শুধু line elements (beam/column/brace/pile) ও shell elements
 * (slab/wall/shear-wall/core-wall) deform পায়, কারণ backend এর
 * SHELL_ELEMENT_CATEGORIES ঠিক এই চারটাই (analysis_orchestration.py
 * verify করা হয়েছে) — এদের geometry (startPoint/endPoint/vertices)
 * সরাসরি FE node coordinate এর সাথে ম্যাচযোগ্য (shell mesh এর quad
 * corner হিসেবে polygon boundary vertex অপরিবর্তিত থাকে, শুধু ভেতরে
 * centroid/edge-midpoint নতুন node যোগ হয়)। Mat-Foundation এই
 * category তালিকায় নেই (যদিও একই AreaElementMesh রেন্ডারার শেয়ার
 * করে) — backend এ এটা shell হিসেবে solve হয় না, তাই কোনো displacement
 * result নেই, deform প্রযোজ্য নয়। Footing/Combined-Footing/Strip-
 * Footing/Pile-Cap/Pile-Group ও একই কারণে বাদ — এরা FE model এ নেই
 * (6e/7a-7f এর design output, নিজস্ব location/pointA/pointB/
 * centroidLocation field ব্যবহার করে যা analysis node-indexed না)।
 * Stair (Phase 6.5 import) একই কারণে (backend এখনো stair-কে shell
 * হিসেবে solve করে না) SHELL_ELEMENT_CATEGORIES-এর বাইরে — Mat-
 * Foundation-এর প্যাটার্ন অনুসরণ করে raw vertices দিয়ে render হয়,
 * deformPoint() wrap ছাড়া। Stair-Landing (২০২৬-০৮ গ্যাপ-ক্লোজিং পাস)
 * একই কারণে একই দলে — এটাও FE shell হিসেবে solve হয় না, শুধু
 * dead-load contribution।
 */
export function VisualizationElementsLayer({
  elements,
  selectedElementId,
  onSelectElement,
  categoryVisibility,
  isolatedStoryId,
  fadeNonIsolated,
  renderMode,
  deformationLookup,
  deformationScale,
  dcrRecords,
  stressContourLookup,
}: VisualizationElementsLayerProps) {
  const wireframe = renderMode === "wireframe";
  const xray = renderMode === "x-ray";

  /**
   * একটা geometry point কে (যদি deformationLookup active থাকে ও সেই
   * coordinate এ matching analysis node পাওয়া যায়) displacement দিয়ে
   * অফসেট করে নতুন point দেয়। ম্যাচ না পেলে undeformed point-ই ফেরত
   * (element analysis-এ অংশ নেয়নি বা geometry run-এর পর বদলেছে) —
   * silently undeformed রাখা হয়, error না, কারণ partial-model
   * analysis (শুধু কিছু element select করে run) একটা স্বাভাবিক
   * ব্যবহার-প্যাটার্ন।
   */
  function deformPoint(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    if (!deformationLookup) return p;
    const d = lookupNodeDisplacement(deformationLookup, p);
    if (!d) return p;
    return {
      x: p.x + d.ux * deformationScale,
      y: p.y + d.uy * deformationScale,
      z: p.z + d.uz * deformationScale,
    };
  }

  return (
    <group>
      {elements.map((element) => {
        const renderState = computeVisualizationRenderState(element, {
          categoryVisible: categoryVisibility[element.category] ?? true,
          isolatedStoryId,
          fadeNonIsolated,
        });

        if (!renderState.visible) {
          return null;
        }

        const isSelected = element.elementId === selectedElementId;
        const dcrRecord = dcrRecords?.[element.elementId];
        const stressContourValue = stressContourLookup?.get(element.elementId);
        const baseColor = isSelected
          ? COLOR_SELECTED
          : dcrRecord
            ? dcrRatioToColor(dcrRecord.governingRatio)
            : stressContourValue !== undefined
              ? stressProxyToColor(stressContourValue)
              : getElementColor(element.category);
        // x-ray mode এ সব element transparent (0.35 base opacity), তার
        // উপর story-fade multiplier আরও কমাবে যদি non-isolated হয়।
        const baseOpacity = xray ? 0.35 : 1;
        const opacity = baseOpacity * renderState.opacityMultiplier;

        const materialProps = {
          color: baseColor,
          wireframe,
          transparent: wireframe ? false : opacity < 1,
          opacity: wireframe ? 1 : opacity,
        };

        switch (element.category) {
          case "beam":
          case "column":
          case "brace":
          case "pile":
            return (
              <LineElementMesh
                key={element.elementId}
                startPoint={deformPoint(element.startPoint)}
                endPoint={deformPoint(element.endPoint)}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "slab":
          case "wall":
          case "shear-wall":
          case "core-wall":
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices.map(deformPoint)}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "footing":
          case "pile-cap":
            return (
              <BoxAtLocationMesh
                key={element.elementId}
                location={element.location}
                width={element.width}
                length={element.length}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "combined-footing":
            return (
              <SpanningBoxMesh
                key={element.elementId}
                pointA={element.columnALocation}
                pointB={element.columnBLocation}
                thickness={element.thickness}
                widthM={1.5}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "strip-footing":
            return (
              <SpanningBoxMesh
                key={element.elementId}
                pointA={element.startPoint}
                pointB={element.endPoint}
                thickness={element.thickness}
                widthM={0.6}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "mat-foundation":
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "stair":
            // Mat-Foundation-এর মতোই SHELL_ELEMENT_CATEGORIES তালিকায় নেই
            // (backend analysis_orchestration.py এখনো stair কে shell
            // হিসেবে solve করে না — Phase 6.5 এখনো শুধু import, analysis
            // engine stair সাপোর্ট আলাদা কাজ) — তাই deformPoint() wrap
            // ছাড়াই render (raw vertices, deform প্রযোজ্য না)।
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "parapet":
            // Stair-এর ঠিক একই কারণে deformPoint() wrap ছাড়া — parapet
            // dead-load-only element (deriveAreaSelfWeightLoads.ts), FE
            // analysis shell হিসেবে solve হয় না, তাই কোনো deformed shape
            // নেই দেখানোর মতো — raw modeled vertices দেখানো হচ্ছে।
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "stair-landing":
            // Stair/Parapet-এর ঠিক একই কারণে (২০২৬-০৮ গ্যাপ-ক্লোজিং
            // পাস) — dead-load-only, FE shell না, deformPoint() wrap
            // ছাড়া raw vertices।
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices}
                thickness={element.thickness}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          case "pile-group":
            return (
              <PileGroupMesh
                key={element.elementId}
                centroidLocation={element.centroidLocation}
                pileShape={element.pileShape}
                pileDiameterOrWidthMm={element.pileDiameterOrWidthMm}
                embeddedLengthMm={element.embeddedLengthMm}
                pileSpacingCenterToCenterMm={element.pileSpacingCenterToCenterMm}
                numberOfRows={element.numberOfRows}
                numberOfColumns={element.numberOfColumns}
                materialProps={materialProps}
                onSelect={() => onSelectElement(element.elementId)}
              />
            );

          default: {
            const exhaustiveCheck: never = element;
            console.error("Unhandled element category in VisualizationElementsLayer:", exhaustiveCheck);
            return null;
          }
        }
      })}
    </group>
  );
}

function getElementColor(category: StructuralElement["category"]): string {
  switch (category) {
    case "beam":
      return COLOR_BEAM;
    case "column":
      return COLOR_COLUMN;
    case "brace":
      return COLOR_BRACE;
    case "pile":
      return COLOR_PILE;
    case "slab":
      return COLOR_SLAB;
    case "wall":
      return COLOR_WALL;
    case "shear-wall":
      return COLOR_SHEAR_WALL;
    case "core-wall":
      return COLOR_CORE_WALL;
    case "stair":
      return COLOR_STAIR;
    case "stair-landing":
      return COLOR_STAIR_LANDING;
    case "parapet":
      return COLOR_PARAPET;
    case "footing":
      return COLOR_FOOTING;
    case "combined-footing":
      return COLOR_COMBINED_FOOTING;
    case "strip-footing":
      return COLOR_STRIP_FOOTING;
    case "mat-foundation":
      return COLOR_MAT_FOUNDATION;
    case "pile-cap":
      return COLOR_PILE_CAP;
    case "pile-group":
      return COLOR_PILE_GROUP;
  }
}

interface MaterialProps {
  color: string;
  wireframe: boolean;
  transparent: boolean;
  opacity: number;
}

function useClickHandler(onSelect: () => void) {
  return (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect();
  };
}

interface LineElementMeshProps {
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  materialProps: MaterialProps;
  onSelect: () => void;
}

function LineElementMesh({ startPoint, endPoint, materialProps, onSelect }: LineElementMeshProps) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
    const end = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);
    const direction = new THREE.Vector3().subVectors(end, start);
    const len = direction.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    return { midpoint: mid, length: len, quaternion: quat };
  }, [startPoint, endPoint]);

  const radius = 0.06;
  const handleClick = useClickHandler(onSelect);

  return (
    <mesh position={midpoint} quaternion={quaternion} onClick={handleClick}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

interface AreaElementMeshProps {
  vertices: { x: number; y: number; z: number }[];
  thickness: number;
  materialProps: MaterialProps;
  onSelect: () => void;
}

function AreaElementMesh({ vertices, thickness, materialProps, onSelect }: AreaElementMeshProps) {
  // Plane-agnostic builder — polygon-এর প্রকৃত 3D plane (Newell's
  // method normal) থেকে geometry+position+quaternion বানায়, তাই flat
  // horizontal slab, vertical wall, ও inclined stair waist slab সবই
  // সঠিকভাবে render হয়। আগে এখানে hardcoded XZ-plane assumption ছিল
  // (শুধু x,z পড়ে shape বানানো, rotateX(-90°), constant averageY এ
  // বসানো) — inclined polygon flat দেখাত ও ভুল উচ্চতায় বসত।
  const built = useMemo(() => buildPlanarPolygonMesh(vertices, thickness), [vertices, thickness]);

  const handleClick = useClickHandler(onSelect);

  if (!built) return null;

  return (
    <mesh
      geometry={built.geometry}
      position={built.position}
      quaternion={built.quaternion}
      onClick={handleClick}
    >
      <meshStandardMaterial
        {...materialProps}
        transparent
        opacity={Math.min(materialProps.opacity, 0.85)}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface BoxAtLocationMeshProps {
  location: { x: number; y: number; z: number };
  width: number;
  length: number;
  thickness: number;
  materialProps: MaterialProps;
  onSelect: () => void;
}

function BoxAtLocationMesh({
  location,
  width,
  length,
  thickness,
  materialProps,
  onSelect,
}: BoxAtLocationMeshProps) {
  const widthM = width / 1000;
  const lengthM = length / 1000;
  const thicknessM = thickness / 1000;
  const handleClick = useClickHandler(onSelect);

  return (
    <mesh position={[location.x, location.y - thicknessM / 2, location.z]} onClick={handleClick}>
      <boxGeometry args={[widthM, thicknessM, lengthM]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

interface SpanningBoxMeshProps {
  pointA: { x: number; y: number; z: number };
  pointB: { x: number; y: number; z: number };
  thickness: number;
  widthM: number;
  materialProps: MaterialProps;
  onSelect: () => void;
}

/** Combined Footing ও Strip Footing এর জন্য শেয়ার্ড রেন্ডারার — দুই পয়েন্টের মাঝে বিস্তৃত schematic box। */
function SpanningBoxMesh({ pointA, pointB, thickness, widthM, materialProps, onSelect }: SpanningBoxMeshProps) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const a = new THREE.Vector3(pointA.x, pointA.y, pointA.z);
    const b = new THREE.Vector3(pointB.x, pointB.y, pointB.z);
    const direction = new THREE.Vector3().subVectors(b, a);
    const len = direction.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    return { midpoint: mid, length: len, quaternion: quat };
  }, [pointA, pointB]);

  const thicknessM = thickness / 1000;
  const handleClick = useClickHandler(onSelect);

  return (
    <mesh position={midpoint} quaternion={quaternion} onClick={handleClick}>
      <boxGeometry args={[widthM, length, thicknessM]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

interface PileGroupMeshProps {
  centroidLocation: { x: number; y: number; z: number };
  pileShape: "circular" | "square";
  pileDiameterOrWidthMm: number;
  embeddedLengthMm: number;
  pileSpacingCenterToCenterMm: number;
  numberOfRows: number;
  numberOfColumns: number;
  materialProps: MaterialProps;
  onSelect: () => void;
}

function PileGroupMesh({
  centroidLocation,
  pileShape,
  pileDiameterOrWidthMm,
  embeddedLengthMm,
  pileSpacingCenterToCenterMm,
  numberOfRows,
  numberOfColumns,
  materialProps,
  onSelect,
}: PileGroupMeshProps) {
  const spacingM = pileSpacingCenterToCenterMm / 1000;
  const diameterM = pileDiameterOrWidthMm / 1000;
  const embeddedM = embeddedLengthMm / 1000;
  const totalWidthX = (numberOfColumns - 1) * spacingM;
  const totalWidthZ = (numberOfRows - 1) * spacingM;

  const positions: { x: number; z: number }[] = [];
  for (let row = 0; row < numberOfRows; row++) {
    for (let col = 0; col < numberOfColumns; col++) {
      positions.push({ x: col * spacingM - totalWidthX / 2, z: row * spacingM - totalWidthZ / 2 });
    }
  }

  const handleClick = useClickHandler(onSelect);

  return (
    <group>
      {positions.map((p, i) => (
        <mesh
          key={i}
          position={[centroidLocation.x + p.x, centroidLocation.y - embeddedM / 2, centroidLocation.z + p.z]}
          onClick={handleClick}
        >
          {pileShape === "circular" ? (
            <cylinderGeometry args={[diameterM / 2, diameterM / 2, embeddedM, 16]} />
          ) : (
            <boxGeometry args={[diameterM, embeddedM, diameterM]} />
          )}
          <meshStandardMaterial {...materialProps} />
        </mesh>
      ))}
    </group>
  );
}

export type { VisualizationRenderState };
