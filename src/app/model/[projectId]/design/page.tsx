import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route। বিস্তারিত রেশনাল
 * geometry/page.tsx-এ দেখুন (একই প্যাটার্ন সব ১১টা tab-এ)।
 *
 * নোট: "design" tab-এর নিজস্ব ১৭টা sub-tab আছে (DesignSubTab,
 * lib/workflow/stageTabs.ts দেখুন) — Phase 4-এ migrate হওয়ার সময়ও
 * এগুলো এই একই route-এর ভেতরে sub-tab bar হিসেবে থাকবে, আলাদা
 * nested route না (Phase 0.5-এর flat-sidebar/no-nested-dropdown
 * সিদ্ধান্তের ধারাবাহিকতায়)।
 */
export default async function DesignRedirectPage(
  props: PageProps<"/model/[projectId]/design">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=design`);
}
