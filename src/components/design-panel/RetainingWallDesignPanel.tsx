"use client";

import { useState } from "react";
import { runRetainingWallDesign, type RetainingWallDesignReport } from "@/lib/design/retainingWallDesign";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 6h — Cantilever Retaining Wall Design panel। Standalone
 * calculator (SteelConnectionDesignPanel এর মতো কোনো model element
 * bound না — retaining wall geometry Wall element এর plan/thickness
 * shape থেকে ভিন্ন ধরনের ইনপুট প্রয়োজন: stem/toe/heel dimension,
 * backfill soil properties)। এই app কোনো geotechnical analysis করে
 * না — soil unit weight, friction angle, allowable bearing pressure
 * geotechnical report থেকে ইঞ্জিনিয়ার সরবরাহ করেন।
 */
export function RetainingWallDesignPanel() {
  const [stemHeightM, setStemHeightM] = useState("4.5");
  const [stemTopThicknessMm, setStemTopThicknessMm] = useState("300");
  const [stemBottomThicknessMm, setStemBottomThicknessMm] = useState("400");
  const [baseThicknessMm, setBaseThicknessMm] = useState("500");
  const [toeWidthM, setToeWidthM] = useState("0.8");
  const [heelWidthM, setHeelWidthM] = useState("1.7");
  const [concreteUnitWeightKNm3, setConcreteUnitWeightKNm3] = useState("24");

  const [soilUnitWeightKNm3, setSoilUnitWeightKNm3] = useState("18");
  const [frictionAngleDeg, setFrictionAngleDeg] = useState("30");
  const [surchargeKPa, setSurchargeKPa] = useState("");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [frictionCoefficient, setFrictionCoefficient] = useState("");
  const [passiveResistanceDepthM, setPassiveResistanceDepthM] = useState("");

  const [effectiveCoverMm, setEffectiveCoverMm] = useState("60");
  const [fcMPa, setFcMPa] = useState("21");
  const [fyMPa, setFyMPa] = useState("414");

  const [report, setReport] = useState<RetainingWallDesignReport | null>(null);

  function handleRunDesign() {
    const result = runRetainingWallDesign({
      elementLabel: "Retaining Wall",
      geometry: {
        stemHeightM: Number(stemHeightM) || 0,
        stemTopThicknessMm: Number(stemTopThicknessMm) || 0,
        stemBottomThicknessMm: Number(stemBottomThicknessMm) || 0,
        baseThicknessMm: Number(baseThicknessMm) || 0,
        toeWidthM: Number(toeWidthM) || 0,
        heelWidthM: Number(heelWidthM) || 0,
        concreteUnitWeightKNm3: Number(concreteUnitWeightKNm3) || 24,
      },
      backfillSoil: {
        unitWeightKNm3: Number(soilUnitWeightKNm3) || 18,
        frictionAngleDeg: Number(frictionAngleDeg) || 30,
      },
      surchargeKPa: surchargeKPa.trim() !== "" ? Number(surchargeKPa) : undefined,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
      frictionCoefficientBaseSoil: frictionCoefficient.trim() !== "" ? Number(frictionCoefficient) : undefined,
      passiveResistanceDepthM: passiveResistanceDepthM.trim() !== "" ? Number(passiveResistanceDepthM) : undefined,
      effectiveCoverMm: Number(effectiveCoverMm) || 60,
      fcMPa: Number(fcMPa) || 21,
      fyMPa: Number(fyMPa) || 414,
    });
    setReport(result);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Retaining Wall Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          Cantilever retaining wall — Rankine active pressure, overturning/sliding/bearing stability, stem and
          toe/heel flexural design.
        </p>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — soil unit weight, friction angle, and allowable
          bearing pressure must come from your geotechnical report.
        </p>
      </div>

      <p className="text-xs text-slate-500 font-medium">Wall Geometry</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Stem Height (m)</label>
          <input
            type="number"
            step="any"
            value={stemHeightM}
            onChange={(e) => setStemHeightM(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Base Thickness (mm)</label>
          <input
            type="number"
            step="any"
            value={baseThicknessMm}
            onChange={(e) => setBaseThicknessMm(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Stem Top Thickness (mm)</label>
          <input
            type="number"
            step="any"
            value={stemTopThicknessMm}
            onChange={(e) => setStemTopThicknessMm(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Stem Bottom Thickness (mm)</label>
          <input
            type="number"
            step="any"
            value={stemBottomThicknessMm}
            onChange={(e) => setStemBottomThicknessMm(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Toe Width (m)</label>
          <input
            type="number"
            step="any"
            value={toeWidthM}
            onChange={(e) => setToeWidthM(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Heel Width (m)</label>
          <input
            type="number"
            step="any"
            value={heelWidthM}
            onChange={(e) => setHeelWidthM(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500 font-medium">Backfill Soil</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Unit Weight γ (kN/m³)</label>
          <input
            type="number"
            step="any"
            value={soilUnitWeightKNm3}
            onChange={(e) => setSoilUnitWeightKNm3(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Friction Angle φ (deg)</label>
          <input
            type="number"
            step="any"
            value={frictionAngleDeg}
            onChange={(e) => setFrictionAngleDeg(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Surcharge (kPa) — optional</label>
          <input
            type="number"
            step="any"
            value={surchargeKPa}
            onChange={(e) => setSurchargeKPa(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Allowable Bearing Pressure (kPa)</label>
          <input
            type="number"
            step="any"
            value={allowableBearingPressureKPa}
            onChange={(e) => setAllowableBearingPressureKPa(e.target.value)}
            placeholder="from geotech report"
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Base-Soil Friction Coeff. μ — optional</label>
          <input
            type="number"
            step="any"
            value={frictionCoefficient}
            onChange={(e) => setFrictionCoefficient(e.target.value)}
            placeholder="default: tan(2φ/3)"
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Passive Resistance Depth (m) — optional</label>
          <input
            type="number"
            step="any"
            value={passiveResistanceDepthM}
            onChange={(e) => setPassiveResistanceDepthM(e.target.value)}
            placeholder="default: neglected"
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500 font-medium">Concrete / Reinforcement</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Concrete Unit Weight (kN/m³)</label>
          <input
            type="number"
            step="any"
            value={concreteUnitWeightKNm3}
            onChange={(e) => setConcreteUnitWeightKNm3(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">f&apos;c (MPa)</label>
          <input
            type="number"
            step="any"
            value={fcMPa}
            onChange={(e) => setFcMPa(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">fy (MPa)</label>
          <input
            type="number"
            step="any"
            value={fyMPa}
            onChange={(e) => setFyMPa(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Cover (mm)</label>
          <input
            type="number"
            step="any"
            value={effectiveCoverMm}
            onChange={(e) => setEffectiveCoverMm(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleRunDesign}
        className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Run Retaining Wall Design
      </button>

      {report && <RetainingWallReportView report={report} />}
    </div>
  );
}

function RetainingWallReportView({ report }: { report: RetainingWallDesignReport }) {
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
        <p className="text-xs text-slate-500 font-medium mb-1">Stability</p>
        <p className="text-xs text-slate-300">
          FS Overturning = {fmt(report.stability.factorOfSafetyOverturning, 2)} (min 2.0) —{" "}
          {report.stability.factorOfSafetyOverturning >= 2.0 ? "OK" : "NOT adequate"}
        </p>
        <p className="text-xs text-slate-300">
          FS Sliding = {fmt(report.stability.factorOfSafetySliding, 2)} (min 1.5) —{" "}
          {report.stability.factorOfSafetySliding >= 1.5 ? "OK" : "NOT adequate"}
        </p>
        <p className="text-xs text-slate-300">
          Bearing: max = {fmt(report.stability.maxBearingPressureKPa)} kPa, min ={" "}
          {fmt(report.stability.minBearingPressureKPa)} kPa —{" "}
          {report.stability.bearingAdequate ? "OK" : "NOT adequate"}
        </p>
        <p className="text-xs text-slate-300">Eccentricity e = {fmt(report.stability.eccentricityM, 3)} m</p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Stem Reinforcement</p>
        <p className="text-xs text-slate-300">
          Mu = {fmt(report.stem.factoredMomentAtBaseKNmPerM)} kN·m/m, As ={" "}
          {fmt(report.stem.flexuralDesign.governingAsMm2, 0)} mm²/m
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Toe Reinforcement</p>
        <p className="text-xs text-slate-300">
          Mu = {fmt(report.toe.factoredMomentKNmPerM)} kN·m/m, As = {fmt(report.toe.flexuralDesign.governingAsMm2, 0)}{" "}
          mm²/m
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Heel Reinforcement</p>
        <p className="text-xs text-slate-300">
          Mu = {fmt(report.heel.factoredMomentKNmPerM)} kN·m/m, As ={" "}
          {fmt(report.heel.flexuralDesign.governingAsMm2, 0)} mm²/m
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
