"use client";

import { use } from "react";
import { VisualizationViewport } from "@/components/viewport/VisualizationViewport";
import { VisualizationControlsPanel } from "@/components/viewport/VisualizationControlsPanel";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Visualization route — Phase 4 (Panel Migration)।
 *
 * showSinglePanel ক্যাটেগরি, কিন্তু detailing এর থেকে যথেষ্ট আলাদা
 * (ভিন্ন viewport component — VisualizationViewport, StructuralViewport
 * না; Phase 3 এর নিজস্ব আবিষ্কার অনুযায়ী ইচ্ছাকৃতভাবে আলাদা রাখা,
 * editing vs. read-only viewport এর পার্থক্যে) — তাই elements/analysis
 * এর মতো একটা শেয়ার্ড shell এখানে বানানো হয়নি (branching সরিয়ে
 * শেয়ার্ড ফাইলে নেওয়া হলেও কমত না, শুধু জায়গা বদলাত)। detailing/
 * page.tsx এর সাথে যেটুকু সত্যিই কমন (mobile ⚙ বাটন + sheet chrome,
 * ViewportStatusChip) — সেটুকু আলাদা component হিসেবে না রেখে দুই
 * জায়গায় ছোট ডুপ্লিকেশন হিসেবে রাখা হলো, কারণ মাত্র ২টা caller —
 * extraction এর খরচ (indirection) তার লাভের (DRY) চেয়ে বেশি এখানে।
 *
 * VisualizationViewport/VisualizationControlsPanel — দুটোই
 * useGeometryStore + useElementsStore পড়ে (grep দিয়ে যাচাই করা) —
 * তাই এই page useGeometryCore + useElementsCore subscription-trigger
 * করতে কল করে (analysis/validation এর একই কারণে, বিস্তারিত রেশনাল
 * analysis/page.tsx এর মন্তব্যে)।
 */
export default function VisualizationPage({ params }: PageProps<"/model/[projectId]/visualization">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  useElementsCore(projectId);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  return (
    <>
      <VisualizationViewport />

      <div className="hidden lg:block absolute top-3 right-3 w-72 max-h-[calc(100%-1.5rem)] overflow-y-auto card p-4">
        <VisualizationControlsPanel />
      </div>

      <ViewportStatusChip projectId={projectId} />

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
          <div className="flex-1 overflow-y-auto p-4">
            <VisualizationControlsPanel />
          </div>
        </div>
      )}
    </>
  );
}
