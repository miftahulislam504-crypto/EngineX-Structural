"use client";

import { useState, useMemo } from "react";
import type { SectionShape, StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";
import { useLibraryStore } from "@/lib/library/useLibraryStore";

interface SectionPanelProps {
  onAddSection: (section: StructuralSection) => void;
  onDeleteSection: (sectionId: string) => void;
}

function makeSectionId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Standard Rectangular Section প্রিসেট — বাংলাদেশে প্রচলিত RC beam/
 * column/footing size (BNBC 2020 প্র্যাকটিসে সাধারণত ব্যবহৃত রেঞ্জ)।
 * এগুলো শুধু সুবিধাজনক শুরুর বিন্দু — সিলেক্ট করলে width/depth
 * autofill হয়, কিন্তু ইউজার চাইলে পরে সংখ্যা বদলাতে পারবেন (তাই
 * প্রিসেট সিলেক্ট করলেও ফিল্ড lock করা হয়নি, Material Grade dropdown
 * এর মতো — কারণ section dimension প্রায়ই সাইট-নির্দিষ্ট কারণে সামান্য
 * bespoke, concrete/rebar grade-এর মতো একেবারে fixed catalog না)।
 */
interface StandardSizePreset {
  id: string;
  label: string; // যেমন "Beam 250×450"
  width: number; // mm
  depth: number; // mm
}

/**
 * Beam প্রিসেট — বাংলাদেশে প্রচলিত রেঞ্জ: width সাধারণত 200-400mm
 * (25mm গ্রিডে), depth 300-750mm (50mm গ্রিডে)। L/12 থেকে L/10
 * span-to-depth অনুপাত অনুযায়ী সাধারণ প্র্যাকটিসে যেসব কম্বিনেশন
 * বাস্তবে ব্যবহৃত হয়, সেগুলোর মোটামুটি পূর্ণ ম্যাট্রিক্স — যাতে
 * কোনো একটা প্রচলিত সাইজ বাদ না পড়ে।
 */
const STANDARD_BEAM_PRESETS: StandardSizePreset[] = [
  // 200mm width
  { id: "beam-200x300", label: "Beam 200×300", width: 200, depth: 300 },
  { id: "beam-200x350", label: "Beam 200×350", width: 200, depth: 350 },
  { id: "beam-200x400", label: "Beam 200×400", width: 200, depth: 400 },
  { id: "beam-200x450", label: "Beam 200×450", width: 200, depth: 450 },
  // 230mm width
  { id: "beam-230x300", label: "Beam 230×300", width: 230, depth: 300 },
  { id: "beam-230x350", label: "Beam 230×350", width: 230, depth: 350 },
  { id: "beam-230x400", label: "Beam 230×400", width: 230, depth: 400 },
  { id: "beam-230x450", label: "Beam 230×450", width: 230, depth: 450 },
  { id: "beam-230x500", label: "Beam 230×500", width: 230, depth: 500 },
  // 250mm width
  { id: "beam-250x350", label: "Beam 250×350", width: 250, depth: 350 },
  { id: "beam-250x400", label: "Beam 250×400", width: 250, depth: 400 },
  { id: "beam-250x450", label: "Beam 250×450", width: 250, depth: 450 },
  { id: "beam-250x500", label: "Beam 250×500", width: 250, depth: 500 },
  { id: "beam-250x550", label: "Beam 250×550", width: 250, depth: 550 },
  { id: "beam-250x600", label: "Beam 250×600", width: 250, depth: 600 },
  // 300mm width
  { id: "beam-300x400", label: "Beam 300×400", width: 300, depth: 400 },
  { id: "beam-300x450", label: "Beam 300×450", width: 300, depth: 450 },
  { id: "beam-300x500", label: "Beam 300×500", width: 300, depth: 500 },
  { id: "beam-300x550", label: "Beam 300×550", width: 300, depth: 550 },
  { id: "beam-300x600", label: "Beam 300×600", width: 300, depth: 600 },
  { id: "beam-300x650", label: "Beam 300×650", width: 300, depth: 650 },
  { id: "beam-300x700", label: "Beam 300×700", width: 300, depth: 700 },
  // 350mm width
  { id: "beam-350x450", label: "Beam 350×450", width: 350, depth: 450 },
  { id: "beam-350x500", label: "Beam 350×500", width: 350, depth: 500 },
  { id: "beam-350x600", label: "Beam 350×600", width: 350, depth: 600 },
  { id: "beam-350x650", label: "Beam 350×650", width: 350, depth: 650 },
  { id: "beam-350x700", label: "Beam 350×700", width: 350, depth: 700 },
  // 400mm width (transfer beam / ভারী লোড)
  { id: "beam-400x500", label: "Beam 400×500", width: 400, depth: 500 },
  { id: "beam-400x600", label: "Beam 400×600", width: 400, depth: 600 },
  { id: "beam-400x650", label: "Beam 400×650", width: 400, depth: 650 },
  { id: "beam-400x700", label: "Beam 400×700", width: 400, depth: 700 },
  { id: "beam-400x750", label: "Beam 400×750 (transfer beam)", width: 400, depth: 750 },
];

/**
 * Column প্রিসেট — square (সবচেয়ে প্রচলিত) এবং rectangular দুই ধরনই,
 * 200mm থেকে 600mm রেঞ্জে 25/50mm গ্রিডে।
 */
const STANDARD_COLUMN_PRESETS: StandardSizePreset[] = [
  // Square columns
  { id: "col-200x200", label: "Column 200×200", width: 200, depth: 200 },
  { id: "col-225x225", label: "Column 225×225", width: 225, depth: 225 },
  { id: "col-250x250", label: "Column 250×250", width: 250, depth: 250 },
  { id: "col-275x275", label: "Column 275×275", width: 275, depth: 275 },
  { id: "col-300x300", label: "Column 300×300", width: 300, depth: 300 },
  { id: "col-325x325", label: "Column 325×325", width: 325, depth: 325 },
  { id: "col-350x350", label: "Column 350×350", width: 350, depth: 350 },
  { id: "col-375x375", label: "Column 375×375", width: 375, depth: 375 },
  { id: "col-400x400", label: "Column 400×400", width: 400, depth: 400 },
  { id: "col-450x450", label: "Column 450×450", width: 450, depth: 450 },
  { id: "col-500x500", label: "Column 500×500", width: 500, depth: 500 },
  { id: "col-550x550", label: "Column 550×550", width: 550, depth: 550 },
  { id: "col-600x600", label: "Column 600×600 (ভারী লোড)", width: 600, depth: 600 },
  // Rectangular columns
  { id: "col-250x300", label: "Column 250×300", width: 250, depth: 300 },
  { id: "col-250x350", label: "Column 250×350", width: 250, depth: 350 },
  { id: "col-250x400", label: "Column 250×400", width: 250, depth: 400 },
  { id: "col-300x350", label: "Column 300×350", width: 300, depth: 350 },
  { id: "col-300x400", label: "Column 300×400", width: 300, depth: 400 },
  { id: "col-300x450", label: "Column 300×450", width: 300, depth: 450 },
  { id: "col-300x500", label: "Column 300×500", width: 300, depth: 500 },
  { id: "col-350x450", label: "Column 350×450", width: 350, depth: 450 },
  { id: "col-350x500", label: "Column 350×500", width: 350, depth: 500 },
  { id: "col-400x500", label: "Column 400×500", width: 400, depth: 500 },
  { id: "col-400x600", label: "Column 400×600", width: 400, depth: 600 },
  { id: "col-450x600", label: "Column 450×600 (shear wall-এর কাছাকাছি কলাম)", width: 450, depth: 600 },
];

/** Footing প্রিসেট — isolated footing-এ প্রচলিত রেঞ্জ, 100mm গ্রিডে বিস্তৃত। */
const STANDARD_FOOTING_PRESETS: StandardSizePreset[] = [
  { id: "foot-900x900", label: "Footing 900×900", width: 900, depth: 900 },
  { id: "foot-1000x1000", label: "Footing 1000×1000", width: 1000, depth: 1000 },
  { id: "foot-1100x1100", label: "Footing 1100×1100", width: 1100, depth: 1100 },
  { id: "foot-1200x1200", label: "Footing 1200×1200", width: 1200, depth: 1200 },
  { id: "foot-1300x1300", label: "Footing 1300×1300", width: 1300, depth: 1300 },
  { id: "foot-1400x1400", label: "Footing 1400×1400", width: 1400, depth: 1400 },
  { id: "foot-1500x1500", label: "Footing 1500×1500", width: 1500, depth: 1500 },
  { id: "foot-1600x1600", label: "Footing 1600×1600", width: 1600, depth: 1600 },
  { id: "foot-1700x1700", label: "Footing 1700×1700", width: 1700, depth: 1700 },
  { id: "foot-1800x1800", label: "Footing 1800×1800", width: 1800, depth: 1800 },
  { id: "foot-2000x2000", label: "Footing 2000×2000", width: 2000, depth: 2000 },
  { id: "foot-2200x2200", label: "Footing 2200×2200", width: 2200, depth: 2200 },
  { id: "foot-2400x2400", label: "Footing 2400×2400", width: 2400, depth: 2400 },
  { id: "foot-2500x2500", label: "Footing 2500×2500 (ভারী লোড)", width: 2500, depth: 2500 },
];

/** Slab প্রিসেট — 1m strip equivalent rectangular section, thickness 100-225mm। */
const STANDARD_SLAB_PRESETS: StandardSizePreset[] = [
  { id: "slab-1000x100", label: "Slab (100mm thick, 1m strip)", width: 1000, depth: 100 },
  { id: "slab-1000x125", label: "Slab (125mm thick, 1m strip)", width: 1000, depth: 125 },
  { id: "slab-1000x150", label: "Slab (150mm thick, 1m strip)", width: 1000, depth: 150 },
  { id: "slab-1000x175", label: "Slab (175mm thick, 1m strip)", width: 1000, depth: 175 },
  { id: "slab-1000x200", label: "Slab (200mm thick, 1m strip)", width: 1000, depth: 200 },
  { id: "slab-1000x225", label: "Slab (225mm thick, 1m strip — ভারী লোড/ফ্ল্যাট স্ল্যাব)", width: 1000, depth: 225 },
];

/**
 * সব rectangular preset একসাথে গ্রুপ করা — dropdown-এ Beam/Column/
 * Footing/Slab সেকশন হেডিং সহ দেখানোর জন্য। Slab-কে সাধারণত rectangular
 * "section" হিসেবে মডেল করা হয় না (এটা area element), কিন্তু এখানে
 * সুবিধার জন্য 1m-strip equivalent rectangular section হিসেবে দেওয়া
 * হলো — কেউ hand-calculation বা beam-strip পদ্ধতিতে slab ডিজাইন
 * করতে চাইলে কাজে লাগবে।
 */
const PRESET_GROUPS: { groupLabel: string; presets: StandardSizePreset[] }[] = [
  { groupLabel: "Beam", presets: STANDARD_BEAM_PRESETS },
  { groupLabel: "Column", presets: STANDARD_COLUMN_PRESETS },
  { groupLabel: "Footing", presets: STANDARD_FOOTING_PRESETS },
  { groupLabel: "Slab (1m strip)", presets: STANDARD_SLAB_PRESETS },
];

const ALL_STANDARD_PRESETS: StandardSizePreset[] = PRESET_GROUPS.flatMap((g) => g.presets);

/**
 * Phase 2a: rectangular, w-shape।
 * Phase 2c: + built-up-i (একই geometry pattern, তাই একই dimension
 * ফর্ম পুনর্ব্যবহার করা হচ্ছে শুধু label ভিন্ন)।
 *
 * composite/prestressed/cold-formed ইচ্ছাকৃতভাবে এই ফর্মে যোগ করা
 * হয়নি — src/lib/types/section.ts এ computeSectionProperties এই
 * shape গুলোর জন্য explicit error ছোঁড়ে (pure geometry থেকে নির্ভরযোগ্য
 * সংখ্যা বের করা যায় না বলে), তাই UI দিয়ে তৈরি করার সুযোগ দেওয়া মানে
 * ইউজারকে এমন কিছু তৈরি করতে দেওয়া যেটা ব্যবহার করার চেষ্টা করলেই
 * error দেবে। তাদের নিজস্ব calculator (Phase 6) তৈরি হলে তখন এই
 * ফর্মে যোগ করা হবে।
 */
type FormShape = Extract<SectionShape, "rectangular" | "w-shape" | "built-up-i">;

export function SectionPanel({ onAddSection, onDeleteSection }: SectionPanelProps) {
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);

  const [shape, setShape] = useState<FormShape>("rectangular");
  const [name, setName] = useState("");

  // rectangular fields
  const [width, setWidth] = useState("300");
  const [depth, setDepth] = useState("500");
  const [standardPresetId, setStandardPresetId] = useState<string>("custom");

  function handleStandardPresetChange(presetId: string) {
    setStandardPresetId(presetId);
    if (presetId === "custom") return;
    const preset = ALL_STANDARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setWidth(String(preset.width));
    setDepth(String(preset.depth));
    setName((prev) => (prev.trim() === "" ? preset.label.split(" (")[0] : prev));
  }

  // w-shape / built-up-i fields (দুটোই একই geometry shape, তাই একই state শেয়ার করে)
  const [wDepth, setWDepth] = useState("310");
  const [flangeWidth, setFlangeWidth] = useState("165");
  const [flangeThickness, setFlangeThickness] = useState("9.65");
  const [webThickness, setWebThickness] = useState("5.84");

  const [formError, setFormError] = useState<string | null>(null);

  // লাইভ প্রিভিউ — ফর্মে নম্বর বদলানোর সাথে সাথে section properties
  // দেখানো হয়, যাতে ইঞ্জিনিয়ার সেভ করার আগেই টাইপো/অবাস্তব মান ধরতে পারেন।
  const previewProperties = useMemo(() => {
    try {
      if (shape === "rectangular") {
        const b = Number(width);
        const h = Number(depth);
        if (!b || !h || b <= 0 || h <= 0) return null;
        return computeSectionProperties({
          sectionId: "preview",
          name: "preview",
          shape: "rectangular",
          source: "user-defined",
          width: b,
          depth: h,
          createdAt: "",
          updatedAt: "",
        });
      }

      const d = Number(wDepth);
      const bf = Number(flangeWidth);
      const tf = Number(flangeThickness);
      const tw = Number(webThickness);
      if (!d || !bf || !tf || !tw || d <= 2 * tf) return null;

      if (shape === "w-shape") {
        return computeSectionProperties({
          sectionId: "preview",
          name: "preview",
          shape: "w-shape",
          source: "user-defined",
          depth: d,
          flangeWidth: bf,
          flangeThickness: tf,
          webThickness: tw,
          createdAt: "",
          updatedAt: "",
        });
      }

      // built-up-i
      return computeSectionProperties({
        sectionId: "preview",
        name: "preview",
        shape: "built-up-i",
        source: "user-defined",
        overallDepth: d,
        flangeWidth: bf,
        flangeThickness: tf,
        webThickness: tw,
        createdAt: "",
        updatedAt: "",
      });
    } catch {
      return null;
    }
  }, [shape, width, depth, wDepth, flangeWidth, flangeThickness, webThickness]);

  function resetForm() {
    setName("");
    setFormError(null);
    setStandardPresetId("custom");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Section নাম আবশ্যক");
      return;
    }

    const id = makeSectionId();
    const now = new Date().toISOString();

    if (shape === "rectangular") {
      const b = Number(width);
      const h = Number(depth);
      if (!b || !h || b <= 0 || h <= 0) {
        setFormError("Width ও Depth বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
        return;
      }
      onAddSection({
        sectionId: id,
        name: trimmedName,
        shape: "rectangular",
        source: "user-defined",
        width: b,
        depth: h,
        createdAt: now,
        updatedAt: now,
      });
      resetForm();
      return;
    }

    // w-shape ও built-up-i একই dimension validation শেয়ার করে
    const d = Number(wDepth);
    const bf = Number(flangeWidth);
    const tf = Number(flangeThickness);
    const tw = Number(webThickness);

    if (!d || !bf || !tf || !tw || d <= 0 || bf <= 0 || tf <= 0 || tw <= 0) {
      setFormError("সব ডাইমেনশন বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (d <= 2 * tf) {
      setFormError("Depth অবশ্যই 2×Flange Thickness এর চেয়ে বেশি হতে হবে");
      return;
    }

    if (shape === "w-shape") {
      onAddSection({
        sectionId: id,
        name: trimmedName,
        shape: "w-shape",
        source: "user-defined",
        depth: d,
        flangeWidth: bf,
        flangeThickness: tf,
        webThickness: tw,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      onAddSection({
        sectionId: id,
        name: trimmedName,
        shape: "built-up-i",
        source: "user-defined",
        overallDepth: d,
        flangeWidth: bf,
        flangeThickness: tf,
        webThickness: tw,
        createdAt: now,
        updatedAt: now,
      });
    }

    resetForm();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Section Library</h3>

        {sections.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো section যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {sections.map((section) => (
              <li
                key={section.sectionId}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-hover text-text-secondary"
              >
                <span>
                  <span className="font-medium">{section.name}</span>
                  <span className="text-text-muted ml-1.5 text-xs">({section.shape})</span>
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteSection(section.sectionId)}
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
          <label className="block text-xs text-text-muted mb-1">আকৃতি</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setShape("rectangular")}
              className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                shape === "rectangular"
                  ? "bg-brand-600 text-white"
                  : "bg-surface-card border border-surface-border text-text-secondary"
              }`}
            >
              Rectangular
            </button>
            <button
              type="button"
              onClick={() => setShape("w-shape")}
              className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                shape === "w-shape"
                  ? "bg-brand-600 text-white"
                  : "bg-surface-card border border-surface-border text-text-secondary"
              }`}
            >
              W-Shape
            </button>
            <button
              type="button"
              onClick={() => setShape("built-up-i")}
              className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                shape === "built-up-i"
                  ? "bg-brand-600 text-white"
                  : "bg-surface-card border border-surface-border text-text-secondary"
              }`}
            >
              Built-up I
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              shape === "rectangular" ? "300x500 RC Beam" : shape === "w-shape" ? "W12x26" : "BU-I-600"
            }
            className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
          />
        </div>

        {shape === "rectangular" ? (
          <>
            <div>
              <label className="block text-xs text-text-muted mb-1">Standard Size</label>
              <select
                value={standardPresetId}
                onChange={(e) => handleStandardPresetChange(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="custom">Custom (নিজে লিখুন)</option>
                {PRESET_GROUPS.map((group) => (
                  <optgroup key={group.groupLabel} label={group.groupLabel}>
                    {group.presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Width b (mm)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => {
                    setWidth(e.target.value);
                    setStandardPresetId("custom");
                  }}
                  className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Depth h (mm)</label>
                <input
                  type="number"
                  value={depth}
                  onChange={(e) => {
                    setDepth(e.target.value);
                    setStandardPresetId("custom");
                  }}
                  className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Depth d (mm)</label>
              <input
                type="number"
                value={wDepth}
                onChange={(e) => setWDepth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Flange Width bf (mm)</label>
              <input
                type="number"
                value={flangeWidth}
                onChange={(e) => setFlangeWidth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Flange Thickness tf (mm)</label>
              <input
                type="number"
                step="any"
                value={flangeThickness}
                onChange={(e) => setFlangeThickness(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Web Thickness tw (mm)</label>
              <input
                type="number"
                step="any"
                value={webThickness}
                onChange={(e) => setWebThickness(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>
        )}

        {previewProperties && (
          <div className="rounded-md bg-surface border border-surface-border px-2.5 py-2 text-xs text-text-secondary space-y-0.5">
            <p>A = {previewProperties.area.toFixed(0)} mm²</p>
            <p>
              Ixx = {previewProperties.ixx.toExponential(3)} mm⁴, Iyy ={" "}
              {previewProperties.iyy.toExponential(3)} mm⁴
            </p>
          </div>
        )}

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + Section যোগ করুন
        </button>
      </form>
    </div>
  );
}
