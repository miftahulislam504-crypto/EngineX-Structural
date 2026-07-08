"use client";

import { useState } from "react";
import type { Point3D, StructuralElement } from "@/lib/types/element";
import { createBeam, createColumn, createBrace, createPile } from "@/lib/types/element";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface ElementPanelProps {
  onAddElement: (element: StructuralElement) => void;
  onDeleteElement: (elementId: string) => void;
}

type LineElementCategory = "beam" | "column" | "brace" | "pile";

const LINE_CATEGORY_LABELS: Record<LineElementCategory, string> = {
  beam: "Beam",
  column: "Column",
  brace: "Brace",
  pile: "Pile",
};

const LINE_CATEGORY_LABEL_PREFIXES: Record<LineElementCategory, string> = {
  beam: "B1",
  column: "C1",
  brace: "BR1",
  pile: "P1",
};

// Pile সাধারণত base level এর নিচে যায় — কোনো story-র elevation এ না,
// তাই এর জন্য storyId ফিল্ড আসেই না (createPile এর param signature এ
// storyId নেই, src/lib/types/element.ts দেখুন)। Brace/Beam/Column
// সবাই storyId নেয়।
const CATEGORIES_WITHOUT_STORY: ReadonlySet<LineElementCategory> = new Set(["pile"]);

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
 * Beam, Column, Brace, Pile — চারটাই Line Element, একই ফর্ম শেয়ার
 * করে (start/end point টাইপ করা, click-to-draw না — কারণ দুটো
 * পয়েন্টের সরলরেখা টাইপ করাই polygon vertex এর চেয়ে সহজ)।
 *
 * storyId সিলেক্টেড story থেকে auto-fill হয় (Y-কোঅর্ডিনেট থেকে অনুমান
 * করা হয় না, কারণ startY ≠ endY হলে — যেমন একটা raked/inclined
 * column বা diagonal brace — কোন story-তে এটা "belongs" করে তা
 * অস্পষ্ট হয়ে যেত)। Pile-এর ক্ষেত্রে storyId ফিল্ডই নেই (base level-এর
 * নিচে যায় বলে)।
 *
 * connectionType (moment/pin) createBeam/createColumn/createBrace/
 * createPile এর ডিফল্ট মান ব্যবহার করছে এখানে (Beam/Column/Pile =
 * moment, Brace = pin) — ভবিষ্যতে ফর্মে override করার UI যোগ করা
 * যাবে, কিন্তু এখন ডিফল্টই বেশিরভাগ বাস্তব কেসে সঠিক।
 */
export function ElementPanel({ onAddElement, onDeleteElement }: ElementPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const materials = useLibraryStore((s) => s.materialLibrary.materials);
  const sections = useLibraryStore((s) => s.sectionLibrary.sections);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [category, setCategory] = useState<LineElementCategory>("beam");
  const [label, setLabel] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [startX, setStartX] = useState("0");
  const [startY, setStartY] = useState("0");
  const [startZ, setStartZ] = useState("0");
  const [endX, setEndX] = useState("5");
  const [endY, setEndY] = useState("0");
  const [endZ, setEndZ] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElementId = selection.type === "element" ? selection.elementId : null;
  const lineElements = elements.filter(
    (e) => e.category === "beam" || e.category === "column" || e.category === "brace" || e.category === "pile"
  );

  function resetForm() {
    setLabel("");
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError(`Element লেবেল আবশ্যক (যেমন: ${LINE_CATEGORY_LABEL_PREFIXES[category]})`);
      return;
    }

    if (!materialId) {
      setFormError("একটা Material নির্বাচন করুন");
      return;
    }

    if (!sectionId) {
      setFormError("একটা Section নির্বাচন করুন");
      return;
    }

    const startPoint = parsePoint(startX, startY, startZ);
    const endPoint = parsePoint(endX, endY, endZ);

    if (!startPoint || !endPoint) {
      setFormError("Start ও End পয়েন্ট বৈধ সংখ্যা হতে হবে");
      return;
    }

    if (
      startPoint.x === endPoint.x &&
      startPoint.y === endPoint.y &&
      startPoint.z === endPoint.z
    ) {
      setFormError("Start ও End পয়েন্ট একই হতে পারবে না (শূন্য length element অবৈধ)");
      return;
    }

    const storyId = selection.type === "story" ? selection.storyId : undefined;

    let element: StructuralElement;
    switch (category) {
      case "beam":
        element = createBeam({ label: trimmedLabel, materialId, sectionId, startPoint, endPoint, storyId });
        break;
      case "column":
        element = createColumn({ label: trimmedLabel, materialId, sectionId, startPoint, endPoint, storyId });
        break;
      case "brace":
        element = createBrace({ label: trimmedLabel, materialId, sectionId, startPoint, endPoint, storyId });
        break;
      case "pile":
        // storyId এখানে ইচ্ছাকৃতভাবে পাস করা হচ্ছে না — createPile এর
        // param টাইপেই এই ফিল্ড নেই (উপরের মন্তব্য দেখুন)।
        element = createPile({ label: trimmedLabel, materialId, sectionId, startPoint, endPoint });
        break;
    }

    onAddElement(element);
    resetForm();
  }

  const noLibraryData = materials.length === 0 || sections.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Beam / Column / Brace / Pile</h3>

        {lineElements.length === 0 ? (
          <p className="text-xs text-slate-500">কোনো element যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {lineElements.map((element) => (
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
                    ({LINE_CATEGORY_LABELS[element.category as LineElementCategory]})
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
            ))}
          </ul>
        )}
      </div>

      {noLibraryData ? (
        <p className="text-xs text-amber-500 border-t border-slate-800 pt-3">
          Element যোগ করার আগে অন্তত একটা Material ও একটা Section লাইব্রেরিতে থাকতে হবে।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-slate-800 pt-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">ধরন</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(LINE_CATEGORY_LABELS) as LineElementCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                    category === cat
                      ? "bg-sky-700 text-white"
                      : "bg-slate-900 border border-slate-700 text-slate-400"
                  }`}
                >
                  {LINE_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {CATEGORIES_WITHOUT_STORY.has(category) && (
            <p className="text-xs text-slate-500 bg-slate-900/60 rounded-md px-2.5 py-2">
              ℹ️ Pile কোনো story-র সাথে associate থাকে না — এটা সবসময় base level এর নিচে ধরা হয়।
            </p>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">লেবেল</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={LINE_CATEGORY_LABEL_PREFIXES[category]}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
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
              <label className="block text-xs text-slate-500 mb-1">Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                <option value="">নির্বাচন করুন</option>
                {sections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Start Point (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={startX}
                onChange={(e) => setStartX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={startY}
                onChange={(e) => setStartY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={startZ}
                onChange={(e) => setStartZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">End Point (m)</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                step="any"
                value={endX}
                onChange={(e) => setEndX(e.target.value)}
                placeholder="X"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={endY}
                onChange={(e) => setEndY(e.target.value)}
                placeholder="Y"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <input
                type="number"
                step="any"
                value={endZ}
                onChange={(e) => setEndZ(e.target.value)}
                placeholder="Z"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-1.5 transition-colors"
          >
            + {LINE_CATEGORY_LABELS[category]} যোগ করুন
          </button>
        </form>
      )}
    </div>
  );
}
