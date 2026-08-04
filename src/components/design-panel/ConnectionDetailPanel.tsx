"use client";

import { useState } from "react";
import {
  computeBoltedConnectionLayout,
  computeWeldedConnectionLayout,
  computeBasePlateLayout,
  type BoltedConnectionLayout,
  type WeldedConnectionLayout,
  type BasePlateLayout,
} from "@/lib/design/connectionDetail";

type ConnectionMode = "bolted" | "welded" | "base-plate";

const MODE_LABELS: Record<ConnectionMode, string> = {
  bolted: "Bolted Shear Connection",
  welded: "Welded (Fillet) Connection",
  "base-plate": "Column Base Plate",
};

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

function useScale(widthMm: number, heightMm: number) {
  const scale = Math.min((SVG_MAX_SIZE - 2 * SVG_PADDING) / widthMm, (SVG_MAX_SIZE - 2 * SVG_PADDING) / heightMm);
  const toSvgX = (xMm: number) => SVG_PADDING + xMm * scale;
  const toSvgY = (yMm: number) => SVG_PADDING + (heightMm - yMm) * scale;
  return { scale, toSvgX, toSvgY };
}

function BoltedSvg({ layout }: { layout: BoltedConnectionLayout }) {
  const { scale, toSvgX, toSvgY } = useScale(layout.plateWidthMm, layout.plateHeightMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(layout.plateHeightMm)}
        width={layout.plateWidthMm * scale}
        height={layout.plateHeightMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      {layout.holes.map((h, i) => (
        <circle key={i} cx={toSvgX(h.xMm)} cy={toSvgY(h.yMm)} r={Math.max(2, (h.holeDiameterMm / 2) * scale)} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function WeldedSvg({ layout }: { layout: WeldedConnectionLayout }) {
  const { scale, toSvgX, toSvgY } = useScale(layout.plateWidthMm, layout.plateHeightMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(layout.plateHeightMm)}
        width={layout.plateWidthMm * scale}
        height={layout.plateHeightMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      {layout.weldLines.map((w, i) => (
        <line
          key={i}
          x1={toSvgX(w.x1Mm)}
          y1={toSvgY(w.y1Mm)}
          x2={toSvgX(w.x2Mm)}
          y2={toSvgY(w.y2Mm)}
          stroke="#f59e0b"
          strokeWidth={Math.max(2, layout.weldSizeMm * scale)}
        />
      ))}
    </svg>
  );
}

function BasePlateSvg({ layout }: { layout: BasePlateLayout }) {
  const { scale, toSvgX, toSvgY } = useScale(layout.plateWidthMm, layout.plateLengthMm);
  return (
    <svg width={SVG_MAX_SIZE} height={SVG_MAX_SIZE} className="bg-slate-950 rounded-md border border-slate-800">
      <rect
        x={toSvgX(0)}
        y={toSvgY(layout.plateLengthMm)}
        width={layout.plateWidthMm * scale}
        height={layout.plateLengthMm * scale}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <rect
        x={toSvgX(layout.columnOutline.xMm)}
        y={toSvgY(layout.columnOutline.yMm + layout.columnOutline.heightMm)}
        width={layout.columnOutline.widthMm * scale}
        height={layout.columnOutline.heightMm * scale}
        fill="none"
        stroke="#64748b"
        strokeDasharray="3,2"
        strokeWidth={1}
      />
      {layout.anchorBolts.map((b, i) => (
        <circle key={i} cx={toSvgX(b.xMm)} cy={toSvgY(b.yMm)} r={Math.max(2, (b.holeDiameterMm / 2) * scale)} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

/**
 * Phase 10f — Connection Detail panel। Phase 6g-এর bolted/welded/base-plate
 * capacity check-কে actual bolt hole/weld line geometry-তে রূপান্তর করে
 * (connectionDetail.ts দেখুন)।
 */
export function ConnectionDetailPanel() {
  const [mode, setMode] = useState<ConnectionMode>("bolted");
  const [boltedLayout, setBoltedLayout] = useState<BoltedConnectionLayout | null>(null);
  const [weldedLayout, setWeldedLayout] = useState<WeldedConnectionLayout | null>(null);
  const [basePlateLayout, setBasePlateLayout] = useState<BasePlateLayout | null>(null);

  // Bolted
  const [numberOfBolts, setNumberOfBolts] = useState("4");
  const [boltDiameterMm, setBoltDiameterMm] = useState("22");
  const [boltSpacingMm, setBoltSpacingMm] = useState("75");
  const [edgeDistanceMm, setEdgeDistanceMm] = useState("40");
  const [boltedPlateWidthMm, setBoltedPlateWidthMm] = useState("150");
  const [boltedPlateHeightMm, setBoltedPlateHeightMm] = useState("300");

  // Welded
  const [weldSizeMm, setWeldSizeMm] = useState("8");
  const [weldLengthMm, setWeldLengthMm] = useState("240");
  const [weldedPlateWidthMm, setWeldedPlateWidthMm] = useState("150");
  const [weldedPlateHeightMm, setWeldedPlateHeightMm] = useState("200");

  // Base plate
  const [plateLengthMm, setPlateLengthMm] = useState("400");
  const [plateWidthMm, setPlateWidthMm] = useState("400");
  const [columnDepthMm, setColumnDepthMm] = useState("310");
  const [columnFlangeWidthMm, setColumnFlangeWidthMm] = useState("205");
  const [anchorBoltDiameterMm, setAnchorBoltDiameterMm] = useState("25");
  const [anchorBoltEdgeDistanceMm, setAnchorBoltEdgeDistanceMm] = useState("50");

  function handleRun() {
    if (mode === "bolted") {
      setBoltedLayout(
        computeBoltedConnectionLayout({
          numberOfBolts: Number(numberOfBolts) || 4,
          boltDiameterMm: Number(boltDiameterMm) || 22,
          boltSpacingMm: Number(boltSpacingMm) || 75,
          edgeDistanceMm: Number(edgeDistanceMm) || 40,
          plateWidthMm: Number(boltedPlateWidthMm) || 150,
          plateHeightMm: Number(boltedPlateHeightMm) || 300,
        })
      );
    } else if (mode === "welded") {
      setWeldedLayout(
        computeWeldedConnectionLayout({
          weldSizeMm: Number(weldSizeMm) || 8,
          weldLengthMm: Number(weldLengthMm) || 240,
          plateWidthMm: Number(weldedPlateWidthMm) || 150,
          plateHeightMm: Number(weldedPlateHeightMm) || 200,
        })
      );
    } else {
      setBasePlateLayout(
        computeBasePlateLayout({
          plateLengthMm: Number(plateLengthMm) || 400,
          plateWidthMm: Number(plateWidthMm) || 400,
          columnDepthMm: Number(columnDepthMm) || 310,
          columnFlangeWidthMm: Number(columnFlangeWidthMm) || 205,
          anchorBoltDiameterMm: Number(anchorBoltDiameterMm) || 25,
          anchorBoltEdgeDistanceMm: Number(anchorBoltEdgeDistanceMm) || 50,
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Connection Detail</h3>
        <p className="text-xs text-slate-500 mb-3">
          Phase 6g-এর bolt/weld/plate arrangement-কে actual geometry-তে বসায় — bolt hole, weld line, anchor bolt
          position।
        </p>

        <label className="block text-xs text-slate-500 mb-1">Connection Type</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ConnectionMode)}
          className="w-full rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-sm px-2.5 py-2 mb-3"
        >
          {(Object.keys(MODE_LABELS) as ConnectionMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        {mode === "bolted" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Number of Bolts" value={numberOfBolts} onChange={setNumberOfBolts} />
              <Field label="Bolt Diameter" value={boltDiameterMm} onChange={setBoltDiameterMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Bolt Spacing" value={boltSpacingMm} onChange={setBoltSpacingMm} unit="mm" />
              <Field label="Edge Distance" value={edgeDistanceMm} onChange={setEdgeDistanceMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plate Width" value={boltedPlateWidthMm} onChange={setBoltedPlateWidthMm} unit="mm" />
              <Field label="Plate Height" value={boltedPlateHeightMm} onChange={setBoltedPlateHeightMm} unit="mm" />
            </div>
          </div>
        )}

        {mode === "welded" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Weld Size" value={weldSizeMm} onChange={setWeldSizeMm} unit="mm" />
              <Field label="Total Weld Length" value={weldLengthMm} onChange={setWeldLengthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plate Width" value={weldedPlateWidthMm} onChange={setWeldedPlateWidthMm} unit="mm" />
              <Field label="Plate Height" value={weldedPlateHeightMm} onChange={setWeldedPlateHeightMm} unit="mm" />
            </div>
          </div>
        )}

        {mode === "base-plate" && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plate Length (N)" value={plateLengthMm} onChange={setPlateLengthMm} unit="mm" />
              <Field label="Plate Width (B)" value={plateWidthMm} onChange={setPlateWidthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Column Depth" value={columnDepthMm} onChange={setColumnDepthMm} unit="mm" />
              <Field label="Column Flange Width" value={columnFlangeWidthMm} onChange={setColumnFlangeWidthMm} unit="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Anchor Bolt Dia" value={anchorBoltDiameterMm} onChange={setAnchorBoltDiameterMm} unit="mm" />
              <Field label="Anchor Edge Distance" value={anchorBoltEdgeDistanceMm} onChange={setAnchorBoltEdgeDistanceMm} unit="mm" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
        >
          Draw Connection
        </button>
      </div>

      {mode === "bolted" && boltedLayout && (
        <div className="space-y-3">
          <BoltedSvg layout={boltedLayout} />
          <p className="text-xs text-slate-400">{boltedLayout.holes.length} bolt holes</p>
          {boltedLayout.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {boltedLayout.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "welded" && weldedLayout && (
        <div className="space-y-3">
          <WeldedSvg layout={weldedLayout} />
          {weldedLayout.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {weldedLayout.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "base-plate" && basePlateLayout && (
        <div className="space-y-3">
          <BasePlateSvg layout={basePlateLayout} />
          <p className="text-xs text-slate-400">{basePlateLayout.anchorBolts.length} anchor bolts</p>
          {basePlateLayout.warnings.length > 0 && (
            <div className="rounded-md bg-amber-950/20 border border-amber-900/60 px-3 py-2.5 space-y-1">
              {basePlateLayout.warnings.map((w, i) => (
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
