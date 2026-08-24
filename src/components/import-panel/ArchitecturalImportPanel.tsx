"use client";

/**
 * ArchitecturalImportPanel.tsx — Phase 6.5।
 *
 * useArchitecturalImport() hook-এর UI স্তর। ইঞ্জিনিয়ার এখানে:
 *  ১. "Draw থেকে আনুন" চেপে সর্বশেষ প্রকাশিত architectural model fetch+parse করেন
 *  ২. প্রতিটা parsed element-এর জন্য Material (ও line element হলে Section) বেছে দেন
 *  ৩. প্রতিটা wall item-এ "Shear Wall হিসেবে import করুন" চেকপয়েন্ট দেখেন —
 *     ডিফল্ট un-checked (thickness ≥150mm হলে parser-এর review-recommended
 *     সতর্কতাও দেখা যায়, কিন্তু checkbox থাকে thickness নির্বিশেষে সব wall-এ)।
 *     checkpoint না দিলে সেই wall confirm-এর সময় silently বাদ পড়ে (ETABS-এর
 *     মতো এই মডেলেও সাধারণ/architectural wall কখনো analysis element হয় না —
 *     শুধু beam/column/slab/stairs/shear-wall)।
 *  ৪. সব resolved হলে "আমদানি নিশ্চিত করুন" চেপে Grid/Story+Elements লাইভ মডেলে লেখেন
 *     (un-checked wall বাদ দিয়ে)
 *
 * ElementPanel.tsx/AreaElementPanel.tsx (elements-panel) থেকে form styling
 * (dark slate select/input, sky accent) হুবহু ধার করা হয়েছে যাতে নতুন এই
 * panel বাকি elements-panel পরিবারের সাথে দৃশ্যতভাবে সামঞ্জস্যপূর্ণ থাকে।
 */

import { useMemo, useState } from "react";
import { useArchitecturalImport, type ImportReviewItem } from "@/lib/hub/useArchitecturalImport";
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
  stair: "Stairs",
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
    setItemIncludeAsShearWall,
    setGroupMaterial,
    setGroupSection,
    buildMergedGeometry,
    resolvedElements,
    excludedWallCount,
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
          EngineXDraw-এ সর্বশেষ প্রকাশিত architectural model থেকে Beam/Column/Slab/Stairs/Wall
          জ্যামিতি আনুন। কোনো ডেটা সরাসরি লেখা হবে না — প্রতিটা element-এর Material/Section বেছে
          দিয়ে নিশ্চিত করার পরেই মডেলে যোগ হবে। সাধারণ (architectural) wall ডিফল্টে মডেলে যোগ হয়
          না — শুধু যেগুলোকে আপনি &quot;Shear Wall হিসেবে import করুন&quot; চেকপয়েন্ট দেবেন সেগুলোই
          shear wall হিসেবে মডেলে যোগ হবে, বাকি সব ETABS-এর মতোই বাদ থাকবে। প্রতিটা category (Wall,
          Column, Beam, Slab, Stairs) এর উপরে একটা bulk Material/Section সিলেক্টর আছে — যেহেতু এই
          import সবসময় একটা preliminary ধাপ, একবারে পুরো category-তে একই selection বসিয়ে দ্রুত শুরু
          করুন, পরে প্রয়োজনে নিচে নির্দিষ্ট item আলাদা করে বদলে নিন।
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
            {excludedWallCount > 0 && (
              <p className="text-text-muted">
                {excludedWallCount}টা সাধারণ wall চেকপয়েন্ট দেওয়া হয়নি — এগুলো আমদানিতে বাদ যাবে
                (নিচে চাইলে &quot;Shear Wall হিসেবে import করুন&quot; দিয়ে যোগ করুন)।
              </p>
            )}
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
                  <GroupBulkAssignRow
                    category={category}
                    items={items}
                    materials={materials}
                    sections={sections}
                    onGroupMaterialChange={(materialId) => setGroupMaterial(category, materialId)}
                    onGroupSectionChange={(sectionId) => setGroupSection(category, sectionId)}
                  />
                  {items.map((item) => (
                    <ImportItemRow
                      key={item.original.elementId}
                      item={item}
                      materials={materials}
                      sections={sections}
                      onMaterialChange={(materialId) => setItemMaterial(item.original.elementId, materialId)}
                      onSectionChange={(sectionId) => setItemSection(item.original.elementId, sectionId)}
                      onIncludeAsShearWallChange={(include) =>
                        setItemIncludeAsShearWall(item.original.elementId, include)
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

interface GroupBulkAssignRowProps {
  category: string;
  items: ImportReviewItem[];
  materials: { materialId: string; name: string }[];
  sections: { sectionId: string; name: string }[];
  onGroupMaterialChange: (materialId: string) => void;
  onGroupSectionChange: (sectionId: string) => void;
}

/**
 * প্রতিটা category group-এর উপরে একটা bulk Material/Section সিলেক্টর —
 * নতুন সংযোজন। Hub থেকে import সবসময় একটা preliminary ধাপ ধরা হয় (এই
 * মুহূর্তে EngineXDraw কোনো material/section metadata পাঠায়ই না, parser
 * সবসময় UNRESOLVED বসায়) — তাই বাস্তবে ইঞ্জিনিয়ার সাধারণত পুরো Wall
 * group-এ এক material, পুরো Column group-এ এক section+material, ইত্যাদি
 * দিয়ে দ্রুত শুরু করেন, পরে ডিজাইন পর্যায়ে নির্দিষ্ট element আলাদা করে
 * বদলান। এই dropdown একবার বাছাই করলেই এই category-র সব item-এ (এখনই
 * তৈরি হওয়া, পরে group-এ যোগ হওয়া কোনো item না — যেহেতু import একবারের
 * snapshot) সেই মান বসিয়ে দেয় — নিচের প্রতিটা ImportItemRow-এর নিজস্ব
 * dropdown অপরিবর্তিত থাকে, ইঞ্জিনিয়ার যেকোনো একটা পরে আলাদাভাবে বদলাতে
 * পারবেন। "নির্বাচন করুন" (খালি value) ইচ্ছাকৃতভাবে bulk-apply করে না —
 * শুধু প্রকৃত material/section বাছাই হলেই group-wide সেট হয়, যাতে ভুলে
 * এই dropdown ছুঁয়ে সবার বাছাই খালি করে না ফেলে।
 *
 * Section selector শুধু তখনই দেখানো হয় যখন group-এর অন্তত একটা item-এর
 * sectionId !== null (অর্থাৎ line category — Beam/Column) — Wall/Slab/
 * Stairs group-এ section কখনো প্রযোজ্য না, তাই dropdown-ই দেখানো হয় না।
 */
function GroupBulkAssignRow({
  items,
  materials,
  sections,
  onGroupMaterialChange,
  onGroupSectionChange,
}: GroupBulkAssignRowProps) {
  const hasSectionInGroup = items.some((it) => it.sectionId !== null);

  return (
    <div className="rounded-lg border border-dashed border-surface-border bg-surface-card/30 p-2.5">
      <p className="text-[11px] text-text-muted mb-1.5">
        সবার জন্য একই (preliminary) — নিচে আলাদা করে যেকোনোটা বদলানো যাবে
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Material (সব {items.length}টায়)</label>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === "") return;
              onGroupMaterialChange(e.target.value);
              e.target.value = "";
            }}
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

        {hasSectionInGroup && (
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Section (সব {items.length}টায়)</label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === "") return;
                onGroupSectionChange(e.target.value);
                e.target.value = "";
              }}
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

interface ImportItemRowProps {
  item: ImportReviewItem;
  materials: { materialId: string; name: string }[];
  sections: { sectionId: string; name: string }[];
  onMaterialChange: (materialId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onIncludeAsShearWallChange: (include: boolean) => void;
}

function ImportItemRow({
  item,
  materials,
  sections,
  onMaterialChange,
  onSectionChange,
  onIncludeAsShearWallChange,
}: ImportItemRowProps) {
  // চেকপয়েন্ট গেট শুধু আসল (override-না-করা) category "wall" item-এই
  // দেখানো হয় — categoryOverride ইতিমধ্যে "shear-wall" থাকলে সেটা এই
  // চেকবক্স দিয়েই সেট হয়েছে, তাই সেই item স্বাভাবিক shear-wall row হিসেবে
  // দেখানো হয় (নিচে isWallGate false)।
  const isWallGate = item.original.category === "wall";
  const included = item.includeAsShearWall;

  return (
    <div
      className={`rounded-lg border p-2.5 space-y-2 ${
        isWallGate && !included
          ? "border-surface-border/60 bg-surface-card/40 opacity-70"
          : "border-surface-border bg-surface-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-primary font-medium">{item.original.label}</span>
        <span className="text-[10px] text-text-muted">{item.original.elementId}</span>
      </div>

      {isWallGate && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-surface-card/60 border border-surface-border px-2 py-1.5">
          <p className="text-[11px] text-text-muted flex-1">
            সাধারণ (architectural) wall — চেকপয়েন্ট না দিলে আমদানির সময় বাদ যাবে, মডেলে যোগ হবে না।
          </p>
          <label className="flex items-center gap-1.5 text-[11px] text-text-primary whitespace-nowrap flex-shrink-0">
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => onIncludeAsShearWallChange(e.target.checked)}
              className="accent-amber-600"
            />
            Shear Wall হিসেবে import করুন
          </label>
        </div>
      )}

      {item.issue && (
        <div className="rounded-md bg-status-holdBg border border-status-holdBorder/40 px-2 py-1.5">
          <p className="text-[11px] text-status-holdText">{item.issue.reason}</p>
        </div>
      )}

      {(!isWallGate || included) && (
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
      )}
    </div>
  );
}
