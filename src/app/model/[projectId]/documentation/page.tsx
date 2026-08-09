"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { RebarLayoutPanel } from "@/components/design-panel/RebarLayoutPanel";
import { StirrupTieZonePanel } from "@/components/design-panel/StirrupTieZonePanel";
import { DevelopmentLengthPanel } from "@/components/design-panel/DevelopmentLengthPanel";
import { BarBendingSchedulePanel } from "@/components/design-panel/BarBendingSchedulePanel";
import { SectionDetailPanel } from "@/components/design-panel/SectionDetailPanel";
import { ConnectionDetailPanel } from "@/components/design-panel/ConnectionDetailPanel";
import { GeneralNotesPanel } from "@/components/design-panel/GeneralNotesPanel";
import { DrawingSyncPanel } from "@/components/design-panel/DrawingSyncPanel";
import { DocumentationPanel } from "@/components/documentation-panel/DocumentationPanel";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";
import { useInitialFromSearchParams } from "@/lib/workflow/useInitialFromSearchParams";
import { SubTabBar } from "@/components/workflow/SubTabBar";
import { DOCUMENTATION_SUB_TABS } from "@/lib/workflow/subTabLabels";
import type { DocumentationSubTab } from "@/lib/workflow/stageTabs";

const VALID_DOCUMENTATION_SUB_TABS: readonly DocumentationSubTab[] = [
  "rebar-layout",
  "stirrup-tie-zones",
  "development-length",
  "bar-bending-schedule",
  "section-detail",
  "connection-detail",
  "general-notes",
  "drawing-sync",
  "reports-export",
];

/**
 * Documentation route — Phase 4 (Panel Migration)।
 *
 * showFullWidthPanel ক্যাটেগরি, ৯টা sub-tab। ডিফল্ট
 * "bar-bending-schedule" (মূল page.tsx এর useState initial value থেকে
 * হুবহু কপি করা)। কোনো stage-navigate reset নেই (loads এর মতো না)।
 *
 * ⚠️ এই ৯টা ফাইলের কোনোটাই geometry/elements/library/loads store
 * পড়ে না (grep দিয়ে যাচাই করা — ভিন্ন ৪টা core hook এর কোনোটাই এই
 * page এ কল করতে হয়নি, বাকি সব sub-tab page থেকে এই page টাই সবচেয়ে
 * সহজ)।
 *
 * reports-export sub-tab টা Phase 11i-এর DocumentationPanel.tsx —
 * migration শুরুর আগে re-verify করা হয়েছিল এটা সত্যিই কাজ করছে কিনা
 * (build + প্রোডাকশন সার্ভার চালিয়ে curl দিয়ে client bundle এ
 * "reports-export" স্ট্রিং ও DocumentationPanel এর actual render
 * call কনফার্ম করা হয়েছে, শুধু stale comment ছিল না) — তাই এখানে নতুন
 * কোনো wiring লজিক লাগেনি, শুধু অন্য ৮টা sub-tab এর মতোই সরানো।
 */
function DocumentationPageInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const initialSubTab = useInitialFromSearchParams<DocumentationSubTab>(
    "subtab",
    VALID_DOCUMENTATION_SUB_TABS,
    "bar-bending-schedule",
  );

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const [activeDocumentationSubTab, setActiveDocumentationSubTabState] =
    useState<DocumentationSubTab>(initialSubTab);

  function setActiveDocumentationSubTab(tab: DocumentationSubTab) {
    setActiveDocumentationSubTabState(tab);
    router.replace(`/model/${projectId}/documentation?subtab=${tab}`);
  }

  const content = (
    <>
      {activeDocumentationSubTab === "rebar-layout" && <RebarLayoutPanel />}
      {activeDocumentationSubTab === "stirrup-tie-zones" && <StirrupTieZonePanel />}
      {activeDocumentationSubTab === "development-length" && <DevelopmentLengthPanel />}
      {activeDocumentationSubTab === "bar-bending-schedule" && <BarBendingSchedulePanel />}
      {activeDocumentationSubTab === "section-detail" && <SectionDetailPanel />}
      {activeDocumentationSubTab === "connection-detail" && <ConnectionDetailPanel />}
      {activeDocumentationSubTab === "general-notes" && <GeneralNotesPanel />}
      {activeDocumentationSubTab === "drawing-sync" && <DrawingSyncPanel />}
      {activeDocumentationSubTab === "reports-export" && <DocumentationPanel projectId={projectId} />}
    </>
  );

  return (
    <>
      <SubTabBar<DocumentationSubTab>
        active={activeDocumentationSubTab}
        onChange={setActiveDocumentationSubTab}
        tabs={DOCUMENTATION_SUB_TABS}
      />

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

export default function DocumentationPage({ params }: PageProps<"/model/[projectId]/documentation">) {
  const { projectId } = use(params);
  return (
    <Suspense fallback={<p className="p-4 text-sm text-text-muted">লোড হচ্ছে...</p>}>
      <DocumentationPageInner projectId={projectId} />
    </Suspense>
  );
}
