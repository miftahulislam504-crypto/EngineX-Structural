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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Width b (mm)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Depth h (mm)</label>
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>
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
