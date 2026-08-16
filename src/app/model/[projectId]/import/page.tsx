"use client";

import { use } from "react";
import { ArchitecturalImportPanel } from "@/components/import-panel/ArchitecturalImportPanel";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLibraryStore } from "@/lib/library/useLibraryStore";

/**
 * Import route — Redesign (২০২৬-০৮; মূলত Phase 6.5)।
 *
 * geometry/page.tsx ও library/page.tsx এর মতোই full-width-form
 * ক্যাটেগরি (কোনো viewport/3D canvas নেই, শুধু max-w-3xl কেন্দ্রীভূত
 * কলাম — এখন mobile-এ আলাদা sheet ছাড়াই সরাসরি)।
 *
 * এই page তিনটা orchestration hook একসাথে কল করে — useGeometryCore
 * (merge করার জন্য geometry state ও এই route ছাড়া callback দরকার নেই,
 * শুধু geometry snapshot লাগে persist এর সময়), useElementsCore (addElement
 * দিয়ে প্রতিটা imported element save করতে), useMaterialSectionLibrary
 * (dropdown এ material/section list লাগে)। layout.tsx এর নীতি অনুযায়ী
 * (মন্তব্য দেখুন) — যে route এর hook দরকার, সে নিজেই কল করে, prop drilling
 * বা layout-level move করা হয় না।
 *
 * geometry/elements/library — এই তিনটা loading state একসাথে গেট হিসেবে
 * ব্যবহার করা হচ্ছে, কারণ import flow-এর জন্য তিনটাই লাগবে (dropdown
 * খালি থাকলে material/section বাছা যাবে না, geometry snapshot ছাড়া
 * merge করা যাবে না)।
 */
export default function ImportPage({ params }: PageProps<"/model/[projectId]/import">) {
  const { projectId } = use(params);

  useGeometryCore(projectId);
  const { addElement } = useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);

  const isGeometryLoading = useGeometryStore((s) => s.isLoading);
  const isElementsLoading = useElementsStore((s) => s.isLoading);
  const isLibraryLoading = useLibraryStore((s) => s.isLoading);
  const isLoading = isGeometryLoading || isElementsLoading || isLibraryLoading;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        {isLoading ? (
          <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
        ) : (
          <ArchitecturalImportPanel projectId={projectId} onAddElement={addElement} />
        )}
      </div>
    </div>
  );
}
