/**
 * DesignReportDocument — Phase 11c
 *
 * A থেকে J পর্যন্ত সব সেকশন একটা একক @react-pdf/renderer <Document>
 * এ জোড়া দেয় — এটাই renderToBuffer()/renderToStream() এ যা পাস করা
 * হবে (Documentation stage UI, Phase 11i, এই component ব্যবহার করবে)।
 *
 * G4 (Wall/Shear Wall Design Summary) — প্লানের নিজস্ব নোট "(যদি
 * থাকে)" মেনে শুধু তখনই দেখানো হয় যখন মডেলে অন্তত একটা wall/shear-wall
 * element আছে (hasWallElements() চেক, SectionG_DesignSummary.tsx এ
 * সংজ্ঞায়িত) — খালি ওয়াল সেকশন দেখিয়ে পাতা নষ্ট করা হয় না।
 *
 * Table of Contents — STANDARD_TOC_ENTRIES ব্যবহার করা হলো, কিন্তু
 * যদি এই প্রজেক্টে wall না থাকে তাহলে G4 entry বাদ দেওয়া হয়, যাতে
 * TOC আসলে যা রেন্ডার হচ্ছে তার সাথে মেলে (TOC এ থাকা entry রিপোর্টে
 * নেই — এমন অসঙ্গতি এড়াতে)।
 *
 * deformedShapeSnapshotDataUrl (Report-Audit Phase A4, 2026-08-20) —
 * client (DocumentationPanel.tsx) থেকে POST body তে আসা base64 PNG
 * data URL, route.tsx এই পর্যন্ত pass-through করে। null/undefined
 * হলে (GET path, বা snapshot capture client-side ব্যর্থ হলে)
 * Section F "Deformed Shape" sub-section একটা honest "not available"
 * নোট দেখায়, ব্লক করে না — snapshot একটা optional enhancement, মূল
 * PDF generation তার উপর নির্ভরশীল না।
 */

import { Document } from "@react-pdf/renderer";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { CoverPage } from "@/lib/documentation/pdf/design-report/SectionA_Cover";
import {
  TableOfContents,
  STANDARD_TOC_ENTRIES,
} from "@/lib/documentation/pdf/design-report/SectionB_TableOfContents";
import { GeneralInformation } from "@/lib/documentation/pdf/design-report/SectionC_GeneralInformation";
import { MaterialProperties } from "@/lib/documentation/pdf/design-report/SectionD_MaterialProperties";
import { DesignLoads } from "@/lib/documentation/pdf/design-report/SectionE_DesignLoads";
import { AnalysisSummary } from "@/lib/documentation/pdf/design-report/SectionF_AnalysisSummary";
import {
  BeamDesignSummary,
  ColumnDesignSummary,
  SlabDesignSummary,
  WallDesignSummary,
  FoundationDesignSummary,
  hasWallElements,
} from "@/lib/documentation/pdf/design-report/SectionG_DesignSummary";
import { ValidationSummary } from "@/lib/documentation/pdf/design-report/SectionH_ValidationSummary";
import { QuantitySummarySection } from "@/lib/documentation/pdf/design-report/SectionI_QuantitySummary";
import { Appendix } from "@/lib/documentation/pdf/design-report/SectionJ_Appendix";

export interface DesignReportDocumentProps {
  context: ReportContext;
  revisionNumber: string;
  structuralEngineerName?: string;
  deformedShapeSnapshotDataUrl?: string | null;
}

export function DesignReportDocument({
  context,
  revisionNumber,
  structuralEngineerName,
  deformedShapeSnapshotDataUrl,
}: DesignReportDocumentProps) {
  const showWallSection = hasWallElements(context);
  const tocEntries = showWallSection
    ? STANDARD_TOC_ENTRIES
    : STANDARD_TOC_ENTRIES.filter((e) => e.code !== "G4");

  return (
    <Document
      title={`${context.hub?.projectInfo.projectName ?? "Untitled Project"} — Structural Design Report`}
      author={structuralEngineerName ?? "CivilOS Structural"}
      creator="CivilOS Structural — Documentation Engine"
    >
      <CoverPage
        context={context}
        revisionNumber={revisionNumber}
        structuralEngineerName={structuralEngineerName}
      />
      <TableOfContents entries={tocEntries} context={context} revisionNumber={revisionNumber} />
      <GeneralInformation context={context} revisionNumber={revisionNumber} />
      <MaterialProperties context={context} revisionNumber={revisionNumber} />
      <DesignLoads context={context} revisionNumber={revisionNumber} />
      <AnalysisSummary
        context={context}
        deformedShapeSnapshotDataUrl={deformedShapeSnapshotDataUrl ?? null}
        revisionNumber={revisionNumber}
      />
      <BeamDesignSummary context={context} revisionNumber={revisionNumber} />
      <ColumnDesignSummary context={context} revisionNumber={revisionNumber} />
      <SlabDesignSummary context={context} revisionNumber={revisionNumber} />
      {showWallSection && <WallDesignSummary context={context} revisionNumber={revisionNumber} />}
      <FoundationDesignSummary context={context} revisionNumber={revisionNumber} />
      <ValidationSummary context={context} revisionNumber={revisionNumber} />
      <QuantitySummarySection context={context} revisionNumber={revisionNumber} />
      <Appendix context={context} revisionNumber={revisionNumber} />
    </Document>
  );
}
