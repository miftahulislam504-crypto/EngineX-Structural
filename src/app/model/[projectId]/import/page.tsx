"use client";

import { use } from "react";
import { ArchitecturalImportPanel } from "@/components/import-panel/ArchitecturalImportPanel";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Import route — Phase 6.5 (Architectural Import & Review UI)।
 *
 * geometry/page.tsx ও library/page.tsx এর মতোই showFullWidthPanel
 * ক্যাটেগরি (কোনো viewport/3D canvas নেই, শুধু max-w-3xl কেন্দ্রীভূত
 * কলাম + mobile full-screen sheet) — সেই একই layout shape এখানে
 * পুনরাবৃত্তি করা হয়েছে।
 *
 * এই page তিনটা orchestration hook একসাথে কল করে — useGeometryCore
 * (merge করার জন্য geometry state ও এই route ছাড়া callback দরকার নেই,
 * শুধু geometry snapshot লাগে persist এর সময়), useElementsCore (addElement
 * দিয়ে প্রতিটা imported element save করতে), useMaterialSectionLibrary
 * (dropdown এ material/section list লাগে)। layout.tsx এর নীতি অনুযায়ী
 * (মন্তব্য দেখুন) — যে route এর hook দরকার, সে নিজেই কল করে, prop drilling
 * বা layout-level move করা হয় না।
 *
 * geometry/elements/library — এই তিনটা loading state একসাথে গেট হিসেবে
 * ব্যবহার করা হচ্ছে, কারণ import flow-এর জন্য তিনটাই লাগবে (dropdown
 * খালি থাকলে material/section বাছা যাবে না, geometry snapshot ছাড়া
 * merge করা যাবে না)।
 */
export default function ImportPage({ params }: PageProps<"/model/[projectId]/import">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  const { addElement } = useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  const isGeometryLoading = useGeometryStore((s) => s.isLoading);
  const isElementsLoading = useElementsStore((s) => s.isLoading);
  const isLibraryLoading = useLibraryStore((s) => s.isLoading);
  const isLoading = isGeometryLoading || isElementsLoading || isLibraryLoading;

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const content = isLoading ? (
    <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
  ) : (
    <ArchitecturalImportPanel projectId={projectId} onAddElement={addElement} />
  );

  return (
    <>
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 lg:p-6">{content}</div>
      </div>

      <button
        type="button"
        onClick={() => setMobilePanelOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl flex items-center justify-center text-xl transition-colors"
        aria-label="Panel খুলুন"
      >
        ⚙
      </button>

      {mobilePanelOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-surface-border bg-surface-card px-3 py-2 flex-shrink-0">
            <span className="text-sm font-medium text-text-primary">Panel</span>
            <button
              type="button"
              onClick={() => setMobilePanelOpen(false)}
              className="text-text-muted hover:text-text-primary text-lg px-2"
              aria-label="বন্ধ করুন"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{content}</div>
        </div>
      )}
    </>
  );
}
