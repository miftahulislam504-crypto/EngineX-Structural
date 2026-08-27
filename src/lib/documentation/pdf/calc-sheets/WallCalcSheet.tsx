/**
 * WallCalcSheet — Report-Audit Phase B1 (2026-08-20)
 *
 * SlabCalcSheet.tsx এর অভিন্ন প্যাটার্ন — asWallDetail() দিয়ে
 * DesignResult.detail decode ({ input, report } জোড়া, rcWallDesign.ts
 * এর runRcWallDesign() output)।
 *
 * shearCapacity — শুধু isShearWall=true হলে report এ থাকে (rcWallDesign.ts
 * এর runRcWallDesign() নিজেই null রাখে non-shear wall এ) — plain wall
 * এর জন্য "Not applicable" দেখানো হয়, non-shear-wall কে জোর করে shear
 * check করানো হয় না।
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
import { asWallDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface WallCalcSheetProps {
  context: ReportContext;
  result: DesignResult;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function WallCalcSheet({ context, result, revisionNumber }: WallCalcSheetProps) {
  const footerLabel = `Calculation Sheet — Wall ${result.elementLabel}`;
  const calc = asWallDetail(result.detail);
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
        <CalcSheetHeader context={context} result={result} elementTypeLabel="Wall" />
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No detailed calculation data recorded for this member yet.
        </Text>
      </ReportPage>
    );
  }

  const { input, report } = calc;

  const checklist: ChecklistItem[] = [
    {
      checkName: "Axial capacity (empirical method)",
      detail: `phiPnw = ${report.axialCapacity.phiPnwKN.toFixed(1)} kN, UR = ${report.axialCapacity.utilizationRatio.toFixed(2)}`,
      status: report.axialCapacity.adequate ? "pass" : "fail",
    },
    ...(report.shearCapacity
      ? [
          {
            checkName: "In-plane shear capacity",
            detail: `phiVn = ${report.shearCapacity.phiVnKN.toFixed(1)} kN, UR = ${report.shearCapacity.utilizationRatio.toFixed(2)}`,
            status: (report.shearCapacity.adequate ? "pass" : "fail") as ChecklistItem["status"],
          },
        ]
      : []),
  ];

  return (
    <ReportPage footerLabel={footerLabel} titleblock={titleblockBase}>
      <CalcSheetHeader context={context} result={result} elementTypeLabel="Wall" />

      <CalcSectionHeading>A. Input Data</CalcSectionHeading>
      <LabeledValueRow label="Wall Type" value={input.isShearWall ? "Shear Wall" : "Bearing Wall"} />
      <LabeledValueRow label="Thickness" value={`${input.thicknessMm} mm`} />
      <LabeledValueRow label="Length (in-plane)" value={`${(input.lengthMm / 1000).toFixed(2)} m`} />
      <LabeledValueRow label="Unsupported Height" value={`${(input.unsupportedHeightMm / 1000).toFixed(2)} m`} />
      <LabeledValueRow label="Effective Length Factor, k" value={input.effectiveLengthFactor.toFixed(2)} />
      <LabeledValueRow label="f'c / fy" value={`${input.fcMPa} MPa / ${input.fyMPa} MPa`} />
      <LabeledValueRow label="Longitudinal/Vertical Bar Diameter" value={`${input.barDiameterMm} mm`} />
      <LabeledValueRow label="Factored Axial Load, Pu" value={`${input.factoredAxialLoadKN.toFixed(1)} kN`} />
      {input.factoredInPlaneShearKN !== undefined && (
        <LabeledValueRow label="Factored In-Plane Shear, Vu" value={`${input.factoredInPlaneShearKN.toFixed(1)} kN`} />
      )}
      <LabeledValueRow label="Governing Load Combination" value={result.governingLoadCombinationId ?? "Not specified"} />

      <CalcSectionHeading>B. Design Calculation</CalcSectionHeading>

      <CalcSubHeading>Axial Capacity (Empirical Method)</CalcSubHeading>
      <LabeledValueRow label="Slenderness ratio, klc/h" value={report.axialCapacity.slendernessRatio.toFixed(2)} />
      <LabeledValueRow label="phiPnw" value={`${report.axialCapacity.phiPnwKN.toFixed(1)} kN`} />
      <LabeledValueRow label="Utilization ratio" value={report.axialCapacity.utilizationRatio.toFixed(2)} />
      <LabeledValueRow label="Adequate" value={report.axialCapacity.adequate ? "Yes" : "No"} />
      <WarningList warnings={report.axialCapacity.warnings} />

      <CalcSubHeading>Minimum Reinforcement</CalcSubHeading>
      <LabeledValueRow
        label="Min. vertical ratio / As"
        value={`${report.minReinforcement.minVerticalRatio.toFixed(4)} / ${report.minReinforcement.minVerticalAsPerMeterMm2.toFixed(0)} mm2/m`}
      />
      <LabeledValueRow
        label="Min. horizontal ratio / As"
        value={`${report.minReinforcement.minHorizontalRatio.toFixed(4)} / ${report.minReinforcement.minHorizontalAsPerMeterMm2.toFixed(0)} mm2/m`}
      />

      {report.shearCapacity ? (
        <>
          <CalcSubHeading>In-Plane Shear Capacity (Shear Wall)</CalcSubHeading>
          <LabeledValueRow label="phiVn" value={`${report.shearCapacity.phiVnKN.toFixed(1)} kN`} />
          <LabeledValueRow label="Utilization ratio" value={report.shearCapacity.utilizationRatio.toFixed(2)} />
          <LabeledValueRow label="Adequate" value={report.shearCapacity.adequate ? "Yes" : "No"} />
          <WarningList warnings={report.shearCapacity.warnings} />
        </>
      ) : (
        <>
          <CalcSubHeading>In-Plane Shear Capacity</CalcSubHeading>
          <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
            Not applicable — this wall was not designed as a shear wall (isShearWall = false).
          </Text>
        </>
      )}

      <WarningList warnings={report.allWarnings} />

      <CalcSectionHeading>C. Design Summary</CalcSectionHeading>
      <LabeledValueRow label="Final Reinforcement" value={result.finalReinforcementSummary ?? "Not recorded"} />
      <CalcChecklist items={checklist} />

      <CalcSectionHeading>D. Reference</CalcSectionHeading>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted }}>
        Axial capacity: ACI 318-19 Eq. 11.5.3.1 (empirical method). Minimum reinforcement: ACI 318-19 §11.6.1.
        In-plane shear: ACI 318-19 Eq. 11.5.4.6 (simplified, slender-wall coefficient assumed).
      </Text>
    </ReportPage>
  );
}
