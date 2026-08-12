"use client";

import { useState } from "react";
import type { Point3D, StructuralElement } from "@/lib/types/element";
import { createPileGroup } from "@/lib/types/element";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface PileGroupPanelProps {
  onAddElement: (element: StructuralElement) => void;
  onDeleteElement: (elementId: string) => void;
}

function parsePoint(x: string, y: string, z: string): Point3D | null {
  const px = Number(x);
  const py = Number(y);
  const pz = Number(z);
  if ([x, y, z].some((v) => v.trim() === "") || [px, py, pz].some(Number.isNaN)) {
    return null;
  }
  return { x: px, y: py, z: pz };
}

/**
 * Pile Group এর জন্য centroid + grid parameters ফর্ম। individual
 * pile geometry এখানে ইনপুট না — rows/columns/spacing থেকে Design
 * panel এ (pileCapGroupDesign.ts) derive করা হয়।
 */
export function PileGroupPanel({ onAddElement, onDeleteElement }: PileGroupPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [label, setLabel] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [cX, setCX] = useState("0");
  const [cY, setCY] = useState("0");
  const [cZ, setCZ] = useState("0");
  const [pileShape, setPileShape] = useState<"circular" | "square">("circular");
  const [pileDiameterOrWidthMm, setPileDiameterOrWidthMm] = useState("400");
  const [embeddedLengthMm, setEmbeddedLengthMm] = useState("12000");
  const [spacingMm, setSpacingMm] = useState("1200");
  const [rows, setRows] = useState("2");
  const [columns, setColumns] = useState("2");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;
  const pileGroups = elements.filter((e) => e.category === "pile-group");

  function resetForm() {
    setLabel("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Pile Group লেবেল আবশ্যক (যেমন: PG1)");
      return;
    }
    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }
    const centroidLocation = parsePoint(cX, cY, cZ);
    if (!centroidLocation) {
      setFormError("Centroid Location বৈধ সংখ্যা হতে হবে");
      return;
    }
    const diameterValue = Number(pileDiameterOrWidthMm);
    const embeddedValue = Number(embeddedLengthMm);
    const spacingValue = Number(spacingMm);
    const rowsValue = Number(rows);
    const columnsValue = Number(columns);
    if (!diameterValue || diameterValue <= 0) {
      setFormError("Pile Diameter/Width একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!embeddedValue || embeddedValue <= 0) {
      setFormError("Embedded Length একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!spacingValue || spacingValue <= 0) {
      setFormError("Pile Spacing একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!rowsValue || rowsValue < 1 || !columnsValue || columnsValue < 1) {
      setFormError("Rows ও Columns কমপক্ষে ১ হতে হবে");
      return;
    }

    const element = createPileGroup({
      label: trimmedLabel,
      materialId,
      centroidLocation,
      pileShape,
      pileDiameterOrWidthMm: diameterValue,
      embeddedLengthMm: embeddedValue,
      pileSpacingCenterToCenterMm: spacingValue,
      numberOfRows: rowsValue,
      numberOfColumns: columnsValue,
    });

    onAddElement(element);
    resetForm();
  }

  const noMaterials = materials.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Pile Group</h3>

        {pileGroups.length === 0 ? (
          <p className="text-xs text-text-muted">কোনো Pile Group যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {pileGroups.map((element) => {
              if (element.category !== "pile-group") return null;
              return (
                <li
                  key={element.elementId}
                  onClick={() => setSelection({ type: "element", elementId: element.elementId })}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                    selectedElementId === element.elementId
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : "hover:bg-surface-hover text-text-secondary"
                  }`}
                >
                  <span>
                    <span className="font-medium">{element.label}</span>
                    <span className="text-text-muted ml-1.5 text-xs">
                      ({element.numberOfRows}×{element.numberOfColumns} piles)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(element.elementId);
                    }}
                    className="text-xs text-red-500/70 hover:text-red-600 px-1"
                    title="ডিলিট করুন"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {noMaterials ? (
        <p className="text-xs text-status-holdText border-t border-surface-border pt-3">
          Pile Group যোগ করার আগে অন্তত একটা Material লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-surface-border pt-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="PG1"
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Material</label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="">নির্বাচন করুন</option>
              {materials.map((m) => (
                <option key={m.materialId} value={m.materialId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-1">Centroid Location (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={cX}
                onChange={(e) => setCX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={cY}
                onChange={(e) => setCY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
              <input
                type="number"
                step="any"
                value={cZ}
                onChange={(e) => setCZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Pile Shape</label>
              <select
                value={pileShape}
                onChange={(e) => setPileShape(e.target.value as "circular" | "square")}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              >
                <option value="circular">Circular</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Diameter/Width (mm)</label>
              <input
                type="number"
                value={pileDiameterOrWidthMm}
                onChange={(e) => setPileDiameterOrWidthMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Embedded Length (mm)</label>
              <input
                type="number"
                value={embeddedLengthMm}
                onChange={(e) => setEmbeddedLengthMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Spacing c/c (mm)</label>
              <input
                type="number"
                value={spacingMm}
                onChange={(e) => setSpacingMm(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Rows (Z-দিকে)</label>
              <input
                type="number"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Columns (X-দিকে)</label>
              <input
                type="number"
                value={columns}
                onChange={(e) => setColumns(e.target.value)}
                className="w-full rounded-md bg-surface-card border border-surface-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-1.5 transition-colors"
          >
            + Pile Group যোগ করুন
          </button>
        </form>
      )}
    </div>
  );
}
