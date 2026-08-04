import { create } from "zustand";
import type {
  AnalysisNode,
  ParsedAnalysisResult,
  ParsedModalResult,
  ParsedBucklingResult,
  ParsedPDeltaResult,
  ParsedResponseSpectrumResult,
  ParsedNonlinearStaticResult,
  ParsedPushoverResult,
} from "@/lib/analysis/runAnalysis";

/**
 * Phase 10k — Analysis Result Bridge।
 *
 * সমস্যা: AnalysisPanel.tsx-এর ৭টা analysis result (linearStaticResult,
 * modalResult, bucklingResult, pdeltaResult, rsaResult, nonlinearResult,
 * pushoverResult) সবগুলোই স্থানীয় useState — কোনো global store নেই।
 * useAnalysisResultStore.ts শুধু elementEndForces (Design Engine-এর
 * ইনপুট) শেয়ার করে, পুরো result object না। ফলে Visualization tab
 * (VisualizationViewport/panels) থেকে displacement, mode shape,
 * buckling shape, pushover curve — এসবের কোনোটাই পড়া যেত না।
 *
 * সমাধান: এই store প্রতিটা analysis type-এর সম্পূর্ণ ParsedXResult
 * (nodes coordinate-সহ) ধরে রাখে, ঠিক AnalysisPanel-এর useState-এর
 * সমান্তরাল কপি হিসেবে — সেই useState-গুলো সরানো হয়নি (Analysis tab-এর
 * নিজের রেন্ডারিং এখনো সেগুলোর উপর নির্ভরশীল, আলাদা করে রাখাই নিরাপদ)।
 * শুধু "একই সাথে global-এও পাঠাও" যোগ করা হয়েছে setElementEndForces-এর
 * ঠিক পাশে, handleRunAnalysis-এর প্রতিটা branch-এ।
 *
 * একবারে একটাই "active" result থাকে (AnalysisPanel-এর clearAllResults()
 * প্যাটার্নের সাথে সঙ্গতিপূর্ণ — নতুন run শুরু হলে আগেরটা clear হয়)।
 * তাই সবকিছু ইউনিয়ন আকারে না রেখে discriminated `activeAnalysisType` +
 * per-type optional ফিল্ড রাখা হলো, যাতে Visualization consumer সহজেই
 * "এখন কোন result active" জানতে পারে এবং সঠিক branch পড়তে পারে।
 *
 * Session-scoped only (persisted না), analysisResultStore.ts-এর মতোই —
 * analysis result deterministically re-run-যোগ্য, Firestore-এ রাখার
 * দরকার নেই।
 */

export type AnalysisVisualizationType =
  | "linear-static"
  | "modal"
  | "buckling"
  | "pdelta"
  | "response-spectrum"
  | "nonlinear-static"
  | "pushover";

interface AnalysisVisualizationStoreState {
  /** সবশেষ সফলভাবে চালানো analysis-এর টাইপ। কোনো run না হলে null। */
  activeAnalysisType: AnalysisVisualizationType | null;
  /** activeAnalysisType-এর node coordinate তালিকা — result-এর ভেতরের
   *  displacement/modeShape ইনডেক্সের সাথে positional ম্যাচ করে। */
  nodes: AnalysisNode[] | null;

  linearStaticResult: ParsedAnalysisResult | null;
  modalResult: ParsedModalResult | null;
  bucklingResult: ParsedBucklingResult | null;
  pdeltaResult: ParsedPDeltaResult | null;
  responseSpectrumResult: ParsedResponseSpectrumResult | null;
  nonlinearStaticResult: ParsedNonlinearStaticResult | null;
  pushoverResult: ParsedPushoverResult | null;

  setLinearStaticResult: (r: ParsedAnalysisResult) => void;
  setModalResult: (r: ParsedModalResult) => void;
  setBucklingResult: (r: ParsedBucklingResult) => void;
  setPdeltaResult: (r: ParsedPDeltaResult) => void;
  setResponseSpectrumResult: (r: ParsedResponseSpectrumResult) => void;
  setNonlinearStaticResult: (r: ParsedNonlinearStaticResult) => void;
  setPushoverResult: (r: ParsedPushoverResult) => void;

  /** নতুন analysis run শুরু হওয়ার সময় AnalysisPanel-এর clearAllResults()
   *  থেকে কল হবে — সব result + activeAnalysisType রিসেট করে। */
  clear: () => void;
}

const emptyResults = {
  linearStaticResult: null,
  modalResult: null,
  bucklingResult: null,
  pdeltaResult: null,
  responseSpectrumResult: null,
  nonlinearStaticResult: null,
  pushoverResult: null,
} as const;

export const useAnalysisVisualizationStore = create<AnalysisVisualizationStoreState>((set) => ({
  activeAnalysisType: null,
  nodes: null,
  ...emptyResults,

  setLinearStaticResult: (r) =>
    set({ ...emptyResults, linearStaticResult: r, activeAnalysisType: "linear-static", nodes: r.nodes ?? null }),
  setModalResult: (r) =>
    set({ ...emptyResults, modalResult: r, activeAnalysisType: "modal", nodes: r.nodes ?? null }),
  setBucklingResult: (r) =>
    set({ ...emptyResults, bucklingResult: r, activeAnalysisType: "buckling", nodes: r.nodes ?? null }),
  setPdeltaResult: (r) =>
    set({ ...emptyResults, pdeltaResult: r, activeAnalysisType: "pdelta", nodes: r.nodes ?? null }),
  setResponseSpectrumResult: (r) =>
    set({ ...emptyResults, responseSpectrumResult: r, activeAnalysisType: "response-spectrum", nodes: r.nodes ?? null }),
  setNonlinearStaticResult: (r) =>
    set({ ...emptyResults, nonlinearStaticResult: r, activeAnalysisType: "nonlinear-static", nodes: r.nodes ?? null }),
  setPushoverResult: (r) =>
    set({ ...emptyResults, pushoverResult: r, activeAnalysisType: "pushover", nodes: r.nodes ?? null }),

  clear: () => set({ activeAnalysisType: null, nodes: null, ...emptyResults }),
}));
