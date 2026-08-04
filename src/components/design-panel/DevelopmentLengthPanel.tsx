"use client";

import { useState } from "react";
import {
  computeTensionDevelopmentLength,
  computeCompressionDevelopmentLength,
  computeTensionLapSpliceLength,
  computeCompressionLapSpliceLength,
  computeStandardHookDevelopmentLength,
  getStandardHookGeometry,
  type TensionLapSpliceClass,
  type HookBendAngleDeg,
} from "@/lib/design/developmentLength";

type CalcMode = "tension" | "compression" | "hook";

const MODE_LABELS: Record<CalcMode, string> = {
  tension: "Tension Development + Lap",
  compression: "Compression Development + Lap",
  hook: "Standard Hook",
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

/** Phase 10c — Development/Lap Length + Standard Hook panel (ACI 318-19 Ch.25, developmentLength.ts দেখুন)। */
export function DevelopmentLengthPanel() {
  const [mode, setMode] = useState<CalcMode>("tension");
  const [barDiameterMm, setBarDiameterMm] = useState("20");
  const [fyMPa, setFyMPa] = useState("414");
  const [fcMPa, setFcMPa] = useState("21");
  const [clearCoverMm, setClearCoverMm] = useState("40");
  const [isTopBar, setIsTopBar] = useState(false);
  const [isEpoxyCoated, setIsEpoxyCoated] = useState(false);
  const [spliceClass, setSpliceClass] = useState<TensionLapSpliceClass>("B");
  const [bendAngle, setBendAngle] = useState<HookBendAngleDeg>(90);
  const [isStirrupOrTie, setIsStirrupOrTie] = useState(false);

  const [tensionResult, setTensionResult] = useState<ReturnType<typeof computeTensionDevelopmentLength> | null>(null);
  const [tensionLapMm, setTensionLapMm] = useState<number | null>(null);
  const [compressionLdcMm, setCompressionLdcMm] = useState<number | null>(null);
  const [compressionLapMm, setCompressionLapMm] = useState<number | null>(null);
  const [compressionLapWarnings, setCompressionLapWarnings] = useState<string[]>([]);
  const [hookLdhMm, setHookLdhMm] = useState<number | null>(null);
  const [hookGeometry, setHookGeometry] = useState<ReturnType<typeof getStandardHookGeometry> | null>(null);

  function handleRun() {
    const db = Number(barDiameterMm) || 20;
    const fy = Number(fyMPa) || 414;
    const fc = Number(fcMPa) || 21;

    if (mode === "tension") {
      const r = computeTensionDevelopmentLength({
        barDiameterMm: db,
        fyMPa: fy,
        fcMPa: fc,
        clearCoverOrHalfSpacingMm: Number(clearCoverMm) || 40,
        isTopBar,
        isEpoxyCoated,
      });
      setTensionResult(r);
      setTensionLapMm(computeTensionLapSpliceLength(r.developmentLengthMm, spliceClass));
    } else if (mode === "compression") {
      const ldc = computeCompressionDevelopmentLength({ barDiameterMm: db, fyMPa: fy, fcMPa: fc });
      setCompressionLdcMm(ldc);
      const lapResult = computeCompressionLapSpliceLength({ barDiameterMm: db, fyMPa: fy, fcMPa: fc });
      setCompressionLapMm(lapResult.spliceLengthMm);
      setCompressionLapWarnings(lapResult.warnings);
    } else {
      setHookLdhMm(computeStandardHookDevelopmentLength({ barDiameterMm: db, fyMPa: fy, fcMPa: fc, isEpoxyCoated }));
      setHookGeometry(getStandardHookGeometry({ barDiameterMm: db, bendAngleDeg: bendAngle, isStirrupOrTie }));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Development / Lap Length / Hook</h3>
        <p className="text-xs text-slate-500 mb-3">
          ACI 318-19 Chapter 25 — straight bar development length, tension/compression lap splice, standard hook
          embedment ও bend geometry।
        </p>

        <label className="block text-xs text-slate-500 mb-1">Calculation</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as CalcMode)}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(MODE_LABELS) as CalcMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Bar Dia" value={barDiameterMm} onChange={setBarDiameterMm} unit="mm" />
            <Field label="fy" value={fyMPa} onChange={setFyMPa} unit="MPa" />
            <Field label="f'c" value={fcMPa} onChange={setFcMPa} unit="MPa" />
          </div>

          {mode === "tension" && (
            <>
              <Field label="Clear Cover / Half Spacing (cb)" value={clearCoverMm} onChange={setClearCoverMm} unit="mm" />
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={isTopBar} onChange={(e) => setIsTopBar(e.target.checked)} />
                  Top bar (ψt=1.3)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={isEpoxyCoated} onChange={(e) => setIsEpoxyCoated(e.target.checked)} />
                  Epoxy coated
                </label>
              </div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Lap Splice Class</label>
              <select
                value={spliceClass}
                onChange={(e) => setSpliceClass(e.target.value as TensionLapSpliceClass)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              >
                <option value="B">Class B (1.3×ld — default/most common)</option>
                <option value="A">Class A (1.0×ld — needs 2× As & ≤50% spliced)</option>
              </select>
            </>
          )}

          {mode === "hook" && (
            <>
              <label className="block text-[10px] text-slate-500 mb-0.5">Bend Angle</label>
              <select
                value={bendAngle}
                onChange={(e) => setBendAngle(Number(e.target.value) as HookBendAngleDeg)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              >
                <option value={90}>90°</option>
                <option value={135}>135° (seismic hook)</option>
                <option value={180}>180°</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={isStirrupOrTie} onChange={(e) => setIsStirrupOrTie(e.target.checked)} />
                Stirrup / Tie (not main longitudinal bar)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={isEpoxyCoated} onChange={(e) => setIsEpoxyCoated(e.target.checked)} />
                Epoxy coated
              </label>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Calculate
        </button>
      </div>

      {mode === "tension" && tensionResult && (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Development Length (ld)</p>
            <p className="text-xs text-slate-300">{fmt(tensionResult.developmentLengthMm)}mm</p>
            <p className="text-[10px] text-slate-600">
              ψt={tensionResult.psiT} · ψe={tensionResult.psiE} · ψs={tensionResult.psiS} · ψg={tensionResult.psiG} ·
              λ={tensionResult.lambda} · (cb+Ktr)/db={fmt(tensionResult.confinementTerm, 2)}
            </p>
          </div>
          {tensionLapMm !== null && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-1">Lap Splice Length (Class {spliceClass})</p>
              <p className="text-xs text-slate-300">{fmt(tensionLapMm)}mm</p>
            </div>
          )}
          {tensionResult.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {tensionResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "compression" && compressionLdcMm !== null && (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Development Length (ldc)</p>
            <p className="text-xs text-slate-300">{fmt(compressionLdcMm)}mm</p>
          </div>
          {compressionLapMm !== null && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-1">Lap Splice Length</p>
              <p className="text-xs text-slate-300">{fmt(compressionLapMm)}mm</p>
            </div>
          )}
          {compressionLapWarnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {compressionLapWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "hook" && hookLdhMm !== null && hookGeometry && (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Hook Development Length (ldh)</p>
            <p className="text-xs text-slate-300">{fmt(hookLdhMm)}mm</p>
          </div>
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Hook Geometry</p>
            <p className="text-xs text-slate-300">
              Bend diameter: {fmt(hookGeometry.bendDiameterMm)}mm · Extension: {fmt(hookGeometry.extensionMm)}mm
            </p>
          </div>
          {hookGeometry.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {hookGeometry.warnings.map((w, i) => (
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
