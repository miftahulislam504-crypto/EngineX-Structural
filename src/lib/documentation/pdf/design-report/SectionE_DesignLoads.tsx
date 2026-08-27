/**
 * Section E — Design Loads Summary (Phase 11c)
 *
 * প্লানের চাহিদা: "Dead Load breakdown; Live Load (occupancy-wise);
 * Wind Load — base shear, pressure coefficients, calculation summary;
 * Seismic Load — zone, soil type, response reduction factor, base
 * shear; Load Combinations টেবিল"।
 *
 * সততার সাথে সীমাবদ্ধতা জানানো দরকার:
 *   - "Wind Load base shear" ও "Seismic Load base shear" — এগুলো
 *     analysis run এর reactionForces থেকে (base support reaction
 *     sum) বের করা সম্ভব, কিন্তু শুধু latestAnalysis.run এ যদি সেই
 *     load combination ব্যবহৃত হয়ে থাকে। এই সেকশন LoadPattern
 *     category অনুযায়ী list করে (dead/live/wind/earthquake ইত্যাদি),
 *     কিন্তু pattern-নির্দিষ্ট base shear সংখ্যা analysisResult এর সাথে
 *     cross-reference করার জন্য আলাদা যুক্তি লাগে যা Section F
 *     (Analysis Summary) এ থাকে reactionForces থেকে — এখানে ডুপ্লিকেট
 *     না করে Section F কে refer করা হলো।
 *   - "response reduction factor" (R factor) — কোনো টাইপে (LoadPattern,
 *     HubSiteInformation) এই নির্দিষ্ট ফিল্ড নেই, তাই "Not specified"
 *     দেখানো হয়।
 *
 * Item-wise Self-Weight Breakdown (Report-Audit Phase B8, 2026-08-20) —
 * আগে শুধু selfWeightMultiplier (dead pattern এর একটা সংখ্যা) দেখানো
 * হতো, actual category-wise weight (Beam vs Column vs Slab, কত kN)
 * কোথাও ছিল না। selfWeightBreakdown.ts (computeSelfWeightBreakdown)
 * থেকে সেটা এখন যোগ করা হলো — honest সীমাবদ্ধতা: Wall/Shear-Wall/
 * Core-Wall এই breakdown এ নেই (vertical-plane area calculator এই
 * কোডবেসে নেই), warnings এ স্পষ্ট বলা আছে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { LoadPattern } from "@/lib/types/load";
import type { LoadCombination } from "@/lib/loads/loadCombinations";
import { computeSelfWeightBreakdown, type SelfWeightGroup, type SelfWeightGroupCategory } from "@/lib/documentation/compute/selfWeightBreakdown";

export interface DesignLoadsProps {
  context: ReportContext;
  revisionNumber: string;
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
});

const CATEGORY_LABEL: Record<string, string> = {
  dead: "Dead Load (DL)",
  live: "Live Load (LL)",
  wind: "Wind Load (W)",
  earthquake: "Seismic Load (E)",
  snow: "Snow Load",
  rain: "Rain Load",
  temperature: "Temperature Load",
  settlement: "Settlement Load",
  hydrostatic: "Hydrostatic Load",
  "soil-pressure": "Soil Pressure Load",
};

const SELF_WEIGHT_GROUP_LABEL: Record<SelfWeightGroupCategory, string> = {
  beam: "Beams",
  column: "Columns",
  slab: "Slabs (incl. Mat Foundation)",
  footing: "Isolated Footings",
  "other-unresolved": "Other",
};

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function DesignLoads({ context, revisionNumber }: DesignLoadsProps) {
  const site = context.hub?.siteInformation ?? null;
  const project = context.hub?.projectInfo ?? null;
  const patternsByCategory = new Map<string, LoadPattern[]>();
  for (const p of context.loadPatterns) {
    const list = patternsByCategory.get(p.category) ?? [];
    list.push(p);
    patternsByCategory.set(p.category, list);
  }

  const selfWeight = computeSelfWeightBreakdown(context.elements, context.materials.materials, context.sections.sections);

  return (
    <ReportPage
      footerLabel="Structural Design Report — Section E: Design Loads Summary"
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: "DR-E",
        sheetTitle: "Design Report — Section E: Design Loads Summary",
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>E. Design Loads Summary</Text>

      {Array.from(patternsByCategory.entries()).map(([category, patterns]) => (
        <View key={category}>
          <Text style={styles.subheading}>{CATEGORY_LABEL[category] ?? category}</Text>
          {patterns.map((p) => (
            <View key={p.patternId} style={styles.descRow}>
              <Text style={styles.descLabel}>{p.name}</Text>
              <Text style={styles.descValue}>
                {p.selfWeightMultiplier !== undefined
                  ? `Self-weight multiplier: ${p.selfWeightMultiplier}`
                  : "—"}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.subheading}>Item-wise Self-Weight Breakdown</Text>
      {selfWeight.groups.length > 0 ? (
        <>
          <ReportTable<SelfWeightGroup>
            columns={[
              {
                key: "category",
                header: "Element Type",
                flex: 1,
                render: (row) => <Text>{SELF_WEIGHT_GROUP_LABEL[row.category]}</Text>,
              },
              { key: "elementCount", header: "Count", flex: 1, align: "right" },
              {
                key: "totalVolumeM3",
                header: "Concrete Volume (m³)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.totalVolumeM3.toFixed(2)}</Text>,
              },
              {
                key: "totalSelfWeightKN",
                header: "Self-Weight (kN)",
                flex: 1,
                align: "right",
                render: (row) => <Text>{row.totalSelfWeightKN.toFixed(1)}</Text>,
              },
            ]}
            rows={selfWeight.groups}
          />
          <View style={styles.descRow}>
            <Text style={styles.descLabel}>Total (Beam+Column+Slab+Footing)</Text>
            <Text style={styles.descValue}>{selfWeight.totalSelfWeightKN.toFixed(1)} kN</Text>
          </View>
        </>
      ) : (
        <Text style={styles.descValue}>Not available — no elements with resolvable self-weight in this model.</Text>
      )}
      {selfWeight.warnings.map((w) => (
        <Text key={w} style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 }}>
          {w}
        </Text>
      ))}

      <Text style={styles.subheading}>Seismic / Wind Site Parameters</Text>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Seismic Zone</Text>
        <Text style={styles.descValue}>{site?.seismicZone ?? "Not specified"}</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Soil Type</Text>
        <Text style={styles.descValue}>{site?.soilType ?? "Not specified"}</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Basic Wind Speed</Text>
        <Text style={styles.descValue}>
          {site?.windSpeed !== undefined ? `${site.windSpeed} m/s` : "Not specified"}
        </Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Exposure Category</Text>
        <Text style={styles.descValue}>{site?.exposureCategory ?? "Not specified"}</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Response Reduction Factor (R)</Text>
        <Text style={styles.descValue}>
          Not specified — no source field in current data model
        </Text>
      </View>
      <Text style={[styles.descValue, { marginTop: 4, color: pdfColors.inkMuted, fontSize: pdfFontSize.caption }]}>
        Base shear values are reported in Section F (Analysis Summary), derived from the governing
        analysis run&apos;s reaction forces.
      </Text>

      <Text style={styles.subheading}>Load Combinations</Text>
      <ReportTable<LoadCombination>
        columns={[
          { key: "name", header: "Combination", flex: 1 },
          { key: "formula", header: "Formula", flex: 2 },
          { key: "source", header: "Source", flex: 1 },
          {
            key: "isEnabled",
            header: "Enabled",
            flex: 1,
            align: "center",
            render: (row) => <Text>{row.isEnabled ? "Yes" : "No"}</Text>,
          },
        ]}
        rows={context.loadCombinations}
      />
    </ReportPage>
  );
}
