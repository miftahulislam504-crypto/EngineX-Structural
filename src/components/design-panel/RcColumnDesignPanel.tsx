"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { runRcColumnDesign, type RcColumnDesignReport } from "@/lib/design/rcColumnDesign";
import { checkColumnBiaxialBending, type BiaxialCheckResult } from "@/lib/design/rcColumnBiaxial";
import type { ColumnElement } from "@/lib/types/element";
import type { RectangularSection } from "@/lib/types/section";
import { selectColumnBarArrangement } from "@/lib/design/barSelection";
import { generateColumnDetailing } from "@/lib/detailing/generateColumnDetailing";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { persistDesignResult } from "@/lib/design/firestore";
import { persistDetailingResult } from "@/lib/detailing/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function elementLength(e: ColumnElement): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Infinity/NaN হলে "—" দেখায়, নাহলে fixed-decimal — UI তে "Infinity" string এড়াতে। */
function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 6b/6f — RC Column Design panel। Slenderness (moment magnification),
 * P-M interaction adequacy, longitudinal reinforcement ratio, tie
 * spacing — চারটা চেক একসাথে চালায়। rectangular tied column। Uniaxial
 * (Mz) ডিফল্ট, ঐচ্ছিক "Check biaxial bending" টগল দিয়ে দ্বিতীয় অক্ষের
 * moment (Muy) যোগ করে ACI load-contour method (rcColumnBiaxial.ts)
 * চালানো যায়। elementEndForces থেকে governing axial/moment auto-
 * populate করার সুবিধা সহ।
 */
export function RcColumnDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);
  const sourceAnalysisType = useAnalysisResultStore((s) => s.sourceAnalysisType);
  const setDetailingResult = useDetailingStore((s) => s.setResult);
  const setDcrChecks = useDcrStore((s) => s.setChecks);
  const projectId = useProjectIdStore((s) => s.projectId);

  const columns = useMemo(
    () => elements.filter((e): e is ColumnElement => e.category === "column"),
    [elements]
  );

  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const selectedColumn = columns.find((c) => c.elementId === selectedColumnId) ?? null;

  const columnSection = selectedColumn
    ? sections.find((s) => s.sectionId === selectedColumn.sectionId)
    : undefined;
  const columnMaterial = selectedColumn
    ? materials.find((m) => m.materialId === selectedColumn.materialId)
    : undefined;
  const isRectangular = columnSection?.shape === "rectangular";
  const isConcrete = columnMaterial?.type === "concrete";

  const governingForces = useMemo(() => {
    if (!selectedColumn || !elementEndForces) return null;
    const forcesForColumn = elementEndForces.filter((f) => f.elementId === selectedColumn.elementId);
    if (forcesForColumn.length === 0) return null;

    let maxAxial = 0;
    let startM = 0;
    let endM = 0;
    let maxMomentY = 0;
    for (const f of forcesForColumn) {
      maxAxial = Math.max(maxAxial, Math.abs(f.startAxial), Math.abs(f.endAxial));
      startM = Math.max(startM, Math.abs(f.startMomentZ));
      endM = Math.max(endM, Math.abs(f.endMomentZ));
      maxMomentY = Math.max(maxMomentY, Math.abs(f.startMomentY), Math.abs(f.endMomentY));
    }
    return { maxAxial, startM, endM, maxMomentY };
  }, [selectedColumn, elementEndForces]);

  const [effectiveLengthFactor, setEffectiveLengthFactor] = useState("1.0");
  const [isSwayFrame, setIsSwayFrame] = useState(false);
  const [coverToBarCentroidMm, setCoverToBarCentroidMm] = useState("60");
  const [totalAsMm2, setTotalAsMm2] = useState("");
  const [longitudinalBarDiameterMm, setLongitudinalBarDiameterMm] = useState("20");
  const [tieDiameterMm, setTieDiameterMm] = useState("10");
  const [providedTieSpacingMm, setProvidedTieSpacingMm] = useState("");
  const [factoredAxialLoadKN, setFactoredAxialLoadKN] = useState("");
  const [m1KNm, setM1KNm] = useState("");
  const [m2KNm, setM2KNm] = useState("");
  const [isSingleCurvature, setIsSingleCurvature] = useState(false);
  const [criticalBucklingLoadKN, setCriticalBucklingLoadKN] = useState("");

  const [enableBiaxialCheck, setEnableBiaxialCheck] = useState(false);
  const [momentYKNm, setMomentYKNm] = useState("");

  const [report, setReport] = useState<RcColumnDesignReport | null>(null);
  const [biaxialResult, setBiaxialResult] = useState<BiaxialCheckResult | null>(null);

  function handleUseAutoValues() {
    if (governingForces) {
      setFactoredAxialLoadKN(governingForces.maxAxial.toFixed(2));
      const smaller = Math.min(governingForces.startM, governingForces.endM);
      const larger = Math.max(governingForces.startM, governingForces.endM);
      setM1KNm(smaller.toFixed(2));
      setM2KNm(larger.toFixed(2));
      setMomentYKNm(governingForces.maxMomentY.toFixed(2));
    }
  }

  function handleRunDesign() {
    if (!selectedColumn || !columnSection || columnSection.shape !== "rectangular" || !columnMaterial) return;
    const section = columnSection as RectangularSection;
    const fy = columnMaterial.type === "concrete" ? columnMaterial.rebarFy ?? 414 : 414;
    const fc = columnMaterial.type === "concrete" ? columnMaterial.fc : 28;

    const input = {
      elementLabel: selectedColumn.label,
      widthMm: section.width,
      totalDepthMm: section.depth,
      unsupportedLengthMm: elementLength(selectedColumn) * 1000,
      effectiveLengthFactor: Number(effectiveLengthFactor) || 1.0,
      isSwayFrame,
      coverToBarCentroidMm: Number(coverToBarCentroidMm) || 60,
      fcMPa: fc,
      fyMPa: fy,
      totalAsMm2: Number(totalAsMm2) || 0,
      longitudinalBarDiameterMm: Number(longitudinalBarDiameterMm) || 20,
      tieDiameterMm: Number(tieDiameterMm) || 10,
      providedTieSpacingMm: providedTieSpacingMm.trim() !== "" ? Number(providedTieSpacingMm) : undefined,
      factoredAxialLoadKN: Number(factoredAxialLoadKN) || 0,
      m1KNm: Number(m1KNm) || 0,
      m2KNm: Number(m2KNm) || 0,
      isSingleCurvature,
      criticalBucklingLoadKN: Number(criticalBucklingLoadKN) || 0,
    };
    const result = runRcColumnDesign(input);
    setReport(result);
    if (enableBiaxialCheck) {
      const biaxial = checkColumnBiaxialBending({
        widthMm: section.width,
        totalDepthMm: section.depth,
        fcMPa: fc,
        fyMPa: fy,
        totalAsMm2: Number(totalAsMm2) || 0,
        coverToBarCentroidMm: Number(coverToBarCentroidMm) || 60,
        factoredAxialLoadKN: Number(factoredAxialLoadKN) || 0,
        factoredMomentXKNm: Number(m2KNm) || 0,
        factoredMomentYKNm: Number(momentYKNm) || 0,
      });
      setBiaxialResult(biaxial);
      setDcrChecks(selectedColumn.elementId, selectedColumn.label, [
        { label: "P-M Interaction (uniaxial)", ratio: result.adequacy.utilizationRatio },
        { label: "Biaxial Bending", ratio: biaxial.interactionValue },
      ]);
    } else {
      setBiaxialResult(null);
      setDcrChecks(selectedColumn.elementId, selectedColumn.label, [
        { label: "P-M Interaction", ratio: result.adequacy.utilizationRatio },
      ]);
    }
    setDetailingSent(false);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selectedColumn.elementId,
        elementLabel: selectedColumn.label,
        elementCategory: "column",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist column design result:", e));
    }
  }

  const [detailingSent, setDetailingSent] = useState(false);

  function handleSendToDetailing() {
    if (!selectedColumn || !columnSection || columnSection.shape !== "rectangular" || !report) return;
    const section = columnSection as RectangularSection;
    const providedAs = Number(totalAsMm2) || 0;

    const barLayout = selectColumnBarArrangement({
      requiredTotalAreaMm2: providedAs,
      widthMm: section.width,
      depthMm: section.depth,
      candidateDiametersMm: [Number(longitudinalBarDiameterMm) || 20],
    });

    const detailing = generateColumnDetailing({
      elementId: selectedColumn.elementId,
      elementLabel: selectedColumn.label,
      unsupportedLengthMm: elementLength(selectedColumn) * 1000,
      widthMm: section.width,
      totalDepthMm: section.depth,
      coverToBarCentroidMm: Number(coverToBarCentroidMm) || 60,
      longitudinalBarDiameterMm: Number(longitudinalBarDiameterMm) || 20,
      tieDiameterMm: Number(tieDiameterMm) || 10,
      totalAsMm2: providedAs,
      tieSpacingMm: report.tieSpacing.providedSpacingMm ?? report.tieSpacing.maxSpacingMm,
      barsAlongWidth: barLayout.barsAlongWidth,
      barsAlongDepth: barLayout.barsAlongDepth,
      report,
    });
    setDetailingResult(detailing);
    setDetailingSent(true);
    if (projectId) {
      persistDetailingResult(projectId, detailing).catch((e) =>
        console.error("Failed to persist column detailing result:", e)
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">RC Column Design</h3>
        <p className="text-xs text-text-muted mb-3">
          ACI 318-19 — slenderness (moment magnification), P-M interaction, reinforcement ratio, tie spacing.
        </p>

        <label className="block text-xs text-text-muted mb-1">Column</label>
        <select
          value={selectedColumnId}
          onChange={(e) => {
            setSelectedColumnId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a column...</option>
          {columns.map((c) => (
            <option key={c.elementId} value={c.elementId}>
              {c.label}
            </option>
          ))}
        </select>

        {selectedColumn && !isRectangular && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            RC column design in this version only supports rectangular sections. This column uses a{" "}
            {columnSection?.shape ?? "unknown"} section.
          </p>
        )}
        {selectedColumn && isRectangular && !isConcrete && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            This column&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selectedColumn && isRectangular && isConcrete && (
        <>
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
            <p className="text-xs text-text-muted font-medium">
              Section: {(columnSection as RectangularSection).width}×{(columnSection as RectangularSection).depth}
              mm, Length: {(elementLength(selectedColumn) * 1000).toFixed(0)}mm
            </p>

            {governingForces ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-status-activeText">
                  From {sourceAnalysisType}: Pu≈{governingForces.maxAxial.toFixed(1)} kN, M1≈
                  {Math.min(governingForces.startM, governingForces.endM).toFixed(1)}, M2≈
                  {Math.max(governingForces.startM, governingForces.endM).toFixed(1)} kN·m
                </p>
                <button
                  type="button"
                  onClick={handleUseAutoValues}
                  className="text-xs bg-brand-100 hover:bg-brand-600 text-white px-2 py-1 rounded-md"
                >
                  Use these
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                No analysis result available for this column yet — run an Analysis first, or enter loads manually
                below.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Factored Axial Pu (kN)</label>
              <input
                type="number"
                step="any"
                value={factoredAxialLoadKN}
                onChange={(e) => setFactoredAxialLoadKN(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Critical Buckling Load Pc (kN)</label>
              <input
                type="number"
                step="any"
                value={criticalBucklingLoadKN}
                onChange={(e) => setCriticalBucklingLoadKN(e.target.value)}
                placeholder="from Buckling Analysis"
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">M1 — smaller end moment (kN·m)</label>
              <input
                type="number"
                step="any"
                value={m1KNm}
                onChange={(e) => setM1KNm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">M2 — larger end moment (kN·m)</label>
              <input
                type="number"
                step="any"
                value={m2KNm}
                onChange={(e) => setM2KNm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input type="checkbox" checked={isSwayFrame} onChange={(e) => setIsSwayFrame(e.target.checked)} />
              Sway frame
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={isSingleCurvature}
                onChange={(e) => setIsSingleCurvature(e.target.checked)}
              />
              Single curvature
            </label>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={enableBiaxialCheck}
              onChange={(e) => setEnableBiaxialCheck(e.target.checked)}
            />
            Check biaxial bending (uses M2 as Mux, plus Muy below)
          </label>

          {enableBiaxialCheck && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Muy — moment about Y-axis (kN·m)</label>
              <input
                type="number"
                step="any"
                value={momentYKNm}
                onChange={(e) => setMomentYKNm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Effective Length Factor k</label>
              <input
                type="number"
                step="any"
                value={effectiveLengthFactor}
                onChange={(e) => setEffectiveLengthFactor(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Cover to Bar Centroid (mm)</label>
              <input
                type="number"
                step="any"
                value={coverToBarCentroidMm}
                onChange={(e) => setCoverToBarCentroidMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Total Longitudinal As (mm²)</label>
              <input
                type="number"
                step="any"
                value={totalAsMm2}
                onChange={(e) => setTotalAsMm2(e.target.value)}
                placeholder="all bars combined"
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Longitudinal Bar Diameter (mm)</label>
              <input
                type="number"
                step="any"
                value={longitudinalBarDiameterMm}
                onChange={(e) => setLongitudinalBarDiameterMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Tie Diameter (mm)</label>
              <input
                type="number"
                step="any"
                value={tieDiameterMm}
                onChange={(e) => setTieDiameterMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Provided Tie Spacing (mm) — optional</label>
              <input
                type="number"
                step="any"
                value={providedTieSpacingMm}
                onChange={(e) => setProvidedTieSpacingMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run RC Column Design
          </button>

          {report && (
            <button
              type="button"
              onClick={handleSendToDetailing}
              className="w-full rounded-md bg-status-activeText hover:opacity-90 text-white text-sm font-medium py-2 transition-colors"
            >
              {detailingSent ? "✓ Sent to Detailing Model" : "🔩 Send to Detailing Model"}
            </button>
          )}
        </>
      )}

      {report && <RcColumnDesignReportView report={report} biaxialResult={biaxialResult} />}
    </div>
  );
}

function RcColumnDesignReportView({
  report,
  biaxialResult,
}: {
  report: RcColumnDesignReport;
  biaxialResult: BiaxialCheckResult | null;
}) {
  const statusStyle =
    report.overallStatus === "ok"
      ? "bg-status-activeBg border-status-activeBorder text-status-activeText"
      : report.overallStatus === "warning"
        ? "bg-status-holdBg border-status-holdBorder text-status-holdText"
        : "bg-red-50 border-red-200 text-red-600";
  const statusIcon = report.overallStatus === "ok" ? "✓" : report.overallStatus === "warning" ? "⚠" : "✗";

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2.5 ${statusStyle}`}>
        <p className="text-xs font-medium">
          {statusIcon} {report.elementLabel} — {report.overallStatus.toUpperCase()}
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Slenderness</p>
        <p className="text-xs text-text-secondary">
          kLu/r = {fmt(report.slenderness.klOverR)} (limit {fmt(report.slenderness.slendernessLimit)}) —{" "}
          {report.slenderness.isSlenderColumn ? "slender" : "short (slenderness may be neglected)"}
        </p>
        {report.slenderness.isSlenderColumn && (
          <p className="text-xs text-text-secondary">
            δns = {fmt(report.slenderness.magnificationFactor, 3)}, magnified moment ={" "}
            {fmt(report.slenderness.magnifiedMomentKNm)} kN·m
          </p>
        )}
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">P-M Interaction</p>
        <p className="text-xs text-text-secondary">
          φMn (interpolated at Pu) = {fmt(report.adequacy.interpolatedPhiMnKNm)} kN·m — utilization{" "}
          {Number.isFinite(report.adequacy.utilizationRatio)
            ? `${(report.adequacy.utilizationRatio * 100).toFixed(0)}%`
            : "—"}{" "}
          ({report.adequacy.adequate ? "adequate" : "NOT adequate"})
        </p>
      </div>

      {biaxialResult && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
          <p className="text-xs text-text-muted font-medium mb-1">Biaxial Bending (Load Contour)</p>
          <p className="text-xs text-text-secondary">
            φMnx = {fmt(biaxialResult.phiMnxKNm)} kN·m, φMny = {fmt(biaxialResult.phiMnyKNm)} kN·m
          </p>
          <p className="text-xs text-text-secondary">
            (Mux/φMnx) + (Muy/φMny) = {fmt(biaxialResult.interactionValue, 3)} —{" "}
            {biaxialResult.adequate ? "adequate" : "NOT adequate"}
          </p>
        </div>
      )}

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Reinforcement Ratio</p>
        <p className="text-xs text-text-secondary">
          ρg = {(report.reinforcementRatio.ratio * 100).toFixed(2)}% (limits{" "}
          {(report.reinforcementRatio.minRatio * 100).toFixed(0)}%–
          {(report.reinforcementRatio.maxRatio * 100).toFixed(0)}%) —{" "}
          {report.reinforcementRatio.adequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Tie Spacing</p>
        <p className="text-xs text-text-secondary">
          Max spacing {fmt(report.tieSpacing.maxSpacingMm, 0)}mm
          {report.tieSpacing.providedSpacingMm !== null &&
            ` — provided ${report.tieSpacing.providedSpacingMm.toFixed(0)}mm (${report.tieSpacing.adequate ? "OK" : "NOT adequate"})`}
        </p>
      </div>

      {(report.allWarnings.length > 0 || (biaxialResult?.warnings.length ?? 0) > 0) && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={`r${i}`} className="text-xs text-status-holdText leading-relaxed">
              {w}
            </p>
          ))}
          {biaxialResult?.warnings.map((w, i) => (
            <p key={`b${i}`} className="text-xs text-status-holdText leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
