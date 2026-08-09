import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route। বিস্তারিত রেশনাল
 * geometry/page.tsx-এ দেখুন (একই প্যাটার্ন সব ১১টা tab-এ)।
 */
export default async function DetailingRedirectPage(
  props: PageProps<"/model/[projectId]/detailing">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=detailing`);
}
