"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runRcWallDesign, type RcWallDesignReport } from "@/lib/design/rcWallDesign";
import type { StructuralElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import { generateWallDetailing } from "@/lib/detailing/generateWallDetailing";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useDcrStore } from "@/lib/design/useDcrStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

type WallLikeElement = Extract<StructuralElement, { category: "wall" | "shear-wall" | "core-wall" }>;

/** Wall vertices থেকে আনুমানিক horizontal length বের করে — bounding-box diagonal নয়, XZ-প্লেনে span। */
function estimateHorizontalLength(e: WallLikeElement): number {
  const xs = e.vertices.map((v) => v.x);
  const zs = e.vertices.map((v) => v.z);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dz = Math.max(...zs) - Math.min(...zs);
  return Math.sqrt(dx * dx + dz * dz);
}

function estimateHeight(e: WallLikeElement): number {
  const ys = e.vertices.map((v) => v.y);
  return Math.max(...ys) - Math.min(...ys);
}

/**
 * Phase 6d — RC Wall Design panel। ACI 318-19 §11.5.3 empirical
 * axial method (bearing wall) + §11.5.4 in-plane shear (shear wall
 * only)। Wall/Shear Wall/Core Wall element — সবাই একই AreaElement
 * shape শেয়ার করে, তাই একটাই panel দিয়ে সব ধরনের wall handle করা
 * হয়েছে (category অনুযায়ী isShearWall flag পাল্টায়)।
 */
export function RcWallDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const setDetailingResult = useDetailingStore((s) => s.setResult);
  const setDcrChecks = useDcrStore((s) => s.setChecks);

  const walls = useMemo(
    () =>
      elements.filter(
        (e): e is WallLikeElement =>
          e.category === "wall" || e.category === "shear-wall" || e.category === "core-wall"
      ),
    [elements]
  );

  const [selectedWallId, setSelectedWallId] = useState<string>("");
  const selectedWall = walls.find((w) => w.elementId === selectedWallId) ?? null;
  const wallMaterial = selectedWall ? materials.find((m) => m.materialId === selectedWall.materialId) : undefined;
  const isConcrete = wallMaterial?.type === "concrete";
  const isShearWallCategory = selectedWall?.category === "shear-wall" || selectedWall?.category === "core-wall";

  const [effectiveLengthFactor, setEffectiveLengthFactor] = useState("1.0");
  const [barDiameterMm, setBarDiameterMm] = useState("12");
  const [factoredAxialLoadKN, setFactoredAxialLoadKN] = useState("");
  const [factoredInPlaneShearKN, setFactoredInPlaneShearKN] = useState("");

  const [report, setReport] = useState<RcWallDesignReport | null>(null);

  function handleRunDesign() {
    if (!selectedWall || !wallMaterial || wallMaterial.type !== "concrete") return;
    const fy = wallMaterial.rebarFy ?? 414;
    const fc = wallMaterial.fc;
    const length = estimateHorizontalLength(selectedWall);
    const height = estimateHeight(selectedWall);

    const result = runRcWallDesign({
      elementLabel: selectedWall.label,
      isShearWall: isShearWallCategory,
      thicknessMm: selectedWall.thickness,
      lengthMm: length,
      unsupportedHeightMm: height,
      effectiveLengthFactor: Number(effectiveLengthFactor) || 1.0,
      fcMPa: fc,
      fyMPa: fy,
      barDiameterMm: Number(barDiameterMm) || 12,
      factoredAxialLoadKN: Number(factoredAxialLoadKN) || 0,
      factoredInPlaneShearKN: isShearWallCategory ? Number(factoredInPlaneShearKN) || 0 : undefined,
    });
    setReport(result);
    setDetailingSent(false);
    const wallChecks = [{ label: "Axial Capacity", ratio: result.axialCapacity.utilizationRatio }];
    if (result.shearCapacity) {
      wallChecks.push({ label: "In-Plane Shear", ratio: result.shearCapacity.utilizationRatio });
    }
    setDcrChecks(selectedWall.elementId, selectedWall.label, wallChecks);
  }

  const [detailingSent, setDetailingSent] = useState(false);

  function handleSendToDetailing() {
    if (!selectedWall || !report) return;
    const length = estimateHorizontalLength(selectedWall);
    const height = estimateHeight(selectedWall);
    const detailing = generateWallDetailing({
      elementId: selectedWall.elementId,
      elementLabel: selectedWall.label,
      lengthMm: length,
      heightMm: height,
      thicknessMm: selectedWall.thickness,
      barDiameterMm: Number(barDiameterMm) || 12,
      report,
    });
    setDetailingResult(detailing);
    setDetailingSent(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">RC Wall Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          ACI 318-19 — empirical axial capacity (§11.5.3), minimum reinforcement (§11.6), in-plane shear for shear
          walls (§11.5.4).
        </p>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
          Shell analysis results are not yet available — axial/shear loads must be entered directly. This is a
          basic axial-dominant check; significant lateral/eccentric load needs the ACI §11.5.2 P-M method
          (not yet automated).
        </p>

        <label className="block text-xs text-slate-500 mb-1">Wall</label>
        <select
          value={selectedWallId}
          onChange={(e) => {
            setSelectedWallId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a wall...</option>
          {walls.map((w) => (
            <option key={w.elementId} value={w.elementId}>
              {w.label} ({w.category})
            </option>
          ))}
        </select>

        {selectedWall && !isConcrete && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This wall&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selectedWall && isConcrete && (
        <>
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Thickness: {selectedWall.thickness}mm, Length ≈ {estimateHorizontalLength(selectedWall).toFixed(0)}mm,
              Height ≈ {estimateHeight(selectedWall).toFixed(0)}mm, Plan area ={" "}
              {computePolygonPlanArea(selectedWall.vertices).toFixed(1)}m²
            </p>
            {isShearWallCategory && (
              <p className="text-xs text-sky-400">Category: {selectedWall.category} — in-plane shear check enabled</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Axial Pu (kN)</label>
              <input
                type="number"
                step="any"
                value={factoredAxialLoadKN}
                onChange={(e) => setFactoredAxialLoadKN(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            {isShearWallCategory && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Factored In-Plane Shear Vu (kN)</label>
                <input
                  type="number"
                  step="any"
                  value={factoredInPlaneShearKN}
                  onChange={(e) => setFactoredInPlaneShearKN(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective Length Factor k</label>
              <input
                type="number"
                step="any"
                value={effectiveLengthFactor}
                onChange={(e) => setEffectiveLengthFactor(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bar Diameter (mm)</label>
              <input
                type="number"
                step="any"
                value={barDiameterMm}
                onChange={(e) => setBarDiameterMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Wall Design
          </button>

          {report && (
            <button
              type="button"
              onClick={handleSendToDetailing}
              className="w-full rounded-md bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-medium py-2 transition-colors"
            >
              {detailingSent ? "✓ Sent to Detailing Model" : "🔩 Send to Detailing Model"}
            </button>
          )}
        </>
      )}

      {report && <RcWallDesignReportView report={report} />}
    </div>
  );
}

function RcWallDesignReportView({ report }: { report: RcWallDesignReport }) {
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
        <p className="text-xs text-slate-500 font-medium mb-1">Axial Capacity (Empirical Method)</p>
        <p className="text-xs text-slate-300">klc/h = {fmt(report.axialCapacity.slendernessRatio)}</p>
        <p className="text-xs text-slate-300">
          φPnw = {fmt(report.axialCapacity.phiPnwKN)} kN — utilization{" "}
          {Number.isFinite(report.axialCapacity.utilizationRatio)
            ? `${(report.axialCapacity.utilizationRatio * 100).toFixed(0)}%`
            : "—"}{" "}
          ({report.axialCapacity.adequate ? "adequate" : "NOT adequate"})
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Minimum Reinforcement</p>
        <p className="text-xs text-slate-300">
          Vertical = {fmt(report.minReinforcement.minVerticalAsPerMeterMm2, 0)} mm²/m (ρ=
          {(report.minReinforcement.minVerticalRatio * 100).toFixed(2)}%)
        </p>
        <p className="text-xs text-slate-300">
          Horizontal = {fmt(report.minReinforcement.minHorizontalAsPerMeterMm2, 0)} mm²/m (ρ=
          {(report.minReinforcement.minHorizontalRatio * 100).toFixed(2)}%)
        </p>
      </div>

      {report.shearCapacity && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
          <p className="text-xs text-slate-500 font-medium mb-1">In-Plane Shear</p>
          <p className="text-xs text-slate-300">
            φVn = {fmt(report.shearCapacity.phiVnKN)} kN — utilization{" "}
            {Number.isFinite(report.shearCapacity.utilizationRatio)
              ? `${(report.shearCapacity.utilizationRatio * 100).toFixed(0)}%`
              : "—"}{" "}
            ({report.shearCapacity.adequate ? "adequate" : "NOT adequate"})
          </p>
        </div>
      )}

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
