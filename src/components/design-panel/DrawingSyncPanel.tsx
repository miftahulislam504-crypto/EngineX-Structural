"use client";

import { useState } from "react";
import {
  createSyncRecord,
  checkDetailingSyncStatus,
  type DetailingType,
  type DetailingSyncRecord,
  type SyncCheckResult,
} from "@/lib/design/drawingSync";

const DETAIL_TYPES: DetailingType[] = [
  "rebar-layout",
  "stirrup-tie-zones",
  "development-length",
  "bar-bending-schedule",
  "section-detail",
  "connection-detail",
  "general-notes",
];

interface InputRow {
  key: string;
  generatedValue: string;
  currentValue: string;
}

const DEFAULT_ROWS: InputRow[] = [
  { key: "widthMm", generatedValue: "254", currentValue: "254" },
  { key: "tensionAsMm2", generatedValue: "603", currentValue: "603" },
  { key: "coverMm", generatedValue: "38", currentValue: "38" },
];

/**
 * Phase 10h — Drawing Synchronization panel। একটা detail কবে, কোন
 * ইনপুট দিয়ে জেনারেট হয়েছিল সেটা vs বর্তমান ইনপুট — তুলনা করে stale
 * কিনা দেখায় (drawingSync.ts দেখুন)। Persist/live-model-tracking এই v1-এ
 * নেই (deferred Hub-sync কাজের অংশ) — এখানে ম্যানুয়ালি before/after
 * তুলনা করা যায়।
 */
export function DrawingSyncPanel() {
  const [detailId, setDetailId] = useState("beam-FB01-rebar-layout");
  const [detailType, setDetailType] = useState<DetailingType>("rebar-layout");
  const [rows, setRows] = useState<InputRow[]>(DEFAULT_ROWS);
  const [record, setRecord] = useState<DetailingSyncRecord | null>(null);
  const [checkResult, setCheckResult] = useState<SyncCheckResult | null>(null);

  function updateRow(index: number, field: "key" | "generatedValue" | "currentValue", value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: "", generatedValue: "", currentValue: "" }]);
  }

  function toInputsObject(valueField: "generatedValue" | "currentValue") {
    const obj: Record<string, number | string | boolean> = {};
    for (const row of rows) {
      if (!row.key.trim()) continue;
      const raw = row[valueField];
      const num = Number(raw);
      obj[row.key.trim()] = raw !== "" && !Number.isNaN(num) ? num : raw;
    }
    return obj;
  }

  function handleGenerateSnapshot() {
    const newRecord = createSyncRecord(detailId, detailType, toInputsObject("generatedValue"));
    setRecord(newRecord);
    setCheckResult(null);
  }

  function handleCheckSync() {
    if (!record) return;
    setCheckResult(checkDetailingSyncStatus(record, toInputsObject("currentValue")));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Drawing Synchronization</h3>
        <p className="text-xs text-text-muted mb-3">
          একটা detail generate হওয়ার সময়ের ইনপুট vs বর্তমান ইনপুট তুলনা করে বলে দেয় detail এখনো valid কিনা, আর ঠিক
          কোন ইনপুট বদলেছে।
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">Detail ID</label>
            <input
              value={detailId}
              onChange={(e) => setDetailId(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">Detail Type</label>
            <select
              value={detailType}
              onChange={(e) => setDetailType(e.target.value as DetailingType)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            >
              {DETAIL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[10px] text-text-muted mb-1">Inputs (generated-at snapshot vs current)</p>
        <div className="space-y-1.5 mb-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-1.5">
              <input
                value={row.key}
                onChange={(e) => updateRow(i, "key", e.target.value)}
                placeholder="key"
                className="rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
              <input
                value={row.generatedValue}
                onChange={(e) => updateRow(i, "generatedValue", e.target.value)}
                placeholder="generated value"
                className="rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
              <input
                value={row.currentValue}
                onChange={(e) => updateRow(i, "currentValue", e.target.value)}
                placeholder="current value"
                className="rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-text-muted hover:text-text-secondary mb-3"
        >
          + Add input
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleGenerateSnapshot}
            className="rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
          >
            1. Snapshot at Generation
          </button>
          <button
            type="button"
            onClick={handleCheckSync}
            disabled={!record}
            className="rounded-md bg-surface-hover hover:bg-surface-border disabled:opacity-40 disabled:hover:bg-surface-hover text-text-primary text-sm font-medium py-2 transition-colors"
          >
            2. Check Current
          </button>
        </div>
      </div>

      {record && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
          <p className="text-xs text-text-muted font-medium mb-1">Snapshot Recorded</p>
          <p className="text-xs text-text-secondary">Fingerprint: {record.inputFingerprint}</p>
          <p className="text-xs text-text-muted">{new Date(record.generatedAtIso).toLocaleString()}</p>
        </div>
      )}

      {checkResult && (
        <div
          className={`rounded-md border px-3 py-2.5 space-y-1 ${
            checkResult.isStale ? "bg-status-holdBg border-status-holdBorder" : "bg-status-activeBg border-status-activeBorder"
          }`}
        >
          <p className={`text-xs leading-relaxed ${checkResult.isStale ? "text-status-holdText" : "text-status-activeText"}`}>
            {checkResult.isStale
              ? `Stale — এই detail বর্তমান ইনপুটের সাথে মিলছে না (${checkResult.changedKeys.join(", ")} বদলেছে)। Regenerate করুন।`
              : "In sync — এই detail বর্তমান ইনপুটের সাথে মিলছে।"}
          </p>
        </div>
      )}
    </div>
  );
}
