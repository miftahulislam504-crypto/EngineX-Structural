"use client";

import { useMemo, useState } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import type { ParsedModalResult, ParsedPushoverResult } from "@/lib/analysis/runAnalysis";
import {
  computeModalParticipation,
  convertCapacityCurveToSpectrum,
  findPerformancePoint,
  PERFORMANCE_LEVEL_DRIFT_LIMITS,
  type PerformanceLevel,
} from "@/lib/analysis/performanceBasedDesign";
import { buildBnbc2020DemandSpectrum } from "@/lib/analysis/bnbc2020DemandSpectrum";
import type { SeismicZone, SiteClass } from "@/lib/loads/seismicLoad";

interface PerformanceBasedDesignPanelProps {
  modalResult: ParsedModalResult;
  pushoverResult: ParsedPushoverResult;
  seismicZone: SeismicZone;
  siteClass: SiteClass;
}

const PERFORMANCE_LEVEL_LABEL: Record<PerformanceLevel, string> = {
  "immediate-occupancy": "Immediate Occupancy (IO)",
  "life-safety": "Life Safety (LS)",
  "collapse-prevention": "Collapse Prevention (CP)",
  "beyond-collapse-prevention": "Beyond Collapse Prevention — বিপজ্জনক",
};

const PERFORMANCE_LEVEL_STYLE: Record<PerformanceLevel, string> = {
  "immediate-occupancy": "text-emerald-400",
  "life-safety": "text-amber-400",
  "collapse-prevention": "text-orange-400",
  "beyond-collapse-prevention": "text-red-400",
};

/**
 * Performance-Based Design layer (Phase 8f) — একটা সম্পূর্ণ Modal
 * result (mode 1 shape) ও একটা সম্পূর্ণ Pushover result (capacity
 * curve) একসাথে নিয়ে ATC-40 Capacity Spectrum Method দিয়ে Performance
 * Point বের করে, তারপর FEMA 356 performance level এ classify করে।
 *
 * এই panel এর জন্য দুইটা আলাদা analysis (Modal ও Pushover, একই মডেলে)
 * আগে থেকে চালানো থাকতে হবে — AnalysisPanel প্রতিটা analysis type এর
 * ফলাফল আলাদাভাবে state এ রাখে, তাই একসাথে দুইটাই available থাকতে
 * পারে result switch করার পরেও।
 */
export function PerformanceBasedDesignPanel({
  modalResult,
  pushoverResult,
  seismicZone,
  siteClass,
}: PerformanceBasedDesignPanelProps) {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const [direction, setDirection] = useState<"X" | "Z">("X");
  const [totalSeismicWeightKN, setTotalSeismicWeightKN] = useState("5000");
  const [buildingHeight, setBuildingHeight] = useState("20");

  const participation = useMemo(() => {
    if (!modalResult.success || !modalResult.modes || modalResult.modes.length === 0 || !modalResult.nodes) {
      return null;
    }
    const W = Number(totalSeismicWeightKN);
    if (!W || W <= 0) return null;
    return computeModalParticipation({
      nodes: modalResult.nodes,
      mode1: modalResult.modes[0],
      stories,
      totalSeismicWeightKN: W,
      direction,
    });
  }, [modalResult, stories, totalSeismicWeightKN, direction]);

  const capacitySpectrum = useMemo(() => {
    if (!participation || !pushoverResult.success || !pushoverResult.capacityCurve) return [];
    const W = Number(totalSeismicWeightKN);
    if (!W || W <= 0) return [];
    return convertCapacityCurveToSpectrum(pushoverResult.capacityCurve, W, participation);
  }, [participation, pushoverResult, totalSeismicWeightKN]);

  const demandSpectrum = useMemo(() => buildBnbc2020DemandSpectrum(seismicZone, siteClass), [seismicZone, siteClass]);

  const performancePointResult = useMemo(() => {
    const h = Number(buildingHeight);
    if (!h || h <= 0 || capacitySpectrum.length === 0) return null;
    return findPerformancePoint(capacitySpectrum, demandSpectrum, h);
  }, [capacitySpectrum, demandSpectrum, buildingHeight]);

  if (!modalResult.success || !pushoverResult.success) {
    return (
      <p className="text-xs text-slate-500">
        Performance-Based Design এর জন্য একটা সফল Modal result ও একটা সফল Pushover result — দুটোই
        দরকার।
      </p>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-3 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">
          Performance-Based Design — ATC-40 / FEMA 356
        </h3>
        <p className="text-xs text-slate-500">
          Pushover capacity curve কে Modal mode 1 দিয়ে Sa-Sd spectrum-এ রূপান্তর করে BNBC 2020
          demand spectrum-এর সাথে ছেদবিন্দু (সরলীকৃত পদ্ধতি) বের করে।
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Push Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "X" | "Z")}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            <option value="X">X</option>
            <option value="Z">Z</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Total Weight (kN)</label>
          <input
            type="number"
            step="any"
            value={totalSeismicWeightKN}
            onChange={(e) => setTotalSeismicWeightKN(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Height (m)</label>
          <input
            type="number"
            step="any"
            value={buildingHeight}
            onChange={(e) => setBuildingHeight(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
      </div>

      {participation && (
        <div className="text-xs text-slate-500 flex gap-4">
          <span>PF1 = {participation.participationFactorPF1.toFixed(3)}</span>
          <span>α1 = {participation.modalMassCoefficientAlpha1.toFixed(3)}</span>
        </div>
      )}

      {performancePointResult?.found && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Performance Point</span>
            <span className="text-slate-300 font-mono">
              Sd={performancePointResult.performancePoint?.spectralDisplacementM.toFixed(4)}m, Sa=
              {performancePointResult.performancePoint?.spectralAccelerationG.toFixed(3)}g
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Roof Displacement</span>
            <span className="text-slate-300 font-mono">
              {((performancePointResult.roofDisplacementM ?? 0) * 1000).toFixed(1)} mm
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Governing Drift Ratio</span>
            <span className="text-slate-300 font-mono">
              {((performancePointResult.governingDriftRatio ?? 0) * 100).toFixed(2)}%
            </span>
          </div>
          {performancePointResult.performanceLevel && (
            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-800">
              <span className="text-slate-500">Performance Level</span>
              <span className={`font-semibold ${PERFORMANCE_LEVEL_STYLE[performancePointResult.performanceLevel]}`}>
                {PERFORMANCE_LEVEL_LABEL[performancePointResult.performanceLevel]}
              </span>
            </div>
          )}
          <p className="text-xs text-slate-600 pt-1">
            সীমা (FEMA 356, RC Frame): IO ≤{" "}
            {(PERFORMANCE_LEVEL_DRIFT_LIMITS["immediate-occupancy"] * 100).toFixed(0)}%, LS ≤{" "}
            {(PERFORMANCE_LEVEL_DRIFT_LIMITS["life-safety"] * 100).toFixed(0)}%, CP ≤{" "}
            {(PERFORMANCE_LEVEL_DRIFT_LIMITS["collapse-prevention"] * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {(participation?.warnings ?? []).map((warning, i) => (
        <p key={`p-${i}`} className="text-xs text-amber-400">
          {warning}
        </p>
      ))}
      {(performancePointResult?.warnings ?? []).map((warning, i) => (
        <p key={`pp-${i}`} className="text-xs text-amber-400">
          {warning}
        </p>
      ))}
    </div>
  );
}
