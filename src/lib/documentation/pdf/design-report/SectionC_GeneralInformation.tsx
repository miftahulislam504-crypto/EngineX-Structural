/**
 * Section C — General Information (Phase 11c)
 *
 * প্লানের চাহিদা: "Building description: no. of stories, height,
 * occupancy type, structural system; Levels summary (Hub থেকে Levels
 * ডেটা — story height, elevation টেবিল আকারে); Grid summary (Hub
 * থেকে Grid — axis labels, spacing টেবিল আকারে)"।
 *
 * সততার সাথে দুটো সীমাবদ্ধতা এখানে জানানো দরকার:
 *   ১. "occupancy type" ও "structural system" (RC frame/dual system)
 *      — এই দুইটার জন্য HubProjectInfo/HubSiteInformation/GeometryCore
 *      কোনোটাতেই কোনো ফিল্ড নেই। এই কোডবেসে কোথাও এই ডেটা সংরক্ষণ
 *      করার জায়গা নেই — তাই এই সেকশন সেই দুইটা ফিল্ড ফাঁকা/"Not
 *      specified" দেখায়, অনুমান করে বসায় না।
 *   ২. Levels/Grid — প্লানে "Hub থেকে" বলা আছে, কিন্তু এই App নিজস্ব
 *      GeometryCore (StructuralStory[]/StructuralGrid[]) রাখে যা Hub
 *      এর HubLevel/HubGrid থেকে সিড হতে পারে কিন্তু independently
 *      এডিটযোগ্য (geometry.ts এর নিজস্ব কমেন্ট অনুযায়ী)। রিপোর্ট
 *      সবসময় GeometryCore (এই App এর নিজের, latest edited) থেকে
 *      দেখায় — Hub এর মূল কপি থেকে না — কারণ ইঞ্জিনিয়ার এই App এ যা
 *      দেখছেন/এডিট করছেন সেটাই actual design basis, Hub এর snapshot
 *      পুরনো হয়ে থাকতে পারে সিঙ্ক না হলে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { StructuralStory, StructuralGrid } from "@/lib/types/geometry";

export interface GeneralInformationProps {
  context: ReportContext;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper — এই কোডবেসে shared utility না বানিয়ে per-file duplicate রাখার existing pattern অনুসরণ করা হলো। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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
    width: 160,
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  descValue: {
    flex: 1,
    fontSize: pdfFontSize.body,
  },
});

export function GeneralInformation({ context, revisionNumber }: GeneralInformationProps) {
  const stories = [...context.geometry.stories].sort((a, b) => a.order - b.order);
  const grids = [...context.geometry.grids].sort(
    (a, b) => a.direction.localeCompare(b.direction) || a.coordinate - b.coordinate
  );
  const topStory = stories[stories.length - 1];
  const baseStory = stories.find((s) => s.isBaseLevel) ?? stories[0];
  const totalHeight =
    topStory && baseStory ? topStory.elevation + topStory.height - baseStory.elevation : null;
  const project = context.hub?.projectInfo ?? null;

  return (
    <ReportPage
      footerLabel="Structural Design Report — Section C: General Information"
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: "DR-C",
        sheetTitle: "Design Report — Section C: General Information",
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>C. General Information</Text>

      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Number of Stories</Text>
        <Text style={styles.descValue}>{stories.length || "—"}</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Total Height</Text>
        <Text style={styles.descValue}>
          {totalHeight !== null ? `${totalHeight.toFixed(2)} m` : "—"}
        </Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Occupancy Type</Text>
        <Text style={styles.descValue}>Not specified — no source field in current data model</Text>
      </View>
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Structural System</Text>
        <Text style={styles.descValue}>Not specified — no source field in current data model</Text>
      </View>

      <Text style={styles.subheading}>Levels Summary</Text>
      <ReportTable<StructuralStory>
        columns={[
          { key: "name", header: "Level", flex: 2 },
          {
            key: "elevation",
            header: "Elevation (m)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.elevation.toFixed(2)}</Text>,
          },
          {
            key: "height",
            header: "Story Height (m)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.height.toFixed(2)}</Text>,
          },
        ]}
        rows={stories}
      />

      <Text style={styles.subheading}>Grid Summary</Text>
      <ReportTable<StructuralGrid>
        columns={[
          { key: "label", header: "Axis Label", flex: 1 },
          { key: "direction", header: "Direction", flex: 1 },
          {
            key: "coordinate",
            header: "Coordinate (m)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.coordinate.toFixed(2)}</Text>,
          },
        ]}
        rows={grids}
      />
    </ReportPage>
  );
}
