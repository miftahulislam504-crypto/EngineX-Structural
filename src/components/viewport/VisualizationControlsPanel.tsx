"use client";

import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";
import { useVisualizationViewStore, type VisualizationRenderMode } from "@/lib/viewport/useVisualizationViewStore";
import { useAnalysisVisualizationStore } from "@/lib/analysis/useAnalysisVisualizationStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import type { ElementCategory } from "@/lib/types/element";

const CATEGORY_LABELS: { category: ElementCategory; label: string }[] = [
  { category: "beam", label: "Beam" },
  { category: "column", label: "Column" },
  { category: "brace", label: "Brace" },
  { category: "pile", label: "Pile" },
  { category: "slab", label: "Slab" },
  { category: "wall", label: "Wall" },
  { category: "shear-wall", label: "Shear Wall" },
  { category: "core-wall", label: "Core Wall" },
  { category: "footing", label: "Footing" },
  { category: "combined-footing", label: "Combined Footing" },
  { category: "strip-footing", label: "Strip Footing" },
  { category: "mat-foundation", label: "Mat Foundation" },
  { category: "pile-cap", label: "Pile Cap" },
  { category: "pile-group", label: "Pile Group" },
];

const RENDER_MODES: { mode: VisualizationRenderMode; label: string }[] = [
  { mode: "solid", label: "Solid" },
  { mode: "wireframe", label: "Wireframe" },
  { mode: "x-ray", label: "X-Ray" },
];

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  "linear-static": "Linear Static",
  modal: "Modal",
  buckling: "Buckling",
  pdelta: "P-Delta",
  "response-spectrum": "Response Spectrum",
  "nonlinear-static": "Nonlinear Static",
  pushover: "Pushover",
};

/** Phase 10l — যে analysis type গুলোর directly-usable nodalDisplacements আছে (deform করার জন্য)। */
const DISPLACEMENT_CAPABLE_TYPES = new Set([
  "linear-static",
  "pdelta",
  "response-spectrum",
  "nonlinear-static",
]);

/**
 * Phase 10i — VisualizationViewport এর নিয়ন্ত্রণ প্যানেল (ডান sidebar,
 * page.tsx এর নতুন "visualization" top-level ট্যাবে বসবে)।
 *
 * এই প্যানেলটা 10j+ এর সব sub-phase এর জন্য একটা shared "toolbar"
 * হিসেবে থাকবে — story isolation ও render mode toggle প্রতিটা
 * visualization ফিচারেই (rebar, stress contour, mode shape) কাজে
 * লাগবে, তাই এখানেই কেন্দ্রীভূত রাখা হয়েছে যাতে প্রতিটা sub-phase
 * নিজের মতো আলাদা toolbar না বানায়।
 */
export function VisualizationControlsPanel() {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const elements = useElementsStore((s) => s.elements);
  const selection = useSelectionStore((s) => s.selection);

  const isolatedStoryId = useVisualizationViewStore((s) => s.isolatedStoryId);
  const setIsolatedStoryId = useVisualizationViewStore((s) => s.setIsolatedStoryId);
  const fadeNonIsolated = useVisualizationViewStore((s) => s.fadeNonIsolated);
  const setFadeNonIsolated = useVisualizationViewStore((s) => s.setFadeNonIsolated);
  const renderMode = useVisualizationViewStore((s) => s.renderMode);
  const setRenderMode = useVisualizationViewStore((s) => s.setRenderMode);
  const categoryVisibility = useVisualizationViewStore((s) => s.categoryVisibility);
  const toggleCategoryVisibility = useVisualizationViewStore((s) => s.toggleCategoryVisibility);
  const setAllCategoriesVisible = useVisualizationViewStore((s) => s.setAllCategoriesVisible);

  const deformationEnabled = useVisualizationViewStore((s) => s.deformationEnabled);
  const setDeformationEnabled = useVisualizationViewStore((s) => s.setDeformationEnabled);
  const deformationScale = useVisualizationViewStore((s) => s.deformationScale);
  const setDeformationScale = useVisualizationViewStore((s) => s.setDeformationScale);
  const isAnimating = useVisualizationViewStore((s) => s.isAnimating);
  const setIsAnimating = useVisualizationViewStore((s) => s.setIsAnimating);

  const activeAnalysisType = useAnalysisVisualizationStore((s) => s.activeAnalysisType);

  const diagramEnabled = useVisualizationViewStore((s) => s.diagramEnabled);
  const setDiagramEnabled = useVisualizationViewStore((s) => s.setDiagramEnabled);
  const diagramQuantity = useVisualizationViewStore((s) => s.diagramQuantity);
  const setDiagramQuantity = useVisualizationViewStore((s) => s.setDiagramQuantity);
  const diagramScale = useVisualizationViewStore((s) => s.diagramScale);
  const setDiagramScale = useVisualizationViewStore((s) => s.setDiagramScale);
  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);

  const reactionEnabled = useVisualizationViewStore((s) => s.reactionEnabled);
  const setReactionEnabled = useVisualizationViewStore((s) => s.setReactionEnabled);
  const reactionScale = useVisualizationViewStore((s) => s.reactionScale);
  const setReactionScale = useVisualizationViewStore((s) => s.setReactionScale);
  const reactionShowMoments = useVisualizationViewStore((s) => s.reactionShowMoments);
  const setReactionShowMoments = useVisualizationViewStore((s) => s.setReactionShowMoments);
  const linearStaticResult = useAnalysisVisualizationStore((s) => s.linearStaticResult);

  const dcrHeatMapEnabled = useVisualizationViewStore((s) => s.dcrHeatMapEnabled);
  const setDcrHeatMapEnabled = useVisualizationViewStore((s) => s.setDcrHeatMapEnabled);
  const dcrRecords = useDcrStore((s) => s.records);
  const dcrRecordCount = Object.keys(dcrRecords).length;

  const modeShapeEnabled = useVisualizationViewStore((s) => s.modeShapeEnabled);
  const setModeShapeEnabled = useVisualizationViewStore((s) => s.setModeShapeEnabled);
  const modeShapeSource = useVisualizationViewStore((s) => s.modeShapeSource);
  const setModeShapeSource = useVisualizationViewStore((s) => s.setModeShapeSource);
  const modeShapeIndex = useVisualizationViewStore((s) => s.modeShapeIndex);
  const setModeShapeIndex = useVisualizationViewStore((s) => s.setModeShapeIndex);
  const modeShapeScale = useVisualizationViewStore((s) => s.modeShapeScale);
  const setModeShapeScale = useVisualizationViewStore((s) => s.setModeShapeScale);
  const modeShapeAnimating = useVisualizationViewStore((s) => s.modeShapeAnimating);
  const setModeShapeAnimating = useVisualizationViewStore((s) => s.setModeShapeAnimating);
  const modalResult = useAnalysisVisualizationStore((s) => s.modalResult);
  const bucklingResult = useAnalysisVisualizationStore((s) => s.bucklingResult);
  const availableModes = modeShapeSource === "modal" ? modalResult?.modes : bucklingResult?.modes;
  const modeCount = availableModes?.length ?? 0;

  const stressContourEnabled = useVisualizationViewStore((s) => s.stressContourEnabled);
  const setStressContourEnabled = useVisualizationViewStore((s) => s.setStressContourEnabled);

  const hingeMarkersEnabled = useVisualizationViewStore((s) => s.hingeMarkersEnabled);
  const setHingeMarkersEnabled = useVisualizationViewStore((s) => s.setHingeMarkersEnabled);
  const hingeMarkerShowLabels = useVisualizationViewStore((s) => s.hingeMarkerShowLabels);
  const setHingeMarkerShowLabels = useVisualizationViewStore((s) => s.setHingeMarkerShowLabels);
  const nonlinearStaticResult = useAnalysisVisualizationStore((s) => s.nonlinearStaticResult);
  const pushoverResult = useAnalysisVisualizationStore((s) => s.pushoverResult);
  const activeHingeCount =
    (activeAnalysisType === "nonlinear-static" ? nonlinearStaticResult?.hingeStates?.length : undefined) ??
    (activeAnalysisType === "pushover" ? pushoverResult?.finalHingeStates?.length : undefined) ??
    0;

  const sortedStories = [...stories].sort((a, b) => b.order - a.order);

  const selectedElement =
    selection.type === "element" ? elements.find((e) => e.elementId === selection.elementId) : null;

  const categoriesPresent = new Set(elements.map((e) => e.category));

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Story Isolation
        </h3>
        <select
          value={isolatedStoryId ?? ""}
          onChange={(e) => setIsolatedStoryId(e.target.value === "" ? null : e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="">All Stories</option>
          {sortedStories.map((story) => (
            <option key={story.storyId} value={story.storyId}>
              {story.name}
            </option>
          ))}
        </select>

        {isolatedStoryId && (
          <label className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={fadeNonIsolated}
              onChange={(e) => setFadeNonIsolated(e.target.checked)}
              className="accent-sky-500"
            />
            Fade other stories (instead of hiding)
          </label>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Render Mode
        </h3>
        <div className="flex gap-1">
          {RENDER_MODES.map((rm) => (
            <button
              key={rm.mode}
              onClick={() => setRenderMode(rm.mode)}
              className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                renderMode === rm.mode
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {rm.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Displacement / Deformation
        </h3>

        {activeAnalysisType ? (
          <p className="text-xs text-slate-400 mb-2">
            Active result: <span className="text-slate-200">{ANALYSIS_TYPE_LABELS[activeAnalysisType]}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-600 mb-2">
            কোনো Analysis result নেই — Analysis ট্যাবে একটা run করুন।
          </p>
        )}

        {activeAnalysisType && !DISPLACEMENT_CAPABLE_TYPES.has(activeAnalysisType) && (
          <p className="text-[11px] text-amber-400/90 mb-2">
            {ANALYSIS_TYPE_LABELS[activeAnalysisType]} এ সরাসরি deformable displacement নেই (Modal/
            Buckling/Pushover এর mode shape animation পরবর্তী sub-phase এ যোগ হবে)।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-3">
          <input
            type="checkbox"
            checked={deformationEnabled}
            onChange={(e) => setDeformationEnabled(e.target.checked)}
            disabled={!activeAnalysisType}
            className="accent-sky-500"
          />
          Show deformed shape
        </label>

        {deformationEnabled && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">Scale factor</span>
                <span className="text-[11px] text-slate-300">{deformationScale}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={deformationScale}
                onChange={(e) => setDeformationScale(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className={`w-full text-xs py-1.5 rounded transition-colors ${
                isAnimating
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:text-slate-100"
              }`}
            >
              {isAnimating ? "⏸ Pause Animation" : "▶ Animate Deformation"}
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Moment / Shear / Axial Diagram
        </h3>

        <p className="text-[11px] text-slate-600 mb-2">
          শুধু Beam/Column/Brace/Pile — Slab/Wall এর force recovery নেই
          (Phase 4a সীমাবদ্ধতা, displacement-only)। Diagram piecewise-
          linear approximation, দুই প্রান্তের value দিয়ে (backend থেকে
          mid-span sample point পাওয়া যায় না)।
        </p>

        {(!elementEndForces || elementEndForces.length === 0) && (
          <p className="text-xs text-slate-600 mb-2">
            কোনো Element End Forces নেই — Analysis ট্যাবে একটা run করুন।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-3">
          <input
            type="checkbox"
            checked={diagramEnabled}
            onChange={(e) => setDiagramEnabled(e.target.checked)}
            disabled={!elementEndForces || elementEndForces.length === 0}
            className="accent-sky-500"
          />
          Show diagram
        </label>

        {diagramEnabled && (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] text-slate-500 block mb-1">Quantity</span>
              <div className="flex gap-1">
                {(["moment", "shear", "axial"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setDiagramQuantity(q)}
                    className={`flex-1 text-xs py-1 rounded capitalize transition-colors ${
                      diagramQuantity === q
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">Scale factor</span>
                <span className="text-[11px] text-slate-300">{diagramScale.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0.001}
                max={0.5}
                step={0.001}
                value={diagramScale}
                onChange={(e) => setDiagramScale(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-orange-500" /> Y-plane
              </span>
              {diagramQuantity !== "axial" && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-sky-400" /> Z-plane
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Reaction Display
        </h3>

        <p className="text-[11px] text-slate-600 mb-2">
          শুধু Linear Static এ পাওয়া যায় (backend penalty-method দিয়ে
          global DOF এ reaction গণনা করে, hand-verified)।
        </p>

        {!linearStaticResult?.reactionForces?.length && (
          <p className="text-xs text-slate-600 mb-2">
            কোনো Reaction ফলাফল নেই — Analysis ট্যাবে Linear Static চালান।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-3">
          <input
            type="checkbox"
            checked={reactionEnabled}
            onChange={(e) => setReactionEnabled(e.target.checked)}
            disabled={!linearStaticResult?.reactionForces?.length}
            className="accent-sky-500"
          />
          Show reactions
        </label>

        {reactionEnabled && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">Arrow size</span>
                <span className="text-[11px] text-slate-300">{reactionScale.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={reactionScale}
                onChange={(e) => setReactionScale(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={reactionShowMoments}
                onChange={(e) => setReactionShowMoments(e.target.checked)}
                className="accent-sky-500"
              />
              Show moment labels
            </label>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          DCR / Utilization Heat Map
        </h3>

        <p className="text-[11px] text-slate-600 mb-2">
          Design ট্যাবে যেসব element এর design run হয়েছে, তাদের governing
          utilization ratio অনুযায়ী রং করে (green ≤0.7, yellow 0.7-1.0,
          red ≥1.0)। যে element এর design এখনো চালানো হয়নি সেটা normal
          category color এই থাকে।
        </p>

        {dcrRecordCount === 0 && (
          <p className="text-xs text-slate-600 mb-2">
            কোনো DCR ফলাফল নেই — Design ট্যাবে কিছু element এর design
            চালান।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
          <input
            type="checkbox"
            checked={dcrHeatMapEnabled}
            onChange={(e) => setDcrHeatMapEnabled(e.target.checked)}
            disabled={dcrRecordCount === 0}
            className="accent-sky-500"
          />
          Show heat map ({dcrRecordCount} element{dcrRecordCount === 1 ? "" : "s"})
        </label>

        {dcrHeatMapEnabled && (
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#22c55e]" /> ≤0.7
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#eab308]" /> 0.7-1.0
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#ef4444]" /> ≥1.0
            </span>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Mode Shape / Buckling Animation
        </h3>

        <p className="text-[11px] text-slate-600 mb-2">
          Normalized shape (arbitrary scale, physical displacement না) —
          Displacement/Deformation এর সাথে একসাথে চালু করা যায় না।
        </p>

        <div className="flex gap-1 mb-2">
          {(["modal", "buckling"] as const).map((src) => (
            <button
              key={src}
              onClick={() => {
                setModeShapeSource(src);
                setModeShapeIndex(0);
              }}
              className={`flex-1 text-xs py-1 rounded capitalize transition-colors ${
                modeShapeSource === src
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:text-slate-100"
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        {modeCount === 0 && (
          <p className="text-xs text-slate-600 mb-2">
            কোনো {modeShapeSource === "modal" ? "Modal" : "Buckling"} result নেই — Analysis ট্যাবে চালান।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-3">
          <input
            type="checkbox"
            checked={modeShapeEnabled}
            onChange={(e) => {
              setModeShapeEnabled(e.target.checked);
              if (e.target.checked) setDeformationEnabled(false); // mutually exclusive
            }}
            disabled={modeCount === 0}
            className="accent-sky-500"
          />
          Show mode shape
        </label>

        {modeShapeEnabled && modeCount > 0 && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">
                  Mode {modeShapeIndex + 1} of {modeCount}
                </span>
                {modeShapeSource === "modal" && modalResult?.modes?.[modeShapeIndex] && (
                  <span className="text-[11px] text-slate-400">
                    T={(1 / modalResult.modes[modeShapeIndex].naturalFrequencyHz).toFixed(3)}s
                  </span>
                )}
                {modeShapeSource === "buckling" && bucklingResult?.modes?.[modeShapeIndex] && (
                  <span className="text-[11px] text-slate-400">
                    λ={bucklingResult.modes[modeShapeIndex].criticalLoadFactor?.toFixed(2)}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={modeCount - 1}
                step={1}
                value={modeShapeIndex}
                onChange={(e) => setModeShapeIndex(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">Scale factor</span>
                <span className="text-[11px] text-slate-300">{modeShapeScale}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={modeShapeScale}
                onChange={(e) => setModeShapeScale(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <button
              onClick={() => setModeShapeAnimating(!modeShapeAnimating)}
              className={`w-full text-xs py-1.5 rounded transition-colors ${
                modeShapeAnimating
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:text-slate-100"
              }`}
            >
              {modeShapeAnimating ? "⏸ Pause Animation" : "▶ Animate Mode Shape"}
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Stress / Strain Contour
        </h3>

        <p className="text-[11px] text-amber-400/90 mb-2">
          এটা প্রকৃত stress না — shell element (Slab/Wall) এ কোনো FE
          stress/moment recovery নেই এই ইঞ্জিনে (শুধু displacement)।
          এই contour প্রতিটা shell element এর গড় displacement
          magnitude দেখায় (blue=কম, red=বেশি, dataset-relative স্কেল)
          — বেশি নড়াচড়া মানে সাধারণত বেশি strain, কিন্তু thickness/
          material/boundary condition বিবেচনা করে না। শুধু একটা visual
          indicator, design এর জন্য ব্যবহারযোগ্য না।
        </p>

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
          <input
            type="checkbox"
            checked={stressContourEnabled}
            onChange={(e) => setStressContourEnabled(e.target.checked)}
            className="accent-sky-500"
          />
          Show contour (proxy)
        </label>

        {stressContourEnabled && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>কম</span>
            <span className="flex-1 h-2 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#22c55e] via-[#eab308] to-[#ef4444]" />
            <span>বেশি</span>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Crack Prediction / Failure Visualization
        </h3>

        <p className="text-[11px] text-amber-400/90 mb-2">
          শুধু চূড়ান্ত (converged) hinge অবস্থা দেখায় — কোনো step-by-step
          progressive animation নেই (backend intermediate step সংরক্ষণ
          করে না)। &ldquo;Crack&rdquo; মানে প্রকৃত crack-width model না, শুধু hinge
          yield (reinforcement yield stress) কে crack-প্রবণ location এর
          proxy হিসেবে ধরা হয়েছে। শুধু Nonlinear Static/Pushover এ
          পাওয়া যায় (elastic analysis এ hinge concept নেই)।
        </p>

        {activeHingeCount === 0 && (
          <p className="text-xs text-slate-600 mb-2">
            কোনো Hinge ফলাফল নেই — Analysis ট্যাবে Nonlinear Static বা
            Pushover চালান।
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
          <input
            type="checkbox"
            checked={hingeMarkersEnabled}
            onChange={(e) => setHingeMarkersEnabled(e.target.checked)}
            disabled={activeHingeCount === 0}
            className="accent-sky-500"
          />
          Show hinge markers ({activeHingeCount})
        </label>

        {hingeMarkersEnabled && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={hingeMarkerShowLabels}
                onChange={(e) => setHingeMarkerShowLabels(e.target.checked)}
                className="accent-sky-500"
              />
              Show plastic rotation labels
            </label>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-[#ef4444]" /> Yielded
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-[#64748b]" /> Not yielded
              </span>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Element Visibility
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setAllCategoriesVisible(true)}
              className="text-[10px] text-sky-400 hover:text-sky-300"
            >
              All
            </button>
            <button
              onClick={() => setAllCategoriesVisible(false)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              None
            </button>
          </div>
        </div>
        <div className="space-y-1">
          {CATEGORY_LABELS.filter((c) => categoriesPresent.has(c.category)).map((c) => (
            <label key={c.category} className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={categoryVisibility[c.category] ?? true}
                onChange={() => toggleCategoryVisibility(c.category)}
                className="accent-sky-500"
              />
              {c.label}
            </label>
          ))}
          {categoriesPresent.size === 0 && (
            <p className="text-xs text-slate-600">কোনো element এখনো তৈরি হয়নি।</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Selected Element
        </h3>
        {selectedElement ? (
          <div className="bg-slate-800/60 rounded p-2.5 text-xs text-slate-300 space-y-1">
            <p>
              <span className="text-slate-500">Label:</span> {selectedElement.label}
            </p>
            <p>
              <span className="text-slate-500">Category:</span> {selectedElement.category}
            </p>
            <p>
              <span className="text-slate-500">ID:</span> {selectedElement.elementId}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600">Viewport এ একটা element ক্লিক করুন।</p>
        )}
      </section>

      <section className="border-t border-slate-800 pt-4">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Phase 10 Visualization সম্পূর্ণ (10i-10r): 3D Viewer Core,
          Rebar Detailing Model, Displacement/Deformation Animation,
          Force Diagram, Reaction Display, DCR Heat Map, Mode Shape/
          Buckling Animation, Stress-proxy Contour, ও Crack/Failure
          Visualization।
        </p>
      </section>
    </div>
  );
}
