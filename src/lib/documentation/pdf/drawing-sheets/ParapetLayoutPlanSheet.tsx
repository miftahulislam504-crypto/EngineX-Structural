/**
 * ParapetLayoutPlanSheet — Report-Audit follow-up (S-25, 2026-08-24)
 *
 * WallLayoutPlanSheet.tsx (S-24) এর অভিন্ন কাঠামো ও একই কারণ —
 * ParapetElement ও Wall/ShearWall/CoreWall-এর মতোই AreaElement
 * (vertices, polygon — beam/column এর মতো startPoint/endPoint না),
 * তাই GridLayoutSketch সরাসরি reuse করার আগে vertices থেকে plan-view
 * centerline derive করতে হয় (mapParapet() হুবহু Wall-এর মতোই একটা
 * vertical rectangular plane বসায়, hub-geometry-parser.ts দেখুন — তাই
 * এই derivation logic নিরাপদে অভিন্ন)।
 *
 * এই sheet মূল ২০-এন্ট্রি MICON reference set-এর বাইরে (Wall-এর S-24
 * এর মতোই — original reference set-এ কোনো Parapet sheet ছিল না)।
 * Parapet Draw থেকে এখন (Audit Gap Closure Phase 5 item 16 এর
 * Structural-দিক বাস্তবায়ন) Hub-এ export হয় ও mapParapet() দিয়ে parse
 * হয়, কিন্তু এই sheet তৈরির আগে সেই geometry কোনো drawing-এ দেখানো
 * হতো না — শুধু self-weight/dead-load-এ ব্যবহৃত হতো
 * (deriveAreaSelfWeightLoads.ts)।
 *
 * quantitySummary.ts-এর "wall-এর জন্য কোনো general 3D area calculator
 * নেই" সীমাবদ্ধতা এখানেও প্রযোজ্য (একই AreaElement ভিত্তি) — এখানে
 * কোনো AREA (m²) calculate করা হচ্ছে না, শুধু plan-view centerline
 * position (m), vertices-এর min/max XZ থেকে সরাসরি বের করা।
 *
 * শুধু non-degenerate parapet (XZ প্রক্ষেপণে দৈর্ঘ্য > 0) প্লট করা
 * হয় — degenerate case-এ "not shown" note সহ বাদ দেওয়া হয়।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { StructuralElement } from "@/lib/types/element";

export interface ParapetLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

const PARAPET_CATEGORIES = new Set(["parapet"]);

/** Parapet vertices থেকে plan-view centerline (XZ extreme points) বের করে, degenerate হলে null — WallLayoutPlanSheet.tsx এর deriveWallCenterline() এর হুবহু একই যুক্তি। */
function deriveParapetCenterline(vertices: { x: number; y: number; z: number }[]): { x: number; z: number }[] | null {
  if (vertices.length < 2) return null;
  let minPoint = vertices[0];
  let maxPoint = vertices[0];
  let maxDistSq = 0;
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
  if (maxDistSq < 1e-6) return null; // XZ প্রক্ষেপণে দৈর্ঘ্য ~0 — degenerate (zero-length parapet run)
  return [
    { x: minPoint.x, z: minPoint.z },
    { x: maxPoint.x, z: maxPoint.z },
  ];
}

export function ParapetLayoutPlanSheetContent({ context, revisionNumber }: ParapetLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const parapetElementsRaw = context.elements.filter((e) => PARAPET_CATEGORIES.has(e.category));

  let skippedDegenerate = 0;
  const parapetElements: PlanLineElement[] = parapetElementsRaw
    .map((e): PlanLineElement | null => {
      const vertices = (e as unknown as { vertices?: { x: number; y: number; z: number }[] }).vertices;
      if (!vertices) return null;
      const centerline = deriveParapetCenterline(vertices);
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
      sheetNumber="S-25"
      sheetTitle="Parapet Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Parapet Layout Plan
      </Text>
      {parapetElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No parapet elements with a resolvable plan-view centerline found in the current model.
        </Text>
      ) : (
        <GridLayoutSketch grids={context.geometry.grids} elements={parapetElements} />
      )}
      {skippedDegenerate > 0 && (
        <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
          {skippedDegenerate} parapet element(s) skipped — their plan-view projection was degenerate (zero
          length), so no centerline could be safely derived.
        </Text>
      )}
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
        Parapets are shown as a single centerline (the two farthest-apart vertices in plan view) — this
        application does not have a general 3D vertical-plane area renderer, so parapet thickness/elevation
        extent is not drawn here. Parapet base elevation (height above the roof/floor level) is not shown on
        this plan — see the element&apos;s own data for elevation and height. This application does not run a
        dedicated structural design check on parapets (no wind/seismic guard-rail check); parapet self-weight
        is included in the building&apos;s dead load only (see deriveAreaSelfWeightLoads.ts).
      </Text>
    </ReportSheetPage>
  );
}

export function ParapetLayoutPlanSheet(props: ParapetLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Parapet Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ParapetLayoutPlanSheetContent {...props} />
    </Document>
  );
}
