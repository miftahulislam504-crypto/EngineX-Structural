"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RebarLayoutPanel } from "@/components/design-panel/RebarLayoutPanel";
import { StirrupTieZonePanel } from "@/components/design-panel/StirrupTieZonePanel";
import { DevelopmentLengthPanel } from "@/components/design-panel/DevelopmentLengthPanel";
import { BarBendingSchedulePanel } from "@/components/design-panel/BarBendingSchedulePanel";
import { SectionDetailPanel } from "@/components/design-panel/SectionDetailPanel";
import { ConnectionDetailPanel } from "@/components/design-panel/ConnectionDetailPanel";
import { GeneralNotesPanel } from "@/components/design-panel/GeneralNotesPanel";
import { DrawingSyncPanel } from "@/components/design-panel/DrawingSyncPanel";
import { DocumentationPanel } from "@/components/documentation-panel/DocumentationPanel";
import { DOCUMENTATION_SUB_TAB_LABELS } from "@/lib/workflow/subTabLabels";
import type { DocumentationSubTab } from "@/lib/workflow/stageTabs";

const VALID_DOCUMENTATION_SUB_TABS: readonly DocumentationSubTab[] = [
  "rebar-layout",
  "stirrup-tie-zones",
  "development-length",
  "bar-bending-schedule",
  "section-detail",
  "connection-detail",
  "general-notes",
  "drawing-sync",
  "reports-export",
];

function isValidDocumentationSubTab(value: string): value is DocumentationSubTab {
  return (VALID_DOCUMENTATION_SUB_TABS as readonly string[]).includes(value);
}

/**
 * Documentation detail route — Redesign (২০২৬-০৮), দুই-ধাপ
 * নেভিগেশনের দ্বিতীয় ধাপ। design/[subtab]/page.tsx এর মতোই একই
 * প্যাটার্ন — বিস্তারিত রেশনাল সেখানে দেখুন।
 *
 * ⚠️ এই ৯টা ফাইলের কোনোটাই geometry/elements/library/loads store
 * পড়ে না (grep দিয়ে যাচাই করা — মূল documentation/page.tsx এর টীকায়ও
 * এই একই পর্যবেক্ষণ ছিল), তাই এখানে কোনো orchestration hook কল করা
 * হয়নি — শুধু reports-export sub-tab এর DocumentationPanel এ
 * projectId প্রপ হিসেবে পাস করা হয় (এটা store থেকে না পড়ে সরাসরি প্রপ
 * নেয়, API route call করতে — মূল ফাইলের টীকায় বিস্তারিত)।
 */
function DocumentationSubTabPanel({
  projectId,
  subtab,
}: {
  projectId: string;
  subtab: DocumentationSubTab;
}) {
  switch (subtab) {
    case "rebar-layout":
      return <RebarLayoutPanel />;
    case "stirrup-tie-zones":
      return <StirrupTieZonePanel />;
    case "development-length":
      return <DevelopmentLengthPanel />;
    case "bar-bending-schedule":
      return <BarBendingSchedulePanel />;
    case "section-detail":
      return <SectionDetailPanel />;
    case "connection-detail":
      return <ConnectionDetailPanel />;
    case "general-notes":
      return <GeneralNotesPanel />;
    case "drawing-sync":
      return <DrawingSyncPanel />;
    case "reports-export":
      return <DocumentationPanel projectId={projectId} />;
    default:
      return null;
  }
}

export default function DocumentationSubTabPage({
  params,
}: PageProps<"/model/[projectId]/documentation/[subtab]">) {
  const { projectId, subtab } = use(params);

  if (!isValidDocumentationSubTab(subtab)) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <Link
          href={`/model/${projectId}/documentation`}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-brand-600 mb-4 transition-colors"
        >
          <ChevronLeft size={14} />
          Documentation
        </Link>
        <h1 className="text-base font-semibold text-text-primary mb-4">
          {DOCUMENTATION_SUB_TAB_LABELS[subtab]}
        </h1>
        <DocumentationSubTabPanel projectId={projectId} subtab={subtab} />
      </div>
    </div>
  );
}
