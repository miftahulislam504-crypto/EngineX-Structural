/**
 * SlabCalcSheet — Phase 11e
 *
 * প্লানের চাহিদা (Slab): "Moment (both directions) → As required both
 * ways; Deflection check (span/depth ratio); Punching shear (flat
 * slab হলে)"।
 *
 * rcSlabDesign.ts এর SlabMomentResult আসলে positiveMomentKNmPerM/
 * negativeMomentKNmPerM রাখে (span-direction moment) — one-way হলে
 * এটাই একমাত্র দিক, two-way হলে flexuralDesign.positiveDesign/
 * negativeDesign দুটোই "governing span direction" এর জন্য (short
 * span, কমেন্ট অনুযায়ী)। rcSlabDesign.ts orchestrator নিজে "both
 * directions" আলাদা করে না — এটা v1 এর একটা সরলীকরণ (ইঞ্জিনিয়ারকে
 * long-direction এর জন্য আলাদাভাবে আবার চালাতে হয়, একই ফাংশন দিয়ে)।
 * তাই এই calc sheet ঠিক যা report এ আছে তাই দেখায় (positive/negative
 * moment design, single governing span direction অনুযায়ী), "both
 * ways" কে fabricate করে না।
 */

import { Text } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { CalcSheetHeader } from "@/lib/documentation/pdf/calc-sheets/CalcSheetHeader";
import {
  CalcSectionHeading,
  CalcSubHeading,
  LabeledValueRow,
  WarningList,
  CalcChecklist,
  type ChecklistItem,
} from "@/lib/documentation/pdf/calc-sheets/CalcSheetPrimitives";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { DesignResult } from "@/lib/design/firestore";
import { asSlabDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface SlabCalcSheetProps {
  context: ReportContext;
  result: DesignResult;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function SlabCalcSheet({ context, result, revisionNumber }: SlabCalcSheetProps) {
  const footerLabel = `Calculation Sheet — Slab ${result.elementLabel}`;
  const calc = asSlabDetail(result.detail);
  const project = context.hub?.projectInfo ?? null;
  const titleblockBase = {
    project,
    documentKind: "calc-sheets" as const,
    sheetNumber: `CS-${result.elementLabel}`,
    sheetTitle: footerLabel,
    date: formatDateLabel(context.generatedAt),
    revisionNumber,
  };

  if (!calc) {
    return (
      <ReportPage footerLabel={footerLabel} titleblock={titleblockBase}>
        <CalcSheetHeader context={context} result={result} elementTypeLabel="Slab" />
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No detailed calculation data recorded for this member yet.
        </Text>
      </ReportPage>
    );
  }

  const { input, report } = calc;

  const checklist: ChecklistItem[] = [
    {
      checkName: "Minimum thickness",
      detail: `Provided = ${input.thicknessMm} mm, Required = ${report.minThickness.minThicknessMm.toFixed(0)} mm`,
      status: report.thicknessAdequate ? "pass" : "fail",
    },
    {
      checkName: "Positive moment reinforcement",
      detail: `As,req = ${report.flexuralDesign.positiveDesign.governingAsMm2.toFixed(0)} mm2/m`,
      status: report.flexuralDesign.positiveDesign.warnings.length === 0 ? "pass" : "warning",
    },
    ...(report.flexuralDesign.negativeDesign
      ? [
          {
            checkName: "Negative moment reinforcement",
            detail: `As,req = ${report.flexuralDesign.negativeDesign.governingAsMm2.toFixed(0)} mm2/m`,
            status: (report.flexuralDesign.negativeDesign.warnings.length === 0
              ? "pass"
              : "warning") as ChecklistItem["status"],
          },
        ]
      : []),
    ...(report.punchingShear
      ? [
          {
            checkName: "Punching shear",
            detail: `phiVc = ${report.punchingShear.phiVcKN.toFixed(1)} kN, UR = ${report.punchingShear.utilizationRatio.toFixed(2)}`,
            status: (report.punchingShear.adequate ? "pass" : "fail") as ChecklistItem["status"],
          },
        ]
      : []),
  ];

  return (
    <ReportPage footerLabel={footerLabel} titleblock={titleblockBase}>
      <CalcSheetHeader context={context} result={result} elementTypeLabel="Slab" />

      <CalcSectionHeading>A. Input Data</CalcSectionHeading>
      <LabeledValueRow label="Panel Type" value={input.panelType} />
      <LabeledValueRow
        label="Span (short / long)"
        value={`${(input.shortSpanMm / 1000).toFixed(2)} m${input.longSpanMm ? ` / ${(input.longSpanMm / 1000).toFixed(2)} m` : ""}`}
      />
      <LabeledValueRow label="Thickness" value={`${input.thicknessMm} mm`} />
      <LabeledValueRow label="Effective Cover" value={`${input.effectiveCoverMm} mm`} />
      <LabeledValueRow label="f'c / fy" value={`${input.fcMPa} MPa / ${input.fyMPa} MPa`} />
      <LabeledValueRow label="Factored Load, wu" value={`${input.factoredLoadKPa.toFixed(2)} kPa`} />
      <LabeledValueRow label="Governing Load Combination" value={result.governingLoadCombinationId ?? "Not specified"} />

      <CalcSectionHeading>B. Design Calculation</CalcSectionHeading>

      <CalcSubHeading>Minimum Thickness / Deflection Check</CalcSubHeading>
      <LabeledValueRow label="Minimum required thickness" value={`${report.minThickness.minThicknessMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Provided thickness" value={`${input.thicknessMm} mm`} />
      <LabeledValueRow label="Adequate" value={report.thicknessAdequate ? "Yes" : "No"} />

      <CalcSubHeading>Moment (Governing Span Direction)</CalcSubHeading>
      <LabeledValueRow label="Governing span" value={`${(report.moments.governingSpanMm / 1000).toFixed(2)} m`} />
      <LabeledValueRow label="Positive moment (midspan)" value={`${report.moments.positiveMomentKNmPerM.toFixed(2)} kN.m/m`} />
      <LabeledValueRow label="Negative moment (support)" value={`${report.moments.negativeMomentKNmPerM.toFixed(2)} kN.m/m`} />

      <CalcSubHeading>Flexural Reinforcement — Positive Moment</CalcSubHeading>
      <LabeledValueRow label="As,required" value={`${report.flexuralDesign.positiveDesign.requiredAsMm2.toFixed(0)} mm2/m`} />
      <LabeledValueRow
        label="As,min / As,max"
        value={`${report.flexuralDesign.positiveDesign.minAsMm2.toFixed(0)} / ${report.flexuralDesign.positiveDesign.maxAsMm2.toFixed(0)} mm2/m`}
      />
      <LabeledValueRow label="Governing As" value={`${report.flexuralDesign.positiveDesign.governingAsMm2.toFixed(0)} mm2/m`} />
      <WarningList warnings={report.flexuralDesign.positiveDesign.warnings} />

      {report.flexuralDesign.negativeDesign && (
        <>
          <CalcSubHeading>Flexural Reinforcement — Negative Moment</CalcSubHeading>
          <LabeledValueRow label="As,required" value={`${report.flexuralDesign.negativeDesign.requiredAsMm2.toFixed(0)} mm2/m`} />
          <LabeledValueRow label="Governing As" value={`${report.flexuralDesign.negativeDesign.governingAsMm2.toFixed(0)} mm2/m`} />
          <WarningList warnings={report.flexuralDesign.negativeDesign.warnings} />
        </>
      )}

      <CalcSubHeading>Minimum (Shrinkage/Temperature) Reinforcement</CalcSubHeading>
      <LabeledValueRow label="As,min (both directions)" value={`${report.minReinforcement.minAsPerMeterMm2.toFixed(0)} mm2/m`} />

      {report.punchingShear ? (
        <>
          <CalcSubHeading>Punching Shear (Flat Slab / Flat Plate)</CalcSubHeading>
          <LabeledValueRow label="Critical perimeter, b0" value={`${report.punchingShear.criticalPerimeterMm.toFixed(0)} mm`} />
          <LabeledValueRow label="phiVc" value={`${report.punchingShear.phiVcKN.toFixed(1)} kN`} />
          <LabeledValueRow label="Utilization ratio" value={report.punchingShear.utilizationRatio.toFixed(2)} />
          <WarningList warnings={report.punchingShear.warnings} />
        </>
      ) : (
        <>
          <CalcSubHeading>Punching Shear</CalcSubHeading>
          <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
            Not applicable — this panel was not checked as column-supported (flat slab/flat
            plate).
          </Text>
        </>
      )}

      <CalcSectionHeading>C. Design Summary</CalcSectionHeading>
      <LabeledValueRow label="Final Reinforcement" value={result.finalReinforcementSummary ?? "Not recorded"} />
      <CalcChecklist items={checklist} />

      <CalcSectionHeading>D. Reference</CalcSectionHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Minimum thickness: ACI 318-19 Table 7.3.1.1. Flexure: ACI 318-19 Ch.7-8/22.2-22.3.
        Shrinkage/temperature: ACI 318-19 Sec.7.6.1.1. Punching shear: ACI 318-19 Sec.22.6.
      </Text>
    </ReportPage>
  );
}
