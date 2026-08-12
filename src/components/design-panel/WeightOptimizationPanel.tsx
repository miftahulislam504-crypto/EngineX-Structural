"use client";

import { useMemo } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { computeWeightTakeoff } from "@/lib/design/weightOptimization";
import type { ElementCategory } from "@/lib/types/element";

const CATEGORY_LABELS: Record<ElementCategory, string> = {
  beam: "Beam",
  column: "Column",
  brace: "Brace",
  pile: "Pile",
  slab: "Slab",
  wall: "Wall",
  "shear-wall": "Shear Wall",
  "core-wall": "Core Wall",
  footing: "Footing",
  "combined-footing": "Combined Footing",
  "strip-footing": "Strip Footing",
  "mat-foundation": "Mat Foundation",
  "pile-group": "Pile Group",
  "pile-cap": "Pile Cap",
};

function fmt(v: number, decimals = 2): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 9c — Weight Optimization panel। 9a/9b এর মতো standalone
 * calculator না — এটা লাইভ model (useElementsStore + useLibraryStore)
 * থেকে সরাসরি একটা structure-wide material takeoff তৈরি করে। কোনো
 * search/candidate sweep নেই — শুধু deterministic quantity summary,
 * যা 9d Cost Optimization-এর ইনপুট হিসেবে ব্যবহৃত হবে।
 */
export function WeightOptimizationPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);

  const result = useMemo(() => computeWeightTakeoff(elements, materials, sections), [elements, materials, sections]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Weight Optimization — Material Takeoff</h3>
        <p className="text-xs text-text-muted mb-3">
          বর্তমান মডেলের সব element থেকে সরাসরি structure-wide concrete/steel self-weight takeoff — কোনো candidate
          sweep না, শুধু live geometry × material unit weight থেকে deterministic হিসাব।
        </p>
      </div>

      <div
        className={`rounded-md border px-3 py-2.5 ${
          result.categorySummaries.length > 0 ? "bg-status-activeBg border-status-activeBorder" : "bg-status-holdBg border-status-holdBorder"
        }`}
      >
        <p className={`text-xs leading-relaxed ${result.categorySummaries.length > 0 ? "text-status-activeText" : "text-status-holdText"}`}>
          {result.message}
        </p>
      </div>

      {result.categorySummaries.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border text-text-muted">
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Material</th>
                <th className="text-right px-3 py-2 font-medium">Count</th>
                <th className="text-right px-3 py-2 font-medium">Volume (m³)</th>
                <th className="text-right px-3 py-2 font-medium">Weight (kN)</th>
              </tr>
            </thead>
            <tbody>
              {result.categorySummaries.map((c) => (
                <tr key={`${c.category}::${c.materialType}`} className="border-b border-surface-border last:border-0">
                  <td className="px-3 py-1.5 text-text-secondary">{CATEGORY_LABELS[c.category]}</td>
                  <td className="px-3 py-1.5 text-text-muted capitalize">{c.materialType}</td>
                  <td className="px-3 py-1.5 text-right text-text-secondary">{c.elementCount}</td>
                  <td className="px-3 py-1.5 text-right text-text-secondary">{fmt(c.totalVolumeM3, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-text-secondary">{fmt(c.totalWeightKN, 1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-border font-medium">
                <td className="px-3 py-2 text-text-primary">Total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-text-primary">{fmt(result.totalVolumeM3, 3)}</td>
                <td className="px-3 py-2 text-right text-text-primary">{fmt(result.totalWeightKN, 1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {result.excluded.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium mb-1">Excluded from Takeoff ({result.excluded.length})</p>
          {result.excluded.map((e) => (
            <div key={e.elementId} className="text-xs">
              <span className="text-text-secondary">
                {CATEGORY_LABELS[e.category]} &quot;{e.elementLabel}&quot;
              </span>
              <span className="text-text-muted"> — {e.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
