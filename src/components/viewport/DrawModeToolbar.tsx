"use client";

import { type DrawableCategory, DRAWABLE_CATEGORY_LABELS } from "@/lib/viewport/useDrawModeStore";

interface DrawModeToolbarProps {
  category: DrawableCategory;
  pointCount: number;
  onFinish: () => void;
  onUndo: () => void;
  onCancel: () => void;
}

const MIN_POINTS_TO_FINISH = 3;

/**
 * Draw mode চালু থাকা অবস্থায় viewport এর উপরে ভাসমান একটা control
 * bar। এটা viewport এর বাইরে (React Three Fiber Canvas এর বাইরে)
 * সাধারণ HTML হিসেবে render হয় — কারণ button/text এর মতো UI 2D DOM
 * এ করা 3D স্পেসে টেক্সট রেন্ডার করার চেয়ে সহজ ও দ্রুত।
 */
export function DrawModeToolbar({
  category,
  pointCount,
  onFinish,
  onUndo,
  onCancel,
}: DrawModeToolbarProps) {
  const canFinish = pointCount >= MIN_POINTS_TO_FINISH;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface-card/95 backdrop-blur border border-brand-200 rounded-lg px-4 py-2.5 shadow-card">
      <span className="text-sm text-brand-700 font-medium">
        {DRAWABLE_CATEGORY_LABELS[category]} আঁকা হচ্ছে
      </span>
      <span className="text-xs text-text-muted">
        {pointCount} পয়েন্ট {!canFinish && `(ন্যূনতম ${MIN_POINTS_TO_FINISH} দরকার)`}
      </span>

      <div className="flex items-center gap-1.5 ml-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={pointCount === 0}
          className="text-xs px-2.5 py-1.5 rounded-md bg-surface-hover hover:bg-surface-border disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary transition-colors"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={!canFinish}
          className="text-xs px-2.5 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          ✓ Finish
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
