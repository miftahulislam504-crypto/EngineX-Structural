"use client";

import { useState } from "react";
import type { LoadCategory, LoadPattern } from "@/lib/types/load";
import { createLoadPattern, PLACEHOLDER_LOAD_CATEGORIES } from "@/lib/types/load";
import { useLoadStore } from "@/lib/loads/useLoadStore";

interface LoadPatternPanelProps {
  onAddPattern: (pattern: LoadPattern) => void;
  onDeletePattern: (patternId: string) => void;
}

/**
 * সব functional (non-placeholder) category এখানে দেখানো হয়। wind ও
 * earthquake এর জন্য এখানে শুধু pattern তৈরি করা হয় (নাম দেওয়া) —
 * প্রকৃত BNBC calculation WindLoadPanel/SeismicLoadPanel এ আলাদাভাবে
 * হয়, তারপর সেই ফলাফল থেকে element-level load case তৈরি হয়।
 */
const RAW_CATEGORY_OPTIONS: { value: LoadCategory; label: string }[] = [
  { value: "dead", label: "Dead (DL)" },
  { value: "live", label: "Live (LL)" },
  { value: "wind", label: "Wind" },
  { value: "earthquake", label: "Earthquake" },
  { value: "snow", label: "Snow" },
  { value: "rain", label: "Rain" },
  { value: "temperature", label: "Temperature" },
  { value: "settlement", label: "Settlement" },
  { value: "hydrostatic", label: "Hydrostatic" },
  { value: "soil-pressure", label: "Soil Pressure" },
  { value: "impact", label: "Impact" },
  { value: "dynamic", label: "Dynamic" },
  { value: "construction", label: "Construction" },
  { value: "equipment", label: "Equipment" },
  { value: "custom", label: "Custom" },
];

/**
 * placeholder category (moving-vehicle, bridge, blast) যদি ভুলবশত
 * উপরের তালিকায় যোগ হয়ে যায় (ভবিষ্যতে কেউ কপি-পেস্ট করার সময়), এই
 * filter সেটা runtime এ বাদ দেয় — একটা defensive safeguard, যাতে
 * এমন কোনো category কখনো UI তে select করার সুযোগ না পায় যেটার
 * জন্য কোনো নির্ভরযোগ্য calculation নেই।
 */
const CATEGORY_OPTIONS = RAW_CATEGORY_OPTIONS.filter(
  (opt) => !PLACEHOLDER_LOAD_CATEGORIES.has(opt.value)
);

export function LoadPatternPanel({ onAddPattern, onDeletePattern }: LoadPatternPanelProps) {
  const patterns = useLoadStore((s) => s.patternLibrary.patterns);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<LoadCategory>("dead");
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Pattern নাম আবশ্যক (যেমন: Dead Load (DL))");
      return;
    }

    const pattern = createLoadPattern({
      name: trimmedName,
      category,
      selfWeightMultiplier: category === "dead" ? 1.0 : undefined,
    });

    onAddPattern(pattern);
    resetForm();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Load Patterns</h3>

        {patterns.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো load pattern যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {patterns.map((pattern) => {
              const isAuto = pattern.patternId.startsWith("pattern-auto-");
              return (
                <li
                  key={pattern.patternId}
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-hover text-text-secondary"
                >
                  <span>
                    {isAuto && (
                      <span
                        className="text-[10px] bg-brand-500/10 text-brand-600 rounded px-1 py-0.5 mr-1.5"
                        title="Hub এর BNBC settings + model geometry থেকে স্বয়ংক্রিয়ভাবে তৈরি ও আপডেট হয় (real-time auto-sync)"
                      >
                        🤖 Auto
                      </span>
                    )}
                    <span className="font-medium">{pattern.name}</span>
                    <span className="text-text-muted ml-1.5 text-xs">({pattern.category})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeletePattern(pattern.patternId)}
                    className="text-xs text-red-500/70 hover:text-red-600 px-1"
                    title={isAuto ? "Auto-generated — ডিলিট করলেও Hub ডেটা অপরিবর্তিত থাকলে auto-sync এ আবার ফিরে আসবে" : "ডিলিট করুন"}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">ক্যাটাগরি</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as LoadCategory)}
            className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dead Load (DL)"
            className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
          />
        </div>

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + Pattern যোগ করুন
        </button>
      </form>

      <div className="text-xs text-text-muted border-t border-surface-border pt-3">
        <p>
          ℹ️ Bridge Load, Vehicle/Moving Load, এবং Blast Load এখানে দেওয়া হয়নি — এগুলোর
          নির্ভরযোগ্য গণনা এখনো সাপোর্টেড না (কারণ বিস্তারিত{" "}
          <code className="text-text-muted">src/lib/types/load.ts</code> এর হেডার মন্তব্যে)।
        </p>
      </div>
    </div>
  );
}
