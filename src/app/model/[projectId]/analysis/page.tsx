import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route। বিস্তারিত রেশনাল
 * geometry/page.tsx-এ দেখুন (একই প্যাটার্ন সব ১১টা tab-এ)।
 */
export default async function AnalysisRedirectPage(
  props: PageProps<"/model/[projectId]/analysis">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=analysis`);
}
