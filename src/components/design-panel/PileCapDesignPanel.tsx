"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runPileCapDesign, type PileCapDesignReport } from "@/lib/design/pileCapGroupDesign";
import type { ColumnPosition } from "@/lib/design/rcSlabPunchingShear";
import type { PileCapElement, PileGroupElement } from "@/lib/types/element";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 7d — Pile Cap + Pile Group Design panel। Pile group efficiency
 * (Converse-Labarre) + rigid pile-cap load distribution + cap flexure/
 * shear/punching। এই app কোনো geotechnical analysis করে না — unit
 * skin friction ও end bearing pressure geotechnical report থেকে
 * ইঞ্জিনিয়ার সরবরাহ করেন।
 */
export function PileCapDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const projectId = useProjectIdStore((s) => s.projectId);

  const pileCaps = useMemo(
    () => elements.filter((e): e is PileCapElement => e.category === "pile-cap"),
    [elements]
  );
  const pileGroups = useMemo(
    () => elements.filter((e): e is PileGroupElement => e.category === "pile-group"),
    [elements]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const selectedCap = pileCaps.find((c) => c.elementId === selectedId) ?? null;
  const linkedGroup = selectedCap ? pileGroups.find((g) => g.elementId === selectedCap.pileGroupId) ?? null : null;
  const material = selectedCap ? materials.find((m) => m.materialId === selectedCap.materialId) : undefined;
  const isConcrete = material?.type === "concrete";

  const [unitSkinFrictionKPa, setUnitSkinFrictionKPa] = useState("");
  const [endBearingPressureKPa, setEndBearingPressureKPa] = useState("");
  const [pileFactorOfSafety, setPileFactorOfSafety] = useState("2.5");
  const [servicePointLoadKN, setServicePointLoadKN] = useState("");
  const [factoredPointLoadKN, setFactoredPointLoadKN] = useState("");
  const [momentXKNm, setMomentXKNm] = useState("0");
  const [momentZKNm, setMomentZKNm] = useState("0");
  const [columnWidthMm, setColumnWidthMm] = useState("400");
  const [columnDepthMm, setColumnDepthMm] = useState("400");
  const [columnPosition, setColumnPosition] = useState<ColumnPosition>("interior");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");

  const [report, setReport] = useState<PileCapDesignReport | null>(null);

  function handleRunDesign() {
    if (!selectedCap || !linkedGroup || !material || material.type !== "concrete") return;
    const fy = material.rebarFy ?? 414;
    const fc = material.fc;

    const input = {
      elementLabel: selectedCap.label,
      pileGroup: {
        pileShape: linkedGroup.pileShape,
        pileDiameterOrWidthMm: linkedGroup.pileDiameterOrWidthMm,
        embeddedLengthMm: linkedGroup.embeddedLengthMm,
        unitSkinFrictionKPa: Number(unitSkinFrictionKPa) || 0,
        endBearingPressureKPa: Number(endBearingPressureKPa) || 0,
        pileFactorOfSafety: Number(pileFactorOfSafety) || 2.5,
        pileSpacingCenterToCenterMm: linkedGroup.pileSpacingCenterToCenterMm,
        numberOfRows: linkedGroup.numberOfRows,
        numberOfColumns: linkedGroup.numberOfColumns,
      },
      cap: {
        widthMm: selectedCap.width,
        lengthMm: selectedCap.length,
        thicknessMm: selectedCap.thickness,
        effectiveCoverMm: Number(effectiveCoverMm) || 75,
      },
      column: {
        columnWidthMm: Number(columnWidthMm) || 400,
        columnDepthMm: Number(columnDepthMm) || 400,
        columnPosition,
        servicePointLoadKN: Number(servicePointLoadKN) || 0,
        factoredPointLoadKN: Number(factoredPointLoadKN) || 0,
        momentXKNm: Number(momentXKNm) || 0,
        momentZKNm: Number(momentZKNm) || 0,
      },
      fcMPa: fc,
      fyMPa: fy,
    };
    const result = runPileCapDesign(input);
    setReport(result);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selectedCap.elementId,
        elementLabel: selectedCap.label,
        elementCategory: "pile-cap",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist pile-cap design result:", e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Pile Cap + Pile Group Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          Group efficiency (Converse-Labarre), rigid pile-cap load distribution, cap flexure/shear, punching shear.
        </p>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — enter unit skin friction and end bearing pressure from
          your geotechnical report.
        </p>

        <label className="block text-xs text-slate-500 mb-1">Pile Cap</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a pile cap...</option>
          {pileCaps.map((c) => (
            <option key={c.elementId} value={c.elementId}>
              {c.label}
            </option>
          ))}
        </select>

        {selectedCap && !linkedGroup && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This pile cap&apos;s linked Pile Group could not be found — check the element&apos;s pile group reference.
          </p>
        )}
        {selectedCap && !isConcrete && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This pile cap&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selectedCap && linkedGroup && isConcrete && (
        <>
          <p className="text-xs text-slate-500">
            Cap: {selectedCap.width}×{selectedCap.length}×{selectedCap.thickness}mm · Group: {linkedGroup.numberOfRows}
            ×{linkedGroup.numberOfColumns} {linkedGroup.pileShape} piles, ⌀{linkedGroup.pileDiameterOrWidthMm}mm,
            spacing {linkedGroup.pileSpacingCenterToCenterMm}mm, embedded {linkedGroup.embeddedLengthMm}mm
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unit Skin Friction fs (kPa)</label>
              <input
                type="number"
                step="any"
                value={unitSkinFrictionKPa}
                onChange={(e) => setUnitSkinFrictionKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">End Bearing qp (kPa)</label>
              <input
                type="number"
                step="any"
                value={endBearingPressureKPa}
                onChange={(e) => setEndBearingPressureKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Pile Factor of Safety</label>
            <input
              type="number"
              step="any"
              value={pileFactorOfSafety}
              onChange={(e) => setPileFactorOfSafety(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
            />
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-2">
            <p className="text-xs text-slate-400 font-medium">Column</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={servicePointLoadKN}
                onChange={(e) => setServicePointLoadKN(e.target.value)}
                placeholder="Pa (kN)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
              <input
                type="number"
                step="any"
                value={factoredPointLoadKN}
                onChange={(e) => setFactoredPointLoadKN(e.target.value)}
                placeholder="Pu (kN)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={momentXKNm}
                onChange={(e) => setMomentXKNm(e.target.value)}
                placeholder="Mx (kN·m)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
              <input
                type="number"
                step="any"
                value={momentZKNm}
                onChange={(e) => setMomentZKNm(e.target.value)}
                placeholder="Mz (kN·m)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={columnWidthMm}
                onChange={(e) => setColumnWidthMm(e.target.value)}
                placeholder="Width (mm)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
              <input
                type="number"
                step="any"
                value={columnDepthMm}
                onChange={(e) => setColumnDepthMm(e.target.value)}
                placeholder="Depth (mm)"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <select
              value={columnPosition}
              onChange={(e) => setColumnPosition(e.target.value as ColumnPosition)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
            >
              <option value="interior">Interior</option>
              <option value="edge">Edge</option>
              <option value="corner">Corner</option>
            </select>
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

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Pile Cap Design
          </button>
        </>
      )}

      {report && <PileCapDesignReportView report={report} />}
    </div>
  );
}

function PileCapDesignReportView({ report }: { report: PileCapDesignReport }) {
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
        <p className="text-xs text-slate-500 font-medium mb-1">Pile Group Capacity</p>
        <p className="text-xs text-slate-300">
          {report.numberOfPiles} piles · Group efficiency {fmt(report.groupEfficiency * 100, 0)}%
        </p>
        <p className="text-xs text-slate-300">
          Allowable capacity/pile: {fmt(report.allowableCapacityPerPileKN)} kN
        </p>
        {report.isUplift && <p className="text-xs text-red-400">⚠ Uplift detected on one or more piles.</p>}
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Per-Pile Reactions</p>
        {report.piles.map((p) => (
          <p key={p.label} className={`text-xs ${p.adequate ? "text-slate-300" : "text-red-400"}`}>
            {p.label}: Pu = {fmt(p.factoredReactionKN)} kN, Pa = {fmt(p.serviceReactionKN)} kN (
            {fmt(p.utilizationRatio * 100, 0)}%) {p.adequate ? "" : "OVER"}
          </p>
        ))}
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Cap Flexural Reinforcement</p>
        <p className="text-xs text-slate-300">
          X-direction: As = {fmt(report.flexureX.governingAsMm2, 0)} mm²
        </p>
        <p className="text-xs text-slate-300">
          Z-direction: As = {fmt(report.flexureZ.governingAsMm2, 0)} mm²
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Shear</p>
        <p className="text-xs text-slate-300">
          One-way X: {report.shearX.adequate ? "OK" : "NOT adequate"} — Vu = {fmt(report.shearX.factoredShearKN)} kN
        </p>
        <p className="text-xs text-slate-300">
          One-way Z: {report.shearZ.adequate ? "OK" : "NOT adequate"} — Vu = {fmt(report.shearZ.factoredShearKN)} kN
        </p>
        <p className="text-xs text-slate-300">
          Punching: {report.punchingShear.adequate ? "OK" : "NOT adequate"} — φVc ={" "}
          {fmt(report.punchingShear.phiVcKN)} kN
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
