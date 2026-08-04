"use client";

import { useMemo, useState } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { computeTorsionCheck, type TorsionDirection } from "@/lib/analysis/torsionCheck";
import type { AnalysisNode } from "@/lib/analysis/runAnalysis";

interface TorsionCheckPanelProps {
  nodes: AnalysisNode[];
  displacements: { ux: number; uz: number }[];
  /**
   * seismicLoad.ts/windLoad.ts এর storyForces থেকে — দিলে Additional
   * Torsional Moment ও হিসাব হবে। এই অ্যাপে এখনো Seismic/Wind Load
   * Panel এর storyForces কোনো shared store এ থাকে না, তাই caller না
   * দিলে ম্যানুয়াল ইনপুট ফিল্ড দেখানো হয় (ঐচ্ছিক — খালি রাখলেও Ax ও
   * amplified eccentricity দেখা যাবে, শুধু moment বাদ পড়বে)।
   */
  storyShears?: { elevation: number; cumulativeShear: number }[];
}

/**
 * Torsion Check — Accidental Eccentricity + Amplification Factor Ax
 * (Phase 8e)। একটা সফল analysis result এর nodes/displacements নিয়ে
 * BNBC 2020 (ASCE 7-সাদৃশ্যপূর্ণ) পদ্ধতিতে torsional amplification
 * factor ও amplified accidental eccentricity বের করে — চূড়ান্ত
 * ডিজাইনে ইঞ্জিনিয়ারকে এই eccentricity manually প্রয়োগ করে আরেকটা
 * analysis চালাতে হবে (এই অ্যাপে mass-shift-based দ্বিতীয় analysis
 * এখনো automated না, torsionCheck.ts docstring দেখুন)।
 */
export function TorsionCheckPanel({ nodes, displacements, storyShears: storyShearsProp }: TorsionCheckPanelProps) {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const nonBaseStories = useMemo(() => stories.filter((s) => !s.isBaseLevel), [stories]);
  const [direction, setDirection] = useState<TorsionDirection>("X");
  const [manualShears, setManualShears] = useState<Record<string, string>>({});

  const storyShears = useMemo(() => {
    if (storyShearsProp) return storyShearsProp;
    return nonBaseStories
      .map((s) => ({ elevation: s.elevation, cumulativeShear: Number(manualShears[s.storyId] ?? "") }))
      .filter((s) => s.cumulativeShear > 0);
  }, [storyShearsProp, nonBaseStories, manualShears]);

  const result = useMemo(() => {
    if (nodes.length === 0 || displacements.length === 0) return null;
    return computeTorsionCheck({
      nodes,
      displacements,
      stories,
      direction,
      storyShears: storyShears.length > 0 ? storyShears : undefined,
    });
  }, [nodes, displacements, stories, direction, storyShears]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Torsion Check — Accidental Eccentricity</h3>
        <p className="text-xs text-slate-500 mb-2">
          Displacement-based (Option 1) পদ্ধতি — mass-shift ছাড়া বর্তমান analysis result থেকে Ax ও
          amplified eccentricity বের করে। চূড়ান্ত ডিজাইনে এই eccentricity ম্যানুয়ালি প্রয়োগ করে
          আরেকটা analysis চালানো উচিত।
        </p>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Lateral Load Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as TorsionDirection)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            <option value="X">X দিক</option>
            <option value="Z">Z দিক</option>
          </select>
        </div>
      </div>

      {!storyShearsProp && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-1.5">
            প্রতিটা story-র cumulative shear দিন (ঐচ্ছিক — Additional Torsional Moment হিসাব করতে,
            kN এককে)
          </p>
          <div className="space-y-1.5">
            {[...nonBaseStories].reverse().map((story) => (
              <div key={story.storyId} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-28 truncate">{story.name}</span>
                <input
                  type="number"
                  step="any"
                  value={manualShears[story.storyId] ?? ""}
                  onChange={(e) => setManualShears((prev) => ({ ...prev, [story.storyId]: e.target.value }))}
                  className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                  placeholder="kN"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.results.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
          <p className="text-xs text-slate-500 font-medium mb-1.5">Per-Story Torsion</p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {[...result.results].reverse().map((r) => (
              <div key={r.storyId} className="text-xs border-b border-slate-800 pb-1.5 last:border-0">
                <div className="flex justify-between">
                  <span className="text-slate-400">{r.storyName}</span>
                  <span
                    className={
                      r.isExtremeTorsionallyIrregular
                        ? "text-red-400 font-medium"
                        : r.isTorsionallyIrregular
                          ? "text-amber-400 font-medium"
                          : "text-emerald-400"
                    }
                  >
                    ratio {r.ratio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Ax = {r.amplificationFactorAx.toFixed(2)}</span>
                  <span>e = {(r.amplifiedAccidentalEccentricity * 1000).toFixed(0)}mm</span>
                </div>
                {r.additionalTorsionalMomentKNm !== null && (
                  <div className="text-slate-500">Additional Mt = {r.additionalTorsionalMomentKNm.toFixed(2)} kN·m</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.warnings.map((warning, i) => (
        <p key={i} className="text-xs text-amber-400">
          {warning}
        </p>
      ))}

      {!result && (
        <p className="text-xs text-slate-500">Torsion Check চালানোর জন্য একটা সফল Analysis result প্রয়োজন।</p>
      )}
    </div>
  );
}
