"use client";

import { useEffect, useState } from "react";
import { assembleGeneralNotes, type GeneralNotesData } from "@/lib/design/generalNotes";
import { saveGeneralNotesInput, fetchGeneralNotesInput } from "@/lib/design/generalNotesFirestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 0): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function Field({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-0.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
      />
    </div>
  );
}

/**
 * Phase 10g — General Notes panel। Project-level design criteria/material/
 * cover data আর Phase 10c-এর verified development/lap/hook length টেবিল
 * (standard bar diameter রেঞ্জ জুড়ে) একসাথে দেখায় — MICON রেফারেন্সের
 * General Notes পাতার মতো (generalNotes.ts দেখুন)।
 */
export function GeneralNotesPanel() {
  const [data, setData] = useState<GeneralNotesData | null>(null);
  const projectId = useProjectIdStore((s) => s.projectId);

  const [projectLabel, setProjectLabel] = useState("Six Storied Residential Building");
  const [codeBasis, setCodeBasis] = useState("BNBC 2020, ACI 318-19");
  const [windSpeedKmh, setWindSpeedKmh] = useState("210");
  const [seismicZone, setSeismicZone] = useState("Zone 2");
  const [concreteFcMPa, setConcreteFcMPa] = useState("21");
  const [reinforcementFyMPa, setReinforcementFyMPa] = useState("414");
  const [earthCoverMm, setEarthCoverMm] = useState("63");
  const [exposedCoverMm, setExposedCoverMm] = useState("38");
  const [maxSlumpMm, setMaxSlumpMm] = useState("50");

  // পেজ রিলোড হলে আগে "Generate" চাপা ফর্ম-ইনপুট ফিরিয়ে আনে (persist না
  // থাকলে আগে এই সবকিছু হারিয়ে যেত — দেখুন generalNotesFirestore.ts)।
  // শুধু ফর্ম-ইনপুট restore করা হয়, ডেরাইভড GeneralNotesData (development
  // length টেবিল ইত্যাদি) না — সেটা "Generate" চাপলে আবার হিসাব হয়।
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchGeneralNotesInput(projectId)
      .then((saved) => {
        if (cancelled || !saved) return;
        setProjectLabel(saved.projectLabel);
        setCodeBasis(saved.designCriteria.codeBasis.join(", "));
        setWindSpeedKmh(saved.designCriteria.windSpeedKmh?.toString() ?? "");
        setSeismicZone(saved.designCriteria.seismicZone ?? "");
        setConcreteFcMPa(saved.fcMPa.toString());
        setReinforcementFyMPa(saved.fyMPa.toString());
        const earth = saved.coverRequirements.find((c) => c.condition === "Earth / Earth & Water");
        const exposed = saved.coverRequirements.find((c) => c.condition === "Exposed (Top/Side)");
        if (earth) setEarthCoverMm(earth.coverMm.toString());
        if (exposed) setExposedCoverMm(exposed.coverMm.toString());
        setMaxSlumpMm(saved.concreteRequirement.maxSlumpMm.toString());
      })
      .catch((e) => console.error("Failed to load saved general notes input:", e));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function handleRun() {
    const input = {
      projectLabel,
      designCriteria: {
        codeBasis: codeBasis.split(",").map((s) => s.trim()).filter(Boolean),
        windSpeedKmh: Number(windSpeedKmh) || undefined,
        seismicZone: seismicZone || undefined,
      },
      materials: [
        { elementCategory: "Column, Grade Beam, Footing", concreteFcMPa: Number(concreteFcMPa) || 21, reinforcementFyMPa: Number(reinforcementFyMPa) || 414 },
      ],
      coverRequirements: [
        { condition: "Earth / Earth & Water", coverMm: Number(earthCoverMm) || 63 },
        { condition: "Exposed (Top/Side)", coverMm: Number(exposedCoverMm) || 38 },
      ],
      concreteRequirement: {
        maxSlumpMm: Number(maxSlumpMm) || 50,
        curingMethod: "Moist jute fabric + water sprinkling",
        minCuringDays: 28,
      },
      fyMPa: Number(reinforcementFyMPa) || 414,
      fcMPa: Number(concreteFcMPa) || 21,
      clearCoverOrHalfSpacingMm: Number(exposedCoverMm) || 38,
    };
    setData(assembleGeneralNotes(input));
    if (projectId) {
      saveGeneralNotesInput(projectId, input).catch((e) =>
        console.error("Failed to save general notes input:", e)
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">General Notes</h3>
        <p className="text-xs text-slate-500 mb-3">
          Design criteria, material grade, cover আর Phase 10c-এর development/lap/hook length রেফারেন্স টেবিল একসাথে —
          MICON-স্টাইল General Notes পাতা। PDF export Hub-এর কাজ, এটা শুধু ডেটা।
        </p>

        <div className="space-y-2 mb-3">
          <Field label="Project Label" value={projectLabel} onChange={setProjectLabel} />
          <Field label="Code Basis (comma-separated)" value={codeBasis} onChange={setCodeBasis} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wind Speed" value={windSpeedKmh} onChange={setWindSpeedKmh} unit="km/h" />
            <Field label="Seismic Zone" value={seismicZone} onChange={setSeismicZone} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Concrete f'c" value={concreteFcMPa} onChange={setConcreteFcMPa} unit="MPa" />
            <Field label="Reinforcement fy" value={reinforcementFyMPa} onChange={setReinforcementFyMPa} unit="MPa" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Earth Cover" value={earthCoverMm} onChange={setEarthCoverMm} unit="mm" />
            <Field label="Exposed Cover" value={exposedCoverMm} onChange={setExposedCoverMm} unit="mm" />
          </div>
          <Field label="Max Slump" value={maxSlumpMm} onChange={setMaxSlumpMm} unit="mm" />
        </div>

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Generate General Notes
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Design Criteria</p>
            <p className="text-xs text-slate-300">Code: {data.designCriteria.codeBasis.join(", ")}</p>
            {data.designCriteria.windSpeedKmh && (
              <p className="text-xs text-slate-300">Wind Speed: {data.designCriteria.windSpeedKmh} km/h</p>
            )}
            {data.designCriteria.seismicZone && (
              <p className="text-xs text-slate-300">Seismic Zone: {data.designCriteria.seismicZone}</p>
            )}
          </div>

          <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Concrete Requirement</p>
            <p className="text-xs text-slate-300">
              Max Slump: {data.concreteRequirement.maxSlumpMm}mm · Curing: {data.concreteRequirement.curingMethod} (min{" "}
              {data.concreteRequirement.minCuringDays} days)
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 font-medium mb-1.5">Cover Requirements</p>
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="font-normal pb-1">Condition</th>
                  <th className="font-normal pb-1 text-right">Cover</th>
                </tr>
              </thead>
              <tbody>
                {data.coverRequirements.map((c, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="py-1">{c.condition}</td>
                    <td className="py-1 text-right">{c.coverMm}mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-xs text-slate-500 font-medium mb-1.5">Development / Lap / Hook Length Table</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-slate-300 whitespace-nowrap">
                <thead>
                  <tr className="text-slate-500 text-left">
                    <th className="font-normal pb-1 pr-2">Ø(mm)</th>
                    <th className="font-normal pb-1 pr-2 text-right">ld-tension</th>
                    <th className="font-normal pb-1 pr-2 text-right">ldc</th>
                    <th className="font-normal pb-1 pr-2 text-right">Lap-A</th>
                    <th className="font-normal pb-1 pr-2 text-right">Lap-B</th>
                    <th className="font-normal pb-1 pr-2 text-right">Lap-comp</th>
                    <th className="font-normal pb-1 text-right">ldh</th>
                  </tr>
                </thead>
                <tbody>
                  {data.developmentLengthTable.map((row, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="py-1 pr-2">{row.barDiameterMm}</td>
                      <td className="py-1 pr-2 text-right">{fmt(row.tensionDevelopmentLengthMm)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(row.compressionDevelopmentLengthMm)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(row.tensionLapClassAMm)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(row.tensionLapClassBMm)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(row.compressionLapMm)}</td>
                      <td className="py-1 text-right">{fmt(row.hookDevelopmentLengthMm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">সব দৈর্ঘ্য mm-এ, উপরে দেওয়া fy/f&apos;c/cover অনুযায়ী।</p>
          </div>
        </div>
      )}
    </div>
  );
}
