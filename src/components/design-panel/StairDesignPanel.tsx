"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { runStairDesign, type StairDesignInput, type StairDesignReport, type StairSupportCondition } from "@/lib/design/stairDesign";
import { deriveStairFlightGeometry } from "@/lib/design/stairGeometry";
import type { StairElement } from "@/lib/types/element";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";
import { saveElement } from "@/lib/elements/firestore";

const SUPPORT_CONDITIONS: { value: StairSupportCondition; label: string }[] = [
  { value: "simply-supported", label: "Simply Supported" },
  { value: "one-end-continuous", label: "One-End Continuous" },
  { value: "both-ends-continuous", label: "Both-Ends Continuous" },
];

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Stair (Waist Slab) Design panel — RcSlabDesignPanel.tsx-এর ঠিক একই
 * প্যাটার্নে (element select → span/load ইঞ্জিনিয়ার দেন কারণ FE
 * moment recovery নেই → runXDesign() → report → persist)।
 *
 * stairDesign.ts-এর docblock দ্রষ্টব্য: waist slab-কে তার নিজস্ব
 * inclined slope length বরাবর একটা one-way slab হিসেবে ট্রিট করা
 * হয়েছে, horizontal projection বরাবর না — geometry (run/rise/slope)
 * element.vertices থেকেই স্বয়ংক্রিয়ভাবে বের হয় (stairGeometry.ts),
 * ইঞ্জিনিয়ারকে শুধু riser height, support condition, ও factored
 * plan-area load দিতে হয়।
 *
 * riser height এখানে সেভ হলে (Save Riser Height বাটন, element-এ
 * persist — element.ts-এর StairElement.riserHeightM কমেন্ট দেখুন)
 * পরের useAutoLoadSync debounce cycle-এ deriveStairSelfWeightLoads.ts
 * পূর্ণ (waist + step) self-weight ধরবে, শুধু flat waist-slab weight
 * না — তাই এই panel এর riser input শুধু design calculation-এর জন্য
 * না, self-weight accuracy-র জন্যও গুরুত্বপূর্ণ।
 */
export function StairDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const setElements = useElementsStore((s) => s.setElements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const projectId = useProjectIdStore((s) => s.projectId);

  const stairs = useMemo(() => elements.filter((e): e is StairElement => e.category === "stair"), [elements]);

  const [selectedStairId, setSelectedStairId] = useState<string>("");
  const selectedStair = stairs.find((s) => s.elementId === selectedStairId) ?? null;
  const stairMaterial = selectedStair ? materials.find((m) => m.materialId === selectedStair.materialId) : undefined;
  const isConcrete = stairMaterial?.type === "concrete";

  const geometry = selectedStair ? deriveStairFlightGeometry(selectedStair) : null;

  const [supportCondition, setSupportCondition] = useState<StairSupportCondition>("simply-supported");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("20");
  const [factoredLoadKPa, setFactoredLoadKPa] = useState("");
  const [riserHeightMm, setRiserHeightMm] = useState("150");
  const [riserSaved, setRiserSaved] = useState(false);

  const [report, setReport] = useState<StairDesignReport | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  function handleRunDesign() {
    if (!selectedStair || !stairMaterial || stairMaterial.type !== "concrete") return;
    const fy = stairMaterial.rebarFy ?? 414;
    const fc = stairMaterial.fc;

    const input: StairDesignInput = {
      elementLabel: selectedStair.label,
      supportCondition,
      thicknessMm: selectedStair.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 20,
      fcMPa: fc,
      fyMPa: fy,
      factoredLoadKPa: Number(factoredLoadKPa) || 0,
    };
    const result = runStairDesign(selectedStair, input);

    if ("error" in result) {
      setRunError(result.error);
      setReport(null);
      return;
    }
    setRunError(null);
    setReport(result);

    if (projectId) {
      // { input, report } জোড়া প্যাটার্ন — calc-sheets/detailTypes.ts এর
      // StairCalcDetail/asStairDetail() এই ঠিক এই শেপটাই আশা করে (Phase 4,
      // S-18 sheet এ input.effectiveCoverMm/factoredLoadKPa দেখাতে লাগে)।
      persistDesignResult(projectId, {
        elementId: selectedStair.elementId,
        elementLabel: selectedStair.label,
        elementCategory: "stair",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist stair design result:", e));
    }
  }

  function handleSaveRiserHeight() {
    if (!selectedStair || !projectId) return;
    const riserM = Number(riserHeightMm) / 1000;
    if (!Number.isFinite(riserM) || riserM <= 0) return;

    const updated: StairElement = { ...selectedStair, riserHeightM: riserM };
    setElements(elements.map((e) => (e.elementId === updated.elementId ? updated : e)));
    setRiserSaved(true);
    saveElement(projectId, updated).catch((e) => console.error("Failed to save stair riser height:", e));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Stair (Waist Slab) Design</h3>
        <p className="text-xs text-text-muted mb-3">
          ACI 318-19 one-way slab method along the waist slab&apos;s own inclined slope length — min
          thickness/reinforcement, flexural design.
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
          Landing slabs are not yet a modeled element category — this design covers straight flights only. Spans and
          loads are entered directly (no FE moment recovery for stairs), same as RC Slab design.
        </p>

        <label className="block text-xs text-text-muted mb-1">Stair Flight</label>
        <select
          value={selectedStairId}
          onChange={(e) => {
            setSelectedStairId(e.target.value);
            setReport(null);
            setRunError(null);
            setRiserSaved(false);
            const s = stairs.find((st) => st.elementId === e.target.value);
            if (s?.riserHeightM) setRiserHeightMm(String(Math.round(s.riserHeightM * 1000)));
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a stair flight...</option>
          {stairs.map((s) => (
            <option key={s.elementId} value={s.elementId}>
              {s.label}
            </option>
          ))}
        </select>

        {selectedStair && !isConcrete && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            This stair&apos;s material is not concrete — RC design does not apply.
          </p>
        )}

        {selectedStair && !geometry && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 mb-2">
            Could not derive flight geometry from this element&apos;s vertices (expects 4, from import) — check the
            element in the Elements tab.
          </p>
        )}
      </div>

      {selectedStair && isConcrete && geometry && (
        <>
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted font-medium mb-1">Geometry (from element vertices)</p>
            <p className="text-xs text-text-secondary">
              Horizontal run = {fmt(geometry.horizontalRunM, 2)}m, Rise = {fmt(geometry.verticalRiseM, 2)}m
            </p>
            <p className="text-xs text-text-secondary">
              Slope length (effective span) = {fmt(geometry.slopeLengthM, 2)}m, Angle = {fmt((geometry.slopeAngleRad * 180) / Math.PI, 1)}°
            </p>
            <p className="text-xs text-text-secondary">Width = {fmt(geometry.widthM, 2)}m, Thickness = {selectedStair.thickness}mm (from element)</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Riser Height (mm)</label>
              <input
                type="number"
                step="any"
                value={riserHeightMm}
                onChange={(e) => {
                  setRiserHeightMm(e.target.value);
                  setRiserSaved(false);
                }}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={handleSaveRiserHeight}
                className="w-full rounded-md bg-surface hover:bg-surface-border border border-surface-border text-text-secondary text-xs font-medium py-1.5 transition-colors"
              >
                {riserSaved ? "✓ Saved (used in self-weight)" : "Save Riser Height"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Support Condition</label>
            <select
              value={supportCondition}
              onChange={(e) => setSupportCondition(e.target.value as StairSupportCondition)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            >
              {SUPPORT_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Factored Load wu (kN/m², plan area)</label>
              <input
                type="number"
                step="any"
                value={factoredLoadKPa}
                onChange={(e) => setFactoredLoadKPa(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Effective Cover (mm)</label>
              <input
                type="number"
                step="any"
                value={effectiveCoverMm}
                onChange={(e) => setEffectiveCoverMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Stair Design
          </button>

          {runError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">{runError}</p>
          )}
        </>
      )}

      {report && <StairDesignReportView report={report} />}
    </div>
  );
}

function StairDesignReportView({ report }: { report: StairDesignReport }) {
  const statusStyle =
    report.overallStatus === "ok"
      ? "bg-status-activeBg border-status-activeBorder text-status-activeText"
      : report.overallStatus === "warning"
        ? "bg-status-holdBg border-status-holdBorder text-status-holdText"
        : "bg-red-50 border-red-200 text-red-600";
  const statusIcon = report.overallStatus === "ok" ? "✓" : report.overallStatus === "warning" ? "⚠" : "✗";

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2.5 ${statusStyle}`}>
        <p className="text-xs font-medium">
          {statusIcon} {report.elementLabel} — {report.overallStatus.toUpperCase()}
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Load (converted along slope)</p>
        <p className="text-xs text-text-secondary">
          Inclined equivalent wu = {fmt(report.inclinedFactoredLoadKPa)} kN/m²
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Moments (per meter width)</p>
        <p className="text-xs text-text-secondary">M+ = {fmt(report.moments.positiveMomentKNmPerM)} kN·m/m</p>
        {report.moments.negativeMomentKNmPerM > 0 && (
          <p className="text-xs text-text-secondary">M- = {fmt(report.moments.negativeMomentKNmPerM)} kN·m/m</p>
        )}
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Flexural Reinforcement</p>
        <p className="text-xs text-text-secondary">
          As+ = {fmt(report.flexuralDesign.positiveDesign.governingAsMm2, 0)} mm²/m
        </p>
        {report.flexuralDesign.negativeDesign && (
          <p className="text-xs text-text-secondary">
            As- = {fmt(report.flexuralDesign.negativeDesign.governingAsMm2, 0)} mm²/m
          </p>
        )}
        <p className="text-xs text-text-secondary">
          Min (shrinkage/temp, distribution steel) = {fmt(report.minReinforcement.minAsPerMeterMm2, 0)} mm²/m
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Thickness</p>
        <p className="text-xs text-text-secondary">
          Min required = {fmt(report.minThickness.minThicknessMm, 0)}mm — {report.thicknessAdequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      {report.allWarnings.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={i} className="text-xs text-status-holdText leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
