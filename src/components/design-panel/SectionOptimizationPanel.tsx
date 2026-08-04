"use client";

import { useState } from "react";
import {
  runSectionOptimization,
  STEEL_W_SHAPE_CATALOG,
  type SectionType,
  type SectionOptimizationResult,
} from "@/lib/design/sectionOptimization";
import type { BeamSupportCondition } from "@/lib/design/rcBeamDeflection";

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  "rc-beam": "RC Beam",
  "rc-column": "RC Column",
  "steel-beam": "Steel Beam",
  "steel-column": "Steel Column",
};

function fmt(v: number, decimals = 0): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function Field({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-0.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
      />
    </div>
  );
}

/**
 * Phase 9b — Section Optimization panel। Standalone calculator
 * (FoundationOptimizationPanel এর একই প্যাটার্ন)। RC Beam/Column এর
 * জন্য bar diameter × bar count sweep করে, Steel Beam/Column এর জন্য
 * নিচের W-shape catalog sweep করে — প্রতিটা candidate Phase 6a/6b/6c
 * এর real design module দিয়ে verify হয়।
 */
export function SectionOptimizationPanel() {
  const [sectionType, setSectionType] = useState<SectionType>("rc-beam");
  const [result, setResult] = useState<SectionOptimizationResult | null>(null);

  // Shared
  const [fcMPa, setFcMPa] = useState("21");
  const [fyMPa, setFyMPa] = useState("414");
  const [esMPa, setEsMPa] = useState("200000");

  // RC Beam
  const [rcbSpanMm, setRcbSpanMm] = useState("6000");
  const [rcbWidthMm, setRcbWidthMm] = useState("300");
  const [rcbTotalDepthMm, setRcbTotalDepthMm] = useState("500");
  const [rcbEffectiveCoverMm, setRcbEffectiveCoverMm] = useState("60");
  const [rcbClearCoverMm, setRcbClearCoverMm] = useState("40");
  const [rcbStirrupDiameterMm, setRcbStirrupDiameterMm] = useState("10");
  const [rcbSupportCondition, setRcbSupportCondition] = useState<BeamSupportCondition>("simply-supported");
  const [rcbFactoredMomentKNm, setRcbFactoredMomentKNm] = useState("180");
  const [rcbFactoredShearKN, setRcbFactoredShearKN] = useState("140");
  const [rcbMinBarCount, setRcbMinBarCount] = useState("2");
  const [rcbMaxBarCount, setRcbMaxBarCount] = useState("8");

  // RC Column
  const [rccWidthMm, setRccWidthMm] = useState("400");
  const [rccTotalDepthMm, setRccTotalDepthMm] = useState("400");
  const [rccUnsupportedLengthMm, setRccUnsupportedLengthMm] = useState("3500");
  const [rccEffectiveLengthFactor, setRccEffectiveLengthFactor] = useState("1.0");
  const [rccIsSwayFrame, setRccIsSwayFrame] = useState(false);
  const [rccCoverToBarCentroidMm, setRccCoverToBarCentroidMm] = useState("60");
  const [rccTieDiameterMm, setRccTieDiameterMm] = useState("10");
  const [rccFactoredAxialLoadKN, setRccFactoredAxialLoadKN] = useState("2200");
  const [rccM1KNm, setRccM1KNm] = useState("60");
  const [rccM2KNm, setRccM2KNm] = useState("90");
  const [rccIsSingleCurvature, setRccIsSingleCurvature] = useState(true);
  const [rccCriticalBucklingLoadKN, setRccCriticalBucklingLoadKN] = useState("15000");
  const [rccMinBarCount, setRccMinBarCount] = useState("4");
  const [rccMaxBarCount, setRccMaxBarCount] = useState("16");

  // Steel Beam
  const [sbUnbracedLengthMm, setSbUnbracedLengthMm] = useState("3000");
  const [sbCb, setSbCb] = useState("1.0");
  const [sbFactoredMomentKNm, setSbFactoredMomentKNm] = useState("150");
  const [sbFactoredShearKN, setSbFactoredShearKN] = useState("110");

  // Steel Column
  const [scUnbracedLengthMm, setScUnbracedLengthMm] = useState("3500");
  const [scCb, setScCb] = useState("1.0");
  const [scFactoredAxialLoadKN, setScFactoredAxialLoadKN] = useState("1800");
  const [scFactoredMomentKNm, setScFactoredMomentKNm] = useState("40");

  function handleRunOptimization() {
    if (sectionType === "rc-beam") {
      setResult(
        runSectionOptimization("rc-beam", {
          elementLabel: "RC Beam (optimizer)",
          spanMm: Number(rcbSpanMm) || 0,
          widthMm: Number(rcbWidthMm) || 300,
          totalDepthMm: Number(rcbTotalDepthMm) || 500,
          effectiveCoverMm: Number(rcbEffectiveCoverMm) || 60,
          clearCoverMm: Number(rcbClearCoverMm) || 40,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
          stirrupDiameterMm: Number(rcbStirrupDiameterMm) || 10,
          supportCondition: rcbSupportCondition,
          factoredMomentKNm: Number(rcbFactoredMomentKNm) || 0,
          factoredShearKN: Number(rcbFactoredShearKN) || 0,
          minBarCount: Number(rcbMinBarCount) || 2,
          maxBarCount: Number(rcbMaxBarCount) || 8,
        })
      );
    } else if (sectionType === "rc-column") {
      setResult(
        runSectionOptimization("rc-column", {
          elementLabel: "RC Column (optimizer)",
          widthMm: Number(rccWidthMm) || 400,
          totalDepthMm: Number(rccTotalDepthMm) || 400,
          unsupportedLengthMm: Number(rccUnsupportedLengthMm) || 3500,
          effectiveLengthFactor: Number(rccEffectiveLengthFactor) || 1.0,
          isSwayFrame: rccIsSwayFrame,
          coverToBarCentroidMm: Number(rccCoverToBarCentroidMm) || 60,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
          tieDiameterMm: Number(rccTieDiameterMm) || 10,
          factoredAxialLoadKN: Number(rccFactoredAxialLoadKN) || 0,
          m1KNm: Number(rccM1KNm) || 0,
          m2KNm: Number(rccM2KNm) || 0,
          isSingleCurvature: rccIsSingleCurvature,
          criticalBucklingLoadKN: Number(rccCriticalBucklingLoadKN) || 0,
          minBarCount: Number(rccMinBarCount) || 4,
          maxBarCount: Number(rccMaxBarCount) || 16,
        })
      );
    } else if (sectionType === "steel-beam") {
      setResult(
        runSectionOptimization("steel-beam", {
          elementLabel: "Steel Beam (optimizer)",
          fyMPa: Number(fyMPa) || 250,
          esMPa: Number(esMPa) || 200000,
          unbracedLengthMm: Number(sbUnbracedLengthMm) || 3000,
          cb: Number(sbCb) || 1.0,
          factoredMomentKNm: Number(sbFactoredMomentKNm) || 0,
          factoredShearKN: Number(sbFactoredShearKN) || 0,
        })
      );
    } else if (sectionType === "steel-column") {
      setResult(
        runSectionOptimization("steel-column", {
          elementLabel: "Steel Column (optimizer)",
          fyMPa: Number(fyMPa) || 250,
          esMPa: Number(esMPa) || 200000,
          unbracedLengthMm: Number(scUnbracedLengthMm) || 3500,
          cb: Number(scCb) || 1.0,
          factoredAxialLoadKN: Number(scFactoredAxialLoadKN) || 0,
          factoredMomentKNm: Number(scFactoredMomentKNm) || 0,
        })
      );
    }
  }

  const isSteel = sectionType === "steel-beam" || sectionType === "steel-column";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Section Optimization</h3>
        <p className="text-xs text-slate-500 mb-3">
          RC-এ bar size × count, Steel-এ {STEEL_W_SHAPE_CATALOG.length}টি W-shape catalog sweep করে — প্রতিটা
          candidate Phase 6a/6b/6c design module দিয়ে verify করে সর্বনিম্ন material quantity বেছে নেয়।
        </p>

        <label className="block text-xs text-slate-500 mb-1">Section Type</label>
        <select
          value={sectionType}
          onChange={(e) => {
            setSectionType(e.target.value as SectionType);
            setResult(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((type) => (
            <option key={type} value={type}>
              {SECTION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {!isSteel && <Field label="f'c" value={fcMPa} onChange={setFcMPa} unit="MPa" />}
          <Field label="fy" value={fyMPa} onChange={setFyMPa} unit="MPa" />
          {isSteel && <Field label="Es" value={esMPa} onChange={setEsMPa} unit="MPa" />}
        </div>

        {sectionType === "rc-beam" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Span" value={rcbSpanMm} onChange={setRcbSpanMm} unit="mm" />
              <Field label="Width" value={rcbWidthMm} onChange={setRcbWidthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total Depth" value={rcbTotalDepthMm} onChange={setRcbTotalDepthMm} unit="mm" />
              <Field label="Stirrup Dia" value={rcbStirrupDiameterMm} onChange={setRcbStirrupDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Effective Cover" value={rcbEffectiveCoverMm} onChange={setRcbEffectiveCoverMm} unit="mm" />
              <Field label="Clear Cover" value={rcbClearCoverMm} onChange={setRcbClearCoverMm} unit="mm" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Support Condition</label>
              <select
                value={rcbSupportCondition}
                onChange={(e) => setRcbSupportCondition(e.target.value as BeamSupportCondition)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              >
                <option value="simply-supported">Simply Supported</option>
                <option value="one-end-continuous">One End Continuous</option>
                <option value="both-ends-continuous">Both Ends Continuous</option>
                <option value="cantilever">Cantilever</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Factored Moment Mu" value={rcbFactoredMomentKNm} onChange={setRcbFactoredMomentKNm} unit="kN·m" />
              <Field label="Factored Shear Vu" value={rcbFactoredShearKN} onChange={setRcbFactoredShearKN} unit="kN" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min Bar Count" value={rcbMinBarCount} onChange={setRcbMinBarCount} />
              <Field label="Max Bar Count" value={rcbMaxBarCount} onChange={setRcbMaxBarCount} />
            </div>
          </div>
        )}

        {sectionType === "rc-column" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={rccWidthMm} onChange={setRccWidthMm} unit="mm" />
              <Field label="Total Depth" value={rccTotalDepthMm} onChange={setRccTotalDepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unsupported Length" value={rccUnsupportedLengthMm} onChange={setRccUnsupportedLengthMm} unit="mm" />
              <Field label="Effective Length Factor k" value={rccEffectiveLengthFactor} onChange={setRccEffectiveLengthFactor} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cover to Bar Centroid" value={rccCoverToBarCentroidMm} onChange={setRccCoverToBarCentroidMm} unit="mm" />
              <Field label="Tie Diameter" value={rccTieDiameterMm} onChange={setRccTieDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Factored Axial Pu" value={rccFactoredAxialLoadKN} onChange={setRccFactoredAxialLoadKN} unit="kN" />
              <Field label="Critical Buckling Pc" value={rccCriticalBucklingLoadKN} onChange={setRccCriticalBucklingLoadKN} unit="kN" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="M1 (smaller end)" value={rccM1KNm} onChange={setRccM1KNm} unit="kN·m" />
              <Field label="M2 (larger end)" value={rccM2KNm} onChange={setRccM2KNm} unit="kN·m" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={rccIsSwayFrame} onChange={(e) => setRccIsSwayFrame(e.target.checked)} />
                Sway frame
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rccIsSingleCurvature}
                  onChange={(e) => setRccIsSingleCurvature(e.target.checked)}
                />
                Single curvature
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min Bar Count" value={rccMinBarCount} onChange={setRccMinBarCount} />
              <Field label="Max Bar Count" value={rccMaxBarCount} onChange={setRccMaxBarCount} />
            </div>
          </div>
        )}

        {sectionType === "steel-beam" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unbraced Length Lb" value={sbUnbracedLengthMm} onChange={setSbUnbracedLengthMm} unit="mm" />
              <Field label="Cb" value={sbCb} onChange={setSbCb} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Factored Moment Mu" value={sbFactoredMomentKNm} onChange={setSbFactoredMomentKNm} unit="kN·m" />
              <Field label="Factored Shear Vu" value={sbFactoredShearKN} onChange={setSbFactoredShearKN} unit="kN" />
            </div>
          </div>
        )}

        {sectionType === "steel-column" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unbraced Length KL" value={scUnbracedLengthMm} onChange={setScUnbracedLengthMm} unit="mm" />
              <Field label="Cb" value={scCb} onChange={setScCb} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Factored Axial Pu" value={scFactoredAxialLoadKN} onChange={setScFactoredAxialLoadKN} unit="kN" />
              <Field label="Factored Moment Mu" value={scFactoredMomentKNm} onChange={setScFactoredMomentKNm} unit="kN·m" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleRunOptimization}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Run Optimization
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              result.best ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
            }`}
          >
            <p className={`text-xs leading-relaxed ${result.best ? "text-emerald-400" : "text-amber-500"}`}>
              {result.message}
            </p>
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500">
              Candidates evaluated: <span className="text-slate-300">{result.candidatesEvaluated}</span> · Feasible:{" "}
              <span className="text-slate-300">{result.feasibleCandidatesFound}</span>
            </p>
          </div>

          {result.best && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
              <p className="text-xs text-slate-500 font-medium mb-1">Best Candidate</p>
              <p className="text-xs text-slate-300">{result.best.description}</p>
              <p className="text-xs text-slate-300">
                {result.best.quantityLabel}: {fmt(result.best.quantityMetric)}
              </p>
              <p className="text-xs text-slate-300">Status: {result.best.overallStatus}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
