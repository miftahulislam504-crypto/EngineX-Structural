"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { FoundationOptimizationPanel } from "@/components/design-panel/FoundationOptimizationPanel";
import { SectionOptimizationPanel } from "@/components/design-panel/SectionOptimizationPanel";
import { WeightOptimizationPanel } from "@/components/design-panel/WeightOptimizationPanel";
import { CostOptimizationPanel } from "@/components/design-panel/CostOptimizationPanel";
import { ConstructionAiTopologyOptimizationPanel } from "@/components/design-panel/ConstructionAiTopologyOptimizationPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";
import { useInitialFromSearchParams } from "@/lib/workflow/useInitialFromSearchParams";
import { SubTabBar } from "@/components/workflow/SubTabBar";
import { OPTIMIZATION_SUB_TABS } from "@/lib/workflow/subTabLabels";
import type { OptimizationSubTab } from "@/lib/workflow/stageTabs";

const VALID_OPTIMIZATION_SUB_TABS: readonly OptimizationSubTab[] = [
  "foundation-optimization",
  "section-optimization",
  "weight-optimization",
  "cost-optimization",
  "construction-ai-topology-optimization",
];

/**
 * Optimization route — Phase 4 (Panel Migration)।
 *
 * Phase 0.5 থেকে independent tab (আগে design এর sub-tab ছিল)। ৫টা
 * sub-panel — সবগুলো design-panel/ ফোল্ডারেই থাকে (কোনো আলাদা
 * optimization-panel/ ফোল্ডার নেই), যদিও conceptually optimization।
 * ডিফল্ট sub-tab "section-optimization" (তালিকার প্রথমটা
 * "foundation-optimization" না — মূল page.tsx এর useState initial
 * value থেকে হুবহু কপি করা)।
 *
 * design/page.tsx এর মতোই একই ?subtab= প্যাটার্ন, কোনো
 * stage-navigate reset নেই (মূল page.tsx এও ছিল না)।
 */
function OptimizationPageInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const initialSubTab = useInitialFromSearchParams<OptimizationSubTab>(
    "subtab",
    VALID_OPTIMIZATION_SUB_TABS,
    "section-optimization",
  );

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const [activeOptimizationSubTab, setActiveOptimizationSubTabState] =
    useState<OptimizationSubTab>(initialSubTab);

  function setActiveOptimizationSubTab(tab: OptimizationSubTab) {
    setActiveOptimizationSubTabState(tab);
    router.replace(`/model/${projectId}/optimization?subtab=${tab}`);
  }

  const content = (
    <>
      {activeOptimizationSubTab === "foundation-optimization" && <FoundationOptimizationPanel />}
      {activeOptimizationSubTab === "section-optimization" && <SectionOptimizationPanel />}
      {activeOptimizationSubTab === "weight-optimization" && <WeightOptimizationPanel />}
      {activeOptimizationSubTab === "cost-optimization" && <CostOptimizationPanel />}
      {activeOptimizationSubTab === "construction-ai-topology-optimization" && (
        <ConstructionAiTopologyOptimizationPanel />
      )}
    </>
  );

  return (
    <>
      <SubTabBar<OptimizationSubTab>
        active={activeOptimizationSubTab}
        onChange={setActiveOptimizationSubTab}
        tabs={OPTIMIZATION_SUB_TABS}
      />

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

export default function OptimizationPage({ params }: PageProps<"/model/[projectId]/optimization">) {
  const { projectId } = use(params);
  return (
    <Suspense fallback={<p className="p-4 text-sm text-text-muted">লোড হচ্ছে...</p>}>
      <OptimizationPageInner projectId={projectId} />
    </Suspense>
  );
}
