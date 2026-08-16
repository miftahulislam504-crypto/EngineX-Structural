"use client";

import { use } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { VisualizationViewport } from "@/components/viewport/VisualizationViewport";
import { VisualizationControlsPanel } from "@/components/viewport/VisualizationControlsPanel";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Visualization route — Redesign (২০২৬-০৮; মূলত Phase 4)।
 *
 * single-panel viewport ক্যাটেগরি (শুধু 3D — visualization/detailing
 * উভয়েই কোনো 2D/3D টগল নেই, dual-panel elements/analysis থেকে এই
 * পার্থক্যই ইচ্ছাকৃত, DualPanelViewportShell এর মন্তব্যে বিস্তারিত)।
 * detailing এর থেকে ভিন্ন viewport component (VisualizationViewport,
 * StructuralViewport না; editing vs. read-only viewport পার্থক্য) —
 * তাই শেয়ার্ড shell বানানো হয়নি, শুধু ২টা caller থাকায় ছোট ডুপ্লিকেশন
 * গ্রহণযোগ্য।
 *
 * VisualizationViewport/VisualizationControlsPanel — দুটোই
 * useGeometryStore + useElementsStore পড়ে, তাই এই page useGeometryCore
 * + useElementsCore subscription-trigger করতে কল করে।
 *
 * এই redesign এ শুধু স্টাইল পালিশ হয়েছে (icon বাটন, rounded card
 * overlay, sheet header) — কাঠামো (viewport + overlay panel, mobile
 * ⚙ sheet) অপরিবর্তিত।
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

      <div className="hidden lg:block absolute top-3 right-3 w-72 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-surface-border bg-surface-card/95 backdrop-blur shadow-card p-4">
        <VisualizationControlsPanel />
      </div>

      <ViewportStatusChip projectId={projectId} />

      <button
        type="button"
        onClick={() => setMobilePanelOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl flex items-center justify-center transition-colors"
        aria-label="Panel খুলুন"
      >
        <SlidersHorizontal size={20} />
      </button>

      {mobilePanelOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-surface-border bg-surface-card px-4 py-3 flex-shrink-0">
            <span className="text-sm font-semibold text-text-primary">Panel</span>
            <button
              type="button"
              onClick={() => setMobilePanelOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X size={16} />
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
