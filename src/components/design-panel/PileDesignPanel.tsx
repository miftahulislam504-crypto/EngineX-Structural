"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { computePileAxialCapacity, checkPileAdequacy, type PileCapacityResult } from "@/lib/design/pileCapacity";
import type { PileElement } from "@/lib/types/element";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function elementLength(e: PileElement): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Phase 6e — Pile Design panel। সরলীকৃত static formula (skin
 * friction + end bearing) — এই app কোনো geotechnical/soil-boring
 * analysis করে না, unit skin friction ও end bearing pressure
 * geotechnical report থেকে ইঞ্জিনিয়ার সরবরাহ করেন।
 */
export function PileDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);

  const piles = useMemo(() => elements.filter((e): e is PileElement => e.category === "pile"), [elements]);

  const [selectedPileId, setSelectedPileId] = useState<string>("");
  const selectedPile = piles.find((p) => p.elementId === selectedPileId) ?? null;
  const pileSection = selectedPile ? sections.find((s) => s.sectionId === selectedPile.sectionId) : undefined;
  const isSupportedShape = pileSection?.shape === "circular" || pileSection?.shape === "rectangular";

  const [servicePointLoadKN, setServicePointLoadKN] = useState("");
  const [unitSkinFrictionKPa, setUnitSkinFrictionKPa] = useState("");
  const [endBearingPressureKPa, setEndBearingPressureKPa] = useState("");
  const [factorOfSafety, setFactorOfSafety] = useState("2.5");

  const [capacity, setCapacity] = useState<PileCapacityResult | null>(null);

  function handleRunDesign() {
    if (!selectedPile || !pileSection) return;

    const diameterOrWidth =
      pileSection.shape === "circular"
        ? pileSection.diameter
        : pileSection.shape === "rectangular"
          ? Math.min(pileSection.width, pileSection.depth)
          : 0;

    const result = computePileAxialCapacity({
      shape: pileSection.shape === "circular" ? "circular" : "square",
      diameterOrWidthMm: diameterOrWidth,
      embeddedLengthMm: elementLength(selectedPile) * 1000,
      unitSkinFrictionKPa: Number(unitSkinFrictionKPa) || 0,
      endBearingPressureKPa: Number(endBearingPressureKPa) || 0,
      factorOfSafety: Number(factorOfSafety) || 2.5,
    });
    setCapacity(result);
  }

  const adequacy = capacity && servicePointLoadKN.trim() !== "" ? checkPileAdequacy(Number(servicePointLoadKN), capacity) : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Pile Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          Simplified static formula — axial capacity from skin friction and end bearing.
        </p>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis — enter unit skin friction and end bearing pressure from
          your geotechnical report.
        </p>

        <label className="block text-xs text-slate-500 mb-1">Pile</label>
        <select
          value={selectedPileId}
          onChange={(e) => {
            setSelectedPileId(e.target.value);
            setCapacity(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a pile...</option>
          {piles.map((p) => (
            <option key={p.elementId} value={p.elementId}>
              {p.label}
            </option>
          ))}
        </select>

        {selectedPile && !isSupportedShape && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            Pile design in this version only supports circular or rectangular/square sections. This pile uses a{" "}
            {pileSection?.shape ?? "unknown"} section.
          </p>
        )}
      </div>

      {selectedPile && isSupportedShape && (
        <>
          <p className="text-xs text-slate-500">
            Embedded length ≈ {(elementLength(selectedPile) * 1000).toFixed(0)}mm (from element)
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unit Skin Friction fs (kPa)</label>
              <input
                type="number"
                step="any"
                value={unitSkinFrictionKPa}
                onChange={(e) => setUnitSkinFrictionKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">End Bearing Pressure qp (kPa)</label>
              <input
                type="number"
                step="any"
                value={endBearingPressureKPa}
                onChange={(e) => setEndBearingPressureKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Service Axial Load (kN)</label>
              <input
                type="number"
                step="any"
                value={servicePointLoadKN}
                onChange={(e) => setServicePointLoadKN(e.target.value)}
                placeholder="unfactored"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factor of Safety</label>
              <input
                type="number"
                step="any"
                value={factorOfSafety}
                onChange={(e) => setFactorOfSafety(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Compute Pile Capacity
          </button>
        </>
      )}

      {capacity && (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Capacity Breakdown</p>
            <p className="text-xs text-slate-300">Skin friction Qs = {fmt(capacity.skinFrictionCapacityKN)} kN</p>
            <p className="text-xs text-slate-300">End bearing Qp = {fmt(capacity.endBearingCapacityKN)} kN</p>
            <p className="text-xs text-slate-300">Ultimate Qu = {fmt(capacity.ultimateCapacityKN)} kN</p>
            <p className="text-xs text-slate-300 font-medium">Allowable Qa = {fmt(capacity.allowableCapacityKN)} kN</p>
          </div>

          {adequacy && (
            <div
              className={`rounded-md border px-3 py-2.5 ${
                adequacy.adequate
                  ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
                  : "bg-red-950/30 border-red-900 text-red-400"
              }`}
            >
              <p className="text-xs font-medium">
                {adequacy.adequate ? "✓" : "✗"} Utilization{" "}
                {Number.isFinite(adequacy.utilizationRatio) ? `${(adequacy.utilizationRatio * 100).toFixed(0)}%` : "—"}{" "}
                — {adequacy.adequate ? "adequate" : "NOT adequate"}
              </p>
            </div>
          )}

          {capacity.warnings.length > 0 && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
              <p className="text-xs text-slate-500 font-medium">Warnings:</p>
              {capacity.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
