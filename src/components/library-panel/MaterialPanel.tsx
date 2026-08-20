"use client";

import { useState } from "react";
import type { MaterialType, StructuralMaterial } from "@/lib/types/material";
import {
  createDefaultConcreteMaterial,
  createDefaultSteelMaterial,
  createDefaultTimberMaterial,
  createDefaultAluminiumMaterial,
  createDefaultFrpMaterial,
  createDefaultGlassMaterial,
  createDefaultCompositeMaterial,
} from "@/lib/types/material";
import { useLibraryStore } from "@/lib/library/useLibraryStore";

interface MaterialPanelProps {
  onAddMaterial: (material: StructuralMaterial) => void;
  onDeleteMaterial: (materialId: string) => void;
}

function makeMaterialId(): string {
  return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Standard Concrete Grade প্রিসেট — BNBC 2020 / ACI 318-19 তে প্রচলিত
 * M-নোটেশন (M = fc' MPa তে)। বাংলাদেশের প্র্যাকটিসে M15-M20 সাধারণত
 * lean/PCC কাজে, M20-M25 সাধারণ RCC (slab/beam/column) এ, M30+
 * ভারী-লোড কলাম বা special structure এ ব্যবহৃত হয়। প্রতিটা গ্রেডের
 * সাথে rebar grade আলাদা একটা dropdown-এ (নিচে) স্বাধীনভাবে বেছে
 * নেওয়া যায় — বাস্তবে concrete grade আর rebar grade স্বাধীন চয়েস
 * (M25 concrete-এর সাথে Grade 60 বা Grade 500 rebar দুটোই সম্ভব)।
 */
interface ConcreteGradePreset {
  id: string;
  label: string; // যেমন "M25 (fc'=25 MPa)"
  fc: number;
}

const CONCRETE_GRADE_PRESETS: ConcreteGradePreset[] = [
  { id: "m15", label: "M15 (fc'=15 MPa) — Lean/PCC", fc: 15 },
  { id: "m20", label: "M20 (fc'=20 MPa)", fc: 20 },
  { id: "m25", label: "M25 (fc'=25 MPa)", fc: 25 },
  { id: "m30", label: "M30 (fc'=30 MPa)", fc: 30 },
  { id: "m35", label: "M35 (fc'=35 MPa)", fc: 35 },
  { id: "m40", label: "M40 (fc'=40 MPa)", fc: 40 },
  { id: "custom", label: "Custom (নিজে লিখুন)", fc: 0 },
];

/**
 * Rebar Grade প্রিসেট — Grade 40 (ASTM A615, কম প্রচলিত), Grade 60
 * (fy=414 MPa, ACI/BNBC-তে সবচেয়ে প্রচলিত), Grade 500 (fy=500 MPa,
 * BS/Eurocode-style rebar, বাংলাদেশে অনেক rolling mill-এর প্রোডাক্ট)।
 */
interface RebarGradePreset {
  id: string;
  label: string;
  fy: number;
}

const REBAR_GRADE_PRESETS: RebarGradePreset[] = [
  { id: "grade40", label: "Grade 40 (fy=276 MPa)", fy: 276 },
  { id: "grade60", label: "Grade 60 (fy=414 MPa)", fy: 414 },
  { id: "grade500", label: "Grade 500 (fy=500 MPa)", fy: 500 },
  { id: "custom", label: "Custom (নিজে লিখুন)", fy: 0 },
];

/**
 * প্রতিটা material type-এর জন্য "primary strength field" আলাদা নামে
 * (fc, fy, bendingStrength ইত্যাদি) — একটা কনফিগ ম্যাপ দিয়ে ফর্মকে
 * generic রাখা হয়েছে, যাতে নতুন material type যোগ করতে শুধু এই
 * অ্যারেতে একটা এন্ট্রি যোগ করলেই চলে, ফর্ম JSX বদলাতে হয় না।
 */
interface MaterialTypeConfig {
  type: MaterialType;
  label: string;
  fieldLabel: string; // ইনপুট ফিল্ডের label, যেমন "f'c (MPa)"
  placeholder: string;
  createDefault: (id: string, name: string) => StructuralMaterial;
  /** ফর্মের strength input থেকে পাওয়া মান material অবজেক্টে বসায়। */
  applyStrength: (material: StructuralMaterial, value: number) => StructuralMaterial;
  /** লিস্টে দেখানোর জন্য সংক্ষিপ্ত সারাংশ। */
  summarize: (material: StructuralMaterial) => string;
}

const MATERIAL_CONFIGS: MaterialTypeConfig[] = [
  {
    type: "concrete",
    label: "Concrete",
    fieldLabel: "f'c (MPa)",
    placeholder: "28",
    createDefault: createDefaultConcreteMaterial,
    applyStrength: (m, v) => (m.type === "concrete" ? { ...m, fc: v } : m),
    summarize: (m) => (m.type === "concrete" ? `f'c=${m.fc} MPa, rebar fy=${m.rebarFy ?? 414} MPa` : ""),
  },
  {
    type: "steel",
    label: "Steel",
    fieldLabel: "fy (MPa)",
    placeholder: "345",
    createDefault: createDefaultSteelMaterial,
    // fu কে fy এর সাথে একটা যুক্তিসঙ্গত অনুপাতে রাখা হচ্ছে (AISC তে
    // সাধারণ Fu/Fy অনুপাত ~1.3, A992 এর জন্য প্রায় এমনই দেখা যায়)।
    applyStrength: (m, v) =>
      m.type === "steel" ? { ...m, fy: v, fu: Math.round(v * 1.3) } : m,
    summarize: (m) => (m.type === "steel" ? `fy=${m.fy} MPa` : ""),
  },
  {
    type: "timber",
    label: "Timber",
    fieldLabel: "Fb (MPa)",
    placeholder: "10",
    createDefault: createDefaultTimberMaterial,
    applyStrength: (m, v) => (m.type === "timber" ? { ...m, bendingStrength: v } : m),
    summarize: (m) => (m.type === "timber" ? `Fb=${m.bendingStrength} MPa` : ""),
  },
  {
    type: "aluminium",
    label: "Aluminium",
    fieldLabel: "Fty (MPa)",
    placeholder: "240",
    createDefault: createDefaultAluminiumMaterial,
    // Ftu কে Fty এর সাথে একটা যুক্তিসঙ্গত অনুপাতে রাখা হচ্ছে (6061-T6
    // এর জন্য Ftu/Fty ≈ 1.08, খুবই কম ductility reserve — এটা
    // aluminium alloy এর একটা পরিচিত বৈশিষ্ট্য, স্টিলের তুলনায়)।
    applyStrength: (m, v) =>
      m.type === "aluminium" ? { ...m, fty: v, ftu: Math.round(v * 1.08) } : m,
    summarize: (m) => (m.type === "aluminium" ? `Fty=${m.fty} MPa` : ""),
  },
  {
    type: "frp",
    label: "FRP",
    fieldLabel: "Tensile Strength (MPa)",
    placeholder: "3800",
    createDefault: createDefaultFrpMaterial,
    applyStrength: (m, v) => (m.type === "frp" ? { ...m, tensileStrength: v } : m),
    summarize: (m) => (m.type === "frp" ? `${m.fiberType ?? "FRP"}, fu=${m.tensileStrength} MPa` : ""),
  },
  {
    type: "glass",
    label: "Glass",
    fieldLabel: "Bending Strength (MPa)",
    placeholder: "20",
    createDefault: createDefaultGlassMaterial,
    applyStrength: (m, v) => (m.type === "glass" ? { ...m, bendingStrength: v } : m),
    summarize: (m) => (m.type === "glass" ? `${m.glassType ?? "glass"}, ${m.bendingStrength} MPa` : ""),
  },
  {
    type: "composite",
    label: "Composite",
    fieldLabel: "Effective E (MPa)",
    placeholder: "150000",
    createDefault: createDefaultCompositeMaterial,
    applyStrength: (m, v) =>
      m.type === "composite" ? { ...m, effectiveElasticModulus: v } : m,
    summarize: (m) => (m.type === "composite" ? `Eeff=${m.effectiveElasticModulus} MPa` : ""),
  },
];

function getConfig(type: MaterialType): MaterialTypeConfig {
  const config = MATERIAL_CONFIGS.find((c) => c.type === type);
  if (!config) {
    // এটা কখনো ঘটার কথা না (MaterialType ও MATERIAL_CONFIGS সবসময়
    // সিঙ্কে থাকা উচিত), কিন্তু TypeScript-কে নিশ্চিত করতে এবং
    // silent undefined bug এড়াতে explicit error।
    throw new Error(`No config found for material type: ${type}`);
  }
  return config;
}

export function MaterialPanel({ onAddMaterial, onDeleteMaterial }: MaterialPanelProps) {
  const materials = useLibraryStore((s) => s.materialLibrary.materials);

  const [materialType, setMaterialType] = useState<MaterialType>("concrete");
  const [name, setName] = useState("");
  // ডিফল্ট material type "concrete" এবং ডিফল্ট গ্রেড "m25" — তাই strength
  // ফিল্ড শুরুতেই সেই প্রিসেট মান (25) দিয়ে prefill করা, খালি না রেখে।
  const [strengthValue, setStrengthValue] = useState("25");
  const [rebarFyValue, setRebarFyValue] = useState("414");
  const [formError, setFormError] = useState<string | null>(null);

  // Concrete-এর জন্য গ্রেড প্রিসেট সিলেকশন (M20/M25/... ও Grade 60/...)।
  // "custom" বেছে নিলে নিচের numeric input দুটো ম্যানুয়ালি এডিটযোগ্য
  // থাকে, নাহলে প্রিসেট মান দিয়ে lock করা থাকে (typo এড়াতে)।
  const [concreteGradeId, setConcreteGradeId] = useState<string>("m25");
  const [rebarGradeId, setRebarGradeId] = useState<string>("grade60");

  const activeConfig = getConfig(materialType);
  const isConcreteCustomGrade = concreteGradeId === "custom";
  const isRebarCustomGrade = rebarGradeId === "custom";

  function handleConcreteGradeChange(gradeId: string) {
    setConcreteGradeId(gradeId);
    const preset = CONCRETE_GRADE_PRESETS.find((g) => g.id === gradeId);
    if (preset && gradeId !== "custom") {
      setStrengthValue(String(preset.fc));
      // নাম খালি থাকলে বা আগের প্রিসেট নাম থেকে বদলায়নি এমন ক্ষেত্রে
      // সুবিধাজনক ডিফল্ট নাম বসিয়ে দেওয়া হয় — ইউজার চাইলে ওভাররাইট
      // করতে পারবেন, তাই trim করে খালি থাকলেই শুধু বসানো হচ্ছে।
      setName((prev) => (prev.trim() === "" ? preset.label.split(" (")[0] : prev));
    }
  }

  function handleRebarGradeChange(gradeId: string) {
    setRebarGradeId(gradeId);
    const preset = REBAR_GRADE_PRESETS.find((g) => g.id === gradeId);
    if (preset && gradeId !== "custom") {
      setRebarFyValue(String(preset.fy));
    }
  }

  function resetForm() {
    setName("");
    setStrengthValue("");
    setRebarFyValue("414");
    setConcreteGradeId("m25");
    setRebarGradeId("grade60");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Material নাম আবশ্যক");
      return;
    }

    const value = Number(strengthValue);
    if (strengthValue.trim() === "" || Number.isNaN(value) || value <= 0) {
      setFormError(`${activeConfig.fieldLabel} একটা বৈধ পজিটিভ সংখ্যা হতে হবে`);
      return;
    }

    const id = makeMaterialId();
    const baseMaterial = activeConfig.createDefault(id, trimmedName);
    let material = activeConfig.applyStrength(baseMaterial, value);

    if (material.type === "concrete") {
      const rebarFy = Number(rebarFyValue);
      if (rebarFyValue.trim() !== "" && !Number.isNaN(rebarFy) && rebarFy > 0) {
        material = { ...material, rebarFy };
      }
    }

    onAddMaterial(material);
    resetForm();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Material Library</h3>

        {materials.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো material যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {materials.map((material) => (
              <li
                key={material.materialId}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-hover text-text-secondary"
              >
                <span>
                  <span className="font-medium">{material.name}</span>
                  <span className="text-text-muted ml-1.5 text-xs">
                    {getConfig(material.type).summarize(material)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteMaterial(material.materialId)}
                  className="text-xs text-red-500/70 hover:text-red-600 px-1"
                  title="ডিলিট করুন"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">ধরন</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MATERIAL_CONFIGS.map((config) => (
              <button
                key={config.type}
                type="button"
                onClick={() => {
                  setMaterialType(config.type);
                  if (config.type === "concrete") {
                    // concrete এ ফিরে এলে বর্তমানে সিলেক্ট করা গ্রেড প্রিসেট
                    // অনুযায়ী strength আবার prefill করা হয়।
                    handleConcreteGradeChange(concreteGradeId);
                  } else {
                    setStrengthValue("");
                  }
                }}
                className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                  materialType === config.type
                    ? "bg-brand-600 text-white"
                    : "bg-surface-card border border-surface-border text-text-secondary"
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {materialType === "composite" && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2">
            ⚠️ Composite material-এর effective property এখানে placeholder
            হিসেবে থাকে। প্রকৃত transformed-section হিসাব ছাড়া ডিফল্ট
            মান ব্যবহার করবেন না — নিজে হিসাব করে বসান।
          </p>
        )}

        {materialType === "concrete" && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Concrete Grade</label>
            <select
              value={concreteGradeId}
              onChange={(e) => handleConcreteGradeChange(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              {CONCRETE_GRADE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-text-muted mb-1">নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${activeConfig.label} Material`}
            className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">{activeConfig.fieldLabel}</label>
          <input
            type="number"
            step="any"
            value={strengthValue}
            onChange={(e) => setStrengthValue(e.target.value)}
            placeholder={activeConfig.placeholder}
            readOnly={materialType === "concrete" && !isConcreteCustomGrade}
            className={`w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/20 ${
              materialType === "concrete" && !isConcreteCustomGrade
                ? "bg-surface border-surface-border text-text-muted"
                : "bg-surface-card border-surface-border text-text-primary"
            }`}
          />
        </div>

        {materialType === "concrete" && (
          <>
            <div>
              <label className="block text-xs text-text-muted mb-1">Rebar Grade</label>
              <select
                value={rebarGradeId}
                onChange={(e) => handleRebarGradeChange(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                {REBAR_GRADE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Rebar fy (MPa) — Phase 6 RC Design এ ব্যবহৃত হবে
              </label>
              <input
                type="number"
                step="any"
                value={rebarFyValue}
                onChange={(e) => setRebarFyValue(e.target.value)}
                placeholder="414"
                readOnly={!isRebarCustomGrade}
                className={`w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/20 ${
                  !isRebarCustomGrade
                    ? "bg-surface border-surface-border text-text-muted"
                    : "bg-surface-card border-surface-border text-text-primary"
                }`}
              />
            </div>
          </>
        )}

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + Material যোগ করুন
        </button>
      </form>
    </div>
  );
}
