"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X, Layout, Boxes } from "lucide-react";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { PlanView2D } from "@/components/viewport/PlanView2D";
import { DrawModeToolbar } from "@/components/viewport/DrawModeToolbar";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useDrawModeStore } from "@/lib/viewport/useDrawModeStore";
import { usePendingAreaElementStore } from "@/lib/elements/usePendingAreaElementStore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Phase 4 (Panel Migration) — Elements ও Analysis tab এর জন্য শেয়ার্ড
 * shell।
 *
 * আগে page.tsx এ `showDualPanel && (...)` ব্লকটা activeTab
 * "elements"/"analysis" উভয়ের জন্যই হুবহু একই JSX render করত (কোনো
 * activeTab-নির্ভর branching এই ব্লকের ভেতরে ছিল না, শুধু ভিতরের
 * overlay এ কী panelContent দেখাবে সেটাই আলাদা)। এখন এই দুটো আলাদা
 * route page — যদি এই ~৬৫ লাইন JSX দুই জায়গায় কপি করা হতো, ভবিষ্যতে
 * viewport/toolbar এ কোনো পরিবর্তন লাগলে দুই ফাইলে মেলাতে হতো (drift
 * এর ঝুঁকি)। তাই একটা reusable shell — `panelOverlay` prop দিয়ে
 * ভিন্ন content নেয় (elements/page.tsx থেকে ElementPanel/
 * AreaElementPanel/ইত্যাদি, analysis/page.tsx থেকে AnalysisPanel)।
 *
 * showDetailing সবসময় false (dual-panel tab এ detailing overlay কখনো
 * দেখানো হয় না — মূল page.tsx এও তাই ছিল)। showStirrups/showMesh/
 * isolateElementId এর মান কোনো ব্যাপার করে না যখন showDetailing false
 * (StructuralViewport.tsx এর নিজের কোড: এই তিনটা প্রপ শুধু
 * `{showDetailing && (...)}` ব্লকের ভেতরে পড়া হয়) — তাই এখানে
 * constant default রাখা হলো (মূল page.tsx এর useState initial value
 * এর সাথে মিলিয়ে: true/true/null), কোনো cross-page shared state লাগছে
 * না এর জন্য (detailing/page.tsx এর নিজস্ব state থেকে সম্পূর্ণ স্বাধীন)।
 *
 * handleFinishDrawing এখানেই self-contained — শুধু global store
 * (useDrawModeStore, usePendingAreaElementStore) আর navigation
 * (router.push) এর উপর নির্ভরশীল, কোনো page-specific prop লাগে না।
 * আগে page.tsx এ setActiveTab("elements") কল করত (local state) — এখন
 * router.push("/model/[projectId]/elements") (সত্যিকারের navigation),
 * যেহেতু draw শুরু হতে পারে Elements tab থেকেই, কিন্তু finish হওয়ার
 * পর pending area element form দেখানোর জন্য Elements এ থাকা/যাওয়া
 * দরকার — এই push তাই এখনো Elements এ থাকলে no-op এর কাছাকাছি
 * (route অপরিবর্তিত), অন্য কোথাও থেকে draw শেষ করলে সঠিক জায়গায় নিয়ে
 * যায়।
 * এই shell এ ViewportStatusChip (Project id + saving/error) আর মোবাইল
 * panel sheet (⚙ বাটন + fixed full-screen overlay)ও bundled আছে —
 * এই দুটোও elements/analysis উভয়েরই হুবহু একই প্যাটার্ন ছিল মূল
 * page.tsx এ (showDualPanel || showSinglePanel gate এ), তাই একই
 * extraction-যুক্তিতে এখানেই রাখা হলো।
 */

interface DualPanelViewportShellProps {
  projectId: string;
  panelOverlay: React.ReactNode;
}

export function DualPanelViewportShell({ projectId, panelOverlay }: DualPanelViewportShellProps) {
  const router = useRouter();
  const [mobileViewMode, setMobileViewMode] = useState<"2d" | "3d">("3d");

  const drawActiveCategory = useDrawModeStore((s) => s.activeCategory);
  const drawPoints = useDrawModeStore((s) => s.points);
  const finishDrawing = useDrawModeStore((s) => s.finishDrawing);
  const removeLastPoint = useDrawModeStore((s) => s.removeLastPoint);
  const cancelDrawing = useDrawModeStore((s) => s.cancelDrawing);
  const setPendingAreaElement = usePendingAreaElementStore((s) => s.setPending);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  function handleFinishDrawing() {
    if (!drawActiveCategory) return;
    const { points, storyId } = finishDrawing();
    setPendingAreaElement({ category: drawActiveCategory, vertices: points, storyId });
    router.push(`/model/${projectId}/elements`);
  }

  return (
    <div className="flex flex-col h-full lg:flex-row">
      <div
        className={`relative flex-1 min-h-0 lg:block ${
          mobileViewMode === "2d" ? "block" : "hidden"
        }`}
      >
        <PlanView2D />
      </div>
      <div className="hidden lg:block w-px bg-surface-border flex-shrink-0" />
      <div
        className={`relative flex-1 min-h-0 lg:block ${
          mobileViewMode === "3d" ? "block" : "hidden"
        }`}
      >
        <StructuralViewport
          showDetailing={false}
          showStirrups={true}
          showMesh={true}
          isolateElementId={null}
        />

        {drawActiveCategory && (
          <DrawModeToolbar
            category={drawActiveCategory}
            pointCount={drawPoints.length}
            onFinish={handleFinishDrawing}
            onUndo={removeLastPoint}
            onCancel={cancelDrawing}
          />
        )}
      </div>

      {/* মোবাইলে 2D/3D টগল — dual-panel tab এই শুধু দৃশ্যমান */}
      <div className="lg:hidden absolute top-3 right-3 flex items-center gap-0.5 rounded-lg border border-surface-border bg-surface-card/95 backdrop-blur p-1 shadow-card">
        <button
          type="button"
          onClick={() => setMobileViewMode("2d")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mobileViewMode === "2d" ? "bg-brand-600 text-white" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Layout size={13} />
          2D
        </button>
        <button
          type="button"
          onClick={() => setMobileViewMode("3d")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mobileViewMode === "3d" ? "bg-brand-600 text-white" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Boxes size={13} />
          3D
        </button>
      </div>

      {/* --- ডান overlay: elements/page.tsx বা analysis/page.tsx থেকে
          panelOverlay prop দিয়ে আসা content (form/controls) --- */}
      <div className="hidden lg:block absolute top-3 right-3 w-80 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-surface-border bg-surface-card/95 backdrop-blur shadow-card p-4">
        {panelOverlay}
      </div>

      <ViewportStatusChip projectId={projectId} />

      {/* মোবাইলে ডান panel বন্ধ থাকলে এই floating বাটন দিয়ে খোলা যায় */}
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
          <div className="flex-1 overflow-y-auto p-4">{panelOverlay}</div>
        </div>
      )}
    </div>
  );
}
