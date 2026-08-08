/**
 * RoofFloorSlabLayoutNSSheet — Phase 11h (S-16)
 *
 * RoofFloorSlabLayoutEWSheet.tsx এর অভিন্ন প্যাটার্ন — শুধু sheet
 * number/title/direction ভিন্ন।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { SlabOutlineSketch, type SlabPolygon } from "@/lib/documentation/pdf/drawing-sheets/SlabOutlineSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface RoofFloorSlabLayoutNSSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function RoofFloorSlabLayoutNSSheetContent({ context, revisionNumber }: RoofFloorSlabLayoutNSSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const entry = SHEET_INDEX.find((s) => s.sheetNumber === "S-16");

  const { roofStoryId } = classifyStories(context.geometry);
  const roofSlabs = context.elements.filter(
    (e) =>
      e.category === "slab" &&
      roofStoryId !== null &&
      resolveElementStoryId(context.elements, e.elementId) === roofStoryId
  );

  const slabPolygons: SlabPolygon[] = roofSlabs
    .map((e) => {
      const vertices = (e as unknown as { vertices?: { x: number; z: number }[] }).vertices;
      if (!vertices) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices };
    })
    .filter((s): s is SlabPolygon => s !== null);

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-16"
      sheetTitle="Roof Floor Slab Reinf. Layout Plan (N-S Direction)"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
        Roof Floor Slab Reinf. Layout Plan (N-S Direction)
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        {entry?.limitationNote}
      </Text>
      {slabPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No roof-level slab elements with resolvable geometry found in the current model.
        </Text>
      ) : (
        <SlabOutlineSketch grids={context.geometry.grids} slabs={slabPolygons} />
      )}
    </ReportSheetPage>
  );
}

export function RoofFloorSlabLayoutNSSheet(props: RoofFloorSlabLayoutNSSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Roof Floor Slab Reinf. Layout Plan (N-S)`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <RoofFloorSlabLayoutNSSheetContent {...props} />
    </Document>
  );
}
