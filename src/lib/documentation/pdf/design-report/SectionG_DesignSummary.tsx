/**
 * Sections G1-G5 — Design Summary (Phase 11c)
 *
 * প্লানের চাহিদা প্রতিটা সাব-সেকশনে একটা টেবিল, কলাম ভিন্ন হলেও কাঠামো
 * এক: element ID, geometry, governing demand, final reinforcement,
 * checks, utilization ratio। তাই একটাই generic component
 * (DesignSummaryTable) — category filter আর column label ভিন্ন করে
 * G1-G5 পাঁচবার ব্যবহার করা হয়েছে, প্রতিটার জন্য আলাদা কম্পোনেন্ট
 * কপি-পেস্ট না করে।
 *
 * গুরুত্বপূর্ণ, সততার সাথে জানানো দরকার (Phase 11a থেকেই flag করা
 * গ্যাপ, এখানে সরাসরি প্রভাব ফেলছে): context.designResults বর্তমানে
 * সবসময় খালি array হবে, যতক্ষণ না design panel গুলো
 * persistDesignResult() (design/firestore.ts) কল করা শুরু করে। তাই
 * প্রতিটা G-সেকশন একটা explicit "No design results recorded yet"
 * বার্তা দেখায় যখন সংশ্লিষ্ট category তে কোনো DesignResult নেই —
 * খালি টেবিল হেডার-অনলি রেখে চুপচাপ বিভ্রান্ত করার বদলে।
 *
 * "span, size (b×D)" (G1 Beam) এর মতো জ্যামিতিক ডিটেইল — এগুলো
 * StructuralElement (sectionId → SectionLibrary) থেকে ক্রস-রেফারেন্স
 * করে বসানো হয়েছে, DesignResult এ ডুপ্লিকেট না করে।
 */

import { Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { StatusBadge, mapDesignStatus } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { DesignResult, DesignElementCategory } from "@/lib/design/firestore";
import { computeLineElementLength, type StructuralElement } from "@/lib/types/element";
import type { RectangularSection } from "@/lib/types/section";

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  emptyNote: {
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
});

interface SummaryRow {
  result: DesignResult;
  element: StructuralElement | undefined;
}

function buildRows(context: ReportContext, categories: DesignElementCategory[]): SummaryRow[] {
  return context.designResults
    .filter((r) => categories.includes(r.elementCategory))
    .map((result) => ({
      result,
      element: context.elements.find((e) => e.elementId === result.elementId),
    }));
}

function sizeLabel(element: StructuralElement | undefined, sections: ReportContext["sections"]): string {
  if (!element) return "—";
  if (element.category === "beam" || element.category === "column") {
    const section = sections.sections.find((s) => s.sectionId === element.sectionId);
    if (section?.shape === "rectangular") {
      const r = section as RectangularSection;
      return `${r.width}×${r.depth} mm`;
    }
    return section?.name ?? "—";
  }
  if (element.category === "slab" || element.category === "wall") {
    return `t = ${element.thickness} mm`;
  }
  if (element.category === "footing") {
    return `${element.width}×${element.length}×${element.thickness} mm`;
  }
  return "—";
}

function spanOrHeightLabel(element: StructuralElement | undefined): string {
  if (!element) return "—";
  if (element.category === "beam" || element.category === "column") {
    return `${computeLineElementLength(element).toFixed(2)} m`;
  }
  return "—";
}

interface DesignSummarySectionProps {
  context: ReportContext;
  code: string;
  title: string;
  categories: DesignElementCategory[];
  extraColumns?: ReportTableColumn<SummaryRow>[];
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function DesignSummarySection({
  context,
  code,
  title,
  categories,
  extraColumns = [],
  revisionNumber,
}: DesignSummarySectionProps) {
  const rows = buildRows(context, categories);
  const project = context.hub?.projectInfo ?? null;

  const baseColumns: ReportTableColumn<SummaryRow>[] = [
    {
      key: "elementLabel",
      header: "ID",
      flex: 1,
      render: (row) => <Text>{row.result.elementLabel}</Text>,
    },
    {
      key: "span",
      header: "Span / Height",
      flex: 1,
      render: (row) => <Text>{spanOrHeightLabel(row.element)}</Text>,
    },
    {
      key: "size",
      header: "Size",
      flex: 1,
      render: (row) => <Text>{sizeLabel(row.element, context.sections)}</Text>,
    },
    {
      key: "reinforcement",
      header: "Reinforcement",
      flex: 2,
      render: (row) => <Text>{row.result.finalReinforcementSummary ?? "—"}</Text>,
    },
    {
      key: "utilization",
      header: "Utilization",
      flex: 1,
      align: "right",
      render: (row) => <Text>{row.result.utilizationRatio?.toFixed(2) ?? "—"}</Text>,
    },
    {
      key: "status",
      header: "Status",
      flex: 1,
      render: (row) => <StatusBadge kind={mapDesignStatus(row.result.status)} />,
    },
  ];

  return (
    <ReportPage
      footerLabel={`Structural Design Report — Section ${code}: ${title}`}
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: `DR-${code}`,
        sheetTitle: `Design Report — Section ${code}: ${title}`,
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>
        {code}. {title}
      </Text>
      {rows.length > 0 ? (
        <ReportTable<SummaryRow> columns={[...baseColumns, ...extraColumns]} rows={rows} />
      ) : (
        <Text style={styles.emptyNote}>
          No design results recorded yet for this element category. Run and save design checks in
          the Design panel to populate this section.
        </Text>
      )}
    </ReportPage>
  );
}

export function BeamDesignSummary({ context, revisionNumber }: { context: ReportContext; revisionNumber: string }) {
  // "steel-beam" এখানে ছিল, কিন্তু StructuralElement এর category union এ
  // "steel-beam" নামে কোনো ভ্যারিয়েন্ট নেই — RC আর steel beam দুটোই
  // category: "beam" (element.ts, SteelBeamDesignPanel.tsx এর
  // persistDesignResult() কলও elementCategory: "beam" পাঠায়, দেখুন
  // সেই প্যানেলের কোড)। ডিজাইন মেথড (RC vs AISC) ভিন্ন হলেও
  // elementCategory দিয়ে সেই পার্থক্য filter করা এই স্কিমায় সম্ভব না,
  // তাই এখানে শুধু আসল category রাখা হলো।
  return (
    <DesignSummarySection
      context={context}
      code="G1"
      title="Beam Design Summary"
      categories={["beam"]}
      revisionNumber={revisionNumber}
    />
  );
}

export function ColumnDesignSummary({ context, revisionNumber }: { context: ReportContext; revisionNumber: string }) {
  // উপরের BeamDesignSummary এর কমেন্ট দেখুন — একই কারণে "steel-column"
  // এখানে বাদ দেওয়া হলো।
  return (
    <DesignSummarySection
      context={context}
      code="G2"
      title="Column Design Summary"
      categories={["column"]}
      revisionNumber={revisionNumber}
    />
  );
}

export function SlabDesignSummary({ context, revisionNumber }: { context: ReportContext; revisionNumber: string }) {
  return (
    <DesignSummarySection
      context={context}
      code="G3"
      title="Slab Design Summary"
      categories={["slab"]}
      revisionNumber={revisionNumber}
    />
  );
}

/** প্লান অনুযায়ী "যদি থাকে" — কোনো wall/shear-wall element না থাকলে এই সেকশন সম্পূর্ণ বাদ দেওয়া উচিত (composeSections এ চেক হয়), কিন্তু এখানেও element না থাকলে graceful খালি-বার্তা দেখায় যদি সরাসরি কল হয়। */
export function WallDesignSummary({ context, revisionNumber }: { context: ReportContext; revisionNumber: string }) {
  return (
    <DesignSummarySection
      context={context}
      code="G4"
      title="Wall / Shear Wall Design Summary"
      categories={["wall", "shear-wall"]}
      revisionNumber={revisionNumber}
    />
  );
}

export function FoundationDesignSummary({ context, revisionNumber }: { context: ReportContext; revisionNumber: string }) {
  return (
    <DesignSummarySection
      context={context}
      code="G5"
      title="Foundation Design Summary"
      categories={["footing", "combined-footing", "strip-footing", "mat-foundation", "pile-cap"]}
      revisionNumber={revisionNumber}
    />
  );
}

/** DesignReportDocument কে জানায় G4 (Wall) দেখানো উচিত কিনা — প্লানের "যদি থাকে" শর্ত পূরণ করতে, model এ আদৌ wall/shear-wall element আছে কিনা চেক করে। */
export function hasWallElements(context: ReportContext): boolean {
  return context.elements.some((e) => e.category === "wall" || e.category === "shear-wall");
}
