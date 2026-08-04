/**
 * Torsion Check — Accidental Eccentricity + Torsional Amplification
 * (Phase 8e), BNBC 2020 (ASCE 7/UBC 97-সাদৃশ্যপূর্ণ পদ্ধতি) অনুযায়ী।
 *
 * থ্রেশহোল্ড ও সূত্র web search দিয়ে যাচাই করা হয়েছে (একাধিক স্বাধীন
 * উৎস — ASCE 7, UBC 97, ও প্র্যাকটিসিং ইঞ্জিনিয়ারদের ডকুমেন্টেশন —
 * সবগুলোতে একই সূত্র/সংখ্যা):
 *
 *   Accidental Eccentricity (base): e_acc = 0.05 × building dimension
 *     perpendicular to the applied lateral load direction।
 *   Torsional Amplification Factor: Ax = (Δmax / (1.2 × Δavg))²,
 *     সীমাবদ্ধ 1.0 ≤ Ax ≤ 3.0 (শুধু torsionally irregular হলে
 *     প্রয়োজন, Δmax/Δavg > 1.2)। Ax > 3.0 হলে lateral system/
 *     configuration পুনর্বিবেচনা করার সুপারিশ কোড দেয়।
 *   Amplified Accidental Eccentricity: e_amplified = e_acc × Ax।
 *
 * সততার সাথে সীমাবদ্ধতা: এই মডিউল **displacement-based (Option 1)**
 * পদ্ধতি প্রয়োগ করে — একটা সম্পূর্ণ সফল analysis result নিয়ে সেখান
 * থেকে extreme-point displacement বের করে Ax হিসাব করে, ঠিক যেভাবে
 * অনেক প্র্যাকটিসিং ইঞ্জিনিয়ার ETABS-এ করেন (mass center shift ছাড়া,
 * শুধু existing symmetric-load analysis থেকে)। এই অ্যাপে **mass
 * center shift করে দ্বিতীয় analysis চালানোর (Option 2) কোনো ওয়ার্কফ্লো
 * এখনো নেই** — তাই এই মডিউল e_amplified বের করে ব্যবহারকারীকে জানিয়ে
 * দেয় কতটা accidental eccentricity প্রয়োগ করতে হবে, কিন্তু নিজে
 * automatically সেই eccentric load দিয়ে আরেকটা analysis চালিয়ে
 * result দেয় না — চূড়ান্ত ডিজাইনে ইঞ্জিনিয়ারকে এই eccentricity manually
 * (Load Pattern এ shifted lateral load হিসেবে, বা mass offset হিসেবে)
 * প্রয়োগ করে আরেকটা analysis চালাতে হবে।
 *
 * এই মডিউল irregularityCheck.ts এর torsionalIrregularity অংশের সাথে
 * concept-এ সম্পর্কিত কিন্তু আলাদা স্কোপ: ওটা শুধু classification
 * (regular/irregular/extreme) দেয়, এটা design-level সংখ্যা (Ax,
 * amplified eccentricity, torsional moment) দেয়।
 */

import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";
import { groupNodesByStory, findStoryDisplacementExtremes } from "@/lib/analysis/nodeStoryMap";

export type TorsionDirection = "X" | "Z";

export interface StoryTorsionResult {
  storyId: string;
  storyName: string;
  direction: TorsionDirection;
  maxDisplacement: number; // মিটার, magnitude
  avgDisplacement: number;
  ratio: number; // max/avg
  isTorsionallyIrregular: boolean; // ratio > 1.2
  isExtremeTorsionallyIrregular: boolean; // ratio > 1.4
  amplificationFactorAx: number; // 1.0 (irregular না হলে) থেকে 3.0 পর্যন্ত সীমাবদ্ধ
  baseAccidentalEccentricity: number; // মিটার, 0.05 × perpendicular dimension
  amplifiedAccidentalEccentricity: number; // মিটার, baseAccidentalEccentricity × Ax
  /** এই story-র শিয়ার (storyShears থেকে) × amplifiedAccidentalEccentricity — ইঞ্জিনিয়ারকে প্রয়োগ করতে হবে এমন additional torsional moment, kN·m। storyShear না থাকলে null। */
  additionalTorsionalMomentKNm: number | null;
}

export interface TorsionCheckInput {
  nodes: AnalysisNode[];
  displacements: { ux: number; uz: number }[];
  stories: StructuralStory[];
  direction: TorsionDirection; // কোন দিকের lateral load-এর জন্য চেক করা হচ্ছে (perpendicular dimension এই দিকের বিপরীত axis থেকে বের হয়)
  /** ঐচ্ছিক — দিলে প্রতিটা story-র additional torsional moment হিসাব করা হবে (seismicLoad.ts/windLoad.ts এর storyForces থেকে)। */
  storyShears?: { elevation: number; cumulativeShear: number }[];
}

export interface TorsionCheckResult {
  results: StoryTorsionResult[];
  worstAx: StoryTorsionResult | null;
  anyExceedsAxLimit: boolean; // কোনো story-তে Ax গণনাকৃত মান 3.0 অতিক্রম করেছে কিনা (capped করার আগে) — এটা lateral system পুনর্বিবেচনার সংকেত
  warnings: string[];
}

function findShearAtElevation(
  storyShears: { elevation: number; cumulativeShear: number }[] | undefined,
  elevation: number
): number | null {
  if (!storyShears) return null;
  const TOL = 0.1;
  const match = storyShears.find((s) => Math.abs(s.elevation - elevation) <= TOL);
  return match ? match.cumulativeShear : null;
}

export function computeTorsionCheck(input: TorsionCheckInput): TorsionCheckResult {
  const warnings: string[] = [];
  const { storyGroups } = groupNodesByStory(input.nodes, input.displacements, input.stories);
  const nonBaseGroups = storyGroups.filter((g) => !g.story.isBaseLevel);

  if (nonBaseGroups.length === 0) {
    return {
      results: [],
      worstAx: null,
      anyExceedsAxLimit: false,
      warnings: ["⚠️ কোনো non-base story সংজ্ঞায়িত নেই — Torsion Check চালানো যায়নি।"],
    };
  }

  const results: StoryTorsionResult[] = [];
  let anyExceedsAxLimit = false;

  // perpendicular building dimension — direction="X" হলে load X-দিকে
  // প্রয়োগ হচ্ছে, তাই perpendicular dimension হলো Z extent (এবং
  // বিপরীত)। প্রতিটা story-র নিজস্ব extent ব্যবহার করা হচ্ছে (story
  // ভেদে plan dimension ভিন্ন হতে পারে, যেমন set-back building)।
  for (const group of nonBaseGroups) {
    if (group.nodes.length < 2) {
      warnings.push(
        `⚠️ Story "${group.story.name}"-এ ২টার কম node আছে — Torsion Check এর জন্য অন্তত ২টা diaphragm-প্রান্ত node প্রয়োজন, এই story বাদ পড়েছে।`
      );
      continue;
    }

    const getComponent = (d: { ux: number; uz: number }) => (input.direction === "X" ? d.ux : d.uz);
    const extremes = findStoryDisplacementExtremes(group.nodes, getComponent);
    if (!extremes) continue;

    const maxDisplacement = Math.max(Math.abs(getComponent(extremes.max.displacement)), Math.abs(getComponent(extremes.min.displacement)));
    const avgDisplacement =
      group.nodes.reduce((sum, n) => sum + Math.abs(getComponent(n.displacement)), 0) / group.nodes.length;

    if (avgDisplacement < 1e-9) {
      warnings.push(
        `ℹ️ Story "${group.story.name}"-এ গড় displacement প্রায় শূন্য — Torsion ratio অর্থবহ নয় (division by zero এড়ানো হয়েছে), এই story বাদ পড়েছে।`
      );
      continue;
    }

    const ratio = maxDisplacement / avgDisplacement;
    const isTorsionallyIrregular = ratio > 1.2;
    const isExtremeTorsionallyIrregular = ratio > 1.4;

    let amplificationFactorAx = 1.0;
    if (isTorsionallyIrregular) {
      const rawAx = (maxDisplacement / (1.2 * avgDisplacement)) ** 2;
      if (rawAx > 3.0) anyExceedsAxLimit = true;
      amplificationFactorAx = Math.min(Math.max(rawAx, 1.0), 3.0);
    }

    // perpendicular dimension — direction="X" এর জন্য Z-extent, "Z" এর জন্য X-extent
    const xs = group.nodes.map((n) => n.node.x);
    const zs = group.nodes.map((n) => n.node.z);
    const perpendicularDimension =
      input.direction === "X" ? Math.max(...zs) - Math.min(...zs) : Math.max(...xs) - Math.min(...xs);

    const baseAccidentalEccentricity = 0.05 * perpendicularDimension;
    const amplifiedAccidentalEccentricity = baseAccidentalEccentricity * amplificationFactorAx;

    const shear = findShearAtElevation(input.storyShears, group.story.elevation);
    const additionalTorsionalMomentKNm = shear !== null ? shear * amplifiedAccidentalEccentricity : null;

    const entry: StoryTorsionResult = {
      storyId: group.story.storyId,
      storyName: group.story.name,
      direction: input.direction,
      maxDisplacement,
      avgDisplacement,
      ratio,
      isTorsionallyIrregular,
      isExtremeTorsionallyIrregular,
      amplificationFactorAx,
      baseAccidentalEccentricity,
      amplifiedAccidentalEccentricity,
      additionalTorsionalMomentKNm,
    };
    results.push(entry);
  }

  if (anyExceedsAxLimit) {
    warnings.push(
      "🔴 এক বা একাধিক story-তে গণনাকৃত Ax 3.0 অতিক্রম করেছে (রিপোর্টে 3.0-এ সীমাবদ্ধ করা হয়েছে, কোড অনুযায়ী) — এটা একটা গুরুতর torsional irregularity সংকেত, lateral-force-resisting system এর configuration পুনর্বিবেচনা করার পরামর্শ দেওয়া হচ্ছে (শুধু accidental eccentricity বাড়িয়ে সমাধান না করে)।"
    );
  }

  if (!input.storyShears) {
    warnings.push(
      "ℹ️ Story Shear দেওয়া হয়নি — Additional Torsional Moment হিসাব করা যায়নি, শুধু Ax ও amplified eccentricity দেখানো হচ্ছে।"
    );
  }

  const worstAx =
    results.length > 0
      ? results.reduce((worst, current) => (current.amplificationFactorAx > worst.amplificationFactorAx ? current : worst))
      : null;

  return { results, worstAx, anyExceedsAxLimit, warnings };
}
