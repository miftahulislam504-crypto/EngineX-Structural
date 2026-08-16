import { create } from "zustand";

/**
 * Redesign (২০২৬-০৮) — শুধু বর্তমান প্রজেক্টের display info (নাম/কোড)
 * ধরে রাখার ছোট store।
 *
 * useProjectIdStore থেকে ইচ্ছাকৃতভাবে আলাদা রাখা হলো (ওখানেই যোগ না
 * করে) — কারণ projectId route param থেকে সরাসরি সিঙ্ক্রোনাসভাবে
 * পাওয়া যায় (layout.tsx এর useEffect), কিন্তু projectName Firestore
 * থেকে asynchronously আসে (subscribeToProject)। দুটো ভিন্ন lifecycle
 * (একটা routing concern, আরেকটা data-fetch concern) একই store এ
 * মেশালে "projectId বদলেছে কিন্তু projectName এখনো আগের প্রজেক্টের"
 * ইন্টারমিডিয়েট state বোঝা কঠিন হতো। আলাদা রাখায় isLoading আলাদাভাবে
 * ট্র্যাক করা যায় (নতুন project route এ ঢোকার পর নাম না আসা পর্যন্ত
 * সংক্ষিপ্ত সময়ের জন্য raw id দেখানো যায়, ভুল নাম না)।
 */
interface ProjectInfoState {
  projectName: string | null;
  projectCode: string | null;
  isLoading: boolean;
  setProjectInfo: (info: { projectName: string; projectCode?: string }) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

export const useProjectInfoStore = create<ProjectInfoState>((set) => ({
  projectName: null,
  projectCode: null,
  isLoading: true,
  setProjectInfo: ({ projectName, projectCode }) =>
    set({ projectName, projectCode: projectCode ?? null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ projectName: null, projectCode: null, isLoading: true }),
}));
