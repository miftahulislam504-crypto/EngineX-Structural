"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runFootingDesign, type FootingDesignReport } from "@/lib/design/footingDesign";
import type { FootingElement } from "@/lib/types/element";
import { generateFootingDetailing } from "@/lib/detailing/generateFootingDetailing";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 6e — Footing Design panel। ACI 318-19 Chapter 13. এই app
 * কোনো geotechnical analysis করে না — allowable bearing pressure
 * geotechnical report থেকে ইঞ্জিনিয়ার সরবরাহ করেন। Column axial
 * reaction (service ও factored, উভয়) ও ম্যানুয়ালি দিতে হয় — Beam/
 * Column panel এর মতো auto-populate নেই কারণ base support reaction
 * elementEndForces এ column-এর শেষ প্রান্তের axial force থেকে
 * ইঞ্জিনিয়ারকে নিজে পড়ে আনতে হবে (কোনো dedicated reaction-force
 * output এখনো নেই backend এ)।
 */
export function FootingDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const setDetailingResult = useDetailingStore((s) => s.setResult);

  const footings = useMemo(
    () => elements.filter((e): e is FootingElement => e.category === "footing"),
    [elements]
  );

  const [selectedFootingId, setSelectedFootingId] = useState<string>("");
  const selectedFooting = footings.find((f) => f.elementId === selectedFootingId) ?? null;
  const footingMaterial = selectedFooting
    ? materials.find((m) => m.materialId === selectedFooting.materialId)
    : undefined;
  const isConcrete = footingMaterial?.type === "concrete";

  const [servicePointLoadKN, setServicePointLoadKN] = useState("");
  const [factoredPointLoadKN, setFactoredPointLoadKN] = useState("");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [isSquareFooting, setIsSquareFooting] = useState(true);
  const [columnWidthMm, setColumnWidthMm] = useState("400");
  const [columnDepthMm, setColumnDepthMm] = useState("400");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");

  const [report, setReport] = useState<FootingDesignReport | null>(null);

  function handleRunDesign() {
    if (!selectedFooting || !footingMaterial || footingMaterial.type !== "concrete") return;
    const fy = footingMaterial.rebarFy ?? 414;
    const fc = footingMaterial.fc;

    const result = runFootingDesign({
      elementLabel: selectedFooting.label,
      servicePointLoadKN: Number(servicePointLoadKN) || 0,
      factoredPointLoadKN: Number(factoredPointLoadKN) || 0,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
      isSquareFooting,
      columnWidthMm: Number(columnWidthMm) || 400,
      columnDepthMm: Number(columnDepthMm) || 400,
      thicknessMm: selectedFooting.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 75,
      fcMPa: fc,
      fyMPa: fy,
    });
    setReport(result);
    setDetailingSent(false);
  }

  const [detailingBarDiameterMm, setDetailingBarDiameterMm] = useState("16");
  const [detailingSent, setDetailingSent] = useState(false);

  function handleSendToDetailing() {
    if (!selectedFooting || !report) return;
    const detailing = generateFootingDetailing({
      elementId: selectedFooting.elementId,
      elementLabel: selectedFooting.label,
      effectiveCoverMm: Number(effectiveCoverMm) || 75,
      barDiameterMm: Number(detailingBarDiameterMm) || 16,
      report,
    });
    setDetailingResult(detailing);
    setDetailingSent(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Footing Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          ACI 318-19 Chapter 13 — soil bearing sizing, flexural design, one-way and punching shear.
        </p>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — enter the allowable bearing pressure from your
          geotechnical report, and the column reaction from the Analysis results (column base end force).
        </p>

        <label className="block text-xs text-slate-500 mb-1">Footing</label>
        <select
          value={selectedFootingId}
          onChange={(e) => {
            setSelectedFootingId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a footing...</option>
          {footings.map((f) => (
            <option key={f.elementId} value={f.elementId}>
              {f.label}
            </option>
          ))}
        </select>

        {selectedFooting && !isConcrete && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This footing&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selectedFooting && isConcrete && (
        <>
          <p className="text-xs text-slate-500">Thickness: {selectedFooting.thickness}mm (from element)</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Service Axial Load Pa (kN)</label>
              <input
                type="number"
                step="any"
                value={servicePointLoadKN}
                onChange={(e) => setServicePointLoadKN(e.target.value)}
                placeholder="unfactored"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Axial Load Pu (kN)</label>
              <input
                type="number"
                step="any"
                value={factoredPointLoadKN}
                onChange={(e) => setFactoredPointLoadKN(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Allowable Bearing Pressure qa (kPa)</label>
              <input
                type="number"
                step="any"
                value={allowableBearingPressureKPa}
                onChange={(e) => setAllowableBearingPressureKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective Cover (mm)</label>
              <input
                type="number"
                step="any"
                value={effectiveCoverMm}
                onChange={(e) => setEffectiveCoverMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Column Width (mm)</label>
              <input
                type="number"
                step="any"
                value={columnWidthMm}
                onChange={(e) => setColumnWidthMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Column Depth (mm)</label>
              <input
                type="number"
                step="any"
                value={columnDepthMm}
                onChange={(e) => setColumnDepthMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={isSquareFooting}
              onChange={(e) => setIsSquareFooting(e.target.checked)}
            />
            Square footing
          </label>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Footing Design
          </button>

          {report && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Mesh Bar Diameter (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={detailingBarDiameterMm}
                  onChange={(e) => setDetailingBarDiameterMm(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
                />
              </div>
              <button
                type="button"
                onClick={handleSendToDetailing}
                className="w-full rounded-md bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-medium py-2 transition-colors"
              >
                {detailingSent ? "✓ Sent to Detailing Model" : "🔩 Send to Detailing Model"}
              </button>
            </div>
          )}
        </>
      )}

      {report && <FootingDesignReportView report={report} />}
    </div>
  );
}

function FootingDesignReportView({ report }: { report: FootingDesignReport }) {
  const statusStyle =
    report.overallStatus === "ok"
      ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
      : report.overallStatus === "warning"
        ? "bg-amber-950/30 border-amber-900 text-amber-400"
        : "bg-red-950/30 border-red-900 text-red-400";
  const statusIcon = report.overallStatus === "ok" ? "✓" : report.overallStatus === "warning" ? "⚠" : "✗";

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2.5 ${statusStyle}`}>
        <p className="text-xs font-medium">
          {statusIcon} {report.elementLabel} — {report.overallStatus.toUpperCase()}
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Sizing (Soil Bearing)</p>
        <p className="text-xs text-slate-300">
          Required: {report.sizing.widthMm}mm × {report.sizing.lengthMm}mm (area {fmt(report.sizing.requiredAreaM2, 2)}m²)
        </p>
        <p className="text-xs text-slate-300">Net allowable pressure: {fmt(report.sizing.netAllowablePressureKPa)} kPa</p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Flexural Reinforcement</p>
        <p className="text-xs text-slate-300">
          Direction X: As = {fmt(report.flexuralDesignX.governingAsMm2, 0)} mm²/m (M = {fmt(report.momentX.momentKNmPerM)}
          kN·m/m)
        </p>
        <p className="text-xs text-slate-300">
          Direction Z: As = {fmt(report.flexuralDesignZ.governingAsMm2, 0)} mm²/m (M = {fmt(report.momentZ.momentKNmPerM)}
          kN·m/m)
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">One-Way Shear</p>
        <p className="text-xs text-slate-300">
          Direction X: Vu = {fmt(report.oneWayShearX.factoredShearKNPerM)} kN/m, φVc ={" "}
          {fmt(report.oneWayShearX.phiVcKNPerM)} kN/m — {report.oneWayShearX.adequate ? "OK" : "NOT adequate"}
        </p>
        <p className="text-xs text-slate-300">
          Direction Z: Vu = {fmt(report.oneWayShearZ.factoredShearKNPerM)} kN/m, φVc ={" "}
          {fmt(report.oneWayShearZ.phiVcKNPerM)} kN/m — {report.oneWayShearZ.adequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Punching Shear</p>
        <p className="text-xs text-slate-300">
          φVc = {fmt(report.punchingShear.phiVcKN)} kN — utilization{" "}
          {Number.isFinite(report.punchingShear.utilizationRatio)
            ? `${(report.punchingShear.utilizationRatio * 100).toFixed(0)}%`
            : "—"}{" "}
          ({report.punchingShear.adequate ? "adequate" : "NOT adequate"})
        </p>
      </div>

      {report.allWarnings.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
