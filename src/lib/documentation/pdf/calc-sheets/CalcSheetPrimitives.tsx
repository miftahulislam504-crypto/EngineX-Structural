/**
 * Calc Sheet shared primitives — Phase 11e
 *
 * প্রতিটা element type এর Calc Sheet এ বারবার লাগে এমন দুইটা ছোট
 * building block:
 *   - LabeledValueRow: "Input Data" ও প্রতিটা "Design Calculation"
 *     উপ-ধাপে key-value সারি (যেমন "Mu = 145.2 kN·m")।
 *   - CalcChecklist: "Design Summary" এর "Pass/Fail status per check
 *     — একটা checklist টেবিল আকারে" (প্লানের সরাসরি চাহিদা)।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { StatusBadge, type StatusKind } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

const styles = StyleSheet.create({
  sectionHeading: {
    fontSize: pdfFontSize.h2,
    fontFamily: "Helvetica-Bold",
    marginTop: pdfSpacing.sectionGap,
    marginBottom: 6,
  },
  subHeading: {
    fontSize: pdfFontSize.h3,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 3,
  },
  valueRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  valueLabel: {
    width: 220,
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  valueText: {
    flex: 1,
    fontSize: pdfFontSize.body,
    fontFamily: "Courier",
  },
  warningBlock: {
    marginTop: 4,
    padding: 6,
    backgroundColor: pdfColors.statusWarningBg,
  },
  warningText: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.statusWarning,
  },
  checklistTable: {
    borderWidth: 0.5,
    borderColor: pdfColors.hairline,
    marginTop: 6,
  },
  checklistHeaderRow: {
    flexDirection: "row",
    backgroundColor: pdfColors.panel,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairlineStrong,
  },
  checklistRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
  },
  checklistCell: {
    padding: 4,
    justifyContent: "center",
  },
  checklistHeaderText: {
    fontSize: pdfFontSize.tableHeader,
    fontFamily: "Helvetica-Bold",
  },
  checklistBodyText: {
    fontSize: pdfFontSize.tableBody,
  },
});

export function CalcSectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

export function CalcSubHeading({ children }: { children: string }) {
  return <Text style={styles.subHeading}>{children}</Text>;
}

export interface LabeledValueRowProps {
  label: string;
  value: string;
}

/** monospace (Courier) দিয়ে ভ্যালু দেখায় — সংখ্যাসূচক ইঞ্জিনিয়ারিং হিসাব সারিবদ্ধভাবে পড়া সহজ হয়। */
export function LabeledValueRow({ label, value }: LabeledValueRowProps) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

export function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <View style={styles.warningBlock}>
      {warnings.map((w, i) => (
        <Text key={i} style={styles.warningText}>
          ! {w}
        </Text>
      ))}
    </View>
  );
}

export interface ChecklistItem {
  checkName: string;
  detail: string;
  status: StatusKind;
}

/** প্লানের "Pass/Fail status per check" checklist টেবিল — সব element type এর জন্য একই কাঠামো, শুধু আইটেম ভিন্ন। */
export function CalcChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <View style={styles.checklistTable}>
      <View style={styles.checklistHeaderRow}>
        <View style={[styles.checklistCell, { flex: 2 }]}>
          <Text style={styles.checklistHeaderText}>Check</Text>
        </View>
        <View style={[styles.checklistCell, { flex: 3 }]}>
          <Text style={styles.checklistHeaderText}>Detail</Text>
        </View>
        <View style={[styles.checklistCell, { flex: 1 }]}>
          <Text style={styles.checklistHeaderText}>Status</Text>
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.checklistRow}>
          <View style={[styles.checklistCell, { flex: 2 }]}>
            <Text style={styles.checklistBodyText}>{item.checkName}</Text>
          </View>
          <View style={[styles.checklistCell, { flex: 3 }]}>
            <Text style={styles.checklistBodyText}>{item.detail}</Text>
          </View>
          <View style={[styles.checklistCell, { flex: 1 }]}>
            <StatusBadge kind={item.status} />
          </View>
        </View>
      ))}
    </View>
  );
}
