"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FoundationOptimizationPanel } from "@/components/design-panel/FoundationOptimizationPanel";
import { SectionOptimizationPanel } from "@/components/design-panel/SectionOptimizationPanel";
import { WeightOptimizationPanel } from "@/components/design-panel/WeightOptimizationPanel";
import { CostOptimizationPanel } from "@/components/design-panel/CostOptimizationPanel";
import { ConstructionAiTopologyOptimizationPanel } from "@/components/design-panel/ConstructionAiTopologyOptimizationPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { OPTIMIZATION_SUB_TAB_LABELS } from "@/lib/workflow/subTabLabels";
import type { OptimizationSubTab } from "@/lib/workflow/stageTabs";

const VALID_OPTIMIZATION_SUB_TABS: readonly OptimizationSubTab[] = [
  "foundation-optimization",
  "section-optimization",
  "weight-optimization",
  "cost-optimization",
  "construction-ai-topology-optimization",
];

function isValidOptimizationSubTab(value: string): value is OptimizationSubTab {
  return (VALID_OPTIMIZATION_SUB_TABS as readonly string[]).includes(value);
}

/**
 * Optimization detail route — Redesign (২০২৬-০৮), দুই-ধাপ
 * নেভিগেশনের দ্বিতীয় ধাপ। design/[subtab]/page.tsx এর মতোই একই
 * প্যাটার্ন — বিস্তারিত রেশনাল সেখানে দেখুন।
 */
function OptimizationSubTabPanel({ subtab }: { subtab: OptimizationSubTab }) {
  switch (subtab) {
    case "foundation-optimization":
      return <FoundationOptimizationPanel />;
    case "section-optimization":
      return <SectionOptimizationPanel />;
    case "weight-optimization":
      return <WeightOptimizationPanel />;
    case "cost-optimization":
      return <CostOptimizationPanel />;
    case "construction-ai-topology-optimization":
      return <ConstructionAiTopologyOptimizationPanel />;
    default:
      return null;
  }
}

export default function OptimizationSubTabPage({
  params,
}: PageProps<"/model/[projectId]/optimization/[subtab]">) {
  const { projectId, subtab } = use(params);

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  if (!isValidOptimizationSubTab(subtab)) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <Link
          href={`/model/${projectId}/optimization`}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-brand-600 mb-4 transition-colors"
        >
          <ChevronLeft size={14} />
          Optimization
        </Link>
        <h1 className="text-base font-semibold text-text-primary mb-4">
          {OPTIMIZATION_SUB_TAB_LABELS[subtab]}
        </h1>
        <OptimizationSubTabPanel subtab={subtab} />
      </div>
    </div>
  );
}
