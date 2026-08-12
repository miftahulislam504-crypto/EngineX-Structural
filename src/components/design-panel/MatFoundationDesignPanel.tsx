"use client";

import { useMemo, useState } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import {
  runMatFoundationDesign,
  type MatFoundationDesignReport,
  type MatColumnDesignInput,
} from "@/lib/design/matFoundationDesign";
import type { ColumnPosition } from "@/lib/design/rcSlabPunchingShear";
import type { MatFoundationElement } from "@/lib/types/element";
import { persistDesignResult } from "@/lib/design/firestore";
import { useProjectIdStore } from "@/lib/projects/useProjectIdStore";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

interface ColumnRow {
  id: string;
  label: string;
  xM: string;
  zM: string;
  servicePointLoadKN: string;
  factoredPointLoadKN: string;
  columnWidthMm: string;
  columnDepthMm: string;
  columnPosition: ColumnPosition;
  tributaryCantileverMm: string;
}

function makeEmptyRow(index: number): ColumnRow {
  return {
    id: `col-${Date.now()}-${index}`,
    label: `C${index + 1}`,
    xM: "0",
    zM: "0",
    servicePointLoadKN: "",
    factoredPointLoadKN: "",
    columnWidthMm: "400",
    columnDepthMm: "400",
    columnPosition: "interior",
    tributaryCantileverMm: "1000",
  };
}

/**
 * Phase 7c — Mat/Raft Foundation Design panel। Rigid-method pressure
 * distribution (uniform/linear-eccentric) + প্রতিটা কলামের নিচে
 * local flexure ও punching shear। এই app কোনো geotechnical analysis
 * করে না, এবং FE shell stress recovery না থাকায় (Phase 4a) rigid-mat
 * ধারণা ব্যবহার করা হয়েছে — flexible mat (beam-on-elastic-foundation)
 * সমর্থিত না।
 */
export function MatFoundationDesignPanel() {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const projectId = useProjectIdStore((s) => s.projectId);

  const mats = useMemo(
    () => elements.filter((e): e is MatFoundationElement => e.category === "mat-foundation"),
    [elements]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = mats.find((m) => m.elementId === selectedId) ?? null;
  const material = selected ? materials.find((m) => m.materialId === selected.materialId) : undefined;
  const isConcrete = material?.type === "concrete";

  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [effectiveCoverMm, setEffectiveCoverMm] = useState("75");
  const [columns, setColumns] = useState<ColumnRow[]>([makeEmptyRow(0)]);

  const [report, setReport] = useState<MatFoundationDesignReport | null>(null);

  function updateColumn(id: string, patch: Partial<ColumnRow>) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addColumn() {
    setColumns((prev) => [...prev, makeEmptyRow(prev.length)]);
  }

  function removeColumn(id: string) {
    setColumns((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }

  function handleRunDesign() {
    if (!selected || !material || material.type !== "concrete") return;
    const fy = material.rebarFy ?? 414;
    const fc = material.fc;

    const vertices = selected.vertices.map((v) => ({ xM: v.x, zM: v.z }));

    const columnInputs: MatColumnDesignInput[] = columns.map((c) => ({
      label: c.label,
      xM: Number(c.xM) || 0,
      zM: Number(c.zM) || 0,
      servicePointLoadKN: Number(c.servicePointLoadKN) || 0,
      factoredPointLoadKN: Number(c.factoredPointLoadKN) || 0,
      columnWidthMm: Number(c.columnWidthMm) || 400,
      columnDepthMm: Number(c.columnDepthMm) || 400,
      columnPosition: c.columnPosition,
      tributaryCantileverMm: Number(c.tributaryCantileverMm) || 1000,
    }));

    const input = {
      elementLabel: selected.label,
      vertices,
      columns: columnInputs,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || 0,
      thicknessMm: selected.thickness,
      effectiveCoverMm: Number(effectiveCoverMm) || 75,
      fcMPa: fc,
      fyMPa: fy,
    };
    const result = runMatFoundationDesign(input);
    setReport(result);
    if (projectId) {
      persistDesignResult(projectId, {
        elementId: selected.elementId,
        elementLabel: selected.label,
        elementCategory: "mat-foundation",
        status: result.overallStatus === "error" ? "fail" : result.overallStatus,
        detail: { input, report: result },
      }).catch((e) => console.error("Failed to persist mat-foundation design result:", e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Mat/Raft Foundation Design</h3>
        <p className="text-xs text-text-muted mb-3">
          Rigid-method pressure distribution (uniform/linear-eccentric), per-column local flexure and punching shear.
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
          This app does not perform geotechnical analysis and treats the mat as rigid (linear pressure distribution)
          — flexible-mat (beam-on-elastic-foundation) behavior is not modeled. Enter the allowable bearing pressure
          from your geotechnical report, and each column&apos;s reaction, position, and edge condition manually.
        </p>

        <label className="block text-xs text-text-muted mb-1">Mat/Raft Foundation</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setReport(null);
          }}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-sm px-2.5 py-2 mb-2"
        >
          <option value="">Select a mat foundation...</option>
          {mats.map((m) => (
            <option key={m.elementId} value={m.elementId}>
              {m.label}
            </option>
          ))}
        </select>

        {selected && !isConcrete && (
          <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-2">
            This mat&apos;s material is not concrete — RC design does not apply.
          </p>
        )}
      </div>

      {selected && isConcrete && (
        <>
          <p className="text-xs text-text-muted">Thickness: {selected.thickness}mm (from element)</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Allowable Bearing Pressure qa (kPa)</label>
              <input
                type="number"
                step="any"
                value={allowableBearingPressureKPa}
                onChange={(e) => setAllowableBearingPressureKPa(e.target.value)}
                placeholder="from geotech report"
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Effective Cover (mm)</label>
              <input
                type="number"
                step="any"
                value={effectiveCoverMm}
                onChange={(e) => setEffectiveCoverMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-text-secondary font-medium">Columns</p>
            {columns.map((c) => (
              <div key={c.id} className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) => updateColumn(c.id, { label: e.target.value })}
                    className="w-28 rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeColumn(c.id)}
                    className="text-xs text-red-500/70 hover:text-red-600 px-1"
                    title="ডিলিট করুন"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={c.xM}
                    onChange={(e) => updateColumn(c.id, { xM: e.target.value })}
                    placeholder="X (m)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                  <input
                    type="number"
                    step="any"
                    value={c.zM}
                    onChange={(e) => updateColumn(c.id, { zM: e.target.value })}
                    placeholder="Z (m)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={c.servicePointLoadKN}
                    onChange={(e) => updateColumn(c.id, { servicePointLoadKN: e.target.value })}
                    placeholder="Pa (kN)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                  <input
                    type="number"
                    step="any"
                    value={c.factoredPointLoadKN}
                    onChange={(e) => updateColumn(c.id, { factoredPointLoadKN: e.target.value })}
                    placeholder="Pu (kN)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={c.columnWidthMm}
                    onChange={(e) => updateColumn(c.id, { columnWidthMm: e.target.value })}
                    placeholder="Width (mm)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                  <input
                    type="number"
                    step="any"
                    value={c.columnDepthMm}
                    onChange={(e) => updateColumn(c.id, { columnDepthMm: e.target.value })}
                    placeholder="Depth (mm)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={c.columnPosition}
                    onChange={(e) => updateColumn(c.id, { columnPosition: e.target.value as ColumnPosition })}
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  >
                    <option value="interior">Interior</option>
                    <option value="edge">Edge</option>
                    <option value="corner">Corner</option>
                  </select>
                  <input
                    type="number"
                    step="any"
                    value={c.tributaryCantileverMm}
                    onChange={(e) => updateColumn(c.id, { tributaryCantileverMm: e.target.value })}
                    placeholder="Cantilever (mm)"
                    className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addColumn}
              className="w-full rounded-md border border-dashed border-surface-border text-text-secondary hover:text-text-primary hover:border-text-muted text-xs py-1.5 transition-colors"
            >
              + Add Column
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunDesign}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
          >
            ▶ Run Mat Foundation Design
          </button>
        </>
      )}

      {report && <MatFoundationDesignReportView report={report} />}
    </div>
  );
}

function MatFoundationDesignReportView({ report }: { report: MatFoundationDesignReport }) {
  const statusStyle =
    report.overallStatus === "ok"
      ? "bg-status-activeBg border-status-activeBorder text-status-activeText"
      : report.overallStatus === "warning"
        ? "bg-status-holdBg border-status-holdBorder text-status-holdText"
        : "bg-red-50 border-red-200 text-red-600";
  const statusIcon = report.overallStatus === "ok" ? "✓" : report.overallStatus === "warning" ? "⚠" : "✗";

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2.5 ${statusStyle}`}>
        <p className="text-xs font-medium">
          {statusIcon} {report.elementLabel} — {report.overallStatus.toUpperCase()}
        </p>
      </div>

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
        <p className="text-xs text-text-muted font-medium mb-1">Pressure Distribution (Rigid Method)</p>
        <p className="text-xs text-text-secondary">
          Area {fmt(report.sizing.planAreaM2, 2)}m² · Avg pressure {fmt(report.sizing.averagePressureKPa)} kPa
        </p>
        <p className="text-xs text-text-secondary">
          Max {fmt(report.sizing.maxPressureKPa)} kPa · Min {fmt(report.sizing.minPressureKPa)} kPa
        </p>
        <p className="text-xs text-text-secondary">
          Eccentricity: X = {fmt(report.sizing.eccentricityXM, 3)}m, Z = {fmt(report.sizing.eccentricityZM, 3)}m
        </p>
      </div>

      {report.perColumn.map((c) => (
        <div key={c.label} className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
          <p className="text-xs text-text-muted font-medium mb-1">Column {c.label}</p>
          <p className="text-xs text-text-secondary">
            As = {fmt(c.flexuralDesign.governingAsMm2, 0)} mm²/m (M = {fmt(c.moment.momentKNmPerM)} kN·m/m)
          </p>
          <p className="text-xs text-text-secondary">
            Punching shear: {c.punchingShear.adequate ? "OK" : "NOT adequate"} — φVc = {fmt(c.punchingShear.phiVcKN)}{" "}
            kN
          </p>
        </div>
      ))}

      {report.allWarnings.length > 0 && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-text-muted font-medium">Warnings:</p>
          {report.allWarnings.map((w, i) => (
            <p key={i} className="text-xs text-status-holdText leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
