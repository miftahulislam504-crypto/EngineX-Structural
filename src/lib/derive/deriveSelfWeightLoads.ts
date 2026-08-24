/**
 * deriveSelfWeightLoads — Beam/Column/Brace/Pile এর geometry ও
 * material থেকে স্বয়ংক্রিয়ভাবে self-weight (uniform-line dead load)
 * বের করে।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 4 আইটেম "load pipeline সম্প্রসারণ"-এর অংশ হিসেবে
 * যোগ করা হলো (Miftahul এর অনুরোধ: "load define যেনো অটো হয়")।
 *
 * 🔴 এটা একটা pre-existing dormant field সচল করে — LoadPattern এ
 * selfWeightMultiplier ফিল্ড আগে থেকেই ছিল (lib/types/load.ts,
 * dead category তে ডিফল্ট 1.0), LoadPatternPanel.tsx এ set হয়, এমনকি
 * SectionE_DesignLoads.tsx (PDF report) এ দেখানোও হয় — কিন্তু কোনো
 * কোড কখনো এই মান পড়ে আসল self-weight load case তৈরি করত না। এই
 * ফাইল সেই gap পূরণ করে, নতুন mechanism বানানো হয়নি।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - Beam/Column/Brace/Pile — চারটাই LineElement, computeLineElementLength
 *     এখন চারটার জন্যই সংজ্ঞায়িত (২০২৬-০৮ পর্যন্ত শুধু Beam/Column
 *     সমর্থিত ছিল, কোনো real geometric কারণ ছাড়াই — সেই সীমাবদ্ধতা
 *     সরানো হয়েছে)।
 *   - Slab/Wall/Shear-Wall/Core-Wall self-weight এখানে নেই — সেগুলো
 *     area load (ভিন্ন mechanism, dead load per area = thickness ×
 *     unitWeight), deriveAreaSelfWeightLoads.ts এ আলাদাভাবে handled
 *     (২০২৬-০৮ যোগ হলো)।
 *   - Composite/Prestressed/Cold-Formed section এ computeSectionProperties
 *     throw করে (section.ts এর ডকুমেন্টেড সীমাবদ্ধতা) — সেই element
 *     skip করা হয় warning সহ, crash না করে।
 *   - এই ফাংশন শুধু নতুন LoadCase অবজেক্টের array রিটার্ন করে —
 *     Firestore এ persist করা caller এর দায়িত্ব (useLoadCore.addLoadCase
 *     ব্যবহার করে, একই pattern manual load creation এর মতো)। এখানে
 *     কোনো side-effect নেই, pure function — UI থেকে "Auto-generate
 *     self-weight" বাটনে কল করে ফলাফল preview/persist করা যাবে।
 */

import type { StructuralElement, BeamElement, ColumnElement, BraceElement, PileElement } from "@/lib/types/element";
import { computeLineElementLength } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";
import type { UniformLineLoadCase } from "@/lib/types/load";
import { createUniformLineLoad } from "@/lib/types/load";

const SELF_WEIGHT_SUPPORTED_CATEGORIES = new Set(["beam", "column", "brace", "pile"]);

export interface DeriveSelfWeightLoadsResult {
  loadCases: UniformLineLoadCase[];
  skipped: { elementId: string; label: string; reason: string }[];
  warnings: string[];
}

/**
 * সব Beam/Column/Brace/Pile element-এর জন্য self-weight uniform-line
 * load তৈরি করে। প্রতিটা element-এর material.unitWeight (kN/m³) ও
 * section.area (mm² → m² এ convert) থেকে intensity (kN/m) হিসাব:
 *
 *   intensity = -(area_m2 × unitWeight_kNm3) × selfWeightMultiplier
 *
 * ঋণাত্মক (negative) কারণ gravity load নিচের দিকে (Y-অক্ষে negative,
 * seismicLoad.ts/load.ts এর কনভেনশন অনুযায়ী — দেখুন UniformLineLoadCase
 * এর intensityY কমেন্ট)।
 *
 * @param deadPatternId - যে LoadPattern-এ এই load case গুলো যুক্ত হবে (category "dead" হওয়া উচিত, কিন্তু এই ফাংশন নিজে category চেক করে না — caller নিশ্চিত করবে সঠিক pattern পাঠানো হচ্ছে)
 * @param selfWeightMultiplier - LoadPattern থেকে (সাধারণত 1.0), না দিলে 1.0 ধরা হয়
 */
export function deriveSelfWeightLoads(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  deadPatternId: string,
  selfWeightMultiplier = 1.0
): DeriveSelfWeightLoadsResult {
  const loadCases: UniformLineLoadCase[] = [];
  const skipped: DeriveSelfWeightLoadsResult["skipped"] = [];
  const warnings: string[] = [];

  const lineElements = elements.filter(
    (e): e is BeamElement | ColumnElement | BraceElement | PileElement =>
      SELF_WEIGHT_SUPPORTED_CATEGORIES.has(e.category)
  );

  for (const element of lineElements) {
    const material = materials.find((m) => m.materialId === element.materialId);
    if (!material) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: `materialId "${element.materialId}" পাওয়া যায়নি material library তে।` });
      continue;
    }

    const section = sections.find((s) => s.sectionId === element.sectionId);
    if (!section) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: `sectionId "${element.sectionId}" পাওয়া যায়নি section library তে।` });
      continue;
    }

    let properties;
    try {
      properties = computeSectionProperties(section);
    } catch {
      skipped.push({
        elementId: element.elementId,
        label: element.label,
        reason: "এই section (Composite/Prestressed/Cold-Formed) এর geometric properties হিসাব করা যায় না (section.ts এর ডকুমেন্টেড সীমাবদ্ধতা) — self-weight ম্যানুয়ালি যোগ করুন।",
      });
      continue;
    }

    // CompositeMaterial এর unitWeight এর বদলে effectiveUnitWeight
    // (weighted-average equivalent) — material.types.ts এ ডকুমেন্টেড
    // ইচ্ছাকৃত নামকরণ পার্থক্য, বাকি সব material variant এ unitWeight।
    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;

    const lengthM = computeLineElementLength(element);
    if (lengthM <= 0) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: "element length শূন্য বা ঋণাত্মক — geometry যাচাই করুন।" });
      continue;
    }

    const areaM2 = properties.area / 1e6; // mm² → m²
    const intensityY = -(areaM2 * unitWeight * selfWeightMultiplier); // kN/m, gravity direction negative

    loadCases.push(
      createUniformLineLoad({
        patternId: deadPatternId,
        elementId: element.elementId,
        intensityY,
        source: "auto",
      })
    );
  }

  if (skipped.length > 0) {
    warnings.push(`${skipped.length}টা element self-weight auto-generation এ বাদ পড়েছে — নিচে elementId/কারণ দেখুন, প্রয়োজনে ম্যানুয়ালি যোগ করুন।`);
  }

  return { loadCases, skipped, warnings };
}
