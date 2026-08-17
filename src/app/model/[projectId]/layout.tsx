"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";
import { useProjectInfoCore } from "@/lib/projects/useProjectInfoCore";
import { useProjectInfoStore } from "@/lib/projects/useProjectInfoStore";
import { Sidebar } from "@/components/workflow/Sidebar";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";
import type { SidebarTab } from "@/lib/workflow/stageTabs";

/**
 * Phase 4 (Panel Migration) — persistent shell।
 *
 * Phase 1 এ এই layout.tsx ইচ্ছাকৃতভাবে pure pass-through রাখা হয়েছিল।
 * এখন Sidebar এখানে (layout-level) তুলে আনা হলো — নাহলে tab পাল্টানো
 * মানেই পুরো shell (Sidebar সহ) remount। (আগে এখানে WorkflowSidebar
 * নামে একটা ৯-Stage guided wizard panel-ও ছিল — ব্যবহারকারীর নির্দেশে
 * সম্পূর্ণ সরানো হয়েছে, মূল flat Sidebar navigation অপরিবর্তিত।)
 *
 * ⚠️ গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত (একটা ভুল ধারণা সংশোধন করে): এই
 * layout geometry/library/elements/loads এর ৪টা orchestration hook
 * (useGeometryCore ইত্যাদি) নিজে কল করে না। প্রথমে মনে হয়েছিল এগুলো
 * এখানে move করা দরকার (Firestore subscription tab পাল্টানোয় যেন না
 * ভাঙে) — কিন্তু useGeometryCore.ts পড়ে দেখা গেল এই hook দুটো ভিন্ন
 * জিনিস bundle করে রাখে যেগুলোর multi-call safety আলাদা:
 *
 *   (ক) Firestore subscription (useEffect, setLoading/setGeometry
 *       Zustand-এ write করে) — এটা একাধিকবার কল করা unsafe, দুটো
 *       independent onSnapshot listener একই store-এ race করে লিখবে।
 *   (খ) mutation action closures (addGrid/updateGrid/... —
 *       useCallback দিয়ে বানানো, geometry/persist এর উপর নির্ভরশীল)
 *       — এগুলো hook call থেকে আলাদা করা যায় না (hook বডির ভেতরেই
 *       তৈরি), তাই যে page এর panel এই action গুলো দরকার, তাকেই hook
 *       call করতে হবে।
 *
 * এই দুটো একসাথে bundled থাকায় "hook layout এ move করি" মানে
 * subscription ও layout এ যাবে ঠিকই, কিন্তু action closures childProps
 * হিসেবে children এ pass করা সম্ভব না (Next.js layout তার children কে
 * prop pass করতে পারে না — children আগে থেকেই render করা একটা element,
 * function না)। তাই আসল সমাধান: প্রতিটা hook ঠিক একজায়গায়, তার নিজের
 * domain route page এ (geometry/page.tsx → useGeometryCore,
 * library/page.tsx → useMaterialSectionLibrary, elements/page.tsx →
 * useElementsCore, loads/page.tsx → useLoadCore) — subscription ওখানেই
 * একবার চলে। বাকি সব page (design/analysis/ইত্যাদি, যারা এই ৪ domain এর
 * read-only state পড়ে কিন্তু mutate করে না) সরাসরি Zustand store থেকে
 * পড়ে (useElementsStore((s) => s.elements) ইত্যাদি) — prop-drilling
 * লাগে না, ঠিক design-panel এর ১৭টা ফাইল এখনই যেভাবে করে।
 *
 * এই layout নিজে geometry/library/elements/loads এর isLoading/isSaving/
 * loadError কিছুই পড়ে না — সেই aggregation (isAnyLoading এর মতো)
 * যেখানে ব্যবহার হয় (renderPanelContent এর "লোড হচ্ছে..." গেট, বা
 * viewport-area এর isSaving/loadError status chip), সেটা এখন সবই
 * page-level জিনিস, layout-level chrome না — তাই প্রতিটা relevant
 * child page (geometry/library/elements/loads নিজে, ও design/analysis
 * এর মতো যারা এই state cross-cutting ভাবে পড়ে) নিজের ভেতরে সরাসরি
 * এই Zustand selector গুলো পড়বে, prop drilling ছাড়াই — pure selector
 * read একাধিক জায়গা থেকে করা সম্পূর্ণ নিরাপদ (write না, শুধু read)।
 *
 * useEnsureAuth এই layout এ থাকে (ভিন্ন কারণে — এটা top-level route
 * guard, cross-cutting UI aggregation না) এবং এটা এখানে নিরাপদ — এটা Firebase এর নিজস্ব
 * onAuthStateChanged wrap করে, যেটা একাধিক independent listener
 * সমর্থন করার জন্যই বানানো (প্রতিটা কলের নিজের local useState, কোনো
 * shared Zustand write নেই) — useEnsureAuth.ts এর নিজের comment এটা
 * নিশ্চিত করে।
 */

const VALID_SIDEBAR_TABS: readonly SidebarTab[] = [
  "geometry",
  "library",
  "import",
  "elements",
  "loads",
  "analysis",
  "validation",
  "design",
  "optimization",
  "visualization",
  "detailing",
  "documentation",
];

/**
 * Redesign (২০২৬-০৮) — যে ৪টা ট্যাবের এখনো viewport + mobile ⚙/sheet
 * প্যাটার্ন আছে (elements/analysis/visualization/detailing — 2D/3D
 * canvas এর উপর form overlay হিসেবে বসে)। বাকি সব ট্যাব এখন হয়
 * full-width-form (geometry/library/import/loads/validation, mobile
 * এ সরাসরি ফর্ম, কোনো sheet নেই) অথবা hub (design/optimization/
 * documentation, card-grid থেকে নিজস্ব sub-route এ navigate করে,
 * সেই sub-route নিজেও full-width-form)। handleMobileSelectTab এই
 * তালিকা দিয়ে ঠিক করে mobilePanelOpen auto-open করা উচিত কিনা —
 * viewport ট্যাব না হলে sheet খোলার কোনো মানে নেই (সেই পেজ
 * useShellUiStore.mobilePanelOpen পড়েই না)।
 */
const VIEWPORT_TABS: readonly SidebarTab[] = ["elements", "analysis", "visualization", "detailing"];

/**
 * বর্তমান pathname থেকে active SidebarTab বের করে — Sidebar এর
 * active-state highlighting এর জন্য দরকার। geometry route এর pathname
 * /model/[projectId] দিয়েই শেষ হয় (কোনো /geometry suffix নেই — geometry
 * কে root/default tab হিসেবে রাখা হয়েছে, migration এ geometry/page.tsx
 * root path এ বসবে, বাকি ১০টার নিজস্ব path segment থাকবে)।
 */
function tabFromPathname(pathname: string): SidebarTab {
  const segments = pathname.split("/").filter(Boolean); // ["model", projectId, tab?]
  const maybeTab = segments[2];
  return maybeTab && (VALID_SIDEBAR_TABS as readonly string[]).includes(maybeTab)
    ? (maybeTab as SidebarTab)
    : "geometry";
}

function ModelLayoutInner({ children, params }: LayoutProps<"/model/[projectId]">) {
  const { projectId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const setProjectId = useProjectIdStore((s) => s.setProjectId);

  useEffect(() => {
    setProjectId(projectId);
  }, [projectId, setProjectId]);

  // --- Route Guard (Phase 0.2, Phase 4-এ page.tsx থেকে এখানে সরানো) ---
  const { user, isReady: isAuthReady } = useEnsureAuth();

  useEffect(() => {
    if (isAuthReady && !user) {
      router.replace("/login");
    }
  }, [isAuthReady, user, router]);

  // Redesign (২০২৬-০৮) — projectId → projectName resolve (Sidebar
  // header, mobile top bar, ViewportStatusChip — সব জায়গায় raw id এর
  // বদলে মানুষের-পড়ার-উপযোগী নাম দেখাতে)। layout.tsx-এই একবার কল করা
  // হচ্ছে, isAuthReady এখান থেকেই পাস করা হয় (useProjectInfoCore.ts এর
  // নিজের কমেন্টে বিস্তারিত কারণ)।
  useProjectInfoCore(projectId, isAuthReady);
  const projectName = useProjectInfoStore((s) => s.projectName);

  const mobileSidebarOpen = useShellUiStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useShellUiStore((s) => s.setMobileSidebarOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const activeTab = tabFromPathname(pathname);

  /**
   * router.replace ব্যবহার করা হয়েছে (push না) — Phase 2 এর সিদ্ধান্তের
   * ধারাবাহিকতায়: প্রতিটা tab switch আলাদা history entry হয়ে গেলে
   * ব্যাক বাটনে tab-by-tab পিছাতে হবে, যা খারাপ UX। এটা এখন সত্যিকারের
   * route navigation হলেও ব্যবহারকারীর কাছে এখনো "কোন panel দেখছি"
   * পাল্টানো, তাই history আচরণ আগের মতোই।
   */
  function navigateToTab(tab: SidebarTab) {
    const path = tab === "geometry" ? `/model/${projectId}` : `/model/${projectId}/${tab}`;
    router.replace(path);
  }

  function handleSelectTab(tab: SidebarTab) {
    navigateToTab(tab);
  }

  function handleMobileSelectTab(tab: SidebarTab) {
    navigateToTab(tab);
    setMobileSidebarOpen(false);
    if (VIEWPORT_TABS.includes(tab)) {
      setMobilePanelOpen(true);
    }
  }

  if (!isAuthReady || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <span className="spinner" aria-label="লোড হচ্ছে" />
      </div>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-surface text-text-primary overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab} onSelectTab={handleSelectTab} projectName={projectName} />
      </div>
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[80vw] max-w-xs h-full shadow-2xl">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={handleMobileSelectTab}
              onClose={() => setMobileSidebarOpen(false)}
              projectName={projectName}
            />
          </div>
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex-1 bg-white/60 backdrop-blur-sm"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center justify-between border-b border-surface-border bg-surface-card px-3 py-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary px-1"
            aria-label="মেনু খুলুন"
          >
            ☰
          </button>
          <span className="text-xs font-medium text-text-primary truncate px-2">
            {projectName ?? projectId}
          </span>
          <span className="w-6" aria-hidden="true" />
        </div>

        {children}
      </div>
    </main>
  );
}

export default function ModelLayout(props: LayoutProps<"/model/[projectId]">) {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-surface">
          <span className="spinner" aria-label="লোড হচ্ছে" />
        </div>
      }
    >
      <ModelLayoutInner {...props} />
    </Suspense>
  );
}
