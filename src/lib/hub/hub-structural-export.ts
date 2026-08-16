// src/lib/hub/hub-structural-export.ts
//
// Structural -> Hub: this app's counterpart to EngineXDraw's
// publishArchitecturalToHub() (hub-write.ts in the Draw repo). Assembles
// this app's own model (elements + sections + stories, already fetched
// by reportContext.ts's fetch helpers — reused directly here rather than
// pulling in the full ReportContext, since loads/analysis/detailing
// results beyond BBS are not needed for a quantity export) into the
// per-floor raw-dimension shape Estimate's quantity-takeoff.types.ts
// expects (StructuralFloorQuantities[]), and pushes it as this app's
// 'structural' moduleData via saveOwnModuleData() (hub-sdk-client.ts).
//
// ⚠️ Contract note: Estimate's lib/types/quantity-takeoff.types.ts is
// explicitly marked as a *proposed, not-yet-finalized* contract (see that
// file's header comment) — this assembler targets that proposal exactly
// (field names, ft units, per-floor grouping). If that contract changes
// on Estimate's side, this file needs a matching update.
//
// Units: this app's own model stores element coordinates in metres
// (StructuralStory.elevation/height, Point3D) and section/footing/slab
// dimensions in millimetres (see element.ts/section.ts). Estimate's
// contract wants feet (BNBC-era convention, per that file's comment).
// Conversion happens once here, at the boundary — internal calculation
// files (quantitySummary.ts etc.) keep working in mm/m/m³ untouched.
//
// What is NOT sent, and why (raw-dimension policy — Estimate computes
// volume itself, this file must not silently guess):
//   - combined-footing / strip-footing: plan width/length is a sizing-
//     calculation output, not persisted on the element (see element.ts's
//     CombinedFootingElement comment) — until DesignResult.detail
//     persistence exists (reportContext.ts's known gap), these elements
//     are skipped, not sent with a fabricated width/length.
//   - wall / shear-wall / core-wall: no volume/dimension figure this
//     contract can use (StructuralFloorQuantities has no wall bucket) —
//     skipped.
//   - pile / pile-cap / pile-group / brace: out of this contract's scope
//     (StructuralFloorQuantities only has footings/columns/beams/slabs).
//   - stairQuantity: this app has no "stair" ElementCategory (stairs are
//     modelled architecturally, in Draw, not structurally here) — always
//     sent as 0. Left as an explicit field (not omitted) so Estimate's
//     validator doesn't flag it as a missing required field; the 0 is a
//     real "we don't produce this" signal, not a placeholder guess.

import { fetchAllElements } from "@/lib/elements/firestore";
import { fetchGeometryCore } from "@/lib/geometry/firestore";
import { fetchSectionLibrary } from "@/lib/library/firestore";
import { fetchAllDetailingResults } from "@/lib/detailing/firestore";
import type { StructuralElement, ElementCategory, FootingElement, SlabElement } from "@/lib/types/element";
import { computeLineElementLength } from "@/lib/types/element";
import type { RectangularSection, CircularSection, StructuralSection } from "@/lib/types/section";
import type { StructuralStory } from "@/lib/types/geometry";
import {
  computeRebarUnitWeightKgPerM,
  type BbsEntry,
} from "@/lib/design/barBendingSchedule";
import type { BarScheduleRow } from "@/lib/detailing/types";
import { bumpOwnModuleVersion, saveOwnModuleData, getModuleVersion, linkOwnDependency, emitEvent } from "./hub-sdk-client";

const MM_PER_FT = 304.8;
const M_PER_FT = 0.3048;

function mmToFt(mm: number): number {
  return mm / MM_PER_FT;
}
function mToFt(m: number): number {
  return m / M_PER_FT;
}

/** Estimate-এর StructuralElementDimensions shape, this file local (avoids a cross-repo type import — this app and Estimate are separate deployments, exactly like Draw does not import Estimate's types either). */
interface ExportedElementDimensions {
  elementId: string;
  lengthFt: number;
  widthFt: number;
  depthFt: number;
  count: number;
}

interface ExportedFloorQuantities {
  floorId: string;
  floorLabel: string;
  footings: ExportedElementDimensions[];
  columns: ExportedElementDimensions[];
  beams: ExportedElementDimensions[];
  slabs: ExportedElementDimensions[];
  stairQuantity: number;
  reinforcementQuantityKg: number;
}

function sectionDims(section: StructuralSection | undefined): { widthMm: number; depthMm: number } | null {
  if (!section) return null;
  if (section.shape === "rectangular") {
    const s = section as RectangularSection;
    return { widthMm: s.width, depthMm: s.depth };
  }
  if (section.shape === "circular") {
    const s = section as CircularSection;
    return { widthMm: s.diameter, depthMm: s.diameter };
  }
  // w-shape/hss/etc — steel sections, not used for beam/column concrete
  // quantity in this app today (see quantitySummary.ts's same scope note).
  return null;
}

/**
 * Same dimension → group-by-size collapsing Estimate's contract expects
 * (StructuralElementDimensions.count — "কতগুলো একই dimension-এর
 * element" — see quantity-takeoff.types.ts's comment). Groups elements
 * within one floor+category by (lengthFt, widthFt, depthFt) rounded to
 * 2 decimal places, so near-identical engineering dimensions collapse
 * into one row instead of one row per element (e.g. 20 identical
 * interior columns become one row with count=20, not 20 rows of count=1).
 */
function groupByDimension(
  rows: { elementId: string; lengthFt: number; widthFt: number; depthFt: number }[]
): ExportedElementDimensions[] {
  const key = (r: { lengthFt: number; widthFt: number; depthFt: number }) =>
    `${r.lengthFt.toFixed(2)}::${r.widthFt.toFixed(2)}::${r.depthFt.toFixed(2)}`;

  const groups = new Map<string, ExportedElementDimensions>();
  for (const r of rows) {
    const k = key(r);
    const existing = groups.get(k);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(k, {
        elementId: r.elementId, // first element in the group represents it (grid-label-style id, e.g. "C1")
        lengthFt: r.lengthFt,
        widthFt: r.widthFt,
        depthFt: r.depthFt,
        count: 1,
      });
    }
  }
  return Array.from(groups.values());
}

function barScheduleRowToBbsEntry(row: BarScheduleRow, elementLabel: string): BbsEntry {
  const unitWeightKgPerM = computeRebarUnitWeightKgPerM(row.diameterMm);
  const totalLengthM = row.totalLengthMm / 1000;
  return {
    barMark: row.barMark,
    elementLabel,
    shapeType: row.shape === "straight" ? "straight" : "stirrup-tie",
    barDiameterMm: row.diameterMm,
    count: row.count,
    cutLengthMm: row.cutLengthMm,
    totalLengthM,
    unitWeightKgPerM,
    totalWeightKg: totalLengthM * unitWeightKgPerM,
  };
}

interface AssembleResult {
  floors: ExportedFloorQuantities[];
  skippedElementCount: number;
  skippedCategories: ElementCategory[];
}

/**
 * এই app-এর নিজস্ব model (elements + sections + stories + detailing
 * results) fetch করে floor-ভিত্তিক StructuralFloorQuantities[] বানায়।
 * storyId না থাকা element (স্বাভাবিক কিছু element কোনো story-র না হয়ে
 * base-এ থাকতে পারে, দেখুন element.ts এর BaseElement.storyId কমেন্ট)
 * একটা synthetic "unassigned" floor bucket-এ যায়, বাদ দেওয়া হয় না —
 * নাহলে সেই element এর quantity নীরবে হারিয়ে যেত।
 */
export async function assembleStructuralFloorQuantities(projectId: string): Promise<AssembleResult> {
  const [elements, geometry, sectionLibrary, detailingResults] = await Promise.all([
    fetchAllElements(projectId),
    fetchGeometryCore(projectId),
    fetchSectionLibrary(projectId),
    fetchAllDetailingResults(projectId),
  ]);

  const sections = sectionLibrary.sections;
  const stories = geometry.stories;

  // storyId -> elementId[] এর reinforcement lookup বানানোর জন্য elementId -> storyId map
  const elementStoryMap = new Map<string, string | undefined>();
  for (const el of elements) elementStoryMap.set(el.elementId, el.storyId);

  // reinforcement: detailingResults.schedule -> BbsEntry -> storyId অনুযায়ী group করে totalWeightKg যোগ
  const reinforcementByFloor = new Map<string, number>();
  const UNASSIGNED = "__unassigned__";
  for (const detailing of detailingResults) {
    const storyId = elementStoryMap.get(detailing.elementId) ?? UNASSIGNED;
    const entries = detailing.schedule.map((row) => barScheduleRowToBbsEntry(row, detailing.elementLabel));
    const weight = entries.reduce((sum, e) => sum + e.totalWeightKg, 0);
    reinforcementByFloor.set(storyId, (reinforcementByFloor.get(storyId) ?? 0) + weight);
  }

  const byFloor = new Map<
    string,
    {
      footings: { elementId: string; lengthFt: number; widthFt: number; depthFt: number }[];
      columns: { elementId: string; lengthFt: number; widthFt: number; depthFt: number }[];
      beams: { elementId: string; lengthFt: number; widthFt: number; depthFt: number }[];
      slabs: { elementId: string; lengthFt: number; widthFt: number; depthFt: number }[];
    }
  >();
  const ensureFloor = (storyId: string) => {
    let bucket = byFloor.get(storyId);
    if (!bucket) {
      bucket = { footings: [], columns: [], beams: [], slabs: [] };
      byFloor.set(storyId, bucket);
    }
    return bucket;
  };

  const skippedCategories = new Set<ElementCategory>();
  let skippedElementCount = 0;

  for (const element of elements) {
    const storyId = element.storyId ?? UNASSIGNED;
    const bucket = ensureFloor(storyId);

    switch (element.category) {
      case "beam":
      case "column": {
        const section = sections.find((s) => s.sectionId === element.sectionId);
        const dims = sectionDims(section);
        if (!dims) {
          skippedCategories.add(element.category);
          skippedElementCount += 1;
          continue;
        }
        const lengthM = computeLineElementLength(element);
        const row = {
          elementId: element.label,
          lengthFt: mToFt(lengthM),
          widthFt: mmToFt(dims.widthMm),
          depthFt: mmToFt(dims.depthMm),
        };
        (element.category === "beam" ? bucket.beams : bucket.columns).push(row);
        break;
      }
      case "slab": {
        const slab = element as SlabElement;
        // slab-এর কোনো single length/width নেই (arbitrary polygon) — bounding-box
        // approximation ব্যবহার করা হলো (min/max X, min/max Z), thickness আসল depth।
        // এটা প্রকৃত polygon area-কে exactly represent করে না অনিয়মিত shape-এ, কিন্তু
        // Estimate-এর StructuralElementDimensions contract length×width×count ছাড়া
        // polygon vertices নেয় না (raw-dimension policy — ওপরের file comment)।
        const xs = slab.vertices.map((v) => v.x);
        const zs = slab.vertices.map((v) => v.z);
        const widthM = Math.max(...xs) - Math.min(...xs);
        const lengthM = Math.max(...zs) - Math.min(...zs);
        bucket.slabs.push({
          elementId: element.label,
          lengthFt: mToFt(lengthM),
          widthFt: mToFt(widthM),
          depthFt: mmToFt(slab.thickness),
        });
        break;
      }
      case "footing": {
        const footing = element as FootingElement;
        bucket.footings.push({
          elementId: element.label,
          lengthFt: mmToFt(footing.length),
          widthFt: mmToFt(footing.width),
          depthFt: mmToFt(footing.thickness),
        });
        break;
      }
      default:
        // combined-footing/strip-footing/mat-foundation/wall/shear-wall/
        // core-wall/brace/pile/pile-cap/pile-group — see file header for why.
        skippedCategories.add(element.category);
        skippedElementCount += 1;
    }
  }

  const floors: ExportedFloorQuantities[] = [];
  for (const [storyId, bucket] of byFloor.entries()) {
    const story: StructuralStory | undefined = stories.find((s) => s.storyId === storyId);
    floors.push({
      floorId: storyId === UNASSIGNED ? "unassigned" : storyId,
      floorLabel: story?.name ?? (storyId === UNASSIGNED ? "Unassigned (no story link)" : storyId),
      footings: groupByDimension(bucket.footings),
      columns: groupByDimension(bucket.columns),
      beams: groupByDimension(bucket.beams),
      slabs: groupByDimension(bucket.slabs),
      stairQuantity: 0, // এই app stair model করে না — Draw (Architectural)-এর দায়িত্ব, দেখুন file header
      reinforcementQuantityKg: reinforcementByFloor.get(storyId) ?? 0,
    });
  }

  // deterministic order — story.order থাকলে সেটা দিয়ে sort, unassigned সবার শেষে
  floors.sort((a, b) => {
    if (a.floorId === "unassigned") return 1;
    if (b.floorId === "unassigned") return -1;
    const sa = stories.find((s) => s.storyId === a.floorId)?.order ?? 0;
    const sb = stories.find((s) => s.storyId === b.floorId)?.order ?? 0;
    return sa - sb;
  });

  return { floors, skippedElementCount, skippedCategories: Array.from(skippedCategories) };
}

/**
 * Draw-এর publishArchitecturalToHub() এর ঠিক একই প্যাটার্নে: assemble ->
 * version bump -> saveOwnModuleData() -> best-effort dependency link ->
 * best-effort event emit। এই app-এর upstream dependency architectural
 * (geometry synchronize করা থাকলে) — best-effort, না থাকলে publish
 * ব্লক হবে না।
 */
export async function publishStructuralToHub(
  projectId: string,
): Promise<{ success: true; moduleVersion: number; skippedElementCount: number } | { success: false; error: string }> {
  try {
    const { floors, skippedElementCount, skippedCategories } = await assembleStructuralFloorQuantities(projectId);

    const data: Record<string, unknown> = {
      structuralFloors: floors,
      skippedElementCount,
      skippedCategories,
    };

    const newVersion = await bumpOwnModuleVersion(projectId);
    await saveOwnModuleData(projectId, data, newVersion);

    try {
      const architecturalVersion = await getModuleVersion(projectId, "architectural");
      if (architecturalVersion) {
        await linkOwnDependency(
          projectId,
          "architectural",
          architecturalVersion.currentVersion,
          "Structural quantities exported alongside this architectural model snapshot",
        );
      }
    } catch {
      /* non-critical */
    }

    try {
      await emitEvent(projectId, "MODULE_VERSION_BUMPED", {
        moduleId: "structural",
        floorCount: floors.length,
        skippedElementCount,
      });
    } catch {
      /* non-critical — bumpOwnModuleVersion() itself already emits this */
    }

    return { success: true, moduleVersion: newVersion, skippedElementCount };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
