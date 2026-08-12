"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runRcSlabDesign, type RcSlabDesignReport } from "@/lib/design/rcSlabDesign";
import type { SlabPanelType } from "@/lib/design/rcSlabFlexure";
import type { ColumnPosition } from "@/lib/design/rcSlabPunchingShear";
import type { SlabElement } from "@/lib/types/element";
import { generateSlabDetailing } from "@/lib/detailing/generateSlabDetailing";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { persistDesignResult } from "@/lib/design/firestore";
import { persistDetailingResult } from "@/lib/detailing/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

const PANEL_TYPES: { value: SlabPanelType; label: string }[] = [
  { value: "one-way", label: "One-Way" },
  { value: "two-way-interior", label: "Two-Way — Interior Panel" },
  { value: "two-way-edge", label: "Two-Way — Edge Panel" },
  { value: "two-way-corner", label: "Two-Way — Corner Panel" },
];

const COLUMN_POSITIONS: { value: ColumnPosition; label: string }[] = [
  { value: "interior", label: "Interior" },
  { value: "edge", label: "Edge" },
  { value: "corner", label: "Corner" },
];

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 6d — RC Slab Design panel। FE Analysis Engine এর shell
 * element এখনো moment/stress recovery দেয় না, তাই এই panel সরাসরি
 * analysis result ব্যবহার করে না — বরং span/load ইঞ্জিনিয়ার নিজে
 * ইনপুট দেন, ACI moment coefficient method দিয়ে ডিজাইন হয় (RcBeam/
 * RcColumn প্যানেলের auto-populate প্যাটার্ন এখানে প্রযোজ্য না)।
 */
export function RcSlabDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const setDetailingResult = useDetailingStore((s) => s.setResult);
  const setDcrChecks = useDcrStore((s) => s.setChecks);
  const projectId = useProjectIdStore((s) => s.projectId);

  const slabs = useMemo(() => elements.filter((e): e is SlabElement => e.category === "slab"), [elements]);

  const [selectedSlabId, setSelectedSlabId] = useState<string>("");
  const selectedSlab = slabs.find((s) => s.elementId === selectedSlabId) ?? null;
  const slabMaterial = selectedSlab ? materials.find((m) => m.materialId === selectedSlab.materialId) : undefined;
  const isConcrete = slabMaterial?.type === "concrete";

  const [panelType, setPanelType] = useState<SlabPanelType>("two-way-interior");
  const [shortSpanMm, setShortSpanMm] = useState("");
  const [longSpanMm, setLongSpanMm] = useState("");
  const [isOneWayContinuous, setIsOneWayContinuous] = useState(true);
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("25");
  const [factoredLoadKPa, setFactoredLoadKPa] = useState("");

  const [enablePunching, setEnablePunching] = useState(false);
  const [columnWidthMm, setColumnWidthMm] = useState("400");
  const [columnDepthMm, setColumnDepthMm] = useState("400");
  const [columnPosition, setColumnPosition] = useState<ColumnPosition>("interior");
  const [factoredColumnShearKN, setFactoredColumnShearKN] = useState("");

  const [report, setReport] = useState<RcSlabDesignReport | null>(null);

  function handleRunDesign() {
    if (!selectedSlab || !slabMaterial || slabMaterial.type !== "concrete") return;
    const fy = slabMaterial.rebarFy ?? 414;
    const fc = slabMaterial.fc;

    const input = {
      elementLabel: selectedSlab.label,
      panelType,
      shortSpanMm: Number(shortSpanMm) || 0,
      longSpanMm: panelType !== "one-way" ? Number(longSpanMm) || undefined : undefined,
      clearSpanLongDirectionMm: Math.max(Number(shortSpanMm) || 0, Number(longSpanMm) || 0),
      isOneWayContinuous,
      thicknessMm: selectedSlab.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 25,
      fcMPa: fc,
      fyMPa: fy,
      factoredLoadKPa: Number(factoredLoadKPa) || 0,
      punchingCheck: enablePunching
        ? {
            columnWidthMm: Number(columnWidthMm) || 400,
            columnDepthMm: Number(columnDepthMm) || 400,
            columnPosition,
            factoredColumnShearKN: Number(factoredColumnShearKN) || 0,
          }
        : undefined,
    };
    const result = runRcSlabDesign(input);
    setReport(result);
    setDetailingSent(false);
    if (result.punchingShear) {
      setDcrChecks(selectedSlab.elementId, selectedSlab.label, [
        { label: "Punching Shear", ratio: result.punchingShear.utilizationRatio },
      ]);
    }
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selectedSlab.elementId,
        elementLabel: selectedSlab.label,
        elementCategory: "slab",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist slab design result:", e));
    }
  }

  const [detailingSent, setDetailingSent] = useState(false);
  const [detailingBarDiameterMm, setDetailingBarDiameterMm] = useState("12");

  function handleSendToDetailing() {
    if (!selectedSlab || !report) return;
    const detailing = generateSlabDetailing({
      elementId: selectedSlab.elementId,
      elementLabel: selectedSlab.label,
      vertices: selectedSlab.vertices,
      thicknessMm: selectedSlab.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 25,
      barDiameterMm: Number(detailingBarDiameterMm) || 12,
      report,
    });
    setDetailingResult(detailing);
    setDetailingSent(true);
    if (projectId) {
      persistDetailingResult(projectId, detailing).catch((e) =>
        console.error("Failed to persist slab detailing result:", e)
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">RC Slab Design</h3>
        <p className="text-xs text-text-muted mb-3">
          ACI 318-19 — moment coefficient method (Chapter 8), min thickness/reinforcement, punching shear (§22.6).
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
          Shell analysis results (moments/stresses) are not yet available from the Analysis Engine — this design
          uses the ACI approximate coefficient method with spans and loads you enter directly, not FE results.
        </p>

        <label className="block text-xs text-text-muted mb-1">Slab</label>
        <select
          value={selectedSlabId}
          onChange={(e) => {
            setSelectedSlabId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a slab...</option>
          {slabs.map((s) => (
            <option key={s.elementId} value={s.elementId}>
              {s.label}
            </option>
          ))}
        </select>

        {selectedSlab && !isConcrete && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            This slab&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selectedSlab && isConcrete && (
        <>
          <p className="text-xs text-text-muted">Thickness: {selectedSlab.thickness}mm (from element)</p>

          <div>
            <label className="block text-xs text-text-muted mb-1">Panel Type</label>
            <select
              value={panelType}
              onChange={(e) => setPanelType(e.target.value as SlabPanelType)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            >
              {PANEL_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {panelType === "one-way" ? "Span (mm)" : "Short Span lx (mm)"}
              </label>
              <input
                type="number"
                step="any"
                value={shortSpanMm}
                onChange={(e) => setShortSpanMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            {panelType !== "one-way" && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Long Span ly (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={longSpanMm}
                  onChange={(e) => setLongSpanMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
            )}
            {panelType === "one-way" && (
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={isOneWayContinuous}
                    onChange={(e) => setIsOneWayContinuous(e.target.checked)}
                  />
                  Continuous span
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Factored Load wu (kN/m²)</label>
              <input
                type="number"
                step="any"
                value={factoredLoadKPa}
                onChange={(e) => setFactoredLoadKPa(e.target.value)}
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

          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={enablePunching} onChange={(e) => setEnablePunching(e.target.checked)} />
            Check punching shear (column-supported / flat slab)
          </label>

          {enablePunching && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Column Width (mm)</label>
                  <input
                    type="number"
                    step="any"
                    value={columnWidthMm}
                    onChange={(e) => setColumnWidthMm(e.target.value)}
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Column Depth (mm)</label>
                  <input
                    type="number"
                    step="any"
                    value={columnDepthMm}
                    onChange={(e) => setColumnDepthMm(e.target.value)}
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Column Position</label>
                  <select
                    value={columnPosition}
                    onChange={(e) => setColumnPosition(e.target.value as ColumnPosition)}
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  >
                    {COLUMN_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Factored Column Shear Vu (kN)</label>
                  <input
                    type="number"
                    step="any"
                    value={factoredColumnShearKN}
                    onChange={(e) => setFactoredColumnShearKN(e.target.value)}
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Slab Design
          </button>

          {report && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Mesh Bar Diameter (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={detailingBarDiameterMm}
                  onChange={(e) => setDetailingBarDiameterMm(e.target.value)}
                  className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                />
              </div>
              <button
                type="button"
                onClick={handleSendToDetailing}
                className="w-full rounded-md bg-status-activeText hover:opacity-90 text-white text-sm font-medium py-2 transition-colors"
              >
                {detailingSent ? "✓ Sent to Detailing Model" : "🔩 Send to Detailing Model"}
              </button>
            </div>
          )}
        </>
      )}

      {report && <RcSlabDesignReportView report={report} />}
    </div>
  );
}

function RcSlabDesignReportView({ report }: { report: RcSlabDesignReport }) {
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
        <p className="text-xs text-text-muted font-medium mb-1">Moments (per meter width)</p>
        <p className="text-xs text-text-secondary">M+ = {fmt(report.moments.positiveMomentKNmPerM)} kN·m/m</p>
        {report.moments.negativeMomentKNmPerM > 0 && (
          <p className="text-xs text-text-secondary">M- = {fmt(report.moments.negativeMomentKNmPerM)} kN·m/m</p>
        )}
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Flexural Reinforcement</p>
        <p className="text-xs text-text-secondary">
          As+ = {fmt(report.flexuralDesign.positiveDesign.governingAsMm2, 0)} mm²/m
        </p>
        {report.flexuralDesign.negativeDesign && (
          <p className="text-xs text-text-secondary">
            As- = {fmt(report.flexuralDesign.negativeDesign.governingAsMm2, 0)} mm²/m
          </p>
        )}
        <p className="text-xs text-text-secondary">
          Min (shrinkage/temp, both directions) = {fmt(report.minReinforcement.minAsPerMeterMm2, 0)} mm²/m
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Thickness</p>
        <p className="text-xs text-text-secondary">
          Min required = {fmt(report.minThickness.minThicknessMm, 0)}mm —{" "}
          {report.thicknessAdequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      {report.punchingShear && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
          <p className="text-xs text-text-muted font-medium mb-1">Punching Shear</p>
          <p className="text-xs text-text-secondary">
            φVc = {fmt(report.punchingShear.phiVcKN)} kN (b0={fmt(report.punchingShear.criticalPerimeterMm, 0)}mm)
            — utilization{" "}
            {Number.isFinite(report.punchingShear.utilizationRatio)
              ? `${(report.punchingShear.utilizationRatio * 100).toFixed(0)}%`
              : "—"}{" "}
            ({report.punchingShear.adequate ? "adequate" : "NOT adequate"})
          </p>
        </div>
      )}

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
