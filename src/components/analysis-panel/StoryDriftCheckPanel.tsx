"use client";

import { useMemo, useState } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { computeStoryDriftCheck, type DriftCheckLoadCategory, type MasonryType } from "@/lib/analysis/storyDrift";
import type { AnalysisNode } from "@/lib/analysis/runAnalysis";

interface StoryDriftCheckPanelProps {
  nodes: AnalysisNode[];
  /** নির্দিষ্ট analysis result এর nodalDisplacements — ux/uz প্রয়োজন (rx/ry/rz/uy অগ্রাহ্য করা হয়, drift শুধু horizontal)। */
  displacements: { ux: number; uz: number }[];
  /** RSA থেকে এলে true পাস করুন (ParsedResponseSpectrumResult.displacementIsMagnitudeOnly) — panel একটা উচ্চ-দৃশ্যমানতার সতর্কতা দেখাবে। */
  displacementIsMagnitudeOnly?: boolean;
  /** seismicLoad.ts এর computeSeismicLoad().fundamentalPeriod থেকে, অথবা wind এর জন্য একটা estimate — ব্যবহারকারী ম্যানুয়ালি input করতে পারেন যদি সরাসরি না থাকে। */
  defaultFundamentalPeriodSeconds?: number;
}

/**
 * Story Drift Check (Phase 8c) — যেকোনো সম্পূর্ণ analysis result
 * (Linear Static, RSA, Nonlinear Static, P-Delta, Pushover) এর node +
 * displacement দিয়ে BNBC 2020 drift limit এর বিপরীতে যাচাই করে। এই
 * panel নিজে কোনো analysis চালায় না — AnalysisPanel (বা অন্য কোনো
 * result-দেখানোর জায়গা) থেকে সফল result এর nodes/nodalDisplacements
 * props হিসেবে পাস করা হয়।
 */
export function StoryDriftCheckPanel({
  nodes,
  displacements,
  displacementIsMagnitudeOnly,
  defaultFundamentalPeriodSeconds,
}: StoryDriftCheckPanelProps) {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const [loadCategory, setLoadCategory] = useState<DriftCheckLoadCategory>("seismic");
  const [masonryType, setMasonryType] = useState<MasonryType>("none");
  const [fundamentalPeriodInput, setFundamentalPeriodInput] = useState(
    defaultFundamentalPeriodSeconds !== undefined ? String(defaultFundamentalPeriodSeconds) : "0.5"
  );

  const result = useMemo(() => {
    const T = Number(fundamentalPeriodInput);
    if (!T || T <= 0) return null;
    if (nodes.length === 0 || displacements.length === 0) return null;

    return computeStoryDriftCheck({
      nodes,
      displacements,
      stories,
      loadCategory,
      fundamentalPeriodSeconds: T,
      masonryType,
      displacementIsMagnitudeOnly,
    });
  }, [nodes, displacements, stories, loadCategory, fundamentalPeriodInput, masonryType, displacementIsMagnitudeOnly]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Story Drift Check — BNBC 2020</h3>
        <p className="text-xs text-text-muted mb-3">
          Inter-story drift এর সাথে BNBC 2020 এর period-based allowable limit তুলনা করে। চূড়ান্ত
          ডিজাইনে occupancy-category-specific সীমা একজন ইঞ্জিনিয়ারের যাচাই করা উচিত।
        </p>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Load Category</label>
              <select
                value={loadCategory}
                onChange={(e) => setLoadCategory(e.target.value as DriftCheckLoadCategory)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="seismic">Seismic</option>
                <option value="non-seismic">Non-Seismic (Wind ইত্যাদি)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Fundamental Period T (sec)</label>
              <input
                type="number"
                step="any"
                value={fundamentalPeriodInput}
                onChange={(e) => setFundamentalPeriodInput(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {loadCategory === "non-seismic" && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Masonry Type</label>
              <select
                value={masonryType}
                onChange={(e) => setMasonryType(e.target.value as MasonryType)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="none">নেই / সাধারণ</option>
                <option value="unreinforced-masonry">Unreinforced Masonry</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-secondary">
            Overall:{" "}
            <span className={result.overallPass ? "text-status-activeText font-semibold" : "text-red-600 font-semibold"}>
              {result.overallPass ? "PASS" : "FAIL"}
            </span>
          </p>

          {result.results.length > 0 && (
            <div className="pt-1.5 border-t border-surface-border">
              <p className="text-xs text-text-muted mb-1">Per-Story Drift</p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {[...result.results].reverse().map((r) => (
                  <div
                    key={r.storyId}
                    className={`flex justify-between text-xs px-1 ${
                      r.isWithinLimit ? "text-text-secondary" : "text-red-600 font-medium"
                    }`}
                  >
                    <span>{r.storyName}</span>
                    <span>
                      {(r.driftRatio * 100).toFixed(3)}% / {(r.allowableDriftRatio * 100).toFixed(2)}% (
                      {(r.utilizationRatio * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings.map((warning, i) => (
            <p key={i} className="text-xs text-status-holdText pt-1 border-t border-surface-border mt-1.5">
              {warning}
            </p>
          ))}
        </div>
      )}

      {!result && (
        <p className="text-xs text-text-muted">
          Drift Check চালানোর জন্য একটা সফল Analysis result (nodes + displacements) ও একটা valid
          Fundamental Period প্রয়োজন।
        </p>
      )}
    </div>
  );
}
