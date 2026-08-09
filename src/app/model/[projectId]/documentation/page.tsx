import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route। বিস্তারিত রেশনাল
 * geometry/page.tsx-এ দেখুন (একই প্যাটার্ন সব ১১টা tab-এ)।
 *
 * নোট: "documentation" tab-এর নিজস্ব ৯টা sub-tab আছে
 * (DocumentationSubTab) এবং একটা কার্যকরী DocumentationPanel.tsx +
 * server route /api/documentation/[projectId]/[document]/route.tsx
 * ইতিমধ্যেই আছে (Phase 11a-11i)। Phase 4-এ migrate হওয়ার সময় এই
 * existing panel/API route অক্ষত রেখেই এখানে wire করা হবে — নতুন
 * করে বানাতে হবে না।
 */
export default async function DocumentationRedirectPage(
  props: PageProps<"/model/[projectId]/documentation">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=documentation`);
}
