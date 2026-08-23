/**
 * RoofFloorSlabLayoutEWSheet — Phase 11h (S-15); bar overlay
 * Report-Audit Phase B7 (2026-08-20)
 *
 * TypicalFloorSlabLayoutEWSheet.tsx এর অভিন্ন প্যাটার্ন — roofStoryId
 * bucket, একই bar overlay logic (slabRebarOverlay.ts, "mesh-x" role)।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { SlabOutlineSketch, type SlabPolygon } from "@/lib/documentation/pdf/drawing-sheets/SlabOutlineSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { buildSlabRebarOverlay } from "@/lib/documentation/pdf/drawing-sheets/slabRebarOverlay";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface RoofFloorSlabLayoutEWSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function RoofFloorSlabLayoutEWSheetContent({ context, revisionNumber }: RoofFloorSlabLayoutEWSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const entry = SHEET_INDEX.find((s) => s.sheetNumber === "S-15");

  const { roofStoryId } = classifyStories(context.geometry);
  const roofSlabs = context.elements.filter(
    (e) =>
      e.category === "slab" &&
      roofStoryId !== null &&
      resolveElementStoryId(context.elements, e.elementId) === roofStoryId
  );

  const barsByElementId = buildSlabRebarOverlay(context, roofSlabs, "mesh-x");
  const hasAnyBars = Object.keys(barsByElementId).length > 0;

  const slabPolygons: SlabPolygon[] = roofSlabs
    .map<SlabPolygon | null>((e) => {
      const vertices = (e as unknown as { vertices?: { x: number; z: number }[] }).vertices;
      if (!vertices) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices, elementId: e.elementId };
    })
    .filter((s): s is SlabPolygon => s !== null);

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-15"
      sheetTitle="Roof Floor Slab Reinf. Layout Plan (E-W Direction)"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
        Roof Floor Slab Reinf. Layout Plan (E-W Direction)
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        {hasAnyBars
          ? "Bottom-layer bar run shown for slabs with a completed design (E-W = local X-axis direction). Slabs without a design result show outline only. Top/negative bars not shown here — see Calc Sheets / BBS."
          : entry?.limitationNote}
      </Text>
      {slabPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No roof-level slab elements with resolvable geometry found in the current model.
        </Text>
      ) : (
        <SlabOutlineSketch grids={context.geometry.grids} slabs={slabPolygons} barsByElementId={barsByElementId} />
      )}
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
        Slab openings (stair wells, duct/shaft/lift openings) are not a modeled attribute of Slab elements in this
        application (Report-Audit Phase B6, 2026-08-20 — verified: no opening field on SlabElement, and the Hub
        openings/shaftOpenings fields arrive as unresolved unknown data, not yet mapped to usable geometry). Any
        openings must be added manually to this drawing before issue.
      </Text>
    </ReportSheetPage>
  );
}

export function RoofFloorSlabLayoutEWSheet(props: RoofFloorSlabLayoutEWSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Roof Floor Slab Reinf. Layout Plan (E-W)`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <RoofFloorSlabLayoutEWSheetContent {...props} />
    </Document>
  );
}
