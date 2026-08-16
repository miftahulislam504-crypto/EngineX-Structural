"use client";

import { use } from "react";
import { MaterialPanel } from "@/components/library-panel/MaterialPanel";
import { SectionPanel } from "@/components/library-panel/SectionPanel";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLibraryStore } from "@/lib/library/useLibraryStore";

/**
 * Library (Materials/Sections) route — Redesign (২০২৬-০৮)।
 * geometry/page.tsx (root page.tsx) এর সাথে একই প্যাটার্ন — সেখানে
 * বিস্তারিত রেশনাল দেখুন (hook একবারই এখানে কল হওয়া, full-width-form
 * layout shape, এবং mobile ⚙/sheet প্যাটার্ন সরিয়ে সরাসরি ফর্ম
 * দেখানো)।
 */
export default function LibraryPage({ params }: PageProps<"/model/[projectId]/library">) {
  const { projectId } = use(params);

  const { addMaterial, deleteMaterial, addSection, deleteSection } =
    useMaterialSectionLibrary(projectId);

  const isLibraryLoading = useLibraryStore((s) => s.isLoading);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        {isLibraryLoading ? (
          <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
        ) : (
          <div className="space-y-6">
            <MaterialPanel onAddMaterial={addMaterial} onDeleteMaterial={deleteMaterial} />
            <SectionPanel onAddSection={addSection} onDeleteSection={deleteSection} />
          </div>
        )}
      </div>
    </div>
  );
}
