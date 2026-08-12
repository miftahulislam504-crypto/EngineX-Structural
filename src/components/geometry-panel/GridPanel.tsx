"use client";

import { useState } from "react";
import type { GridDirection, StructuralGrid } from "@/lib/types/geometry";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface GridPanelProps {
  onAddGrid: (grid: StructuralGrid) => void;
  onUpdateGrid: (grid: StructuralGrid) => void;
  onDeleteGrid: (gridId: string) => void;
}

function makeGridId(): string {
  return `grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function GridPanel({ onAddGrid, onUpdateGrid, onDeleteGrid }: GridPanelProps) {
  const grids = useGeometryStore((s) => s.geometry.grids);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<GridDirection>("X");
  const [coordinate, setCoordinate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedGridId = selection.type === "grid" ? selection.gridId : null;

  function resetForm() {
    setLabel("");
    setDirection("X");
    setCoordinate("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("গ্রিড লেবেল আবশ্যক (যেমন: A, B, 1, 2)");
      return;
    }

    const coordValue = Number(coordinate);
    if (coordinate.trim() === "" || Number.isNaN(coordValue)) {
      setFormError("কোঅর্ডিনেট একটা বৈধ সংখ্যা হতে হবে");
      return;
    }

    const duplicateLabel = grids.some(
      (g) => g.label === trimmedLabel && g.direction === direction
    );
    if (duplicateLabel) {
      setFormError(`${direction}-দিকে "${trimmedLabel}" লেবেলের গ্রিড ইতিমধ্যে আছে`);
      return;
    }

    const newGrid: StructuralGrid = {
      gridId: makeGridId(),
      label: trimmedLabel,
      direction,
      coordinate: coordValue,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddGrid(newGrid);
    resetForm();
  }

  function toggleVisibility(grid: StructuralGrid) {
    onUpdateGrid({ ...grid, visible: !grid.visible, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Grid System</h3>

        {grids.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো গ্রিড যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {grids.map((grid) => (
              <li
                key={grid.gridId}
                onClick={() => setSelection({ type: "grid", gridId: grid.gridId })}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                  selectedGridId === grid.gridId
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                    : "hover:bg-surface-hover text-text-secondary"
                }`}
              >
                <span>
                  <span className="font-medium">{grid.label}</span>
                  <span className="text-text-muted ml-1.5">
                    ({grid.direction} = {grid.coordinate}m)
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(grid);
                    }}
                    className="text-xs text-text-muted hover:text-text-primary px-1"
                    title={grid.visible ? "লুকান" : "দেখান"}
                  >
                    {grid.visible ? "👁" : "🚫"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGrid(grid.gridId);
                    }}
                    className="text-xs text-red-500/70 hover:text-red-600 px-1"
                    title="ডিলিট করুন"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="block text-xs text-text-muted mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="A"
              className="input-field"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs text-text-muted mb-1">দিক</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as GridDirection)}
              className="input-field"
            >
              <option value="X">X</option>
              <option value="Y">Y</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-xs text-text-muted mb-1">কোঅর্ডিনেট (m)</label>
            <input
              type="number"
              step="any"
              value={coordinate}
              onChange={(e) => setCoordinate(e.target.value)}
              placeholder="0.0"
              className="input-field"
            />
          </div>
        </div>

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <button type="submit" className="btn-primary w-full">
          + গ্রিড যোগ করুন
        </button>
      </form>
    </div>
  );
}
