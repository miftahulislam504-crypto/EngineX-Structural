/**
 * Performance-Based Design layer (Phase 8f) — Pushover capacity curve
 * (Phase 4-এর computeAnalysis, "pushover" type) কে ATC-40 Capacity
 * Spectrum Method দিয়ে Performance Point-এ রূপান্তর করে, তারপর FEMA
 * 356-এর performance level (Immediate Occupancy / Life Safety /
 * Collapse Prevention) এর সাথে তুলনা করে classify করে।
 *
 * সূত্র (web search দিয়ে primary source থেকে যাচাই করা):
 *
 *   ATC-40 capacity spectrum conversion (V-Δ থেকে Sa-Sd, ATC-40 Eq
 *   8-1/8-2 এর সমতুল্য, Seismosoft-এর ডকুমেন্টেশনে নিশ্চিত করা):
 *     Sa = V / (W × α1)
 *     Sd = Δroof / PF1
 *   যেখানে V=base shear, W=total seismic weight, Δroof=control node
 *   displacement, PF1=mode 1-এর modal participation factor, α1=mode
 *   1-এর modal mass coefficient — উভয়ই standard modal theory থেকে:
 *     PF1 = Σ(wi·φi1) / Σ(wi·φi1²)
 *     α1  = [Σ(wi·φi1)]² / [Σ(wi) × Σ(wi·φi1²)]
 *   (wi = story i-এর weight, φi1 = mode 1-এর ঐ story-র normalized
 *   shape — roof/control node এ φ=1.0 করে normalize করা হয়)।
 *
 *   FEMA 356 Table C1-3 (Concrete Frames, Primary element, Interstory
 *   Drift) — সরাসরি প্রাইমারি সোর্স থেকে verified (ce.memphis.edu
 *   হোস্ট করা FEMA 356 Chapter 1 PDF):
 *     Immediate Occupancy (IO): 1% transient drift
 *     Life Safety (LS):         2% transient drift (1% permanent)
 *     Collapse Prevention (CP): 4% transient/permanent drift
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   1. **Performance Point iteration সরলীকৃত।** ATC-40-এর পূর্ণাঙ্গ
 *      Procedure A/B/C effective-damping-ভিত্তিক iterative convergence
 *      (বার বার reduced-spectrum দিয়ে trial performance point বের
 *      করে damping/ductility-নির্ভর spectral reduction factor আপডেট
 *      করা) এখানে প্রয়োগ করা হয়নি — এটা elastic demand spectrum
 *      (5% damping, ব্যবহারকারীর নিজস্ব input) ও capacity curve-এর
 *      **প্রথম ছেদবিন্দু (intersection)** ব্যবহার করে, যা conservative
 *      (elastic demand কমানো হয় না ductility অনুযায়ী) — প্রকৃত
 *      Performance Point সাধারণত এর চেয়ে কম displacement-এ হয়
 *      (effective damping বেশি হলে spectrum কমে)। চূড়ান্ত ডিজাইনে
 *      একজন ইঞ্জিনিয়ারের পূর্ণাঙ্গ ATC-40/FEMA 440 iteration করা উচিত।
 *   2. **Performance level classification building-level, element-level
 *      না।** FEMA 356-এর প্রকৃত performance assessment element-by-
 *      element plastic hinge rotation চেক করে (hingeStates থেকে
 *      পাওয়া যায়, Phase 4 Nonlinear Static/Pushover এ আছে) — এই
 *      মডিউল শুধু global roof drift ratio (Δroof/buildingHeight)
 *      দিয়ে building-level classification দেয়, যা সহজ কিন্তু কম
 *      নির্ভুল প্রথম-অনুমান (FEMA 356-এর নিজস্ব pattern, তবে element-
 *      level check ছাড়া চূড়ান্ত না)।
 */

import type { PushoverCurvePoint, ModalMode, AnalysisNode } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";
import { groupNodesByStory } from "@/lib/analysis/nodeStoryMap";
import type { DemandSpectrumPoint } from "@/lib/analysis/bnbc2020DemandSpectrum";

export type PerformanceLevel = "immediate-occupancy" | "life-safety" | "collapse-prevention" | "beyond-collapse-prevention";

export const PERFORMANCE_LEVEL_DRIFT_LIMITS: Record<Exclude<PerformanceLevel, "beyond-collapse-prevention">, number> = {
  "immediate-occupancy": 0.01, // FEMA 356 Table C1-3, Concrete Frames Primary, IO transient
  "life-safety": 0.02, // LS transient
  "collapse-prevention": 0.04, // CP transient/permanent
};

export interface ModalParticipationInput {
  /** mode 1 এর modeShape ও nodes — nodes[i] এর coordinate modeShape[i] এর সাথে ম্যাচ করে (Phase 8a)। */
  nodes: AnalysisNode[];
  mode1: ModalMode;
  stories: StructuralStory[];
  /** kN — seismicLoad.ts এর computeSeismicLoad().input.seismicWeight (মোট), সব story-তে সমানভাবে ভাগ হবে (এই অ্যাপে per-story weight input নেই, 8d এর মতো একই সীমাবদ্ধতা)। */
  totalSeismicWeightKN: number;
  /** lateral push direction — X হলে mode shape এর ux, Z হলে uz ব্যবহার হবে participation factor বের করতে। */
  direction: "X" | "Z";
}

export interface ModalParticipationResult {
  participationFactorPF1: number;
  modalMassCoefficientAlpha1: number;
  warnings: string[];
}

/**
 * Modal Participation Factor (PF1) ও Modal Mass Coefficient (α1)
 * বের করে, mode 1 এর shape কে roof/সবচেয়ে উপরের story তে φ=1.0
 * normalize করে (ATC-40 এর প্রচলিত convention)।
 */
export function computeModalParticipation(input: ModalParticipationInput): ModalParticipationResult {
  const warnings: string[] = [];
  const { storyGroups } = groupNodesByStory(
    input.nodes,
    input.mode1.modeShape,
    input.stories
  );
  const nonBaseGroups = storyGroups.filter((g) => !g.story.isBaseLevel && g.nodes.length > 0);

  if (nonBaseGroups.length === 0) {
    return {
      participationFactorPF1: 0,
      modalMassCoefficientAlpha1: 0,
      warnings: ["⚠️ কোনো non-base story-তে mode shape node পাওয়া যায়নি — Modal Participation হিসাব করা যায়নি।"],
    };
  }

  const getComponent = (entry: { ux: number; uz: number }) => (input.direction === "X" ? entry.ux : entry.uz);

  // প্রতিটা story-র গড় mode-shape component বের করা (rigid diaphragm ধরে)
  const storyPhi = nonBaseGroups.map((g) => {
    const avg = g.nodes.reduce((sum, n) => sum + getComponent(n.displacement), 0) / g.nodes.length;
    return { story: g.story, phi: avg };
  });

  // Roof (সবচেয়ে উপরের story) এর phi দিয়ে normalize — φ_roof = 1.0
  const roofPhi = storyPhi[storyPhi.length - 1].phi;
  if (Math.abs(roofPhi) < 1e-12) {
    warnings.push("⚠️ Roof story-র mode shape component প্রায় শূন্য — normalize করা যায়নি, PF1/α1 নির্ভরযোগ্য নয়।");
    return { participationFactorPF1: 0, modalMassCoefficientAlpha1: 0, warnings };
  }

  const storyWeight = input.totalSeismicWeightKN / nonBaseGroups.length; // seismicLoad.ts এর মতোই সরলীকরণ (সমান ভাগ)

  let sumWPhi = 0;
  let sumWPhi2 = 0;
  let sumW = 0;
  for (const { phi } of storyPhi) {
    const phiNormalized = phi / roofPhi;
    sumWPhi += storyWeight * phiNormalized;
    sumWPhi2 += storyWeight * phiNormalized ** 2;
    sumW += storyWeight;
  }

  if (sumWPhi2 < 1e-12) {
    warnings.push("⚠️ Σ(wi·φi²) প্রায় শূন্য — PF1/α1 হিসাব করা যায়নি।");
    return { participationFactorPF1: 0, modalMassCoefficientAlpha1: 0, warnings };
  }

  const participationFactorPF1 = sumWPhi / sumWPhi2;
  const modalMassCoefficientAlpha1 = sumWPhi ** 2 / (sumW * sumWPhi2);

  return { participationFactorPF1, modalMassCoefficientAlpha1, warnings };
}

export interface CapacitySpectrumPoint {
  spectralAccelerationG: number; // Sa, g
  spectralDisplacementM: number; // Sd, মিটার
  sourcePoint: PushoverCurvePoint;
}

/**
 * V-Δ capacity curve কে Sa-Sd (ADRS format) capacity spectrum-এ
 * রূপান্তর করে — ATC-40 Eq 8-1/8-2।
 */
export function convertCapacityCurveToSpectrum(
  capacityCurve: PushoverCurvePoint[],
  totalSeismicWeightKN: number,
  participation: ModalParticipationResult
): CapacitySpectrumPoint[] {
  if (participation.modalMassCoefficientAlpha1 < 1e-9 || participation.participationFactorPF1 < 1e-9) {
    return [];
  }
  return capacityCurve.map((point) => {
    // V ও W উভয়ই kN এককে, তাই V/W একটা dimensionless অনুপাত — এই
    // অনুপাতটাই সরাসরি "g-এর ভগ্নাংশ" (Sa স্পেকট্রাল ত্বরণ g এককে
    // প্রকাশ করা হয়), তাই আলাদাভাবে g দিয়ে গুণ/ভাগ করার দরকার নেই।
    const Sa = point.baseShearKN / (totalSeismicWeightKN * participation.modalMassCoefficientAlpha1);
    const Sd = point.controlDisplacementM / participation.participationFactorPF1;
    return { spectralAccelerationG: Sa, spectralDisplacementM: Sd, sourcePoint: point };
  });
}

export interface PerformancePointResult {
  found: boolean;
  performancePoint: CapacitySpectrumPoint | null;
  roofDisplacementM: number | null;
  performanceLevel: PerformanceLevel | null;
  governingDriftRatio: number | null;
  warnings: string[];
}

/**
 * elastic demand spectrum (5% damping ধরে) ও capacity spectrum-এর
 * প্রথম ছেদবিন্দু বের করে (সরলীকৃত পদ্ধতি, module docstring দেখুন)।
 * demandSpectrum কে Sd = Sa × g × T² / (4π²) দিয়ে ADRS format-এ
 * রূপান্তর করে capacity curve-এর সাথে তুলনা করা হয়।
 */
export function findPerformancePoint(
  capacitySpectrum: CapacitySpectrumPoint[],
  demandSpectrum: DemandSpectrumPoint[],
  buildingHeight: number
): PerformancePointResult {
  const warnings: string[] = [];
  if (capacitySpectrum.length < 2) {
    return {
      found: false,
      performancePoint: null,
      roofDisplacementM: null,
      performanceLevel: null,
      governingDriftRatio: null,
      warnings: ["⚠️ Capacity spectrum-এ পর্যাপ্ত পয়েন্ট নেই (কমপক্ষে ২টা দরকার) — Performance Point বের করা যায়নি।"],
    };
  }
  if (demandSpectrum.length < 2) {
    return {
      found: false,
      performancePoint: null,
      roofDisplacementM: null,
      performanceLevel: null,
      governingDriftRatio: null,
      warnings: ["⚠️ Demand spectrum-এ পর্যাপ্ত পয়েন্ট নেই — Performance Point বের করা যায়নি।"],
    };
  }

  const g = 9.81;
  // demandSpectrum কে Sd তে রূপান্তর, তারপর capacity curve এর প্রতিটা
  // segment এর সাথে demand curve এর প্রতিটা segment তুলনা করে linear
  // interpolation দিয়ে ছেদবিন্দু বের করা (brute-force segment
  // intersection, ছোট curve সাইজে যথেষ্ট দ্রুত)।
  const demandSdSa = demandSpectrum.map((d) => ({
    Sd: (d.spectralAccelerationG * g * d.periodSeconds ** 2) / (4 * Math.PI ** 2),
    Sa: d.spectralAccelerationG,
  }));

  function findLineIntersection(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ): { x: number; y: number } | null {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  }

  for (let i = 0; i < capacitySpectrum.length - 1; i++) {
    const c1 = { x: capacitySpectrum[i].spectralDisplacementM, y: capacitySpectrum[i].spectralAccelerationG };
    const c2 = { x: capacitySpectrum[i + 1].spectralDisplacementM, y: capacitySpectrum[i + 1].spectralAccelerationG };
    for (let j = 0; j < demandSdSa.length - 1; j++) {
      const d1 = { x: demandSdSa[j].Sd, y: demandSdSa[j].Sa };
      const d2 = { x: demandSdSa[j + 1].Sd, y: demandSdSa[j + 1].Sa };
      const intersection = findLineIntersection(c1, c2, d1, d2);
      if (intersection) {
        // capacitySpectrum[i]/[i+1] এর মাঝামাঝি রৈখিক interpolation
        // করে sourcePoint (roof displacement সহ) বের করা
        const t =
          Math.abs(c2.x - c1.x) > 1e-12
            ? (intersection.x - c1.x) / (c2.x - c1.x)
            : (intersection.y - c1.y) / (c2.y - c1.y || 1);
        const roofDisplacementM =
          capacitySpectrum[i].sourcePoint.controlDisplacementM +
          t * (capacitySpectrum[i + 1].sourcePoint.controlDisplacementM - capacitySpectrum[i].sourcePoint.controlDisplacementM);

        const governingDriftRatio = buildingHeight > 0 ? roofDisplacementM / buildingHeight : null;
        let performanceLevel: PerformanceLevel | null = null;
        if (governingDriftRatio !== null) {
          if (governingDriftRatio <= PERFORMANCE_LEVEL_DRIFT_LIMITS["immediate-occupancy"]) {
            performanceLevel = "immediate-occupancy";
          } else if (governingDriftRatio <= PERFORMANCE_LEVEL_DRIFT_LIMITS["life-safety"]) {
            performanceLevel = "life-safety";
          } else if (governingDriftRatio <= PERFORMANCE_LEVEL_DRIFT_LIMITS["collapse-prevention"]) {
            performanceLevel = "collapse-prevention";
          } else {
            performanceLevel = "beyond-collapse-prevention";
          }
        }

        return {
          found: true,
          performancePoint: {
            spectralAccelerationG: intersection.y,
            spectralDisplacementM: intersection.x,
            sourcePoint: capacitySpectrum[i].sourcePoint,
          },
          roofDisplacementM,
          performanceLevel,
          governingDriftRatio,
          warnings,
        };
      }
    }
  }

  warnings.push(
    "ℹ️ Capacity spectrum ও demand spectrum-এর মধ্যে কোনো ছেদবিন্দু পাওয়া যায়নি — সম্ভবত demand capacity-র চেয়ে অনেক বেশি (structure-টা পর্যাপ্ত পুশ করা হয়নি) বা demand spectrum ভুল একক/রেঞ্জে দেওয়া হয়েছে।"
  );
  return {
    found: false,
    performancePoint: null,
    roofDisplacementM: null,
    performanceLevel: null,
    governingDriftRatio: null,
    warnings,
  };
}
