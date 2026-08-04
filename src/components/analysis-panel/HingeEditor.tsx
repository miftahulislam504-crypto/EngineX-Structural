"use client";

import { useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import type { StructuralElement } from "@/lib/types/element";

interface HingeEditorProps {
  projectId: string;
}

/** hinge assignment শুধু line element এ প্রযোজ্য (Beam/Column/Brace/Pile), Slab/Wall/Footing এ না। */
function isLineElement(
  element: StructuralElement
): element is StructuralElement & { connectionType: "moment" | "pin"; hingeAtStart?: boolean; hingeAtEnd?: boolean } {
  return (
    element.category === "beam" ||
    element.category === "column" ||
    element.category === "brace" ||
    element.category === "pile"
  );
}

/**
 * Nonlinear Static Analysis (Phase 4, Concentrated Plastic Hinge
 * পদ্ধতি) এর জন্য per-element hinge assignment editor। দুইটা অংশ:
 *   ১. Section-level yield moment capacity — একবার সেট করলে সেই
 *      section ব্যবহারকারী সব element এ প্রযোজ্য (backend এ
 *      SectionProperties.yieldMomentMzKNm, cpp/include/types.h দেখুন)।
 *   ২. Element-level hinge on/off — কোন প্রান্তে hinge assign করা
 *      আছে (LineElement.hingeAtStart/hingeAtEnd)। "pin" connectionType
 *      এর element এ hinge UI দেখানো হয় না — সেই element ইতিমধ্যে উভয়
 *      প্রান্তে moment release করা (backend এ getEffectiveLocalStiffness
 *      দেখুন), তাই আলাদা করে hinge assign করার অর্থ নেই।
 */
export function HingeEditor({ projectId }: HingeEditorProps) {
  const elements = useElementsStore((s) => s.elements);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const { updateElement } = useElementsCore(projectId);
  const { updateSection } = useMaterialSectionLibrary(projectId);

  const [savingElementId, setSavingElementId] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [yieldMomentDrafts, setYieldMomentDrafts] = useState<Record<string, string>>({});

  const lineElements = elements.filter(isLineElement).filter((e) => e.connectionType === "moment");

  async function toggleHinge(element: StructuralElement, end: "start" | "end") {
    if (!isLineElement(element)) return;
    setSavingElementId(element.elementId);
    try {
      const updated = {
        ...element,
        hingeAtStart: end === "start" ? !element.hingeAtStart : element.hingeAtStart,
        hingeAtEnd: end === "end" ? !element.hingeAtEnd : element.hingeAtEnd,
        updatedAt: new Date().toISOString(),
      };
      await updateElement(updated);
    } finally {
      setSavingElementId(null);
    }
  }

  async function saveYieldMoment(sectionId: string) {
    const section = sections.find((s) => s.sectionId === sectionId);
    if (!section) return;
    const draft = yieldMomentDrafts[sectionId];
    const parsed = draft === undefined || draft === "" ? 0 : Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setSavingSectionId(sectionId);
    try {
      await updateSection({
        ...section,
        yieldMomentMzKNm: parsed,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSavingSectionId(null);
    }
  }

  if (lineElements.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No moment-connected Beam/Column/Brace/Pile found — add at least one element before assigning hinges.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs text-slate-500 font-medium mb-2">Section Yield Moment Capacity (Mz)</h4>
        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.sectionId} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex-1 truncate">{section.name}</span>
              <input
                type="number"
                min={0}
                step={0.1}
                placeholder="kN·m"
                defaultValue={section.yieldMomentMzKNm ?? ""}
                onChange={(e) =>
                  setYieldMomentDrafts((prev) => ({ ...prev, [section.sectionId]: e.target.value }))
                }
                className="w-24 rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1"
              />
              <button
                type="button"
                onClick={() => saveYieldMoment(section.sectionId)}
                disabled={savingSectionId === section.sectionId}
                className="text-xs px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
              >
                {savingSectionId === section.sectionId ? "..." : "Save"}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1.5">
          Leaving this at 0 or blank keeps the section always elastic, even if a hinge is assigned.
        </p>
      </div>

      <div>
        <h4 className="text-xs text-slate-500 font-medium mb-2">Hinge Assignment (per element end)</h4>
        <div className="max-h-56 overflow-y-auto space-y-1.5">
          {lineElements.map((element) => {
            if (!isLineElement(element)) return null;
            const isSaving = savingElementId === element.elementId;
            return (
              <div
                key={element.elementId}
                className="flex items-center gap-2 rounded-md bg-slate-950 border border-slate-800 px-2.5 py-1.5"
              >
                <span className="text-xs text-slate-300 flex-1 truncate">{element.label}</span>
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={element.hingeAtStart ?? false}
                    disabled={isSaving}
                    onChange={() => toggleHinge(element, "start")}
                  />
                  Start
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={element.hingeAtEnd ?? false}
                    disabled={isSaving}
                    onChange={() => toggleHinge(element, "end")}
                  />
                  End
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
