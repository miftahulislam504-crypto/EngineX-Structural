"use client";

import { useMemo } from "react";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import type { DetailingResult, BarScheduleRow } from "@/lib/detailing/types";

interface DetailingPanelProps {
  showStirrups: boolean;
  onToggleStirrups: (v: boolean) => void;
  showMesh: boolean;
  onToggleMesh: (v: boolean) => void;
  isolateElementId: string | null;
  onSetIsolateElementId: (id: string | null) => void;
}

const CATEGORY_LABEL: Record<DetailingResult["category"], string> = {
  beam: "Beam",
  column: "Column",
  slab: "Slab",
  wall: "Wall",
  footing: "Footing",
  "combined-footing": "Combined Footing",
  "strip-footing": "Strip Footing",
  "mat-foundation": "Mat Foundation",
  "pile-cap": "Pile Cap",
};

/**
 * Phase 10 — Detailing Model tab। CSI (ETABS/SAFE) এর Detailing view
 * এর মতো — Design panel গুলোতে "Send to Detailing Model" চাপার পর
 * generate হওয়া প্রতিটা element এর rebar এখানে list হয়, viewport-এ
 * overlay হিসেবে (main StructuralViewport-এর ভেতরেই DetailingLayer
 * mount করা আছে) দেখা যায়, এবং একটা consolidated Bar Bending
 * Schedule (BBS) — সব element এর schedule একত্রে — এখানে দেখানো হয়।
 *
 * "Isolate" ফিচারটা CSI-এর element-focus মোডের মতো — একটা element
 * বেছে নিলে শুধু সেটার rebar viewport-এ দেখা যায় (পুরো structure এর
 * rebar একসাথে দেখলে খুব ঘন/বিভ্রান্তিকর হয়ে যায়, তাই দুটো মোডই দরকার:
 * "সব" এবং "একটা element এ zoom")।
 */
export function DetailingPanel({
  showStirrups,
  onToggleStirrups,
  showMesh,
  onToggleMesh,
  isolateElementId,
  onSetIsolateElementId,
}: DetailingPanelProps) {
  const results = useDetailingStore((s) => s.results);
  const elements = useElementsStore((s) => s.elements);

  const resultList = useMemo(() => Object.values(results), [results]);

  const combinedSchedule = useMemo(() => {
    const rows: (BarScheduleRow & { elementLabel: string })[] = [];
    for (const r of resultList) {
      for (const row of r.schedule) {
        rows.push({ ...row, elementLabel: r.elementLabel });
      }
    }
    return rows;
  }, [resultList]);

  const totalWeight = useMemo(() => {
    // মোটামুটি ওজন হিসাব — steel density 7850 kg/m³, cross-section area থেকে
    let totalKg = 0;
    for (const row of combinedSchedule) {
      const areaMm2 = (Math.PI / 4) * row.diameterMm * row.diameterMm;
      const volumeMm3 = areaMm2 * row.totalLengthMm;
      const volumeM3 = volumeMm3 / 1e9;
      totalKg += volumeM3 * 7850;
    }
    return totalKg;
  }, [combinedSchedule]);

  const elementsWithIssues = resultList.filter((r) => r.sourceDesignStatus !== "ok");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Detailing Model — 3D Rebar Visualization</h3>
        <p className="text-xs text-text-muted mb-3">
          প্রতিটা Design panel-এ &quot;Send to Detailing Model&quot; চেপে rebar generate করুন, তারপর মূল 3D
          viewport-এ (উপরে) সেটা overlay হিসেবে দেখা যাবে।
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2.5">
        <p className="text-xs text-text-muted font-medium">Display</p>

        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Stirrups / Ties</span>
          <input type="checkbox" checked={showStirrups} onChange={(e) => onToggleStirrups(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Slab/Wall/Footing Mesh</span>
          <input type="checkbox" checked={showMesh} onChange={(e) => onToggleMesh(e.target.checked)} />
        </label>

        <div>
          <label className="block text-xs text-text-muted mb-1">Isolate Element (single-member focus)</label>
          <select
            value={isolateElementId ?? ""}
            onChange={(e) => onSetIsolateElementId(e.target.value === "" ? null : e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2.5 py-1.5"
          >
            <option value="">সব element (whole structure)</option>
            {resultList.map((r) => (
              <option key={r.elementId} value={r.elementId}>
                {r.elementLabel} ({CATEGORY_LABEL[r.category]})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Status</p>
        <p className="text-xs text-text-secondary">
          {resultList.length} element{resultList.length === 1 ? "" : "s"} detailed / {elements.length} total elements
        </p>
        <p className="text-xs text-text-secondary">Estimated rebar weight: {totalWeight.toFixed(0)} kg</p>
        {elementsWithIssues.length > 0 && (
          <p className="text-xs text-status-holdText">
            ⚠ {elementsWithIssues.length} element-এর design status ok না — detailing হয়তো ভুল ডিজাইন থেকে
            জেনারেট হয়েছে, নিচের list-এ লাল/হলুদ চিহ্নিত।
          </p>
        )}
      </div>

      {resultList.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium mb-1">Detailed Elements</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {resultList.map((r) => {
              const statusColor =
                r.sourceDesignStatus === "ok"
                  ? "text-status-activeText"
                  : r.sourceDesignStatus === "warning"
                    ? "text-status-holdText"
                    : "text-red-600";
              return (
                <button
                  key={r.elementId}
                  onClick={() => onSetIsolateElementId(r.elementId)}
                  className={`w-full flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-surface-card transition-colors ${
                    isolateElementId === r.elementId ? "bg-surface-card" : ""
                  }`}
                >
                  <span className="text-text-secondary">
                    {r.elementLabel} — {CATEGORY_LABEL[r.category]}
                  </span>
                  <span className={statusColor}>{r.sourceDesignStatus}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {combinedSchedule.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
          <p className="text-xs text-text-muted font-medium mb-2">Bar Bending Schedule (BBS)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-text-secondary">
              <thead>
                <tr className="text-text-muted border-b border-surface-border">
                  <th className="text-left py-1 pr-2">Mark</th>
                  <th className="text-left py-1 pr-2">Element</th>
                  <th className="text-right py-1 pr-2">Dia</th>
                  <th className="text-right py-1 pr-2">Count</th>
                  <th className="text-right py-1 pr-2">Cut (mm)</th>
                  <th className="text-right py-1">Total (m)</th>
                </tr>
              </thead>
              <tbody>
                {combinedSchedule.map((row, i) => (
                  <tr key={i} className="border-b border-surface-border">
                    <td className="py-1 pr-2">{row.barMark}</td>
                    <td className="py-1 pr-2 text-text-muted">{row.elementLabel}</td>
                    <td className="py-1 pr-2 text-right">{row.diameterMm}mm</td>
                    <td className="py-1 pr-2 text-right">{row.count}</td>
                    <td className="py-1 pr-2 text-right">{row.cutLengthMm.toFixed(0)}</td>
                    <td className="py-1 text-right">{(row.totalLengthMm / 1000).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
