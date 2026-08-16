"use client";

import { use } from "react";
import { GridPanel } from "@/components/geometry-panel/GridPanel";
import { StoryPanel } from "@/components/geometry-panel/StoryPanel";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";

/**
 * Geometry route — Redesign (২০২৬-০৮)।
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
 * ⚠️ Redesign (২০২৬-০৮): এই tab আগে mobile-এ একটা ⚙ ফ্লোটিং বাটনের
 * পেছনে ফর্ম লুকিয়ে রাখত (আলাদা mobilePanelOpen sheet খুলতে হতো) —
 * ব্যবহারকারীর স্পষ্ট নির্দেশ অনুযায়ী এই full-width-form ক্যাটেগরির
 * tab (geometry/library/import/loads/validation) থেকে সেই অতিরিক্ত
 * ধাপ সরানো হলো: ট্যাব ক্লিক করলেই এখন সরাসরি ফর্ম দেখা যায়, mobile
 * আর desktop উভয় viewport-এই একই layout (শুধু max-width container,
 * কোনো hidden/lg:block split না)।
 */
export default function GeometryPage({ params }: PageProps<"/model/[projectId]">) {
  const { projectId } = use(params);
  const { addGrid, updateGrid, deleteGrid, addStory, updateStory, deleteStory } =
    useGeometryCore(projectId);

  const isGeometryLoading = useGeometryStore((s) => s.isLoading);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        {isGeometryLoading ? (
          <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
        ) : (
          <div className="space-y-6">
            <GridPanel onAddGrid={addGrid} onUpdateGrid={updateGrid} onDeleteGrid={deleteGrid} />
            <StoryPanel onAddStory={addStory} onUpdateStory={updateStory} onDeleteStory={deleteStory} />
          </div>
        )}
      </div>
    </div>
  );
}
