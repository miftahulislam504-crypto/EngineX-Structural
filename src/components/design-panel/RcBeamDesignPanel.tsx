"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { runRcBeamDesign, type RcBeamDesignReport } from "@/lib/design/rcBeamDesign";
import type { BeamSupportCondition } from "@/lib/design/rcBeamDeflection";
import type { BeamElement } from "@/lib/types/element";
import type { RectangularSection } from "@/lib/types/section";
import { generateBeamDetailing } from "@/lib/detailing/generateBeamDetailing";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { persistDesignResult } from "@/lib/design/firestore";
import { persistDetailingResult } from "@/lib/detailing/firestore";
import { useProjectIdStore } from "@/lib/project/useProjectIdStore";

const SUPPORT_CONDITIONS: { value: BeamSupportCondition; label: string }[] = [
  { value: "simply-supported", label: "Simply Supported" },
  { value: "one-end-continuous", label: "One End Continuous" },
  { value: "both-ends-continuous", label: "Both Ends Continuous" },
  { value: "cantilever", label: "Cantilever" },
];

function elementLength(e: BeamElement): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Phase 6a — RC Beam Design panel। Analysis (Phase 4) থেকে elementEndForces
 * পাওয়া গেলে (useAnalysisResultStore, AnalysisPanel সেই run এর পর
 * populate করে) নির্বাচিত beam এর জন্য governing (সর্বোচ্চ magnitude)
 * moment/shear স্বয়ংক্রিয়ভাবে বসানো হয় — তবে ইঞ্জিনিয়ার চাইলে সবসময়
 * ম্যানুয়ালি ওভাররাইড করতে পারেন (কোনো analysis run না করেও এই প্যানেল
 * স্বাধীনভাবে ব্যবহারযোগ্য)।
 */
export function RcBeamDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const elementEndForces = useAnalysisResultStore((s) => s.elementEndForces);
  const sourceAnalysisType = useAnalysisResultStore((s) => s.sourceAnalysisType);
  const setDetailingResult = useDetailingStore((s) => s.setResult);
  const setDcrChecks = useDcrStore((s) => s.setChecks);
  const projectId = useProjectIdStore((s) => s.projectId);

  const beams = useMemo(() => elements.filter((e): e is BeamElement => e.category === "beam"), [elements]);

  const [selectedBeamId, setSelectedBeamId] = useState<string>("");
  const selectedBeam = beams.find((b) => b.elementId === selectedBeamId) ?? null;

  const beamSection = selectedBeam
    ? sections.find((s) => s.sectionId === selectedBeam.sectionId)
    : undefined;
  const beamMaterial = selectedBeam
    ? materials.find((m) => m.materialId === selectedBeam.materialId)
    : undefined;
  const isRectangular = beamSection?.shape === "rectangular";
  const isConcrete = beamMaterial?.type === "concrete";

  const governingForces = useMemo(() => {
    if (!selectedBeam || !elementEndForces) return null;
    const forcesForBeam = elementEndForces.filter((f) => f.elementId === selectedBeam.elementId);
    if (forcesForBeam.length === 0) return null;

    let maxMoment = 0;
    let maxShear = 0;
    for (const f of forcesForBeam) {
      maxMoment = Math.max(maxMoment, Math.abs(f.startMomentZ), Math.abs(f.endMomentZ));
      maxShear = Math.max(maxShear, Math.abs(f.startShearY), Math.abs(f.endShearY));
    }
    return { maxMoment, maxShear };
  }, [selectedBeam, elementEndForces]);

  const [effectiveCoverMm, setEffectiveCoverMm] = useState("60");
  const [clearCoverMm, setClearCoverMm] = useState("40");
  const [stirrupDiameterMm, setStirrupDiameterMm] = useState("10");
  const [supportCondition, setSupportCondition] = useState<BeamSupportCondition>("simply-supported");
  const [factoredMomentKNm, setFactoredMomentKNm] = useState("");
  const [factoredShearKN, setFactoredShearKN] = useState("");
  const [providedAsMm2, setProvidedAsMm2] = useState("");
  const [providedBarSpacingMm, setProvidedBarSpacingMm] = useState("");

  const [report, setReport] = useState<RcBeamDesignReport | null>(null);

  function handleUseAutoValues() {
    if (governingForces) {
      setFactoredMomentKNm(governingForces.maxMoment.toFixed(2));
      setFactoredShearKN(governingForces.maxShear.toFixed(2));
    }
  }

  function handleRunDesign() {
    if (!selectedBeam || !beamSection || beamSection.shape !== "rectangular" || !beamMaterial) return;
    const section = beamSection as RectangularSection;
    const fy = beamMaterial.type === "concrete" ? beamMaterial.rebarFy ?? 414 : 414;
    const fc = beamMaterial.type === "concrete" ? beamMaterial.fc : 28;

    const input = {
      elementLabel: selectedBeam.label,
      spanMm: elementLength(selectedBeam) * 1000,
      widthMm: section.width,
      totalDepthMm: section.depth,
      effectiveCoverMm: Number(effectiveCoverMm) || 60,
      clearCoverMm: Number(clearCoverMm) || 40,
      fcMPa: fc,
      fyMPa: fy,
      stirrupDiameterMm: Number(stirrupDiameterMm) || 10,
      supportCondition,
      factoredMomentKNm: Number(factoredMomentKNm) || 0,
      factoredShearKN: Number(factoredShearKN) || 0,
      providedAsMm2: providedAsMm2.trim() !== "" ? Number(providedAsMm2) : undefined,
      providedBarSpacingMm: providedBarSpacingMm.trim() !== "" ? Number(providedBarSpacingMm) : undefined,
    };
    const result = runRcBeamDesign(input);
    setReport(result);
    setDetailingSent(false);
    if (result.flexuralAdequacy) {
      setDcrChecks(selectedBeam.elementId, selectedBeam.label, [
        { label: "Flexure", ratio: result.flexuralAdequacy.utilizationRatio },
      ]);
    }
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selectedBeam.elementId,
        elementLabel: selectedBeam.label,
        elementCategory: "beam",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist beam design result:", e));
    }
  }

  const [detailingSent, setDetailingSent] = useState(false);

  function handleSendToDetailing() {
    if (!selectedBeam || !beamSection || beamSection.shape !== "rectangular" || !report) return;
    const section = beamSection as RectangularSection;
    const detailing = generateBeamDetailing({
      elementId: selectedBeam.elementId,
      elementLabel: selectedBeam.label,
      spanMm: elementLength(selectedBeam) * 1000,
      widthMm: section.width,
      totalDepthMm: section.depth,
      effectiveCoverMm: Number(effectiveCoverMm) || 60,
      stirrupDiameterMm: Number(stirrupDiameterMm) || 10,
      report,
    });
    setDetailingResult(detailing);
    setDetailingSent(true);
    if (projectId) {
      persistDetailingResult(projectId, detailing).catch((e) =>
        console.error("Failed to persist beam detailing result:", e)
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">RC Beam Design</h3>
        <p className="text-xs text-slate-500 mb-3">
          ACI 318-19 / BNBC 2020 — flexural + shear reinforcement design, deflection and crack-control checks.
        </p>

        <label className="block text-xs text-slate-500 mb-1">Beam</label>
        <select
          value={selectedBeamId}
          onChange={(e) => {
            setSelectedBeamId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a beam...</option>
          {beams.map((b) => (
            <option key={b.elementId} value={b.elementId}>
              {b.label}
            </option>
          ))}
        </select>

        {selectedBeam && !isRectangular && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            RC design in this version only supports rectangular sections. This beam uses a{" "}
            {beamSection?.shape ?? "unknown"} section.
          </p>
        )}
        {selectedBeam && isRectangular && !isConcrete && (
          <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-2">
            This beam&apos;s material is not concrete — RC design does not apply. (Steel beam design is a later
            sub-phase.)
          </p>
        )}
      </div>

      {selectedBeam && isRectangular && isConcrete && (
        <>
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              Section: {(beamSection as RectangularSection).width}×{(beamSection as RectangularSection).depth}mm,
              Span: {(elementLength(selectedBeam) * 1000).toFixed(0)}mm
            </p>

            {governingForces ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-400">
                  From {sourceAnalysisType}: Mu≈{governingForces.maxMoment.toFixed(1)} kN·m, Vu≈
                  {governingForces.maxShear.toFixed(1)} kN
                </p>
                <button
                  type="button"
                  onClick={handleUseAutoValues}
                  className="text-xs bg-sky-800 hover:bg-sky-700 text-white px-2 py-1 rounded-md"
                >
                  Use these
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No analysis result available for this beam yet — run an Analysis first, or enter Mu/Vu manually
                below.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Moment Mu (kN·m)</label>
              <input
                type="number"
                step="any"
                value={factoredMomentKNm}
                onChange={(e) => setFactoredMomentKNm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factored Shear Vu (kN)</label>
              <input
                type="number"
                step="any"
                value={factoredShearKN}
                onChange={(e) => setFactoredShearKN(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective Cover d&apos; (mm)</label>
              <input
                type="number"
                step="any"
                value={effectiveCoverMm}
                onChange={(e) => setEffectiveCoverMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Clear Cover (mm)</label>
              <input
                type="number"
                step="any"
                value={clearCoverMm}
                onChange={(e) => setClearCoverMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Stirrup Diameter (mm)</label>
              <input
                type="number"
                step="any"
                value={stirrupDiameterMm}
                onChange={(e) => setStirrupDiameterMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Support Condition</label>
              <select
                value={supportCondition}
                onChange={(e) => setSupportCondition(e.target.value as BeamSupportCondition)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              >
                {SUPPORT_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Provided As (mm²) — optional</label>
              <input
                type="number"
                step="any"
                value={providedAsMm2}
                onChange={(e) => setProvidedAsMm2(e.target.value)}
                placeholder="e.g. rebar you chose"
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Provided Bar Spacing (mm) — optional</label>
              <input
                type="number"
                step="any"
                value={providedBarSpacingMm}
                onChange={(e) => setProvidedBarSpacingMm(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run RC Beam Design
          </button>

          {report && (
            <button
              type="button"
              onClick={handleSendToDetailing}
              className="w-full rounded-md bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-medium py-2 transition-colors"
            >
              {detailingSent ? "✓ Sent to Detailing Model" : "🔩 Send to Detailing Model"}
            </button>
          )}
        </>
      )}

      {report && <RcBeamDesignReportView report={report} />}
    </div>
  );
}

function RcBeamDesignReportView({ report }: { report: RcBeamDesignReport }) {
  const statusStyle =
    report.overallStatus === "ok"
      ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
      : report.overallStatus === "warning"
        ? "bg-amber-950/30 border-amber-900 text-amber-400"
        : "bg-red-950/30 border-red-900 text-red-400";
  const statusIcon = report.overallStatus === "ok" ? "✓" : report.overallStatus === "warning" ? "⚠" : "✗";

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2.5 ${statusStyle}`}>
        <p className="text-xs font-medium">
          {statusIcon} {report.elementLabel} — {report.overallStatus.toUpperCase()}
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Flexure</p>
        <p className="text-xs text-slate-300">d = {report.flexure.effectiveDepthMm.toFixed(0)} mm</p>
        <p className="text-xs text-slate-300">
          Required As = {report.flexure.governingAsMm2.toFixed(0)} mm² (min {report.flexure.minAsMm2.toFixed(0)},
          max {report.flexure.maxAsMm2.toFixed(0)})
        </p>
        {report.flexure.isDoublyReinforced && (
          <p className="text-xs text-amber-400">
            Doubly reinforced — compression steel As&apos; = {report.flexure.compressionAsMm2.toFixed(0)} mm²
          </p>
        )}
        {report.flexuralAdequacy && (
          <p className="text-xs text-slate-300">
            φMn = {report.flexuralAdequacy.phiMnKNm.toFixed(1)} kN·m — utilization{" "}
            {(report.flexuralAdequacy.utilizationRatio * 100).toFixed(0)}% (
            {report.flexuralAdequacy.adequate ? "adequate" : "NOT adequate"})
          </p>
        )}
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Shear</p>
        <p className="text-xs text-slate-300">φVc = {report.shear.phiVcKN.toFixed(1)} kN</p>
        <p className="text-xs text-slate-300">
          Stirrups {report.shear.stirrupNeeded ? "required" : "not required (nominal only)"}
          {report.shear.requiredSpacingMm !== null &&
            ` — spacing ≈ ${report.shear.requiredSpacingMm.toFixed(0)}mm (max ${report.shear.maxSpacingMm.toFixed(0)}mm)`}
        </p>
      </div>

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-slate-500 font-medium mb-1">Deflection</p>
        <p className="text-xs text-slate-300">
          Min thickness {report.deflection.minRequiredThicknessMm.toFixed(0)}mm vs provided{" "}
          {report.deflection.providedThicknessMm.toFixed(0)}mm —{" "}
          {report.deflection.adequate ? "OK" : "NOT adequate"}
        </p>
      </div>

      {report.crackControl && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
          <p className="text-xs text-slate-500 font-medium mb-1">Crack Control</p>
          <p className="text-xs text-slate-300">
            Max spacing {report.crackControl.maxSpacingMm.toFixed(0)}mm —{" "}
            {report.crackControl.adequate ? "OK" : "NOT adequate"}
          </p>
        </div>
      )}

      {report.allWarnings.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
