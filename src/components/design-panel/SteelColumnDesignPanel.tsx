"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { runSteelColumnDesign, type SteelColumnDesignReport } from "@/lib/design/steelColumnDesign";
import type { ColumnElement } from "@/lib/types/element";
import type { WShapeSection } from "@/lib/types/section";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function elementLength(e: ColumnElement): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Phase 6c — Steel Column Design panel। AISC 360-16 Chapter E
 * (compression, flexural buckling) + Chapter F (flexure, beam-এর
 * সাথে শেয়ার করা লজিক) + Chapter H1 (combined interaction)। W-shape,
 * uniaxial major-axis bending। effective length (KL) সরাসরি input —
 * এই panel আলাদা k factor নেয় না (RcColumnDesignPanel এর মতো)।
 */
export function SteelColumnDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);
  const sourceAnalysisType = useAnalysisResultStore((s) => s.sourceAnalysisType);

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
  const isWShape = columnSection?.shape === "w-shape";
  const isSteel = columnMaterial?.type === "steel";

  const governingForces = useMemo(() => {
    if (!selectedColumn || !elementEndForces) return null;
    const forcesForColumn = elementEndForces.filter((f) => f.elementId === selectedColumn.elementId);
    if (forcesForColumn.length === 0) return null;

    let maxAxial = 0;
    let maxMoment = 0;
    for (const f of forcesForColumn) {
      maxAxial = Math.max(maxAxial, Math.abs(f.startAxial), Math.abs(f.endAxial));
      maxMoment = Math.max(maxMoment, Math.abs(f.startMomentZ), Math.abs(f.endMomentZ));
    }
    return { maxAxial, maxMoment };
  }, [selectedColumn, elementEndForces]);

  const [effectiveLengthMm, setEffectiveLengthMm] = useState("");
  const [cb, setCb] = useState("1.0");
  const [factoredAxialLoadKN, setFactoredAxialLoadKN] = useState("");
  const [factoredMomentKNm, setFactoredMomentKNm] = useState("");

  const [report, setReport] = useState<SteelColumnDesignReport | null>(null);
  const setDcrChecks = useDcrStore((s) => s.setChecks);
  const projectId = useProjectIdStore((s) => s.projectId);

  function handleUseAutoValues() {
    if (governingForces) {
      setFactoredAxialLoadKN(governingForces.maxAxial.toFixed(2));
      setFactoredMomentKNm(governingForces.maxMoment.toFixed(2));
    }
  }

  function handleUseFullLengthAsEffective() {
    if (selectedColumn) setEffectiveLengthMm((elementLength(selectedColumn) * 1000).toFixed(0));
  }

  function handleRunDesign() {
    if (!selectedColumn || !columnSection || columnSection.shape !== "w-shape" || !columnMaterial) return;
    const section = columnSection as WShapeSection;
    const fy = columnMaterial.type === "steel" ? columnMaterial.fy : 345;
    const es = columnMaterial.type === "steel" ? columnMaterial.es : 200000;

    const input = {
      elementLabel: selectedColumn.label,
      section,
      fyMPa: fy,
      esMPa: es,
      unbracedLengthMm: Number(effectiveLengthMm) || elementLength(selectedColumn) * 1000,
      cb: Number(cb) || 1.0,
      factoredAxialLoadKN: Number(factoredAxialLoadKN) || 0,
      factoredMomentKNm: Number(factoredMomentKNm) || 0,
    };
    const result = runSteelColumnDesign(input);
    setReport(result);
    setDcrChecks(selectedColumn.elementId, selectedColumn.label, [
      { label: "Axial-Flexure Interaction", ratio: result.interaction.interactionValue },
    ]);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selectedColumn.elementId,
        elementLabel: selectedColumn.label,
        elementCategory: "column",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist steel column design result:", e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Steel Column Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          AISC 360-16 — compression (flexural buckling), flexure, and H1 combined axial-flexure interaction for
          W-shape sections.
        </p>

        <label className="block text-xs text-slate-500 mb-1">Column</label>
        <select
          value={selectedColumnId}
          onChange={(e) => {
            setSelectedColumnId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a column...</option>
          {columns.map((c) => (
            <option key={c.elementId} value={c.elementId}>
              {c.label}
            </option>
          ))}
        </select>

        {selectedColumn && !isWShape && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            Steel column design in this version only supports W-shape sections. This column uses a{" "}
            {columnSection?.shape ?? "unknown"} section.
          </p>
        )}
        {selectedColumn && isWShape && !isSteel && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This column&apos;s material is not steel — steel design does not apply.
          </p>
        )}
      </div>

      {selectedColumn && isWShape && isSteel && (
        <>
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              {(columnSection as WShapeSection).designation ?? "W-shape"}: d=
              {(columnSection as WShapeSection).depth}mm, bf={(columnSection as WShapeSection).flangeWidth}mm —
              Length: {(elementLength(selectedColumn) * 1000).toFixed(0)}mm
            </p>

            {governingForces ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-400">
                  From {sourceAnalysisType}: Pu≈{governingForces.maxAxial.toFixed(1)} kN, Mu≈
                  {governingForces.maxMoment.toFixed(1)} kN·m
                </p>
                <button
                  type="button"
                  onClick={handleUseAutoValues}
                  className="text-xs bg-sky-800 hover:bg-sky-700 text-white px-2 py-1 rounded-md"
                >
                  Use these
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No analysis result available for this column yet — run an Analysis first, or enter loads manually
                below.
              </p>
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
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Moment Mu (kN·m)</label>
              <input
                type="number"
                step="any"
                value={factoredMomentKNm}
                onChange={(e) => setFactoredMomentKNm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-500">Effective Length KL (mm)</label>
                <button
                  type="button"
                  onClick={handleUseFullLengthAsEffective}
                  className="text-xs text-sky-500 hover:text-sky-400"
                >
                  use full length
                </button>
              </div>
              <input
                type="number"
                step="any"
                value={effectiveLengthMm}
                onChange={(e) => setEffectiveLengthMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cb (moment gradient factor)</label>
              <input
                type="number"
                step="any"
                value={cb}
                onChange={(e) => setCb(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Steel Column Design
          </button>
        </>
      )}

      {report && <SteelColumnDesignReportView report={report} />}
    </div>
  );
}

function SteelColumnDesignReportView({ report }: { report: SteelColumnDesignReport }) {
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
        <p className="text-xs text-slate-500 font-medium mb-1">Compression</p>
        <p className="text-xs text-slate-300">
          KL/ry = {fmt(report.compressionCapacity.slendernessRatio)} — {report.compressionCapacity.governingLimitState}
        </p>
        <p className="text-xs text-slate-300">
          Fcr = {fmt(report.compressionCapacity.fcrMPa)} MPa, φPn = {fmt(report.compressionCapacity.phiPnKN)} kN
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Flexure</p>
        <p className="text-xs text-slate-300">
          {report.flexuralCapacity.isCompact
            ? `φMn = ${fmt(report.flexuralCapacity.phiMnKNm)} kN·m (${report.flexuralCapacity.governingLimitState})`
            : "NOT compact — capacity not computed"}
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Combined Interaction (AISC H1)</p>
        <p className="text-xs text-slate-300">
          Pr/Pc = {fmt(report.interaction.axialRatio, 3)} — equation {report.interaction.governingEquation}
        </p>
        <p className="text-xs text-slate-300">
          Interaction value = {fmt(report.interaction.interactionValue, 3)} —{" "}
          {report.interaction.adequate ? "adequate" : "NOT adequate"}
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
