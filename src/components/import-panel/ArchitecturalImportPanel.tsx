"use client";

/**
 * ArchitecturalImportPanel.tsx — Phase 6.5।
 *
 * useArchitecturalImport() hook-এর UI স্তর। ইঞ্জিনিয়ার এখানে:
 *  ১. "Draw থেকে আনুন" চেপে সর্বশেষ প্রকাশিত architectural model fetch+parse করেন
 *  ২. প্রতিটা parsed element-এর জন্য Material (ও line element হলে Section) বেছে দেন
 *  ৩. thickness ≥150mm ওয়ালা wall-এ "Shear Wall হতে পারে" পর্যালোচনা-সতর্কতা দেখে
 *     চাইলে category override করেন (ডিফল্ট: parser যা দিয়েছে, category কখনো
 *     automatically পাল্টায় না — hub-geometry-parser.ts-এর নীতি)
 *  ৪. সব resolved হলে "আমদানি নিশ্চিত করুন" চেপে Grid/Story+Elements লাইভ মডেলে লেখেন
 *
 * ElementPanel.tsx/AreaElementPanel.tsx (elements-panel) থেকে form styling
 * (dark slate select/input, sky accent) হুবহু ধার করা হয়েছে যাতে নতুন এই
 * panel বাকি elements-panel পরিবারের সাথে দৃশ্যতভাবে সামঞ্জস্যপূর্ণ থাকে।
 */

import { useMemo, useState } from "react";
import {
  useArchitecturalImport,
  type ImportReviewItem,
  type OverridableCategory,
} from "@/lib/hub/useArchitecturalImport";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { saveGeometryCore } from "@/lib/geometry/firestore";
import type { StructuralElement } from "@/lib/types/element";

const SELECT_CLASS =
  "w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600";

const CATEGORY_LABELS: Record<string, string> = {
  beam: "Beam",
  column: "Column",
  wall: "Wall",
  "shear-wall": "Shear Wall",
  slab: "Slab",
};

interface ArchitecturalImportPanelProps {
  projectId: string;
  onAddElement: (element: StructuralElement) => Promise<void>;
}

export function ArchitecturalImportPanel({ projectId, onAddElement }: ArchitecturalImportPanelProps) {
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const geometry = useGeometryStore((s) => s.geometry);

  const {
    state,
    allResolved,
    fetchAndParse,
    setItemMaterial,
    setItemSection,
    setItemCategoryOverride,
    buildMergedGeometry,
    resolvedElements,
    reset,
  } = useArchitecturalImport(projectId);

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ImportReviewItem[]>();
    for (const item of state.items) {
      const key = item.categoryOverride ?? item.original.category;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return groups;
  }, [state.items]);

  async function handleConfirm() {
    setIsImporting(true);
    setImportError(null);
    try {
      // Grid/Story আগে — element-গুলোর storyId রেফারেন্স যেন সবসময় বৈধ
      // stories-এর সাথে মেলে, তাই geometry save আগে সম্পন্ন করা হচ্ছে।
      const mergedGeometry = buildMergedGeometry(geometry);
      await saveGeometryCore(projectId, mergedGeometry);

      const elements = resolvedElements();
      for (const element of elements) {
        await onAddElement(element);
      }

      setImportedCount(elements.length);
      reset();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "আমদানি ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-xs text-slate-400 mb-2">
          EngineXDraw-এ সর্বশেষ প্রকাশিত architectural model থেকে Wall/Slab/Column/Beam জ্যামিতি
          আনুন। কোনো ডেটা সরাসরি লেখা হবে না — প্রতিটা element-এর Material/Section বেছে দিয়ে
          নিশ্চিত করার পরেই মডেলে যোগ হবে।
        </p>
        <button
          type="button"
          onClick={fetchAndParse}
          disabled={state.status === "loading"}
          className="w-full rounded-md bg-sky-700 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 transition-colors"
        >
          {state.status === "loading" ? "আনা হচ্ছে..." : "Draw থেকে আনুন"}
        </button>
      </div>

      {state.status === "no_data" && (
        <p className="text-sm text-slate-500 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          এই প্রজেক্টে Draw থেকে এখনো কোনো architectural model প্রকাশিত হয়নি। EngineXDraw অ্যাপ
          থেকে প্রথমে মডেল publish করার অনুরোধ করুন।
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-400 rounded-lg border border-red-900/50 bg-red-950/30 p-3">
          {state.errorMessage}
        </p>
      )}

      {importError && (
        <p className="text-sm text-red-400 rounded-lg border border-red-900/50 bg-red-950/30 p-3">
          {importError}
        </p>
      )}

      {importedCount !== null && (
        <p className="text-sm text-emerald-400 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3">
          {importedCount}টা element সফলভাবে মডেলে যোগ হয়েছে।
        </p>
      )}

      {state.status === "ready" && (
        <>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400 space-y-1">
            <p>
              {state.grids.length} Grid, {state.stories.length} Story, {state.items.length} Element
              পাওয়া গেছে
              {state.fetchedAt ? ` — সর্বশেষ প্রকাশিত: ${new Date(state.fetchedAt).toLocaleString("bn-BD")}` : ""}
              {state.moduleVersion !== null ? ` (version ${state.moduleVersion})` : ""}
            </p>
          </div>

          {state.skippedIssues.length > 0 && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
              <p className="text-xs font-medium text-amber-400 mb-1.5">
                {state.skippedIssues.length}টা element স্কিপ করা হয়েছে
              </p>
              <ul className="space-y-1">
                {state.skippedIssues.map((issue) => (
                  <li key={issue.elementRefId} className="text-xs text-amber-200/80">
                    {issue.elementType} ({issue.elementRefId}) — {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.items.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              আমদানিযোগ্য কোনো element পাওয়া যায়নি।
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedItems.entries()).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {CATEGORY_LABELS[category] ?? category} ({items.length})
                  </h3>
                  {items.map((item) => (
                    <ImportItemRow
                      key={item.original.elementId}
                      item={item}
                      materials={materials}
                      sections={sections}
                      onMaterialChange={(materialId) => setItemMaterial(item.original.elementId, materialId)}
                      onSectionChange={(sectionId) => setItemSection(item.original.elementId, sectionId)}
                      onCategoryOverrideChange={(next) =>
                        setItemCategoryOverride(item.original.elementId, next)
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allResolved || isImporting || state.items.length === 0}
            className="w-full rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
          >
            {isImporting
              ? "আমদানি হচ্ছে..."
              : allResolved
                ? "আমদানি নিশ্চিত করুন"
                : "সব element-এ Material/Section বেছে দিন"}
          </button>
        </>
      )}
    </div>
  );
}

interface ImportItemRowProps {
  item: ImportReviewItem;
  materials: { materialId: string; name: string }[];
  sections: { sectionId: string; name: string }[];
  onMaterialChange: (materialId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onCategoryOverrideChange: (category: OverridableCategory | null) => void;
}

function ImportItemRow({
  item,
  materials,
  sections,
  onMaterialChange,
  onSectionChange,
  onCategoryOverrideChange,
}: ImportItemRowProps) {
  const canOverrideCategory = item.original.category === "wall" || item.original.category === "shear-wall";
  const isOverridden = item.categoryOverride === "shear-wall";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-200 font-medium">{item.original.label}</span>
        <span className="text-[10px] text-slate-500">{item.original.elementId}</span>
      </div>

      {item.issue && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-amber-950/30 border border-amber-900/40 px-2 py-1.5">
          <p className="text-[11px] text-amber-200/90 flex-1">{item.issue.reason}</p>
          {canOverrideCategory && (
            <label className="flex items-center gap-1.5 text-[11px] text-amber-200 whitespace-nowrap flex-shrink-0">
              <input
                type="checkbox"
                checked={isOverridden}
                onChange={(e) => onCategoryOverrideChange(e.target.checked ? "shear-wall" : null)}
                className="accent-amber-600"
              />
              Shear Wall হিসেবে চিহ্নিত করুন
            </label>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Material</label>
          <select
            value={item.materialId}
            onChange={(e) => onMaterialChange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">নির্বাচন করুন</option>
            {materials.map((m) => (
              <option key={m.materialId} value={m.materialId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {item.sectionId !== null && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Section</label>
            <select
              value={item.sectionId}
              onChange={(e) => onSectionChange(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">নির্বাচন করুন</option>
              {sections.map((s) => (
                <option key={s.sectionId} value={s.sectionId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
