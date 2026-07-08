"use client";

import { use, useState } from "react";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { DrawModeToolbar } from "@/components/viewport/DrawModeToolbar";
import { GridPanel } from "@/components/geometry-panel/GridPanel";
import { StoryPanel } from "@/components/geometry-panel/StoryPanel";
import { MaterialPanel } from "@/components/library-panel/MaterialPanel";
import { SectionPanel } from "@/components/library-panel/SectionPanel";
import { ElementPanel } from "@/components/elements-panel/ElementPanel";
import { AreaElementPanel } from "@/components/elements-panel/AreaElementPanel";
import { FootingPanel } from "@/components/elements-panel/FootingPanel";
import { LoadPatternPanel } from "@/components/load-panel/LoadPatternPanel";
import { WindLoadPanel } from "@/components/load-panel/WindLoadPanel";
import { SeismicLoadPanel } from "@/components/load-panel/SeismicLoadPanel";
import { ElementLoadPanel } from "@/components/load-panel/ElementLoadPanel";
import { LoadCombinationPanel } from "@/components/load-panel/LoadCombinationPanel";
import { useGeometryCore } from "@/lib/geometry/useGeometryCore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLoadCore } from "@/lib/loads/useLoadCore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useDrawModeStore } from "@/lib/viewport/useDrawModeStore";
import { usePendingAreaElementStore } from "@/lib/elements/usePendingAreaElementStore";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

type SidebarTab = "geometry" | "library" | "elements" | "loads";
type LoadSubTab = "patterns" | "wind" | "seismic" | "apply" | "combinations";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "geometry", label: "Geometry" },
  { id: "library", label: "Materials" },
  { id: "elements", label: "Elements" },
  { id: "loads", label: "Loads" },
];

const LOAD_SUB_TABS: { id: LoadSubTab; label: string }[] = [
  { id: "patterns", label: "Patterns" },
  { id: "wind", label: "Wind" },
  { id: "seismic", label: "EQ" },
  { id: "apply", label: "Apply" },
  { id: "combinations", label: "Combos" },
];

/**
 * Structural Model পেজ। এই App-এর কোনো "Project Create" নেই, তাই
 * projectId সরাসরি URL থেকে আসে (Hub থেকে navigate করে এখানে আসার
 * কথা, যেমন: /model/{projectId})।
 *
 * Phase 1: Geometry (Grid/Story)।
 * Phase 2a: + Materials/Sections (library tab) + Elements (Beam/Column)।
 * Phase 2b: + Draw Mode (Slab/Wall click-to-draw)।
 * Phase 2c: + Brace/Pile/Shear Wall/Core Wall, exotic materials/sections।
 * Phase 3: + Loads tab — Load Pattern, BNBC 2020 Wind/Seismic
 * calculator, Element Load application, Load Combination Generator।
 * Loads ট্যাবের ভিতরে একটা sub-tab সিস্টেম আছে (৫টা প্যানেল একসাথে
 * sidebar এ গাদাগাদি এড়াতে) — বাকি top-level ট্যাব গুলোর তুলনায়
 * এটা একটা nested navigation, কিন্তু scope যথেষ্ট বড় বলে এটা
 * যুক্তিসঙ্গত (Geometry ট্যাবেও Grid+Story দুটো প্যানেল আছে কিন্তু
 * ছোট বলে sub-tab লাগেনি, Loads এ ৫টা প্যানেল, প্রতিটাই নিজে জটিল)।
 *
 * চারটা ডোমেইন (geometry/library/elements/loads) আলাদা Firestore
 * ডকুমেন্ট/subcollection এ থাকে এবং প্রতিটার নিজস্ব orchestration
 * hook আছে — এই পেজ সবগুলোই একসাথে চালু করে (hook গুলো independent)।
 */
export default function StructuralModelPage({ params }: PageProps) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<SidebarTab>("geometry");
  const [activeLoadSubTab, setActiveLoadSubTab] = useState<LoadSubTab>("patterns");

  const { addGrid, updateGrid, deleteGrid, addStory, updateStory, deleteStory } =
    useGeometryCore(projectId);
  const { addMaterial, deleteMaterial, addSection, deleteSection } =
    useMaterialSectionLibrary(projectId);
  const { addElement, removeElement } = useElementsCore(projectId);
  const {
    addPattern,
    deletePattern,
    toggleCombination,
    addCustomCombination,
    addLoadCase,
    removeLoadCase,
  } = useLoadCore(projectId);

  const isGeometryLoading = useGeometryStore((s) => s.isLoading);
  const isLibraryLoading = useLibraryStore((s) => s.isLoading);
  const isElementsLoading = useElementsStore((s) => s.isLoading);
  const isLoadsLoading = useLoadStore((s) => s.isLoading);
  const isAnyLoading = isGeometryLoading || isLibraryLoading || isElementsLoading || isLoadsLoading;

  const isGeometrySaving = useGeometryStore((s) => s.isSaving);
  const isLibrarySaving = useLibraryStore((s) => s.isSaving);
  const isElementsSaving = useElementsStore((s) => s.isSaving);
  const isLoadsSaving = useLoadStore((s) => s.isSaving);
  const isSaving = isGeometrySaving || isLibrarySaving || isElementsSaving || isLoadsSaving;

  const geometryLoadError = useGeometryStore((s) => s.loadError);
  const libraryLoadError = useLibraryStore((s) => s.loadError);
  const elementsLoadError = useElementsStore((s) => s.loadError);
  const loadsLoadError = useLoadStore((s) => s.loadError);
  const loadError = geometryLoadError ?? libraryLoadError ?? elementsLoadError ?? loadsLoadError;

  const drawActiveCategory = useDrawModeStore((s) => s.activeCategory);
  const drawPoints = useDrawModeStore((s) => s.points);
  const finishDrawing = useDrawModeStore((s) => s.finishDrawing);
  const removeLastPoint = useDrawModeStore((s) => s.removeLastPoint);
  const cancelDrawing = useDrawModeStore((s) => s.cancelDrawing);
  const setPendingAreaElement = usePendingAreaElementStore((s) => s.setPending);

  function handleFinishDrawing() {
    if (!drawActiveCategory) return;
    const { points, storyId } = finishDrawing();
    setPendingAreaElement({ category: drawActiveCategory, vertices: points, storyId });
    setActiveTab("elements");
  }

  return (
    <main className="h-screen w-screen flex bg-slate-950 text-slate-100">
      <div className="flex-1 relative">
        <StructuralViewport />

        {drawActiveCategory && (
          <DrawModeToolbar
            category={drawActiveCategory}
            pointCount={drawPoints.length}
            onFinish={handleFinishDrawing}
            onUndo={removeLastPoint}
            onCancel={cancelDrawing}
          />
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-slate-900/80 backdrop-blur rounded-md px-2.5 py-1">
            Project: {projectId}
          </span>
          {isSaving && (
            <span className="text-xs text-amber-400 bg-slate-900/80 backdrop-blur rounded-md px-2.5 py-1">
              সেভ হচ্ছে...
            </span>
          )}
          {loadError && (
            <span className="text-xs text-red-400 bg-slate-900/80 backdrop-blur rounded-md px-2.5 py-1">
              লোড এরর: {loadError}
            </span>
          )}
        </div>
      </div>

      <aside className="w-80 border-l border-slate-800 bg-slate-900/60 flex flex-col">
        <div className="flex border-b border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-sm py-2.5 transition-colors ${
                activeTab === tab.id
                  ? "text-sky-400 border-b-2 border-sky-500 bg-slate-900"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "loads" && (
          <div className="flex border-b border-slate-800 bg-slate-950/50">
            {LOAD_SUB_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLoadSubTab(tab.id)}
                className={`flex-1 text-xs py-2 transition-colors ${
                  activeLoadSubTab === tab.id
                    ? "text-sky-400 bg-slate-900"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {isAnyLoading ? (
            <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
          ) : (
            <>
              {activeTab === "geometry" && (
                <div className="space-y-6">
                  <GridPanel
                    onAddGrid={addGrid}
                    onUpdateGrid={updateGrid}
                    onDeleteGrid={deleteGrid}
                  />
                  <StoryPanel
                    onAddStory={addStory}
                    onUpdateStory={updateStory}
                    onDeleteStory={deleteStory}
                  />
                </div>
              )}

              {activeTab === "library" && (
                <div className="space-y-6">
                  <MaterialPanel onAddMaterial={addMaterial} onDeleteMaterial={deleteMaterial} />
                  <SectionPanel onAddSection={addSection} onDeleteSection={deleteSection} />
                </div>
              )}

              {activeTab === "elements" && (
                <div className="space-y-6">
                  <ElementPanel onAddElement={addElement} onDeleteElement={removeElement} />
                  <AreaElementPanel onAddElement={addElement} onDeleteElement={removeElement} />
                  <FootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
                </div>
              )}

              {activeTab === "loads" && (
                <>
                  {activeLoadSubTab === "patterns" && (
                    <LoadPatternPanel onAddPattern={addPattern} onDeletePattern={deletePattern} />
                  )}
                  {activeLoadSubTab === "wind" && <WindLoadPanel />}
                  {activeLoadSubTab === "seismic" && <SeismicLoadPanel />}
                  {activeLoadSubTab === "apply" && (
                    <ElementLoadPanel onAddLoadCase={addLoadCase} onDeleteLoadCase={removeLoadCase} />
                  )}
                  {activeLoadSubTab === "combinations" && (
                    <LoadCombinationPanel
                      onToggleCombination={toggleCombination}
                      onAddCustomCombination={addCustomCombination}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </main>
  );
}

