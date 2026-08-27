/**
 * FootingCalcSheet — Phase 11e
 *
 * প্লানের চাহিদা (Footing): "Bearing pressure check (qmax vs qallow);
 * One-way/two-way shear check; Flexural design (both directions)"।
 *
 * footingDesign.ts এর FootingDesignReport আসলে "both directions"
 * সত্যিই আলাদাভাবে রাখে (momentX/momentZ, flexuralDesignX/Z,
 * oneWayShearX/Z) — Slab এর মতো সরলীকরণ এখানে নেই, তাই এই calc sheet
 * সরাসরি প্লানের spec মেলাতে পারছে (X ও Z উভয় দিক দেখানো হয়েছে)।
 *
 * "Bearing pressure check (qmax vs qallow)" — FootingSizingResult এ
 * সরাসরি qmax নেই (এটা sizing input থেকে বের হয়, sizing output না) —
 * requiredAreaM2/widthMm/lengthMm/netAllowablePressureKPa আছে। qmax
 * = servicePointLoadKN / (widthMm×lengthMm এর area) হিসাব করে দেখানো
 * হয়েছে, sizing input (input.servicePointLoadKN) ও output (sizing.widthMm/
 * lengthMm) থেকে — এটা derived, নতুন কোনো "invented" ডেটা না, বিদ্যমান
 * ফিল্ড থেকে সরাসরি গণিত।
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
import { asFootingDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface FootingCalcSheetProps {
  context: ReportContext;
  result: DesignResult;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function FootingCalcSheet({ context, result, revisionNumber }: FootingCalcSheetProps) {
  const footerLabel = `Calculation Sheet — Footing ${result.elementLabel}`;
  const calc = asFootingDetail(result.detail);
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
        <CalcSheetHeader context={context} result={result} elementTypeLabel="Footing" />
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No detailed calculation data recorded for this member yet.
        </Text>
      </ReportPage>
    );
  }

  const { input, report } = calc;
  const areaM2 = (report.sizing.widthMm / 1000) * (report.sizing.lengthMm / 1000);
  const qMaxKPa = areaM2 > 0 ? input.servicePointLoadKN / areaM2 : 0;
  const bearingAdequate = qMaxKPa <= input.allowableBearingPressureKPa;

  const checklist: ChecklistItem[] = [
    {
      checkName: "Bearing pressure",
      detail: `qmax = ${qMaxKPa.toFixed(1)} kPa vs qallow = ${input.allowableBearingPressureKPa.toFixed(1)} kPa`,
      status: bearingAdequate ? "pass" : "fail",
    },
    {
      checkName: "One-way shear (X)",
      detail: `Vu = ${report.oneWayShearX.factoredShearKNPerM.toFixed(1)} kN/m, UR = ${report.oneWayShearX.utilizationRatio.toFixed(2)}`,
      status: report.oneWayShearX.adequate ? "pass" : "fail",
    },
    {
      checkName: "One-way shear (Z)",
      detail: `Vu = ${report.oneWayShearZ.factoredShearKNPerM.toFixed(1)} kN/m, UR = ${report.oneWayShearZ.utilizationRatio.toFixed(2)}`,
      status: report.oneWayShearZ.adequate ? "pass" : "fail",
    },
    {
      checkName: "Two-way (punching) shear",
      detail: `phiVc = ${report.punchingShear.phiVcKN.toFixed(1)} kN, UR = ${report.punchingShear.utilizationRatio.toFixed(2)}`,
      status: report.punchingShear.adequate ? "pass" : "fail",
    },
    {
      checkName: "Flexural reinforcement (X)",
      detail: `As,req = ${report.flexuralDesignX.governingAsMm2.toFixed(0)} mm2/m`,
      status: report.flexuralDesignX.warnings.length === 0 ? "pass" : "warning",
    },
    {
      checkName: "Flexural reinforcement (Z)",
      detail: `As,req = ${report.flexuralDesignZ.governingAsMm2.toFixed(0)} mm2/m`,
      status: report.flexuralDesignZ.warnings.length === 0 ? "pass" : "warning",
    },
  ];

  return (
    <ReportPage footerLabel={footerLabel} titleblock={titleblockBase}>
      <CalcSheetHeader context={context} result={result} elementTypeLabel="Footing" />

      <CalcSectionHeading>A. Input Data</CalcSectionHeading>
      <LabeledValueRow label="Service Load (Pa)" value={`${input.servicePointLoadKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Factored Load (Pu)" value={`${input.factoredPointLoadKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Allowable Bearing Pressure" value={`${input.allowableBearingPressureKPa.toFixed(1)} kPa`} />
      <LabeledValueRow label="Column Size" value={`${input.columnWidthMm} x ${input.columnDepthMm} mm`} />
      <LabeledValueRow label="Thickness" value={`${input.thicknessMm} mm`} />
      <LabeledValueRow label="f'c / fy" value={`${input.fcMPa} MPa / ${input.fyMPa} MPa`} />

      <CalcSectionHeading>B. Design Calculation</CalcSectionHeading>

      <CalcSubHeading>Sizing / Bearing Pressure</CalcSubHeading>
      <LabeledValueRow label="Required area" value={`${report.sizing.requiredAreaM2.toFixed(2)} m2`} />
      <LabeledValueRow label="Footing size (W x L)" value={`${report.sizing.widthMm.toFixed(0)} x ${report.sizing.lengthMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Net allowable pressure" value={`${report.sizing.netAllowablePressureKPa.toFixed(1)} kPa`} />
      <LabeledValueRow label="qmax (service)" value={`${qMaxKPa.toFixed(1)} kPa`} />
      <WarningList warnings={report.sizing.warnings} />

      <CalcSubHeading>Moment — Direction X</CalcSubHeading>
      <LabeledValueRow label="Cantilever length" value={`${report.momentX.cantileverLengthMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Moment at column face" value={`${report.momentX.momentKNmPerM.toFixed(2)} kN.m/m`} />
      <LabeledValueRow label="As,required" value={`${report.flexuralDesignX.requiredAsMm2.toFixed(0)} mm2/m`} />
      <LabeledValueRow label="Governing As" value={`${report.flexuralDesignX.governingAsMm2.toFixed(0)} mm2/m`} />
      <WarningList warnings={report.flexuralDesignX.warnings} />

      <CalcSubHeading>Moment — Direction Z</CalcSubHeading>
      <LabeledValueRow label="Cantilever length" value={`${report.momentZ.cantileverLengthMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Moment at column face" value={`${report.momentZ.momentKNmPerM.toFixed(2)} kN.m/m`} />
      <LabeledValueRow label="As,required" value={`${report.flexuralDesignZ.requiredAsMm2.toFixed(0)} mm2/m`} />
      <LabeledValueRow label="Governing As" value={`${report.flexuralDesignZ.governingAsMm2.toFixed(0)} mm2/m`} />
      <WarningList warnings={report.flexuralDesignZ.warnings} />

      <CalcSubHeading>One-Way Shear — Direction X</CalcSubHeading>
      <LabeledValueRow label="Critical section distance" value={`${report.oneWayShearX.criticalSectionDistanceFromCenterMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Vu" value={`${report.oneWayShearX.factoredShearKNPerM.toFixed(1)} kN/m`} />
      <LabeledValueRow label="phiVc" value={`${report.oneWayShearX.phiVcKNPerM.toFixed(1)} kN/m`} />
      <LabeledValueRow label="Utilization ratio" value={report.oneWayShearX.utilizationRatio.toFixed(2)} />
      <WarningList warnings={report.oneWayShearX.warnings} />

      <CalcSubHeading>One-Way Shear — Direction Z</CalcSubHeading>
      <LabeledValueRow label="Critical section distance" value={`${report.oneWayShearZ.criticalSectionDistanceFromCenterMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Vu" value={`${report.oneWayShearZ.factoredShearKNPerM.toFixed(1)} kN/m`} />
      <LabeledValueRow label="phiVc" value={`${report.oneWayShearZ.phiVcKNPerM.toFixed(1)} kN/m`} />
      <LabeledValueRow label="Utilization ratio" value={report.oneWayShearZ.utilizationRatio.toFixed(2)} />
      <WarningList warnings={report.oneWayShearZ.warnings} />

      <CalcSubHeading>Two-Way (Punching) Shear</CalcSubHeading>
      <LabeledValueRow label="Critical perimeter, b0" value={`${report.punchingShear.criticalPerimeterMm.toFixed(0)} mm`} />
      <LabeledValueRow label="phiVc" value={`${report.punchingShear.phiVcKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Utilization ratio" value={report.punchingShear.utilizationRatio.toFixed(2)} />
      <WarningList warnings={report.punchingShear.warnings} />

      <CalcSectionHeading>C. Design Summary</CalcSectionHeading>
      <LabeledValueRow label="Final Reinforcement" value={result.finalReinforcementSummary ?? "Not recorded"} />
      <CalcChecklist items={checklist} />

      <CalcSectionHeading>D. Reference</CalcSectionHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Bearing/sizing: geotechnical allowable pressure basis. Flexure: ACI 318-19
        Ch.13/22.2-22.3. One-way shear: ACI 318-19 Sec.22.5. Punching shear: ACI 318-19 Sec.22.6.
      </Text>
    </ReportPage>
  );
}
