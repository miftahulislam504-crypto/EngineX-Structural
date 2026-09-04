/**
 * deriveWallLineLoadFromSelfWeight.ts — ordinary wall (Hub-এর
 * WallSelfWeightRef, StructuralElement না) এর self-weight কে supporting
 * beam-এর উপর একটা extra uniform-line load হিসেবে, বা beam না পেলে সেই
 * story-র slab-এর উপর একটা extra uniform-area load হিসেবে বিতরণ করে।
 * ------------------------------------------------------------------
 * প্রেক্ষাপট (Miftahul, 2026-09-04 — Hub payload-size split,
 * hub-write.ts/hub-geometry-parser.ts এর সংশ্লিষ্ট নোট দেখুন): ordinary
 * wall (isShearWall: false) আর Structural-এ WallElement হিসেবে modeled
 * হয় না — শুধু centerline+thickness/height (WallSelfWeightRef) হিসেবে
 * আসে। কিন্তু dead load calculation-এ এর ওজন (brick/block wall কোনো
 * ভবনে dead load-এর একটা উল্লেখযোগ্য অংশ) বাদ দেওয়া অগ্রহণযোগ্য —
 * Miftahul এর confirmed সিদ্ধান্ত: "প্রতি wall যে beam/grid line এ
 * অবস্থিত তার উপর একটা line load বসাও, beam না পেলে সেই slab এ
 * uniform-area হিসেবে fallback দাও"।
 *
 * ⚠️ গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত — কেন এই ফাইল নিজে কোনো LoadCase
 * তৈরি করে না, শুধু "extra intensity" contribution map রিটার্ন করে:
 * useAutoLoadSync.ts এর diffAutoLoadCases() একটা (patternId, elementId,
 * applicationType) triple-কে unique key ধরে — মানে একটা beam বা slab-এ
 * একই pattern-এর একটাই auto uniform-line/uniform-area case থাকতে পারে
 * (deriveSelfWeightLoads.ts/deriveAreaSelfWeightLoads.ts প্রতিটাই তাই
 * প্রতি element একটা করে case বানায়)। এই ফাইল যদি নিজে থেকে বেয়ার
 * beam/slab-এ আরেকটা আলাদা case বসাতো, সেটা ওই একই key-তে collision
 * করত — একটা sync-এ যেটা শেষে লেখা হয় সেটাই টিকে থাকত, বাকিটা silently
 * হারিয়ে যেত (diffAutoLoadCases এই invariant ধরে নিয়েই লেখা, একাধিক
 * case per key সমর্থন করে না)। তাই সঠিক সমাধান: এই ফাইল শুধু
 * elementId → extra intensity (kN/m বা kN/m²) এর Map রিটার্ন করে, আর
 * useAutoLoadSync.ts সেটা deriveSelfWeightLoads()/deriveAreaSelfWeightLoads()
 * এর ফলাফলের সাথে merge করে (matching elementId-র case-এর intensityY/
 * intensity-তে যোগ করে) — চূড়ান্ত case তৈরির আগেই, যাতে diff key
 * সবসময় unique থাকে।
 *
 * Beam matching পদ্ধতি:
 *   - একই storyId-র beam-গুলোর মধ্যে খোঁজা হয় (storyId ছাড়া wall ref
 *     বা beam বাদ — কোন floor-এ বসবে জানা না থাকলে match করা অর্থহীন)।
 *   - Plan-view (X-Z প্লেন, element.ts এর "Y উল্লম্ব" কনভেনশন) এ wall
 *     centerline ও beam centerline সমান্তরাল ও কাছাকাছি কিনা: wall-এর
 *     দুই প্রান্তের beam-এর অসীম-দৈর্ঘ্য রেখা থেকে perpendicular
 *     distance BEAM_ALIGNMENT_TOLERANCE_M এর মধ্যে কিনা যাচাই করা হয়
 *     (এই সহনশীলতা মান modelChecker.ts এর FOOTING_ALIGNMENT_TOLERANCE_M
 *     এর সাথে সামঞ্জস্যপূর্ণ রাখা হয়েছে — এই codebase-এর প্রতিষ্ঠিত
 *     "plan-alignment মানে ঠিক কতটা কাছাকাছি" কনভেনশন)।
 *   - এরপর wall centerline-কে beam centerline-এর ওপর projected করে
 *     overlap length বের করা হয় — কমপক্ষে wall length-এর
 *     MIN_OVERLAP_FRACTION অংশ ওভারল্যাপ না করলে match গণনা করা হয় না
 *     (নাহলে একটা সম্পূর্ণ ভিন্ন জায়গার সমান্তরাল beam ভুলবশত match
 *     হয়ে যেতে পারে)।
 *   - একাধিক beam মিললে সবচেয়ে কম perpendicular distance-ওয়ালাটা
 *     বেছে নেওয়া হয় (সবচেয়ে সরাসরি সমর্থনকারী বলে ধরে নেওয়া)।
 *
 * Slab fallback পদ্ধতি:
 *   - কোনো beam না মিললে, একই storyId-র slab-গুলোর মধ্যে wall
 *     centerline-এর মধ্যবিন্দু (midpoint) কোন slab-এর plan polygon-এর
 *     ভেতরে (বা প্রায় ভেতরে — boundary wall প্রায়ই polygon edge-এর
 *     ঠিক ওপরেই থাকে, তাই সামান্য tolerance সহ) পড়ে সেটা খোঁজা হয়
 *     (ray-casting point-in-polygon, X-Z প্লেনে — computePolygonPlanArea()
 *     এর একই projection কনভেনশন)।
 *   - সেই slab-এর সম্পূর্ণ self-weight uniform-area intensity-র সাথে
 *     এই wall-এর মোট ওজনকে সেই slab-এর plan area দিয়ে ভাগ করে একটা
 *     extra intensity (kN/m²) যোগ করা হয় — অর্থাৎ wall-টার ওজন সমানভাবে
 *     পুরো slab-এর ওপর "smeared" (ছড়ানো) ধরা হয়, ঠিক যেমন একটা
 *     partition wall load slab-ভিত্তিক ডিজাইনে প্রায়ই সরলীকৃতভাবে
 *     ধরা হয় (একটা নির্দিষ্ট partition-এর জন্য সাধারণ live-load-এর
 *     ওপর একটা flat additional allowance, ঠিক এই একই নীতি)।
 *   - কোনো beam বা slab কোনোটাই না মিললে wall-টা "unmatched" হিসেবে
 *     warning-এ যায় — self-weight silently হারানো হয় না, ইঞ্জিনিয়ারকে
 *     জানানো হয় যাতে ম্যানুয়ালি ঠিক করতে পারেন (geometry-তে ভুল থাকতে
 *     পারে, অথবা সত্যিই কোনো সমর্থনকারী element নেই)।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - materialLabel Draw-এর নিজস্ব string (কোনো Structural materialId
 *     রেফারেন্স না — Draw ও Structural-এর material catalog সম্পূর্ণ
 *     আলাদা, hub-geometry-parser.ts এর পুরনো UNRESOLVED_MATERIAL_ID
 *     কমেন্ট দেখুন)। তাই এখানে materialLabel কে Structural material
 *     library-র name-এর সাথে case-insensitive মিলিয়ে unitWeight বের
 *     করার চেষ্টা করা হয় — না মিললে DEFAULT_MASONRY_UNIT_WEIGHT_KNM3
 *     (প্রচলিত প্রথম-শ্রেণির brick masonry-র standard মান, ~1920 kg/m³)
 *     ব্যবহার করে একটা warning দেওয়া হয় — সম্পূর্ণ বাদ দেওয়ার চেয়ে
 *     একটা যুক্তিসঙ্গত ডিফল্ট দিয়ে dead load ধরে রাখা নিরাপদ, কিন্তু
 *     ভুল-নির্ভুল ধরনের নীরবতা এড়াতে warning আবশ্যক।
 */

import type { StructuralElement, BeamElement, SlabElement, Point3D } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { WallSelfWeightRef } from "@/lib/hub/hub-geometry-parser";

/** modelChecker.ts এর FOOTING_ALIGNMENT_TOLERANCE_M (0.15m) এর সাথে সামঞ্জস্যপূর্ণ — এই codebase-এর প্রতিষ্ঠিত plan-alignment tolerance। */
const BEAM_ALIGNMENT_TOLERANCE_M = 0.15;

/** wall length-এর অন্তত এই অংশ beam-এর সাথে overlap না করলে match গণনা করা হয় না। */
const MIN_OVERLAP_FRACTION = 0.5;

/** প্রথম-শ্রেণির brick masonry-র প্রচলিত standard একক ওজন (kN/m³, ~1920 kg/m³) — materialLabel resolve করা না গেলে fallback। */
const DEFAULT_MASONRY_UNIT_WEIGHT_KNM3 = 18.85;

/** point-in-polygon tolerance (m) — boundary wall প্রায়ই polygon edge-এর ঠিক ওপরে থাকে, floating-point/drawing imprecision এর জন্য সামান্য মার্জিন। */
const SLAB_BOUNDARY_TOLERANCE_M = 0.15;

export interface DeriveWallLineLoadFromSelfWeightResult {
  /** beamElementId → extra intensityY contribution (kN/m, ইতিমধ্যে ঋণাত্মক — gravity)। useAutoLoadSync.ts এ deriveSelfWeightLoads() এর ফলাফলের সাথে merge করা হয়। */
  beamExtraIntensityY: Map<string, number>;
  /** slabElementId → extra intensity contribution (kN/m², ইতিমধ্যে ঋণাত্মক)। useAutoLoadSync.ts এ deriveAreaSelfWeightLoads() এর ফলাফলের সাথে merge করা হয়। */
  slabExtraIntensity: Map<string, number>;
  warnings: string[];
}

function resolveUnitWeight(materialLabel: string | undefined, materials: StructuralMaterial[]): { unitWeight: number; usedDefault: boolean } {
  if (materialLabel) {
    const match = materials.find((m) => m.name.trim().toLowerCase() === materialLabel.trim().toLowerCase());
    if (match) {
      const unitWeight = match.type === "composite" ? match.effectiveUnitWeight : match.unitWeight;
      return { unitWeight, usedDefault: false };
    }
  }
  return { unitWeight: DEFAULT_MASONRY_UNIT_WEIGHT_KNM3, usedDefault: true };
}

/** wall centerline-এর একটা প্রান্ত (X-Z প্লেনে) beam centerline (অসীম-দৈর্ঘ্য রেখা) থেকে perpendicular distance। */
function perpendicularDistanceToLine(
  point: { x: number; z: number },
  lineStart: { x: number; z: number },
  lineEnd: { x: number; z: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 1e-9) {
    // zero-length line — point-to-point distance
    return Math.hypot(point.x - lineStart.x, point.z - lineStart.z);
  }
  // cross-product magnitude / line length = perpendicular distance
  const cross = (point.x - lineStart.x) * dz - (point.z - lineStart.z) * dx;
  return Math.abs(cross) / Math.sqrt(lengthSq);
}

/**
 * wall centerline (X-Z প্লেনে) কে beam centerline-এর ওপর project করে
 * overlap length বের করে — ০ মানে কোনো overlap নেই। উভয় segment
 * beam-এর দিক বরাবর ১-ডাইমেনশনাল parametric t (0..1, beam এর length
 * অনুযায়ী স্কেল করা) এ প্রজেক্ট করে ইন্টারভাল ইন্টারসেকশন বের করা হয়।
 */
function overlapLengthAlongBeam(
  wallStart: { x: number; z: number },
  wallEnd: { x: number; z: number },
  beamStart: { x: number; z: number },
  beamEnd: { x: number; z: number }
): number {
  const dx = beamEnd.x - beamStart.x;
  const dz = beamEnd.z - beamStart.z;
  const beamLenSq = dx * dx + dz * dz;
  if (beamLenSq < 1e-9) return 0;
  const beamLen = Math.sqrt(beamLenSq);

  function paramOf(p: { x: number; z: number }): number {
    return ((p.x - beamStart.x) * dx + (p.z - beamStart.z) * dz) / beamLenSq;
  }

  const t1 = paramOf(wallStart);
  const t2 = paramOf(wallEnd);
  const loT = Math.max(0, Math.min(t1, t2));
  const hiT = Math.min(1, Math.max(t1, t2));
  if (hiT <= loT) return 0;
  return (hiT - loT) * beamLen;
}

/** ray-casting point-in-polygon, X-Z প্লেনে (computePolygonPlanArea() এর একই projection)। tolerance-এর জন্য: polygon সামান্য বাড়িয়ে (প্রতিটা edge থেকে tolerance দূরত্বে) টেস্ট করার বদলে, সরাসরি edge-distance চেক দিয়ে "boundary-তে বা কাছাকাছি" ধরা হয়েছে। */
function isPointNearOrInsidePolygonXZ(point: { x: number; z: number }, vertices: Point3D[], toleranceM: number): boolean {
  if (vertices.length < 3) return false;

  // প্রথমে boundary থেকে দূরত্ব চেক — সীমার ওপর/কাছাকাছি হলে সরাসরি true
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const dist = distancePointToSegmentXZ(point, a, b);
    if (dist <= toleranceM) return true;
  }

  // Ray casting (strictly inside test)
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const zi = vertices[i].z;
    const xj = vertices[j].x;
    const zj = vertices[j].z;
    const intersects =
      zi > point.z !== zj > point.z && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distancePointToSegmentXZ(point: { x: number; z: number }, a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
  const projX = a.x + t * dx;
  const projZ = a.z + t * dz;
  return Math.hypot(point.x - projX, point.z - projZ);
}

/**
 * সব ordinary wall self-weight ref-কে supporting beam (line load) বা
 * fallback slab (area load, একই storyId) এ বিতরণ করে।
 */
export function deriveWallLineLoadFromSelfWeight(
  wallRefs: WallSelfWeightRef[],
  elements: StructuralElement[],
  materials: StructuralMaterial[]
): DeriveWallLineLoadFromSelfWeightResult {
  const beamExtraIntensityY = new Map<string, number>();
  const slabExtraIntensity = new Map<string, number>();
  const warnings: string[] = [];

  const beams = elements.filter((e): e is BeamElement => e.category === "beam");
  const slabs = elements.filter((e): e is SlabElement => e.category === "slab");

  let defaultUnitWeightUsedCount = 0;
  let unmatchedCount = 0;

  for (const wall of wallRefs) {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const wallLengthM = Math.hypot(dx, dz);
    if (wallLengthM <= 0) {
      warnings.push(`Wall ref "${wall.refId}" এর length শূন্য বা অবৈধ — self-weight বিতরণ করা যায়নি।`);
      continue;
    }

    const { unitWeight, usedDefault } = resolveUnitWeight(wall.materialLabel, materials);
    if (usedDefault) defaultUnitWeightUsedCount++;

    // মোট ওজন (kN) = length × height × thickness × unitWeight
    const totalWeightKN = wallLengthM * wall.heightM * wall.thicknessM * unitWeight;
    // per-meter intensity — totalWeightKN / wallLengthM এর সমতুল্য
    // (= height × thickness × unitWeight), totalWeightKN থেকে ভাগ করেই
    // বের করা হচ্ছে যাতে একই সূত্র slab fallback এর totalWeightKN এর
    // সাথেও সঙ্গতিপূর্ণ থাকে (নিচে দেখুন)।
    const weightPerMeterKNm = totalWeightKN / wallLengthM;

    // ---- Beam matching (একই storyId এর মধ্যে) ----
    let bestBeam: BeamElement | null = null;
    let bestDistance = Infinity;

    for (const beam of beams) {
      if (beam.storyId !== wall.storyId) continue;

      const distStart = perpendicularDistanceToLine(wall.start, beam.startPoint, beam.endPoint);
      const distEnd = perpendicularDistanceToLine(wall.end, beam.startPoint, beam.endPoint);
      const maxDist = Math.max(distStart, distEnd);
      if (maxDist > BEAM_ALIGNMENT_TOLERANCE_M) continue;

      const overlap = overlapLengthAlongBeam(wall.start, wall.end, beam.startPoint, beam.endPoint);
      if (overlap < wallLengthM * MIN_OVERLAP_FRACTION) continue;

      if (maxDist < bestDistance) {
        bestDistance = maxDist;
        bestBeam = beam;
      }
    }

    if (bestBeam) {
      const existing = beamExtraIntensityY.get(bestBeam.elementId) ?? 0;
      beamExtraIntensityY.set(bestBeam.elementId, existing - weightPerMeterKNm); // negative — gravity
      continue;
    }

    // ---- Slab fallback (একই storyId এর মধ্যে, midpoint polygon-এর ভেতরে) ----
    const midpoint = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
    const matchingSlab = slabs.find(
      (slab) => slab.storyId === wall.storyId && isPointNearOrInsidePolygonXZ(midpoint, slab.vertices, SLAB_BOUNDARY_TOLERANCE_M)
    );

    if (matchingSlab) {
      const slabAreaM2 = computePolygonPlanArea(matchingSlab.vertices);
      if (slabAreaM2 > 0) {
        const extraIntensity = totalWeightKN / slabAreaM2;
        const existing = slabExtraIntensity.get(matchingSlab.elementId) ?? 0;
        slabExtraIntensity.set(matchingSlab.elementId, existing - extraIntensity); // negative — gravity
        continue;
      }
    }

    unmatchedCount++;
    warnings.push(
      `Wall ref "${wall.refId}" এর নিচে/along কোনো beam পাওয়া যায়নি, এবং একই story-তে কোনো slab-ও এর midpoint ধারণ করছে না — এই wall-এর self-weight (${totalWeightKN.toFixed(2)} kN) মডেলে যোগ হয়নি। ম্যানুয়ালি সংশ্লিষ্ট element এ যোগ করুন।`
    );
  }

  if (defaultUnitWeightUsedCount > 0) {
    warnings.push(
      `${defaultUnitWeightUsedCount}টা wall-এর materialLabel Material Library-র কোনো entry-র নামের সাথে মেলেনি — ডিফল্ট brick masonry একক ওজন (${DEFAULT_MASONRY_UNIT_WEIGHT_KNM3} kN/m³) ব্যবহার করা হয়েছে। সঠিক material হলে Material Library-তে ঠিক এই নামেই একটা entry যোগ করুন।`
    );
  }
  if (unmatchedCount > 0) {
    warnings.push(`মোট ${unmatchedCount}টা wall কোনো beam/slab এর সাথে match হয়নি — উপরে বিস্তারিত দেখুন।`);
  }

  return { beamExtraIntensityY, slabExtraIntensity, warnings };
}
