"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RcBeamDesignPanel } from "@/components/design-panel/RcBeamDesignPanel";
import { RcColumnDesignPanel } from "@/components/design-panel/RcColumnDesignPanel";
import { SteelBeamDesignPanel } from "@/components/design-panel/SteelBeamDesignPanel";
import { SteelColumnDesignPanel } from "@/components/design-panel/SteelColumnDesignPanel";
import { RcSlabDesignPanel } from "@/components/design-panel/RcSlabDesignPanel";
import { RcWallDesignPanel } from "@/components/design-panel/RcWallDesignPanel";
import { FootingDesignPanel } from "@/components/design-panel/FootingDesignPanel";
import { CombinedFootingDesignPanel } from "@/components/design-panel/CombinedFootingDesignPanel";
import { StripFootingDesignPanel } from "@/components/design-panel/StripFootingDesignPanel";
import { MatFoundationDesignPanel } from "@/components/design-panel/MatFoundationDesignPanel";
import { PileDesignPanel } from "@/components/design-panel/PileDesignPanel";
import { PileCapDesignPanel } from "@/components/design-panel/PileCapDesignPanel";
import { SteelConnectionDesignPanel } from "@/components/design-panel/SteelConnectionDesignPanel";
import { RetainingWallDesignPanel } from "@/components/design-panel/RetainingWallDesignPanel";
import { GeotechnicalToolsPanel } from "@/components/design-panel/GeotechnicalToolsPanel";
import { BaseIsolationEnergyDissipationPanel } from "@/components/design-panel/BaseIsolationEnergyDissipationPanel";
import { CollapsePredictionPanel } from "@/components/design-panel/CollapsePredictionPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { DESIGN_SUB_TAB_LABELS } from "@/lib/workflow/subTabLabels";
import type { DesignSubTab } from "@/lib/workflow/stageTabs";

const VALID_DESIGN_SUB_TABS: readonly DesignSubTab[] = [
  "beam",
  "column",
  "steel-beam",
  "steel-column",
  "slab",
  "wall",
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
  "pile",
  "pile-cap",
  "connection",
  "retaining-wall",
  "geotechnical",
  "base-isolation",
  "collapse-prediction",
];

function isValidDesignSubTab(value: string): value is DesignSubTab {
  return (VALID_DESIGN_SUB_TABS as readonly string[]).includes(value);
}

/**
 * Design detail route — Redesign (২০২৬-০৮), দুই-ধাপ নেভিগেশনের দ্বিতীয়
 * ধাপ (প্রথম ধাপ: ../design/page.tsx এর SubTabHub card grid)।
 *
 * প্রতিটা design tool এখন নিজস্ব URL পায় (/design/beam, /design/column,
 * ইত্যাদি) — আগে এই ১৭টা একটাই route এ ?subtab= query param দিয়ে
 * সুইচ হতো, এখন প্রতিটা প্রকৃত nested route segment (subtab dynamic
 * param)। useElementsCore/useMaterialSectionLibrary এখানেই কল করা
 * (মূল design/page.tsx এ যেমন ছিল — ১৭টা design panel এর মধ্যে ঠিক
 * এই দুটো store ব্যবহার হয়, grep দিয়ে যাচাই করা)।
 */
function DesignSubTabPanel({ subtab }: { subtab: DesignSubTab }) {
  switch (subtab) {
    case "beam":
      return <RcBeamDesignPanel />;
    case "column":
      return <RcColumnDesignPanel />;
    case "steel-beam":
      return <SteelBeamDesignPanel />;
    case "steel-column":
      return <SteelColumnDesignPanel />;
    case "slab":
      return <RcSlabDesignPanel />;
    case "wall":
      return <RcWallDesignPanel />;
    case "footing":
      return <FootingDesignPanel />;
    case "combined-footing":
      return <CombinedFootingDesignPanel />;
    case "strip-footing":
      return <StripFootingDesignPanel />;
    case "mat-foundation":
      return <MatFoundationDesignPanel />;
    case "pile":
      return <PileDesignPanel />;
    case "pile-cap":
      return <PileCapDesignPanel />;
    case "connection":
      return <SteelConnectionDesignPanel />;
    case "retaining-wall":
      return <RetainingWallDesignPanel />;
    case "geotechnical":
      return <GeotechnicalToolsPanel />;
    case "base-isolation":
      return <BaseIsolationEnergyDissipationPanel />;
    case "collapse-prediction":
      return <CollapsePredictionPanel />;
    default:
      return null;
  }
}

export default function DesignSubTabPage({
  params,
}: PageProps<"/model/[projectId]/design/[subtab]">) {
  const { projectId, subtab } = use(params);

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  if (!isValidDesignSubTab(subtab)) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <Link
          href={`/model/${projectId}/design`}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-brand-600 mb-4 transition-colors"
        >
          <ChevronLeft size={14} />
          Design
        </Link>
        <h1 className="text-base font-semibold text-text-primary mb-4">
          {DESIGN_SUB_TAB_LABELS[subtab]}
        </h1>
        <DesignSubTabPanel subtab={subtab} />
      </div>
    </div>
  );
}
