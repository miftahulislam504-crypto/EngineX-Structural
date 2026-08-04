"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { computeCostEstimate, type CostRateInput } from "@/lib/design/costOptimization";
import type { ElementCategory } from "@/lib/types/element";
import type { MaterialType } from "@/lib/types/material";

const CATEGORY_LABELS: Record<ElementCategory, string> = {
  beam: "Beam",
  column: "Column",
  brace: "Brace",
  pile: "Pile",
  slab: "Slab",
  wall: "Wall",
  "shear-wall": "Shear Wall",
  "core-wall": "Core Wall",
  footing: "Footing",
  "combined-footing": "Combined Footing",
  "strip-footing": "Strip Footing",
  "mat-foundation": "Mat Foundation",
  "pile-group": "Pile Group",
  "pile-cap": "Pile Cap",
};

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  concrete: "Concrete",
  steel: "Steel",
  timber: "Timber",
  aluminium: "Aluminium",
  frp: "FRP",
  glass: "Glass",
  composite: "Composite",
};

// steel প্রচলিতভাবে ওজন অনুযায়ী কেনা হয় (currency/kg); বাকি সব
// material সাধারণত volume অনুযায়ী (currency/m³) — ইঞ্জিনিয়ার চাইলে
// পরিবর্তন করতে পারবেন (composite-এর জন্য বিশেষভাবে প্রাসঙ্গিক, যেটার
// pricing basis প্রকল্পভেদে ভিন্ন হতে পারে)।
const DEFAULT_PRICING_BASIS: Record<MaterialType, "volume" | "weight"> = {
  concrete: "volume",
  steel: "weight",
  timber: "volume",
  aluminium: "weight",
  frp: "volume",
  glass: "volume",
  composite: "volume",
};

function fmt(v: number, decimals = 2): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

/**
 * Phase 9d — Cost Optimization panel। Phase 9c এর live takeoff-এর
 * উপর ভিত্তি করে, ইঞ্জিনিয়ার প্রতিটা material type-এর জন্য rate
 * ইনপুট দিলে cost breakdown দেখায়। কোনো built-in/ডিফল্ট দাম নেই।
 */
export function CostOptimizationPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);

  const materialTypesInLibrary = useMemo(() => {
    const set = new Set<MaterialType>();
    for (const m of materials) set.add(m.type);
    return Array.from(set);
  }, [materials]);

  const [rateInputs, setRateInputs] = useState<Record<MaterialType, string>>({
    concrete: "",
    steel: "",
    timber: "",
    aluminium: "",
    frp: "",
    glass: "",
    composite: "",
  });
  const [pricingBasisOverride, setPricingBasisOverride] = useState<Partial<Record<MaterialType, "volume" | "weight">>>(
    {}
  );
  const [currencyLabel, setCurrencyLabel] = useState("৳");

  const rates: CostRateInput[] = useMemo(() => {
    return materialTypesInLibrary
      .filter((mt) => rateInputs[mt] !== "" && Number(rateInputs[mt]) > 0)
      .map((mt) => ({
        materialType: mt,
        ratePerUnit: Number(rateInputs[mt]),
        pricingBasis: pricingBasisOverride[mt] ?? DEFAULT_PRICING_BASIS[mt],
      }));
  }, [materialTypesInLibrary, rateInputs, pricingBasisOverride]);

  const result = useMemo(
    () => computeCostEstimate(elements, materials, sections, rates, currencyLabel),
    [elements, materials, sections, rates, currencyLabel]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Cost Optimization — Material Cost Estimate</h3>
        <p className="text-xs text-slate-500 mb-3">
          Weight Optimization takeoff-এর উপর ইঞ্জিনিয়ার-দেওয়া unit rate প্রয়োগ করে material cost অনুমান —
          rebar/formwork/labor অন্তর্ভুক্ত না।
        </p>

        <div className="mb-3">
          <label className="block text-[10px] text-slate-500 mb-0.5">Currency Symbol</label>
          <input
            value={currencyLabel}
            onChange={(e) => setCurrencyLabel(e.target.value)}
            className="w-24 rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
          />
        </div>

        {materialTypesInLibrary.length === 0 ? (
          <p className="text-xs text-amber-500">মডেলের material library-তে কোনো material নেই — আগে Material tab-এ যোগ করুন।</p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500 font-medium">Unit Rates (মডেলে ব্যবহৃত material অনুযায়ী)</p>
            {materialTypesInLibrary.map((mt) => {
              const basis = pricingBasisOverride[mt] ?? DEFAULT_PRICING_BASIS[mt];
              return (
                <div key={mt} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{MATERIAL_TYPE_LABELS[mt]}</label>
                    <input
                      value={rateInputs[mt]}
                      onChange={(e) => setRateInputs((prev) => ({ ...prev, [mt]: e.target.value }))}
                      placeholder="rate"
                      className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Pricing Basis</label>
                    <select
                      value={basis}
                      onChange={(e) =>
                        setPricingBasisOverride((prev) => ({ ...prev, [mt]: e.target.value as "volume" | "weight" }))
                      }
                      className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
                    >
                      <option value="volume">per m³</option>
                      <option value="weight">per kg</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-600 pb-1.5">
                    {currencyLabel}/{basis === "weight" ? "kg" : "m³"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={`rounded-md border px-3 py-2.5 ${
          result.categoryCosts.length > 0 ? "bg-emerald-950/30 border-emerald-900" : "bg-amber-950/30 border-amber-900"
        }`}
      >
        <p className={`text-xs leading-relaxed ${result.categoryCosts.length > 0 ? "text-emerald-400" : "text-amber-500"}`}>
          {result.message}
        </p>
      </div>

      {result.categoryCosts.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Material</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {result.categoryCosts.map((c) => (
                <tr key={`${c.category}::${c.materialType}`} className="border-b border-slate-900 last:border-0">
                  <td className="px-3 py-1.5 text-slate-300">{CATEGORY_LABELS[c.category]}</td>
                  <td className="px-3 py-1.5 text-slate-500 capitalize">{c.materialType}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">
                    {c.pricingBasis === "weight"
                      ? `${fmt(c.totalWeightKN, 1)} kN`
                      : `${fmt(c.totalVolumeM3, 3)} m³`}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-300">
                    {c.cost !== null ? `${currencyLabel}${c.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "rate missing"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-800 font-medium">
                <td className="px-3 py-2 text-slate-200" colSpan={3}>
                  Total (material only)
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  {currencyLabel}
                  {result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {result.categoryCosts.length > 0 && <p className="text-[10px] text-slate-600">{result.currencyNote}</p>}

      {result.excluded.length > 0 && (
        <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-slate-500 font-medium mb-1">Excluded from Takeoff ({result.excluded.length})</p>
          {result.excluded.map((e) => (
            <div key={e.elementId} className="text-xs">
              <span className="text-slate-300">
                {CATEGORY_LABELS[e.category]} &quot;{e.elementLabel}&quot;
              </span>
              <span className="text-slate-500"> — {e.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
