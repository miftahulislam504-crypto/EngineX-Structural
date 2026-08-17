"use client";

import { use } from "react";
import { VisualizationViewport } from "@/components/viewport/VisualizationViewport";
import { VisualizationControlsPanel } from "@/components/viewport/VisualizationControlsPanel";
import { ViewportStatusChip } from "@/components/viewport/ViewportStatusChip";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useElementsCore } from "@/lib/elements/useElementsCore";

/**
 * Visualization route — Redesign (২০২৬-০৮; মূলত Phase 4)।
 *
 * ২০২৬-০৮ layout redesign: viewport-এর উপরে ভাসমান ডান-পাশের overlay
 * card (ও mobile-এ আলাদা ⚙ sheet) সরিয়ে ফেলা হয়েছে — ব্যবহারকারীর
 * নির্দেশ অনুযায়ী Analysis/Visualization/Detailing-এ অপশন কম বলে এখন
 * viewport-এর ঠিক উপরে একটা সবসময়-দৃশ্যমান horizontal option bar
 * (ViewportTopBar, VisualizationControlsPanel-এর ভেতরেই রেন্ডার হয়),
 * তার নিচে ফুল-উইথ viewport — mobile ও desktop উভয় জায়গায় একই লেআউট,
 * কোনো floating card/sheet নেই।
 *
 * VisualizationViewport/VisualizationControlsPanel — দুটোই
 * useGeometryStore + useElementsStore পড়ে, তাই এই page useGeometryCore
 * + useElementsCore subscription-trigger করতে কল করে।
 */
export default function VisualizationPage({ params }: PageProps<"/model/[projectId]/visualization">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  useElementsCore(projectId);

  return (
    <div className="flex flex-col h-full">
      <VisualizationControlsPanel />
      <div className="relative flex-1 min-h-0">
        <VisualizationViewport />
        <ViewportStatusChip projectId={projectId} />
      </div>
    </div>
  );
}
