"use client";

import { useState } from "react";
import {
  layoutBeamBars,
  layoutColumnBars,
  layoutDistributedBars,
  DEFAULT_MAX_AGGREGATE_SIZE_MM,
  type BeamBarLayoutResult,
  type ColumnBarLayoutResult,
  type DistributedBarLayoutResult,
  type DistributedReinforcementRole,
} from "@/lib/design/rebarLayout";

type ElementMode = "beam" | "column" | "distributed";

const MODE_LABELS: Record<ElementMode, string> = {
  beam: "RC Beam",
  column: "RC Column",
  distributed: "Slab / Wall / Footing",
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
 * Phase 10a — Rebar Layout (Auto Reinforcement Solver) panel। Standalone
 * calculator (SectionOptimizationPanel এর একই প্যাটার্ন)। Phase 6a/6f-এর
 * governingAsMm2 (beam) বা Phase 6b/9b-এর already-decided totalAsMm2 +
 * longitudinalBarDiameterMm (column) input হিসেবে নিয়ে বাস্তব, buildable
 * bar arrangement বানায় — এই panel নিজে design check চালায় না, শুধু
 * required area থেকে physical layout বের করে (rebarLayout.ts দেখুন)।
 */
export function RebarLayoutPanel() {
  const [mode, setMode] = useState<ElementMode>("beam");
  const [beamResult, setBeamResult] = useState<BeamBarLayoutResult | null>(null);
  const [columnResult, setColumnResult] = useState<ColumnBarLayoutResult | null>(null);
  const [distributedResult, setDistributedResult] = useState<DistributedBarLayoutResult | null>(null);

  // Beam
  const [beamWidthMm, setBeamWidthMm] = useState("300");
  const [beamClearCoverMm, setBeamClearCoverMm] = useState("40");
  const [beamStirrupDiameterMm, setBeamStirrupDiameterMm] = useState("10");
  const [beamTensionAsMm2, setBeamTensionAsMm2] = useState("900");
  const [hasCompression, setHasCompression] = useState(false);
  const [beamCompressionAsMm2, setBeamCompressionAsMm2] = useState("300");
  const [beamMaxAggregateSizeMm, setBeamMaxAggregateSizeMm] = useState(String(DEFAULT_MAX_AGGREGATE_SIZE_MM));

  // Column
  const [colWidthMm, setColWidthMm] = useState("400");
  const [colTotalDepthMm, setColTotalDepthMm] = useState("400");
  const [colClearCoverMm, setColClearCoverMm] = useState("40");
  const [colTieDiameterMm, setColTieDiameterMm] = useState("10");
  const [colTotalAsMm2, setColTotalAsMm2] = useState("2400");
  const [colBarDiameterMm, setColBarDiameterMm] = useState("16");

  // Slab / Wall / Footing (distributed)
  const [distAsPerMeterMm2, setDistAsPerMeterMm2] = useState("600");
  const [distThicknessMm, setDistThicknessMm] = useState("125");
  const [distRole, setDistRole] = useState<DistributedReinforcementRole>("flexural");
  const [distMaxAggregateSizeMm, setDistMaxAggregateSizeMm] = useState(String(DEFAULT_MAX_AGGREGATE_SIZE_MM));

  function handleRun() {
    if (mode === "beam") {
      setBeamResult(
        layoutBeamBars({
          elementLabel: "Beam (rebar layout)",
          widthMm: Number(beamWidthMm) || 300,
          clearCoverMm: Number(beamClearCoverMm) || 40,
          stirrupDiameterMm: Number(beamStirrupDiameterMm) || 10,
          tensionAsMm2: Number(beamTensionAsMm2) || 0,
          compressionAsMm2: hasCompression ? Number(beamCompressionAsMm2) || 0 : undefined,
          maxAggregateSizeMm: Number(beamMaxAggregateSizeMm) || DEFAULT_MAX_AGGREGATE_SIZE_MM,
        })
      );
    } else if (mode === "column") {
      setColumnResult(
        layoutColumnBars({
          elementLabel: "Column (rebar layout)",
          widthMm: Number(colWidthMm) || 400,
          totalDepthMm: Number(colTotalDepthMm) || 400,
          clearCoverMm: Number(colClearCoverMm) || 40,
          tieDiameterMm: Number(colTieDiameterMm) || 10,
          totalAsMm2: Number(colTotalAsMm2) || 0,
          longitudinalBarDiameterMm: Number(colBarDiameterMm) || 16,
        })
      );
    } else {
      setDistributedResult(
        layoutDistributedBars({
          elementLabel: "Slab/Wall/Footing (rebar layout)",
          requiredAsPerMeterMm2: Number(distAsPerMeterMm2) || 0,
          thicknessMm: Number(distThicknessMm) || 125,
          reinforcementRole: distRole,
          maxAggregateSizeMm: Number(distMaxAggregateSizeMm) || DEFAULT_MAX_AGGREGATE_SIZE_MM,
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Rebar Layout (Auto Reinforcement)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Phase 6-এর required steel area (As) নিয়ে বাস্তব bar diameter + count + layer arrangement বের করে,
          section width/perimeter-এর ভিতরে clear spacing মেনে ফিট করে কিনা যাচাই করে (ACI 318-19 §25.2.1)।
        </p>

        <label className="block text-xs text-slate-500 mb-1">Element Type</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ElementMode)}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(MODE_LABELS) as ElementMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        {mode === "beam" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={beamWidthMm} onChange={setBeamWidthMm} unit="mm" />
              <Field label="Stirrup Dia" value={beamStirrupDiameterMm} onChange={setBeamStirrupDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Cover" value={beamClearCoverMm} onChange={setBeamClearCoverMm} unit="mm" />
              <Field label="Max Aggregate Size" value={beamMaxAggregateSizeMm} onChange={setBeamMaxAggregateSizeMm} unit="mm" />
            </div>
            <Field label="Tension As (governingAsMm2)" value={beamTensionAsMm2} onChange={setBeamTensionAsMm2} unit="mm²" />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={hasCompression} onChange={(e) => setHasCompression(e.target.checked)} />
              Doubly-reinforced (compression steel)
            </label>
            {hasCompression && (
              <Field label="Compression As" value={beamCompressionAsMm2} onChange={setBeamCompressionAsMm2} unit="mm²" />
            )}
          </div>
        )}

        {mode === "column" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={colWidthMm} onChange={setColWidthMm} unit="mm" />
              <Field label="Total Depth" value={colTotalDepthMm} onChange={setColTotalDepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Cover" value={colClearCoverMm} onChange={setColClearCoverMm} unit="mm" />
              <Field label="Tie Diameter" value={colTieDiameterMm} onChange={setColTieDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total As (totalAsMm2)" value={colTotalAsMm2} onChange={setColTotalAsMm2} unit="mm²" />
              <Field label="Bar Diameter" value={colBarDiameterMm} onChange={setColBarDiameterMm} unit="mm" />
            </div>
            <p className="text-[10px] text-slate-600">
              Total As আর Bar Diameter Phase 6b (RC Column Design) বা 9b (Section Optimization)-এর already-validated
              রেজাল্ট থেকে আসে — এই panel শুধু perimeter-এ layout করে।
            </p>
          </div>
        )}

        {mode === "distributed" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Required As" value={distAsPerMeterMm2} onChange={setDistAsPerMeterMm2} unit="mm²/m" />
              <Field label="Thickness" value={distThicknessMm} onChange={setDistThicknessMm} unit="mm" />
            </div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Reinforcement Role</label>
            <select
              value={distRole}
              onChange={(e) => setDistRole(e.target.value as DistributedReinforcementRole)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
            >
              <option value="flexural">Flexural (main direction) — max 3×thickness</option>
              <option value="shrinkage-temperature">Shrinkage/Temperature (secondary) — max 5×thickness</option>
            </select>
            <Field label="Max Aggregate Size" value={distMaxAggregateSizeMm} onChange={setDistMaxAggregateSizeMm} unit="mm" />
            <p className="text-[10px] text-slate-600">
              Required As Phase 6d (Slab/Wall Design) বা 6e (Footing Design)-এর per-meter-width রেজাল্ট থেকে আসে
              (positiveMomentDesign.governingAsMm2, minAsPerMeterMm2, ইত্যাদি) — প্রতি direction/role আলাদা রান লাগবে।
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Solve Layout
        </button>
      </div>

      {mode === "beam" && beamResult && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              beamResult.feasible ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
            }`}
          >
            <p className={`text-xs leading-relaxed ${beamResult.feasible ? "text-emerald-400" : "text-amber-500"}`}>
              {beamResult.feasible ? "Feasible layout পাওয়া গেছে।" : "কোনো feasible layout পাওয়া যায়নি।"}
            </p>
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Tension</p>
            <p className="text-xs text-slate-300">
              {beamResult.tension.barCount}-{beamResult.tension.barDiameterMm}mmØ (As provided ={" "}
              {fmt(beamResult.tension.providedAsMm2)} mm²)
            </p>
            <p className="text-xs text-slate-500">Layers: {beamResult.tension.layers.join(" + ") || "—"}</p>
          </div>

          {beamResult.compression && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-1">Compression</p>
              <p className="text-xs text-slate-300">
                {beamResult.compression.barCount}-{beamResult.compression.barDiameterMm}mmØ (As provided ={" "}
                {fmt(beamResult.compression.providedAsMm2)} mm²)
              </p>
              <p className="text-xs text-slate-500">Layers: {beamResult.compression.layers.join(" + ") || "—"}</p>
            </div>
          )}

          {beamResult.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {beamResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "column" && columnResult && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              columnResult.feasible ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
            }`}
          >
            <p className={`text-xs leading-relaxed ${columnResult.feasible ? "text-emerald-400" : "text-amber-500"}`}>
              {columnResult.feasible ? "Feasible layout পাওয়া গেছে।" : "Perimeter-এ ফিট নাও করতে পারে।"}
            </p>
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Longitudinal Bars</p>
            <p className="text-xs text-slate-300">
              {columnResult.barCount}-{columnResult.barDiameterMm}mmØ (As provided = {fmt(columnResult.providedAsMm2)}{" "}
              mm²)
            </p>
            <p className="text-xs text-slate-500">
              Corners: {columnResult.cornerBarCount} · Faces: {columnResult.faceBarCountEachFace.join(", ")}
            </p>
          </div>

          {columnResult.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {columnResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "distributed" && distributedResult && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              distributedResult.feasible ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
            }`}
          >
            <p
              className={`text-xs leading-relaxed ${
                distributedResult.feasible ? "text-emerald-400" : "text-amber-500"
              }`}
            >
              {distributedResult.feasible ? "Feasible spacing পাওয়া গেছে।" : "Feasible spacing পাওয়া যায়নি।"}
            </p>
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Bar Spacing</p>
            <p className="text-xs text-slate-300">
              {distributedResult.layout.barDiameterMm}mmØ @ {distributedResult.layout.spacingMm}mm c/c (As provided ={" "}
              {fmt(distributedResult.layout.providedAsPerMeterMm2)} mm²/m)
            </p>
            <p className="text-xs text-slate-500">Max allowed spacing: {fmt(distributedResult.maxAllowedSpacingMm)}mm</p>
          </div>

          {distributedResult.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {distributedResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
