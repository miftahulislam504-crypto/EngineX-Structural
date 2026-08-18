/**
 * Analysis Run Persistence — Documentation Engine dependency (Phase 11
 * merge)।
 *
 * এতদিন AnalysisPanel এর result state (linearStaticResult, pdeltaResult
 * ইত্যাদি) সম্পূর্ণ local useState ছিল — reportContext.ts (Documentation
 * Engine) এর ধরে নেওয়া schema.ts এর analysisRuns/{runId}/results
 * subcollection এ কেউ write করত না। এই ফাইল সেই gap বন্ধ করে।
 *
 * ডিজাইন — এক "run" এ একাধিক result থাকতে পারে (discriminated by
 * runType): ইঞ্জিনিয়ার প্রায়ই একই session এ linear-static + modal
 * দুটোই চালান (modal থেকে fundamental period, Story Drift check এর
 * জন্য দরকার — SectionF_AnalysisSummary.tsx দেখুন)। তাই persistAnalysisResult()
 * "upsert into current run" প্যাটার্নে কাজ করে: projectId এর জন্য একটা
 * "latest run" ধারণা রাখা হয় (একটা runId, results subcollection এ
 * প্রতিটা runType এর results/{runType} doc) — নতুন run start হলে
 * (AnalysisPanel এ "Run Analysis" চাপলে, analysisType পাল্টে) আগের
 * runType-level result গুলো ওভাররাইট হয় না (যেমন modal চালালে আগের
 * linear-static মুছে যায় না) — শুধু matching runType টাই replace হয়।
 *
 * এটা ইচ্ছাকৃতভাবে সরল রাখা হয়েছে (history/আগের run গুলো রাখা হয় না,
 * শুধু "সর্বশেষ সফল run প্রতি runType")। History দরকার হলে ভবিষ্যতে
 * runId immutable আলাদা document banano যাবে — কিন্তু Documentation
 * Engine এর "latest successful analysis" চাহিদা মেটাতে এটাই যথেষ্ট।
 *
 * NOTE: এই ফাইলে আগে ভুলবশত "use client" ডিরেক্টিভ ছিল (geometry/
 * firestore.ts, elements/firestore.ts এর মতো একই বাগ) — শুধু plain
 * async function, কোনো hook/JSX নেই (উপরের docstring-এ "useState"
 * শব্দটা শুধু ব্যাখ্যামূলক প্রসঙ্গে, কোনো actual hook call না)।
 * fetchLatestSuccessfulAnalysisRun reportContext.ts (server-side
 * Documentation API route) থেকে কল হয় — ডিরেক্টিভ থাকায় PDF ডাউনলোড
 * ভাঙছিল। সরানো হয়েছে — client component/hook থেকে আগের মতোই ব্যবহার
 * করা যাবে।
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type {
  ParsedAnalysisResult,
  ParsedModalResult,
  ParsedBucklingResult,
  ParsedPDeltaResult,
  ParsedResponseSpectrumResult,
  ParsedNonlinearStaticResult,
  ParsedPushoverResult,
} from "@/lib/analysis/runAnalysis";

export type AnalysisRunType =
  | "linear-static"
  | "modal"
  | "buckling"
  | "pdelta"
  | "response-spectrum"
  | "nonlinear-static"
  | "pushover";

/** প্রতিটা runType তার নিজের Parsed*Result shape রাখে, discriminated by runType। */
export type AnalysisResultEntry =
  | ({ runType: "linear-static" } & ParsedAnalysisResult)
  | ({ runType: "modal" } & ParsedModalResult)
  | ({ runType: "buckling" } & ParsedBucklingResult)
  | ({ runType: "pdelta" } & ParsedPDeltaResult)
  | ({ runType: "response-spectrum" } & ParsedResponseSpectrumResult)
  | ({ runType: "nonlinear-static" } & ParsedNonlinearStaticResult)
  | ({ runType: "pushover" } & ParsedPushoverResult);

/** "latest run" এর মেটাডেটা — কোন runType সর্বশেষ চালানো হয়েছে, কবে। */
export interface AnalysisRunMeta {
  runId: string;
  runType: AnalysisRunType;
  runAt: string; // ISO timestamp
}

export interface AnalysisRunWithResults {
  run: AnalysisRunMeta;
  results: AnalysisResultEntry[];
}

const LATEST_RUN_ID = "latest";

/**
 * একটা সফল analysis result persist করে — শুধু success:true হলে কল করা
 * উচিত (ব্যর্থ run persist করার দরকার নেই, Documentation Engine শুধু
 * "সর্বশেষ সফল" দেখায়)। এই runType এর আগের result থাকলে replace হয়,
 * অন্য runType এর result অক্ষত থাকে।
 */
export async function persistAnalysisResult(
  projectId: string,
  runType: AnalysisRunType,
  result: Omit<AnalysisResultEntry, "runType">
): Promise<void> {
  const runRef = doc(db(), firestorePaths.analysisRun(projectId, LATEST_RUN_ID));
  await setDoc(
    runRef,
    { runId: LATEST_RUN_ID, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const resultRef = doc(
    db(),
    firestorePaths.analysisResults(projectId, LATEST_RUN_ID),
    runType
  );
  await setDoc(resultRef, {
    ...result,
    runType,
    runAt: new Date().toISOString(),
  });
}

/**
 * সর্বশেষ run এর সব persisted result (সব runType মিলিয়ে) ফেরত দেয়।
 * কোনো run persist করা না থাকলে null (Documentation Engine তখন
 * "Analysis not yet run" দেখায়, ভুল/খালি ডেটা না দেখিয়ে)।
 */
export async function fetchLatestSuccessfulAnalysisRun(
  projectId: string
): Promise<AnalysisRunWithResults | null> {
  const runRef = doc(db(), firestorePaths.analysisRun(projectId, LATEST_RUN_ID));
  const runSnapshot = await getDoc(runRef);
  if (!runSnapshot.exists()) return null;

  const resultsRef = collection(
    db(),
    firestorePaths.analysisResults(projectId, LATEST_RUN_ID)
  );
  const resultsSnapshot = await getDocs(resultsRef);
  if (resultsSnapshot.empty) return null;

  const results: AnalysisResultEntry[] = [];
  let latestRunAt = "";
  let latestRunType: AnalysisRunType | null = null;

  resultsSnapshot.forEach((d) => {
    const data = d.data() as AnalysisResultEntry & { runAt: string };
    results.push(data);
    if (data.runAt > latestRunAt) {
      latestRunAt = data.runAt;
      latestRunType = data.runType;
    }
  });

  if (!latestRunType) return null;

  return {
    run: { runId: LATEST_RUN_ID, runType: latestRunType, runAt: latestRunAt },
    results,
  };
}
