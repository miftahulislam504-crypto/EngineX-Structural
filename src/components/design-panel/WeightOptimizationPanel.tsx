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
        <h3 className="text-sm font-medium text-slate-200 mb-1">Weight Optimization — Material Takeoff</h3>
        <p className="text-xs text-slate-500 mb-3">
          বর্তমান মডেলের সব element থেকে সরাসরি structure-wide concrete/steel self-weight takeoff — কোনো candidate
          sweep না, শুধু live geometry × material unit weight থেকে deterministic হিসাব।
        </p>
      </div>

      <div
        className={`rounded-md border px-3 py-2.5 ${
          result.categorySummaries.length > 0 ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
        }`}
      >
        <p className={`text-xs leading-relaxed ${result.categorySummaries.length > 0 ? "text-emerald-400" : "text-amber-500"}`}>
          {result.message}
        </p>
      </div>

      {result.categorySummaries.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Material</th>
                <th className="text-right px-3 py-2 font-medium">Count</th>
                <th className="text-right px-3 py-2 font-medium">Volume (m³)</th>
                <th className="text-right px-3 py-2 font-medium">Weight (kN)</th>
              </tr>
            </thead>
            <tbody>
              {result.categorySummaries.map((c) => (
                <tr key={`${c.category}::${c.materialType}`} className="border-b border-slate-900 last:border-0">
                  <td className="px-3 py-1.5 text-slate-300">{CATEGORY_LABELS[c.category]}</td>
                  <td className="px-3 py-1.5 text-slate-500 capitalize">{c.materialType}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{c.elementCount}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{fmt(c.totalVolumeM3, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300">{fmt(c.totalWeightKN, 1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-800 font-medium">
                <td className="px-3 py-2 text-slate-200">Total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-slate-200">{fmt(result.totalVolumeM3, 3)}</td>
                <td className="px-3 py-2 text-right text-slate-200">{fmt(result.totalWeightKN, 1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {result.excluded.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-slate-500 font-medium mb-1">Excluded from Takeoff ({result.excluded.length})</p>
          {result.excluded.map((e) => (
            <div key={e.elementId} className="text-xs">
              <span className="text-slate-300">
                {CATEGORY_LABELS[e.category]} &quot;{e.elementLabel}&quot;
              </span>
              <span className="text-slate-500"> — {e.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
