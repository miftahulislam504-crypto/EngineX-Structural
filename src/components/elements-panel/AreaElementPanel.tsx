"use client";

import { useState } from "react";
import type { StructuralElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useDrawModeStore, type DrawableCategory, DRAWABLE_CATEGORY_LABELS, DRAWABLE_CATEGORY_LABEL_PREFIXES } from "@/lib/viewport/useDrawModeStore";
import { usePendingAreaElementStore } from "@/lib/elements/usePendingAreaElementStore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";

interface AreaElementPanelProps {
  onAddElement: (element: StructuralElement) => void;
  onUpdateElement: (element: StructuralElement) => void;
  onDeleteElement: (elementId: string) => void;
}

function makeElementId(): string {
  return `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Slab/Wall/Shear Wall/Core Wall তৈরির দুই-ধাপ workflow (সবগুলোই
 * একই AreaElement geometry — polygon vertices — শেয়ার করে, তাই একই
 * click-to-draw ও ফর্ম প্যাটার্ন সবার জন্য প্রযোজ্য):
 *   ধাপ ১: "Draw Slab"/"Draw Wall" বাটনে ক্লিক → draw mode চালু →
 *          viewport এ ক্লিক করে vertex বসানো → "Finish" চাপলে vertices
 *          usePendingAreaElementStore এ চলে যায়
 *   ধাপ ২: এই প্যানেলে material ও thickness ফর্ম দেখা যায় (pending
 *          থাকা অবস্থায়) → সাবমিট করলে element তৈরি হয়ে Firestore এ যায়
 *
 * সিলেক্টেড story থাকলে সেই elevation এ আঁকা হয়, এবং সেই storyId
 * তৈরি হওয়া element-এ সংরক্ষিত থাকে। storyId capture হয় draw শুরু
 * হওয়ার মুহূর্তে (useDrawModeStore এ, elevation এর সাথেই) — এই
 * component না, কারণ drawing চলাকালীন এই component এর selection read
 * করলে ইউজার যদি মাঝপথে অন্য story ক্লিক করে ফেলেন (draw mode এ grid/
 * story ক্লিক নিষ্ক্রিয় থাকলেও sidebar থেকে তো করতে পারেন) সেই
 * পরিবর্তিত মান ভুলভাবে ব্যবহৃত হতো। কোনো story সিলেক্টেড না থাকলে
 * elevation=0 (base level) এ আঁকা হয় এবং storyId undefined থাকে।
 */
export function AreaElementPanel({ onAddElement, onUpdateElement, onDeleteElement }: AreaElementPanelProps) {
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const stories = useGeometryStore((s) => s.geometry.stories);
  const selection = useSelectionStore((s) => s.selection);
  const elements = useElementsStore((s) => s.elements);

  const startDrawing = useDrawModeStore((s) => s.startDrawing);
  const activeCategory = useDrawModeStore((s) => s.activeCategory);

  const pending = usePendingAreaElementStore((s) => s.pending);
  const clearPending = usePendingAreaElementStore((s) => s.clearPending);

  const [materialId, setMaterialId] = useState("");
  const [thickness, setThickness] = useState("150");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Slab-এর liveLoadOverride ইনলাইন এডিটের জন্য — deriveLiveLoadCases.ts
  // এর SlabElement.liveLoadOverride ফিল্ড, ২০২৬-০৮ যোগ হলো। elementId →
  // draft string (input এ কী টাইপ করা হচ্ছে, commit না হওয়া পর্যন্ত)।
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});

  const areaElements = elements.filter(
    (e) =>
      e.category === "slab" ||
      e.category === "wall" ||
      e.category === "shear-wall" ||
      e.category === "core-wall" ||
      e.category === "mat-foundation"
  );

  function getDrawElevation(): number {
    if (selection.type === "story") {
      const story = stories.find((s) => s.storyId === selection.storyId);
      if (story) return story.elevation;
    }
    return 0;
  }

  function handleStartDraw(category: DrawableCategory) {
    const storyId = selection.type === "story" ? selection.storyId : undefined;
    startDrawing(category, getDrawElevation(), storyId);
  }

  function handlePendingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Element লেবেল আবশ্যক");
      return;
    }
    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }
    const thicknessValue = Number(thickness);
    if (!thicknessValue || thicknessValue <= 0) {
      setFormError("Thickness একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }

    const now = new Date().toISOString();
    const element: StructuralElement = {
      elementId: makeElementId(),
      category: pending.category,
      label: trimmedLabel,
      materialId,
      vertices: pending.vertices,
      thickness: thicknessValue,
      storyId: pending.storyId,
      createdAt: now,
      updatedAt: now,
    };

    onAddElement(element);
    clearPending();
    setLabel("");
    setFormError(null);
  }

  function handleCancelPending() {
    clearPending();
    setLabel("");
    setFormError(null);
  }

  /** Slab-এর liveLoadOverride commit করে (খালি input দিলে override সরিয়ে দেয়, project-wide default এ ফিরে যায়)। */
  function handleCommitOverride(element: StructuralElement) {
    if (element.category !== "slab") return;
    const draft = overrideDrafts[element.elementId];
    if (draft === undefined) return; // কোনো এডিট হয়নি, কিছু করার নেই

    const trimmed = draft.trim();
    if (trimmed !== "" && (Number.isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
      // অবৈধ ইনপুট (সংখ্যা না, বা ঋণাত্মক) — commit না করে draft অপরিবর্তিত রাখা হচ্ছে, ইউজার ঠিক করে আবার blur করবেন।
      return;
    }
    const updated: StructuralElement =
      trimmed === ""
        ? { ...element, liveLoadOverride: undefined, updatedAt: new Date().toISOString() }
        : { ...element, liveLoadOverride: Number(trimmed), updatedAt: new Date().toISOString() };

    onUpdateElement(updated);
    setOverrideDrafts((prev) => {
      const next = { ...prev };
      delete next[element.elementId];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Slab / Wall / Shear Wall / Core Wall / Mat Foundation</h3>

        {areaElements.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো element যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {areaElements.map((element) => {
              const isAreaElement =
                element.category === "slab" ||
                element.category === "wall" ||
                element.category === "shear-wall" ||
                element.category === "core-wall" ||
                element.category === "mat-foundation";
              if (!isAreaElement) return null;
              const area = computePolygonPlanArea(element.vertices);
              const isSlab = element.category === "slab";
              const currentOverride = element.category === "slab" ? element.liveLoadOverride : undefined;
              const draftValue = overrideDrafts[element.elementId] ?? (currentOverride !== undefined ? String(currentOverride) : "");
              return (
                <li
                  key={element.elementId}
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-hover text-text-secondary"
                >
                  <span>
                    <span className="font-medium">{element.label}</span>
                    <span className="text-text-muted ml-1.5 text-xs">
                      ({DRAWABLE_CATEGORY_LABELS[element.category as DrawableCategory]},{" "}
                      {area.toFixed(1)} m²)
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {isSlab && (
                      <span className="flex items-center gap-1" title="Live Load Override (kN/m²) — খালি রাখলে project-wide default ব্যবহার হবে">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="default"
                          value={draftValue}
                          onChange={(e) => setOverrideDrafts((prev) => ({ ...prev, [element.elementId]: e.target.value }))}
                          onBlur={() => handleCommitOverride(element)}
                          className="w-16 rounded-md bg-surface-card border border-surface-border px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                        />
                        <span className="text-[10px] text-text-muted">kN/m²</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteElement(element.elementId)}
                      className="text-xs text-red-500/70 hover:text-red-600 px-1"
                      title="ডিলিট করুন"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pending ? (
        <PendingAreaElementForm
          category={pending.category}
          vertexCount={pending.vertices.length}
          area={computePolygonPlanArea(pending.vertices)}
          label={label}
          setLabel={setLabel}
          materialId={materialId}
          setMaterialId={setMaterialId}
          thickness={thickness}
          setThickness={setThickness}
          materials={materials}
          formError={formError}
          onSubmit={handlePendingSubmit}
          onCancel={handleCancelPending}
        />
      ) : activeCategory ? (
        <p className="text-xs text-brand-700 border-t border-surface-border pt-3">
          viewport এ আঁকা চলছে — উপরের toolbar থেকে Finish/Cancel করুন।
        </p>
      ) : materials.length === 0 ? (
        <p className="text-xs text-status-holdText border-t border-surface-border pt-3">
          Slab/Wall আঁকার আগে অন্তত একটা Material লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 border-t border-surface-border pt-3">
          {(["slab", "wall", "shear-wall", "core-wall", "mat-foundation"] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleStartDraw(category)}
              className="rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
            >
              ✏️ Draw {DRAWABLE_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PendingAreaElementFormProps {
  category: DrawableCategory;
  vertexCount: number;
  area: number;
  label: string;
  setLabel: (v: string) => void;
  materialId: string;
  setMaterialId: (v: string) => void;
  thickness: string;
  setThickness: (v: string) => void;
  materials: StructuralMaterial[];
  formError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function PendingAreaElementForm({
  category,
  vertexCount,
  area,
  label,
  setLabel,
  materialId,
  setMaterialId,
  thickness,
  setThickness,
  materials,
  formError,
  onSubmit,
  onCancel,
}: PendingAreaElementFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
      <div className="rounded-md bg-brand-50/40 border border-brand-200 px-2.5 py-2 text-xs text-brand-700">
        {DRAWABLE_CATEGORY_LABELS[category]} আঁকা শেষ — {vertexCount} vertex, {area.toFixed(1)} m² এলাকা।
        এখন বিস্তারিত দিন:
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">লেবেল</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={DRAWABLE_CATEGORY_LABEL_PREFIXES[category]}
          className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
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

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + {DRAWABLE_CATEGORY_LABELS[category]} তৈরি করুন
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-surface-hover hover:bg-surface-border text-text-secondary text-sm px-3 py-1.5 transition-colors"
        >
          বাতিল
        </button>
      </div>
    </form>
  );
}
