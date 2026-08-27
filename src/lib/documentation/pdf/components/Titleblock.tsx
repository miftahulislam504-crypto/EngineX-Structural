/**
 * Titleblock — Phase 11b, rebuilt per the CivilOS ecosystem-wide
 * unified sheet design spec (SHEET-DESIGN-SPEC.md, 2026-08-25).
 *
 * This replaces the earlier horizontal top-row layout (two stacked
 * rows: project+code, then sheet title/scale/date/rev/sheet-no). That
 * version's own comment explained it was built without access to
 * EngineXDraw's code (a separate repo) and so followed the *described*
 * structure (project/sheet-no/scale/date/revision blocks) rather than
 * matching it visually. The spec now fixes a single reference layout —
 * a full-height vertical sidebar on the right, ~35% of page width,
 * with the block sequence and typography scale defined in the spec —
 * and this component implements that sequence directly in react-pdf,
 * against this file's own existing pdfColors/pdfFontSize/pdfSpacing
 * tokens (no new tokens introduced; values below map to the closest
 * existing token, noted per block).
 *
 * SCOPE NOTE: this component (via ReportSheetPage) is currently wired
 * into Drawing Sheets (S-xx) only. The spec also calls for the same
 * sidebar on this app's other 5 document kinds (Design Report, BBS,
 * Calc Sheets, QC Report, General Notes) with a "REPORT TYPE :" label
 * swap and no Scale block — but those are rendered through ReportPage
 * directly in 16+ separate section/sheet files, not through this
 * component, so wiring it there is a separate follow-up, not done as
 * part of this change.
 *
 * DATA NOTE: HubProjectInfo (src/lib/types/hub.ts) has no Job No.,
 * Status, Company info, Detail/Design/Checked/Approved-By, or
 * Copyright-notice fields — verified by reading the type directly, and
 * confirmed nothing equivalent exists elsewhere in this repo (grepped
 * for detailByName/designByName/checkedByName/approvedByName/jobNo/
 * companyName/copyrightNotice — no matches). Rather than expanding
 * HubProjectInfo (a Hub-sync data-model change, out of scope for a
 * visual-parity task), those blocks are added here as optional props
 * with sane fallback text ("—" for a missing name, block omitted
 * entirely for company/copyright since inventing placeholder company
 * info would be dishonest, not just incomplete). Callers can supply
 * real values once this app has somewhere to source them from; until
 * then the sidebar is honest about what it doesn't have, not silently
 * blank in a way that looks broken.
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { HubProjectInfo } from "@/lib/types/hub";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

/** Spec section 4.2 — only "drawing-sheets" is an actual scaled drawing; the other 5 document kinds this app produces are reports (no Scale block, "REPORT TYPE :" label instead of "DRAWING TYPE :"). */
/**
 * Spec section 4.2 (corrected after reading each document's own
 * component, not just the API route's kind-name enum): "bbs" and
 * "general-notes" are download-bundling categories in this app's
 * documentation route, but their actual presentation is a drawing
 * sheet (BbsSheetDocument.tsx / GeneralNotesSheet.tsx both already use
 * ReportSheetPage with real S-xx sheet numbers and a real scale value)
 * — so those two behave exactly like "drawing-sheets" here, not like a
 * report. Only design-report / calc-sheets / qc-report are genuinely
 * report-kind (Design Report's sections, calculation sheets, QC
 * report) with no spatial scale.
 */
export type TitleblockDocumentKind =
  | "drawing-sheets"
  | "bbs"
  | "general-notes"
  | "design-report"
  | "calc-sheets"
  | "qc-report";

const DRAWING_LIKE_KINDS = new Set<TitleblockDocumentKind>(["drawing-sheets", "bbs", "general-notes"]);

const REPORT_KIND_LABEL: Record<"design-report" | "calc-sheets" | "qc-report", string> = {
  "design-report": "DESIGN REPORT",
  "calc-sheets": "CALCULATION SHEET",
  "qc-report": "QC REPORT",
};

export interface TitleblockCompanyInfo {
  name: string;
  addressLines?: string[];
  contactLine?: string;
}

export interface TitleblockSignOff {
  name?: string;
  credential?: string;
}

export interface TitleblockProps {
  project: HubProjectInfo | null;
  documentKind: TitleblockDocumentKind;
  /** e.g. "S-04", "S-10" for drawing sheets; still required for report kinds as their own document/section id. */
  sheetNumber: string;
  /** e.g. "Framing / Beam Layout Plan — Level 2", or a report section's own title. */
  sheetTitle: string;
  /** e.g. "1:100", "NTS" — only rendered when documentKind is "drawing-sheets" (see spec 4.2). Ignored otherwise. */
  scale?: string;
  /** caller-supplied (ReportContext.generatedAt), so the whole bundle shares one date. */
  date: string;
  revisionNumber: string;

  // Below: optional, not present anywhere in this app's current data
  // model (see file header DATA NOTE) — every one of these renders as
  // "—" when absent, the block itself is never hidden, since the
  // sidebar's fixed block sequence is part of the spec.
  jobNo?: string;
  status?: string;
  optionLabel?: string;
  company?: TitleblockCompanyInfo;
  detailBy?: TitleblockSignOff;
  designBy?: TitleblockSignOff;
  checkedBy?: TitleblockSignOff;
  approvedBy?: TitleblockSignOff;
  copyrightNotice?: string[];
}

const SIDEBAR_WIDTH_PERCENT = 35; // spec section 1 — measured against the MICON reference, matches EngineXDraw's own SIDEBAR_WIDTH_MM=62/frameWidth*0.35 cap

const styles = StyleSheet.create({
  sidebar: {
    width: `${SIDEBAR_WIDTH_PERCENT}%`,
    borderWidth: 1,
    borderColor: pdfColors.hairlineStrong,
    flexDirection: "column",
  },
  block: {
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.hairlineStrong,
    paddingVertical: pdfSpacing.rowPaddingV,
    paddingHorizontal: pdfSpacing.rowPaddingH,
  },
  blockLast: {
    paddingVertical: pdfSpacing.rowPaddingV,
    paddingHorizontal: pdfSpacing.rowPaddingH,
  },
  label: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
  },
  value: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica",
    color: pdfColors.ink,
    marginTop: 1,
    // Every value line here can come from user-entered project data of
    // unpredictable length — same reasoning as the old topRow's
    // projectName cap: this sidebar is `fixed` (repeats per page), so
    // an uncapped wrap would eat drawing-area space on every page, not
    // just one. maxHeight+overflow:hidden is this react-pdf version's
    // only available cap (no numberOfLines prop).
    maxHeight: pdfFontSize.body * 1.3 * 2,
    overflow: "hidden",
  },
  valueEmphasized: {
    fontSize: pdfFontSize.h2,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.ink,
    marginTop: 1,
    maxHeight: pdfFontSize.h2 * 1.25 * 2,
    overflow: "hidden",
  },
  valueSheetNo: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.ink,
    marginTop: 1,
  },
  companyName: {
    fontSize: pdfFontSize.h3,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.ink,
  },
  companyLine: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 1,
  },
  revisionTable: {
    flexDirection: "column",
  },
  revisionHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.hairlineStrong,
  },
  revisionRow: {
    flexDirection: "row",
    minHeight: 12,
  },
  revisionColRev: {
    width: "34%",
    borderRightWidth: 1,
    borderRightColor: pdfColors.hairlineStrong,
    padding: 2,
  },
  revisionColSig: {
    width: "33%",
    borderRightWidth: 1,
    borderRightColor: pdfColors.hairlineStrong,
    padding: 2,
  },
  revisionColDate: {
    width: "33%",
    padding: 2,
  },
  revisionHeaderText: {
    fontSize: pdfFontSize.caption,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.inkMuted,
  },
  signOffName: {
    fontSize: pdfFontSize.body,
    color: pdfColors.ink,
    marginTop: 1,
  },
  signOffCredential: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 1,
  },
  approvedSignatureSpace: {
    // Spec block #19 — reserves visible blank space for an actual
    // signature, same reasoning EngineXDraw's sidebar uses (minHeight
    // on this block only, not shared with Detail/Design/Checked By).
    minHeight: 16,
  },
  copyrightText: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkFaint,
    marginTop: 1,
  },
});

/** designCode.concrete/seismic/wind একসাথে একই মান হলে (সাধারণ কেস BNBC 2020) ডুপ্লিকেট না দেখিয়ে একবার দেখায়। */
function formatCodeBasis(designCode: HubProjectInfo["designCode"] | undefined): string {
  if (!designCode) return "—";
  const unique = Array.from(
    new Set([designCode.concrete, designCode.steel, designCode.seismic, designCode.wind])
  );
  return unique.join(" / ");
}

function drawingTypeLabelAndValue(documentKind: TitleblockDocumentKind): { label: string; value: string } {
  if (DRAWING_LIKE_KINDS.has(documentKind)) {
    return { label: "DRAWING TYPE :", value: "STRUCTURAL DRAWING" };
  }
  return { label: "REPORT TYPE :", value: REPORT_KIND_LABEL[documentKind as "design-report" | "calc-sheets" | "qc-report"] };
}

function titleLabel(documentKind: TitleblockDocumentKind): string {
  return DRAWING_LIKE_KINDS.has(documentKind) ? "DRAWING TITLE :" : "REPORT TITLE :";
}

export function Titleblock({
  project,
  documentKind,
  sheetNumber,
  sheetTitle,
  scale,
  date,
  revisionNumber,
  jobNo,
  status,
  optionLabel,
  company,
  detailBy,
  designBy,
  checkedBy,
  approvedBy,
  copyrightNotice,
}: TitleblockProps) {
  const { label: typeLabel, value: typeValue } = drawingTypeLabelAndValue(documentKind);
  const showScale = DRAWING_LIKE_KINDS.has(documentKind);

  return (
    <View style={styles.sidebar} fixed>
      {/* Block 1 — Company header */}
      {company && (
        <View style={styles.block}>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.addressLines?.map((line, i) => (
            <Text key={i} style={styles.companyLine}>
              {line}
            </Text>
          ))}
          {company.contactLine && <Text style={styles.companyLine}>{company.contactLine}</Text>}
        </View>
      )}

      {/* Block 2 — Drawing Type / Report Type */}
      <View style={styles.block}>
        <Text style={styles.label}>{typeLabel}</Text>
        <Text style={styles.valueEmphasized}>{typeValue}</Text>
      </View>

      {/* Block 3 — Status */}
      <View style={styles.block}>
        <Text style={styles.label}>STATUS :</Text>
        <Text style={styles.value}>{status ?? "—"}</Text>
      </View>

      {/* Block 4 — Job No. */}
      <View style={styles.block}>
        <Text style={styles.label}>JOB NO :</Text>
        <Text style={styles.value}>{jobNo ?? "—"}</Text>
      </View>

      {/* Block 5 — Project Name */}
      <View style={styles.block}>
        <Text style={styles.label}>PROJECT NAME :</Text>
        <Text style={styles.value}>{project?.projectName ?? "—"}</Text>
      </View>

      {/* Blocks 6/7 — Building Name / No. intentionally omitted: HubProjectInfo has no building fields (verified — see SHEET-DESIGN-SPEC.md section 4.2), unlike EngineXDraw's object model. */}

      {/* Block 8 — Client */}
      <View style={styles.block}>
        <Text style={styles.label}>CLIENT :</Text>
        <Text style={styles.valueEmphasized}>{project?.clientName ?? "—"}</Text>
      </View>

      {/* Block 9 — Location */}
      <View style={styles.block}>
        <Text style={styles.label}>LOCATION :</Text>
        <Text style={styles.value}>{project?.location?.address ?? "—"}</Text>
      </View>

      {/* Block 9b — Design Code basis (this app's own addition, not in the MICON reference — kept from the old titleblock since it's genuinely useful data this app has and the reference sheet has no equivalent field to drop it in favor of; placed right after Location so it doesn't disturb the spec's fixed block order above it). */}
      <View style={styles.block}>
        <Text style={styles.label}>DESIGN CODE :</Text>
        <Text style={styles.value}>{formatCodeBasis(project?.designCode)}</Text>
      </View>

      {/* Block 10 — Revision table */}
      <View style={styles.block}>
        <Text style={styles.label}>REVISION</Text>
        <View style={styles.revisionTable}>
          <View style={styles.revisionHeaderRow}>
            <View style={styles.revisionColRev}>
              <Text style={styles.revisionHeaderText}>REV.</Text>
            </View>
            <View style={styles.revisionColSig}>
              <Text style={styles.revisionHeaderText}>SIGNATURE</Text>
            </View>
            <View style={styles.revisionColDate}>
              <Text style={styles.revisionHeaderText}>DATE</Text>
            </View>
          </View>
          <View style={styles.revisionRow}>
            <View style={styles.revisionColRev}>
              <Text style={styles.value}>{revisionNumber}</Text>
            </View>
            <View style={styles.revisionColSig} />
            <View style={styles.revisionColDate}>
              <Text style={styles.value}>{date}</Text>
            </View>
          </View>
          {/* One blank row below the current revision, matching the reference sheet's own blank-rows-under-header shape (not a placeholder to remove later — see spec section 2.1 block #10 notes). */}
          <View style={styles.revisionRow}>
            <View style={styles.revisionColRev} />
            <View style={styles.revisionColSig} />
            <View style={styles.revisionColDate} />
          </View>
        </View>
      </View>

      {/* Block 11 — Drawing/Report Title */}
      <View style={styles.block}>
        <Text style={styles.label}>{titleLabel(documentKind)}</Text>
        <Text style={styles.valueEmphasized}>{sheetTitle}</Text>
      </View>

      {/* Block 12 — Option (only when supplied — spec allows omitting this block entirely rather than showing an empty "—") */}
      {optionLabel && (
        <View style={styles.block}>
          <Text style={styles.label}>OPTION :</Text>
          <Text style={styles.value}>{optionLabel}</Text>
        </View>
      )}

      {/* Block 13 — Date */}
      <View style={styles.block}>
        <Text style={styles.label}>DATE :</Text>
        <Text style={styles.value}>{date}</Text>
      </View>

      {/* Block 14 — Scale (drawing-sheets only, per spec 4.2) */}
      {showScale && (
        <View style={styles.block}>
          <Text style={styles.label}>SCALE :</Text>
          <Text style={styles.value}>{scale ?? "NTS"}</Text>
        </View>
      )}

      {/* Block 15 — Sheet No. */}
      <View style={styles.block}>
        <Text style={styles.label}>SHEET NO :</Text>
        <Text style={styles.valueSheetNo}>{sheetNumber}</Text>
      </View>

      {/* Blocks 16-18 — Detail / Design / Checked By, identical treatment (see approvedBy below for why Approved By is separate) */}
      <View style={styles.block}>
        <Text style={styles.label}>DETAIL BY :</Text>
        <Text style={styles.signOffName}>{detailBy?.name ?? "—"}</Text>
        {detailBy?.credential && <Text style={styles.signOffCredential}>{detailBy.credential}</Text>}
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>DESIGN BY :</Text>
        <Text style={styles.signOffName}>{designBy?.name ?? "—"}</Text>
        {designBy?.credential && <Text style={styles.signOffCredential}>{designBy.credential}</Text>}
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>CHECKED BY :</Text>
        <Text style={styles.signOffName}>{checkedBy?.name ?? "—"}</Text>
        {checkedBy?.credential && <Text style={styles.signOffCredential}>{checkedBy.credential}</Text>}
      </View>

      {/* Block 19 — Approved By: taller than 16-18, reserves visible blank signature space above the name (spec section 2.1 block #19 / EngineXDraw's own minHeight-based fix for the same block). */}
      <View style={styles.block}>
        <Text style={styles.label}>APPROVED BY :</Text>
        <View style={styles.approvedSignatureSpace} />
        <Text style={styles.signOffName}>{approvedBy?.name ?? "—"}</Text>
        {approvedBy?.credential && <Text style={styles.signOffCredential}>{approvedBy.credential}</Text>}
      </View>

      {/* Block 20 — Copyright/property notice. Omitted entirely (not shown as empty) when not supplied — see file header DATA NOTE on why this isn't invented. */}
      {copyrightNotice && copyrightNotice.length > 0 && (
        <View style={styles.blockLast}>
          {copyrightNotice.map((line, i) => (
            <Text key={i} style={styles.copyrightText}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
