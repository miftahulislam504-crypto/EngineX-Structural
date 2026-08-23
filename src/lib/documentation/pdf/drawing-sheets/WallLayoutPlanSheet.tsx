/**
 * WallLayoutPlanSheet — Report-Audit Phase B1 (S-24, 2026-08-20)
 *
 * Column Layout Plan (S-02) এর অভিন্ন কাঠামো (GridLayoutSketch.tsx),
 * কিন্তু Wall element এর geometry ভিন্ন (vertices, polygon — beam/column
 * এর মতো startPoint/endPoint না) — তাই সরাসরি reuse সম্ভব না।
 *
 * সমাধান — GridLayoutSketch একই component ব্যবহার করা হলো, কিন্তু Wall
 * element কে pass করার আগে তার vertices থেকে plan-view centerline
 * derive করা হয় (XZ projection এর extreme দুই point — একটা সোজা
 * vertical wall উপর থেকে দেখলে একটা line-ই দেখাবে, তাই এটা কোনো area
 * calculation invent করছে না, শুধু plan-view এ যা visually সত্যি তাই
 * বের করছে) এবং সেটা synthetic startPoint/endPoint হিসেবে element এ
 * inject করা হয় (GridLayoutSketch এর নিজস্ব `as unknown as
 * {startPoint, endPoint}` defensive cast এর সাথে সামঞ্জস্যপূর্ণ)।
 *
 * এটা quantitySummary.ts এর "wall এর জন্য কোনো general 3D area
 * calculator নেই" সীমাবদ্ধতা লঙ্ঘন করে না — এখানে কোনো AREA (m²)
 * calculate করা হচ্ছে না, শুধু plan-view centerline position (m),
 * যা vertices এর min/max XZ থেকে সরাসরি, নিরাপদে বের করা যায় কোনো
 * plane-orientation ধরে না নিয়েই।
 *
 * শুধু non-degenerate wall (XZ প্রক্ষেপণে দৈর্ঘ্য > 0, অর্থাৎ pure-
 * vertical বা zero-length না) প্লট করা হয় — degenerate case এ "not
 * shown" note সহ বাদ দেওয়া হয়, চুপচাপ ভুল line আঁকা হয় না।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { StructuralElement } from "@/lib/types/element";

export interface WallLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

const WALL_CATEGORIES = new Set(["wall", "shear-wall", "core-wall"]);

/** Wall vertices থেকে plan-view centerline (XZ extreme points) বের করে, degenerate হলে null। */
function deriveWallCenterline(vertices: { x: number; y: number; z: number }[]): { x: number; z: number }[] | null {
  if (vertices.length < 2) return null;
  let minPoint = vertices[0];
  let maxPoint = vertices[0];
  let maxDistSq = 0;
  // সব জোড়া তুলনা করে XZ প্লেনে সবচেয়ে দূরের দুই vertex বের করা —
  // wall যদি সোজা vertical polygon হয় (সাধারণ কেস), এই দুই point-ই
  // মূল centerline এর দুই প্রান্ত।
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const dx = vertices[i].x - vertices[j].x;
      const dz = vertices[i].z - vertices[j].z;
      const distSq = dx * dx + dz * dz;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        minPoint = vertices[i];
        maxPoint = vertices[j];
      }
    }
  }
  if (maxDistSq < 1e-6) return null; // XZ প্রক্ষেপণে দৈর্ঘ্য ~0 — degenerate (pure vertical বা zero-length wall)
  return [
    { x: minPoint.x, z: minPoint.z },
    { x: maxPoint.x, z: maxPoint.z },
  ];
}

export function WallLayoutPlanSheetContent({ context, revisionNumber }: WallLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const wallElementsRaw = context.elements.filter((e) => WALL_CATEGORIES.has(e.category));

  let skippedDegenerate = 0;
  const wallElements: PlanLineElement[] = wallElementsRaw
    .map((e): PlanLineElement | null => {
      const vertices = (e as unknown as { vertices?: { x: number; y: number; z: number }[] }).vertices;
      if (!vertices) return null;
      const centerline = deriveWallCenterline(vertices);
      if (!centerline) {
        skippedDegenerate++;
        return null;
      }
      const syntheticElement = {
        ...e,
        startPoint: { x: centerline[0].x, y: 0, z: centerline[0].z },
        endPoint: { x: centerline[1].x, y: 0, z: centerline[1].z },
      } as unknown as StructuralElement;
      return { element: syntheticElement, label: resolveElementLabel(context, e.elementId), isColumn: false };
    })
    .filter((x): x is PlanLineElement => x !== null);

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-24"
      sheetTitle="Wall / Shear Wall Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Wall / Shear Wall Layout Plan
      </Text>
      {wallElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No wall/shear-wall elements with a resolvable plan-view centerline found in the current model.
        </Text>
      ) : (
        <GridLayoutSketch grids={context.geometry.grids} elements={wallElements} />
      )}
      {skippedDegenerate > 0 && (
        <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
          {skippedDegenerate} wall element(s) skipped — their plan-view projection was degenerate (zero length),
          so no centerline could be safely derived.
        </Text>
      )}
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
        Walls are shown as a single centerline (the two farthest-apart vertices in plan view) — this application
        does not have a general 3D vertical-plane area renderer, so wall thickness/elevation extent is not drawn
        here (see Wall Calc Sheet for thickness and design details).
      </Text>
    </ReportSheetPage>
  );
}

export function WallLayoutPlanSheet(props: WallLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Wall / Shear Wall Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <WallLayoutPlanSheetContent {...props} />
    </Document>
  );
}
