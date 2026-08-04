"use client";

import { useMemo, useState } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { computeIrregularityCheck, type IrregularityStatus } from "@/lib/analysis/irregularityCheck";
import { computeStoryDriftCheck } from "@/lib/analysis/storyDrift";
import type { AnalysisNode } from "@/lib/analysis/runAnalysis";

interface IrregularityCheckPanelProps {
  nodes: AnalysisNode[];
  displacements: { ux: number; uz: number }[];
  /** true হলে (RSA থেকে) সাথে সংশ্লিষ্ট drift ও তার উপর ভিত্তি করে stiffness/torsion classification অনির্ভরযোগ্য হতে পারে — একটা warning দেখানো হবে। */
  displacementIsMagnitudeOnly?: boolean;
  /**
   * seismicLoad.ts/windLoad.ts এর storyForces থেকে (elevation +
   * cumulativeShear)। এই অ্যাপে এখনো Seismic/Wind Load Panel এর
   * হিসাব করা storyForces কোনো shared store এ থাকে না (প্রতিটা panel
   * এর নিজস্ব local state), তাই caller না দিলে এই panel নিজেই
   * ব্যবহারকারীকে প্রতিটা story-র shear ম্যানুয়ালি দিতে বলে (Seismic
   * Load Panel বা Wind Load Panel এর Story Force Distribution
   * টেবিল থেকে কপি করে)।
   */
  storyShears?: { elevation: number; cumulativeShear: number }[];
}

const STATUS_STYLE: Record<IrregularityStatus, string> = {
  regular: "text-emerald-400",
  irregular: "text-amber-400",
  "extreme-irregular": "text-red-400",
  "not-computable": "text-slate-500",
};

const STATUS_LABEL: Record<IrregularityStatus, string> = {
  regular: "Regular",
  irregular: "Irregular",
  "extreme-irregular": "Extreme Irregular",
  "not-computable": "N/A",
};

/**
 * Irregularity Check + Soft Story Detection (Phase 8d) — একটা সফল
 * analysis result-এর nodes/displacements ও প্রতিটা story-র shear
 * (seismicLoad.ts/windLoad.ts এর storyForces, অথবা ম্যানুয়াল ইনপুট)
 * নিয়ে BNBC 2020 Sec 2.5.5 এর বিপরীতে যাচাই করে। Story Drift Check
 * এর ফলাফল এই panel নিজেই আভ্যন্তরীণভাবে (internally) হিসাব করে নেয়
 * (storyDrift.ts, seismic period ধরে নেওয়া হয় 0.5s — শুধু stiffness/
 * torsion classification এর জন্য ব্যবহৃত, drift limit pass/fail এর
 * জন্য না, তাই এই period assumption ভুল হলেও Irregularity ফলাফল
 * প্রভাবিত হয় না)।
 */
export function IrregularityCheckPanel({
  nodes,
  displacements,
  displacementIsMagnitudeOnly,
  storyShears: storyShearsProp,
}: IrregularityCheckPanelProps) {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const nonBaseStories = useMemo(() => stories.filter((s) => !s.isBaseLevel), [stories]);
  const [manualShears, setManualShears] = useState<Record<string, string>>({});

  const storyShears = useMemo(() => {
    if (storyShearsProp) return storyShearsProp;
    return nonBaseStories
      .map((s) => ({ elevation: s.elevation, cumulativeShear: Number(manualShears[s.storyId] ?? "") }))
      .filter((s) => s.cumulativeShear > 0);
  }, [storyShearsProp, nonBaseStories, manualShears]);

  const driftResults = useMemo(() => {
    if (nodes.length === 0 || displacements.length === 0) return [];
    // period=0.5s একটা mid-range assumption — এই মডিউলে drift limit
    // pass/fail না, শুধু approximate stiffness (V/Δ) বের করার জন্য
    // ব্যবহার হচ্ছে, যেখানে period এর প্রভাব নেই (allowableDriftRatio
    // এখানে ব্যবহৃত হয় না)।
    return computeStoryDriftCheck({
      nodes,
      displacements,
      stories,
      loadCategory: "seismic",
      fundamentalPeriodSeconds: 0.5,
      displacementIsMagnitudeOnly,
    }).results;
  }, [nodes, displacements, stories, displacementIsMagnitudeOnly]);

  const result = useMemo(() => {
    if (nodes.length === 0 || displacements.length === 0 || driftResults.length === 0) return null;
    if (storyShears.length === 0) return null;
    return computeIrregularityCheck({ nodes, displacements, stories, driftResults, storyShears });
  }, [nodes, displacements, stories, driftResults, storyShears]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Irregularity Check — BNBC 2020</h3>
        {result && (
          <p className="text-xs text-slate-500">
            সামগ্রিক ফলাফল:{" "}
            <span
              className={
                result.hasAnyIrregularity ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"
              }
            >
              {result.hasAnyIrregularity ? "এক বা একাধিক Irregularity পাওয়া গেছে" : "কোনো Irregularity নেই"}
            </span>
          </p>
        )}
      </div>

      {!storyShearsProp && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-1.5">
            প্রতিটা story-র cumulative shear দিন (Seismic বা Wind Load Panel এর Story Force
            Distribution টেবিল থেকে, kN এককে)
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

      {!result && (
        <p className="text-xs text-slate-500">
          Irregularity Check চালানোর জন্য একটা সফল Analysis result, Story Drift Check ফলাফল, ও
          প্রতিটা story-র shear প্রয়োজন।
        </p>
      )}

      {result && (
        <>
          {result.stiffnessIrregularity.length > 0 && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-500 font-medium mb-1.5">
                Stiffness Irregularity (Soft/Extreme Soft Storey) — approximate
              </p>
              <div className="space-y-1">
                {[...result.stiffnessIrregularity].reverse().map((r) => (
                  <div key={r.storyId} className="flex justify-between text-xs px-1">
                    <span className="text-slate-400">{r.storyName}</span>
                    <span className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.weakStorey.length > 0 && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-500 font-medium mb-1.5">Weak Storey (strength proxy — shear-based)</p>
              <div className="space-y-1">
                {[...result.weakStorey].reverse().map((r) => (
                  <div key={r.storyId} className="flex justify-between text-xs px-1">
                    <span className="text-slate-400">{r.storyName}</span>
                    <span className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.geometricIrregularity.length > 0 && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-500 font-medium mb-1.5">Vertical Geometric Irregularity</p>
              <div className="space-y-1">
                {[...result.geometricIrregularity].reverse().map((r) => (
                  <div key={r.storyId} className="flex justify-between text-xs px-1">
                    <span className="text-slate-400">{r.storyName}</span>
                    <span className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.torsionalIrregularity.length > 0 && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-500 font-medium mb-1.5">Torsional Irregularity (Plan)</p>
              <div className="space-y-1">
                {[...result.torsionalIrregularity].reverse().map((r) => (
                  <div key={r.storyId} className="flex justify-between text-xs px-1">
                    <span className="text-slate-400">
                      {r.storyName} (ratio {r.ratio.toFixed(2)})
                    </span>
                    <span className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
            <p className="text-xs text-slate-500 font-medium mb-1">Mass Irregularity</p>
            <p className="text-xs text-slate-500">{result.massIrregularity.reason}</p>
          </div>

          {result.warnings.map((warning, i) => (
            <p key={i} className="text-xs text-amber-400">
              {warning}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
