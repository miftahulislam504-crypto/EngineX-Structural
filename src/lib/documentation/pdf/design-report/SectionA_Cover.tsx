/**
 * Section A — Cover / Title Page (Phase 11c)
 *
 * প্লানের চাহিদা: "Project name, location, client, structural
 * engineer/firm নাম; Report date, revision no., project ID (Hub
 * থেকে); Design code basis: BNBC 2020 / ACI 318-19 / AISC 360-16
 * (Hub থেকে আসা Design Code)"।
 *
 * "structural engineer/firm নাম" — HubProjectInfo তে কোনো নির্দিষ্ট
 * "firm name" ফিল্ড নেই, শুধু permissions[] (owner/editor/viewer,
 * ইমেইল+displayName সহ)। তাই owner এর displayName কে "Structural
 * Engineer" হিসেবে দেখানো হলো (owner সাধারণত প্রজেক্ট তৈরি করা
 * ইঞ্জিনিয়ার/ফার্ম-প্রতিনিধি) — এটা একটা যুক্তিসঙ্গত approximation,
 * ভুল করে বানানো ডেটা না, কিন্তু caller (DesignReportDocument) চাইলে
 * override করতে পারবে যদি ভবিষ্যতে Hub এ প্রকৃত firm-name ফিল্ড যোগ হয়।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface CoverPageProps {
  context: ReportContext;
  revisionNumber: string;
  /** caller override — না দিলে project owner এর displayName ব্যবহার হবে (উপরের docblock দেখুন)। */
  structuralEngineerName?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  top: {
    marginTop: 100,
  },
  codeLabel: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: pdfFontSize.h3,
    color: pdfColors.inkMuted,
  },
  metaBlock: {
    marginTop: 60,
    borderTopWidth: 1,
    borderTopColor: pdfColors.hairlineStrong,
    paddingTop: pdfSpacing.sectionGap,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  metaLabel: {
    width: 160,
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  metaValue: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  codeBasisBlock: {
    marginTop: pdfSpacing.sectionGap,
    padding: 10,
    backgroundColor: pdfColors.panel,
  },
  codeBasisTitle: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginBottom: 4,
  },
  codeBasisLine: {
    fontSize: pdfFontSize.body,
  },
});

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function CoverPage({ context, revisionNumber, structuralEngineerName }: CoverPageProps) {
  const project = context.hub?.projectInfo ?? null;
  const owner = project?.permissions.find((p) => p.userId === project.ownerUserId);
  const engineerName = structuralEngineerName ?? owner?.displayName ?? "—";

  return (
    <ReportPage footerLabel="Structural Design Report — Cover Page">
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.codeLabel}>Structural Design Report</Text>
          <Text style={styles.title}>{project?.projectName ?? "Untitled Project"}</Text>
          {project?.location?.address && (
            <Text style={styles.subtitle}>{project.location.address}</Text>
          )}
        </View>

        <View>
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Client</Text>
              <Text style={styles.metaValue}>{project?.clientName ?? "—"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Structural Engineer</Text>
              <Text style={styles.metaValue}>{engineerName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Project ID</Text>
              <Text style={styles.metaValue}>{project?.projectId ?? context.projectId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Report Date</Text>
              <Text style={styles.metaValue}>{formatDateLabel(context.generatedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Revision No.</Text>
              <Text style={styles.metaValue}>{revisionNumber}</Text>
            </View>
          </View>

          <View style={styles.codeBasisBlock}>
            <Text style={styles.codeBasisTitle}>Design Code Basis</Text>
            {project?.designCode ? (
              <Text style={styles.codeBasisLine}>
                Concrete: {project.designCode.concrete} · Steel: {project.designCode.steel} ·
                Seismic: {project.designCode.seismic} · Wind: {project.designCode.wind}
              </Text>
            ) : (
              <Text style={styles.codeBasisLine}>Not specified in Hub project info.</Text>
            )}
          </View>
        </View>
      </View>
    </ReportPage>
  );
}
