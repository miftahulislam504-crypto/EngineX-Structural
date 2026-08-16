"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { SubTabHub } from "@/components/workflow/SubTabHub";
import { DOCUMENTATION_HUB_ITEMS } from "@/lib/workflow/subTabLabels";
import type { DocumentationSubTab } from "@/lib/workflow/stageTabs";

/**
 * Documentation hub route — Redesign (২০২৬-০৮)।
 * design/page.tsx এর মতোই একই দুই-ধাপ প্যাটার্ন — বিস্তারিত রেশনাল
 * সেখানে দেখুন। ৯টা tool, group ছাড়া flat card গ্রিড (Design এর ১৭টার
 * মতো group প্রয়োজন হওয়ার মতো বড় সেট না, Optimization এর ৫টার
 * প্যাটার্নের কাছাকাছি)।
 */
export default function DocumentationHubPage({
  params,
}: PageProps<"/model/[projectId]/documentation">) {
  const { projectId } = use(params);
  const router = useRouter();

  function handleSelect(subtab: DocumentationSubTab) {
    router.push(`/model/${projectId}/documentation/${subtab}`);
  }

  return (
    <div className="h-full overflow-y-auto">
      <SubTabHub<DocumentationSubTab> items={DOCUMENTATION_HUB_ITEMS} onSelect={handleSelect} />
    </div>
  );
}
