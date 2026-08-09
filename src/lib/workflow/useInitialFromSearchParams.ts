"use client";

import { useSearchParams } from "next/navigation";

/**
 * Phase 4 (Panel Migration) — Phase 2-এ page.tsx এর ভেতরে
 * useInitialTabFromSearchParams নামে একটা এক-বার-ব্যবহারযোগ্য hook
 * ছিল (শুধু SidebarTab এর জন্য, সেই ফাইলেই ইনলাইন)। এখন geometry
 * বাদে loads/design/optimization/documentation — এই ৪টা route page
 * এরও নিজস্ব sub-tab আছে যেটা একই কারণে (deep-link/share/refresh-safe
 * করতে, আর WorkflowSidebar এর handleStageNavigate এর "loads stage এ
 * গেলে sub-tab প্রথম ধাপে রিসেট করা" আচরণ বজায় রাখতে — উপরের
 * ModelLayout দেখুন) query param থেকে সিড হওয়া দরকার। তাই generic
 * করে এখানে বের করে আনা হলো, একই লজিক ৫ জায়গায় কপি-পেস্ট না করে।
 *
 * useSearchParams() একটা Client Component hook — prerendered/dynamic
 * route এ এটা কল করা component কে <Suspense> এর ভেতরে রাখা Next.js
 * docs এর সুপারিশ (নাহলে তার উপরের পুরো client tree client-side-only
 * রেন্ডার হয়ে যায়)। প্রতিটা কলার (loads/page.tsx ইত্যাদি) নিজের
 * default export কে <Suspense> দিয়ে wrap করবে, page.tsx এর
 * StructuralModelPage wrapper এর মতোই।
 *
 * শুধু initial mount এ পড়া হয় (useState initializer এ ব্যবহারের
 * উদ্দেশ্যে) — param পরে বদলালে (SubTabBar ক্লিকের মাধ্যমে) caller
 * নিজেই router.replace দিয়ে URL মিলিয়ে রাখে, এই hook আবার পড়ে না।
 */
export function useInitialFromSearchParams<T extends string>(
  paramName: string,
  validValues: readonly T[],
  fallback: T,
): T {
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName);
  return value !== null && (validValues as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
