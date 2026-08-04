"use client";

import { use, useState } from "react";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { VisualizationViewport } from "@/components/viewport/VisualizationViewport";
import { VisualizationControlsPanel } from "@/components/viewport/VisualizationControlsPanel";
import { DrawModeToolbar } from "@/components/viewport/DrawModeToolbar";
import { GridPanel } from "@/components/geometry-panel/GridPanel";
import { StoryPanel } from "@/components/geometry-panel/StoryPanel";
import { MaterialPanel } from "@/components/library-panel/MaterialPanel";
import { SectionPanel } from "@/components/library-panel/SectionPanel";
import { ElementPanel } from "@/components/elements-panel/ElementPanel";
import { AreaElementPanel } from "@/components/elements-panel/AreaElementPanel";
import { FootingPanel } from "@/components/elements-panel/FootingPanel";
import { CombinedFootingPanel } from "@/components/elements-panel/CombinedFootingPanel";
import { StripFootingPanel } from "@/components/elements-panel/StripFootingPanel";
import { PileGroupPanel } from "@/components/elements-panel/PileGroupPanel";
import { PileCapPanel } from "@/components/elements-panel/PileCapPanel";
import { LoadPatternPanel } from "@/components/load-panel/LoadPatternPanel";
import { WindLoadPanel } from "@/components/load-panel/WindLoadPanel";
import { SeismicLoadPanel } from "@/components/load-panel/SeismicLoadPanel";
import { ElementLoadPanel } from "@/components/load-panel/ElementLoadPanel";
import { LoadCombinationPanel } from "@/components/load-panel/LoadCombinationPanel";
import { AnalysisPanel } from "@/components/analysis-panel/AnalysisPanel";
import { ValidationPanel } from "@/components/validation-panel/ValidationPanel";
import { RcBeamDesignPanel } from "@/components/design-panel/RcBeamDesignPanel";
import { RcColumnDesignPanel } from "@/components/design-panel/RcColumnDesignPanel";
import { SteelBeamDesignPanel } from "@/components/design-panel/SteelBeamDesignPanel";
import { SteelColumnDesignPanel } from "@/components/design-panel/SteelColumnDesignPanel";
import { RcSlabDesignPanel } from "@/components/design-panel/RcSlabDesignPanel";
import { RcWallDesignPanel } from "@/components/design-panel/RcWallDesignPanel";
import { FootingDesignPanel } from "@/components/design-panel/FootingDesignPanel";
import { CombinedFootingDesignPanel } from "@/components/design-panel/CombinedFootingDesignPanel";
import { StripFootingDesignPanel } from "@/components/design-panel/StripFootingDesignPanel";
import { MatFoundationDesignPanel } from "@/components/design-panel/MatFoundationDesignPanel";
import { PileCapDesignPanel } from "@/components/design-panel/PileCapDesignPanel";
import { GeotechnicalToolsPanel } from "@/components/design-panel/GeotechnicalToolsPanel";
import { FoundationOptimizationPanel } from "@/components/design-panel/FoundationOptimizationPanel";
import { SectionOptimizationPanel } from "@/components/design-panel/SectionOptimizationPanel";
import { WeightOptimizationPanel } from "@/components/design-panel/WeightOptimizationPanel";
import { CostOptimizationPanel } from "@/components/design-panel/CostOptimizationPanel";
import { ConstructionAiTopologyOptimizationPanel } from "@/components/design-panel/ConstructionAiTopologyOptimizationPanel";
import { BaseIsolationEnergyDissipationPanel } from "@/components/design-panel/BaseIsolationEnergyDissipationPanel";
import { CollapsePredictionPanel } from "@/components/design-panel/CollapsePredictionPanel";
import { RebarLayoutPanel } from "@/components/design-panel/RebarLayoutPanel";
import { StirrupTieZonePanel } from "@/components/design-panel/StirrupTieZonePanel";
import { DevelopmentLengthPanel } from "@/components/design-panel/DevelopmentLengthPanel";
import { BarBendingSchedulePanel } from "@/components/design-panel/BarBendingSchedulePanel";
import { SectionDetailPanel } from "@/components/design-panel/SectionDetailPanel";
import { ConnectionDetailPanel } from "@/components/design-panel/ConnectionDetailPanel";
import { GeneralNotesPanel } from "@/components/design-panel/GeneralNotesPanel";
import { DrawingSyncPanel } from "@/components/design-panel/DrawingSyncPanel";
import { PileDesignPanel } from "@/components/design-panel/PileDesignPanel";
import { SteelConnectionDesignPanel } from "@/components/design-panel/SteelConnectionDesignPanel";
import { RetainingWallDesignPanel } from "@/components/design-panel/RetainingWallDesignPanel";
import { DetailingPanel } from "@/components/detailing-panel/DetailingPanel";
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
import { WorkflowSidebar } from "@/components/workflow/WorkflowSidebar";
import { TabNavBar } from "@/components/workflow/TabNavBar";
import { WorkflowModeToggle } from "@/components/workflow/WorkflowModeToggle";
import { ActiveStageBanner } from "@/components/workflow/ActiveStageBanner";
import { useWorkflowUiStore } from "@/lib/workflow/useWorkflowUiStore";
import { STAGES, OPTIMIZATION_DESIGN_SUB_TABS, VERIFICATION_DESIGN_SUB_TAB } from "@/lib/workflow/stageTabs";
import type { SidebarTab, LoadSubTab, DesignSubTab } from "@/lib/workflow/stageTabs";
import type { StageId } from "@/lib/workflow/types";

export type { SidebarTab, LoadSubTab, DesignSubTab };

interface PageProps {
  params: Promise<{ projectId: string }>;
}

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
 * Phase 5: + Validation ট্যাব — Model Checker (connectivity/duplicate/
 * geometry/support), Load Verification, Design Verification (material/
 * section reference integrity + known solver limitations), Code
 * Compliance sanity check, ও Model Health Score। Analysis ট্যাবের
 * পাশে independent রাখা হয়েছে যাতে Analysis চালানোর আগে বা পরে যেকোনো
 * সময় মডেল-স্বাস্থ্য দেখা যায়।
 * Phase 6a: + Design ট্যাব — RC Beam Design (flexure As, shear stirrup
 * spacing, deflection min-thickness, crack-control spacing, ACI
 * 318-19/BNBC 2020)। নির্বাচিত beam এর জন্য সর্বশেষ Analysis run এর
 * elementEndForces (useAnalysisResultStore) থেকে governing Mu/Vu
 * auto-populate করে, ইঞ্জিনিয়ার override করতে পারেন।
 * Phase 6b: Design ট্যাব এ sub-tab (RC Beam / RC Column) যোগ। RC
 * Column Design — slenderness (ACI moment magnification method),
 * P-M interaction diagram/adequacy (strain-compatibility + Whitney
 * block, ACI 0.80 tied-column axial cap), longitudinal reinforcement
 * ratio (1-8%), tie spacing (§25.7.2)। rectangular tied column,
 * uniaxial bending — biaxial ও circular section পরে যোগ হবে।
 * Phase 6c: + Steel Beam / Steel Column sub-tab। AISC 360-16 —
 * flexure (Chapter F: compactness, yielding/LTB with the FULL F2-6/
 * F2-4 equations including J, Cw, ho, rts — an earlier simplified
 * no-J approximation was found during testing to overestimate Lr by
 * ~26x and has been corrected), shear (Chapter G), compression
 * (Chapter E, flexural buckling), combined interaction (Chapter H1)।
 * W-shape section only, uniaxial major-axis bending।
 * Phase 6d: + RC Slab / RC Wall sub-tab। FE shell element stress/
 * moment recovery এখনো নেই (backend limitation, Phase 4a থেকে) —
 * তাই এই দুই panel FE result ব্যবহার করে না, ACI approximate পদ্ধতি
 * ব্যবহার করে: Slab — moment coefficient method (Chapter 8, one-way
 * ও সরলীকৃত two-way), min thickness (Table 8.3.1.1), punching shear
 * (§22.6, interior/edge/corner)। Wall — empirical axial method
 * (§11.5.3), min horizontal/vertical reinforcement (§11.6), Shear
 * Wall/Core Wall এর জন্য ঐচ্ছিক basic in-plane shear check (§11.5.4,
 * boundary element design বাদে)।
 * Phase 6e: + Footing / Pile sub-tab। এই app কোনো geotechnical
 * analysis করে না — allowable bearing pressure, unit skin friction,
 * end bearing pressure সব geotechnical report থেকে ইঞ্জিনিয়ার
 * সরবরাহ করেন। Footing — ACI 318-19 Ch.13: soil-bearing sizing,
 * cantilever-strip flexural design (উভয় দিকে, rcBeamFlexure পুনঃ
 * ব্যবহার করে), one-way shear, punching shear (rcSlabPunchingShear
 * পুনঃব্যবহার)। Pile — সরলীকৃত static formula (skin friction + end
 * bearing, FS=2.5 ডিফল্ট)। সব হাতের হিসাবের সাথে exact match
 * (sizing, pile capacity breakdown)।
 * Phase 6f: RC Column panel এ ঐচ্ছিক "Check biaxial bending" টগল
 * (ACI load-contour method, rcColumnBiaxial.ts)। RC Beam এর doubly-
 * reinforced case এ এখন প্রকৃত compression steel As' হিসাব হয়
 * (আগে শুধু flag হতো)।
 * Phase 6g: + Connection sub-tab। Steel Connection Design — standalone
 * calculator (কোনো model element bound না, connection কোনো element
 * category না বলে)। তিনটা mode: Bolted Shear (AISC §J3, bolt shear +
 * bearing/tearout), Fillet Weld (§J2.2a, longitudinal load only),
 * Base Plate (Design Guide 1 সরলীকৃত, concentric axial only, moment/
 * anchor-rod design বাদে)। সব হাতের হিসাবের সাথে exact match।
 * Phase 6h: + Retaining Wall sub-tab। Cantilever retaining wall —
 * standalone calculator (RC Wall element এর plan/thickness shape
 * থেকে ভিন্ন ইনপুট দরকার বলে)। Rankine active pressure → overturning/
 * sliding/bearing stability (Meyerhof effective-width method middle-
 * third এর বাইরে হলে) → stem/toe/heel flexural design (rcBeamFlexure
 * পুনঃব্যবহার করে)। geotechnical analysis করে না — soil unit weight/
 * friction angle/allowable bearing pressure ইঞ্জিনিয়ার সরবরাহ করেন।
 * Development এ eccentricity ≥ B/2 (base সম্পূর্ণ undersized) কেসে
 * bearing pressure Infinity propagate করার একটা bug ধরা পড়ে ও ঠিক
 * করা হয়েছে (এখন explicit bounded failure state)।
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
  const [activeDesignSubTab, setActiveDesignSubTab] = useState<DesignSubTab>("beam");
  const [showDetailingStirrups, setShowDetailingStirrups] = useState(true);
  const [showDetailingMesh, setShowDetailingMesh] = useState(true);
  const [detailingIsolateElementId, setDetailingIsolateElementId] = useState<string | null>(null);

  // --- Mobile layout ---
  // ছোট স্ক্রিনে (lg breakpoint এর নিচে) WorkflowSidebar (w-72) ও ডান
  // aside (w-80) — দুটোই একসাথে flex child হিসেবে বসালে viewport এর
  // জন্য কোনো জায়গা থাকে না (দুটো মিলেই বেশিরভাগ ফোন স্ক্রিনের চেয়ে
  // চওড়া)। তাই lg এর নিচে viewport সবসময় ফুল-স্ক্রিন থাকে, আর এই
  // দুটো প্যানেল fixed overlay sheet হিসেবে খোলে/বন্ধ হয় — lg এবং
  // তার উপরে আগের মতোই permanent side column হিসেবে থাকে।
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileWizardOpen, setMobileWizardOpen] = useState(false);

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

  // --- Workflow Layer (Wizard Mode) ---
  // wizardMode/activeStage আলাদা UI-only store এ (useWorkflowUiStore) —
  // কারণ এই page কম্পোনেন্ট নিজেই already অনেক local state বহন করছে,
  // আর wizard toggle টা top-bar এও লাগবে যদি ভবিষ্যতে অন্য জায়গা থেকে
  // নিয়ন্ত্রণ করার দরকার হয়।
  const wizardMode = useWorkflowUiStore((s) => s.wizardMode);
  const setWizardMode = useWorkflowUiStore((s) => s.setWizardMode);
  const activeStage = useWorkflowUiStore((s) => s.activeStage);
  const setActiveStage = useWorkflowUiStore((s) => s.setActiveStage);

  /**
   * Stage ক্লিক করলে page.tsx এর নিজের activeTab/activeDesignSubTab
   * state আপডেট হয় — অর্থাৎ wizard কোনো নতুন view রেন্ডার করে না,
   * existing panel-গুলোকেই গাইডেড ক্রমে দেখায়। Optimization ও
   * Verification stage দুটোই "design" ট্যাবে যায় কিন্তু ভিন্ন
   * sub-tab এ (optimization-related sub-tab বনাম collapse-prediction)
   * যাতে stage-এর প্রাসঙ্গিক প্যানেলটাই প্রথমে দেখা যায়।
   */
  function handleStageNavigate(stageId: StageId) {
    setActiveStage(stageId);
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    setActiveTab(stage.targetTab);
    // মোবাইলে stage select করার পর wizard drawer বন্ধ করে সরাসরি
    // panel sheet খুলে দেওয়া হয়, যাতে ইঞ্জিনিয়ারকে আলাদা করে আবার
    // panel বাটন চাপতে না হয়। lg+ এ কোনো প্রভাব নেই (দুটোই এমনিতে
    // permanent visible)।
    setMobileWizardOpen(false);
    setMobilePanelOpen(true);

    if (stageId === "optimization" && stage.targetTab === "design") {
      setActiveDesignSubTab(OPTIMIZATION_DESIGN_SUB_TABS[0]);
    } else if (stageId === "verification" && stage.targetTab === "design") {
      // Verification stage মূলত Validation ট্যাব (Health Score) দেখায়;
      // targetTab এখানে "validation", তাই design sub-tab ছোঁয়ার দরকার
      // নেই — এই branch ভবিষ্যতে targetTab পরিবর্তন হলে নিরাপত্তার জন্য।
      setActiveDesignSubTab(VERIFICATION_DESIGN_SUB_TAB);
    } else if (stageId === "loads") {
      setActiveLoadSubTab("patterns");
    }
  }

  /**
   * Panel এর ভেতরের কন্টেন্ট (tab অনুযায়ী form/list) — এটা desktop এ
   * permanent `aside` এর ভেতরে এবং মোবাইলে fixed full-screen sheet এর
   * ভেতরে দুই জায়গাতেই বসে। state/handler সব বাইরের component scope
   * থেকেই আসে (closure), তাই আলাদা করে prop pass করার দরকার নেই —
   * শুধু duplicate JSX এড়াতে function এ বের করে আনা হয়েছে।
   */
  function renderPanelContent() {
    return isAnyLoading ? (
      <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
    ) : (
      <>
        {activeTab === "geometry" && (
          <div className="space-y-6">
            <GridPanel onAddGrid={addGrid} onUpdateGrid={updateGrid} onDeleteGrid={deleteGrid} />
            <StoryPanel onAddStory={addStory} onUpdateStory={updateStory} onDeleteStory={deleteStory} />
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
            <CombinedFootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
            <StripFootingPanel onAddElement={addElement} onDeleteElement={removeElement} />
            <PileGroupPanel onAddElement={addElement} onDeleteElement={removeElement} />
            <PileCapPanel onAddElement={addElement} onDeleteElement={removeElement} />
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

        {activeTab === "analysis" && <AnalysisPanel projectId={projectId} />}
        {activeTab === "validation" && <ValidationPanel />}
        {activeTab === "design" && activeDesignSubTab === "beam" && <RcBeamDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "column" && <RcColumnDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "steel-beam" && <SteelBeamDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "steel-column" && <SteelColumnDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "slab" && <RcSlabDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "wall" && <RcWallDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "footing" && <FootingDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "combined-footing" && <CombinedFootingDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "strip-footing" && <StripFootingDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "mat-foundation" && <MatFoundationDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "pile" && <PileDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "pile-cap" && <PileCapDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "connection" && <SteelConnectionDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "retaining-wall" && <RetainingWallDesignPanel />}
        {activeTab === "design" && activeDesignSubTab === "geotechnical" && <GeotechnicalToolsPanel />}
        {activeTab === "design" && activeDesignSubTab === "foundation-optimization" && <FoundationOptimizationPanel />}
        {activeTab === "design" && activeDesignSubTab === "section-optimization" && <SectionOptimizationPanel />}
        {activeTab === "design" && activeDesignSubTab === "weight-optimization" && <WeightOptimizationPanel />}
        {activeTab === "design" && activeDesignSubTab === "cost-optimization" && <CostOptimizationPanel />}
        {activeTab === "design" && activeDesignSubTab === "construction-ai-topology-optimization" && (
          <ConstructionAiTopologyOptimizationPanel />
        )}
        {activeTab === "design" && activeDesignSubTab === "base-isolation" && <BaseIsolationEnergyDissipationPanel />}
        {activeTab === "design" && activeDesignSubTab === "collapse-prediction" && <CollapsePredictionPanel />}
        {activeTab === "design" && activeDesignSubTab === "rebar-layout" && <RebarLayoutPanel />}
        {activeTab === "design" && activeDesignSubTab === "stirrup-tie-zones" && <StirrupTieZonePanel />}
        {activeTab === "design" && activeDesignSubTab === "development-length" && <DevelopmentLengthPanel />}
        {activeTab === "design" && activeDesignSubTab === "bar-bending-schedule" && <BarBendingSchedulePanel />}
        {activeTab === "design" && activeDesignSubTab === "section-detail" && <SectionDetailPanel />}
        {activeTab === "design" && activeDesignSubTab === "connection-detail" && <ConnectionDetailPanel />}
        {activeTab === "design" && activeDesignSubTab === "general-notes" && <GeneralNotesPanel />}
        {activeTab === "design" && activeDesignSubTab === "drawing-sync" && <DrawingSyncPanel />}
        {activeTab === "detailing" && (
          <DetailingPanel
            showStirrups={showDetailingStirrups}
            onToggleStirrups={setShowDetailingStirrups}
            showMesh={showDetailingMesh}
            onToggleMesh={setShowDetailingMesh}
            isolateElementId={detailingIsolateElementId}
            onSetIsolateElementId={setDetailingIsolateElementId}
          />
        )}
        {activeTab === "visualization" && <VisualizationControlsPanel />}
      </>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden">
      {/* --- Wizard sidebar: lg+ এ permanent column, তার নিচে fixed drawer --- */}
      {wizardMode && (
        <>
          <div className="hidden lg:block">
            <WorkflowSidebar onNavigate={handleStageNavigate} />
          </div>
          {mobileWizardOpen && (
            <div className="lg:hidden fixed inset-0 z-40 flex">
              {/* WorkflowSidebar এর নিজের root এ `w-72` বসানো আছে (permanent
                  desktop column হিসেবে) — মোবাইলে পুরো 85vw/max-w-sm প্রস্থ
                  আর ফুল height পেতে child override করা হচ্ছে ([&>aside]
                  দিয়ে ভেতরের <aside> ট্যাগ টার্গেট করে)। */}
              <div className="w-[85vw] max-w-sm h-full shadow-2xl [&>aside]:w-full [&>aside]:h-full">
                <WorkflowSidebar onNavigate={handleStageNavigate} />
              </div>
              <button
                type="button"
                aria-label="বন্ধ করুন"
                onClick={() => setMobileWizardOpen(false)}
                className="flex-1 bg-black/60 backdrop-blur-sm"
              />
            </div>
          )}
        </>
      )}

      <div className="flex-1 relative min-w-0">
        {activeTab === "visualization" ? (
          <VisualizationViewport />
        ) : (
          <StructuralViewport
            showDetailing={activeTab === "detailing"}
            showStirrups={showDetailingStirrups}
            showMesh={showDetailingMesh}
            isolateElementId={detailingIsolateElementId}
          />
        )}

        {activeTab !== "visualization" && activeTab !== "detailing" && drawActiveCategory && (
          <DrawModeToolbar
            category={drawActiveCategory}
            pointCount={drawPoints.length}
            onFinish={handleFinishDrawing}
            onUndo={removeLastPoint}
            onCancel={cancelDrawing}
          />
        )}

        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap">
          {wizardMode && (
            <button
              type="button"
              onClick={() => setMobileWizardOpen(true)}
              className="lg:hidden text-xs text-slate-300 bg-slate-900/80 backdrop-blur rounded-md px-2.5 py-1 border border-slate-700"
            >
              ☰ Workflow
            </button>
          )}
          <WorkflowModeToggle wizardMode={wizardMode} onChange={setWizardMode} />
          <span className="hidden sm:inline text-xs text-slate-500 bg-slate-900/80 backdrop-blur rounded-md px-2.5 py-1">
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

        {wizardMode && (
          <div className="hidden lg:block absolute top-3 right-3 max-w-xs">
            <ActiveStageBanner stageId={activeStage} />
          </div>
        )}

        {/* মোবাইলে ডান প্যানেল বন্ধ থাকলে এই floating বাটন দিয়ে খোলা যায়;
            lg+ এ প্যানেল সবসময় visible বলে বাটন লাগে না। */}
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          className="lg:hidden fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-sky-600 hover:bg-sky-500 text-white shadow-xl flex items-center justify-center text-xl transition-colors"
          aria-label="Panel খুলুন"
        >
          ⚙
        </button>
      </div>

      {/* --- ডান panel: lg+ এ permanent w-80 column, তার নিচে fixed full-screen sheet --- */}
      <aside className="hidden lg:flex w-80 border-l border-slate-800 bg-slate-900/60 flex-col">
        <TabNavBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          activeLoadSubTab={activeLoadSubTab}
          onChangeLoadSubTab={setActiveLoadSubTab}
          activeDesignSubTab={activeDesignSubTab}
          onChangeDesignSubTab={setActiveDesignSubTab}
        />

        <div className="flex-1 overflow-y-auto p-4">{renderPanelContent()}</div>
      </aside>

      {/* --- মোবাইল প্যানেল: fixed full-screen sheet, ⚙ বাটনে খোলে --- */}
      {mobilePanelOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="text-sm font-medium text-slate-200">Panel</span>
            <button
              type="button"
              onClick={() => setMobilePanelOpen(false)}
              className="text-slate-400 hover:text-slate-200 text-lg px-2"
              aria-label="বন্ধ করুন"
            >
              ✕
            </button>
          </div>
          <TabNavBar
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            activeLoadSubTab={activeLoadSubTab}
            onChangeLoadSubTab={setActiveLoadSubTab}
            activeDesignSubTab={activeDesignSubTab}
            onChangeDesignSubTab={setActiveDesignSubTab}
          />
          <div className="flex-1 overflow-y-auto p-4">{renderPanelContent()}</div>
        </div>
      )}
    </main>
  );
}
