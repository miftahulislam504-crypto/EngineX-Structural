"use client";

import { useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import {
  checkAnalysisRunnable,
  runLinearStaticAnalysis,
  runModalAnalysis,
  runBucklingAnalysis,
  runPDeltaAnalysis,
  runResponseSpectrumAnalysis,
  runNonlinearStaticAnalysis,
  runPushoverAnalysis,
  type ParsedAnalysisResult,
  type ParsedModalResult,
  type ParsedBucklingResult,
  type ParsedPDeltaResult,
  type ParsedResponseSpectrumResult,
  type ParsedNonlinearStaticResult,
  type ParsedPushoverResult,
  type PushoverCurvePoint,
} from "@/lib/analysis/runAnalysis";
import type { SeismicZone, SiteClass } from "@/lib/loads/seismicLoad";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { useAnalysisVisualizationStore } from "@/lib/analysis/useAnalysisVisualizationStore";
import { persistAnalysisResult } from "@/lib/analysis/firestore";
import { HingeEditor } from "./HingeEditor";
import { StoryDriftCheckPanel } from "./StoryDriftCheckPanel";
import { IrregularityCheckPanel } from "./IrregularityCheckPanel";
import { TorsionCheckPanel } from "./TorsionCheckPanel";
import { PerformanceBasedDesignPanel } from "./PerformanceBasedDesignPanel";

interface AnalysisPanelProps {
  projectId: string;
}

type AnalysisTypeOption =
  | "linear-static"
  | "modal"
  | "buckling"
  | "pdelta"
  | "response-spectrum"
  | "nonlinear-static"
  | "pushover";

const ANALYSIS_TYPE_LABELS: Record<AnalysisTypeOption, string> = {
  "linear-static": "Linear Static",
  modal: "Modal (Natural Frequency)",
  buckling: "Linear Buckling",
  pdelta: "P-Delta",
  "response-spectrum": "Response Spectrum (Seismic)",
  "nonlinear-static": "Nonlinear Static (Plastic Hinge)",
  pushover: "Pushover (Capacity Curve)",
};

const ANALYSIS_TYPE_DESCRIPTIONS: Record<AnalysisTypeOption, string> = {
  "linear-static": "C++ FE solver (Direct Stiffness Method) — Point Load only.",
  modal: "Computes natural frequency and mode shape (consistent mass matrix, elimination-method BC).",
  buckling: "Critical load factor and buckling mode shape — requires a non-empty Load Case.",
  pdelta: "Second-order (P-Delta) static analysis with displacement amplification factor — requires a non-empty Load Case.",
  "response-spectrum": "Peak seismic response using the BNBC 2020 design spectrum (CQC modal combination).",
  "nonlinear-static": "Concentrated Plastic Hinge method — Newton-Raphson iterative solve, simulates hinge yielding. Requires a non-empty Load Case.",
  pushover: "Pushes a fixed lateral load pattern to a target displacement or collapse, tracing the base-shear-vs-displacement capacity curve. Requires a non-empty Load Case.",
};

const REQUIRES_LOAD_CASE: Record<AnalysisTypeOption, boolean> = {
  "linear-static": true,
  modal: false,
  buckling: true,
  pdelta: true,
  "response-spectrum": false,
  "nonlinear-static": true,
  pushover: true,
};

const SEISMIC_ZONES: SeismicZone[] = ["1", "2", "3", "4"];
const SITE_CLASSES: SiteClass[] = ["SA", "SB", "SC", "SD", "SE"];

/**
 * Phase 4a — Linear Static, Modal, Linear Buckling, P-Delta, Response
 * Spectrum, Nonlinear Static, ও Pushover Analysis চালানোর প্যানেল।
 * একটা dropdown দিয়ে analysis type বেছে নেওয়া যায় (আগে শুধু Linear
 * Static সমর্থিত ছিল UI তে, যদিও backend বাকি analysis type ইতিমধ্যে
 * সমর্থন করত —
 * এই আপডেট সেই gap পূরণ করে)।
 *
 * ফলাফল দেখানোর সময় warnings সবসময় prominently দেখানো হয় (backend
 * থেকে আসা 🔴/⚠️/ℹ️ warning), এমনকি success=true হলেও।
 */
export function AnalysisPanel({ projectId }: AnalysisPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const loadCases = useLoadStore((s) => s.loadCases);

  const [analysisType, setAnalysisType] = useState<AnalysisTypeOption>("linear-static");
  const [numModes, setNumModes] = useState(12);
  const [seismicZone, setSeismicZone] = useState<SeismicZone>("3");
  const [siteClass, setSiteClass] = useState<SiteClass>("SC");
  const [directionDof, setDirectionDof] = useState<0 | 1 | 2>(0);
  const [numLoadSteps, setNumLoadSteps] = useState(10);
  const [controlPointKey, setControlPointKey] = useState<string>("");
  const [controlDof, setControlDof] = useState<0 | 1 | 2>(2);
  const [targetDisplacementMm, setTargetDisplacementMm] = useState(50);

  const [isRunning, setIsRunning] = useState(false);
  const [linearStaticResult, setLinearStaticResult] = useState<ParsedAnalysisResult | null>(null);
  const [modalResult, setModalResult] = useState<ParsedModalResult | null>(null);
  const [bucklingResult, setBucklingResult] = useState<ParsedBucklingResult | null>(null);
  const [pdeltaResult, setPdeltaResult] = useState<ParsedPDeltaResult | null>(null);
  const [rsaResult, setRsaResult] = useState<ParsedResponseSpectrumResult | null>(null);
  const [nonlinearResult, setNonlinearResult] = useState<ParsedNonlinearStaticResult | null>(null);
  const [pushoverResult, setPushoverResult] = useState<ParsedPushoverResult | null>(null);

  const runnableCheck = checkAnalysisRunnable(elements, loadCases);
  const hasElements = elements.length > 0;
  const hasBaseLevelElement = elements.some(
    (e) => "startPoint" in e && (e.startPoint.y <= 1e-3 || e.endPoint.y <= 1e-3)
  );
  const canRun = REQUIRES_LOAD_CASE[analysisType]
    ? runnableCheck.canRun && (analysisType !== "pushover" || controlPointKey !== "")
    : hasElements && hasBaseLevelElement;

  // Pushover এর control point picker — model এর সব element endpoint
  // থেকে unique coordinate বের করা (duplicate coordinate একবারই দেখানো,
  // merged/shared node গুলোতে একাধিকবার UI clutter এড়াতে)। "key" হলো
  // "x,y,z" string (3-decimal rounded, backend এর NodeGraph.index_of()
  // এর সাথে সামঞ্জস্যপূর্ণ) যাতে dropdown value হিসেবে ব্যবহার করা যায়।
  const uniqueNodePoints = (() => {
    const seen = new Map<string, { x: number; y: number; z: number }>();
    for (const e of elements) {
      if (!("startPoint" in e)) continue;
      for (const p of [e.startPoint, e.endPoint]) {
        const key = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, p);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => b[1].y - a[1].y); // উপরের (roof-level) node আগে দেখানো
  })();

  const clearVisualizationResults = useAnalysisVisualizationStore((s) => s.clear);

  function clearAllResults() {
    setLinearStaticResult(null);
    setModalResult(null);
    setBucklingResult(null);
    setPdeltaResult(null);
    setRsaResult(null);
    setNonlinearResult(null);
    setPushoverResult(null);
    clearVisualizationResults();
  }

  const setSharedElementEndForces = useAnalysisResultStore((s) => s.setElementEndForces);
  const setVizLinearStatic = useAnalysisVisualizationStore((s) => s.setLinearStaticResult);
  const setVizModal = useAnalysisVisualizationStore((s) => s.setModalResult);
  const setVizBuckling = useAnalysisVisualizationStore((s) => s.setBucklingResult);
  const setVizPdelta = useAnalysisVisualizationStore((s) => s.setPdeltaResult);
  const setVizResponseSpectrum = useAnalysisVisualizationStore((s) => s.setResponseSpectrumResult);
  const setVizNonlinearStatic = useAnalysisVisualizationStore((s) => s.setNonlinearStaticResult);
  const setVizPushover = useAnalysisVisualizationStore((s) => s.setPushoverResult);

  async function handleRunAnalysis() {
    setIsRunning(true);
    clearAllResults();
    try {
      if (analysisType === "linear-static") {
        const r = await runLinearStaticAnalysis(projectId, elements, materials, sections, loadCases);
        setLinearStaticResult(r);
        if (r.success) setVizLinearStatic(r);
        if (r.success && r.elementEndForces) setSharedElementEndForces(r.elementEndForces, "Linear Static");
        if (r.success) {
          persistAnalysisResult(projectId, "linear-static", r).catch((e) =>
            console.error("Failed to persist linear-static result:", e)
          );
        }
      } else if (analysisType === "modal") {
        const r = await runModalAnalysis(projectId, elements, materials, sections, loadCases, numModes);
        setModalResult(r);
        if (r.success) setVizModal(r);
        if (r.success) {
          persistAnalysisResult(projectId, "modal", r).catch((e) =>
            console.error("Failed to persist modal result:", e)
          );
        }
      } else if (analysisType === "buckling") {
        const r = await runBucklingAnalysis(projectId, elements, materials, sections, loadCases, numModes);
        setBucklingResult(r);
        if (r.success) setVizBuckling(r);
        if (r.success) {
          persistAnalysisResult(projectId, "buckling", r).catch((e) =>
            console.error("Failed to persist buckling result:", e)
          );
        }
      } else if (analysisType === "pdelta") {
        const r = await runPDeltaAnalysis(projectId, elements, materials, sections, loadCases);
        setPdeltaResult(r);
        if (r.success) setVizPdelta(r);
        if (r.success && r.elementEndForces) setSharedElementEndForces(r.elementEndForces, "P-Delta");
        if (r.success) {
          persistAnalysisResult(projectId, "pdelta", r).catch((e) =>
            console.error("Failed to persist pdelta result:", e)
          );
        }
      } else if (analysisType === "response-spectrum") {
        const r = await runResponseSpectrumAnalysis(projectId, elements, materials, sections, loadCases, {
          seismicZone,
          siteClass,
          directionDof,
          numModes,
        });
        setRsaResult(r);
        if (r.success) setVizResponseSpectrum(r);
        if (r.success && r.elementEndForces) setSharedElementEndForces(r.elementEndForces, "Response Spectrum");
        if (r.success) {
          persistAnalysisResult(projectId, "response-spectrum", r).catch((e) =>
            console.error("Failed to persist response-spectrum result:", e)
          );
        }
      } else if (analysisType === "nonlinear-static") {
        const r = await runNonlinearStaticAnalysis(projectId, elements, materials, sections, loadCases, {
          numLoadSteps,
        });
        setNonlinearResult(r);
        if (r.success) setVizNonlinearStatic(r);
        if (r.success && r.elementEndForces) setSharedElementEndForces(r.elementEndForces, "Nonlinear Static");
        if (r.success) {
          persistAnalysisResult(projectId, "nonlinear-static", r).catch((e) =>
            console.error("Failed to persist nonlinear-static result:", e)
          );
        }
      } else {
        const controlPoint = uniqueNodePoints.find(([key]) => key === controlPointKey)?.[1];
        if (!controlPoint) {
          setPushoverResult({ success: false, errorMessage: "Please select a control point.", warnings: [] });
          return;
        }
        const r = await runPushoverAnalysis(projectId, elements, materials, sections, loadCases, {
          controlPoint,
          controlDof,
          targetControlDisplacementM: targetDisplacementMm / 1000,
        });
        setPushoverResult(r);
        if (r.success) setVizPushover(r);
        if (r.success) {
          persistAnalysisResult(projectId, "pushover", r).catch((e) =>
            console.error("Failed to persist pushover result:", e)
          );
        }
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Analysis Type</label>
        <select
          value={analysisType}
          onChange={(e) => {
            setAnalysisType(e.target.value as AnalysisTypeOption);
            clearAllResults();
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          {(Object.keys(ANALYSIS_TYPE_LABELS) as AnalysisTypeOption[]).map((type) => (
            <option key={type} value={type}>
              {ANALYSIS_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        <h3 className="text-sm font-medium text-text-primary mb-1">{ANALYSIS_TYPE_LABELS[analysisType]}</h3>
        <p className="text-xs text-text-muted mb-3">{ANALYSIS_TYPE_DESCRIPTIONS[analysisType]}</p>

        {(analysisType === "modal" || analysisType === "buckling" || analysisType === "response-spectrum") && (
          <div className="mb-3">
            <label className="block text-xs text-text-muted mb-1">Number of Modes: {numModes}</label>
            <input
              type="range"
              min={1}
              max={30}
              value={numModes}
              onChange={(e) => setNumModes(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {analysisType === "response-spectrum" && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Seismic Zone</label>
              <select
                value={seismicZone}
                onChange={(e) => setSeismicZone(e.target.value as SeismicZone)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              >
                {SEISMIC_ZONES.map((z) => (
                  <option key={z} value={z}>
                    Zone {z}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Site Class</label>
              <select
                value={siteClass}
                onChange={(e) => setSiteClass(e.target.value as SiteClass)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              >
                {SITE_CLASSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Direction</label>
              <select
                value={directionDof}
                onChange={(e) => setDirectionDof(Number(e.target.value) as 0 | 1 | 2)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              >
                <option value={0}>X</option>
                <option value={1}>Y</option>
                <option value={2}>Z</option>
              </select>
            </div>
          </div>
        )}

        {analysisType === "nonlinear-static" && (
          <div className="mb-3 space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Load Steps: {numLoadSteps}</label>
              <input
                type="range"
                min={2}
                max={50}
                value={numLoadSteps}
                onChange={(e) => setNumLoadSteps(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
              <HingeEditor projectId={projectId} />
            </div>
          </div>
        )}

        {analysisType === "pushover" && (
          <div className="mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Control Point (push here)</label>
                <select
                  value={controlPointKey}
                  onChange={(e) => setControlPointKey(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                >
                  <option value="">Select a node...</option>
                  {uniqueNodePoints.map(([key, p]) => (
                    <option key={key} value={key}>
                      ({p.x.toFixed(2)}, {p.y.toFixed(2)}, {p.z.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Push Direction</label>
                <select
                  value={controlDof}
                  onChange={(e) => setControlDof(Number(e.target.value) as 0 | 1 | 2)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                >
                  <option value={0}>X</option>
                  <option value={1}>Y</option>
                  <option value={2}>Z</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Target Displacement: {targetDisplacementMm} mm
              </label>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={targetDisplacementMm}
                onChange={(e) => setTargetDisplacementMm(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
              <HingeEditor projectId={projectId} />
            </div>
          </div>
        )}

        {!canRun && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-3">
            {!REQUIRES_LOAD_CASE[analysisType]
              ? "No Beam/Column/Brace/Pile found, or no element is at the base level (Y≈0)."
              : analysisType === "pushover" && !runnableCheck.canRun
                ? runnableCheck.reason
                : analysisType === "pushover" && controlPointKey === ""
                  ? "Please select a control point above."
                  : runnableCheck.reason}
          </p>
        )}

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!canRun || isRunning}
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
        >
          {isRunning ? "Solving..." : "▶ Run Analysis"}
        </button>
      </div>

      {linearStaticResult && <LinearStaticResultView result={linearStaticResult} />}
      {modalResult && <ModalResultView result={modalResult} />}
      {bucklingResult && <BucklingResultView result={bucklingResult} />}
      {pdeltaResult && <PDeltaResultView result={pdeltaResult} />}
      {rsaResult && <ResponseSpectrumResultView result={rsaResult} />}
      {nonlinearResult && <NonlinearStaticResultView result={nonlinearResult} />}
      {pushoverResult && <PushoverResultView result={pushoverResult} />}
      {modalResult && pushoverResult && (
        <PerformanceBasedDesignPanel
          modalResult={modalResult}
          pushoverResult={pushoverResult}
          seismicZone={seismicZone}
          siteClass={siteClass}
        />
      )}
    </div>
  );
}

function StatusBanner({
  success,
  errorMessage,
  summary,
}: {
  success: boolean;
  errorMessage?: string;
  summary: string;
}) {
  if (!success) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
        <p className="text-xs text-red-600 font-medium">✗ Analysis failed</p>
        <p className="text-xs text-text-secondary mt-1">{errorMessage}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md bg-status-activeBg border border-status-activeBorder px-3 py-2.5">
      <p className="text-xs text-status-activeText font-medium mb-1">✓ Analysis complete</p>
      <p className="text-xs text-text-secondary">{summary}</p>
    </div>
  );
}

function WarningsList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
      <p className="text-xs text-text-muted font-medium">Warnings:</p>
      {warnings.map((warning, i) => (
        <p key={i} className="text-xs text-status-holdText">
          {warning}
        </p>
      ))}
    </div>
  );
}

function LinearStaticResultView({ result }: { result: ParsedAnalysisResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.nodeCount ?? "?"} node, ${result.elementCount ?? "?"} element${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && result.nodalDisplacements && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Nodal Displacements</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.nodalDisplacements.map((d, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Node {i}: ux={(d.ux * 1000).toFixed(3)}mm, uy={(d.uy * 1000).toFixed(3)}mm, uz=
                {(d.uz * 1000).toFixed(3)}mm
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <StoryDriftCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <IrregularityCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <TorsionCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
    </div>
  );
}

function ModalResultView({ result }: { result: ParsedModalResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.numModesComputed ?? "?"} modes computed${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && result.modes && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Natural Frequencies</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.modes.map((m, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Mode {i + 1}: {m.naturalFrequencyHz.toFixed(3)} Hz (T = {(1 / m.naturalFrequencyHz).toFixed(3)} s)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BucklingResultView({ result }: { result: ParsedBucklingResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.numModesComputed ?? "?"} buckling modes computed${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && result.modes && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Critical Load Factors</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.modes.map((m, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Mode {i + 1}: λ = {m.criticalLoadFactor.toFixed(4)}
                {m.criticalLoadFactor < 0 && (
                  <span className="text-status-holdText"> (negative — opposite load direction)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PDeltaResultView({ result }: { result: ParsedPDeltaResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.nodeCount ?? "?"} node, ${result.elementCount ?? "?"} element${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && result.maxDisplacementAmplificationRatio !== undefined && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1">Max Displacement Amplification Ratio</p>
          <p className="text-sm text-text-secondary font-mono">{result.maxDisplacementAmplificationRatio.toFixed(3)}x</p>
        </div>
      )}
      {result.success && result.nodalDisplacements && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">P-Delta Nodal Displacements</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.nodalDisplacements.map((d, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Node {i}: ux={(d.ux * 1000).toFixed(3)}mm, uy={(d.uy * 1000).toFixed(3)}mm, uz=
                {(d.uz * 1000).toFixed(3)}mm
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <StoryDriftCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <IrregularityCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <TorsionCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
    </div>
  );
}

function ResponseSpectrumResultView({ result }: { result: ParsedResponseSpectrumResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.numModesComputed ?? "?"} modes used${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Base Shear</p>
            <p className="text-sm text-text-secondary font-mono">{result.baseShear?.toFixed(3)} kN</p>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Mass Participation</p>
            <p
              className={`text-sm font-mono ${
                (result.totalMassParticipationRatio ?? 0) < 0.9 ? "text-status-holdText" : "text-text-secondary"
              }`}
            >
              {((result.totalMassParticipationRatio ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">
            Peak Nodal Displacements (magnitude, CQC-combined)
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.nodalDisplacements.map((d, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Node {i}: ux={(d.ux * 1000).toFixed(3)}mm, uy={(d.uy * 1000).toFixed(3)}mm, uz=
                {(d.uz * 1000).toFixed(3)}mm
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <StoryDriftCheckPanel
          nodes={result.nodes}
          displacements={result.nodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <IrregularityCheckPanel
          nodes={result.nodes}
          displacements={result.nodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <TorsionCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
    </div>
  );
}

function NonlinearStaticResultView({ result }: { result: ParsedNonlinearStaticResult }) {
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.totalLoadSteps ?? "?"} load steps, ${result.totalNewtonIterations ?? "?"} Newton-Raphson iterations${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Convergence</p>
            <p className={`text-sm font-mono ${result.converged ? "text-status-activeText" : "text-status-holdText"}`}>
              {result.converged ? "Converged" : "Not converged"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Displacement Amplification</p>
            <p className="text-sm text-text-secondary font-mono">
              {result.maxDisplacementAmplificationRatio?.toFixed(3)}x
            </p>
          </div>
        </div>
      )}
      {result.success && result.hingeStates && result.hingeStates.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Plastic Hinge States</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.hingeStates.map((h, i) => (
              <div key={i} className="text-xs font-mono flex items-center gap-2">
                <span className={h.yielded ? "text-status-holdText" : "text-text-muted"}>
                  {h.yielded ? "● Yielded" : "○ Elastic"}
                </span>
                <span className="text-text-secondary">
                  Element {h.elementIndex} ({h.isAtStartNode ? "start" : "end"}): M = {h.finalMomentKNm.toFixed(3)} kN·m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Final Nodal Displacements</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.nodalDisplacements.map((d, i) => (
              <div key={i} className="text-xs text-text-secondary font-mono">
                Node {i}: ux={(d.ux * 1000).toFixed(3)}mm, uy={(d.uy * 1000).toFixed(3)}mm, uz=
                {(d.uz * 1000).toFixed(3)}mm
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <StoryDriftCheckPanel
          nodes={result.nodes}
          displacements={result.nodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <IrregularityCheckPanel
          nodes={result.nodes}
          displacements={result.nodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.nodalDisplacements && result.nodes && (
        <TorsionCheckPanel nodes={result.nodes} displacements={result.nodalDisplacements} />
      )}
    </div>
  );
}
function CapacityCurveChart({ curve }: { curve: PushoverCurvePoint[] }) {
  if (curve.length < 2) return null;

  const width = 280;
  const height = 140;
  const padding = 28;

  const maxDisp = Math.max(...curve.map((p) => Math.abs(p.controlDisplacementM)));
  const maxShear = Math.max(...curve.map((p) => p.baseShearKN));
  if (maxDisp <= 0 || maxShear <= 0) return null;

  const toX = (d: number) => padding + (Math.abs(d) / maxDisp) * (width - 2 * padding);
  const toY = (v: number) => height - padding - (v / maxShear) * (height - 2 * padding);

  const points = curve.map((p) => `${toX(p.controlDisplacementM)},${toY(p.baseShearKN)}`).join(" ");
  const firstYieldIndex = curve.findIndex((p) => p.numHingesYielded > 0);

  return (
    <svg width={width} height={height} className="mx-auto">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#475569" strokeWidth={1} />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#475569" strokeWidth={1} />
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      {firstYieldIndex > 0 && (
        <circle
          cx={toX(curve[firstYieldIndex].controlDisplacementM)}
          cy={toY(curve[firstYieldIndex].baseShearKN)}
          r={3}
          fill="#f59e0b"
        />
      )}
      <text x={padding} y={height - 8} fontSize={9} fill="#64748b">
        0
      </text>
      <text x={width - padding} y={height - 8} fontSize={9} fill="#64748b" textAnchor="end">
        {(maxDisp * 1000).toFixed(0)}mm
      </text>
      <text x={padding - 4} y={padding} fontSize={9} fill="#64748b" textAnchor="end">
        {maxShear.toFixed(1)}kN
      </text>
    </svg>
  );
}

function PushoverResultView({ result }: { result: ParsedPushoverResult }) {
  const lastPoint = result.capacityCurve?.[result.capacityCurve.length - 1];
  return (
    <div className="space-y-3">
      <StatusBanner
        success={result.success}
        errorMessage={result.errorMessage}
        summary={`${result.totalPushSteps ?? "?"} push steps, ${result.totalNewtonIterations ?? "?"} Newton-Raphson iterations${
          result.solveTimeSeconds !== undefined ? `, ${(result.solveTimeSeconds * 1000).toFixed(1)}ms to solve` : ""
        }`}
      />
      <WarningsList warnings={result.warnings} />
      {result.success && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Status</p>
            <p
              className={`text-sm font-mono ${
                result.structureCollapsed
                  ? "text-red-600"
                  : result.reachedTargetDisplacement
                    ? "text-status-activeText"
                    : "text-status-holdText"
              }`}
            >
              {result.structureCollapsed ? "Collapsed" : result.reachedTargetDisplacement ? "Target reached" : "Incomplete"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium mb-1">Ultimate Base Shear</p>
            <p className="text-sm text-text-secondary font-mono">{lastPoint?.baseShearKN.toFixed(3) ?? "—"} kN</p>
          </div>
        </div>
      )}
      {result.success && result.capacityCurve && result.capacityCurve.length > 1 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5 text-center">
            Capacity Curve (Base Shear vs. Control Displacement)
          </p>
          <CapacityCurveChart curve={result.capacityCurve} />
        </div>
      )}
      {result.success && result.finalHingeStates && result.finalHingeStates.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-1.5">Final Plastic Hinge States</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.finalHingeStates.map((h, i) => (
              <div key={i} className="text-xs font-mono flex items-center gap-2">
                <span className={h.yielded ? "text-status-holdText" : "text-text-muted"}>
                  {h.yielded ? "● Yielded" : "○ Elastic"}
                </span>
                <span className="text-text-secondary">
                  Element {h.elementIndex} ({h.isAtStartNode ? "start" : "end"}): M = {h.finalMomentKNm.toFixed(3)} kN·m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.success && result.finalNodalDisplacements && result.nodes && (
        <StoryDriftCheckPanel
          nodes={result.nodes}
          displacements={result.finalNodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.finalNodalDisplacements && result.nodes && (
        <IrregularityCheckPanel
          nodes={result.nodes}
          displacements={result.finalNodalDisplacements}
          displacementIsMagnitudeOnly={result.displacementIsMagnitudeOnly}
        />
      )}
      {result.success && result.finalNodalDisplacements && result.nodes && (
        <TorsionCheckPanel nodes={result.nodes} displacements={result.finalNodalDisplacements} />
      )}
    </div>
  );
}
