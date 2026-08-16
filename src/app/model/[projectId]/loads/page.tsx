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
 * Loads route — Redesign (২০২৬-০৮)।
 *
 * full-width-form ক্যাটেগরি, কিন্তু geometry/library এর থেকে
 * ভিন্ন — এর নিজস্ব ৫টা sub-tab আছে (LoadSubTab)। এই sub-tab pill bar
 * ইচ্ছাকৃতভাবে রাখা হয়েছে (design/optimization/documentation এর
 * মতো আলাদা "option list → নিজস্ব পেজ" এ ভাঙা হয়নি) — Loads এর ৫টা
 * sub-tab একটা tightly-related single workflow (pattern → wind/seismic
 * calc → apply → combine), যেখানে Design এর ১৭টা বা Documentation এর
 * ৯টা সম্পূর্ণ স্বতন্ত্র calculator/tool, প্রতিটার নিজের বিস্তারিত
 * ফর্ম — সেই কারণেই user স্পষ্টভাবে শুধু design/optimization/
 * documentation কে দুই-ধাপ প্যাটার্নে ভাঙতে বলেছেন।
 *
 * URL সিঙ্ক (?subtab=) আগের মতোই বহাল — layout.tsx এর
 * handleStageNavigate "loads" stage এ নেভিগেট করলে ?subtab=patterns
 * দিয়ে রিসেট করে (layout.tsx এর মন্তব্য দেখুন), আর deep-link/share/
 * refresh-safe রাখতে।
 *
 * mobile ⚙/sheet প্যাটার্ন সরানো হলো — root page.tsx এর মন্তব্যে
 * বিস্তারিত কারণ। SubTabBar এখন সবসময় content এর ঠিক উপরে, mobile ও
 * desktop উভয়ে একই layout।
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

  const [activeLoadSubTab, setActiveLoadSubTabState] = useState<LoadSubTab>(initialSubTab);

  function setActiveLoadSubTab(tab: LoadSubTab) {
    setActiveLoadSubTabState(tab);
    router.replace(`/model/${projectId}/loads?subtab=${tab}`);
  }

  return (
    <>
      <SubTabBar<LoadSubTab> active={activeLoadSubTab} onChange={setActiveLoadSubTab} tabs={LOAD_SUB_TABS} />

      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 lg:p-6">
          {isLoadsLoading ? (
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
          )}
        </div>
      </div>
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
