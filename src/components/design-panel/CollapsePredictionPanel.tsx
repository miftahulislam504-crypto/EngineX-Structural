"use client";

import { useState } from "react";
import {
  runCollapsePrediction,
  COLLAPSE_PREDICTION_TEMPLATE,
  type CollapsePredictionResult,
} from "@/lib/analysis/collapsePrediction";

const LOCATION_LABELS: Record<string, string> = {
  "corner-column": "Corner Column",
  "exterior-column": "Exterior Column",
  "interior-column": "Interior Column",
  "load-bearing-wall": "Load-Bearing Wall",
};

/**
 * Phase 8h — Collapse Prediction (Progressive Collapse) panel। Master
 * plan অনুযায়ী এই ধাপে শুধু framework আশা করা হয়েছে — পূর্ণাঙ্গ
 * element-removal alternate-path analysis Phase 11 (Simulation) এ
 * implement হবে। FoundationOptimizationPanel.tsx (Phase 7f) এর একই
 * honest-placeholder প্যাটার্ন অনুসরণ করে — কোনো fake ফলাফল দেখানো
 * হয় না, শুধু GSA 2016/UFC 4-023-03 এর scenario shape preview করা যায়।
 */
export function CollapsePredictionPanel() {
  const [result, setResult] = useState<CollapsePredictionResult | null>(null);

  function handlePreview() {
    setResult(runCollapsePrediction(COLLAPSE_PREDICTION_TEMPLATE));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Collapse Prediction (Progressive Collapse)</h3>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-3">
          Not yet implemented. This is a Phase 8h framework placeholder for the GSA 2016 / UFC 4-023-03 Alternate
          Path Method (notional element removal + Dynamic Increase Factor + per-member DCR checks). Full
          implementation is deferred to Phase 11 (Simulation) — this app currently has no element-removal
          re-analysis workflow. In the meantime, manually simulate column loss by deleting the element in a copy
          of the model and re-running Nonlinear Static / Pushover.
        </p>

        <button
          type="button"
          onClick={handlePreview}
          className="w-full rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
        >
          Preview Alternate Path Scenario Set
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
            <p className="text-xs text-text-secondary leading-relaxed">{result.message}</p>
          </div>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted font-medium mb-1">
              Dynamic Increase Factor (assumption)
            </p>
            <p className="text-xs text-text-secondary">{result.problem.dynamicIncreaseFactorAssumption.toFixed(1)}×</p>
          </div>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
            <p className="text-xs text-text-muted font-medium mb-1">Example Scenarios (GSA 2016)</p>
            {result.problem.scenarios.map((s, i) => (
              <div key={i} className="text-xs text-text-secondary leading-relaxed">
                <span className="text-text-secondary font-medium">
                  {LOCATION_LABELS[s.location] ?? s.location} — {s.storyLevel}:
                </span>{" "}
                {s.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
