"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadPatternPanel } from "@/components/load-panel/LoadPatternPanel";
import { WindLoadPanel } from "@/components/load-panel/WindLoadPanel";
import { SeismicLoadPanel } from "@/components/load-panel/SeismicLoadPanel";
import { ElementLoadPanel } from "@/components/load-panel/ElementLoadPanel";
import { LoadCombinationPanel } from "@/components/load-panel/LoadCombinationPanel";
import { useLoadCore } from "@/lib/loads/useLoadCore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";
import { useInitialFromSearchParams } from "@/lib/workflow/useInitialFromSearchParams";
import { SubTabBar } from "@/components/workflow/SubTabBar";
import { LOAD_SUB_TABS } from "@/lib/workflow/subTabLabels";
import type { LoadSubTab } from "@/lib/workflow/stageTabs";

const VALID_LOAD_SUB_TABS: readonly LoadSubTab[] = [
  "patterns",
  "wind",
  "seismic",
  "apply",
  "combinations",
];

/**
 * Loads route — Phase 4 (Panel Migration)।
 *
 * showFullWidthPanel ক্যাটেগরি, কিন্তু geometry/library এর থেকে
 * ভিন্ন — এর নিজস্ব ৫টা sub-tab আছে (LoadSubTab), যা মূল page.tsx এ
 * activeLoadSubTab local useState ছিল। এখন এই page নিজেই সেই state
 * রাখে, কিন্তু URL এর সাথে সিঙ্ক করে (?subtab=) — top-level tab
 * page.tsx (Phase 2) যেভাবে ?tab দিয়ে সিঙ্ক করত, একই প্যাটার্ন এখানে
 * extend করা হলো, দুই কারণে: (১) layout.tsx এর handleStageNavigate
 * "loads" stage এ নেভিগেট করার সময় sub-tab "patterns" এ রিসেট করে
 * ?subtab=patterns দিয়ে (দেখুন layout.tsx এর মন্তব্য) — সেটা এখানে
 * পড়া দরকার; (২) deep-link/share/refresh-safe করার একই সুবিধা যা
 * top-level tab পেয়েছে।
 *
 * SubTabBar এখানে content wrapper এর বাইরে, উপরে বসানো হয়েছে (মূল
 * page.tsx এ যেমন ছিল — flex-1 wrapper এর আগে, mobilePanelOpen sheet
 * এর ভেতরে না) — অর্থাৎ মোবাইলেও এই বার সবসময় দৃশ্যমান, sheet বন্ধ
 * থাকা অবস্থাতেও।
 */
function LoadsPageInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const initialSubTab = useInitialFromSearchParams<LoadSubTab>(
    "subtab",
    VALID_LOAD_SUB_TABS,
    "patterns",
  );

  const { addPattern, deletePattern, toggleCombination, addCustomCombination, addLoadCase, removeLoadCase } =
    useLoadCore(projectId);
  const isLoadsLoading = useLoadStore((s) => s.isLoading);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const [activeLoadSubTab, setActiveLoadSubTabState] = useState<LoadSubTab>(initialSubTab);

  function setActiveLoadSubTab(tab: LoadSubTab) {
    setActiveLoadSubTabState(tab);
    router.replace(`/model/${projectId}/loads?subtab=${tab}`);
  }

  const content = isLoadsLoading ? (
    <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
  ) : (
    <>
      {activeLoadSubTab === "patterns" && (
        <LoadPatternPanel onAddPattern={addPattern} onDeletePattern={deletePattern} />
      )}
      {activeLoadSubTab === "wind" && <WindLoadPanel />}
      {activeLoadSubTab === "seismic" && <SeismicLoadPanel />}
      {activeLoadSubTab === "apply" && (
        <ElementLoadPanel onAddLoadCase={addLoadCase} onDeleteLoadCase={removeLoadCase} />
      )}
      {activeLoadSubTab === "combinations" && (
        <LoadCombinationPanel
          onToggleCombination={toggleCombination}
          onAddCustomCombination={addCustomCombination}
        />
      )}
    </>
  );

  return (
    <>
      <SubTabBar<LoadSubTab> active={activeLoadSubTab} onChange={setActiveLoadSubTab} tabs={LOAD_SUB_TABS} />

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

export default function LoadsPage({ params }: PageProps<"/model/[projectId]/loads">) {
  const { projectId } = use(params);
  return (
    <Suspense fallback={<p className="p-4 text-sm text-text-muted">লোড হচ্ছে...</p>}>
      <LoadsPageInner projectId={projectId} />
    </Suspense>
  );
}
