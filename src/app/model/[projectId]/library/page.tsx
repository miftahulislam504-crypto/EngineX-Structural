import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route।
 *
 * "library" এখনো তার নিজের real content পায়নি (সেটা Phase 4-এর
 * কাজ — page.tsx-এর activeTab === "library" ব্লকটা এখানে সরিয়ে
 * আনা হবে)। বিস্তারিত রেশনাল geometry/page.tsx-এ দেখুন (একই
 * প্যাটার্ন সব ১১টা tab-এ)।
 */
export default async function LibraryRedirectPage(
  props: PageProps<"/model/[projectId]/library">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=library`);
}
