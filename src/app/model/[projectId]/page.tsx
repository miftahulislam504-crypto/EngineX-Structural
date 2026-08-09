"use client";

import { use } from "react";
import { GridPanel } from "@/components/geometry-panel/GridPanel";
import { StoryPanel } from "@/components/geometry-panel/StoryPanel";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useShellUiStore } from "@/lib/workflow/useShellUiStore";

/**
 * Geometry route — Phase 4 (Panel Migration)।
 *
 * এটাই root/default tab (path: /model/[projectId], কোনো suffix
 * নেই) — layout.tsx এর tabFromPathname() এই convention জানে, Sidebar
 * এর navigateToTab()ও geometry কে বিশেষভাবে হ্যান্ডল করে।
 *
 * এই page useGeometryCore(projectId) নিজে কল করে — এটাই একমাত্র
 * জায়গা যেখানে এই hook কল হয় (layout.tsx এ না, কেন তার বিস্তারিত
 * কারণ layout.tsx এর নিজের মন্তব্যে)। GridPanel/StoryPanel এর
 * mutation callback (addGrid/updateGrid/... ) এই hook এর return
 * value থেকেই আসে, ঠিক আগে page.tsx এ যেভাবে আসত।
 *
 * showFullWidthPanel ক্যাটেগরির tab (আগে page.tsx এর
 * showFullWidthPanel বুলিয়ানে গোষ্ঠীভুক্ত ছিল — geometry/library/
 * validation/design/optimization/documentation, dual-panel viewport
 * (elements/analysis) বা single-panel viewport (visualization/
 * detailing) না) — তাই এই page এর নিজস্ব কোনো viewport/3D canvas
 * নেই, শুধু max-w-3xl কেন্দ্রীভূত ফর্ম কলাম (desktop) + full-screen
 * sheet (mobile, mobilePanelOpen true হলে)।
 */
export default function GeometryPage({ params }: PageProps<"/model/[projectId]">) {
  const { projectId } = use(params);
  const { addGrid, updateGrid, deleteGrid, addStory, updateStory, deleteStory } =
    useGeometryCore(projectId);

  const isGeometryLoading = useGeometryStore((s) => s.isLoading);

  const mobilePanelOpen = useShellUiStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useShellUiStore((s) => s.setMobilePanelOpen);

  const content = isGeometryLoading ? (
    <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
  ) : (
    <div className="space-y-6">
      <GridPanel onAddGrid={addGrid} onUpdateGrid={updateGrid} onDeleteGrid={deleteGrid} />
      <StoryPanel onAddStory={addStory} onUpdateStory={updateStory} onDeleteStory={deleteStory} />
    </div>
  );

  return (
    <>
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
