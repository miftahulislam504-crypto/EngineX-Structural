import { redirect } from "next/navigation";

/**
 * Phase 1 (Routing Skeleton) — placeholder route।
 *
 * "geometry" এখনো তার নিজের real content পায়নি (সেটা Phase 4-এর
 * কাজ — page.tsx-এর activeTab === "geometry" ব্লকটা এখানে সরিয়ে
 * আনা হবে)। এই মুহূর্তে page.tsx-ই একমাত্র জায়গা যেখানে "geometry"
 * panel আসলে render হয় (activeTab state দিয়ে), আর সেই state
 * সবসময় "geometry" দিয়েই শুরু হয় — কোনো query-param/deep-link
 * mechanism এখনো নেই।
 *
 * তাই এই মুহূর্তে সবচেয়ে নিরাপদ আচরণ: ভেঙে না পড়ে, বরং existing
 * কার্যকরী page-এ ফিরিয়ে দেওয়া, ?tab=geometry যোগ করে — যাতে
 * Phase 2/4-এ page.tsx যখন এই query param পড়া শুরু করবে (deep-link
 * সমর্থনের অংশ হিসেবে), তখন এই redirect আপনা থেকেই সঠিক জায়গায়
 * নিয়ে যাবে, এই ফাইল আবার ছোঁয়া ছাড়াই। এখন তাৎক্ষণিকভাবে এটা
 * geometry tab-এ পড়বে (page.tsx এখনো ?tab পড়ে না) — এটা আজকের
 * আচরণের চেয়ে খারাপ না (আজও সরাসরি /model/[projectId] এ গেলে
 * সবসময় geometry-ই দেখায়)।
 *
 * redirect() এর ডিফল্ট 'replace' type ইচ্ছাকৃতভাবে রাখা হয়েছে
 * (override করা হয়নি) — ব্যবহারকারী বারবার এই placeholder route-এ
 * আসা-যাওয়া করলে browser history-তে redirect chain জমতে না দেওয়ার
 * জন্য।
 */
export default async function GeometryRedirectPage(
  props: PageProps<"/model/[projectId]/geometry">,
) {
  const { projectId } = await props.params;
  redirect(`/model/${projectId}?tab=geometry`);
}
