"use client";

import { useState } from "react";
import type { Point3D, StructuralElement } from "@/lib/types/element";
import { createPileCap } from "@/lib/types/element";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface PileCapPanelProps {
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
 * Pile Cap এর জন্য single-point ফর্ম (FootingPanel এর প্যাটার্ন) —
 * প্লাস একটা pileGroupId select, যাতে এই cap কোন Pile Group বহন
 * করছে সেটা রেফারেন্স করা যায়।
 */
export function PileCapPanel({ onAddElement, onDeleteElement }: PileCapPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [label, setLabel] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [pileGroupId, setPileGroupId] = useState("");
  const [locX, setLocX] = useState("0");
  const [locY, setLocY] = useState("0");
  const [locZ, setLocZ] = useState("0");
  const [width, setWidth] = useState("2400");
  const [length, setLength] = useState("2400");
  const [thickness, setThickness] = useState("900");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;
  const pileCaps = elements.filter((e) => e.category === "pile-cap");
  const pileGroups = elements.filter((e) => e.category === "pile-group");

  function resetForm() {
    setLabel("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Pile Cap লেবেল আবশ্যক (যেমন: PC1)");
      return;
    }
    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }
    if (!pileGroupId) {
      setFormError("একটা Pile Group নির্বাচন করুন");
      return;
    }
    const location = parsePoint(locX, locY, locZ);
    if (!location) {
      setFormError("Location বৈধ সংখ্যা হতে হবে");
      return;
    }
    const widthValue = Number(width);
    const lengthValue = Number(length);
    const thicknessValue = Number(thickness);
    if (!widthValue || widthValue <= 0 || !lengthValue || lengthValue <= 0) {
      setFormError("Width ও Length বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }
    if (!thicknessValue || thicknessValue <= 0) {
      setFormError("Thickness একটা বৈধ পজিটিভ সংখ্যা হতে হবে (mm)");
      return;
    }

    const element = createPileCap({
      label: trimmedLabel,
      materialId,
      location,
      width: widthValue,
      length: lengthValue,
      thickness: thicknessValue,
      pileGroupId,
    });

    onAddElement(element);
    resetForm();
  }

  const noMaterials = materials.length === 0;
  const noPileGroups = pileGroups.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Pile Cap</h3>

        {pileCaps.length === 0 ? (
          <p className="text-xs text-slate-500">কোনো Pile Cap যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {pileCaps.map((element) => {
              if (element.category !== "pile-cap") return null;
              const group = pileGroups.find((g) => g.elementId === element.pileGroupId);
              return (
                <li
                  key={element.elementId}
                  onClick={() => setSelection({ type: "element", elementId: element.elementId })}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                    selectedElementId === element.elementId
                      ? "bg-sky-950 text-sky-300 ring-1 ring-sky-800"
                      : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <span>
                    <span className="font-medium">{element.label}</span>
                    <span className="text-slate-500 ml-1.5 text-xs">
                      ({group ? group.label : "no group"}, t={element.thickness}mm)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(element.elementId);
                    }}
                    className="text-xs text-red-500/70 hover:text-red-400 px-1"
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
        <p className="text-xs text-amber-500 border-t border-slate-800 pt-3">
          Pile Cap যোগ করার আগে অন্তত একটা Material লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : noPileGroups ? (
        <p className="text-xs text-amber-500 border-t border-slate-800 pt-3">
          Pile Cap যোগ করার আগে অন্তত একটা Pile Group থাকতে হবে।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-slate-800 pt-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="PC1"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Material</label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
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
            <label className="block text-xs text-slate-500 mb-1">Pile Group</label>
            <select
              value={pileGroupId}
              onChange={(e) => setPileGroupId(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            >
              <option value="">নির্বাচন করুন</option>
              {pileGroups.map((g) => (
                <option key={g.elementId} value={g.elementId}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Location (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={locX}
                onChange={(e) => setLocX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={locY}
                onChange={(e) => setLocY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={locZ}
                onChange={(e) => setLocZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Width (mm)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Length (mm)</label>
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Thickness (mm)</label>
              <input
                type="number"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-1.5 transition-colors"
          >
            + Pile Cap যোগ করুন
          </button>
        </form>
      )}
    </div>
  );
}
