/**
 * CalcSheetsDocument — Phase 11e
 *
 * প্লানের চাহিদা: "সব member মিলিয়ে 'Calculation Sheets' নামে একটা
 * bundled annexure (Design Report-এর appendix হিসেবে link, অথবা
 * আলাদা ডাউনলোডযোগ্য); Element-type অনুযায়ী ফিল্টার করে ডাউনলোড
 * করার অপশন (শুধু Beam Calc Sheets, শুধু Column, ইত্যাদি) — বড়
 * প্রজেক্টে সব member এর calc sheet একসাথে বিশাল হয়ে যাবে"।
 *
 * ফিল্টার প্যারামিটার filterCategories — না দিলে (undefined) সব
 * category বান্ডেল করে; দিলে শুধু সেই category গুলোর result রেন্ডার
 * করে। Documentation stage UI (Phase 11i) এখান থেকে "Beam only"/
 * "Column only"/ইত্যাদি বাটন বানাতে পারবে, একই ফাংশন re-use করে —
 * আলাদা কোনো "BeamOnlyCalcSheetsDocument" ইত্যাদি বানানো হয়নি।
 *
 * steel-beam/steel-column category গুলো এই ফেজে বাদ রাখা হয়েছে —
 * এই কোডবেসে steelBeamDesign.ts/steelColumnDesign.ts থাকলেও তাদের
 * রিপোর্ট শেপ RC থেকে আলাদা (AISC ভিত্তিক, ACI না), এবং একটা আলাদা
 * SteelCalcSheet.tsx দরকার হবে যেটা এই ফেজের স্কোপে নেই (প্লানের
 * চারটা মূল ক্যাটাগরি — Beam/Column/Slab/Footing — RC-কেন্দ্রিক ধরে
 * নেওয়া হয়েছে)। steel category এর result থাকলে "not yet supported"
 * নোট সহ একটা placeholder পেজ দেখানো হয়, চুপচাপ বাদ দেওয়া হয় না।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { DesignElementCategory } from "@/lib/design/firestore";
import { BeamCalcSheet } from "@/lib/documentation/pdf/calc-sheets/BeamCalcSheet";
import { ColumnCalcSheet } from "@/lib/documentation/pdf/calc-sheets/ColumnCalcSheet";
import { SlabCalcSheet } from "@/lib/documentation/pdf/calc-sheets/SlabCalcSheet";
import { FootingCalcSheet } from "@/lib/documentation/pdf/calc-sheets/FootingCalcSheet";

export interface CalcSheetsDocumentProps {
  context: ReportContext;
  /** না দিলে সব category বান্ডেল করে — Phase 11i এর "Beam only" জাতীয় ফিল্টার UI এই প্যারামিটার দিয়ে কল করবে। */
  filterCategories?: DesignElementCategory[];
}

const FOUNDATION_CATEGORIES: DesignElementCategory[] = [
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
  "pile-cap",
];

function UnsupportedCategoryPage({ elementLabel, category }: { elementLabel: string; category: string }) {
  return (
    <ReportPage footerLabel={`Calculation Sheet — ${elementLabel}`}>
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 10 }}>
        {elementLabel}
      </Text>
      <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
        Calculation sheets for &quot;{category}&quot; elements are not yet supported in this
        workflow.
      </Text>
    </ReportPage>
  );
}

export function CalcSheetsDocument({ context, filterCategories }: CalcSheetsDocumentProps) {
  const results = filterCategories
    ? context.designResults.filter((r) => filterCategories.includes(r.elementCategory))
    : context.designResults;
  const project = context.hub?.projectInfo ?? null;

  if (results.length === 0) {
    return (
      <Document
        title={`${project?.projectName ?? "Untitled Project"} — Calculation Sheets`}
        creator="CivilOS Structural — Documentation Engine"
      >
        <ReportPage footerLabel="Calculation Sheets">
          <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 10 }}>
            Calculation Sheets
          </Text>
          <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
            No design results recorded yet — calculation sheets will be available once member
            design checks are saved.
          </Text>
        </ReportPage>
      </Document>
    );
  }

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Calculation Sheets`}
      creator="CivilOS Structural — Documentation Engine"
    >
      {results.map((result) => {
        if (result.elementCategory === "beam") {
          return <BeamCalcSheet key={result.elementId} context={context} result={result} />;
        }
        if (result.elementCategory === "column") {
          return <ColumnCalcSheet key={result.elementId} context={context} result={result} />;
        }
        if (result.elementCategory === "slab") {
          return <SlabCalcSheet key={result.elementId} context={context} result={result} />;
        }
        if (FOUNDATION_CATEGORIES.includes(result.elementCategory)) {
          return <FootingCalcSheet key={result.elementId} context={context} result={result} />;
        }
        return (
          <UnsupportedCategoryPage
            key={result.elementId}
            elementLabel={result.elementLabel}
            category={result.elementCategory}
          />
        );
      })}
    </Document>
  );
}
