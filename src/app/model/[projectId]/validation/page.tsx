"use client";

import { use } from "react";
import { ValidationPanel } from "@/components/validation-panel/ValidationPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLoadCore } from "@/lib/loads/useLoadCore";

/**
 * Validation route — Redesign (২০২৬-০৮)।
 *
 * full-width-form ক্যাটেগরি। ValidationPanel প্রপ নেয় না, কিন্তু
 * elements/library/loads store সরাসরি পড়ে (geometry না) — analysis/
 * page.tsx এর মতোই একই কারণে এই তিনটা hook subscription-trigger করতে
 * কল করা হলো, action closure ব্যবহার হচ্ছে না (বিস্তারিত রেশনাল
 * analysis/page.tsx এর মন্তব্যে)। mobile ⚙/sheet প্যাটার্ন সরানো হলো —
 * root page.tsx এর মন্তব্যে বিস্তারিত কারণ।
 */
export default function ValidationPage({ params }: PageProps<"/model/[projectId]/validation">) {
  const { projectId } = use(params);

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);
  useLoadCore(projectId);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <ValidationPanel />
      </div>
    </div>
  );
}
