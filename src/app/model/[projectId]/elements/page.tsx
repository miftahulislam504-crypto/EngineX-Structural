"use client";

import { use } from "react";
import { ElementPanel } from "@/components/elements-panel/ElementPanel";
import { AreaElementPanel } from "@/components/elements-panel/AreaElementPanel";
import { FootingPanel } from "@/components/elements-panel/FootingPanel";
import { CombinedFootingPanel } from "@/components/elements-panel/CombinedFootingPanel";
import { StripFootingPanel } from "@/components/elements-panel/StripFootingPanel";
import { PileGroupPanel } from "@/components/elements-panel/PileGroupPanel";
import { PileCapPanel } from "@/components/elements-panel/PileCapPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { DualPanelViewportShell } from "@/components/viewport/DualPanelViewportShell";

/**
 * Elements route — Phase 4 (Panel Migration)।
 *
 * showDualPanel ক্যাটেগরি (আগে page.tsx এর showDualPanel বুলিয়ানে
 * ছিল, elements/analysis উভয়ই) — তাই এই page শুধু panelOverlay
 * (ফর্ম) সরবরাহ করে, বাকি সব viewport/toolbar/mobile-toggle chrome
 * DualPanelViewportShell এ bundled (দেখুন সেই ফাইলের মন্তব্য)।
 *
 * useElementsCore(projectId) এখানেই একমাত্রবার কল হয় — geometry/
 * page.tsx এর মতো একই কারণে (layout.tsx এর মন্তব্য দেখুন)।
 */
export default function ElementsPage({ params }: PageProps<"/model/[projectId]/elements">) {
  const { projectId } = use(params);

  const { addElement, removeElement } = useElementsCore(projectId);
  const isElementsLoading = useElementsStore((s) => s.isLoading);

  // Beam/Column এর auto-section-assign (autoAssignSection.ts) লাইব্রেরিতে
  // মিলে যাওয়া preset না পেলে নতুন section তৈরি করে save করতে চায় —
  // সেই জন্য addSection এখানেও দরকার (library/page.tsx এ যেভাবে ব্যবহৃত
  // হয় ঠিক সেভাবেই, শুধু ElementPanel কে prop হিসেবে দেওয়া হচ্ছে)।
  const { addSection } = useMaterialSectionLibrary(projectId);

  const panelOverlay = isElementsLoading ? (
    <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
  ) : (
    <div className="space-y-6">
      <ElementPanel onAddElement={addElement} onDeleteElement={removeElement} onAddSection={addSection} />
      <AreaElementPanel onAddElement={addElement} onDeleteElement={removeElement} />
      <FootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
      <CombinedFootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
      <StripFootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
      <PileGroupPanel onAddElement={addElement} onDeleteElement={removeElement} />
      <PileCapPanel onAddElement={addElement} onDeleteElement={removeElement} />
    </div>
  );

  return <DualPanelViewportShell projectId={projectId} panelOverlay={panelOverlay} />;
}
