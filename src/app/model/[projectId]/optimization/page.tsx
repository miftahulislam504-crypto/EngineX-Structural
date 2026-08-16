"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { SubTabHub } from "@/components/workflow/SubTabHub";
import { OPTIMIZATION_HUB_ITEMS } from "@/lib/workflow/subTabLabels";
import type { OptimizationSubTab } from "@/lib/workflow/stageTabs";

/**
 * Optimization hub route — Redesign (২০২৬-০৮)।
 * design/page.tsx এর মতোই একই দুই-ধাপ প্যাটার্ন — বিস্তারিত রেশনাল
 * সেখানে দেখুন। ৫টা tool, group ছাড়া flat card গ্রিড (ছোট সেট)।
 */
export default function OptimizationHubPage({
  params,
}: PageProps<"/model/[projectId]/optimization">) {
  const { projectId } = use(params);
  const router = useRouter();

  function handleSelect(subtab: OptimizationSubTab) {
    router.push(`/model/${projectId}/optimization/${subtab}`);
  }

  return (
    <div className="h-full overflow-y-auto">
      <SubTabHub<OptimizationSubTab> items={OPTIMIZATION_HUB_ITEMS} onSelect={handleSelect} />
    </div>
  );
}
