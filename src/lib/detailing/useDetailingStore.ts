import { create } from "zustand";
import type { DetailingResult } from "@/lib/detailing/types";

interface DetailingStoreState {
  /**
   * elementId → সর্বশেষ generate করা DetailingResult। Analysis result
   * store-এর মতোই session-scoped (Firestore এ persist করা হয় না) —
   * কারণ Analysis Engine এর elementEndForces-ও persist হয় না (দেখুন
   * useAnalysisResultStore.ts), আর detailing সরাসরি সেই forces + Design
   * Engine এর output-এর derivative। Model geometry/library/loads-ই
   * "source of truth" যা persist হওয়া দরকার — detailing যেকোনো সময়
   * Design run থেকে regenerate করা যায়।
   */
  results: Record<string, DetailingResult>;
  setResult: (result: DetailingResult) => void;
  removeResult: (elementId: string) => void;
  clearAll: () => void;
}

export const useDetailingStore = create<DetailingStoreState>((set) => ({
  results: {},
  setResult: (result) =>
    set((state) => ({ results: { ...state.results, [result.elementId]: result } })),
  removeResult: (elementId) =>
    set((state) => {
      const next = { ...state.results };
      delete next[elementId];
      return { results: next };
    }),
  clearAll: () => set({ results: {} }),
}));
