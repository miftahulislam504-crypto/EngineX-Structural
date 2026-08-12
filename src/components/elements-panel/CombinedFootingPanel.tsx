"use client";

import { useState } from "react";
import type { Point3D, StructuralElement } from "@/lib/types/element";
import { createCombinedFooting } from "@/lib/types/element";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface CombinedFootingPanelProps {
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
 * Combined Footing এর জন্য দুই-পয়েন্ট ফর্ম (isolated Footing এর
 * single-point ফর্মের থেকে আলাদা) — Column A ও Column B এর অবস্থান
 * দিয়ে সংজ্ঞায়িত, ঠিক Beam/Column এর start/end point প্যাটার্নের
 * মতো। plan dimension (width/length) এখানে ইনপুট না, কারণ সেটা
 * Design panel এ sizing calculation থেকে আসে (7a — resultant-centroid
 * method), শুধু thickness এখানে সেট করা হয় (element property)।
 */
export function CombinedFootingPanel({ onAddElement, onDeleteElement }: CombinedFootingPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [label, setLabel] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [aX, setAX] = useState("0");
  const [aY, setAY] = useState("0");
  const [aZ, setAZ] = useState("0");
  const [bX, setBX] = useState("0");
  const [bY, setBY] = useState("0");
  const [bZ, setBZ] = useState("0");
  const [thickness, setThickness] = useState("600");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;
  const combinedFootings = elements.filter((e) => e.category === "combined-footing");

  function resetForm() {
    setLabel("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Combined Footing লেবেল আবশ্যক (যেমন: CF1)");
      return;
    }

    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }

    const columnALocation = parsePoint(aX, aY, aZ);
    const columnBLocation = parsePoint(bX, bY, bZ);
    if (!columnALocation || !columnBLocation) {
      setFormError("Column A ও Column B এর Location বৈধ সংখ্যা হতে হবে");
      return;
    }

    if (
      columnALocation.x === columnBLocation.x &&
      columnALocation.y === columnBLocation.y &&
      columnALocation.z === columnBLocation.z
    ) {
      setFormError("Column A ও Column B একই বিন্দুতে হতে পারবে না");
      return;
    }

    const thicknessValue = Number(thickness);
    if (!thicknessValue || thicknessValue <= 0) {
      setFormError("Thickness একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }

    const element = createCombinedFooting({
      label: trimmedLabel,
      materialId,
      columnALocation,
      columnBLocation,
      thickness: thicknessValue,
    });

    onAddElement(element);
    resetForm();
  }

  const noMaterials = materials.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Combined Footing</h3>

        {combinedFootings.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো Combined Footing যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {combinedFootings.map((element) => {
              if (element.category !== "combined-footing") return null;
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
                    <span className="text-text-muted ml-1.5 text-xs">(t={element.thickness}mm)</span>
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
          Combined Footing যোগ করার আগে অন্তত একটা Material লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="CF1"
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
            <p className="text-xs text-text-muted mb-1">Column A — কেন্দ্রবিন্দু (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={aX}
                onChange={(e) => setAX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={aY}
                onChange={(e) => setAY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={aZ}
                onChange={(e) => setAZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-1">Column B — কেন্দ্রবিন্দু (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={bX}
                onChange={(e) => setBX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={bY}
                onChange={(e) => setBY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={bZ}
                onChange={(e) => setBZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
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

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
          >
            + Combined Footing যোগ করুন
          </button>
        </form>
      )}
    </div>
  );
}
