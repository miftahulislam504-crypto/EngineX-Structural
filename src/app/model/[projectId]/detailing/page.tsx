"use client";

import { use, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { DetailingPanel } from "@/components/detailing-panel/DetailingPanel";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Detailing route — Phase 4 (Panel Migration)।
 *
 * showSinglePanel ক্যাটেগরি। visualization/page.tsx এর সাথে এই একই
 * কারণে আলাদা রাখা হয়েছে কোনো শেয়ার্ড shell ছাড়া (সেই ফাইলের মন্তব্য
 * দেখুন)।
 *
 * showDetailingStirrups/showDetailingMesh/detailingIsolateElementId —
 * মূল page.tsx এ এই তিনটা top-level state ছিল, কিন্তু আসলে শুধুমাত্র
 * detailing tab এই genuinely মিউটেবল (DetailingPanel এর টগল
 * কন্ট্রোল এখানেই আছে) — elements/analysis dual-panel এ এই একই তিনটা
 * প্রপ StructuralViewport এ পাস হতো ঠিকই, কিন্তু showDetailing=false
 * থাকায় নিষ্ক্রিয় ছিল (StructuralViewport.tsx এর কোড: এই তিনটা প্রপ
 * শুধু showDetailing true হলেই পড়া হয়) — তাই DualPanelViewportShell এ
 * constant default (true/true/null) রাখা নিরাপদ ছিল, আর এই আসল
 * মিউটেবল state এখন এখানেই, একমাত্র জায়গা যেখানে সত্যিই দরকার।
 *
 * StructuralViewport/DetailingPanel useGeometryStore + useElementsStore
 * পড়ে (grep দিয়ে যাচাই), তাই useGeometryCore + useElementsCore
 * subscription-trigger করতে কল করা।
 */
export default function DetailingPage({ params }: PageProps<"/model/[projectId]/detailing">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  useElementsCore(projectId);

  const [showDetailingStirrups, setShowDetailingStirrups] = useState(true);
  const [showDetailingMesh, setShowDetailingMesh] = useState(true);
  const [detailingIsolateElementId, setDetailingIsolateElementId] = useState<string | null>(null);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const controlsPanel = (
    <DetailingPanel
      showStirrups={showDetailingStirrups}
      onToggleStirrups={setShowDetailingStirrups}
      showMesh={showDetailingMesh}
      onToggleMesh={setShowDetailingMesh}
      isolateElementId={detailingIsolateElementId}
      onSetIsolateElementId={setDetailingIsolateElementId}
    />
  );

  return (
    <>
      <StructuralViewport
        showDetailing={true}
        showStirrups={showDetailingStirrups}
        showMesh={showDetailingMesh}
        isolateElementId={detailingIsolateElementId}
      />

      <div className="hidden lg:block absolute top-3 right-3 w-72 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-surface-border bg-surface-card/95 backdrop-blur shadow-card p-4">
        {controlsPanel}
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
          <div className="flex-1 overflow-y-auto p-4">{controlsPanel}</div>
        </div>
      )}
    </>
  );
}
