import { create } from "zustand";
import type { ElementEndForce } from "@/lib/analysis/runAnalysis";

interface AnalysisResultStoreState {
  /** সর্বশেষ সফল analysis run এর element end forces — Design Engine (Phase 6) এর প্রধান ইনপুট। */
  elementEndForces: ElementEndForce[] | null;
  /** কোন analysis type থেকে এই forces এসেছে (Design panel এ দেখানোর জন্য, যাতে ইঞ্জিনিয়ার বোঝেন কোন run এর ডেটা)। */
  sourceAnalysisType: string | null;
  setElementEndForces: (forces: ElementEndForce[] | null, sourceAnalysisType: string | null) => void;
}

/**
 * AnalysisPanel এর result state (linearStaticResult, pdeltaResult
 * ইত্যাদি) সম্পূর্ণ local (useState), তাই Design Engine panel সেখান
 * থেকে সরাসরি পড়তে পারে না। elementEndForces-কে (Design এর জন্য
 * প্রাসঙ্গিক অংশটুকু) এই ছোট shared store এ আলাদা রাখা হয়েছে —
 * পুরো AnalysisPanel state কে global করার বদলে, শুধু যা দরকার তা।
 * AnalysisPanel প্রতিটা সফল run এর পর এই store আপডেট করে (elementEndForces
 * থাকলেই — Modal/Buckling এ থাকে না, তাই সেগুলো store touch করে না)।
 */
export const useAnalysisResultStore = create<AnalysisResultStoreState>((set) => ({
  elementEndForces: null,
  sourceAnalysisType: null,
  setElementEndForces: (elementEndForces, sourceAnalysisType) =>
    set({ elementEndForces, sourceAnalysisType }),
}));
