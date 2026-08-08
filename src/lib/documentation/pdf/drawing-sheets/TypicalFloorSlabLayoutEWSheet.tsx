/**
 * TypicalFloorSlabLayoutEWSheet — Phase 11h (S-10)
 *
 * SlabOutlineSketch.tsx ব্যবহার করে — slab category element গুলোর
 * vertices (quantitySummary.ts থেকে কনফার্ম) থেকে outline। typicalStoryIds
 * bucket (storyClassification.ts) দিয়ে ফ্লোর ফিল্টার। E-W/N-S bar-direction
 * split এই data model এ নেই (sheetIndex.ts S-10 limitationNote) — তাই
 * caption এ স্পষ্ট বলা আছে।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { SlabOutlineSketch, type SlabPolygon } from "@/lib/documentation/pdf/drawing-sheets/SlabOutlineSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface TypicalFloorSlabLayoutEWSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function TypicalFloorSlabLayoutEWSheetContent({ context, revisionNumber }: TypicalFloorSlabLayoutEWSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const entry = SHEET_INDEX.find((s) => s.sheetNumber === "S-10");

  const { typicalStoryIds } = classifyStories(context.geometry);
  const typicalSlabs = context.elements.filter(
    (e) =>
      e.category === "slab" &&
      typicalStoryIds.includes(resolveElementStoryId(context.designResults, e.elementId) ?? "")
  );

  const slabPolygons: SlabPolygon[] = typicalSlabs
    .map((e) => {
      const vertices = (e as unknown as { vertices?: { x: number; z: number }[] }).vertices;
      if (!vertices) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices };
    })
    .filter((s): s is SlabPolygon => s !== null);

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-10"
      sheetTitle="Typical Floor Slab Reinf. Layout Plan (E-W Direction)"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
        Typical Floor Slab Reinf. Layout Plan (E-W Direction)
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        {entry?.limitationNote}
      </Text>
      {slabPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No typical-floor slab elements with resolvable geometry found in the current model.
        </Text>
      ) : (
        <SlabOutlineSketch grids={context.geometry.grids} slabs={slabPolygons} />
      )}
    </ReportSheetPage>
  );
}

export function TypicalFloorSlabLayoutEWSheet(props: TypicalFloorSlabLayoutEWSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Typical Floor Slab Reinf. Layout Plan (E-W)`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <TypicalFloorSlabLayoutEWSheetContent {...props} />
    </Document>
  );
}
