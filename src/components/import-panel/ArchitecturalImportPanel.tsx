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
  "w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20";

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
    materialsSectionsResolved,
    hasBlockingModelIssues,
    blockingModelCheckIssues,
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
      <div className="rounded-lg border border-surface-border bg-surface-card/40 p-3">
        <p className="text-xs text-text-secondary mb-2">
          EngineXDraw-এ সর্বশেষ প্রকাশিত architectural model থেকে Wall/Slab/Column/Beam জ্যামিতি
          আনুন। কোনো ডেটা সরাসরি লেখা হবে না — প্রতিটা element-এর Material/Section বেছে দিয়ে
          নিশ্চিত করার পরেই মডেলে যোগ হবে।
        </p>
        <button
          type="button"
          onClick={fetchAndParse}
          disabled={state.status === "loading"}
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 transition-colors"
        >
          {state.status === "loading" ? "আনা হচ্ছে..." : "Draw থেকে আনুন"}
        </button>
      </div>

      {state.status === "no_data" && (
        <p className="text-sm text-text-muted rounded-lg border border-surface-border bg-surface-card/40 p-3">
          এই প্রজেক্টে Draw থেকে এখনো কোনো architectural model প্রকাশিত হয়নি। EngineXDraw অ্যাপ
          থেকে প্রথমে মডেল publish করার অনুরোধ করুন।
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-950/30 p-3">
          {state.errorMessage}
        </p>
      )}

      {importError && (
        <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-950/30 p-3">
          {importError}
        </p>
      )}

      {importedCount !== null && (
        <p className="text-sm text-status-activeText rounded-lg border border-status-activeBorder bg-status-activeBg p-3">
          {importedCount}টা element সফলভাবে মডেলে যোগ হয়েছে।
        </p>
      )}

      {state.status === "ready" && (
        <>
          <div className="rounded-lg border border-surface-border bg-surface-card/40 p-3 text-xs text-text-secondary space-y-1">
            <p>
              {state.grids.length} Grid, {state.stories.length} Story, {state.items.length} Element
              পাওয়া গেছে
              {state.fetchedAt ? ` — সর্বশেষ প্রকাশিত: ${new Date(state.fetchedAt).toLocaleString("bn-BD")}` : ""}
              {state.moduleVersion !== null ? ` (version ${state.moduleVersion})` : ""}
            </p>
          </div>

          {state.skippedIssues.length > 0 && (
            <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3">
              <p className="text-xs font-medium text-status-holdText mb-1.5">
                {state.skippedIssues.length}টা element স্কিপ করা হয়েছে
              </p>
              <ul className="space-y-1">
                {state.skippedIssues.map((issue) => (
                  <li key={issue.elementRefId} className="text-xs text-status-holdText">
                    {issue.elementType} ({issue.elementRefId}) — {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*
            Model Checker (modelChecker.ts) — connectivity/duplicate/geometry/
            support। material/section বেছে দেওয়ার আগেই দেখানো হচ্ছে, কারণ এই
            সমস্যাগুলো (floating wall, duplicate element, zero-length beam,
            base support অনুপস্থিত) ঠিক করার জন্য ইঞ্জিনিয়ারকে হয়তো
            EngineXDraw-এ ফিরে গিয়ে geometry ঠিক করতে হবে — এখানে শুধু
            material/section বেছে দিলে সমাধান হবে না। error-severity issue
            থাকলে allResolved false থাকে (নিচের Confirm বাটন দেখুন), তাই এই
            card ছাড়া ইঞ্জিনিয়ার শুধু "Material/Section বেছে দিন" মেসেজ
            দেখতেন যদিও আসল কারণ geometry — বিভ্রান্তিকর হতো।
          */}
          {hasBlockingModelIssues && (
            <div className="rounded-lg border border-red-200 bg-red-950/30 p-3">
              <p className="text-xs font-medium text-red-400 mb-1.5">
                {blockingModelCheckIssues.length}টা geometry সমস্যা পাওয়া গেছে — আমদানি করার আগে এগুলো
                ঠিক করা প্রয়োজন (EngineXDraw-এ ফিরে গিয়ে সংশোধন করুন, প্রয়োজনে আবার publish করে
                এখানে আবার &quot;Draw থেকে আনুন&quot; চাপুন)
              </p>
              <ul className="space-y-1">
                {blockingModelCheckIssues.map((issue) => (
                  <li key={issue.id} className="text-xs text-red-400">
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* warning/info severity issue — ব্লক করে না, শুধু জানানোর জন্য (যেমন area element এর possibly-floating heuristic notice)। */}
          {state.modelCheckReport.issues.some((issue) => issue.severity !== "error") && (
            <div className="rounded-lg border border-surface-border bg-surface-card/40 p-3">
              <p className="text-xs font-medium text-text-secondary mb-1.5">Model Checker নোট</p>
              <ul className="space-y-1">
                {state.modelCheckReport.issues
                  .filter((issue) => issue.severity !== "error")
                  .map((issue) => (
                    <li key={issue.id} className="text-xs text-text-muted">
                      {issue.message}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {state.items.length === 0 ? (
            <p className="text-sm text-text-muted rounded-lg border border-surface-border bg-surface-card/40 p-3">
              আমদানিযোগ্য কোনো element পাওয়া যায়নি।
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedItems.entries()).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
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
            className="w-full rounded-md bg-status-activeText hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
          >
            {isImporting
              ? "আমদানি হচ্ছে..."
              : allResolved
                ? "আমদানি নিশ্চিত করুন"
                : hasBlockingModelIssues
                  ? "উপরের geometry সমস্যা ঠিক না হওয়া পর্যন্ত আমদানি করা যাবে না"
                  : !materialsSectionsResolved
                    ? "সব element-এ Material/Section বেছে দিন"
                    : "আমদানি নিশ্চিত করুন"}
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
    <div className="rounded-lg border border-surface-border bg-surface-card p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-primary font-medium">{item.original.label}</span>
        <span className="text-[10px] text-text-muted">{item.original.elementId}</span>
      </div>

      {item.issue && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-status-holdBg border border-status-holdBorder/40 px-2 py-1.5">
          <p className="text-[11px] text-status-holdText flex-1">{item.issue.reason}</p>
          {canOverrideCategory && (
            <label className="flex items-center gap-1.5 text-[11px] text-status-holdText whitespace-nowrap flex-shrink-0">
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
          <label className="block text-[11px] text-text-muted mb-1">Material</label>
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
            <label className="block text-[11px] text-text-muted mb-1">Section</label>
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
