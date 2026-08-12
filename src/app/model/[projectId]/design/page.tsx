"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { RcBeamDesignPanel } from "@/components/design-panel/RcBeamDesignPanel";
import { RcColumnDesignPanel } from "@/components/design-panel/RcColumnDesignPanel";
import { SteelBeamDesignPanel } from "@/components/design-panel/SteelBeamDesignPanel";
import { SteelColumnDesignPanel } from "@/components/design-panel/SteelColumnDesignPanel";
import { RcSlabDesignPanel } from "@/components/design-panel/RcSlabDesignPanel";
import { RcWallDesignPanel } from "@/components/design-panel/RcWallDesignPanel";
import { FootingDesignPanel } from "@/components/design-panel/FootingDesignPanel";
import { CombinedFootingDesignPanel } from "@/components/design-panel/CombinedFootingDesignPanel";
import { StripFootingDesignPanel } from "@/components/design-panel/StripFootingDesignPanel";
import { MatFoundationDesignPanel } from "@/components/design-panel/MatFoundationDesignPanel";
import { PileDesignPanel } from "@/components/design-panel/PileDesignPanel";
import { PileCapDesignPanel } from "@/components/design-panel/PileCapDesignPanel";
import { SteelConnectionDesignPanel } from "@/components/design-panel/SteelConnectionDesignPanel";
import { RetainingWallDesignPanel } from "@/components/design-panel/RetainingWallDesignPanel";
import { GeotechnicalToolsPanel } from "@/components/design-panel/GeotechnicalToolsPanel";
import { BaseIsolationEnergyDissipationPanel } from "@/components/design-panel/BaseIsolationEnergyDissipationPanel";
import { CollapsePredictionPanel } from "@/components/design-panel/CollapsePredictionPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";
import { useInitialFromSearchParams } from "@/lib/workflow/useInitialFromSearchParams";
import { SubTabBar } from "@/components/workflow/SubTabBar";
import { DESIGN_SUB_TAB_GROUPS } from "@/lib/workflow/subTabLabels";
import type { DesignSubTab } from "@/lib/workflow/stageTabs";

const VALID_DESIGN_SUB_TABS: readonly DesignSubTab[] = [
  "beam",
  "column",
  "steel-beam",
  "steel-column",
  "slab",
  "wall",
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
  "pile",
  "pile-cap",
  "connection",
  "retaining-wall",
  "geotechnical",
  "base-isolation",
  "collapse-prediction",
];

/**
 * Design route — Phase 4 (Panel Migration)।
 *
 * showFullWidthPanel ক্যাটেগরি, ১৭টা sub-tab (গ্রুপ করা — RC Design/
 * Steel Design/Foundation/Advanced, DESIGN_SUB_TAB_GROUPS)। loads/
 * page.tsx এর মতোই ?subtab= URL sync — পার্থক্য শুধু এখানে
 * handleStageNavigate কোনো sub-tab reset করে না (মূল page.tsx এও
 * করত না, শুধু loads stage এই "patterns" এ রিসেট হতো), তাই এখানে
 * layout.tsx এ কোনো বিশেষ query যোগ করা হয়নি।
 *
 * useElementsCore/useMaterialSectionLibrary subscription-trigger
 * করতে কল করা (analysis/validation page এর মতো একই কারণে — ১৭টা
 * design panel ফাইলের মধ্যে ঠিক এই দুটো store ব্যবহার হয়, geometry/
 * loads কোনোটাই না — grep দিয়ে যাচাই করা হয়েছে)।
 */
function DesignPageInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const initialSubTab = useInitialFromSearchParams<DesignSubTab>(
    "subtab",
    VALID_DESIGN_SUB_TABS,
    "beam",
  );

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const [activeDesignSubTab, setActiveDesignSubTabState] = useState<DesignSubTab>(initialSubTab);

  function setActiveDesignSubTab(tab: DesignSubTab) {
    setActiveDesignSubTabState(tab);
    router.replace(`/model/${projectId}/design?subtab=${tab}`);
  }

  const content = (
    <>
      {activeDesignSubTab === "beam" && <RcBeamDesignPanel />}
      {activeDesignSubTab === "column" && <RcColumnDesignPanel />}
      {activeDesignSubTab === "steel-beam" && <SteelBeamDesignPanel />}
      {activeDesignSubTab === "steel-column" && <SteelColumnDesignPanel />}
      {activeDesignSubTab === "slab" && <RcSlabDesignPanel />}
      {activeDesignSubTab === "wall" && <RcWallDesignPanel />}
      {activeDesignSubTab === "footing" && <FootingDesignPanel />}
      {activeDesignSubTab === "combined-footing" && <CombinedFootingDesignPanel />}
      {activeDesignSubTab === "strip-footing" && <StripFootingDesignPanel />}
      {activeDesignSubTab === "mat-foundation" && <MatFoundationDesignPanel />}
      {activeDesignSubTab === "pile" && <PileDesignPanel />}
      {activeDesignSubTab === "pile-cap" && <PileCapDesignPanel />}
      {activeDesignSubTab === "connection" && <SteelConnectionDesignPanel />}
      {activeDesignSubTab === "retaining-wall" && <RetainingWallDesignPanel />}
      {activeDesignSubTab === "geotechnical" && <GeotechnicalToolsPanel />}
      {activeDesignSubTab === "base-isolation" && <BaseIsolationEnergyDissipationPanel />}
      {activeDesignSubTab === "collapse-prediction" && <CollapsePredictionPanel />}
    </>
  );

  return (
    <>
      <SubTabBar<DesignSubTab>
        active={activeDesignSubTab}
        onChange={setActiveDesignSubTab}
        groups={DESIGN_SUB_TAB_GROUPS}
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

export default function DesignPage({ params }: PageProps<"/model/[projectId]/design">) {
  const { projectId } = use(params);
  return (
    <Suspense fallback={<p className="p-4 text-sm text-text-muted">লোড হচ্ছে...</p>}>
      <DesignPageInner projectId={projectId} />
    </Suspense>
  );
}
