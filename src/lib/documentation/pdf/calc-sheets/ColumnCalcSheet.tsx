/**
 * ColumnCalcSheet — Phase 11e
 *
 * প্লানের চাহিদা (Column): "P-M interaction: Pu, Mu → interaction
 * diagram point, capacity ratio; Slenderness check (যদি প্রযোজ্য);
 * Tie spacing, splice length"।
 *
 * সততার সাথে সীমাবদ্ধতা: "splice length" — rcColumnReinforcement.ts
 * এ tie spacing আছে (TieSpacingCheckResult), কিন্তু longitudinal bar
 * splice length এর কোনো computation এই কোডবেসে নেই (development
 * length এর মতোই একই গ্যাপ, BeamCalcSheet.tsx এ নোট করা)। তাই এটাও
 * "Not yet implemented" হিসেবে explicit দেখানো হয়েছে।
 *
 * interaction diagram (PmInteractionPoint[]) পুরো curve — pdf তে
 * প্রতিটা পয়েন্ট টেবিল আকারে না দেখিয়ে, শুধু governing (Pu, Mu) এর
 * কাছাকাছি capacity ও adequacy summary দেখানো হয়েছে (পুরো ৫০+ পয়েন্টের
 * curve একটা calc sheet এ দরকারি না, এটা বরং ভবিষ্যতে একটা chart/
 * visual হিসেবে কাজে লাগতে পারে — এই ফেজের স্কোপের বাইরে)।
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
import { asColumnDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface ColumnCalcSheetProps {
  context: ReportContext;
  result: DesignResult;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function ColumnCalcSheet({ context, result, revisionNumber }: ColumnCalcSheetProps) {
  const footerLabel = `Calculation Sheet — Column ${result.elementLabel}`;
  const calc = asColumnDetail(result.detail);
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
        <CalcSheetHeader context={context} result={result} elementTypeLabel="Column" />
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No detailed calculation data recorded for this member yet.
        </Text>
      </ReportPage>
    );
  }

  const { input, report } = calc;

  const checklist: ChecklistItem[] = [
    {
      checkName: "Slenderness",
      detail: report.slenderness.isSlenderColumn
        ? `kLu/r = ${report.slenderness.klOverR.toFixed(1)} (limit ${report.slenderness.slendernessLimit.toFixed(1)}) — magnified Mc = ${report.slenderness.magnifiedMomentKNm.toFixed(1)} kN.m`
        : `kLu/r = ${report.slenderness.klOverR.toFixed(1)} (limit ${report.slenderness.slendernessLimit.toFixed(1)}) — slenderness may be ignored`,
      status: report.slenderness.warnings.length === 0 ? "pass" : "warning",
    },
    {
      checkName: "P-M interaction adequacy",
      detail: `phiMn (interpolated) = ${report.adequacy.interpolatedPhiMnKNm.toFixed(1)} kN.m, UR = ${report.adequacy.utilizationRatio.toFixed(2)}`,
      status: report.adequacy.adequate ? "pass" : "fail",
    },
    {
      checkName: "Longitudinal reinforcement ratio",
      detail: `rho_g = ${(report.reinforcementRatio.ratio * 100).toFixed(2)}% (limits ${(report.reinforcementRatio.minRatio * 100).toFixed(1)}%-${(report.reinforcementRatio.maxRatio * 100).toFixed(1)}%)`,
      status: report.reinforcementRatio.adequate ? "pass" : "fail",
    },
    {
      checkName: "Tie spacing",
      detail:
        report.tieSpacing.providedSpacingMm !== null
          ? `Provided = ${report.tieSpacing.providedSpacingMm.toFixed(0)} mm (max ${report.tieSpacing.maxSpacingMm.toFixed(0)} mm)`
          : `Max allowable = ${report.tieSpacing.maxSpacingMm.toFixed(0)} mm`,
      status: report.tieSpacing.adequate === false ? "fail" : "pass",
    },
  ];

  return (
    <ReportPage footerLabel={footerLabel} titleblock={titleblockBase}>
      <CalcSheetHeader context={context} result={result} elementTypeLabel="Column" />

      <CalcSectionHeading>A. Input Data</CalcSectionHeading>
      <LabeledValueRow label="Size (b x h)" value={`${input.widthMm} x ${input.totalDepthMm} mm`} />
      <LabeledValueRow label="Unsupported length, Lu" value={`${(input.unsupportedLengthMm / 1000).toFixed(2)} m`} />
      <LabeledValueRow label="Effective length factor, k" value={input.effectiveLengthFactor.toFixed(2)} />
      <LabeledValueRow label="Sway frame" value={input.isSwayFrame ? "Yes" : "No"} />
      <LabeledValueRow label="f'c / fy" value={`${input.fcMPa} MPa / ${input.fyMPa} MPa`} />
      <LabeledValueRow label="Total As (provided)" value={`${input.totalAsMm2.toFixed(0)} mm2`} />
      <LabeledValueRow label="Governing Load Combination" value={result.governingLoadCombinationId ?? "Not specified"} />
      <LabeledValueRow label="Pu (factored axial)" value={`${input.factoredAxialLoadKN.toFixed(1)} kN`} />
      <LabeledValueRow label="M1 / M2 (end moments)" value={`${input.m1KNm.toFixed(1)} / ${input.m2KNm.toFixed(1)} kN.m`} />

      <CalcSectionHeading>B. Design Calculation</CalcSectionHeading>

      <CalcSubHeading>Slenderness Check</CalcSubHeading>
      <LabeledValueRow label="kLu/r" value={report.slenderness.klOverR.toFixed(1)} />
      <LabeledValueRow label="Slenderness limit" value={report.slenderness.slendernessLimit.toFixed(1)} />
      <LabeledValueRow label="Slender column" value={report.slenderness.isSlenderColumn ? "Yes" : "No"} />
      {report.slenderness.isSlenderColumn && (
        <>
          <LabeledValueRow label="Magnification factor" value={report.slenderness.magnificationFactor.toFixed(3)} />
          <LabeledValueRow label="Magnified design moment, Mc" value={`${report.slenderness.magnifiedMomentKNm.toFixed(1)} kN.m`} />
        </>
      )}
      <WarningList warnings={report.slenderness.warnings} />

      <CalcSubHeading>P-M Interaction Check</CalcSubHeading>
      <LabeledValueRow label="Interaction diagram points computed" value={String(report.interactionDiagram.length)} />
      <LabeledValueRow label="Interpolated phiMn at Pu" value={`${report.adequacy.interpolatedPhiMnKNm.toFixed(1)} kN.m`} />
      <LabeledValueRow label="Utilization ratio" value={report.adequacy.utilizationRatio.toFixed(2)} />
      <WarningList warnings={report.adequacy.warnings} />

      <CalcSubHeading>Longitudinal Reinforcement Ratio</CalcSubHeading>
      <LabeledValueRow label="rho_g provided" value={`${(report.reinforcementRatio.ratio * 100).toFixed(2)}%`} />
      <LabeledValueRow
        label="Limits (min-max)"
        value={`${(report.reinforcementRatio.minRatio * 100).toFixed(1)}% - ${(report.reinforcementRatio.maxRatio * 100).toFixed(1)}%`}
      />
      <WarningList warnings={report.reinforcementRatio.warnings} />

      <CalcSubHeading>Tie Spacing</CalcSubHeading>
      <LabeledValueRow label="Max allowable spacing" value={`${report.tieSpacing.maxSpacingMm.toFixed(0)} mm`} />
      <LabeledValueRow
        label="Provided spacing"
        value={report.tieSpacing.providedSpacingMm !== null ? `${report.tieSpacing.providedSpacingMm.toFixed(0)} mm` : "Not specified"}
      />
      <WarningList warnings={report.tieSpacing.warnings} />

      <CalcSubHeading>Splice Length</CalcSubHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Not yet implemented in this workflow — no splice length computation exists in the design
        engine at this time.
      </Text>

      <CalcSectionHeading>C. Design Summary</CalcSectionHeading>
      <LabeledValueRow label="Final Reinforcement" value={result.finalReinforcementSummary ?? "Not recorded"} />
      <CalcChecklist items={checklist} />

      <CalcSectionHeading>D. Reference</CalcSectionHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Slenderness: ACI 318-19 Sec.6.2.5-6.6.4. P-M interaction / strength reduction factor: ACI
        318-19 Sec.21.2. Reinforcement limits: ACI 318-19 Sec.10.6.1.1. Tie spacing: ACI 318-19
        Sec.25.7.2.1.
      </Text>
    </ReportPage>
  );
}
