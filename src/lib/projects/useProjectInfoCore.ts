"use client";

import { useEffect } from "react";
import { useProjectInfoStore } from "@/lib/projects/useProjectInfoStore";
import { subscribeToProject } from "@/lib/projects/firestore";

/**
 * Redesign (২০২৬-০৮) — projectId থেকে projectName resolve করার
 * orchestration hook। useGeometryCore/useElementsCore এর একই
 * প্যাটার্ন অনুসরণ করে: model/[projectId]/layout.tsx এ (persistent
 * shell) একবার কল হয়, কারণ Sidebar header, mobile top bar,
 * ViewportStatusChip — এই তিন জায়গাতেই প্রজেক্টের নাম দরকার, আর
 * layout.tsx-ই একমাত্র জায়গা যা সব child route জুড়ে persist করে
 * (route bar-eve remount হয় না — layout.tsx এর নিজস্ব মন্তব্য দেখুন)।
 *
 * geometry/elements এর ৪টা hook থেকে এটা ভিন্ন একটা কারণে: এটা
 * layout.tsx এ কল করা নিরাপদ (ওই hook গুলো কেন layout এ move করা
 * হয়নি তার বিস্তারিত কারণ layout.tsx এর কমেন্টে) — কারণ এই hook কোনো
 * mutation action closure রিটার্ন করে না, শুধু subscription চালায়
 * (pure read, Hub-ই এই collection এর মালিক, এই App কখনো লেখে না,
 * lib/projects/firestore.ts এর টীকা দেখুন)। তাই prop-drilling বা
 * per-page duplication এর কোনো দরকার নেই।
 *
 * isAuthReady প্যারামিটার হিসেবে নেওয়া হয় (নিজে useEnsureAuth() আবার
 * কল না করে) — layout.tsx এ ইতিমধ্যে এই hook কল হয়ে আছে route guard
 * এর জন্য, সেখান থেকেই মান পাস করাটাই সহজ, একই effect-এর জন্য দ্বিতীয়
 * independent Firebase listener তৈরির দরকার নেই যেখানে caller এর কাছে
 * উত্তরটা আগে থেকেই আছে।
 */
export function useProjectInfoCore(projectId: string, isAuthReady: boolean) {
  const setProjectInfo = useProjectInfoStore((s) => s.setProjectInfo);
  const setLoading = useProjectInfoStore((s) => s.setLoading);
  const reset = useProjectInfoStore((s) => s.reset);

  useEffect(() => {
    if (!isAuthReady || !projectId) {
      return;
    }

    reset();

    const unsubscribe = subscribeToProject(projectId, (project) => {
      if (project) {
        setProjectInfo({ projectName: project.projectName, projectCode: project.projectCode });
      } else {
        // ডকুমেন্ট পাওয়া যায়নি (deleted/ভুল id) — loading বন্ধ, নাম না
        // থাকায় caller গুলো raw projectId তে fallback করবে।
        setLoading(false);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthReady]);
}
