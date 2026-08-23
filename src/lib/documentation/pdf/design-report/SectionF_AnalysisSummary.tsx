/**
 * Section F — Analysis Summary (Phase 11c; Report-Audit Phase A
 * এ 2026-08-20 এ সম্প্রসারিত)
 *
 * প্লানের চাহিদা: "Analysis type ব্যবহৃত (যেগুলো actually চালানো
 * হয়েছে); Key results: maximum displacement (story drift), base
 * reactions, fundamental period/mode shapes (modal analysis হয়ে
 * থাকলে); Story drift check টেবিল (BNBC limit vs actual); Irregularity
 * check summary (torsion, soft-story — যদি প্রযোজ্য)"।
 *
 * Report-Audit (CivilOS-Report-Audit.md) এ ধরা পড়েছিল Structural
 * Analysis Report PDF-এ ৬টা quantity (Story Displacement, Base
 * Reaction, Base Shear, Story Shear, Overturning Moment, Modal Mass
 * Participation) এবং Torsion/Irregularity check-এর ফলাফল — কোনোটাই
 * printed হচ্ছিল না, যদিও torsionCheck.ts/irregularityCheck.ts কোডে
 * বাস্তবেই আছে ও কাজ করে (আগের এই কমেন্টের দাবি যে ফাংশন খুঁজে
 * পাওয়া যায়নি তা ভুল ছিল — ফাংশনের নাম computeTorsionCheck/
 * computeIrregularityCheck, computeTorsionalIrregularity/
 * computeSoftStoryCheck নামে খোঁজা হয়েছিল বলে miss হয়েছিল)। এই
 * সংস্করণে সেই wiring যোগ করা হলো (A1, A2, A3, A5) — এবং A6 (Modal Mass
 * Participation Ratio) ও যোগ করা হলো, backend কোড আরেকটু খুঁজে বের করার পর
 * বোঝা গেল নতুন solver কাজ লাগেনি: solveResponseSpectrum() (SolversEngine
 * repo, cpp/src/solver.cpp) RSA-র ভেতরেই Γᵢ (participation factor) ও mᵢ*
 * (effective modal mass) already গণনা করে ও bindings.cpp দিয়ে JSON output
 * করে, এবং frontend runAnalysis.ts ইতিমধ্যেই সেটা ParsedResponseSpectrumResult.
 * modalDetails এ parse করছিল — শুধু Section F PDF এ কখনো দেখানো হয়নি। এই
 * ডেটা শুধু RSA run-এ পাওয়া যায় (plain Modal Analysis এ না, নিচে A6 এর
 * কোডে explicit note আছে)। A4 (Deformed Shape snapshot) ও এই সংস্করণে
 * যোগ করা হলো — client-side WebGL viewport (DeformedShapeSnapshotCanvas.tsx,
 * offscreen React Three Fiber canvas) থেকে base64 PNG capture করে POST
 * body দিয়ে server-এ পাঠানো হয় (route.tsx এখন GET এর পাশাপাশি POST ও
 * সমর্থন করে), তারপর এখানে <Image> হিসেবে বসানো হয়। GET path (snapshot
 * ছাড়া) ও client-side capture ব্যর্থ হওয়া — দুটো ক্ষেত্রেই honest
 * "not available" নোট দেখায়, ব্লক করে না (snapshot optional enhancement)।
 *
 * সততার সাথে সীমাবদ্ধতা জানানো দরকার:
 *   - Story drift check computeStoryDriftCheck() (storyDrift.ts) দিয়ে
 *     সরাসরি হিসাব করা যায়, কিন্তু তার একটা fundamentalPeriodSeconds
 *     ইনপুট লাগে যা normally modal analysis (ParsedModalResult.modes[0])
 *     থেকে আসে। latestAnalysis একটা linear-static run হলে (modal
 *     আলাদা, না-ও চালানো থাকতে পারে) drift check "requires modal
 *     analysis" নোট সহ বাদ দেওয়া হয় — ভুল/অনুমাননির্ভর period দিয়ে
 *     হিসাব না করে। একই কারণে Torsion/Irregularity check-ও drift-এর
 *     উপর নির্ভরশীল অংশে (stiffness/weak-storey) সীমিত থাকে।
 *   - Irregularity check-এর storyShears input এখানে খালি [] পাস করা
 *     হচ্ছে — এই ReportContext এখনো seismicLoad/windLoad এর
 *     per-story storyForces বহন করে না (আলাদা fetch/computation,
 *     এই Phase-এর scope না)। ফলে Stiffness Irregularity ও Weak
 *     Storey sub-check "storyShear ডেটা অনুপস্থিত" ওয়ার্নিং সহ খালি
 *     থাকবে — Geometric ও Torsional Irregularity (storyShears-নির্ভর
 *     না) স্বাভাবিকভাবে চলবে।
 *   - Base Shear/Overturning Moment শুধু Linear Static run-এ পাওয়া
 *     যায় (reactionForces backend limitation, globalResponseSummary.ts
 *     দেখুন) — অন্য run type এ "Not available" note সহ বাদ যাবে।
 *   - Story Shear (per-story cut-plane force) এই backend structure এ
 *     honest ভাবে derive করা সম্ভব না (base-only boundary condition,
 *     globalResponseSummary.ts এর মডিউল-লেভেল কমেন্ট দেখুন) — তাই
 *     শুধু Base Shear দেখানো হয়, per-story শুধু ওয়ার্নিং নোট।
 */

import { View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { StatusBadge } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { computeStoryDriftCheck, type StoryDriftResult } from "@/lib/analysis/storyDrift";
import type { ParsedModalResult, ParsedResponseSpectrumResult, ResponseSpectrumModalDetail } from "@/lib/analysis/runAnalysis";
import {
  computeGlobalResponseSummary,
  computeStoryDisplacementSummary,
  type StoryDisplacementResult,
} from "@/lib/analysis/globalResponseSummary";
import { computeTorsionCheck, type StoryTorsionResult } from "@/lib/analysis/torsionCheck";
import { computeIrregularityCheck } from "@/lib/analysis/irregularityCheck";
import {
  computeMemberForceSummary,
  type MemberForceSummaryRow,
  type MemberForceGroupCategory,
} from "@/lib/analysis/memberForceSummary";

export interface AnalysisSummaryProps {
  context: ReportContext;
  /** Report-Audit Phase A4 — client-side WebGL viewport থেকে POST body তে আসা base64 PNG snapshot, DesignReportDocument হয়ে pass-through। null মানে snapshot নেই (GET download, বা client-side capture ব্যর্থ)। */
  deformedShapeSnapshotDataUrl?: string | null;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  subheading: {
    fontSize: pdfFontSize.h2,
    fontFamily: "Helvetica-Bold",
    marginTop: pdfSpacing.sectionGap,
    marginBottom: 6,
  },
  descRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  descLabel: {
    width: 180,
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  descValue: {
    flex: 1,
    fontSize: pdfFontSize.body,
  },
  note: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 4,
  },
  groupLabel: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 4,
  },
  snapshotContainer: {
    marginTop: 4,
    marginBottom: pdfSpacing.sectionGap,
  },
  snapshotImage: {
    width: "100%",
    maxHeight: 320,
    objectFit: "contain",
    marginBottom: 4,
  },
});

const MEMBER_FORCE_GROUP_LABEL: Record<MemberForceGroupCategory, string> = {
  beam: "Beams",
  column: "Columns / Braces / Piles",
  wall: "Walls / Shear Walls / Core Walls",
  slab: "Slabs",
  other: "Other (unmapped elementId)",
};

const RUN_TYPE_LABEL: Record<string, string> = {
  "linear-static": "Linear Static",
  modal: "Modal (Eigenvalue)",
  "p-delta": "P-Delta",
  "response-spectrum": "Response Spectrum Analysis",
  "nonlinear-static": "Nonlinear Static (Pushover)",
  buckling: "Linear Buckling",
};

export function AnalysisSummary({ context, deformedShapeSnapshotDataUrl }: AnalysisSummaryProps) {
  const latest = context.latestAnalysis;

  if (!latest) {
    return (
      <ReportPage footerLabel="Structural Design Report — Section F: Analysis Summary">
        <Text style={styles.heading}>F. Analysis Summary</Text>
        <Text style={styles.descValue}>No successful analysis run found for this project.</Text>
      </ReportPage>
    );
  }

  const modalResult = latest.results.find(
    (r): r is { runType: "modal" } & ParsedModalResult => r.runType === "modal"
  );
  // A6 — Modal Mass Participation Ratio শুধু Response Spectrum (RSA) run এর
  // modalDetails/totalMassParticipationRatio এ পাওয়া যায় (solver.cpp এর
  // solveResponseSpectrum() ভেতরে Γᵢ/mᵢ* গণনা করে, কিন্তু শুধু RSA-নির্দিষ্ট
  // directionDOF ইনপুট দিয়ে — plain Modal Analysis (solveModalAnalysis)
  // এই ডেটা compute করে না, তাই ModalMode তে এই field নেই)। অর্থাৎ এটা নতুন
  // backend কাজ ছাড়াই দেখানো সম্ভব, কিন্তু শুধুমাত্র latest run RSA হলে —
  // অন্য run type এ সৎভাবে "Not available" দেখানো হয়, ভুলভাবে reuse করা হয় না।
  const rsaResult = latest.results.find(
    (r): r is { runType: "response-spectrum" } & ParsedResponseSpectrumResult =>
      r.runType === "response-spectrum"
  );
  const fundamentalPeriod = modalResult?.modes?.[0]?.naturalFrequencyHz
    ? 1 / modalResult.modes[0].naturalFrequencyHz
    : null;

  // Max displacement — সব linear-static নোডাল displacement এর মধ্যে সবচেয়ে বড় resultant।
  const linearStaticResult = latest.results.find((r) => r.runType === "linear-static");
  let maxDisplacementM: number | null = null;
  if (linearStaticResult && "nodalDisplacements" in linearStaticResult && linearStaticResult.nodalDisplacements) {
    maxDisplacementM = Math.max(
      ...linearStaticResult.nodalDisplacements.map((d) =>
        Math.sqrt(d.ux ** 2 + d.uy ** 2 + d.uz ** 2)
      )
    );
  }

  // Base reactions যোগফল — reactionForces থাকলে (A1)।
  const reactionForces =
    linearStaticResult && "reactionForces" in linearStaticResult ? linearStaticResult.reactionForces : undefined;
  const globalResponse = computeGlobalResponseSummary(reactionForces);
  const baseShearX = globalResponse.baseShearX;
  const baseShearZ = globalResponse.baseShearZ;

  // Story Displacement summary — সব story-র average + peak resultant displacement (A2)।
  const storyDisplacementSummary =
    linearStaticResult && "nodalDisplacements" in linearStaticResult && linearStaticResult.nodalDisplacements
      ? computeStoryDisplacementSummary(
          linearStaticResult.nodes,
          linearStaticResult.nodalDisplacements.map((d) => ({ ux: d.ux, uz: d.uz })),
          context.geometry.stories
        )
      : { results: [] as StoryDisplacementResult[], warnings: ["Story Displacement — এই run-এ nodal displacement পাওয়া যায়নি।"] };

  // Member Forces breakdown by category (A5)।
  const elementForces =
    linearStaticResult && "elementEndForces" in linearStaticResult ? linearStaticResult.elementEndForces : undefined;
  const memberForceSummary = computeMemberForceSummary(elementForces, context.elements);

  // Story drift — শুধু fundamentalPeriod পাওয়া গেলে (modal run থেকে)।
  let driftResults: StoryDriftResult[] | null = null;
  if (
    fundamentalPeriod !== null &&
    linearStaticResult &&
    "nodalDisplacements" in linearStaticResult &&
    linearStaticResult.nodalDisplacements &&
    linearStaticResult.nodes
  ) {
    const check = computeStoryDriftCheck({
      nodes: linearStaticResult.nodes,
      displacements: linearStaticResult.nodalDisplacements.map((d) => ({ ux: d.ux, uz: d.uz })),
      stories: context.geometry.stories,
      loadCategory: "seismic",
      fundamentalPeriodSeconds: fundamentalPeriod,
    });
    driftResults = check.results;
  }

  // Torsion Check (X ও Z উভয় দিক) ও Irregularity Check (A3) — nodalDisplacements লাগবে,
  // linearStaticResult ছাড়া চলে না। storyShears এখানে [] — মডিউল-হেড কমেন্টে কারণ ব্যাখ্যা করা আছে।
  let torsionResultsX: StoryTorsionResult[] = [];
  let torsionResultsZ: StoryTorsionResult[] = [];
  let irregularityWarnings: string[] = [];
  let hasAnyIrregularity = false;
  if (
    linearStaticResult &&
    "nodalDisplacements" in linearStaticResult &&
    linearStaticResult.nodalDisplacements &&
    linearStaticResult.nodes
  ) {
    const displacements = linearStaticResult.nodalDisplacements.map((d) => ({ ux: d.ux, uz: d.uz }));
    const torsionX = computeTorsionCheck({
      nodes: linearStaticResult.nodes,
      displacements,
      stories: context.geometry.stories,
      direction: "X",
    });
    const torsionZ = computeTorsionCheck({
      nodes: linearStaticResult.nodes,
      displacements,
      stories: context.geometry.stories,
      direction: "Z",
    });
    torsionResultsX = torsionX.results;
    torsionResultsZ = torsionZ.results;

    const irregularity = computeIrregularityCheck({
      nodes: linearStaticResult.nodes,
      displacements,
      stories: context.geometry.stories,
      driftResults: driftResults ?? [],
      storyShears: [],
    });
    hasAnyIrregularity = irregularity.hasAnyIrregularity;
    irregularityWarnings = irregularity.warnings;
  }

  return (
    <ReportPage footerLabel="Structural Design Report — Section F: Analysis Summary">
      <Text style={styles.heading}>F. Analysis Summary</Text>

      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Analysis Type</Text>
        <Text style={styles.descValue}>
          {latest.run.runType ? RUN_TYPE_LABEL[latest.run.runType] ?? latest.run.runType : "—"}
        </Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Run Date</Text>
        <Text style={styles.descValue}>{new Date(latest.run.runAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Maximum Displacement</Text>
        <Text style={styles.descValue}>
          {maxDisplacementM !== null ? `${(maxDisplacementM * 1000).toFixed(2)} mm` : "Not available"}
        </Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Base Shear (X / Z)</Text>
        <Text style={styles.descValue}>
          {baseShearX !== null && baseShearZ !== null
            ? `${baseShearX.toFixed(1)} kN / ${baseShearZ.toFixed(1)} kN`
            : "Not available"}
        </Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Overturning Moment (X / Z)</Text>
        <Text style={styles.descValue}>
          {globalResponse.overturningMomentX !== null && globalResponse.overturningMomentZ !== null
            ? `${globalResponse.overturningMomentX.toFixed(1)} kN·m / ${globalResponse.overturningMomentZ.toFixed(1)} kN·m`
            : "Not available"}
        </Text>
      </View>
      {globalResponse.unavailable && (
        <Text style={styles.note}>
          Base Shear ও Overturning Moment গণনার জন্য reaction force ডেটা প্রয়োজন, যা শুধু Linear Static run-এ পাওয়া
          যায়। Story Shear (per-story cut-plane force) এই backend-এ base-only boundary condition হওয়ায় derive করা
          যায়নি।
        </Text>
      )}
      {!globalResponse.unavailable && (
        <Text style={styles.note}>
          Story Shear (প্রতিটা story-র উপরে-নিচে কাটা তলে horizontal force) এই backend structure-এ (base-only
          support) সরাসরি derive করা যায়নি — শুধু Base Shear (উপরের সারি) প্রযোজ্য।
        </Text>
      )}
      {fundamentalPeriod !== null && (
        <View style={styles.descRow}>
          <Text style={styles.descLabel}>Fundamental Period (Mode 1)</Text>
          <Text style={styles.descValue}>{fundamentalPeriod.toFixed(3)} s</Text>
        </View>
      )}

      {modalResult?.modes && modalResult.modes.length > 0 && (
        <>
          <Text style={styles.subheading}>Mode Shapes</Text>
          <ReportTable<{ mode: number; frequencyHz: number; periodSeconds: number }>
            columns={[
              { key: "mode", header: "Mode", flex: 1 },
              {
                key: "frequencyHz",
                header: "Frequency (Hz)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.frequencyHz.toFixed(3)}</Text>,
              },
              {
                key: "periodSeconds",
                header: "Period (s)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.periodSeconds.toFixed(3)}</Text>,
              },
            ]}
            rows={modalResult.modes.map((m, i) => ({
              mode: i + 1,
              frequencyHz: m.naturalFrequencyHz,
              periodSeconds: 1 / m.naturalFrequencyHz,
            }))}
          />
        </>
      )}

      <Text style={styles.subheading}>Story Displacement</Text>
      {storyDisplacementSummary.results.length > 0 ? (
        <ReportTable<StoryDisplacementResult>
          columns={[
            { key: "storyName", header: "Story", flex: 1 },
            {
              key: "elevation",
              header: "Elevation (m)",
              flex: 1,
              align: "right",
              render: (row) => <Text>{row.elevation.toFixed(2)}</Text>,
            },
            {
              key: "avgDisplacementX",
              header: "Avg Ux (mm)",
              flex: 1,
              align: "right",
              render: (row) => <Text>{(row.avgDisplacementX * 1000).toFixed(2)}</Text>,
            },
            {
              key: "avgDisplacementZ",
              header: "Avg Uz (mm)",
              flex: 1,
              align: "right",
              render: (row) => <Text>{(row.avgDisplacementZ * 1000).toFixed(2)}</Text>,
            },
            {
              key: "maxResultantDisplacement",
              header: "Peak Resultant (mm)",
              flex: 1,
              align: "right",
              render: (row) => <Text>{(row.maxResultantDisplacement * 1000).toFixed(2)}</Text>,
            },
          ]}
          rows={storyDisplacementSummary.results}
        />
      ) : (
        <Text style={styles.descValue}>Not available for this analysis run.</Text>
      )}
      {storyDisplacementSummary.warnings.map((w) => (
        <Text key={w} style={styles.note}>
          {w}
        </Text>
      ))}

      <Text style={styles.subheading}>Story Drift Check</Text>
      {driftResults ? (
        <ReportTable<StoryDriftResult>
          columns={[
            { key: "storyName", header: "Story", flex: 1 },
            {
              key: "driftRatio",
              header: "Drift Ratio",
              flex: 1,
              align: "right",
              render: (row) => <Text>{row.driftRatio.toFixed(4)}</Text>,
            },
            {
              key: "allowableDriftRatio",
              header: "Allowable",
              flex: 1,
              align: "right",
              render: (row) => <Text>{row.allowableDriftRatio.toFixed(4)}</Text>,
            },
            {
              key: "isWithinLimit",
              header: "Status",
              flex: 1,
              render: (row) => <StatusBadge kind={row.isWithinLimit ? "pass" : "fail"} />,
            },
          ]}
          rows={driftResults}
        />
      ) : (
        <Text style={styles.descValue}>
          Not computed — story drift check requires a modal analysis run to determine the
          fundamental period, which was not found for this project.
        </Text>
      )}

      <Text style={styles.subheading}>Torsion Check (BNBC 2020 — Amplification Factor Ax)</Text>
      {torsionResultsX.length > 0 || torsionResultsZ.length > 0 ? (
        <ReportTable<StoryTorsionResult>
          columns={[
            { key: "storyName", header: "Story", flex: 1 },
            { key: "direction", header: "Direction", flex: 1 },
            {
              key: "ratio",
              header: "Max/Avg Ratio",
              flex: 1,
              align: "right",
              render: (row) => <Text>{row.ratio.toFixed(2)}</Text>,
            },
            {
              key: "amplificationFactorAx",
              header: "Ax",
              flex: 1,
              align: "right",
              render: (row) => <Text>{row.amplificationFactorAx.toFixed(2)}</Text>,
            },
            {
              key: "isTorsionallyIrregular",
              header: "Status",
              flex: 1,
              render: (row) => (
                <StatusBadge
                  kind={row.isExtremeTorsionallyIrregular ? "fail" : row.isTorsionallyIrregular ? "warning" : "pass"}
                />
              ),
            },
          ]}
          rows={[...torsionResultsX, ...torsionResultsZ]}
        />
      ) : (
        <Text style={styles.descValue}>
          Not computed — Torsion Check requires a Linear Static run with nodal displacement data.
        </Text>
      )}

      <Text style={styles.subheading}>Irregularity Check Summary</Text>
      {torsionResultsX.length > 0 || torsionResultsZ.length > 0 ? (
        <Text style={styles.descValue}>
          Overall irregularity found: {hasAnyIrregularity ? "Yes — see notes below" : "No"}
        </Text>
      ) : (
        <Text style={styles.descValue}>
          Not computed — Irregularity Check requires a Linear Static run with nodal displacement data.
        </Text>
      )}
      {irregularityWarnings.map((w) => (
        <Text key={w} style={styles.note}>
          {w}
        </Text>
      ))}
      <Text style={styles.note}>
        Mass Irregularity — এই অ্যাপে per-story seismic weight ইনপুট করার উপায় এখনো নেই (মোট weight সব story-তে সমানভাবে
        ভাগ করা হয়), তাই সেই সাব-চেক এখানে গণনা করা যায়নি। Stiffness/Weak-Storey চেক storyShear ডেটা (seismicLoad/
        windLoad এর per-story force) ছাড়া চলে না — এই সংস্করণে সেই ডেটা এই রিপোর্টে এখনো integrate করা হয়নি।
      </Text>

      <Text style={styles.subheading}>Member Forces Summary (Peak per Element)</Text>
      {memberForceSummary.groups.length > 0 ? (
        memberForceSummary.groups.map((group) => (
          <View key={group.category} wrap={false}>
            <Text style={styles.groupLabel}>{MEMBER_FORCE_GROUP_LABEL[group.category]}</Text>
            <ReportTable<MemberForceSummaryRow>
              columns={[
                { key: "elementId", header: "Element ID", flex: 1 },
                {
                  key: "peakAxial",
                  header: "Peak Axial (kN)",
                  flex: 1,
                  align: "right",
                  render: (row) => <Text>{row.peakAxial.toFixed(1)}</Text>,
                },
                {
                  key: "peakShear",
                  header: "Peak Shear (kN)",
                  flex: 1,
                  align: "right",
                  render: (row) => <Text>{row.peakShear.toFixed(1)}</Text>,
                },
                {
                  key: "peakMoment",
                  header: "Peak Moment (kN·m)",
                  flex: 1,
                  align: "right",
                  render: (row) => <Text>{row.peakMoment.toFixed(1)}</Text>,
                },
              ]}
              rows={group.rows}
            />
          </View>
        ))
      ) : (
        <Text style={styles.descValue}>Not available for this analysis run.</Text>
      )}
      {memberForceSummary.warnings.map((w) => (
        <Text key={w} style={styles.note}>
          {w}
        </Text>
      ))}

      <Text style={styles.subheading}>Deformed Shape</Text>
      {deformedShapeSnapshotDataUrl ? (
        <View style={styles.snapshotContainer} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer এর Image, DOM <img> না; এই লাইব্রেরির props এ alt সমর্থিত নেই (PDF ফাইলে ভিন্ন accessibility মডেল) */}
          <Image src={deformedShapeSnapshotDataUrl} style={styles.snapshotImage} />
          <Text style={styles.note}>
            Isometric snapshot captured from the client-side deformed-shape viewport at download time — reflects
            displacement from the analysis run current at that moment (may not match a later re-analysis).
          </Text>
        </View>
      ) : (
        <Text style={styles.note}>
          Not available — a static snapshot of the deformed shape is captured client-side (from the WebGL
          visualization viewport) at download time. This download request did not include one, either because it
          used the plain download link (no snapshot support) or the client-side capture failed silently. Live
          deformed shape animation is always available in the Visualization tab (DeformationAnimator).
        </Text>
      )}

      <Text style={styles.subheading}>Modal Mass Participation Ratio</Text>
      {rsaResult && rsaResult.modalDetails && rsaResult.modalDetails.length > 0 ? (
        <>
          <ReportTable<ResponseSpectrumModalDetail & { mode: number }>
            columns={[
              { key: "mode", header: "Mode", flex: 1 },
              {
                key: "participationFactor",
                header: "Participation Factor (Γ)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.participationFactor.toFixed(4)}</Text>,
              },
              {
                key: "effectiveMass",
                header: "Effective Mass (kN·s²/m)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.effectiveMass.toFixed(2)}</Text>,
              },
            ]}
            rows={rsaResult.modalDetails.map((m, i) => ({ mode: i + 1, ...m }))}
          />
          <Text style={styles.descValue}>
            Total Mass Participation Ratio:{" "}
            {rsaResult.totalMassParticipationRatio !== undefined
              ? `${(rsaResult.totalMassParticipationRatio * 100).toFixed(1)}%`
              : "Not available"}
          </Text>
          <Text style={styles.note}>
            এই মান Response Spectrum Analysis run থেকে, একটা নির্দিষ্ট ground-motion direction-এর জন্য (RSA input-এ
            নির্ধারিত directionDof) — একাধিক direction-এর mass participation দেখতে হলে সেই direction-এ আলাদা RSA
            চালাতে হবে।
          </Text>
        </>
      ) : (
        <Text style={styles.note}>
          Not available for this run — Modal Mass Participation Ratio শুধু Response Spectrum Analysis (RSA) run-এ
          computed হয় (solveResponseSpectrum backend function-এর অংশ)। এই প্রজেক্টের latest run{" "}
          {latest.run.runType ? RUN_TYPE_LABEL[latest.run.runType] ?? latest.run.runType : "unknown"} — Mass
          Participation দেখতে একটা Response Spectrum run প্রয়োজন। Plain Modal Analysis (solveModalAnalysis) এই মান
          compute করে না।
        </Text>
      )}
    </ReportPage>
  );
}
