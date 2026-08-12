"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runCombinedFootingDesign, type CombinedFootingDesignReport } from "@/lib/design/combinedFootingDesign";
import type { CombinedFootingElement } from "@/lib/types/element";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 7a — Combined Footing Design panel। দুটো কলামের rectangular
 * combined footing। এই app কোনো geotechnical analysis করে না —
 * allowable bearing pressure geotechnical report থেকে ইঞ্জিনিয়ার
 * সরবরাহ করেন। উভয় কলামের service ও factored reaction ম্যানুয়ালি
 * দিতে হয় (isolated FootingDesignPanel-এর মতোই কারণ)।
 */
export function CombinedFootingDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const projectId = useProjectIdStore((s) => s.projectId);

  const combinedFootings = useMemo(
    () => elements.filter((e): e is CombinedFootingElement => e.category === "combined-footing"),
    [elements]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = combinedFootings.find((f) => f.elementId === selectedId) ?? null;
  const material = selected ? materials.find((m) => m.materialId === selected.materialId) : undefined;
  const isConcrete = material?.type === "concrete";

  const [servicePointLoadAKN, setServicePointLoadAKN] = useState("");
  const [servicePointLoadBKN, setServicePointLoadBKN] = useState("");
  const [factoredPointLoadAKN, setFactoredPointLoadAKN] = useState("");
  const [factoredPointLoadBKN, setFactoredPointLoadBKN] = useState("");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [columnAWidthMm, setColumnAWidthMm] = useState("400");
  const [columnADepthMm, setColumnADepthMm] = useState("400");
  const [columnBWidthMm, setColumnBWidthMm] = useState("400");
  const [columnBDepthMm, setColumnBDepthMm] = useState("400");
  const [perpendicularWidthMm, setPerpendicularWidthMm] = useState("1500");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");

  const [report, setReport] = useState<CombinedFootingDesignReport | null>(null);

  const columnToColumnSpacingMm = useMemo(() => {
    if (!selected) return 0;
    const dx = selected.columnBLocation.x - selected.columnALocation.x;
    const dz = selected.columnBLocation.z - selected.columnALocation.z;
    return Math.sqrt(dx * dx + dz * dz) * 1000; // element coordinates মিটারে ধরা হয়, mm এ কনভার্ট
  }, [selected]);

  function handleRunDesign() {
    if (!selected || !material || material.type !== "concrete") return;
    const fy = material.rebarFy ?? 414;
    const fc = material.fc;

    const input = {
      elementLabel: selected.label,
      servicePointLoadAKN: Number(servicePointLoadAKN) || 0,
      servicePointLoadBKN: Number(servicePointLoadBKN) || 0,
      factoredPointLoadAKN: Number(factoredPointLoadAKN) || 0,
      factoredPointLoadBKN: Number(factoredPointLoadBKN) || 0,
      columnToColumnSpacingMm,
      columnAWidthMm: Number(columnAWidthMm) || 400,
      columnADepthMm: Number(columnADepthMm) || 400,
      columnBWidthMm: Number(columnBWidthMm) || 400,
      columnBDepthMm: Number(columnBDepthMm) || 400,
      perpendicularWidthMm: Number(perpendicularWidthMm) || 1500,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
      thicknessMm: selected.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 75,
      fcMPa: fc,
      fyMPa: fy,
    };
    const result = runCombinedFootingDesign(input);
    setReport(result);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selected.elementId,
        elementLabel: selected.label,
        elementCategory: "combined-footing",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist combined-footing design result:", e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Combined Footing Design</h3>
        <p className="text-xs text-text-muted mb-3">
          ACI 318-19 Chapter 13 — resultant-centroid sizing (uniform pressure), longitudinal and transverse flexure,
          shear.
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — enter the allowable bearing pressure from your
          geotechnical report, and each column&apos;s reaction from the Analysis results. Columns A and B are
          assumed collinear (same axis).
        </p>

        <label className="block text-xs text-text-muted mb-1">Combined Footing</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a combined footing...</option>
          {combinedFootings.map((f) => (
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
          <p className="text-xs text-text-muted">
            Thickness: {selected.thickness}mm (from element) · Column spacing: {fmt(columnToColumnSpacingMm, 0)}mm
            (from element geometry)
          </p>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
            <p className="text-xs text-text-secondary font-medium">Column A</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Service Load Pa (kN)</label>
                <input
                  type="number"
                  step="any"
                  value={servicePointLoadAKN}
                  onChange={(e) => setServicePointLoadAKN(e.target.value)}
                  placeholder="unfactored"
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Factored Load Pu (kN)</label>
                <input
                  type="number"
                  step="any"
                  value={factoredPointLoadAKN}
                  onChange={(e) => setFactoredPointLoadAKN(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Width along spacing (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={columnAWidthMm}
                  onChange={(e) => setColumnAWidthMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Depth perpendicular (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={columnADepthMm}
                  onChange={(e) => setColumnADepthMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
            <p className="text-xs text-text-secondary font-medium">Column B</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Service Load Pa (kN)</label>
                <input
                  type="number"
                  step="any"
                  value={servicePointLoadBKN}
                  onChange={(e) => setServicePointLoadBKN(e.target.value)}
                  placeholder="unfactored"
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Factored Load Pu (kN)</label>
                <input
                  type="number"
                  step="any"
                  value={factoredPointLoadBKN}
                  onChange={(e) => setFactoredPointLoadBKN(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Width along spacing (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={columnBWidthMm}
                  onChange={(e) => setColumnBWidthMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Depth perpendicular (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={columnBDepthMm}
                  onChange={(e) => setColumnBDepthMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
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
            <label className="block text-xs text-text-muted mb-1">Perpendicular Footing Width (mm)</label>
            <input
              type="number"
              step="any"
              value={perpendicularWidthMm}
              onChange={(e) => setPerpendicularWidthMm(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Combined Footing Design
          </button>
        </>
      )}

      {report && <CombinedFootingDesignReportView report={report} />}
    </div>
  );
}

function CombinedFootingDesignReportView({ report }: { report: CombinedFootingDesignReport }) {
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
        <p className="text-xs text-text-muted font-medium mb-1">Sizing (Resultant-Centroid)</p>
        <p className="text-xs text-text-secondary">
          Length {report.sizing.footingLengthMm}mm × Width {report.sizing.footingWidthMm}mm (area{" "}
          {fmt(report.sizing.requiredAreaM2, 2)}m²)
        </p>
        <p className="text-xs text-text-secondary">
          Overhang beyond A: {fmt(report.sizing.overhangBeyondColumnAMm, 0)}mm · beyond B:{" "}
          {fmt(report.sizing.overhangBeyondColumnBMm, 0)}mm
        </p>
        <p className="text-xs text-text-secondary">Uniform pressure: {fmt(report.sizing.uniformPressureKPa)} kPa</p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Longitudinal Flexural Reinforcement</p>
        <p className="text-xs text-text-secondary">
          Top (hogging, between columns): As = {fmt(report.longitudinalDesign.topReinforcement.governingAsMm2, 0)} mm²
          (M = {fmt(report.longitudinalMoments.maxHoggingMomentKNm)} kN·m)
        </p>
        <p className="text-xs text-text-secondary">
          Bottom (sagging, overhang): As = {fmt(report.longitudinalDesign.bottomReinforcement.governingAsMm2, 0)} mm² (M
          = {fmt(report.longitudinalMoments.maxSaggingMomentKNm)} kN·m)
        </p>
      </div>

      {(
        [
          ["A", report.transverseAtColumnA],
          ["B", report.transverseAtColumnB],
        ] as const
      ).map(([labelSuffix, t]) => (
        <div key={labelSuffix} className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
          <p className="text-xs text-text-muted font-medium mb-1">Transverse @ Column {labelSuffix}</p>
          <p className="text-xs text-text-secondary">
            As = {fmt(t.flexuralDesign.governingAsMm2, 0)} mm²/m (M = {fmt(t.moment.momentKNmPerM)} kN·m/m)
          </p>
          <p className="text-xs text-text-secondary">
            One-way shear: {t.oneWayShear.adequate ? "OK" : "NOT adequate"} — Vu = {fmt(t.oneWayShear.factoredShearKNPerM)}{" "}
            kN/m, φVc = {fmt(t.oneWayShear.phiVcKNPerM)} kN/m
          </p>
          <p className="text-xs text-text-secondary">
            Punching shear: {t.punchingShear.adequate ? "OK" : "NOT adequate"} — φVc ={" "}
            {fmt(t.punchingShear.phiVcKN)} kN
          </p>
        </div>
      ))}

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
