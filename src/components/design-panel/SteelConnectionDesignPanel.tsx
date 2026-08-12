"use client";

import { useState } from "react";
import { designBoltedShearConnection, type BoltedShearConnectionResult } from "@/lib/design/boltedConnection";
import { STANDARD_BOLT_DIAMETERS_MM, type BoltGrade } from "@/lib/design/boltProperties";
import { designFilletWeld, type FilletWeldResult, type WeldElectrode } from "@/lib/design/weldedConnection";
import { designBasePlate, type BasePlateResult } from "@/lib/design/basePlate";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

type ConnectionMode = "bolted" | "welded" | "base-plate";

const MODES: { id: ConnectionMode; label: string }[] = [
  { id: "bolted", label: "Bolted Shear" },
  { id: "welded", label: "Fillet Weld" },
  { id: "base-plate", label: "Base Plate" },
];

/**
 * Phase 6g — Steel Connection Design panel। RC/Steel Beam/Column
 * প্যানেলের মতো model element এর সাথে bound না — connection ডিজাইন
 * সাধারণত standalone calculation (কোনো element category নেই এর
 * জন্য), তাই ইঞ্জিনিয়ার সরাসরি force ও geometry ইনপুট দেন।
 */
export function SteelConnectionDesignPanel() {
  const [mode, setMode] = useState<ConnectionMode>("bolted");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Steel Connection Design</h3>
        <p className="text-xs text-text-muted mb-3">
          AISC 360-16 §J — standalone connection checks (not tied to a model element).
        </p>

        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                mode === m.id
                  ? "bg-surface-hover border-surface-border text-text-primary"
                  : "bg-surface border-surface-border text-text-muted hover:text-text-secondary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "bolted" && <BoltedShearForm />}
      {mode === "welded" && <FilletWeldForm />}
      {mode === "base-plate" && <BasePlateForm />}
    </div>
  );
}

function BoltedShearForm() {
  const [boltGrade, setBoltGrade] = useState<BoltGrade>("A325");
  const [boltDiameterMm, setBoltDiameterMm] = useState("19.1");
  const [numberOfBolts, setNumberOfBolts] = useState("4");
  const [numberOfShearPlanes, setNumberOfShearPlanes] = useState<"1" | "2">("1");
  const [plateThicknessMm, setPlateThicknessMm] = useState("");
  const [plateFuMPa, setPlateFuMPa] = useState("400");
  const [edgeDistanceMm, setEdgeDistanceMm] = useState("40");
  const [boltSpacingMm, setBoltSpacingMm] = useState("75");
  const [factoredShearKN, setFactoredShearKN] = useState("");

  const [result, setResult] = useState<BoltedShearConnectionResult | null>(null);

  function handleRun() {
    const r = designBoltedShearConnection({
      boltGrade,
      boltDiameterMm: Number(boltDiameterMm) || 19.1,
      numberOfBolts: Number(numberOfBolts) || 1,
      numberOfShearPlanes: numberOfShearPlanes === "2" ? 2 : 1,
      plateThicknessMm: Number(plateThicknessMm) || 0,
      plateFuMPa: Number(plateFuMPa) || 400,
      edgeDistanceMm: Number(edgeDistanceMm) || 0,
      boltSpacingMm: Number(boltSpacingMm) || 0,
      factoredShearKN: Number(factoredShearKN) || 0,
    });
    setResult(r);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Bolt Grade</label>
          <select
            value={boltGrade}
            onChange={(e) => setBoltGrade(e.target.value as BoltGrade)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          >
            <option value="A325">A325</option>
            <option value="A490">A490</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Bolt Diameter (mm)</label>
          <select
            value={boltDiameterMm}
            onChange={(e) => setBoltDiameterMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          >
            {STANDARD_BOLT_DIAMETERS_MM.map((d) => (
              <option key={d} value={d}>
                {d}mm
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Number of Bolts</label>
          <input
            type="number"
            value={numberOfBolts}
            onChange={(e) => setNumberOfBolts(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Shear Planes</label>
          <select
            value={numberOfShearPlanes}
            onChange={(e) => setNumberOfShearPlanes(e.target.value as "1" | "2")}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          >
            <option value="1">Single Shear</option>
            <option value="2">Double Shear</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Plate Thickness (mm)</label>
          <input
            type="number"
            step="any"
            value={plateThicknessMm}
            onChange={(e) => setPlateThicknessMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Plate Fu (MPa)</label>
          <input
            type="number"
            step="any"
            value={plateFuMPa}
            onChange={(e) => setPlateFuMPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Edge Distance (mm)</label>
          <input
            type="number"
            step="any"
            value={edgeDistanceMm}
            onChange={(e) => setEdgeDistanceMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Bolt Spacing (mm)</label>
          <input
            type="number"
            step="any"
            value={boltSpacingMm}
            onChange={(e) => setBoltSpacingMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Factored Shear Vu (kN)</label>
        <input
          type="number"
          step="any"
          value={factoredShearKN}
          onChange={(e) => setFactoredShearKN(e.target.value)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        />
      </div>

      <button
        type="button"
        onClick={handleRun}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Check Bolted Connection
      </button>

      {result && (
        <div className="space-y-3">
          <StatusBanner adequate={result.adequate} />
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-secondary">φRn (bolt shear) = {fmt(result.phiRnBoltShearKN)} kN</p>
            <p className="text-xs text-text-secondary">φRn (bearing/tearout) = {fmt(result.phiRnBearingKN)} kN</p>
            <p className="text-xs text-text-secondary">
              Governing = {fmt(result.governingCapacityKN)} kN — utilization{" "}
              {Number.isFinite(result.utilizationRatio) ? `${(result.utilizationRatio * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
          <WarningsBlock warnings={result.warnings} />
        </div>
      )}
    </div>
  );
}

function FilletWeldForm() {
  const [electrode, setElectrode] = useState<WeldElectrode>("E70XX");
  const [weldSizeMm, setWeldSizeMm] = useState("8");
  const [weldLengthMm, setWeldLengthMm] = useState("");
  const [factoredShearKN, setFactoredShearKN] = useState("");

  const [result, setResult] = useState<FilletWeldResult | null>(null);

  function handleRun() {
    const r = designFilletWeld({
      electrode,
      weldSizeMm: Number(weldSizeMm) || 0,
      weldLengthMm: Number(weldLengthMm) || 0,
      factoredShearKN: Number(factoredShearKN) || 0,
    });
    setResult(r);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Electrode</label>
          <select
            value={electrode}
            onChange={(e) => setElectrode(e.target.value as WeldElectrode)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          >
            <option value="E70XX">E70XX</option>
            <option value="E80XX">E80XX</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Weld Size (mm)</label>
          <input
            type="number"
            step="any"
            value={weldSizeMm}
            onChange={(e) => setWeldSizeMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Total Effective Length (mm)</label>
          <input
            type="number"
            step="any"
            value={weldLengthMm}
            onChange={(e) => setWeldLengthMm(e.target.value)}
            placeholder="both sides combined"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Factored Shear Vu (kN)</label>
          <input
            type="number"
            step="any"
            value={factoredShearKN}
            onChange={(e) => setFactoredShearKN(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleRun}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Check Fillet Weld
      </button>

      {result && (
        <div className="space-y-3">
          <StatusBanner adequate={result.adequate} />
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-secondary">Effective throat = {fmt(result.effectiveThroatMm, 2)} mm</p>
            <p className="text-xs text-text-secondary">
              φRn = {fmt(result.phiRnKN)} kN — utilization{" "}
              {Number.isFinite(result.utilizationRatio) ? `${(result.utilizationRatio * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
          <WarningsBlock warnings={result.warnings} />
        </div>
      )}
    </div>
  );
}

function BasePlateForm() {
  const [columnDepthMm, setColumnDepthMm] = useState("");
  const [columnFlangeWidthMm, setColumnFlangeWidthMm] = useState("");
  const [concreteFcMPa, setConcreteFcMPa] = useState("28");
  const [plateFyMPa, setPlateFyMPa] = useState("250");
  const [factoredAxialLoadKN, setFactoredAxialLoadKN] = useState("");

  const [result, setResult] = useState<BasePlateResult | null>(null);

  function handleRun() {
    const r = designBasePlate({
      columnDepthMm: Number(columnDepthMm) || 0,
      columnFlangeWidthMm: Number(columnFlangeWidthMm) || 0,
      concreteFcMPa: Number(concreteFcMPa) || 28,
      plateFyMPa: Number(plateFyMPa) || 250,
      factoredAxialLoadKN: Number(factoredAxialLoadKN) || 0,
    });
    setResult(r);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2">
        Concentric axial load only — no moment/eccentricity or anchor rod design.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Column Depth d (mm)</label>
          <input
            type="number"
            step="any"
            value={columnDepthMm}
            onChange={(e) => setColumnDepthMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Column Flange Width bf (mm)</label>
          <input
            type="number"
            step="any"
            value={columnFlangeWidthMm}
            onChange={(e) => setColumnFlangeWidthMm(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Concrete f&apos;c (MPa)</label>
          <input
            type="number"
            step="any"
            value={concreteFcMPa}
            onChange={(e) => setConcreteFcMPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Plate Fy (MPa)</label>
          <input
            type="number"
            step="any"
            value={plateFyMPa}
            onChange={(e) => setPlateFyMPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Factored Axial Load Pu (kN)</label>
        <input
          type="number"
          step="any"
          value={factoredAxialLoadKN}
          onChange={(e) => setFactoredAxialLoadKN(e.target.value)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        />
      </div>

      <button
        type="button"
        onClick={handleRun}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Design Base Plate
      </button>

      {result && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-secondary">
              Plate size: {result.plateLengthMm}mm × {result.plateWidthMm}mm
            </p>
            <p className="text-xs text-text-secondary">Required thickness = {fmt(result.requiredThicknessMm)} mm</p>
            <p className="text-xs text-text-secondary">Bearing capacity = {fmt(result.bearingCapacityKPa / 1000, 2)} MPa</p>
          </div>
          <WarningsBlock warnings={result.warnings} />
        </div>
      )}
    </div>
  );
}

function StatusBanner({ adequate }: { adequate: boolean }) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        adequate
          ? "bg-status-activeBg border-status-activeBorder text-status-activeText"
          : "bg-red-50 border-red-200 text-red-600"
      }`}
    >
      <p className="text-xs font-medium">
        {adequate ? "✓ Adequate" : "✗ NOT adequate"}
      </p>
    </div>
  );
}

function WarningsBlock({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
      <p className="text-xs text-text-muted font-medium">Warnings:</p>
      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-status-holdText leading-relaxed">
          {w}
        </p>
      ))}
    </div>
  );
}
