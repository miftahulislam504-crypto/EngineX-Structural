"use client";

import { useState } from "react";
import type { LoadCombinationFactor } from "@/lib/loads/loadCombinations";
import { createCustomLoadCombination } from "@/lib/loads/loadCombinations";
import { useLoadStore } from "@/lib/loads/useLoadStore";

interface LoadCombinationPanelProps {
  onToggleCombination: (combinationId: string, isEnabled: boolean) => void;
  onAddCustomCombination: (combination: ReturnType<typeof createCustomLoadCombination>) => void;
}

export function LoadCombinationPanel({
  onToggleCombination,
  onAddCustomCombination,
}: LoadCombinationPanelProps) {
  const combinations = useLoadStore((s) => s.combinationLibrary.combinations);
  const patterns = useLoadStore((s) => s.patternLibrary.patterns);

  const [customName, setCustomName] = useState("");
  const [customFactors, setCustomFactors] = useState<LoadCombinationFactor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFactor, setSelectedFactor] = useState("1.0");
  const [formError, setFormError] = useState<string | null>(null);

  const availableCategories = Array.from(new Set(patterns.map((p) => p.category)));

  function handleAddFactor() {
    if (!selectedCategory) return;
    const factorValue = Number(selectedFactor);
    if (Number.isNaN(factorValue)) return;

    setCustomFactors((prev) => [
      ...prev.filter((f) => f.patternCategory !== selectedCategory),
      { patternCategory: selectedCategory, factor: factorValue },
    ]);
  }

  function handleSubmitCustom(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setFormError("Combination নাম আবশ্যক");
      return;
    }
    if (customFactors.length === 0) {
      setFormError("অন্তত একটা factor যোগ করুন");
      return;
    }

    const combination = createCustomLoadCombination({
      name: trimmedName,
      factors: customFactors,
    });

    onAddCustomCombination(combination);
    setCustomName("");
    setCustomFactors([]);
    setFormError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Load Combinations</h3>
        <p className="text-xs text-slate-500 mb-2">
          ACI 318-19 Section 5.3.1 এর ডিফল্ট LRFD combination। প্রয়োজন না হলে বন্ধ রাখতে পারেন।
        </p>

        <ul className="space-y-1">
          {combinations.map((combo) => (
            <li
              key={combo.combinationId}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-800/60"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={combo.isEnabled}
                  onChange={(e) => onToggleCombination(combo.combinationId, e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
                />
                <span className={combo.isEnabled ? "text-slate-200" : "text-slate-600 line-through"}>
                  {combo.name}
                </span>
              </label>
              {combo.source === "user-defined" && (
                <span className="text-[10px] text-sky-500 uppercase tracking-wide">custom</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSubmitCustom} className="space-y-2.5 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-500">নতুন Custom Combination</p>

        <div>
          <label className="block text-xs text-slate-500 mb-1">নাম</label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="1.3D + 1.0W (custom)"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>

        {availableCategories.length === 0 ? (
          <p className="text-xs text-amber-500">
            প্রথমে অন্তত একটা Load Pattern তৈরি করুন যাতে factor যোগ করা যায়।
          </p>
        ) : (
          <div className="flex gap-1.5 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                <option value="">নির্বাচন</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-xs text-slate-500 mb-1">Factor</label>
              <input
                type="number"
                step="any"
                value={selectedFactor}
                onChange={(e) => setSelectedFactor(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
            <button
              type="button"
              onClick={handleAddFactor}
              className="rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-1.5 transition-colors"
            >
              +
            </button>
          </div>
        )}

        {customFactors.length > 0 && (
          <div className="rounded-md bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-slate-400">
            {customFactors.map((f) => `${f.factor} × ${f.patternCategory}`).join(" + ")}
          </div>
        )}

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + Combination যোগ করুন
        </button>
      </form>
    </div>
  );
}
