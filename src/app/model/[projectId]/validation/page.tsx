"use client";

import { use } from "react";
import { ValidationPanel } from "@/components/validation-panel/ValidationPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLoadCore } from "@/lib/loads/useLoadCore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Validation route — Phase 4 (Panel Migration)।
 *
 * showFullWidthPanel ক্যাটেগরি। ValidationPanel প্রপ নেয় না, কিন্তু
 * elements/library/loads store সরাসরি পড়ে (geometry না) — analysis/
 * page.tsx এর মতোই একই কারণে এই তিনটা hook subscription-trigger করতে
 * কল করা হলো, action closure ব্যবহার হচ্ছে না (বিস্তারিত রেশনাল
 * analysis/page.tsx এর মন্তব্যে)।
 */
export default function ValidationPage({ params }: PageProps<"/model/[projectId]/validation">) {
  const { projectId } = use(params);

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);
  useLoadCore(projectId);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const content = <ValidationPanel />;

  return (
    <>
      <div className="hidden lg:block h-full overflow-y-auto">
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
