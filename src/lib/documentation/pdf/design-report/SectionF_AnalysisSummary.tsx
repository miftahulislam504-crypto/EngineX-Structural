/**
 * Section F — Analysis Summary (Phase 11c)
 *
 * প্লানের চাহিদা: "Analysis type ব্যবহৃত (যেগুলো actually চালানো
 * হয়েছে); Key results: maximum displacement (story drift), base
 * reactions, fundamental period/mode shapes (modal analysis হয়ে
 * থাকলে); Story drift check টেবিল (BNBC limit vs actual); Irregularity
 * check summary (torsion, soft-story — যদি প্রযোজ্য)"।
 *
 * সততার সাথে সীমাবদ্ধতা জানানো দরকার:
 *   - Story drift check computeStoryDriftCheck() (storyDrift.ts) দিয়ে
 *     সরাসরি হিসাব করা যায়, কিন্তু তার একটা fundamentalPeriodSeconds
 *     ইনপুট লাগে যা normally modal analysis (ParsedModalResult.modes[0])
 *     থেকে আসে। latestAnalysis একটা linear-static run হলে (modal
 *     আলাদা, না-ও চালানো থাকতে পারে) drift check "requires modal
 *     analysis" নোট সহ বাদ দেওয়া হয় — ভুল/অনুমাননির্ভর period দিয়ে
 *     হিসাব না করে।
 *   - Irregularity check (torsion, soft-story) — এই কোডবেসে কোথাও
 *     computeTorsionalIrregularity/computeSoftStoryCheck জাতীয় কোনো
 *     ফাংশন পাওয়া যায়নি (validation/types.ts বা analysis/ ফোল্ডারে
 *     না)। তাই এই সাব-সেকশন "Not yet implemented in this workflow"
 *     নোট দেখায় — খালি রেখে চুপ থাকার বদলে explicit বলা হলো, যাতে
 *     ভবিষ্যতে কেউ (বা future Phase) এই gap মিস না করে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { StatusBadge } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { computeStoryDriftCheck, type StoryDriftResult } from "@/lib/analysis/storyDrift";
import type { ParsedModalResult } from "@/lib/analysis/runAnalysis";

export interface AnalysisSummaryProps {
  context: ReportContext;
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
});

const RUN_TYPE_LABEL: Record<string, string> = {
  "linear-static": "Linear Static",
  modal: "Modal (Eigenvalue)",
  "p-delta": "P-Delta",
  "response-spectrum": "Response Spectrum Analysis",
  "nonlinear-static": "Nonlinear Static (Pushover)",
  buckling: "Linear Buckling",
};

export function AnalysisSummary({ context }: AnalysisSummaryProps) {
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

  // Base reactions যোগফল — reactionForces থাকলে।
  let baseShearX: number | null = null;
  let baseShearZ: number | null = null;
  if (linearStaticResult && "reactionForces" in linearStaticResult && linearStaticResult.reactionForces) {
    baseShearX = linearStaticResult.reactionForces.reduce((sum, r) => sum + r.fx, 0);
    baseShearZ = linearStaticResult.reactionForces.reduce((sum, r) => sum + r.fz, 0);
  }

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

      <Text style={styles.subheading}>Irregularity Check Summary</Text>
      <Text style={styles.note}>
        Torsional and soft-story irregularity checks are not yet implemented in this workflow.
      </Text>
    </ReportPage>
  );
}
