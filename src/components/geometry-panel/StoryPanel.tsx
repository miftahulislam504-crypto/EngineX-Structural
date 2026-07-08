"use client";

import { useState } from "react";
import type { StructuralStory } from "@/lib/types/geometry";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

interface StoryPanelProps {
  onAddStory: (story: StructuralStory) => void;
  onUpdateStory: (story: StructuralStory) => void;
  onDeleteStory: (storyId: string) => void;
}

function makeStoryId(): string {
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * story height গুলো elevation থেকে derive করা হয় (পরবর্তী story-র
 * elevation বিয়োগ বর্তমান story-র elevation) — height কে আলাদা করে
 * ম্যানুয়ালি এডিট করার সুযোগ Phase 1-এ রাখা হয়নি, কারণ সেটা elevation
 * এর সাথে সহজেই অসামঞ্জস্যপূর্ণ হয়ে যেতে পারে (উদাহরণ: height বদলালে
 * পরের সব story-র elevation-ও বদলানো লাগবে, যেটা একটা আলাদা,
 * ইচ্ছাকৃতভাবে পরে করার মতো ফিচার — "Insert Story" বা "Adjust
 * Heights" নামে ভবিষ্যতে যোগ হতে পারে)।
 */
function computeStoryHeights(stories: StructuralStory[]): StructuralStory[] {
  const sorted = [...stories].sort((a, b) => a.elevation - b.elevation);
  return sorted.map((story, index) => {
    const next = sorted[index + 1];
    const height = next ? next.elevation - story.elevation : 0;
    return { ...story, height };
  });
}

export function StoryPanel({ onAddStory, onUpdateStory, onDeleteStory }: StoryPanelProps) {
  const stories = useGeometryStore((s) => s.geometry.stories);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const [isBaseLevel, setIsBaseLevel] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedStoryId = selection.type === "story" ? selection.storyId : null;
  const displayStories = computeStoryHeights(stories);

  function resetForm() {
    setName("");
    setElevation("");
    setIsBaseLevel(false);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Story নাম আবশ্যক (যেমন: Ground Floor, Level 1)");
      return;
    }

    const elevationValue = Number(elevation);
    if (elevation.trim() === "" || Number.isNaN(elevationValue)) {
      setFormError("Elevation একটা বৈধ সংখ্যা হতে হবে");
      return;
    }

    const duplicateElevation = stories.some(
      (s) => Math.abs(s.elevation - elevationValue) < 0.001
    );
    if (duplicateElevation) {
      setFormError(`Elevation ${elevationValue}m এ ইতিমধ্যে একটা story আছে`);
      return;
    }

    const newStory: StructuralStory = {
      storyId: makeStoryId(),
      name: trimmedName,
      elevation: elevationValue,
      height: 0, // computeStoryHeights সেভের পর UI তে ঠিক করে দেখাবে
      order: 0, // sort হওয়ার পর পুনর্গণনা করা হয় saveGeometryCore এর আগে
      isBaseLevel,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddStory(newStory);
    resetForm();
  }

  function toggleVisibility(story: StructuralStory) {
    onUpdateStory({ ...story, visible: !story.visible, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Story System</h3>

        {displayStories.length === 0 ? (
          <p className="text-xs text-slate-500">কোনো story যোগ করা হয়নি।</p>
        ) : (
          <ul className="space-y-1">
            {[...displayStories].reverse().map((story) => (
              <li
                key={story.storyId}
                onClick={() => setSelection({ type: "story", storyId: story.storyId })}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                  selectedStoryId === story.storyId
                    ? "bg-sky-950 text-sky-300 ring-1 ring-sky-800"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <span>
                  <span className="font-medium">{story.name}</span>
                  {story.isBaseLevel && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-500">
                      base
                    </span>
                  )}
                  <span className="text-slate-500 ml-1.5 block text-xs">
                    EL {story.elevation.toFixed(2)}m
                    {story.height > 0 && ` · H ${story.height.toFixed(2)}m`}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(story);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 px-1"
                    title={story.visible ? "লুকান" : "দেখান"}
                  >
                    {story.visible ? "👁" : "🚫"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStory(story.storyId);
                    }}
                    className="text-xs text-red-500/70 hover:text-red-400 px-1"
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

      <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-slate-800 pt-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ground Floor"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Elevation (m)</label>
            <input
              type="number"
              step="any"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 pb-1.5">
            <input
              type="checkbox"
              checked={isBaseLevel}
              onChange={(e) => setIsBaseLevel(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900"
            />
            Base Level
          </label>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium py-1.5 transition-colors"
        >
          + Story যোগ করুন
        </button>
      </form>
    </div>
  );
}
