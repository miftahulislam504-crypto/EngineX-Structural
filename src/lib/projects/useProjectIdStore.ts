import { create } from "zustand";

/**
 * Phase 11 merge — Design/Detailing/General Notes persistence।
 *
 * AnalysisPanel এ projectId prop হিসেবে pass করা হয় (page.tsx এ
 * <AnalysisPanel projectId={projectId} />), কিন্তু ১২টা design panel
 * ও GeneralNotesPanel prop ছাড়াই ব্যবহৃত হয় (<RcBeamDesignPanel />) —
 * এরা elements/materials/loadCases সবই Zustand store থেকে পড়ে, যা
 * useElementsCore(projectId) ইত্যাদি hook page.tsx এ আগে থেকেই
 * projectId দিয়ে subscribe করে রাখে।
 *
 * Design/Detailing/General Notes persist করতে projectId লাগে
 * (Firestore path এর অংশ) — ১৩টা panel এর signature বদলে prop-drilling
 * করার বদলে (page.tsx এর ১৩টা call site touch করতে হতো), এই ছোট
 * store দিয়ে page.tsx একবার সেট করে, প্রতিটা panel সেখান থেকে পড়ে।
 * useDcrStore.ts/useDetailingStore.ts এর মতোই ছোট single-purpose
 * store প্যাটার্ন।
 */
interface ProjectIdStoreState {
  projectId: string | null;
  setProjectId: (projectId: string) => void;
}

export const useProjectIdStore = create<ProjectIdStoreState>((set) => ({
  projectId: null,
  setProjectId: (projectId) => set({ projectId }),
}));
