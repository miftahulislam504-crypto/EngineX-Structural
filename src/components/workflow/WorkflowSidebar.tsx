"use client";

import { useState } from "react";
import { STAGES } from "@/lib/workflow/stageTabs";
import type { StageId, StageStatus } from "@/lib/workflow/types";
import { useWorkflowProgress, resolveEffectiveStatus } from "@/lib/workflow/useWorkflowProgress";

interface WorkflowSidebarProps {
  onNavigate: (stageId: StageId) => void;
}

/**
 * Master Plan এর "Workflow Layer" — ৯-Stage Wizard।
 *
 * এটা `page.tsx` এর ডান পাশের flat-tab sidebar-কে প্রতিস্থাপন করে না
 * (সেটা "Expert Mode" এ এখনো আগের মতোই কাজ করে) — বরং একটা বিকল্প
 * বাম-পাশ প্যানেল, wizardMode চালু থাকলে দেখা যায়। প্রতিটা stage
 * card ক্লিক করলে page.tsx এর activeTab পরিবর্তন হয়, তাই আসল UI
 * (viewport, panel) একই থাকে — শুধু নেভিগেশন গাইডেড হয়।
 *
 * Progress bar সামগ্রিক শতাংশ 9টা stage এর গড় percent থেকে হিসাব
 * হয় — placeholder stage (Documentation/Export) 0% ধরে রাখাই ঠিক,
 * কারণ সেগুলো আসলেই এখনো বসেনি।
 */
export function WorkflowSidebar({ onNavigate }: WorkflowSidebarProps) {
  const progress = useWorkflowProgress();
  const [pendingLockedStage, setPendingLockedStage] = useState<StageId | null>(null);

  const overallPercent = Math.round(
    STAGES.reduce((sum, s) => sum + progress[s.id].percent, 0) / STAGES.length
  );

  function handleStageClick(stageId: StageId) {
    const status = resolveEffectiveStatus(stageId, progress);
    const stage = STAGES.find((s) => s.id === stageId);
    if (status === "locked" && !stage?.isPlaceholder) {
      setPendingLockedStage(stageId);
      return;
    }
    if (stage?.isPlaceholder) return;
    setPendingLockedStage(null);
    onNavigate(stageId);
  }

  function confirmLockedNavigate(stageId: StageId) {
    setPendingLockedStage(null);
    onNavigate(stageId);
  }

  return (
    <aside className="w-72 border-r border-surface-border bg-surface-card flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-surface-border">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-sm font-medium text-text-primary">Design Workflow</h2>
          <span className="text-xs text-text-muted">{overallPercent}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {STAGES.map((stage) => {
          const stageProgress = progress[stage.id];
          const effectiveStatus = resolveEffectiveStatus(stage.id, progress);
          return (
            <StageCard
              key={stage.id}
              order={stage.order}
              label={stage.label}
              labelBn={stage.labelBn}
              description={stage.description}
              detail={stageProgress.detail}
              status={effectiveStatus}
              isPlaceholder={stage.isPlaceholder}
              onClick={() => handleStageClick(stage.id)}
            />
          );
        })}
      </div>

      {pendingLockedStage && (
        <LockedStageConfirm
          stageId={pendingLockedStage}
          onCancel={() => setPendingLockedStage(null)}
          onConfirm={() => confirmLockedNavigate(pendingLockedStage)}
        />
      )}
    </aside>
  );
}

function StageCard({
  order,
  label,
  labelBn,
  description,
  detail,
  status,
  isPlaceholder,
  onClick,
}: {
  order: number;
  label: string;
  labelBn: string;
  description: string;
  detail: string;
  status: StageStatus;
  isPlaceholder?: boolean;
  onClick: () => void;
}) {
  const icon =
    status === "complete" ? "✓" : status === "locked" ? "🔒" : status === "in-progress" ? "●" : String(order);

  const iconStyle =
    status === "complete"
      ? "bg-status-activeText text-white"
      : status === "in-progress"
        ? "bg-brand-600 text-white"
        : status === "locked"
          ? "bg-surface-hover text-text-muted"
          : "bg-surface-hover text-text-secondary";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPlaceholder}
      className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
        isPlaceholder
          ? "border-surface-border bg-surface cursor-not-allowed opacity-60"
          : status === "locked"
            ? "border-surface-border bg-surface hover:border-text-muted"
            : "border-surface-border bg-surface-card hover:border-brand-300"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${iconStyle}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <p className="text-sm font-medium text-text-primary truncate">{label}</p>
            <span className="text-[11px] text-text-muted truncate">{labelBn}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>
          <p className="text-[11px] text-text-muted mt-1">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function LockedStageConfirm({
  stageId,
  onCancel,
  onConfirm,
}: {
  stageId: StageId;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const stage = STAGES.find((s) => s.id === stageId);
  return (
    <div className="border-t border-surface-border px-3 py-3 bg-surface">
      <p className="text-xs text-status-holdText mb-2">
        আগের ধাপ এখনো সম্পূর্ণ হয়নি। তবু &quot;{stage?.label}&quot;-এ যেতে চান?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 text-xs py-1.5 rounded-md bg-status-holdText hover:opacity-90 text-white transition-colors"
        >
          হ্যাঁ, যাও
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-xs py-1.5 rounded-md bg-surface-hover hover:bg-surface-border text-text-secondary transition-colors"
        >
          বাতিল
        </button>
      </div>
    </div>
  );
}
