"use client";

import { useState } from "react";
import {
  runBaseIsolationDesign,
  runEnergyDissipationDesign,
  BASE_ISOLATION_TEMPLATE,
  ENERGY_DISSIPATION_TEMPLATE,
  type IsolatorType,
  type DamperType,
  type BaseIsolationResult,
  type EnergyDissipationResult,
} from "@/lib/analysis/baseIsolationEnergyDissipation";

const ISOLATOR_TYPE_LABELS: Record<IsolatorType, string> = {
  "lead-rubber-bearing": "Lead Rubber Bearing (LRB)",
  "high-damping-rubber-bearing": "High Damping Rubber Bearing (HDRB)",
  "friction-pendulum": "Friction Pendulum System (FPS)",
};

const DAMPER_TYPE_LABELS: Record<DamperType, string> = {
  "viscous-damper": "Viscous Damper",
  "friction-damper": "Friction Damper",
  "tuned-mass-damper": "Tuned Mass Damper (TMD)",
  "buckling-restrained-brace": "Buckling-Restrained Brace (BRB)",
};

type Mode = "base-isolation" | "energy-dissipation";

/**
 * Base Isolation + Energy Dissipation (Phase 8g) — framework
 * placeholder, master plan অনুযায়ী। Base Isolation mode এ একটা
 * সত্যিকারের preliminary sizing formula (target period → required
 * effective stiffness, verified SDOF relation) কাজ করে, বাকি সব
 * (design displacement, bearing dimension, damper sizing) এখনো
 * "not yet implemented" — কোনো fake ফলাফল দেখানো হয় না।
 */
export function BaseIsolationEnergyDissipationPanel() {
  const [mode, setMode] = useState<Mode>("base-isolation");

  const [isolatorType, setIsolatorType] = useState<IsolatorType>(BASE_ISOLATION_TEMPLATE.isolatorType);
  const [totalWeight, setTotalWeight] = useState(String(BASE_ISOLATION_TEMPLATE.totalSeismicWeightKN));
  const [targetPeriod, setTargetPeriod] = useState(String(BASE_ISOLATION_TEMPLATE.targetIsolationPeriodSeconds));
  const [numIsolators, setNumIsolators] = useState(String(BASE_ISOLATION_TEMPLATE.numberOfIsolators));
  const [isolationResult, setIsolationResult] = useState<BaseIsolationResult | null>(null);

  const [damperType, setDamperType] = useState<DamperType>(ENERGY_DISSIPATION_TEMPLATE.damperType);
  const [targetDamping, setTargetDamping] = useState(String(ENERGY_DISSIPATION_TEMPLATE.targetAdditionalDampingRatio));
  const [numDampers, setNumDampers] = useState(String(ENERGY_DISSIPATION_TEMPLATE.numberOfDampers));
  const [dissipationResult, setDissipationResult] = useState<EnergyDissipationResult | null>(null);

  function handleRunIsolation() {
    setIsolationResult(
      runBaseIsolationDesign({
        isolatorType,
        totalSeismicWeightKN: Number(totalWeight) || 0,
        targetIsolationPeriodSeconds: Number(targetPeriod) || 0,
        numberOfIsolators: Number(numIsolators) || 1,
      })
    );
  }

  function handleRunDissipation() {
    setDissipationResult(
      runEnergyDissipationDesign({
        damperType,
        targetAdditionalDampingRatio: Number(targetDamping) || 0,
        numberOfDampers: Number(numDampers) || 1,
      })
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Base Isolation + Energy Dissipation</h3>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-3">
          Framework placeholder (Phase 8g) — এই অ্যাপের FE solver-এ কোনো isolator/damper element type নেই।
          শুধু Base Isolation-এর required effective stiffness (verified SDOF formula) এখানে হিসাব করা হয়,
          বাকি সব (design displacement, bearing dimension, damper capacity sizing) এখনো implement করা হয়নি।
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("base-isolation")}
            className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
              mode === "base-isolation" ? "bg-brand-600 text-white" : "bg-surface-hover text-text-secondary hover:bg-surface-border"
            }`}
          >
            Base Isolation
          </button>
          <button
            type="button"
            onClick={() => setMode("energy-dissipation")}
            className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
              mode === "energy-dissipation" ? "bg-brand-600 text-white" : "bg-surface-hover text-text-secondary hover:bg-surface-border"
            }`}
          >
            Energy Dissipation
          </button>
        </div>
      </div>

      {mode === "base-isolation" && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-text-muted mb-1">Isolator Type</label>
            <select
              value={isolatorType}
              onChange={(e) => setIsolatorType(e.target.value as IsolatorType)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              {(Object.keys(ISOLATOR_TYPE_LABELS) as IsolatorType[]).map((t) => (
                <option key={t} value={t}>
                  {ISOLATOR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Total Weight (kN)</label>
              <input
                type="number"
                step="any"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Target Period (s)</label>
              <input
                type="number"
                step="any"
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1"># Isolators</label>
              <input
                type="number"
                value={numIsolators}
                onChange={(e) => setNumIsolators(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunIsolation}
            className="w-full rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
          >
            Compute Required Effective Stiffness
          </button>

          {isolationResult && (
            <div className="space-y-2">
              <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
                <p className="text-xs text-text-secondary leading-relaxed">{isolationResult.message}</p>
              </div>
              <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
                <p className="text-xs text-text-muted font-medium mb-1">Result</p>
                <p className="text-xs text-text-secondary">
                  Total Required K_eff:{" "}
                  <span className="font-mono">
                    {isolationResult.requiredEffectiveStiffness.requiredEffectiveStiffnessKNPerM.toFixed(1)} kN/m
                  </span>
                </p>
                <p className="text-xs text-text-secondary">
                  Per Isolator (approx):{" "}
                  <span className="font-mono">
                    {(
                      isolationResult.requiredEffectiveStiffness.requiredEffectiveStiffnessKNPerM /
                      (Number(numIsolators) || 1)
                    ).toFixed(1)}{" "}
                    kN/m
                  </span>
                </p>
                {isolationResult.requiredEffectiveStiffness.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-status-holdText pt-1">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "energy-dissipation" && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-text-muted mb-1">Damper Type</label>
            <select
              value={damperType}
              onChange={(e) => setDamperType(e.target.value as DamperType)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              {(Object.keys(DAMPER_TYPE_LABELS) as DamperType[]).map((t) => (
                <option key={t} value={t}>
                  {DAMPER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Target Additional Damping (ratio)</label>
              <input
                type="number"
                step="any"
                value={targetDamping}
                onChange={(e) => setTargetDamping(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1"># Dampers</label>
              <input
                type="number"
                value={numDampers}
                onChange={(e) => setNumDampers(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunDissipation}
            className="w-full rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
          >
            Preview Problem Definition
          </button>

          {dissipationResult && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
              <p className="text-xs text-text-secondary leading-relaxed">{dissipationResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
