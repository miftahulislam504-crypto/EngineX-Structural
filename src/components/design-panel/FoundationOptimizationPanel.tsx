"use client";

import { useState } from "react";
import {
  runFoundationOptimization,
  FOUNDATION_OPTIMIZATION_TEMPLATES,
  type FoundationType,
  type FoundationOptimizationResult,
  type FoundationOptimizationVariable,
} from "@/lib/design/foundationOptimization";

const FOUNDATION_TYPE_LABELS: Record<FoundationType, string> = {
  "isolated-footing": "Isolated Footing",
  "combined-footing": "Combined Footing",
  "strip-footing": "Strip Footing",
  "mat-foundation": "Mat Foundation",
  "pile-cap": "Pile Cap",
};

function fmt(v: number, decimals = 2): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function VariableRangeInputs({
  variables,
  values,
  onChange,
}: {
  variables: FoundationOptimizationVariable[];
  values: Record<string, { min: string; max: string; step: string }>;
  onChange: (name: string, field: "min" | "max" | "step", value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-text-muted font-medium">Search Variables</p>
      {variables.map((v) => (
        <div key={v.name} className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">{v.name} min (mm)</label>
            <input
              value={values[v.name]?.min ?? String(v.minValue)}
              onChange={(e) => onChange(v.name, "min", e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">max (mm)</label>
            <input
              value={values[v.name]?.max ?? String(v.maxValue)}
              onChange={(e) => onChange(v.name, "max", e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">step (mm)</label>
            <input
              value={values[v.name]?.step ?? String(v.stepSize ?? 50)}
              onChange={(e) => onChange(v.name, "step", e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
        </div>
      ))}
    </div>
  );
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
      <label className="block text-[10px] text-text-muted mb-0.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
      />
    </div>
  );
}

/**
 * Phase 9a — Foundation Optimization panel। Phase 7f-এ এটা শুধু
 * problem definition preview করতো (placeholder)। এখন সত্যিকার
 * exhaustive/grid-search optimizer চলে — প্রতিটা candidate Phase 6e/
 * 7a-7d এর already-verified design module দিয়ে চেক করা হয়, এবং
 * feasible candidate-গুলোর মধ্যে সর্বনিম্ন concrete volume বেছে
 * নেওয়া হয়। Standalone calculator (Retaining Wall/Connection/
 * Geotechnical panel-এর মতো — কোনো model element bound না)।
 */
export function FoundationOptimizationPanel() {
  const [foundationType, setFoundationType] = useState<FoundationType>("isolated-footing");
  const [result, setResult] = useState<FoundationOptimizationResult | null>(null);
  const [rangeOverrides, setRangeOverrides] = useState<
    Record<string, { min: string; max: string; step: string }>
  >({});

  // Shared/common fields
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");
  const [fcMPa, setFcMPa] = useState("21");
  const [fyMPa, setFyMPa] = useState("414");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("150");

  // Isolated footing fields
  const [isoServiceLoadKN, setIsoServiceLoadKN] = useState("800");
  const [isoFactoredLoadKN, setIsoFactoredLoadKN] = useState("1150");
  const [isoIsSquare, setIsoIsSquare] = useState(true);
  const [isoColumnWidthMm, setIsoColumnWidthMm] = useState("400");
  const [isoColumnDepthMm, setIsoColumnDepthMm] = useState("400");

  // Combined footing fields
  const [cfServiceLoadAKN, setCfServiceLoadAKN] = useState("700");
  const [cfServiceLoadBKN, setCfServiceLoadBKN] = useState("900");
  const [cfFactoredLoadAKN, setCfFactoredLoadAKN] = useState("1000");
  const [cfFactoredLoadBKN, setCfFactoredLoadBKN] = useState("1300");
  const [cfSpacingMm, setCfSpacingMm] = useState("4000");
  const [cfColumnAWidthMm, setCfColumnAWidthMm] = useState("400");
  const [cfColumnADepthMm, setCfColumnADepthMm] = useState("400");
  const [cfColumnBWidthMm, setCfColumnBWidthMm] = useState("400");
  const [cfColumnBDepthMm, setCfColumnBDepthMm] = useState("400");

  // Strip footing fields
  const [sfSupportWidthMm, setSfSupportWidthMm] = useState("300");
  const [sfFactoredLoadKNPerM, setSfFactoredLoadKNPerM] = useState("120");

  // Mat foundation fields (fixed rectangular plan for this panel's simplicity)
  const [matPlanWidthM, setMatPlanWidthM] = useState("12");
  const [matPlanLengthM, setMatPlanLengthM] = useState("15");
  const [matColumnLoadKN, setMatColumnLoadKN] = useState("1000");
  const [matColumnFactoredLoadKN, setMatColumnFactoredLoadKN] = useState("1450");
  const [matTributaryCantileverMm, setMatTributaryCantileverMm] = useState("1500");

  // Pile cap fields
  const [pcColumnWidthMm, setPcColumnWidthMm] = useState("500");
  const [pcColumnDepthMm, setPcColumnDepthMm] = useState("500");
  const [pcServiceLoadKN, setPcServiceLoadKN] = useState("2000");
  const [pcFactoredLoadKN, setPcFactoredLoadKN] = useState("2900");
  const [pcPileShape, setPcPileShape] = useState<"circular" | "square">("circular");
  const [pcPileDiameterMm, setPcPileDiameterMm] = useState("400");
  const [pcEmbeddedLengthMm, setPcEmbeddedLengthMm] = useState("12000");
  const [pcUnitSkinFrictionKPa, setPcUnitSkinFrictionKPa] = useState("35");
  const [pcEndBearingPressureKPa, setPcEndBearingPressureKPa] = useState("1200");
  const [pcNumberOfRows, setPcNumberOfRows] = useState("2");
  const [pcNumberOfColumns, setPcNumberOfColumns] = useState("2");

  const problem = FOUNDATION_OPTIMIZATION_TEMPLATES[foundationType];

  function updateRange(name: string, field: "min" | "max" | "step", value: string) {
    setRangeOverrides((prev) => ({
      ...prev,
      [name]: {
        min: prev[name]?.min ?? String(problem.variables.find((v) => v.name === name)?.minValue ?? 0),
        max: prev[name]?.max ?? String(problem.variables.find((v) => v.name === name)?.maxValue ?? 0),
        step: prev[name]?.step ?? String(problem.variables.find((v) => v.name === name)?.stepSize ?? 50),
        [field]: value,
      },
    }));
  }

  function resolvedVariables(): FoundationOptimizationVariable[] {
    return problem.variables.map((v) => {
      const o = rangeOverrides[v.name];
      return {
        name: v.name,
        minValue: o?.min !== undefined ? Number(o.min) || v.minValue : v.minValue,
        maxValue: o?.max !== undefined ? Number(o.max) || v.maxValue : v.maxValue,
        stepSize: o?.step !== undefined ? Number(o.step) || v.stepSize : v.stepSize,
      };
    });
  }

  function handleRunOptimization() {
    const variables = resolvedVariables();
    const resolvedProblem = { ...problem, variables };

    if (foundationType === "isolated-footing") {
      setResult(
        runFoundationOptimization(resolvedProblem, {
          elementLabel: "Isolated Footing (optimizer)",
          servicePointLoadKN: Number(isoServiceLoadKN) || 0,
          factoredPointLoadKN: Number(isoFactoredLoadKN) || 0,
          allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
          isSquareFooting: isoIsSquare,
          columnWidthMm: Number(isoColumnWidthMm) || 400,
          columnDepthMm: Number(isoColumnDepthMm) || 400,
          effectiveCoverMm: Number(effectiveCoverMm) || 75,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
        })
      );
    } else if (foundationType === "combined-footing") {
      setResult(
        runFoundationOptimization(resolvedProblem, {
          elementLabel: "Combined Footing (optimizer)",
          servicePointLoadAKN: Number(cfServiceLoadAKN) || 0,
          servicePointLoadBKN: Number(cfServiceLoadBKN) || 0,
          factoredPointLoadAKN: Number(cfFactoredLoadAKN) || 0,
          factoredPointLoadBKN: Number(cfFactoredLoadBKN) || 0,
          columnToColumnSpacingMm: Number(cfSpacingMm) || 0,
          columnAWidthMm: Number(cfColumnAWidthMm) || 400,
          columnADepthMm: Number(cfColumnADepthMm) || 400,
          columnBWidthMm: Number(cfColumnBWidthMm) || 400,
          columnBDepthMm: Number(cfColumnBDepthMm) || 400,
          allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
          effectiveCoverMm: Number(effectiveCoverMm) || 75,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
        })
      );
    } else if (foundationType === "strip-footing") {
      setResult(
        runFoundationOptimization(resolvedProblem, {
          elementLabel: "Strip Footing (optimizer)",
          supportWidthMm: Number(sfSupportWidthMm) || 300,
          effectiveCoverMm: Number(effectiveCoverMm) || 75,
          factoredLinearLoadKNPerM: Number(sfFactoredLoadKNPerM) || 0,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
        })
      );
    } else if (foundationType === "mat-foundation") {
      const w = Number(matPlanWidthM) || 12;
      const l = Number(matPlanLengthM) || 15;
      const vertices = [
        { xM: 0, zM: 0 },
        { xM: w, zM: 0 },
        { xM: w, zM: l },
        { xM: 0, zM: l },
      ];
      setResult(
        runFoundationOptimization(resolvedProblem, {
          elementLabel: "Mat Foundation (optimizer)",
          vertices,
          columns: [
            {
              label: "C1",
              xM: w / 2,
              zM: l / 2,
              servicePointLoadKN: Number(matColumnLoadKN) || 0,
              factoredPointLoadKN: Number(matColumnFactoredLoadKN) || 0,
              columnWidthMm: 400,
              columnDepthMm: 400,
              columnPosition: "interior",
              tributaryCantileverMm: Number(matTributaryCantileverMm) || 1500,
            },
          ],
          allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
          effectiveCoverMm: Number(effectiveCoverMm) || 75,
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
        })
      );
    } else if (foundationType === "pile-cap") {
      setResult(
        runFoundationOptimization(resolvedProblem, {
          elementLabel: "Pile Cap (optimizer)",
          pileGroup: {
            pileShape: pcPileShape,
            pileDiameterOrWidthMm: Number(pcPileDiameterMm) || 400,
            embeddedLengthMm: Number(pcEmbeddedLengthMm) || 12000,
            unitSkinFrictionKPa: Number(pcUnitSkinFrictionKPa) || 0,
            endBearingPressureKPa: Number(pcEndBearingPressureKPa) || 0,
            numberOfRows: Number(pcNumberOfRows) || 2,
            numberOfColumns: Number(pcNumberOfColumns) || 2,
          },
          effectiveCoverMm: Number(effectiveCoverMm) || 75,
          column: {
            columnWidthMm: Number(pcColumnWidthMm) || 500,
            columnDepthMm: Number(pcColumnDepthMm) || 500,
            columnPosition: "interior",
            servicePointLoadKN: Number(pcServiceLoadKN) || 0,
            factoredPointLoadKN: Number(pcFactoredLoadKN) || 0,
          },
          fcMPa: Number(fcMPa) || 21,
          fyMPa: Number(fyMPa) || 414,
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Foundation Optimization</h3>
        <p className="text-xs text-text-muted mb-3">
          প্রতিটা variable range-এর মধ্যে candidate dimension sweep করে, Phase 6e/7a-7d এর design module দিয়ে
          feasibility চেক করে, এবং সর্বনিম্ন concrete volume-এর feasible candidate বেছে নেয়।
        </p>

        <label className="block text-xs text-text-muted mb-1">Foundation Type</label>
        <select
          value={foundationType}
          onChange={(e) => {
            setFoundationType(e.target.value as FoundationType);
            setResult(null);
            setRangeOverrides({});
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(FOUNDATION_TYPE_LABELS) as FoundationType[]).map((type) => (
            <option key={type} value={type}>
              {FOUNDATION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Field label="Effective Cover" value={effectiveCoverMm} onChange={setEffectiveCoverMm} unit="mm" />
          <Field label="f'c" value={fcMPa} onChange={setFcMPa} unit="MPa" />
          <Field label="fy" value={fyMPa} onChange={setFyMPa} unit="MPa" />
        </div>

        {foundationType !== "pile-cap" && (
          <div className="mb-3">
            <Field
              label="Allowable Bearing Pressure"
              value={allowableBearingPressureKPa}
              onChange={setAllowableBearingPressureKPa}
              unit="kPa"
            />
          </div>
        )}

        {foundationType === "isolated-footing" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Service Load Pa" value={isoServiceLoadKN} onChange={setIsoServiceLoadKN} unit="kN" />
              <Field label="Factored Load Pu" value={isoFactoredLoadKN} onChange={setIsoFactoredLoadKN} unit="kN" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column Width" value={isoColumnWidthMm} onChange={setIsoColumnWidthMm} unit="mm" />
              <Field label="Column Depth" value={isoColumnDepthMm} onChange={setIsoColumnDepthMm} unit="mm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={isoIsSquare} onChange={(e) => setIsoIsSquare(e.target.checked)} />
              Square footing
            </label>
          </div>
        )}

        {foundationType === "combined-footing" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Service Load A" value={cfServiceLoadAKN} onChange={setCfServiceLoadAKN} unit="kN" />
              <Field label="Service Load B" value={cfServiceLoadBKN} onChange={setCfServiceLoadBKN} unit="kN" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Factored Load A" value={cfFactoredLoadAKN} onChange={setCfFactoredLoadAKN} unit="kN" />
              <Field label="Factored Load B" value={cfFactoredLoadBKN} onChange={setCfFactoredLoadBKN} unit="kN" />
            </div>
            <Field label="Column-to-Column Spacing" value={cfSpacingMm} onChange={setCfSpacingMm} unit="mm" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column A Width" value={cfColumnAWidthMm} onChange={setCfColumnAWidthMm} unit="mm" />
              <Field label="Column A Depth" value={cfColumnADepthMm} onChange={setCfColumnADepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column B Width" value={cfColumnBWidthMm} onChange={setCfColumnBWidthMm} unit="mm" />
              <Field label="Column B Depth" value={cfColumnBDepthMm} onChange={setCfColumnBDepthMm} unit="mm" />
            </div>
          </div>
        )}

        {foundationType === "strip-footing" && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Field label="Support Width" value={sfSupportWidthMm} onChange={setSfSupportWidthMm} unit="mm" />
            <Field
              label="Factored Linear Load"
              value={sfFactoredLoadKNPerM}
              onChange={setSfFactoredLoadKNPerM}
              unit="kN/m"
            />
          </div>
        )}

        {foundationType === "mat-foundation" && (
          <div className="space-y-2 mb-3">
            <p className="text-[10px] text-text-muted">
              এই optimizer panel সরলীকৃত rectangular mat plan ব্যবহার করে (একটা প্রতিনিধিত্বমূলক interior কলাম
              সহ) — জটিল polygon plan/multi-column mat-এর জন্য Mat Foundation Design panel-এই ম্যানুয়ালি iterate
              করুন।
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plan Width" value={matPlanWidthM} onChange={setMatPlanWidthM} unit="m" />
              <Field label="Plan Length" value={matPlanLengthM} onChange={setMatPlanLengthM} unit="m" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column Service Load" value={matColumnLoadKN} onChange={setMatColumnLoadKN} unit="kN" />
              <Field
                label="Column Factored Load"
                value={matColumnFactoredLoadKN}
                onChange={setMatColumnFactoredLoadKN}
                unit="kN"
              />
            </div>
            <Field
              label="Tributary Cantilever"
              value={matTributaryCantileverMm}
              onChange={setMatTributaryCantileverMm}
              unit="mm"
            />
          </div>
        )}

        {foundationType === "pile-cap" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column Width" value={pcColumnWidthMm} onChange={setPcColumnWidthMm} unit="mm" />
              <Field label="Column Depth" value={pcColumnDepthMm} onChange={setPcColumnDepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Service Load" value={pcServiceLoadKN} onChange={setPcServiceLoadKN} unit="kN" />
              <Field label="Factored Load" value={pcFactoredLoadKN} onChange={setPcFactoredLoadKN} unit="kN" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Pile Shape</label>
              <select
                value={pcPileShape}
                onChange={(e) => setPcPileShape(e.target.value as "circular" | "square")}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              >
                <option value="circular">Circular</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pile Diameter/Width" value={pcPileDiameterMm} onChange={setPcPileDiameterMm} unit="mm" />
              <Field label="Embedded Length" value={pcEmbeddedLengthMm} onChange={setPcEmbeddedLengthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Unit Skin Friction"
                value={pcUnitSkinFrictionKPa}
                onChange={setPcUnitSkinFrictionKPa}
                unit="kPa"
              />
              <Field
                label="End Bearing Pressure"
                value={pcEndBearingPressureKPa}
                onChange={setPcEndBearingPressureKPa}
                unit="kPa"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Rows" value={pcNumberOfRows} onChange={setPcNumberOfRows} />
              <Field label="Columns" value={pcNumberOfColumns} onChange={setPcNumberOfColumns} />
            </div>
          </div>
        )}

        <div className="mb-3">
          <VariableRangeInputs variables={problem.variables} values={rangeOverrides} onChange={updateRange} />
        </div>

        <button
          type="button"
          onClick={handleRunOptimization}
          className="w-full rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
        >
          Run Optimization
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              result.best
                ? "bg-status-activeBg border-status-activeBorder"
                : "bg-status-holdBg border-status-holdBorder"
            }`}
          >
            <p className={`text-xs leading-relaxed ${result.best ? "text-status-activeText" : "text-status-holdText"}`}>
              {result.message}
            </p>
          </div>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted">
              Candidates evaluated: <span className="text-text-secondary">{result.candidatesEvaluated}</span> · Feasible:{" "}
              <span className="text-text-secondary">{result.feasibleCandidatesFound}</span>
            </p>
          </div>

          {result.best && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
              <p className="text-xs text-text-muted font-medium mb-1">Best Candidate</p>
              {Object.entries(result.best.variableValues).map(([k, v]) => (
                <p key={k} className="text-xs text-text-secondary">
                  {k}: {fmt(v, 1)}
                </p>
              ))}
              <p className="text-xs text-text-secondary">Concrete volume: {fmt(result.best.concreteVolumeM3, 3)} m³</p>
              <p className="text-xs text-text-secondary">Status: {result.best.overallStatus}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
