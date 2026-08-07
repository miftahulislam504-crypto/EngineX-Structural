import { useMemo } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useAnalysisResultStore } from "@/lib/analysis/useAnalysisResultStore";
import { useDcrStore } from "@/lib/design/useDcrStore";
import { runValidation } from "@/lib/validation/runValidation";
import type { StageId, StageProgress, StageStatus } from "@/lib/workflow/types";
import { STAGES } from "@/lib/workflow/stageTabs";

/**
 * Workflow Layer এর মূল hook — Master Plan এর "Progress Bar +
 * পরেরটা খুলবে না" লজিক এখানে বাস্তবায়িত হয়েছে।
 *
 * গুরুত্বপূর্ণ সিদ্ধান্ত: completion কোনো নতুন Firestore ফিল্ড বা flag
 * থেকে না, বরং প্রতিটা Phase-এর existing store থেকে সরাসরি derive
 * করা হয় (grids.length, elements.length, sourceAnalysisType !== null,
 * ইত্যাদি) — তাই এই layer বসানোর জন্য কোনো migration লাগে না, এবং
 * "wizard বলছে সম্পূর্ণ কিন্তু আসলে ডেটা নেই" জাতীয় ডিসিঙ্ক হতে পারে
 * না, কারণ এটা ডেটার-ই একটা view, আলাদা source of truth না।
 *
 * Gating নীতি: lock **soft** — একটা stage "locked" দেখালেও ইঞ্জিনিয়ার
 * চাইলে ওভাররাইড করে সেখানে যেতে পারবেন (বাস্তবে স্ট্রাকচারাল
 * ডিজাইন প্রায়ই non-linear — Analysis চালানোর পর Model এ ফিরে যাওয়া
 * স্বাভাবিক)। lock শুধু UI signal, hard block না — WorkflowSidebar
 * component এ click handler সবসময় কাজ করে, শুধু একটা confirm-style
 * সতর্কতা দেখাবে lock করা stage এ ঢোকার সময়।
 */
export function useWorkflowProgress(): Record<StageId, StageProgress> {
  const grids = useGeometryStore((s) => s.geometry.grids);
  const stories = useGeometryStore((s) => s.geometry.stories);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const elements = useElementsStore((s) => s.elements);
  const patterns = useLoadStore((s) => s.patternLibrary.patterns);
  const loadCases = useLoadStore((s) => s.loadCases);
  const combinations = useLoadStore((s) => s.combinationLibrary.combinations);
  const sourceAnalysisType = useAnalysisResultStore((s) => s.sourceAnalysisType);
  const dcrRecords = useDcrStore((s) => s.records);

  const validationReport = useMemo(
    () => runValidation({ elements, materials, sections, loadCases, patterns }),
    [elements, materials, sections, loadCases, patterns]
  );

  return useMemo(() => {
    const progress = {} as Record<StageId, StageProgress>;

    // 1. Preliminary — Material + Section library
    const materialCount = materials.length;
    const sectionCount = sections.length;
    progress.preliminary = deriveProgress({
      done: materialCount > 0 && sectionCount > 0,
      partial: materialCount > 0 || sectionCount > 0,
      detail: `${materialCount}টা Material, ${sectionCount}টা Section`,
    });

    // 2. Model — Grid/Story geometry + structural elements
    const hasGeometry = grids.length > 0 && stories.length > 0;
    progress.model = deriveProgress({
      done: hasGeometry && elements.length > 0,
      partial: hasGeometry || elements.length > 0,
      detail: `${grids.length}টা Grid, ${stories.length}টা Story, ${elements.length}টা Element`,
    });

    // 3. Loads — patterns + at least one enabled combination
    const enabledCombos = combinations.filter((c) => c.isEnabled).length;
    progress.loads = deriveProgress({
      done: patterns.length > 0 && loadCases.length > 0 && enabledCombos > 0,
      partial: patterns.length > 0 || loadCases.length > 0,
      detail: `${patterns.length}টা Pattern, ${loadCases.length}টা প্রয়োগকৃত লোড, ${enabledCombos}টা সক্রিয় Combination`,
    });

    // 4. Analysis — a successful run pushed results to the shared store
    progress.analysis = deriveProgress({
      done: sourceAnalysisType !== null,
      partial: false,
      detail: sourceAnalysisType ? `সর্বশেষ রান: ${sourceAnalysisType}` : "এখনো কোনো রান হয়নি",
    });

    // 5. Design — DCR store populated (design panels push here on successful run)
    const designedElementCount = Object.keys(dcrRecords).length;
    progress.design = deriveProgress({
      done: designedElementCount > 0,
      partial: false,
      detail: designedElementCount > 0 ? `${designedElementCount}টা এলিমেন্ট ডিজাইন-চেক করা হয়েছে` : "এখনো কোনো ডিজাইন-চেক নেই",
    });

    // 6. Optimization — optional stage; mark available once design has started
    progress.optimization = deriveProgress({
      done: false,
      partial: designedElementCount > 0,
      detail: "ঐচ্ছিক ধাপ — Section/Weight/Cost অপ্টিমাইজেশন",
    });

    // 7. Verification — validation health score
    const worstRatio = Object.values(dcrRecords).reduce(
      (max, r) => Math.max(max, r.governingRatio),
      0
    );
    progress.verification = deriveProgress({
      done: validationReport.errorCount === 0 && designedElementCount > 0,
      partial: designedElementCount > 0,
      detail: `Health Score ${validationReport.healthScore}/100${
        worstRatio > 0 ? `, সর্বোচ্চ DCR ${worstRatio.toFixed(2)}` : ""
      }`,
    });

    // 8. Detailing — rebar viewport কে design সম্পন্ন হওয়ার পরের ধাপ
    // হিসেবে ধরা হচ্ছে (DCR record থাকলেই rebar geometry viewport-এ
    // দেখানোর মতো কিছু আছে ধরে নেওয়া যায়, যেহেতু design output থেকেই
    // rebar layout আসে)।
    progress.detailing = deriveProgress({
      done: false,
      partial: designedElementCount > 0,
      detail: designedElementCount > 0
        ? "ডিজাইন থেকে Rebar geometry দেখা যাবে"
        : "এখনো কোনো ডিজাইন-চেক নেই",
    });

    // 9/10. Documentation & Export — not built yet (Phase 11+)
    progress.documentation = { status: "locked", detail: "শীঘ্রই আসছে", percent: 0 };
    progress.export = { status: "locked", detail: "শীঘ্রই আসছে", percent: 0 };

    return progress;
  }, [
    grids.length,
    stories.length,
    materials.length,
    sections.length,
    elements.length,
    patterns.length,
    loadCases.length,
    combinations,
    sourceAnalysisType,
    dcrRecords,
    validationReport,
  ]);
}

function deriveProgress(args: { done: boolean; partial: boolean; detail: string }): StageProgress {
  const status: StageStatus = args.done ? "complete" : args.partial ? "in-progress" : "available";
  const percent = args.done ? 100 : args.partial ? 50 : 0;
  return { status, detail: args.detail, percent };
}

/**
 * একটা stage আগের সব stage সম্পূর্ণ (বা অন্তত শুরু) না হলে "locked"
 * হিসেবে চিহ্নিত হয় — কিন্তু এটা শুধু visual, ক্লিক ব্লক করে না
 * (উপরের doc comment দ্রষ্টব্য)। placeholder stage (Documentation/
 * Export) সবসময় locked থাকে কারণ ফিচার নেই।
 */
export function resolveEffectiveStatus(
  stageId: StageId,
  progress: Record<StageId, StageProgress>
): StageStatus {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return "locked";
  if (stage.isPlaceholder) return "locked";

  const own = progress[stageId];
  if (own.status === "complete") return "complete";

  const priorStages = STAGES.filter((s) => s.order < stage.order && !s.isPlaceholder);
  const priorAllStarted = priorStages.every((s) => progress[s.id].status !== "available");

  if (own.status === "in-progress") return "in-progress";
  return priorAllStarted || priorStages.length === 0 ? "available" : "locked";
}
