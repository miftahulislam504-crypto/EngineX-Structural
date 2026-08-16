"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { SubTabHub } from "@/components/workflow/SubTabHub";
import { DESIGN_HUB_GROUPS } from "@/lib/workflow/subTabLabels";
import type { DesignSubTab } from "@/lib/workflow/stageTabs";

/**
 * Design hub route — Redesign (২০২৬-০৮)।
 *
 * ব্যবহারকারীর নির্দেশ: "design, optimization, documentation এও full
 * width থাকবে তবে এটা ক্লিক করলে এর অপশন গুলো আসবে তারপর ক্লিক করলে
 * আলাদা পেজে সেগুলো ডিজাইন হবে" — তাই এই page এখন আর সরাসরি কোনো
 * design panel দেখায় না (আগে যেমন SubTabBar + inline content দেখাত)।
 * শুধু ১৭টা design tool এর একটা card-grid (SubTabHub, groups দিয়ে —
 * RC/Steel/Foundation/Advanced)। ক্লিক করলে /design/[subtab] এ push
 * করে, যেটা নিজস্ব route page — deep-link/share/refresh-safe, ঠিক
 * অন্য top-level tab গুলোর মতোই একটা প্রকৃত URL, query param ট্রিক না।
 */
export default function DesignHubPage({ params }: PageProps<"/model/[projectId]/design">) {
  const { projectId } = use(params);
  const router = useRouter();

  function handleSelect(subtab: DesignSubTab) {
    router.push(`/model/${projectId}/design/${subtab}`);
  }

  return (
    <div className="h-full overflow-y-auto">
      <SubTabHub<DesignSubTab> groups={DESIGN_HUB_GROUPS} onSelect={handleSelect} />
    </div>
  );
}
