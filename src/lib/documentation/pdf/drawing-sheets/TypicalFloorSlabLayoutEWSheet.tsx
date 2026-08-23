/**
 * TypicalFloorSlabLayoutEWSheet — Phase 11h (S-10); bar overlay
 * Report-Audit Phase B7 (2026-08-20)
 *
 * SlabOutlineSketch.tsx ব্যবহার করে — slab category element গুলোর
 * vertices (quantitySummary.ts থেকে কনফার্ম) থেকে outline। typicalStoryIds
 * bucket (storyClassification.ts) দিয়ে ফ্লোর ফিল্টার। E-W bar-direction
 * overlay এখন slabRebarOverlay.ts (generateSlabDetailing() reuse করে)
 * থেকে আসে — design result থাকা slab এর জন্য individual bottom-mesh
 * bar run দেখায় (local X-axis বরাবর, "mesh-x" role, sheet convention
 * অনুযায়ী "E-W" নামে)। design result না থাকা slab এর জন্য honest
 * fallback — শুধু outline (আগের behavior)।
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
      typicalStoryIds.includes(resolveElementStoryId(context.elements, e.elementId) ?? "")
  );

  const barsByElementId = buildSlabRebarOverlay(context, typicalSlabs, "mesh-x");
  const hasAnyBars = Object.keys(barsByElementId).length > 0;

  const slabPolygons: SlabPolygon[] = typicalSlabs
    .map<SlabPolygon | null>((e) => {
      const vertices = (e as unknown as { vertices?: { x: number; z: number }[] }).vertices;
      if (!vertices) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices, elementId: e.elementId };
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
        {hasAnyBars
          ? "Bottom-layer bar run shown for slabs with a completed design (E-W = local X-axis direction). Slabs without a design result show outline only. Top/negative bars not shown here — see Calc Sheets / BBS."
          : entry?.limitationNote}
      </Text>
      {slabPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No typical-floor slab elements with resolvable geometry found in the current model.
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
