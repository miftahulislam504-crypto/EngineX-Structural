"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { runValidation } from "@/lib/validation/runValidation";
import type { ValidationCategory, ValidationIssue, ValidationSeverity } from "@/lib/validation/types";

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  connectivity: "Connectivity",
  duplicate: "Duplicates",
  geometry: "Geometry",
  support: "Supports",
  "load-reference": "Load References",
  "load-sanity": "Load Sanity",
  "reference-integrity": "Material/Section References",
  "solver-limitation": "Solver Limitations",
  "code-compliance": "Code Compliance",
};

const SEVERITY_ORDER: ValidationSeverity[] = ["error", "warning", "info"];

/**
 * Phase 5 — Model Validation & Quality Control প্যানেল। AnalysisPanel
 * চালানোর আগে (বা independently) মডেলের সার্বিক স্বাস্থ্য দেখায় —
 * Model Health Score + severity/category অনুযায়ী গোছানো issue list।
 *
 * এটা কোনো network call করে না — elements/materials/sections/
 * loadCases/patterns সব ইতিমধ্যে Zustand store এ (Firestore
 * subscription থেকে) আছে, তাই "Run Validation" বাটনে ক্লিক করলে
 * সিঙ্ক্রোনাসভাবে তাৎক্ষণিক রিপোর্ট তৈরি হয়।
 *
 * AnalysisPanel এর সাথে ইচ্ছাকৃতভাবে coupled না — একটা স্বাধীন ট্যাব
 * হিসেবে রাখা হয়েছে যাতে ইঞ্জিনিয়ার Analysis চালানোর আগেও, পরেও,
 * বা independently মডেল-স্বাস্থ্য দেখতে পারেন।
 */
export function ValidationPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const loadCases = useLoadStore((s) => s.loadCases);
  const patterns = useLoadStore((s) => s.patternLibrary.patterns);

  const [hasRun, setHasRun] = useState(false);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<ValidationSeverity | "all">("all");

  const report = useMemo(
    () => runValidation({ elements, materials, sections, loadCases, patterns }),
    [elements, materials, sections, loadCases, patterns]
  );

  const filteredIssues =
    activeSeverityFilter === "all"
      ? report.issues
      : report.issues.filter((i) => i.severity === activeSeverityFilter);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<ValidationCategory, ValidationIssue[]>();
    for (const issue of filteredIssues) {
      const list = groups.get(issue.category) ?? [];
      list.push(issue);
      groups.set(issue.category, list);
    }
    return groups;
  }, [filteredIssues]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Model Validation & QC</h3>
        <p className="text-xs text-slate-500 mb-3">
          Checks connectivity, duplicates, geometry, load/material references, and preliminary code-compliance
          sanity — before or after running Analysis.
        </p>

        <button
          type="button"
          onClick={() => setHasRun(true)}
          className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-2 transition-colors"
        >
          ▶ Run Validation
        </button>
      </div>

      {hasRun && (
        <>
          <HealthScoreCard report={report} />

          <SeverityFilterBar active={activeSeverityFilter} onChange={setActiveSeverityFilter} report={report} />

          {filteredIssues.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5">
              No issues in this filter.
            </p>
          ) : (
            <div className="space-y-3">
              {Array.from(groupedByCategory.entries()).map(([category, issues]) => (
                <CategoryGroup key={category} category={category} issues={issues} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HealthScoreCard({ report }: { report: ReturnType<typeof runValidation> }) {
  const scoreColor =
    report.healthScore >= 85
      ? "text-emerald-400"
      : report.healthScore >= 60
        ? "text-amber-400"
        : "text-red-400";

  const barColor =
    report.healthScore >= 85 ? "bg-emerald-600" : report.healthScore >= 60 ? "bg-amber-600" : "bg-red-600";

  return (
    <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 font-medium">Model Health Score</p>
        <p className={`text-lg font-semibold ${scoreColor}`}>{report.healthScore}/100</p>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2.5">
        <div className={`h-full ${barColor}`} style={{ width: `${report.healthScore}%` }} />
      </div>
      <div className="flex gap-3 text-xs">
        <span className="text-red-400">✗ {report.errorCount} error{report.errorCount !== 1 ? "s" : ""}</span>
        <span className="text-amber-400">⚠ {report.warningCount} warning{report.warningCount !== 1 ? "s" : ""}</span>
        <span className="text-slate-500">ℹ {report.infoCount} info</span>
      </div>
    </div>
  );
}

function SeverityFilterBar({
  active,
  onChange,
  report,
}: {
  active: ValidationSeverity | "all";
  onChange: (s: ValidationSeverity | "all") => void;
  report: ReturnType<typeof runValidation>;
}) {
  const options: { key: ValidationSeverity | "all"; label: string; count: number }[] = [
    { key: "all", label: "All", count: report.issues.length },
    { key: "error", label: "Errors", count: report.errorCount },
    { key: "warning", label: "Warnings", count: report.warningCount },
    { key: "info", label: "Info", count: report.infoCount },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
            active === opt.key
              ? "bg-slate-800 border-slate-700 text-slate-200"
              : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
          }`}
        >
          {opt.label} ({opt.count})
        </button>
      ))}
    </div>
  );
}

function CategoryGroup({ category, issues }: { category: ValidationCategory; issues: ValidationIssue[] }) {
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5 space-y-1.5">
      <p className="text-xs text-slate-500 font-medium">{CATEGORY_LABELS[category]}</p>
      {sorted.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const style =
    issue.severity === "error"
      ? "text-red-400"
      : issue.severity === "warning"
        ? "text-amber-400"
        : "text-slate-400";
  const icon = issue.severity === "error" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ";

  return (
    <p className={`text-xs ${style} leading-relaxed`}>
      {icon} {issue.message}
    </p>
  );
}
