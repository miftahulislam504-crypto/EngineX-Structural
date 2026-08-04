"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { runSteelBeamDesign, type SteelBeamDesignReport } from "@/lib/design/steelBeamDesign";
import type { BeamElement } from "@/lib/types/element";
import type { WShapeSection } from "@/lib/types/section";
import { useDcrStore } from "@/lib/design/useDcrStore";

/** Infinity/NaN হলে "—" দেখায়, নাহলে fixed-decimal — UI তে "Infinity" string এড়াতে। */
function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function elementLength(e: BeamElement): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Phase 6c — Steel Beam Design panel। AISC 360-16 Chapter F (flexure:
 * compactness, yielding/LTB) + Chapter G (shear)। W-shape section
 * only (HSS/built-up পরে)। RcBeamDesignPanel এর মতোই latest analysis
 * result থেকে governing Mu/Vu auto-populate করে।
 */
export function SteelBeamDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);
  const sourceAnalysisType = useAnalysisResultStore((s) => s.sourceAnalysisType);

  const beams = useMemo(() => elements.filter((e): e is BeamElement => e.category === "beam"), [elements]);

  const [selectedBeamId, setSelectedBeamId] = useState<string>("");
  const selectedBeam = beams.find((b) => b.elementId === selectedBeamId) ?? null;

  const beamSection = selectedBeam ? sections.find((s) => s.sectionId === selectedBeam.sectionId) : undefined;
  const beamMaterial = selectedBeam ? materials.find((m) => m.materialId === selectedBeam.materialId) : undefined;
  const isWShape = beamSection?.shape === "w-shape";
  const isSteel = beamMaterial?.type === "steel";

  const governingForces = useMemo(() => {
    if (!selectedBeam || !elementEndForces) return null;
    const forcesForBeam = elementEndForces.filter((f) => f.elementId === selectedBeam.elementId);
    if (forcesForBeam.length === 0) return null;

    let maxMoment = 0;
    let maxShear = 0;
    for (const f of forcesForBeam) {
      maxMoment = Math.max(maxMoment, Math.abs(f.startMomentZ), Math.abs(f.endMomentZ));
      maxShear = Math.max(maxShear, Math.abs(f.startShearY), Math.abs(f.endShearY));
    }
    return { maxMoment, maxShear };
  }, [selectedBeam, elementEndForces]);

  const [unbracedLengthMm, setUnbracedLengthMm] = useState("");
  const [cb, setCb] = useState("1.0");
  const [factoredMomentKNm, setFactoredMomentKNm] = useState("");
  const [factoredShearKN, setFactoredShearKN] = useState("");

  const [report, setReport] = useState<SteelBeamDesignReport | null>(null);
  const setDcrChecks = useDcrStore((s) => s.setChecks);

  function handleUseAutoValues() {
    if (governingForces) {
      setFactoredMomentKNm(governingForces.maxMoment.toFixed(2));
      setFactoredShearKN(governingForces.maxShear.toFixed(2));
    }
  }

  function handleUseFullSpanAsUnbraced() {
    if (selectedBeam) setUnbracedLengthMm((elementLength(selectedBeam) * 1000).toFixed(0));
  }

  function handleRunDesign() {
    if (!selectedBeam || !beamSection || beamSection.shape !== "w-shape" || !beamMaterial) return;
    const section = beamSection as WShapeSection;
    const fy = beamMaterial.type === "steel" ? beamMaterial.fy : 345;
    const es = beamMaterial.type === "steel" ? beamMaterial.es : 200000;

    const result = runSteelBeamDesign({
      elementLabel: selectedBeam.label,
      section,
      fyMPa: fy,
      esMPa: es,
      unbracedLengthMm: Number(unbracedLengthMm) || elementLength(selectedBeam) * 1000,
      cb: Number(cb) || 1.0,
      factoredMomentKNm: Number(factoredMomentKNm) || 0,
      factoredShearKN: Number(factoredShearKN) || 0,
    });
    setReport(result);
    setDcrChecks(selectedBeam.elementId, selectedBeam.label, [
      { label: "Flexure", ratio: result.flexuralAdequacy.utilizationRatio },
      { label: "Shear", ratio: result.shearAdequacy.utilizationRatio },
    ]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Steel Beam Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          AISC 360-16 — flexure (compactness, yielding/LTB) and shear checks for W-shape sections.
        </p>

        <label className="block text-xs text-slate-500 mb-1">Beam</label>
        <select
          value={selectedBeamId}
          onChange={(e) => {
            setSelectedBeamId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a beam...</option>
          {beams.map((b) => (
            <option key={b.elementId} value={b.elementId}>
              {b.label}
            </option>
          ))}
        </select>

        {selectedBeam && !isWShape && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            Steel beam design in this version only supports W-shape sections. This beam uses a{" "}
            {beamSection?.shape ?? "unknown"} section.
          </p>
        )}
        {selectedBeam && isWShape && !isSteel && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This beam&apos;s material is not steel — steel design does not apply.
          </p>
        )}
      </div>

      {selectedBeam && isWShape && isSteel && (
        <>
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              {(beamSection as WShapeSection).designation ?? "W-shape"}: d=
              {(beamSection as WShapeSection).depth}mm, bf={(beamSection as WShapeSection).flangeWidth}mm — Span:{" "}
              {(elementLength(selectedBeam) * 1000).toFixed(0)}mm
            </p>

            {governingForces ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-400">
                  From {sourceAnalysisType}: Mu≈{governingForces.maxMoment.toFixed(1)} kN·m, Vu≈
                  {governingForces.maxShear.toFixed(1)} kN
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
                No analysis result available for this beam yet — run an Analysis first, or enter Mu/Vu manually
                below.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
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
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Shear Vu (kN)</label>
              <input
                type="number"
                step="any"
                value={factoredShearKN}
                onChange={(e) => setFactoredShearKN(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-500">Unbraced Length Lb (mm)</label>
                <button type="button" onClick={handleUseFullSpanAsUnbraced} className="text-xs text-sky-500 hover:text-sky-400">
                  use full span
                </button>
              </div>
              <input
                type="number"
                step="any"
                value={unbracedLengthMm}
                onChange={(e) => setUnbracedLengthMm(e.target.value)}
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
            ▶ Run Steel Beam Design
          </button>
        </>
      )}

      {report && <SteelBeamDesignReportView report={report} />}
    </div>
  );
}

function SteelBeamDesignReportView({ report }: { report: SteelBeamDesignReport }) {
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
        <p className="text-xs text-slate-500 font-medium mb-1">Flexure</p>
        <p className="text-xs text-slate-300">
          {report.flexuralCapacity.isCompact ? "Compact section" : "NOT compact — capacity not computed"}
        </p>
        {report.flexuralCapacity.isCompact && (
          <>
            <p className="text-xs text-slate-300">
              Lp = {fmt(report.flexuralCapacity.lpMm, 0)}mm, Lr = {fmt(report.flexuralCapacity.lrMm, 0)}mm —
              governing: {report.flexuralCapacity.governingLimitState}
            </p>
            <p className="text-xs text-slate-300">
              φMn = {fmt(report.flexuralCapacity.phiMnKNm)} kN·m — utilization{" "}
              {Number.isFinite(report.flexuralAdequacy.utilizationRatio)
                ? `${(report.flexuralAdequacy.utilizationRatio * 100).toFixed(0)}%`
                : "—"}{" "}
              ({report.flexuralAdequacy.adequate ? "adequate" : "NOT adequate"})
            </p>
          </>
        )}
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Shear</p>
        <p className="text-xs text-slate-300">
          φVn = {fmt(report.shearCapacity.phiVnKN)} kN (Cv1={report.shearCapacity.cv1.toFixed(2)}) — utilization{" "}
          {Number.isFinite(report.shearAdequacy.utilizationRatio)
            ? `${(report.shearAdequacy.utilizationRatio * 100).toFixed(0)}%`
            : "—"}{" "}
          ({report.shearAdequacy.adequate ? "adequate" : "NOT adequate"})
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
