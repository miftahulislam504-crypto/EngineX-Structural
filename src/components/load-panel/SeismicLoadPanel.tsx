"use client";

import { useState, useMemo } from "react";
import type {
  SeismicLoadInput,
  SeismicZone,
  SiteClass,
  StructuralSystem,
  OccupancyCategory,
} from "@/lib/loads/seismicLoad";
import { computeSeismicLoad } from "@/lib/loads/seismicLoad";

export function SeismicLoadPanel() {
  const [seismicZone, setSeismicZone] = useState<SeismicZone>("2");
  const [siteClass, setSiteClass] = useState<SiteClass>("SC");
  const [structuralSystem, setStructuralSystem] = useState<StructuralSystem>(
    "moment-frame-concrete"
  );
  const [occupancyCategory, setOccupancyCategory] = useState<OccupancyCategory>("II");
  const [buildingHeight, setBuildingHeight] = useState("20");
  const [seismicWeight, setSeismicWeight] = useState("30000");
  const [numberOfStories, setNumberOfStories] = useState("6");

  const result = useMemo(() => {
    const h = Number(buildingHeight);
    const W = Number(seismicWeight);
    const n = Number(numberOfStories);

    if (!h || !W || !n || h <= 0 || W <= 0 || n <= 0 || !Number.isInteger(n)) {
      return null;
    }

    const input: SeismicLoadInput = {
      seismicZone,
      siteClass,
      structuralSystem,
      occupancyCategory,
      buildingHeight: h,
      seismicWeight: W,
      numberOfStories: n,
    };

    return computeSeismicLoad(input);
  }, [
    seismicZone,
    siteClass,
    structuralSystem,
    occupancyCategory,
    buildingHeight,
    seismicWeight,
    numberOfStories,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">
          Earthquake Load — BNBC 2020 ELF
        </h3>
        <p className="text-xs text-text-muted mb-3">
          Equivalent Lateral Force পদ্ধতি — নিয়মিত, নির্দিষ্ট উচ্চতার নিচের ভবনের জন্য।
          Irregular/উঁচু ভবনে Dynamic Analysis প্রয়োজন হতে পারে।
        </p>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Seismic Zone</label>
              <select
                value={seismicZone}
                onChange={(e) => setSeismicZone(e.target.value as SeismicZone)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="1">Zone 1</option>
                <option value="2">Zone 2</option>
                <option value="3">Zone 3</option>
                <option value="4">Zone 4</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Site Class</label>
              <select
                value={siteClass}
                onChange={(e) => setSiteClass(e.target.value as SiteClass)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="SA">SA — Rock</option>
                <option value="SB">SB</option>
                <option value="SC">SC</option>
                <option value="SD">SD</option>
                <option value="SE">SE — Soft Soil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Structural System</label>
            <select
              value={structuralSystem}
              onChange={(e) => setStructuralSystem(e.target.value as StructuralSystem)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="moment-frame-concrete">RC Moment Frame</option>
              <option value="moment-frame-steel">Steel Moment Frame</option>
              <option value="shear-wall-concrete">RC Shear Wall</option>
              <option value="dual-system">Dual System</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Occupancy Category</label>
            <select
              value={occupancyCategory}
              onChange={(e) => setOccupancyCategory(e.target.value as OccupancyCategory)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="I">I</option>
              <option value="II">II — সাধারণ ভবন</option>
              <option value="III">III</option>
              <option value="IV">IV — জরুরি সেবা</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Height (m)</label>
              <input
                type="number"
                value={buildingHeight}
                onChange={(e) => setBuildingHeight(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Stories</label>
              <input
                type="number"
                value={numberOfStories}
                onChange={(e) => setNumberOfStories(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Seismic Weight (kN)</label>
              <input
                type="number"
                value={seismicWeight}
                onChange={(e) => setSeismicWeight(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-secondary">
            Fundamental Period T:{" "}
            <span className="text-text-primary font-medium">{result.fundamentalPeriod.toFixed(3)} sec</span>
          </p>
          <p className="text-xs text-text-secondary">
            Seismic Response Coefficient C<sub>s</sub>:{" "}
            <span className="text-text-primary font-medium">
              {result.seismicResponseCoefficient.toFixed(4)}
            </span>
          </p>
          <p className="text-xs text-text-secondary">
            Base Shear V:{" "}
            <span className="text-brand-700 font-semibold">{result.baseShear.toFixed(1)} kN</span>
          </p>

          <div className="pt-1.5 border-t border-surface-border">
            <p className="text-xs text-text-muted mb-1">Story Force Distribution</p>
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
