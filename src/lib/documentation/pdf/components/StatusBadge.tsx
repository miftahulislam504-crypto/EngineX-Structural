/**
 * StatusBadge — Phase 11b
 *
 * মূল প্লানের একাধিক জায়গায় এই একই ভিজ্যুয়াল ভাষা চাওয়া হয়েছে:
 *   - Design Report Section H: "Model Health Score ... বড় করে দেখানো
 *     — visual gauge/badge টাইপ"
 *   - Calculation Sheet Section C: "Pass/Fail status per check —
 *     একটা checklist টেবিল আকারে — ভালো visual verification এর জন্য"
 *   - QC Report Section F: "Critical issue থাকলে report-এর উপরে red
 *     flag/warning banner"
 * তিনটাই একই সিমান্টিক দরকার (pass/warning/fail রঙ-কোডেড) — আলাদা
 * আলাদা document এ আলাদা রঙ বেছে নিলে অসঙ্গতি হতো, তাই একটাই
 * component।
 *
 * DesignCheckStatus ("ok"|"warning"|"fail"|"not-checked", design/firestore.ts)
 * আর ValidationSeverity ("error"|"warning"|"info", validation/types.ts)
 * — দুটো ভিন্ন union, ভিন্ন ডোমেইন থেকে (design check বনাম model
 * validation) — তাই এই component একটা normalized StatusKind নেয়,
 * caller নিজের ডোমেইন-নির্দিষ্ট status কে ম্যাপ করে দেবে (নিচের
 * mapValidationSeverity/mapDesignStatus হেল্পার দিয়ে)।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { ValidationSeverity } from "@/lib/validation/types";
import type { DesignCheckStatus } from "@/lib/design/firestore";

export type StatusKind = "pass" | "warning" | "fail" | "info" | "neutral";

const KIND_STYLE: Record<StatusKind, { color: string; bg: string; label: string }> = {
  pass: { color: pdfColors.statusPass, bg: pdfColors.statusPassBg, label: "PASS" },
  warning: { color: pdfColors.statusWarning, bg: pdfColors.statusWarningBg, label: "WARNING" },
  fail: { color: pdfColors.statusFail, bg: pdfColors.statusFailBg, label: "FAIL" },
  info: { color: pdfColors.statusInfo, bg: pdfColors.statusInfoBg, label: "INFO" },
  neutral: { color: pdfColors.inkMuted, bg: pdfColors.panel, label: "—" },
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: pdfFontSize.caption,
    fontFamily: "Helvetica-Bold",
  },
});

export interface StatusBadgeProps {
  kind: StatusKind;
  /** না দিলে kind অনুযায়ী ডিফল্ট লেবেল (PASS/WARNING/FAIL/INFO) দেখাবে — utilization ratio এর মতো নির্দিষ্ট মান দেখাতে override করা যায়। */
  label?: string;
}

export function StatusBadge({ kind, label }: StatusBadgeProps) {
  const style = KIND_STYLE[kind];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.color }]}>{label ?? style.label}</Text>
    </View>
  );
}

/** ValidationIssue.severity ("error"|"warning"|"info") কে StatusKind এ ম্যাপ করে — QC Report/Section H এর জন্য। "error" কে "fail" রঙে দেখানো হয় কারণ ব্যবহারকারীর কাছে এটাই বেশি স্বজ্ঞাত (validation/types.ts এর error = সবচেয়ে গুরুতর)। */
export function mapValidationSeverity(severity: ValidationSeverity): StatusKind {
  switch (severity) {
    case "error":
      return "fail";
    case "warning":
      return "warning";
    case "info":
      return "info";
  }
}

/** DesignResult.status কে StatusKind এ ম্যাপ করে — Design Summary টেবিল/Calc Sheet এর জন্য। */
export function mapDesignStatus(status: DesignCheckStatus): StatusKind {
  switch (status) {
    case "ok":
      return "pass";
    case "warning":
      return "warning";
    case "fail":
      return "fail";
    case "not-checked":
      return "neutral";
  }
}
