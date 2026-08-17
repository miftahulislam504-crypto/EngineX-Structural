"use client";

import { use, useState } from "react";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { DetailingPanel } from "@/components/detailing-panel/DetailingPanel";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useElementsCore } from "@/lib/elements/useElementsCore";

/**
 * Detailing route — Phase 4 (Panel Migration)।
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
 *
 * Redesign (২০২৬-০৮) — আগে DetailingPanel viewport-এর উপরে ভাসমান
 * ডান-পাশের card এ বসত (mobile-এ আলাদা ⚙ sheet)। ব্যবহারকারীর
 * নির্দেশে সেসব সরিয়ে top bar + full-width viewport লেআউটে আনা
 * হয়েছে — DetailingPanel এখন নিজেই একটা ViewportTopBar রেন্ডার করে,
 * mobile ও desktop-এ একই লেআউট।
 */
export default function DetailingPage({ params }: PageProps<"/model/[projectId]/detailing">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  useElementsCore(projectId);

  const [showDetailingStirrups, setShowDetailingStirrups] = useState(true);
  const [showDetailingMesh, setShowDetailingMesh] = useState(true);
  const [detailingIsolateElementId, setDetailingIsolateElementId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <DetailingPanel
        showStirrups={showDetailingStirrups}
        onToggleStirrups={setShowDetailingStirrups}
        showMesh={showDetailingMesh}
        onToggleMesh={setShowDetailingMesh}
        isolateElementId={detailingIsolateElementId}
        onSetIsolateElementId={setDetailingIsolateElementId}
      />
      <div className="relative flex-1 min-h-0">
        <StructuralViewport
          showDetailing={true}
          showStirrups={showDetailingStirrups}
          showMesh={showDetailingMesh}
          isolateElementId={detailingIsolateElementId}
        />
        <ViewportStatusChip projectId={projectId} />
      </div>
    </div>
  );
}
