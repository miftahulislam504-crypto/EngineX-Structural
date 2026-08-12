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
  const [strengthValue, setStrengthValue] = useState("");
  const [rebarFyValue, setRebarFyValue] = useState("414");
  const [formError, setFormError] = useState<string | null>(null);

  const activeConfig = getConfig(materialType);

  function resetForm() {
    setName("");
    setStrengthValue("");
    setRebarFyValue("414");
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
                onClick={() => setMaterialType(config.type)}
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
            className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
          />
        </div>

        {materialType === "concrete" && (
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
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>
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
