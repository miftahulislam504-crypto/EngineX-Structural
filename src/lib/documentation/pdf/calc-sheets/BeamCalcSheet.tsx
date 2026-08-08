/**
 * BeamCalcSheet — Phase 11e
 *
 * প্লানের চাহিদা (Beam): "Flexural design: Mu → required As, ρ check
 * (min/max), bar selection যুক্তি; Shear design: Vu → Vc, Vs, stirrup
 * spacing calc; Deflection check: computed vs allowable; Development
 * length/curtailment point"।
 *
 * সততার সাথে সীমাবদ্ধতা: "Development length/curtailment point" —
 * rcBeamDesign.ts এর orchestrator development length বা curtailment
 * point কম্পিউট করে না (শুধু flexure/shear/deflection/crack control)।
 * barBendingSchedule.ts এও development length computation নেই। এই
 * কোডবেসে কোথাও development length সূত্র (ACI §25.4) প্রয়োগ করা কোনো
 * ফাংশন পাওয়া যায়নি। তাই এই সাব-সেকশন "Not yet implemented in this
 * workflow" নোট দেখায় — খালি রেখে চুপ থাকার বদলে explicit বলা হলো,
 * ঠিক যেভাবে Section F (Analysis Summary, Phase 11c) এ irregularity
 * check এর ক্ষেত্রে করা হয়েছিল।
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
import { asBeamDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface BeamCalcSheetProps {
  context: ReportContext;
  result: DesignResult;
}

export function BeamCalcSheet({ context, result }: BeamCalcSheetProps) {
  const footerLabel = `Calculation Sheet — Beam ${result.elementLabel}`;
  const calc = asBeamDetail(result.detail);

  if (!calc) {
    return (
      <ReportPage footerLabel={footerLabel}>
        <CalcSheetHeader context={context} result={result} elementTypeLabel="Beam" />
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No detailed calculation data recorded for this member yet.
        </Text>
      </ReportPage>
    );
  }

  const { input, report } = calc;

  const checklist: ChecklistItem[] = [
    {
      checkName: "Flexural reinforcement",
      detail: `As,req = ${report.flexure.governingAsMm2.toFixed(0)} mm2, As,min = ${report.flexure.minAsMm2.toFixed(0)} mm2, As,max = ${report.flexure.maxAsMm2.toFixed(0)} mm2`,
      status: report.flexure.warnings.length === 0 ? "pass" : "warning",
    },
    ...(report.flexuralAdequacy
      ? [
          {
            checkName: "Flexural capacity",
            detail: `phiMn = ${report.flexuralAdequacy.phiMnKNm.toFixed(1)} kN.m, UR = ${report.flexuralAdequacy.utilizationRatio.toFixed(2)}`,
            status: (report.flexuralAdequacy.adequate ? "pass" : "fail") as ChecklistItem["status"],
          },
        ]
      : []),
    {
      checkName: "Shear reinforcement",
      detail: report.shear.stirrupNeeded
        ? `Spacing required = ${report.shear.requiredSpacingMm?.toFixed(0) ?? "—"} mm (max ${report.shear.maxSpacingMm.toFixed(0)} mm)`
        : `Nominal stirrups only (max spacing ${report.shear.maxSpacingMm.toFixed(0)} mm)`,
      status: report.shear.warnings.length === 0 ? "pass" : "warning",
    },
    {
      checkName: "Deflection (min thickness)",
      detail: `Required = ${report.deflection.minRequiredThicknessMm.toFixed(0)} mm, Provided = ${report.deflection.providedThicknessMm.toFixed(0)} mm`,
      status: report.deflection.adequate ? "pass" : "fail",
    },
    ...(report.crackControl
      ? [
          {
            checkName: "Crack control spacing",
            detail: `Max spacing = ${report.crackControl.maxSpacingMm.toFixed(0)} mm at fs = ${report.crackControl.serviceStressMPa.toFixed(0)} MPa`,
            status: (report.crackControl.adequate ? "pass" : "fail") as ChecklistItem["status"],
          },
        ]
      : []),
  ];

  return (
    <ReportPage footerLabel={footerLabel}>
      <CalcSheetHeader context={context} result={result} elementTypeLabel="Beam" />

      <CalcSectionHeading>A. Input Data</CalcSectionHeading>
      <LabeledValueRow label="Span" value={`${(input.spanMm / 1000).toFixed(2)} m`} />
      <LabeledValueRow label="Size (b x D)" value={`${input.widthMm} x ${input.totalDepthMm} mm`} />
      <LabeledValueRow label="Clear Cover" value={`${input.clearCoverMm} mm`} />
      <LabeledValueRow label="f'c / fy" value={`${input.fcMPa} MPa / ${input.fyMPa} MPa`} />
      <LabeledValueRow label="Support Condition" value={input.supportCondition} />
      <LabeledValueRow label="Governing Load Combination" value={result.governingLoadCombinationId ?? "Not specified"} />
      <LabeledValueRow label="Mu (factored moment)" value={`${input.factoredMomentKNm.toFixed(1)} kN.m`} />
      <LabeledValueRow label="Vu (factored shear)" value={`${input.factoredShearKN.toFixed(1)} kN`} />

      <CalcSectionHeading>B. Design Calculation</CalcSectionHeading>

      <CalcSubHeading>Flexural Design</CalcSubHeading>
      <LabeledValueRow label="Effective depth, d" value={`${report.flexure.effectiveDepthMm.toFixed(1)} mm`} />
      <LabeledValueRow label="As,required" value={`${report.flexure.requiredAsMm2.toFixed(0)} mm2`} />
      <LabeledValueRow label="As,min / As,max" value={`${report.flexure.minAsMm2.toFixed(0)} / ${report.flexure.maxAsMm2.toFixed(0)} mm2`} />
      <LabeledValueRow label="Governing As" value={`${report.flexure.governingAsMm2.toFixed(0)} mm2${report.flexure.isDoublyReinforced ? " (doubly reinforced)" : ""}`} />
      {report.flexure.isDoublyReinforced && (
        <LabeledValueRow label="Compression As'" value={`${report.flexure.compressionAsMm2.toFixed(0)} mm2`} />
      )}
      {report.flexuralAdequacy && (
        <>
          <LabeledValueRow label="phiMn (provided capacity)" value={`${report.flexuralAdequacy.phiMnKNm.toFixed(1)} kN.m`} />
          <LabeledValueRow label="Utilization ratio (Mu / phiMn)" value={report.flexuralAdequacy.utilizationRatio.toFixed(2)} />
        </>
      )}
      <WarningList warnings={report.flexure.warnings} />

      <CalcSubHeading>Shear Design</CalcSubHeading>
      <LabeledValueRow label="phiVc (concrete capacity)" value={`${report.shear.phiVcKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Required Vs" value={`${report.shear.requiredVsKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Stirrup needed" value={report.shear.stirrupNeeded ? "Yes" : "No (nominal only)"} />
      <LabeledValueRow
        label="Required spacing"
        value={report.shear.requiredSpacingMm !== null ? `${report.shear.requiredSpacingMm.toFixed(0)} mm` : "N/A"}
      />
      <LabeledValueRow label="Max spacing limit" value={`${report.shear.maxSpacingMm.toFixed(0)} mm`} />
      <WarningList warnings={report.shear.warnings} />

      <CalcSubHeading>Deflection Check</CalcSubHeading>
      <LabeledValueRow label="Min required thickness" value={`${report.deflection.minRequiredThicknessMm.toFixed(0)} mm`} />
      <LabeledValueRow label="Provided thickness" value={`${report.deflection.providedThicknessMm.toFixed(0)} mm`} />
      <WarningList warnings={report.deflection.warnings} />

      {report.crackControl && (
        <>
          <CalcSubHeading>Crack Control (Serviceability)</CalcSubHeading>
          <LabeledValueRow label="Service stress, fs" value={`${report.crackControl.serviceStressMPa.toFixed(0)} MPa`} />
          <LabeledValueRow label="Max allowable spacing" value={`${report.crackControl.maxSpacingMm.toFixed(0)} mm`} />
          <WarningList warnings={report.crackControl.warnings} />
        </>
      )}

      <CalcSubHeading>Development Length / Curtailment</CalcSubHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Not yet implemented in this workflow — no development length or curtailment computation
        exists in the design engine at this time.
      </Text>

      <CalcSectionHeading>C. Design Summary</CalcSectionHeading>
      <LabeledValueRow label="Final Reinforcement" value={result.finalReinforcementSummary ?? "Not recorded"} />
      <CalcChecklist items={checklist} />

      <CalcSectionHeading>D. Reference</CalcSectionHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Flexure: ACI 318-19 Ch.9, Sec.22.2-22.3. Shear: ACI 318-19 Sec.22.5. Deflection: ACI
        318-19 Table 7.3.1.1 / 9.3.1.1. Crack control: ACI 318-19 Sec.24.3.
      </Text>
    </ReportPage>
  );
}
