/**
 * Report Data Aggregator — Phase 11a
 * Documentation Engine এর ভিত্তি।
 *
 * উদ্দেশ্য: Design Report (A-J), Calculation Sheets, Bar Bending
 * Schedule, Model Validation/QC Report, General Notes Sheet, এবং
 * Drawing Sheets (S-00 থেকে S-11) — এই প্রতিটা document template
 * শুধু এই একটা ReportContext অবজেক্ট থেকে ডেটা পড়বে, কখনো নিজে
 * Firestore query করবে না। কারণ:
 *   ১. প্রতিটা template Firestore থেকে আলাদা করে ডেটা টানলে একই
 *      collection বারবার read হবে (খরচ ও latency বাড়বে) — একবার
 *      টেনে সবগুলো template এ share করাই সঠিক।
 *   ২. একটা রিপোর্ট bundle (Design Report + BBS + QC + General
 *      Notes, "Download All") এর সব document একই মুহূর্তের ডেটা
 *      থেকে তৈরি হওয়া উচিত — আলাদা আলাদা সময়ে fetch করলে দুটো
 *      document ভিন্ন model state দেখাতে পারে (যেমন একটা re-analysis
 *      চলাকালীন)।
 *
 * গুরুত্বপূর্ণ preexisting gap (এই ফাইল লেখার আগে কোডবেস স্ক্যান করে
 * ধরা পড়েছে, প্লানে থাকা উচিত): schema.ts এ designResults,
 * analysisRuns/results, ও elementDetailing — তিনটা subcollection
 * path সংজ্ঞায়িত থাকলেও কোনো design panel/detailing panel/analysis
 * panel এখনো সেখানে persist করে না (সব শুধু client-side state/store
 * এ থাকে)। এই ফাইল সেই তিনটা subcollection থেকে পড়ে (design/firestore.ts,
 * analysis/firestore.ts, detailing/firestore.ts — নতুন যোগ করা হলো),
 * কিন্তু persist না হলে খালি array/null পাবে। অর্থাৎ Documentation
 * Engine সম্পূর্ণ কাজ করার আগে design/analysis/detailing panel গুলোতে
 * persist-on-save wiring যোগ করা লাগবে — এটা Phase 11a এর কাজ না,
 * কিন্তু ব্লকার হিসেবে এখানেই নোট করা হলো যাতে ভুলে না যায়।
 */

import { fetchHubIncomingPackage } from "@/lib/hub/sync";
import type { HubIncomingPackage } from "@/lib/types/hub";

import { fetchGeometryCore } from "@/lib/geometry/firestore";
import type { GeometryCore } from "@/lib/types/geometry";

import { fetchMaterialLibrary, fetchSectionLibrary } from "@/lib/library/firestore";
import type { MaterialLibrary, SectionLibrary } from "@/lib/library/firestore";

import { fetchAllElements } from "@/lib/elements/firestore";
import type { StructuralElement } from "@/lib/types/element";

import {
  fetchLoadPatternLibrary,
  fetchLoadCombinationLibrary,
  fetchLoadCases,
} from "@/lib/loads/firestore";
import type { LoadPattern, LoadCase } from "@/lib/types/load";
import type { LoadCombination } from "@/lib/loads/loadCombinations";

import { fetchLatestSuccessfulAnalysisRun } from "@/lib/analysis/firestore";
import type { AnalysisRunWithResults } from "@/lib/analysis/firestore";

import { fetchDesignResults } from "@/lib/design/firestore";
import type { DesignResult } from "@/lib/design/firestore";

import { fetchAllDetailingResults } from "@/lib/detailing/firestore";
import type { DetailingResult } from "@/lib/detailing/types";

import { runValidation } from "@/lib/validation/runValidation";
import type { ValidationReport } from "@/lib/validation/types";

import { assembleGeneralNotes } from "@/lib/design/generalNotes";
import type { GeneralNotesData } from "@/lib/design/generalNotes";
import { fetchGeneralNotesInput } from "@/lib/design/generalNotesFirestore";

/**
 * পুরো প্রজেক্টের একটা snapshot-in-time — Documentation Engine এর
 * সব template এই একটা অবজেক্ট থেকেই পড়ে।
 *
 * নোট: এটা "raw" ডেটার সমষ্টি, derived/computed সারাংশ (যেমন Quantity
 * Summary) না — সেগুলো আলাদা ফাংশনে (computeQuantitySummary, Phase
 * 11a এর দ্বিতীয় অংশ, এই ফাইলের নিচে) এই ReportContext থেকেই বের করা
 * হবে, যাতে "raw fetch" আর "derived computation" দুই স্তর আলাদা থাকে।
 */
export interface ReportContext {
  projectId: string;
  generatedAt: string;

  hub: HubIncomingPackage | null;
  geometry: GeometryCore;
  materials: MaterialLibrary;
  sections: SectionLibrary;
  elements: StructuralElement[];

  loadPatterns: LoadPattern[];
  loadCombinations: LoadCombination[];
  loadCases: LoadCase[];

  /** সাম্প্রতিকতম সফল analysis run — না থাকলে null (Section F তখন "Analysis not yet run" দেখাবে)। */
  latestAnalysis: AnalysisRunWithResults | null;

  designResults: DesignResult[];
  detailingResults: DetailingResult[];

  /** সিঙ্ক্রোনাসভাবে এখানেই কম্পিউট হয় — নিজস্ব কোনো Firestore collection নেই (runValidation.ts এর নকশা অনুযায়ী)। */
  validation: ValidationReport;

  /**
   * null মানে ইঞ্জিনিয়ার এখনো General Notes panel এ কখনো "Generate"
   * চাপেননি (কোনো auto-derived default নেই — design criteria/cover/
   * slump কোনোটাই Hub বা অন্য কোনো collection থেকে নির্ভরযোগ্যভাবে
   * বের করা যায় না, ইঞ্জিনিয়ারের ইনপুট আবশ্যক)। Design Report Section
   * D/J ও S-01 sheet template কে এই null case handle করতে হবে —
   * "General Notes not yet generated for this project" জাতীয় বার্তা
   * দেখিয়ে, চুপচাপ খালি টেবিল দেখানো যাবে না।
   */
  generalNotes: GeneralNotesData | null;
}

/**
 * সব সোর্স থেকে সমান্তরালে (Promise.all) ডেটা টেনে একটা ReportContext
 * বানায়। সমান্তরাল কেন: প্রতিটা fetch স্বাধীন (একটার ফলাফল আরেকটার
 * ইনপুট না), তাই sequential await করলে অহেতুক দেরি হতো — সবচেয়ে
 * ধীর collection যত সময় নেয়, মোট সময় প্রায় তত-ই হওয়া উচিত, সবগুলোর
 * সমষ্টি না।
 *
 * ব্যতিক্রম: validation — এটা Firestore fetch না, বরং অন্য fetch করা
 * ডেটার (elements/materials/sections/loadCases/loadPatterns) উপর
 * সিঙ্ক্রোনাস derivation, তাই Promise.all এর পরে আলাদাভাবে বসানো
 * হয়েছে। generalNotesInput নিজেই একটা Firestore fetch (fetchGeneralNotesInput,
 * generalNotesFirestore.ts) — তাই সেটা বাকি সবার সাথে Promise.all এ
 * সমান্তরালে চলে; assembleGeneralNotes() শুধু সেই raw input কে
 * GeneralNotesData তে রূপান্তর করে, যা fetch শেষ হওয়ার পরেই সম্ভব।
 */
export async function buildReportContext(projectId: string): Promise<ReportContext> {
  const [
    hub,
    geometry,
    materials,
    sections,
    elements,
    loadPatterns,
    loadCombinations,
    loadCases,
    latestAnalysis,
    designResults,
    detailingResults,
    generalNotesInput,
  ] = await Promise.all([
    fetchHubIncomingPackage(projectId),
    fetchGeometryCore(projectId),
    fetchMaterialLibrary(projectId),
    fetchSectionLibrary(projectId),
    fetchAllElements(projectId),
    fetchLoadPatternLibrary(projectId).then((lib) => lib.patterns),
    fetchLoadCombinationLibrary(projectId).then((lib) => lib.combinations),
    fetchLoadCases(projectId),
    fetchLatestSuccessfulAnalysisRun(projectId),
    fetchDesignResults(projectId),
    fetchAllDetailingResults(projectId),
    fetchGeneralNotesInput(projectId),
  ]);

  // Model Validation/QC (Section H, ও standalone QC Report Phase 11f) —
  // runValidation.ts ইচ্ছাকৃতভাবে Firestore-ছোঁয় না, শুধু ইতিমধ্যে
  // লোড করা client-side ডেটা নেয়। এখানে ঠিক সেই কন্ট্রাক্ট মেনে চলা
  // হলো যাতে UI তে (ValidationPanel) আর রিপোর্টে একই ফলাফল আসে।
  const validation = runValidation({
    elements,
    materials: materials.materials,
    sections: sections.sections,
    loadCases,
    patterns: loadPatterns,
  });

  // General Notes (Section D reference + standalone S-01 sheet, Phase
  // 11g) — assembleGeneralNotes() pure computation, কিন্তু ইনপুট
  // (design criteria/cover/concrete requirement) কোনো collection থেকে
  // auto-derive করা যায় না (GeneralNotesPanel এ ইঞ্জিনিয়ার নিজে টাইপ
  // করেন, generalNotesFirestore.ts এ persist হয়)। input না থাকলে
  // (ইঞ্জিনিয়ার এখনো panel এ কখনো "Generate" চাপেননি) null রাখা হয়
  // — খালি/placeholder ডেটা দিয়ে assembleGeneralNotes() চালানো ভুল
  // হতো, কারণ তাহলে রিপোর্টে fake default সংখ্যা (যেমন fc'=21 MPa)
  // দেখা যেত যেটা ইঞ্জিনিয়ার আদৌ কনফার্ম করেননি।
  const generalNotes = generalNotesInput ? assembleGeneralNotes(generalNotesInput) : null;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    hub,
    geometry,
    materials,
    sections,
    elements,
    loadPatterns,
    loadCombinations,
    loadCases,
    latestAnalysis,
    designResults,
    detailingResults,
    validation,
    generalNotes,
  };
}
