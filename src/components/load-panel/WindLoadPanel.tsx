"use client";

import { useState, useMemo } from "react";
import type { WindLoadInput } from "@/lib/loads/windLoad";
import { computeWindLoad } from "@/lib/loads/windLoad";

/**
 * BNBC 2020 Wind Load calculator। এই প্যানেল কোনো Firestore ডেটা
 * সেভ করে না — এটা একটা calculation tool, ইঞ্জিনিয়ারকে দ্রুত একটা
 * design wind pressure পেতে সাহায্য করে যা পরে ম্যানুয়ালি Load
 * Pattern/Case এ ব্যবহার করা যায়। (ভবিষ্যতে "Apply to elements"
 * ফিচার যোগ হতে পারে যা সরাসরি সব windward-facing element এ uniform
 * load বসিয়ে দেবে, কিন্তু সেটা element-orientation detection দাবি
 * করে যা এখনো নেই — তাই v1 তে শুধু calculator, manual application।)
 */
export function WindLoadPanel() {
  const [basicWindSpeed, setBasicWindSpeed] = useState("50");
  const [exposureCategory, setExposureCategory] = useState<WindLoadInput["exposureCategory"]>("B");
  const [buildingHeight, setBuildingHeight] = useState("20");
  const [buildingWidth, setBuildingWidth] = useState("15");
  const [importanceFactor, setImportanceFactor] = useState("1.0");
  const [structureType, setStructureType] = useState<WindLoadInput["structureType"]>("rigid");
  const [numberOfStories, setNumberOfStories] = useState("6");

  const result = useMemo(() => {
    const V = Number(basicWindSpeed);
    const h = Number(buildingHeight);
    const w = Number(buildingWidth);
    const I = Number(importanceFactor);
    const n = Number(numberOfStories);

    if (!V || !h || !w || !I || !n || V <= 0 || h <= 0 || w <= 0 || I <= 0 || n <= 0) {
      return null;
    }

    return computeWindLoad({
      basicWindSpeed: V,
      exposureCategory,
      buildingHeight: h,
      buildingWidth: w,
      importanceFactor: I,
      structureType,
      numberOfStories: n,
    });
  }, [basicWindSpeed, exposureCategory, buildingHeight, buildingWidth, importanceFactor, structureType, numberOfStories]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Wind Load — BNBC 2020 ELF</h3>
        <p className="text-xs text-text-muted mb-3">
          সরলীকৃত পদ্ধতি — rigid, নিয়মিত আকৃতির ভবনের preliminary design এর জন্য। চূড়ান্ত
          ডিজাইনে পূর্ণাঙ্গ BNBC 2020 Chapter 2 যাচাই করুন।
        </p>

        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-text-muted mb-1">Basic Wind Speed V (m/s)</label>
            <input
              type="number"
              value={basicWindSpeed}
              onChange={(e) => setBasicWindSpeed(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Exposure Category</label>
            <select
              value={exposureCategory}
              onChange={(e) =>
                setExposureCategory(e.target.value as WindLoadInput["exposureCategory"])
              }
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="A">A — বড় শহরের কেন্দ্র</option>
              <option value="B">B — শহুরে/উপশহুরে</option>
              <option value="C">C — খোলা এলাকা</option>
              <option value="D">D — উপকূলীয়/জলাশয়ের ধারে</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Building Height (m)</label>
              <input
                type="number"
                value={buildingHeight}
                onChange={(e) => setBuildingHeight(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Building Width (m)</label>
              <input
                type="number"
                value={buildingWidth}
                onChange={(e) => setBuildingWidth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Importance Factor</label>
              <input
                type="number"
                step="any"
                value={importanceFactor}
                onChange={(e) => setImportanceFactor(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Structure Type</label>
              <select
                value={structureType}
                onChange={(e) => setStructureType(e.target.value as WindLoadInput["structureType"])}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="rigid">Rigid</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Number of Stories</label>
            <input
              type="number"
              value={numberOfStories}
              onChange={(e) => setNumberOfStories(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-secondary">
            Velocity Pressure q<sub>z</sub>:{" "}
            <span className="text-text-primary font-medium">{result.velocityPressure.toFixed(3)} kN/m²</span>
          </p>
          <p className="text-xs text-text-secondary">
            Gust Effect Factor G:{" "}
            <span className="text-text-primary font-medium">{result.gustEffectFactor.toFixed(2)}</span>
          </p>
          <p className="text-xs text-text-secondary">
            Design Wind Pressure p:{" "}
            <span className="text-brand-700 font-semibold">
              {result.designWindPressure.toFixed(3)} kN/m²
            </span>
          </p>
          <p className="text-xs text-text-secondary">
            Total Base Shear (estimate):{" "}
            <span className="text-brand-700 font-semibold">
              {result.totalBaseShearEstimate.toFixed(1)} kN
            </span>
          </p>

          {result.storyForces.length > 0 && (
            <div className="pt-1.5 border-t border-surface-border">
              <p className="text-xs text-text-muted mb-1">Story Force Distribution (Windward)</p>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {[...result.storyForces].reverse().map((sf) => (
                  <div
                    key={sf.storyIndex}
                    className="flex justify-between text-xs text-text-secondary px-1"
                  >
                    <span>Story {sf.storyIndex}</span>
                    <span>{sf.force.toFixed(1)} kN</span>
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
    </div>
  );
}
