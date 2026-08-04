"use client";

import { useState } from "react";
import { layoutBeamBars, layoutColumnBars } from "@/lib/design/rebarLayout";
import {
  computeBeamSectionDetail,
  computeColumnSectionDetail,
  computeFootingSectionDetail,
  type BeamSectionDetail,
  type ColumnSectionDetail,
  type FootingSectionDetail,
} from "@/lib/design/sectionDetail";

type SectionMode = "beam" | "column" | "footing";

const MODE_LABELS: Record<SectionMode, string> = {
  beam: "RC Beam",
  column: "RC Column",
  footing: "Footing",
};

function fmt(v: number, decimals = 0): string {
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
      <label className="block text-[10px] text-slate-500 mb-0.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2 py-1.5"
      />
    </div>
  );
}

const SVG_PADDING = 20;
const SVG_MAX_SIZE = 260;

/** section-এর mm কো-অর্ডিনেটকে SVG viewport-এ fit করানো (y ফ্লিপ করে, কারণ SVG-তে y নিচের দিকে বাড়ে)। */
function useScale(widthMm: number, heightMm: number) {
  const scale = Math.min((SVG_MAX_SIZE - 2 * SVG_PADDING) / widthMm, (SVG_MAX_SIZE - 2 * SVG_PADDING) / heightMm);
  const toSvgX = (xMm: number) => SVG_PADDING + xMm * scale;
  const toSvgY = (yMm: number) => SVG_PADDING + (heightMm - yMm) * scale; // y-flip
  return { scale, toSvgX, toSvgY };
}

function BeamSvg({ detail }: { detail: BeamSectionDetail }) {
  const { scale, toSvgX, toSvgY } = useScale(detail.widthMm, detail.totalDepthMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(detail.totalDepthMm)}
        width={detail.widthMm * scale}
        height={detail.totalDepthMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <rect
        x={toSvgX(detail.stirrupOutline.xMm)}
        y={toSvgY(detail.stirrupOutline.yMm + detail.stirrupOutline.heightMm)}
        width={detail.stirrupOutline.widthMm * scale}
        height={detail.stirrupOutline.heightMm * scale}
        fill="none"
        stroke="#64748b"
        strokeDasharray="3,2"
        strokeWidth={1}
      />
      {detail.tensionBars.map((b, i) => (
        <circle key={`t${i}`} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.diameterMm / 2) * scale)} fill="#f59e0b" />
      ))}
      {detail.compressionBars.map((b, i) => (
        <circle key={`c${i}`} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.diameterMm / 2) * scale)} fill="#38bdf8" />
      ))}
    </svg>
  );
}

function ColumnSvg({ detail }: { detail: ColumnSectionDetail }) {
  const { scale, toSvgX, toSvgY } = useScale(detail.widthMm, detail.totalDepthMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(detail.totalDepthMm)}
        width={detail.widthMm * scale}
        height={detail.totalDepthMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <rect
        x={toSvgX(detail.tieOutline.xMm)}
        y={toSvgY(detail.tieOutline.yMm + detail.tieOutline.heightMm)}
        width={detail.tieOutline.widthMm * scale}
        height={detail.tieOutline.heightMm * scale}
        fill="none"
        stroke="#64748b"
        strokeDasharray="3,2"
        strokeWidth={1}
      />
      {detail.bars.map((b, i) => (
        <circle key={i} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.diameterMm / 2) * scale)} fill="#f59e0b" />
      ))}
    </svg>
  );
}

function FootingSvg({ detail }: { detail: FootingSectionDetail }) {
  const { scale, toSvgX, toSvgY } = useScale(detail.footingWidthMm, detail.footingThicknessMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(detail.footingThicknessMm)}
        width={detail.footingWidthMm * scale}
        height={detail.footingThicknessMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <rect
        x={toSvgX(detail.columnOutline.xMm)}
        y={0}
        width={detail.columnOutline.widthMm * scale}
        height={SVG_PADDING}
        fill="none"
        stroke="#64748b"
        strokeWidth={1}
      />
      {detail.bottomBars.map((b, i) => (
        <circle key={`b${i}`} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.diameterMm / 2) * scale)} fill="#f59e0b" />
      ))}
      {detail.topBars.map((b, i) => (
        <circle key={`t${i}`} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.diameterMm / 2) * scale)} fill="#38bdf8" />
      ))}
    </svg>
  );
}

/**
 * Phase 10e — Section Detail panel। 10a-এর abstract bar layout এখানে
 * concrete (x,y) কো-অর্ডিনেটে রূপান্তরিত হয়ে SVG cross-section হিসেবে
 * দেখা যায় (sectionDetail.ts দেখুন)।
 */
export function SectionDetailPanel() {
  const [mode, setMode] = useState<SectionMode>("beam");
  const [beamDetail, setBeamDetail] = useState<BeamSectionDetail | null>(null);
  const [columnDetail, setColumnDetail] = useState<ColumnSectionDetail | null>(null);
  const [footingDetail, setFootingDetail] = useState<FootingSectionDetail | null>(null);

  // Beam
  const [beamWidthMm, setBeamWidthMm] = useState("254");
  const [beamDepthMm, setBeamDepthMm] = useState("381");
  const [beamCoverMm, setBeamCoverMm] = useState("38");
  const [beamStirrupMm, setBeamStirrupMm] = useState("10");
  const [beamTensionAsMm2, setBeamTensionAsMm2] = useState("603");

  // Column
  const [colWidthMm, setColWidthMm] = useState("305");
  const [colDepthMm, setColDepthMm] = useState("457");
  const [colCoverMm, setColCoverMm] = useState("38");
  const [colTieMm, setColTieMm] = useState("10");
  const [colTotalAsMm2, setColTotalAsMm2] = useState("2413");
  const [colBarDiaMm, setColBarDiaMm] = useState("16");

  // Footing
  const [footWidthMm, setFootWidthMm] = useState("1829");
  const [footThicknessMm, setFootThicknessMm] = useState("450");
  const [footCoverMm, setFootCoverMm] = useState("63");
  const [footColumnWidthMm, setFootColumnWidthMm] = useState("305");
  const [footBarDiaMm, setFootBarDiaMm] = useState("16");
  const [footBarSpacingMm, setFootBarSpacingMm] = useState("150");

  function handleRun() {
    if (mode === "beam") {
      const layout = layoutBeamBars({
        elementLabel: "Beam",
        widthMm: Number(beamWidthMm) || 254,
        clearCoverMm: Number(beamCoverMm) || 38,
        stirrupDiameterMm: Number(beamStirrupMm) || 10,
        tensionAsMm2: Number(beamTensionAsMm2) || 0,
      });
      setBeamDetail(
        computeBeamSectionDetail({
          beamLayout: layout,
          widthMm: Number(beamWidthMm) || 254,
          totalDepthMm: Number(beamDepthMm) || 381,
          clearCoverMm: Number(beamCoverMm) || 38,
          stirrupDiameterMm: Number(beamStirrupMm) || 10,
        })
      );
    } else if (mode === "column") {
      const layout = layoutColumnBars({
        elementLabel: "Column",
        widthMm: Number(colWidthMm) || 305,
        totalDepthMm: Number(colDepthMm) || 457,
        clearCoverMm: Number(colCoverMm) || 38,
        tieDiameterMm: Number(colTieMm) || 10,
        totalAsMm2: Number(colTotalAsMm2) || 0,
        longitudinalBarDiameterMm: Number(colBarDiaMm) || 16,
      });
      setColumnDetail(
        computeColumnSectionDetail({
          columnLayout: layout,
          widthMm: Number(colWidthMm) || 305,
          totalDepthMm: Number(colDepthMm) || 457,
          clearCoverMm: Number(colCoverMm) || 38,
          tieDiameterMm: Number(colTieMm) || 10,
        })
      );
    } else {
      setFootingDetail(
        computeFootingSectionDetail({
          elementLabel: "Footing",
          footingWidthMm: Number(footWidthMm) || 1829,
          footingThicknessMm: Number(footThicknessMm) || 450,
          clearCoverMm: Number(footCoverMm) || 63,
          columnWidthMm: Number(footColumnWidthMm) || 305,
          bottomBarDiameterMm: Number(footBarDiaMm) || 16,
          bottomBarSpacingMm: Number(footBarSpacingMm) || 150,
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Section Detail</h3>
        <p className="text-xs text-slate-500 mb-3">
          10a-এর bar layout-কে section-এর ভিতরে actual (x,y) পজিশনে বসিয়ে cross-section আঁকে — Foundation Detail
          (footing) সহ।
        </p>

        <label className="block text-xs text-slate-500 mb-1">Element Type</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SectionMode)}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(MODE_LABELS) as SectionMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        {mode === "beam" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={beamWidthMm} onChange={setBeamWidthMm} unit="mm" />
              <Field label="Total Depth" value={beamDepthMm} onChange={setBeamDepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Cover" value={beamCoverMm} onChange={setBeamCoverMm} unit="mm" />
              <Field label="Stirrup Dia" value={beamStirrupMm} onChange={setBeamStirrupMm} unit="mm" />
            </div>
            <Field label="Tension As" value={beamTensionAsMm2} onChange={setBeamTensionAsMm2} unit="mm²" />
          </div>
        )}

        {mode === "column" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width" value={colWidthMm} onChange={setColWidthMm} unit="mm" />
              <Field label="Total Depth" value={colDepthMm} onChange={setColDepthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Cover" value={colCoverMm} onChange={setColCoverMm} unit="mm" />
              <Field label="Tie Dia" value={colTieMm} onChange={setColTieMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total As" value={colTotalAsMm2} onChange={setColTotalAsMm2} unit="mm²" />
              <Field label="Bar Dia" value={colBarDiaMm} onChange={setColBarDiaMm} unit="mm" />
            </div>
          </div>
        )}

        {mode === "footing" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Footing Width" value={footWidthMm} onChange={setFootWidthMm} unit="mm" />
              <Field label="Thickness" value={footThicknessMm} onChange={setFootThicknessMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clear Cover" value={footCoverMm} onChange={setFootCoverMm} unit="mm" />
              <Field label="Column Width" value={footColumnWidthMm} onChange={setFootColumnWidthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Bottom Bar Dia" value={footBarDiaMm} onChange={setFootBarDiaMm} unit="mm" />
              <Field label="Bottom Bar Spacing" value={footBarSpacingMm} onChange={setFootBarSpacingMm} unit="mm" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Draw Section
        </button>
      </div>

      {mode === "beam" && beamDetail && (
        <div className="space-y-3">
          <BeamSvg detail={beamDetail} />
          <p className="text-xs text-slate-400">
            Tension: {beamDetail.tensionBars.length} bars · Compression: {beamDetail.compressionBars.length} bars
          </p>
          {beamDetail.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {beamDetail.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "column" && columnDetail && (
        <div className="space-y-3">
          <ColumnSvg detail={columnDetail} />
          <p className="text-xs text-slate-400">{columnDetail.bars.length} longitudinal bars placed</p>
          {columnDetail.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {columnDetail.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "footing" && footingDetail && (
        <div className="space-y-3">
          <FootingSvg detail={footingDetail} />
          <p className="text-xs text-slate-400">
            Bottom: {footingDetail.bottomBars.length} bars ({fmt(footingDetail.bottomBars.length > 0 ? footingDetail.bottomBars[0].diameterMm : 0)}mmØ)
          </p>
          {footingDetail.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {footingDetail.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
