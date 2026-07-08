"use client";

import { useState, useMemo } from "react";
import type { LoadCase } from "@/lib/types/load";
import {
  createPointLoad,
  createUniformLineLoad,
  createUniformAreaLoad,
  createTemperatureChangeLoad,
} from "@/lib/types/load";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";

interface ElementLoadPanelProps {
  onAddLoadCase: (loadCase: LoadCase) => void;
  onDeleteLoadCase: (loadCaseId: string) => void;
}

const LINE_ELEMENT_CATEGORIES = new Set(["beam", "column", "brace", "pile"]);
const AREA_ELEMENT_CATEGORIES = new Set(["slab", "wall", "shear-wall", "core-wall"]);

/**
 * নির্বাচিত element-এর জ্যামিতিক ধরন (line/area/point) অনুযায়ী
 * উপযুক্ত load application form দেখায়। Beam/Column/Brace/Pile তে
 * Point বা Uniform Line load বসানো যায়, Slab/Wall/Shear Wall/Core
 * Wall তে Uniform Area load, Footing তে Point load। Temperature
 * Change যেকোনো element-এই প্রয়োগযোগ্য (একটা আলাদা টগল হিসেবে)।
 */
export function ElementLoadPanel({ onAddLoadCase, onDeleteLoadCase }: ElementLoadPanelProps) {
  const elements = useElementsStore((s) => s.elements);
  const patterns = useLoadStore((s) => s.patternLibrary.patterns);
  const loadCases = useLoadStore((s) => s.loadCases);

  const [elementId, setElementId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [applicationType, setApplicationType] = useState<
    "point" | "uniform-line" | "uniform-area" | "temperature-change"
  >("uniform-line");
  const [forceY, setForceY] = useState("-10");
  const [positionRatio, setPositionRatio] = useState("0.5");
  const [intensityY, setIntensityY] = useState("-10");
  const [intensity, setIntensity] = useState("-5");
  const [temperatureChange, setTemperatureChange] = useState("20");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedElement = elements.find((e) => e.elementId === elementId);

  const applicableTypes = useMemo((): typeof applicationType[] => {
    if (!selectedElement) return [];
    if (LINE_ELEMENT_CATEGORIES.has(selectedElement.category)) {
      return ["point", "uniform-line", "temperature-change"];
    }
    if (AREA_ELEMENT_CATEGORIES.has(selectedElement.category)) {
      return ["uniform-area", "temperature-change"];
    }
    // footing
    return ["point"];
  }, [selectedElement]);

  function resetForm() {
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!elementId) {
      setFormError("একটা Element নির্বাচন করুন");
      return;
    }
    if (!patternId) {
      setFormError("একটা Load Pattern নির্বাচন করুন");
      return;
    }

    let loadCase: LoadCase;

    switch (applicationType) {
      case "point": {
        const fy = Number(forceY);
        const ratio = Number(positionRatio);
        if (Number.isNaN(fy)) {
          setFormError("Force Y একটা বৈধ সংখ্যা হতে হবে (kN)");
          return;
        }
        if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
          setFormError("Position Ratio 0 থেকে 1 এর মধ্যে হতে হবে");
          return;
        }
        loadCase = createPointLoad({
          patternId,
          elementId,
          forceX: 0,
          forceY: fy,
          forceZ: 0,
          positionRatio: ratio,
        });
        break;
      }
      case "uniform-line": {
        const wy = Number(intensityY);
        if (Number.isNaN(wy)) {
          setFormError("Intensity একটা বৈধ সংখ্যা হতে হবে (kN/m)");
          return;
        }
        loadCase = createUniformLineLoad({ patternId, elementId, intensityY: wy });
        break;
      }
      case "uniform-area": {
        const w = Number(intensity);
        if (Number.isNaN(w)) {
          setFormError("Intensity একটা বৈধ সংখ্যা হতে হবে (kN/m²)");
          return;
        }
        loadCase = createUniformAreaLoad({ patternId, elementId, intensity: w });
        break;
      }
      case "temperature-change": {
        const dt = Number(temperatureChange);
        if (Number.isNaN(dt)) {
          setFormError("Temperature Change একটা বৈধ সংখ্যা হতে হবে (°C)");
          return;
        }
        loadCase = createTemperatureChangeLoad({ patternId, elementId, temperatureChange: dt });
        break;
      }
    }

    onAddLoadCase(loadCase);
    resetForm();
  }

  const elementLoadCases = loadCases.filter((lc) => lc.elementId === elementId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Element Load</h3>

        {patterns.length === 0 ? (
          <p className="text-xs text-amber-500">প্রথমে অন্তত একটা Load Pattern তৈরি করুন।</p>
        ) : elements.length === 0 ? (
          <p className="text-xs text-amber-500">প্রথমে অন্তত একটা Element তৈরি করুন।</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Element</label>
              <select
                value={elementId}
                onChange={(e) => {
                  setElementId(e.target.value);
                  setApplicationType("uniform-line"); // ডিফল্ট রিসেট, applicableTypes পরে ঠিক করবে
                }}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                <option value="">নির্বাচন করুন</option>
                {elements.map((el) => (
                  <option key={el.elementId} value={el.elementId}>
                    {el.label} ({el.category})
                  </option>
                ))}
              </select>
            </div>

            {selectedElement && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Load Pattern</label>
                  <select
                    value={patternId}
                    onChange={(e) => setPatternId(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {patterns.map((p) => (
                      <option key={p.patternId} value={p.patternId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">প্রয়োগের ধরন</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {applicableTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setApplicationType(type)}
                        className={`rounded-md px-1.5 py-1.5 text-xs transition-colors ${
                          applicationType === type
                            ? "bg-sky-700 text-white"
                            : "bg-slate-900 border border-slate-700 text-slate-400"
                        }`}
                      >
                        {type === "point"
                          ? "Point"
                          : type === "uniform-line"
                            ? "Uniform"
                            : type === "uniform-area"
                              ? "Area"
                              : "Temp."}
                      </button>
                    ))}
                  </div>
                </div>

                {applicationType === "point" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Force Y (kN)</label>
                      <input
                        type="number"
                        step="any"
                        value={forceY}
                        onChange={(e) => setForceY(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Position (0-1)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="1"
                        value={positionRatio}
                        onChange={(e) => setPositionRatio(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                      />
                    </div>
                  </div>
                )}

                {applicationType === "uniform-line" && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Intensity (kN/m)</label>
                    <input
                      type="number"
                      step="any"
                      value={intensityY}
                      onChange={(e) => setIntensityY(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>
                )}

                {applicationType === "uniform-area" && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Intensity (kN/m²)</label>
                    <input
                      type="number"
                      step="any"
                      value={intensity}
                      onChange={(e) => setIntensity(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>
                )}

                {applicationType === "temperature-change" && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Temperature Change (°C)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={temperatureChange}
                      onChange={(e) => setTemperatureChange(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>
                )}

                {formError && <p className="text-xs text-red-400">{formError}</p>}

                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-1.5 transition-colors"
                >
                  + Load যোগ করুন
                </button>
              </>
            )}
          </form>
        )}
      </div>

      {selectedElement && elementLoadCases.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500 mb-1.5">
            {selectedElement.label} এ প্রযুক্ত Load:
          </p>
          <ul className="space-y-1">
            {elementLoadCases.map((lc) => (
              <li
                key={lc.loadCaseId}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-800/60 text-slate-300"
              >
                <span className="text-xs">{describeLoadCase(lc)}</span>
                <button
                  type="button"
                  onClick={() => onDeleteLoadCase(lc.loadCaseId)}
                  className="text-xs text-red-500/70 hover:text-red-400 px-1"
                  title="ডিলিট করুন"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function describeLoadCase(loadCase: LoadCase): string {
  switch (loadCase.applicationType) {
    case "point":
      return `Point: ${loadCase.forceY} kN @ ratio ${loadCase.positionRatio}`;
    case "uniform-line":
      return `Uniform: ${loadCase.intensityY} kN/m`;
    case "uniform-area":
      return `Area: ${loadCase.intensity} kN/m²`;
    case "temperature-change":
      return `ΔT: ${loadCase.temperatureChange}°C`;
  }
}
