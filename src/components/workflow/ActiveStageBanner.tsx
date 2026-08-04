"use client";

import { STAGES } from "@/lib/workflow/stageTabs";
import type { StageId } from "@/lib/workflow/types";

/**
 * Viewport-এর উপরে ছোট overlay — বর্তমান wizard stage কী এবং তার
 * এক-লাইন গাইডেন্স দেখায়। WorkflowSidebar-এর stage card-এ যে
 * description থাকে সেটাই এখানে পুনরায় দেখানো হয়, যাতে ইঞ্জিনিয়ার
 * viewport-এ কাজ করার সময় বারবার বাম sidebar-এ ফিরে তাকাতে না হয়।
 */
export function ActiveStageBanner({ stageId }: { stageId: StageId }) {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return null;

  return (
    <div className="bg-slate-900/80 backdrop-blur rounded-md px-3 py-2 border border-slate-800">
      <p className="text-xs font-medium text-sky-400">
        Stage {stage.order}/9 — {stage.label} <span className="text-slate-500">({stage.labelBn})</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{stage.description}</p>
    </div>
  );
}
