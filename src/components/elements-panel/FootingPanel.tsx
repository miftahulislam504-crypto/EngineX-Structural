"use client";

import { useState } from "react";
import type { Point3D, StructuralElement } from "@/lib/types/element";
import { createFooting } from "@/lib/types/element";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface FootingPanelProps {
  onAddElement: (element: StructuralElement) => void;
  onDeleteElement: (elementId: string) => void;
}

function parsePoint(x: string, y: string, z: string): Point3D | null {
  const px = Number(x);
  const py = Number(y);
  const pz = Number(z);
  if ([x, y, z].some((v) => v.trim() === "") || [px, py, pz].some(Number.isNaN)) {
    return null;
  }
  return { x: px, y: py, z: pz };
}

/**
 * Footing এর জন্য একটা single-point ফর্ম (Beam/Column এর মতো
 * start/end দুই পয়েন্ট না, কারণ Footing একটা point element —
 * center location + plan dimension দিয়ে সংজ্ঞায়িত)।
 *
 * click-to-draw দেওয়া হয়নি এখানে (Slab/Wall এর মতো) — কারণ Footing
 * এর জন্য শুধু একটা পয়েন্ট লাগে (polygon vertices না), তাই viewport
 * এ ক্লিক করার বদলে সরাসরি ফর্মে coordinate টাইপ করা এখানে বেশি
 * efficient, ঠিক যেমন Beam/Column এর জন্যও করা হয়েছে।
 */
export function FootingPanel({ onAddElement, onDeleteElement }: FootingPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [label, setLabel] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [locX, setLocX] = useState("0");
  const [locY, setLocY] = useState("0");
  const [locZ, setLocZ] = useState("0");
  const [width, setWidth] = useState("1500");
  const [length, setLength] = useState("1500");
  const [thickness, setThickness] = useState("450");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;
  const footings = elements.filter((e) => e.category === "footing");

  function resetForm() {
    setLabel("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Footing লেবেল আবশ্যক (যেমন: F1)");
      return;
    }

    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }

    const location = parsePoint(locX, locY, locZ);
    if (!location) {
      setFormError("Location বৈধ সংখ্যা হতে হবে");
      return;
    }

    const widthValue = Number(width);
    const lengthValue = Number(length);
    const thicknessValue = Number(thickness);

    if (!widthValue || widthValue <= 0) {
      setFormError("Width একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!lengthValue || lengthValue <= 0) {
      setFormError("Length একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!thicknessValue || thicknessValue <= 0) {
      setFormError("Thickness একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }

    const element = createFooting({
      label: trimmedLabel,
      materialId,
      location,
      width: widthValue,
      length: lengthValue,
      thickness: thicknessValue,
      // storyId ইচ্ছাকৃতভাবে বাদ — Footing সাধারণত base level এ বসে,
      // কোনো story-র elevation এ না। Beam/Column/Slab/Wall এর মতো
      // সিলেক্টেড story থেকে auto-fill করা এখানে অর্থপূর্ণ না।
    });

    onAddElement(element);
    resetForm();
  }

  const noMaterials = materials.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Footing</h3>

        {footings.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো Footing যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {footings.map((element) => {
              if (element.category !== "footing") return null;
              return (
                <li
                  key={element.elementId}
                  onClick={() => setSelection({ type: "element", elementId: element.elementId })}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                    selectedElementId === element.elementId
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : "hover:bg-surface-hover text-text-secondary"
                  }`}
                >
                  <span>
                    <span className="font-medium">{element.label}</span>
                    <span className="text-text-muted ml-1.5 text-xs">
                      ({element.width}×{element.length} mm)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(element.elementId);
                    }}
                    className="text-xs text-red-500/70 hover:text-red-600 px-1"
                    title="ডিলিট করুন"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {noMaterials ? (
        <p className="text-xs text-status-holdText border-t border-surface-border pt-3">
          Footing যোগ করার আগে অন্তত একটা Material লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="F1"
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Material</label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="">নির্বাচন করুন</option>
              {materials.map((m) => (
                <option key={m.materialId} value={m.materialId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-1">Location — কেন্দ্রবিন্দু (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={locX}
                onChange={(e) => setLocX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={locY}
                onChange={(e) => setLocY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={locZ}
                onChange={(e) => setLocZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Width (mm)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Length (mm)</label>
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Thickness (mm)</label>
              <input
                type="number"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
          >
            + Footing যোগ করুন
          </button>
        </form>
      )}
    </div>
  );
}
