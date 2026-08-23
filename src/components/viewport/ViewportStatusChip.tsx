"use client";

import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useProjectInfoStore } from "@/lib/projects/useProjectInfoStore";
import { useStructuralAutoSyncStatusStore } from "@/lib/hub/useStructuralAutoSyncStatusStore";

/**
 * Phase 4 (Panel Migration) — মূল page.tsx এ isSaving/loadError ৪টা
 * store থেকে aggregate হয়ে একটাই status chip এ দেখানো হতো, যেটা
 * showDualPanel/showSinglePanel — অর্থাৎ elements/analysis/
 * visualization/detailing — এই ৪ tab এই দেখা যেত (dual-panel ও
 * single-panel উভয়ই, শুধু dual-panel না)। এখন এই ৪টা আলাদা route
 * page, প্রতিটাতেই এই একই chip দরকার — তাই আলাদা component হিসেবে
 * বের করা হলো (DualPanelViewportShell এর ভেতরে বেঁধে রাখলে
 * visualization/detailing, যারা DualPanelViewportShell ব্যবহার করে
 * না, আবার নতুন করে এই aggregation লজিক লিখতে হতো)।
 *
 * isGeometrySaving/isLibrarySaving/ইত্যাদি — প্রতিটা pure Zustand
 * selector, কোনো subscription side-effect নেই, তাই layout.tsx এর
 * নিজস্ব (এই একই store থেকে ভিন্ন slice পড়া) সাথে conflict করে না —
 * layout.tsx এর মন্তব্যে বিস্তারিত।
 */
export function ViewportStatusChip({ projectId }: { projectId: string }) {
  // Redesign (২০২৬-০৮) — raw projectId এর বদলে মানুষের-পড়ার-উপযোগী
  // projectName দেখানো (layout.tsx এর useProjectInfoCore populate করে)।
  // এখনো লোড না হলে বা ডকুমেন্ট না পাওয়া গেলে projectId তেই fallback।
  const projectName = useProjectInfoStore((s) => s.projectName);

  const isGeometrySaving = useGeometryStore((s) => s.isSaving);
  const isLibrarySaving = useLibraryStore((s) => s.isSaving);
  const isElementsSaving = useElementsStore((s) => s.isSaving);
  const isLoadsSaving = useLoadStore((s) => s.isSaving);
  const isSaving = isGeometrySaving || isLibrarySaving || isElementsSaving || isLoadsSaving;

  const geometryLoadError = useGeometryStore((s) => s.loadError);
  const libraryLoadError = useLibraryStore((s) => s.loadError);
  const elementsLoadError = useElementsStore((s) => s.loadError);
  const loadsLoadError = useLoadStore((s) => s.loadError);
  const loadError = geometryLoadError ?? libraryLoadError ?? elementsLoadError ?? loadsLoadError;

  // Structural → Hub auto-sync status (useStructuralAutoSync.ts,
  // layout.tsx এ mount করা, এই chip শুধু broadcast store থেকে পড়ে —
  // ViewportStatusChip.tsx এর ফাইল-টপ কমেন্টে বর্ণিত নীতির সাথে
  // সামঞ্জস্যপূর্ণ, ডুপ্লিকেট hook-call এড়াতে)। "idle" ও "pending"
  // কে আলাদা করে দেখানো হয়নি (pending কয়েক সেকেন্ডের debounce মাত্র,
  // "syncing" দেখানোই যথেষ্ট তথ্য) — শুধু syncing/synced/error।
  const structuralSyncStatus = useStructuralAutoSyncStatusStore((s) => s.status);
  const structuralSyncError = useStructuralAutoSyncStatusStore((s) => s.lastError);

  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-2 flex-wrap">
      <span className="hidden sm:inline text-xs text-text-muted bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-surface-border">
        Project: {projectName ?? projectId}
      </span>
      {isSaving && (
        <span className="text-xs text-status-holdText bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-surface-border">
          সেভ হচ্ছে...
        </span>
      )}
      {loadError && (
        <span className="text-xs text-red-600 bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-red-200">
          লোড এরর: {loadError}
        </span>
      )}
      {(structuralSyncStatus === "pending" || structuralSyncStatus === "syncing") && (
        <span className="text-xs text-text-muted bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-surface-border">
          Hub-এ sync হচ্ছে...
        </span>
      )}
      {structuralSyncStatus === "error" && (
        <span className="text-xs text-red-600 bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-red-200">
          Hub sync ব্যর্থ{structuralSyncError ? `: ${structuralSyncError}` : ""}
        </span>
      )}
    </div>
  );
}
