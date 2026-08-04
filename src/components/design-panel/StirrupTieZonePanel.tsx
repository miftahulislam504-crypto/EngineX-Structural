"use client";

import { useState } from "react";
import {
  layoutBeamStirrupZones,
  layoutColumnTieZones,
  type BeamStirrupZoneResult,
  type ColumnTieZoneResult,
} from "@/lib/design/stirrupTieZones";

type ElementMode = "beam" | "column";

const MODE_LABELS: Record<ElementMode, string> = {
  beam: "RC Beam",
  column: "RC Column",
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
 * Phase 10b — Stirrup/Tie Zone panel। Phase 6a-এর shear design আর
 * Phase 6b/9b-এর column tie check-কে multi-zone buildable pattern-এ
 * collapse করে (stirrupTieZones.ts দেখুন)।
 */
export function StirrupTieZonePanel() {
  const [mode, setMode] = useState<ElementMode>("beam");
  const [beamResult, setBeamResult] = useState<BeamStirrupZoneResult | null>(null);
  const [columnResult, setColumnResult] = useState<ColumnTieZoneResult | null>(null);
  const [useSeismic, setUseSeismic] = useState(false);

  // Beam
  const [clearSpanMm, setClearSpanMm] = useState("3300");
  const [beamWidthMm, setBeamWidthMm] = useState("254");
  const [effectiveDepthMm, setEffectiveDepthMm] = useState("340");
  const [fcMPa, setFcMPa] = useState("21");
  const [fyMPa, setFyMPa] = useState("414");
  const [stirrupDiameterMm, setStirrupDiameterMm] = useState("10");
  const [supportShearKN, setSupportShearKN] = useState("55");
  const [midspanShearKN, setMidspanShearKN] = useState("15");
  const [smallestLongBarDiameterMm, setSmallestLongBarDiameterMm] = useState("16");

  // Column
  const [clearHeightMm, setClearHeightMm] = useState("3000");
  const [colWidthMm, setColWidthMm] = useState("305");
  const [colTotalDepthMm, setColTotalDepthMm] = useState("457");
  const [colLongBarDiameterMm, setColLongBarDiameterMm] = useState("16");
  const [tieDiameterMm, setTieDiameterMm] = useState("10");

  function handleRun() {
    if (mode === "beam") {
      const section = {
        widthMm: Number(beamWidthMm) || 254,
        effectiveDepthMm: Number(effectiveDepthMm) || 340,
        fcMPa: Number(fcMPa) || 21,
        fyMPa: Number(fyMPa) || 414,
        stirrupDiameterMm: Number(stirrupDiameterMm) || 10,
      };
      setBeamResult(
        layoutBeamStirrupZones({
          elementLabel: "Beam (stirrup zones)",
          clearSpanMm: Number(clearSpanMm) || 3300,
          supportShear: { ...section, factoredShearKN: Number(supportShearKN) || 0 },
          midspanShear: { ...section, factoredShearKN: Number(midspanShearKN) || 0 },
          useSeismicConfinement: useSeismic,
          smallestLongitudinalBarDiameterMm: Number(smallestLongBarDiameterMm) || undefined,
        })
      );
    } else {
      setColumnResult(
        layoutColumnTieZones({
          elementLabel: "Column (tie zones)",
          clearHeightMm: Number(clearHeightMm) || 3000,
          widthMm: Number(colWidthMm) || 305,
          totalDepthMm: Number(colTotalDepthMm) || 457,
          longitudinalBarDiameterMm: Number(colLongBarDiameterMm) || 16,
          tieDiameterMm: Number(tieDiameterMm) || 10,
          useSeismicConfinement: useSeismic,
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Stirrup / Tie Zones</h3>
        <p className="text-xs text-slate-500 mb-3">
          Support/midspan (beam) বা end/mid (column) shear-driven spacing-কে buildable multi-zone pattern-এ ভাগ করে —
          সাপোর্টের কাছে tighter, মাঝখানে wider (MICON-স্টাইল &quot;5/7/5&quot; কনভেনশন)।
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

        <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <input type="checkbox" checked={useSeismic} onChange={(e) => setUseSeismic(e.target.checked)} />
          Seismic special moment frame confinement zone (ACI 318-19 Ch.18 — simplified, see warnings)
        </label>

        {mode === "beam" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Span" value={clearSpanMm} onChange={setClearSpanMm} unit="mm" />
              <Field label="Width" value={beamWidthMm} onChange={setBeamWidthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Effective Depth" value={effectiveDepthMm} onChange={setEffectiveDepthMm} unit="mm" />
              <Field label="Stirrup Dia" value={stirrupDiameterMm} onChange={setStirrupDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="f'c" value={fcMPa} onChange={setFcMPa} unit="MPa" />
              <Field label="fy" value={fyMPa} onChange={setFyMPa} unit="MPa" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Support Shear (Vu)" value={supportShearKN} onChange={setSupportShearKN} unit="kN" />
              <Field label="Midspan Shear (Vu)" value={midspanShearKN} onChange={setMidspanShearKN} unit="kN" />
            </div>
            {useSeismic && (
              <Field
                label="Smallest Longitudinal Bar Dia"
                value={smallestLongBarDiameterMm}
                onChange={setSmallestLongBarDiameterMm}
                unit="mm"
              />
            )}
          </div>
        )}

        {mode === "column" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Height" value={clearHeightMm} onChange={setClearHeightMm} unit="mm" />
              <Field label="Tie Diameter" value={tieDiameterMm} onChange={setTieDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={colWidthMm} onChange={setColWidthMm} unit="mm" />
              <Field label="Total Depth" value={colTotalDepthMm} onChange={setColTotalDepthMm} unit="mm" />
            </div>
            <Field
              label="Longitudinal Bar Diameter"
              value={colLongBarDiameterMm}
              onChange={setColLongBarDiameterMm}
              unit="mm"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Solve Zones
        </button>
      </div>

      {mode === "beam" && beamResult && (
        <div className="space-y-3">
          {beamResult.zones.map((zone, i) => (
            <div key={i} className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-1">{zone.label}</p>
              <p className="text-xs text-slate-300">
                {zone.stirrupDiameterMm}mmØ @ {zone.spacingMm}mm c/c — length {fmt(zone.lengthMm)}mm
              </p>
            </div>
          ))}
          {beamResult.seismicConfinementLengthMm !== null && (
            <p className="text-[10px] text-slate-600">
              Seismic confinement length: {fmt(beamResult.seismicConfinementLengthMm)}mm from each support face
            </p>
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
          {columnResult.zones.map((zone, i) => (
            <div key={i} className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-1">{zone.label}</p>
              <p className="text-xs text-slate-300">
                {zone.stirrupDiameterMm}mmØ @ {zone.spacingMm}mm c/c — length {fmt(zone.lengthMm)}mm
              </p>
            </div>
          ))}
          <p className="text-[10px] text-slate-600">
            General max spacing (ACI §25.7.2.1): {fmt(columnResult.generalMaxSpacingMm)}mm
            {columnResult.seismicConfinementLengthMm !== null &&
              ` · Confinement length: ${fmt(columnResult.seismicConfinementLengthMm)}mm from each joint face`}
          </p>
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
    </div>
  );
}
