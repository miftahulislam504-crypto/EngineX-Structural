"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { GridLines } from "./GridLines";
import { StoryPlanes } from "./StoryPlanes";
import { OriginMarker } from "./OriginMarker";
import { VisualizationElementsLayer } from "./VisualizationElementsLayer";
import { ForceDiagramLayer } from "./ForceDiagramLayer";
import { ReactionLayer } from "./ReactionLayer";
import { HingeMarkerLayer } from "./HingeMarkerLayer";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";
import { useVisualizationViewStore } from "@/lib/viewport/useVisualizationViewStore";
import { useAnalysisVisualizationStore } from "@/lib/analysis/useAnalysisVisualizationStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { buildNodeDisplacementLookup, lookupNodeDisplacement, type NodeTranslation } from "@/lib/viewport/nodeDisplacementLookup";
import { DeformationAnimator } from "./DeformationAnimator";

/**
 * Phase 10i — Visualization/Detailing 3D Viewport।
 *
 * StructuralViewport (Phase 1+) থেকে এটা ইচ্ছাকৃতভাবে সম্পূর্ণ আলাদা
 * component, একই Canvas re-use না করে। কারণ:
 *   - StructuralViewport এর দায়িত্ব geometry তৈরি/এডিট করা (draw mode,
 *     grid/story click-to-select) — এখানে সেসবের কিছুই দরকার নেই,
 *     এই viewport শুধুমাত্র read-only presentation।
 *   - StructuralViewport এ draw-mode এর জন্য onClick prop সম্পূর্ণ বাদ
 *     দেওয়ার একটা সূক্ষ্ম raycasting workaround আছে (দেখুন সেই ফাইলের
 *     মন্তব্য) — সেই জটিলতা এই viewport এ আমদানি করার কোনো কারণ নেই,
 *     কারণ এখানে draw mode ধারণাটাই নেই।
 *   - ভবিষ্যতে (10j+) এই viewport এ rebar cage, stress contour, mode
 *     shape animation ইত্যাদি ভারী overlay layer বসবে — সেগুলো
 *     StructuralViewport এ conditionally mount/unmount করলে editing
 *     viewport এর performance ও complexity অযথা বাড়বে।
 *
 * GridLines/StoryPlanes/OriginMarker পুনঃব্যবহার করা হয়েছে (context
 * দেওয়ার জন্য দরকারি, এবং সেগুলো ইতিমধ্যে context-independent —
 * interactionDisabled=true দিয়ে চালানো হচ্ছে যাতে এই viewport এ কোনো
 * click grid/story select না করে, শুধু visual reference থাকে)।
 *
 * Selection state (useSelectionStore) StructuralViewport এর সাথে
 * shared — এটা ইচ্ছাকৃত, দুই viewport এর মধ্যে element selection sync
 * থাকলে ইঞ্জিনিয়ার একটা element কে Elements tab এ সিলেক্ট করে
 * Visualization tab এ গিয়ে সরাসরি সেটার rebar/result দেখতে পারবেন
 * (এবং উল্টোটাও), যা workflow-friendly।
 */
export function VisualizationViewport() {
  const geometry = useGeometryStore((s) => s.geometry);
  const elements = useElementsStore((s) => s.elements);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const isolatedStoryId = useVisualizationViewStore((s) => s.isolatedStoryId);
  const fadeNonIsolated = useVisualizationViewStore((s) => s.fadeNonIsolated);
  const renderMode = useVisualizationViewStore((s) => s.renderMode);
  const categoryVisibility = useVisualizationViewStore((s) => s.categoryVisibility);
  const deformationEnabled = useVisualizationViewStore((s) => s.deformationEnabled);
  const deformationScale = useVisualizationViewStore((s) => s.deformationScale);
  const isAnimating = useVisualizationViewStore((s) => s.isAnimating);
  const animationPhase = useVisualizationViewStore((s) => s.animationPhase);
  const diagramEnabled = useVisualizationViewStore((s) => s.diagramEnabled);
  const diagramQuantity = useVisualizationViewStore((s) => s.diagramQuantity);
  const diagramScale = useVisualizationViewStore((s) => s.diagramScale);
  const reactionEnabled = useVisualizationViewStore((s) => s.reactionEnabled);
  const reactionScale = useVisualizationViewStore((s) => s.reactionScale);
  const reactionShowMoments = useVisualizationViewStore((s) => s.reactionShowMoments);
  const dcrHeatMapEnabled = useVisualizationViewStore((s) => s.dcrHeatMapEnabled);
  const dcrRecords = useDcrStore((s) => s.records);

  const modeShapeEnabled = useVisualizationViewStore((s) => s.modeShapeEnabled);
  const modeShapeSource = useVisualizationViewStore((s) => s.modeShapeSource);
  const modeShapeIndex = useVisualizationViewStore((s) => s.modeShapeIndex);
  const modeShapeScale = useVisualizationViewStore((s) => s.modeShapeScale);
  const modeShapeAnimating = useVisualizationViewStore((s) => s.modeShapeAnimating);
  const modeShapeAnimationPhase = useVisualizationViewStore((s) => s.modeShapeAnimationPhase);
  const stressContourEnabled = useVisualizationViewStore((s) => s.stressContourEnabled);
  const hingeMarkersEnabled = useVisualizationViewStore((s) => s.hingeMarkersEnabled);
  const hingeMarkerShowLabels = useVisualizationViewStore((s) => s.hingeMarkerShowLabels);
  const pushoverResult = useAnalysisVisualizationStore((s) => s.pushoverResult);
  const modalResult = useAnalysisVisualizationStore((s) => s.modalResult);
  const bucklingResult = useAnalysisVisualizationStore((s) => s.bucklingResult);

  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);

  const activeAnalysisType = useAnalysisVisualizationStore((s) => s.activeAnalysisType);
  const analysisNodes = useAnalysisVisualizationStore((s) => s.nodes);
  const linearStaticResult = useAnalysisVisualizationStore((s) => s.linearStaticResult);
  const pdeltaResult = useAnalysisVisualizationStore((s) => s.pdeltaResult);
  const responseSpectrumResult = useAnalysisVisualizationStore((s) => s.responseSpectrumResult);
  const nonlinearStaticResult = useAnalysisVisualizationStore((s) => s.nonlinearStaticResult);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;

  const isEmpty =
    geometry.grids.length === 0 && geometry.stories.length === 0 && elements.length === 0;

  /**
   * Phase 10l — সক্রিয় analysis type অনুযায়ী nodalDisplacements বের
   * করা (শুধু direct-displacement result গুলো — Modal/Buckling/
   * Pushover এখানে বাদ, কারণ ওদের displacement ভিন্ন shape এ থাকে
   * per-mode/per-step, mode shape animation (10o) এর নিজস্ব কাজ)।
   * Response Spectrum এর displacementIsMagnitudeOnly=true হলে deform
   * করা হয় না — CQC combination sign হারায় (backend app/main.py এর
   * মন্তব্য), deform করলে প্রতিটা DOF ভুল দিকে (সবসময় positive) সরে
   * যাবে, যা বাস্তবসম্মত না।
   */
  const activeNodalDisplacements = (() => {
    switch (activeAnalysisType) {
      case "linear-static":
        return linearStaticResult?.nodalDisplacements ?? null;
      case "pdelta":
        return pdeltaResult?.nodalDisplacements ?? null;
      case "response-spectrum":
        return responseSpectrumResult?.displacementIsMagnitudeOnly
          ? null
          : responseSpectrumResult?.nodalDisplacements ?? null;
      case "nonlinear-static":
        return nonlinearStaticResult?.nodalDisplacements ?? null;
      default:
        return null;
    }
  })();

  const isRsaMagnitudeOnly =
    activeAnalysisType === "response-spectrum" && responseSpectrumResult?.displacementIsMagnitudeOnly === true;

  const deformationLookup = useMemo(() => {
    if (!deformationEnabled || modeShapeEnabled || !analysisNodes || !activeNodalDisplacements) return null;
    return buildNodeDisplacementLookup(analysisNodes, activeNodalDisplacements);
  }, [deformationEnabled, modeShapeEnabled, analysisNodes, activeNodalDisplacements]);

  // isAnimating true হলে scale 0 → deformationScale → 0 এ sin দিয়ে দোলে
  // (smooth breathing loop); নাহলে সরাসরি static deformationScale।
  const effectiveScale = isAnimating
    ? deformationScale * Math.sin(animationPhase * Math.PI)
    : deformationScale;

  /**
   * Phase 10p — Mode Shape / Buckling Animation lookup।
   *
   * modeShapeEnabled সত্য হলে (এবং 10l এর deformationEnabled false
   * থাকে, উপরের deformationLookup useMemo দেখুন — mutually exclusive)
   * নির্বাচিত mode index এর shape vector দিয়ে lookup বানানো হয়, ঠিক
   * 10l এর buildNodeDisplacementLookup রিইউজ করে (ModeShapeEntry ও
   * NodeTranslation shape identical — {ux,uy,uz,...}, তাই একই function
   * কাজ করে কোনো নতুন builder ছাড়াই)। modeShapeIndex বেছে নেওয়া node
   * count এর সাথে nodes[] এর length মিলতে হবে (Modal/Buckling result
   * এর নিজস্ব nodes আলাদা, activeAnalysisType "modal"/"buckling" না
   * থাকলে এই lookup ব্যবহারই হয় না)।
   */
  const modeShapeLookup = useMemo(() => {
    if (!modeShapeEnabled) return null;
    if (modeShapeSource === "modal") {
      const modes = modalResult?.modes;
      const modeNodes = modalResult?.nodes;
      if (!modes || !modeNodes || !modes[modeShapeIndex]) return null;
      return buildNodeDisplacementLookup(modeNodes, modes[modeShapeIndex].modeShape as NodeTranslation[]);
    }
    const modes = bucklingResult?.modes;
    const modeNodes = bucklingResult?.nodes;
    if (!modes || !modeNodes || !modes[modeShapeIndex]) return null;
    return buildNodeDisplacementLookup(modeNodes, modes[modeShapeIndex].bucklingModeShape as NodeTranslation[]);
  }, [modeShapeEnabled, modeShapeSource, modeShapeIndex, modalResult, bucklingResult]);

  const modeShapeEffectiveScale = modeShapeAnimating
    ? modeShapeScale * Math.sin(modeShapeAnimationPhase * Math.PI)
    : modeShapeScale;

  /**
   * Phase 10q — Stress/Strain Contour lookup (honest displacement-
   * magnitude proxy, দেখুন stressContourColorScale.ts এর top comment)।
   *
   * শুধু real shell category (slab/wall/shear-wall/core-wall — 10l এ
   * backend SHELL_ELEMENT_CATEGORIES এর সাথে verify করা একই সেট,
   * mat-foundation বাদ) এ প্রযোজ্য। deformationLookup এর মতোই
   * activeNodalDisplacements ব্যবহার করে (একই সোর্স, RSA magnitude-
   * only case এও একই restriction প্রযোজ্য — সেই ক্ষেত্রে lookup null
   * থাকবে, ভুল contour দেখানো এড়াতে)।
   *
   * প্রতিটা shell element এর সব vertex এর displacement magnitude
   * (√(ux²+uy²+uz²)) গড় করে একটা single element-level value বের করা
   * হয় (per-vertex/per-pixel gradient না, per-element flat color —
   * simpler ও honest, কারণ ExtrudeGeometry তে vertex-level color
   * attach করা জটিল ও ভুল হওয়ার ঝুঁকিপূর্ণ)। তারপর সব shell element
   * এর মধ্যে min-max normalize করে 0-1 এ আনা হয় (dataset-relative
   * scale, absolute stress threshold না — সেটা বোঝানোর কোনো ভিত্তি
   * নেই যেহেতু এটা stress ই না)।
   */
  const stressContourLookup = useMemo(() => {
    if (!stressContourEnabled || !analysisNodes || !activeNodalDisplacements) return null;
    const nodeLookup = buildNodeDisplacementLookup(analysisNodes, activeNodalDisplacements);
    const shellCategories = new Set(["slab", "wall", "shear-wall", "core-wall"]);

    const rawMagnitudes = new Map<string, number>();
    for (const element of elements) {
      if (!shellCategories.has(element.category)) continue;
      if (!("vertices" in element)) continue;
      const vertices = element.vertices as { x: number; y: number; z: number }[];
      if (vertices.length === 0) continue;
      let sum = 0;
      let count = 0;
      for (const v of vertices) {
        const d = lookupNodeDisplacement(nodeLookup, v);
        if (d) {
          sum += Math.sqrt(d.ux * d.ux + d.uy * d.uy + d.uz * d.uz);
          count++;
        }
      }
      if (count > 0) rawMagnitudes.set(element.elementId, sum / count);
    }

    if (rawMagnitudes.size === 0) return null;

    const values = Array.from(rawMagnitudes.values());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    const normalized = new Map<string, number>();
    for (const [id, v] of rawMagnitudes) {
      normalized.set(id, range < 1e-12 ? 0 : (v - min) / range);
    }
    return normalized;
  }, [stressContourEnabled, analysisNodes, activeNodalDisplacements, elements]);

  /**
   * Phase 10r — activeAnalysisType অনুযায়ী hinge states বের করা।
   * শুধু Nonlinear Static (hingeStates) ও Pushover (finalHingeStates)
   * এ পাওয়া যায় — Linear Static/Modal/Buckling/P-Delta/Response
   * Spectrum এ কোনো hinge concept নেই (elastic analysis, yield
   * ধারণাই নেই)।
   */
  const activeHingeStates = (() => {
    if (activeAnalysisType === "nonlinear-static") return nonlinearStaticResult?.hingeStates ?? null;
    if (activeAnalysisType === "pushover") return pushoverResult?.finalHingeStates ?? null;
    return null;
  })();

  return (
    <div className="relative w-full h-full bg-surface">
      <Canvas
        camera={{ position: [14, 10, 14], fov: 45 }}
        onPointerMissed={() => setSelection({ type: "none" })}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} />

          <DeformationAnimator />

          <OriginMarker />

          <GridLines
            grids={geometry.grids}
            stories={geometry.stories}
            selectedGridId={null}
            onSelectGrid={() => {}}
            interactionDisabled
          />

          <StoryPlanes
            stories={geometry.stories}
            selectedStoryId={null}
            onSelectStory={() => {}}
            interactionDisabled
          />

          <VisualizationElementsLayer
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={(elementId) => setSelection({ type: "element", elementId })}
            categoryVisibility={categoryVisibility}
            isolatedStoryId={isolatedStoryId}
            fadeNonIsolated={fadeNonIsolated}
            renderMode={renderMode}
            deformationLookup={deformationLookup ?? modeShapeLookup}
            deformationScale={deformationLookup ? effectiveScale : modeShapeEffectiveScale}
            dcrRecords={dcrHeatMapEnabled ? dcrRecords : null}
            stressContourLookup={stressContourEnabled ? stressContourLookup : null}
          />

          {diagramEnabled && elementEndForces && elementEndForces.length > 0 && (
            <ForceDiagramLayer
              elements={elements}
              elementEndForces={elementEndForces}
              quantity={diagramQuantity}
              scale={diagramScale}
              categoryVisibility={categoryVisibility}
              isolatedStoryId={isolatedStoryId}
              fadeNonIsolated={fadeNonIsolated}
            />
          )}

          {reactionEnabled &&
            activeAnalysisType === "linear-static" &&
            analysisNodes &&
            linearStaticResult?.reactionForces &&
            linearStaticResult.reactionForces.length > 0 && (
              <ReactionLayer
                nodes={analysisNodes}
                reactionForces={linearStaticResult.reactionForces}
                scale={reactionScale}
                showMoments={reactionShowMoments}
              />
            )}

          {hingeMarkersEnabled && activeHingeStates && activeHingeStates.length > 0 && (
            <HingeMarkerLayer
              elements={elements}
              hingeStates={activeHingeStates}
              showLabels={hingeMarkerShowLabels}
            />
          )}

          <OrbitControls makeDefault enableDamping dampingFactor={0.1} />

          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>
        </Suspense>
      </Canvas>

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm">
            এখনো কোনো Model নেই। প্রথমে Geometry/Elements ট্যাব থেকে মডেল তৈরি করুন।
          </p>
        </div>
      )}

      {deformationEnabled && !activeNodalDisplacements && !isEmpty && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
          {isRsaMagnitudeOnly
            ? "Response Spectrum displacement magnitude-only (CQC) — deformed shape দেখানো যাচ্ছে না।"
            : "কোনো displacement result নেই — আগে Analysis ট্যাবে Linear Static/P-Delta/Response Spectrum/Nonlinear Static চালান।"}
        </div>
      )}

      {diagramEnabled && (!elementEndForces || elementEndForces.length === 0) && !isEmpty && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
          কোনো Element End Forces নেই — আগে Analysis ট্যাবে Linear Static/P-Delta/Response Spectrum/Nonlinear Static চালান (Modal/Buckling এ diagram নেই)।
        </div>
      )}

      {reactionEnabled &&
        !isEmpty &&
        (activeAnalysisType !== "linear-static" || !linearStaticResult?.reactionForces?.length) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
            Reaction শুধু Linear Static এ পাওয়া যায় — আগে Analysis ট্যাবে Linear Static চালান।
          </div>
        )}

      {modeShapeEnabled && !isEmpty && !modeShapeLookup && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
          {modeShapeSource === "modal"
            ? "কোনো Modal result নেই বা এই mode index এ ডেটা নেই — Analysis ট্যাবে Modal চালান।"
            : "কোনো Buckling result নেই বা এই mode index এ ডেটা নেই — Analysis ট্যাবে Buckling চালান।"}
        </div>
      )}

      {stressContourEnabled && !isEmpty && !stressContourLookup && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
          কোনো shell (Slab/Wall) displacement result নেই — Analysis ট্যাবে Linear Static/P-Delta/Nonlinear Static চালান।
        </div>
      )}

      {hingeMarkersEnabled && !isEmpty && (!activeHingeStates || activeHingeStates.length === 0) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-900/90 border border-amber-700 rounded px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
          কোনো Hinge ফলাফল নেই — Analysis ট্যাবে Nonlinear Static/Pushover চালান (হিঞ্জ elastic analysis এ প্রযোজ্য না)।
        </div>
      )}
    </div>
  );
}
