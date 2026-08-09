"use client";

import { use } from "react";
import { MaterialPanel } from "@/components/library-panel/MaterialPanel";
import { SectionPanel } from "@/components/library-panel/SectionPanel";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Library (Materials/Sections) route — Phase 4 (Panel Migration)।
 * geometry/page.tsx (root page.tsx) এর সাথে একই প্যাটার্ন — সেখানে
 * বিস্তারিত রেশনাল দেখুন (hook একবারই এখানে কল হওয়া, showFullWidthPanel
 * layout shape ইত্যাদি)।
 */
export default function LibraryPage({ params }: PageProps<"/model/[projectId]/library">) {
  const { projectId } = use(params);

  const { addMaterial, deleteMaterial, addSection, deleteSection } =
    useMaterialSectionLibrary(projectId);

  const isLibraryLoading = useLibraryStore((s) => s.isLoading);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const content = isLibraryLoading ? (
    <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
  ) : (
    <div className="space-y-6">
      <MaterialPanel onAddMaterial={addMaterial} onDeleteMaterial={deleteMaterial} />
      <SectionPanel onAddSection={addSection} onDeleteSection={deleteSection} />
    </div>
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
