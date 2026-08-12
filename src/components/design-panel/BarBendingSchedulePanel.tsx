"use client";

import { useState } from "react";
import {
  computeStraightBarBbsEntry,
  computeStirrupBbsEntry,
  computeStirrupCountInZone,
  summarizeBbsByDiameter,
  computeTotalRebarWeightKg,
  type BbsEntry,
} from "@/lib/design/barBendingSchedule";

type EntryMode = "straight" | "stirrup-tie";

function fmt(v: number, decimals = 2): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

function Field({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-text-muted mb-0.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
      />
    </div>
  );
}

/** Phase 10d — Bar Bending Schedule panel। 10a/10b/10c-এর আউটপুট এখানে entry হিসেবে যোগ করে schedule বানানো যায়। */
export function BarBendingSchedulePanel() {
  const [mode, setMode] = useState<EntryMode>("straight");
  const [entries, setEntries] = useState<BbsEntry[]>([]);

  const [barMark, setBarMark] = useState("A");
  const [elementLabel, setElementLabel] = useState("FB-01");
  const [barDiameterMm, setBarDiameterMm] = useState("16");
  const [count, setCount] = useState("3");

  // straight
  const [straightLengthMm, setStraightLengthMm] = useState("3300");
  const [hookStartMm, setHookStartMm] = useState("0");
  const [hookEndMm, setHookEndMm] = useState("0");

  // stirrup-tie
  const [memberWidthMm, setMemberWidthMm] = useState("254");
  const [memberDepthMm, setMemberDepthMm] = useState("381");
  const [clearCoverMm, setClearCoverMm] = useState("40");
  const [hookExtensionMm, setHookExtensionMm] = useState("60");
  const [zoneLengthMm, setZoneLengthMm] = useState("825");
  const [spacingMm, setSpacingMm] = useState("150");

  function handleAdd() {
    const db = Number(barDiameterMm) || 10;
    if (mode === "straight") {
      const entry = computeStraightBarBbsEntry({
        barMark,
        elementLabel,
        barDiameterMm: db,
        count: Number(count) || 1,
        straightLengthMm: Number(straightLengthMm) || 0,
        hookExtensionStartMm: Number(hookStartMm) || 0,
        hookExtensionEndMm: Number(hookEndMm) || 0,
      });
      setEntries((prev) => [...prev, entry]);
    } else {
      const autoCount = computeStirrupCountInZone(Number(zoneLengthMm) || 0, Number(spacingMm) || 1);
      const entry = computeStirrupBbsEntry({
        barMark,
        elementLabel,
        barDiameterMm: db,
        count: autoCount,
        memberWidthMm: Number(memberWidthMm) || 254,
        memberDepthMm: Number(memberDepthMm) || 381,
        clearCoverMm: Number(clearCoverMm) || 40,
        hookExtensionMm: Number(hookExtensionMm) || 0,
      });
      setEntries((prev) => [...prev, entry]);
    }
  }

  function handleClear() {
    setEntries([]);
  }

  const summary = summarizeBbsByDiameter(entries);
  const totalWeightKg = computeTotalRebarWeightKg(entries);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Bar Bending Schedule (BBS)</h3>
        <p className="text-xs text-text-muted mb-3">
          10a (bar count) + 10b (zone spacing) + 10c (hook extension)-এর আউটপুট এখানে entry হিসেবে যোগ করুন — cut
          length, length, আর weight স্বয়ংক্রিয়ভাবে হিসাব হবে।
        </p>

        <label className="block text-xs text-text-muted mb-1">Shape Type</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as EntryMode)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-3"
        >
          <option value="straight">Straight (main flexural bar)</option>
          <option value="stirrup-tie">Stirrup / Tie (closed loop)</option>
        </select>

        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bar Mark" value={barMark} onChange={setBarMark} />
            <Field label="Element Label" value={elementLabel} onChange={setElementLabel} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bar Diameter" value={barDiameterMm} onChange={setBarDiameterMm} unit="mm" />
            {mode === "straight" && <Field label="Count" value={count} onChange={setCount} />}
          </div>

          {mode === "straight" && (
            <>
              <Field label="Straight Length" value={straightLengthMm} onChange={setStraightLengthMm} unit="mm" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Hook Ext. Start" value={hookStartMm} onChange={setHookStartMm} unit="mm" />
                <Field label="Hook Ext. End" value={hookEndMm} onChange={setHookEndMm} unit="mm" />
              </div>
            </>
          )}

          {mode === "stirrup-tie" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Member Width" value={memberWidthMm} onChange={setMemberWidthMm} unit="mm" />
                <Field label="Member Depth" value={memberDepthMm} onChange={setMemberDepthMm} unit="mm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Clear Cover" value={clearCoverMm} onChange={setClearCoverMm} unit="mm" />
                <Field label="Hook Extension" value={hookExtensionMm} onChange={setHookExtensionMm} unit="mm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Zone Length" value={zoneLengthMm} onChange={setZoneLengthMm} unit="mm" />
                <Field label="Spacing" value={spacingMm} onChange={setSpacingMm} unit="mm" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-md bg-surface-hover hover:bg-surface-border text-text-primary text-sm font-medium py-2 transition-colors"
          >
            Add Entry
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md bg-surface-card hover:bg-surface-hover border border-surface-border text-text-secondary text-sm px-3 py-2 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
            <p className="text-xs text-text-muted font-medium">Entries ({entries.length})</p>
            {entries.map((e, i) => (
              <p key={i} className="text-xs text-text-secondary">
                {e.barMark} ({e.elementLabel}): {e.count}-{e.barDiameterMm}mmØ {e.shapeType}, cut={fmt(e.cutLengthMm, 0)}mm,{" "}
                {fmt(e.totalWeightKg)}kg
              </p>
            ))}
          </div>

          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted font-medium mb-1">Summary by Diameter</p>
            {summary.map((s, i) => (
              <p key={i} className="text-xs text-text-secondary">
                {s.barDiameterMm}mmØ: {s.totalCount} bars, {fmt(s.totalLengthM)}m, {fmt(s.totalWeightKg)}kg
              </p>
            ))}
          </div>

          <div className="rounded-md bg-status-activeBg border border-status-activeBorder px-3 py-2.5">
            <p className="text-xs text-status-activeText">Total rebar weight: {fmt(totalWeightKg)}kg</p>
          </div>
        </div>
      )}
    </div>
  );
}
