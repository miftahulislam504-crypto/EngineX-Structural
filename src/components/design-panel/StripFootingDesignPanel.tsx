"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { sizeStripFootingForBearing, type StripFootingSizingResult } from "@/lib/design/stripFootingSizing";
import { runStripFootingDesign, type StripFootingDesignReport } from "@/lib/design/stripFootingDesign";
import type { StripFootingElement } from "@/lib/types/element";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 7b — Strip/Continuous Footing Design panel। ACI 318-19
 * Chapter 13, per-meter-run bearing sizing + cantilever flexure +
 * one-way shear। এই app কোনো geotechnical analysis করে না —
 * allowable bearing pressure geotechnical report থেকে ইঞ্জিনিয়ার
 * সরবরাহ করেন, wall/line load ও ম্যানুয়ালি।
 */
export function StripFootingDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const projectId = useProjectIdStore((s) => s.projectId);

  const stripFootings = useMemo(
    () => elements.filter((e): e is StripFootingElement => e.category === "strip-footing"),
    [elements]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = stripFootings.find((f) => f.elementId === selectedId) ?? null;
  const material = selected ? materials.find((m) => m.materialId === selected.materialId) : undefined;
  const isConcrete = material?.type === "concrete";

  const [serviceLinearLoadKNPerM, setServiceLinearLoadKNPerM] = useState("");
  const [factoredLinearLoadKNPerM, setFactoredLinearLoadKNPerM] = useState("");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [supportWidthMm, setSupportWidthMm] = useState("230");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");

  const [sizing, setSizing] = useState<StripFootingSizingResult | null>(null);
  const [report, setReport] = useState<StripFootingDesignReport | null>(null);

  function handleRunDesign() {
    if (!selected || !material || material.type !== "concrete") return;
    const fy = material.rebarFy ?? 414;
    const fc = material.fc;

    const sizingResult = sizeStripFootingForBearing({
      serviceLinearLoadKNPerM: Number(serviceLinearLoadKNPerM) || 0,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
    });
    setSizing(sizingResult);

    if (sizingResult.requiredWidthMm <= 0) {
      setReport(null);
      return;
    }

    const designInput = {
      elementLabel: selected.label,
      footingWidthMm: sizingResult.requiredWidthMm,
      supportWidthMm: Number(supportWidthMm) || 230,
      effectiveDepthMm: selected.thickness - (Number(effectiveCoverMm) || 75),
      thicknessMm: selected.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 75,
      factoredLinearLoadKNPerM: Number(factoredLinearLoadKNPerM) || 0,
      fcMPa: fc,
      fyMPa: fy,
    };
    const designResult = runStripFootingDesign(designInput);
    setReport(designResult);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selected.elementId,
        elementLabel: selected.label,
        elementCategory: "strip-footing",
        status: designResult.overallStatus === "error" ? "fail" : designResult.overallStatus,
        detail: {
          input: {
            ...designInput,
            serviceLinearLoadKNPerM: Number(serviceLinearLoadKNPerM) || 0,
            allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
          },
          sizing: sizingResult,
          report: designResult,
        },
      }).catch((e) => console.error("Failed to persist strip-footing design result:", e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Strip Footing Design</h3>
        <p className="text-xs text-text-muted mb-3">
          ACI 318-19 Chapter 13 — per-meter-run bearing sizing, cantilever flexural design, one-way shear.
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — enter the allowable bearing pressure from your
          geotechnical report, and the wall/line load from the Analysis results.
        </p>

        <label className="block text-xs text-text-muted mb-1">Strip Footing</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setSizing(null);
            setReport(null);
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a strip footing...</option>
          {stripFootings.map((f) => (
            <option key={f.elementId} value={f.elementId}>
              {f.label}
            </option>
          ))}
        </select>

        {selected && !isConcrete && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            This footing&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selected && isConcrete && (
        <>
          <p className="text-xs text-text-muted">Thickness: {selected.thickness}mm (from element)</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Service Linear Load wa (kN/m)</label>
              <input
                type="number"
                step="any"
                value={serviceLinearLoadKNPerM}
                onChange={(e) => setServiceLinearLoadKNPerM(e.target.value)}
                placeholder="unfactored"
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Factored Linear Load wu (kN/m)</label>
              <input
                type="number"
                step="any"
                value={factoredLinearLoadKNPerM}
                onChange={(e) => setFactoredLinearLoadKNPerM(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Allowable Bearing Pressure qa (kPa)</label>
              <input
                type="number"
                step="any"
                value={allowableBearingPressureKPa}
                onChange={(e) => setAllowableBearingPressureKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Effective Cover (mm)</label>
              <input
                type="number"
                step="any"
                value={effectiveCoverMm}
                onChange={(e) => setEffectiveCoverMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Wall/Support Width (mm)</label>
            <input
              type="number"
              step="any"
              value={supportWidthMm}
              onChange={(e) => setSupportWidthMm(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Strip Footing Design
          </button>
        </>
      )}

      {sizing && <StripFootingSizingView sizing={sizing} />}
      {report && <StripFootingDesignReportView report={report} />}
    </div>
  );
}

function StripFootingSizingView({ sizing }: { sizing: StripFootingSizingResult }) {
  return (
    <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
      <p className="text-xs text-text-muted font-medium mb-1">Sizing (Soil Bearing)</p>
      <p className="text-xs text-text-secondary">Required width: {sizing.requiredWidthMm}mm (per meter run)</p>
      <p className="text-xs text-text-secondary">Net allowable pressure: {fmt(sizing.netAllowablePressureKPa)} kPa</p>
      {sizing.warnings.map((w, i) => (
        <p key={i} className="text-xs text-status-holdText leading-relaxed">
          {w}
        </p>
      ))}
    </div>
  );
}

function StripFootingDesignReportView({ report }: { report: StripFootingDesignReport }) {
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
        <p className="text-xs text-text-muted font-medium mb-1">Flexural Reinforcement</p>
        <p className="text-xs text-text-secondary">
          As = {fmt(report.flexuralDesign.governingAsMm2, 0)} mm²/m (M = {fmt(report.moment.momentKNmPerM)} kN·m/m)
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">One-Way Shear</p>
        <p className="text-xs text-text-secondary">
          Vu = {fmt(report.oneWayShear.factoredShearKNPerM)} kN/m, φVc = {fmt(report.oneWayShear.phiVcKNPerM)} kN/m —{" "}
          {report.oneWayShear.adequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      {report.allWarnings.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={i} className="text-xs text-status-holdText leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
