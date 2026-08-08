"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import { StructuralViewport } from "@/components/viewport/StructuralViewport";
import { PlanView2D } from "@/components/viewport/PlanView2D";
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
import { useProjectIdStore } from "@/lib/project/useProjectIdStore";
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
import { DocumentationPanel } from "@/components/documentation-panel/DocumentationPanel";
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
import { Sidebar } from "@/components/workflow/Sidebar";
import { SubTabBar } from "@/components/workflow/SubTabBar";
import { ListTree } from "lucide-react";
import { useWorkflowUiStore } from "@/lib/workflow/useWorkflowUiStore";
import { STAGES } from "@/lib/workflow/stageTabs";
import {
  LOAD_SUB_TABS,
  DESIGN_SUB_TAB_GROUPS,
  OPTIMIZATION_SUB_TABS,
  DOCUMENTATION_SUB_TABS,
} from "@/lib/workflow/subTabLabels";
import type {
  SidebarTab,
  LoadSubTab,
  DesignSubTab,
  OptimizationSubTab,
  DocumentationSubTab,
} from "@/lib/workflow/stageTabs";
import type { StageId } from "@/lib/workflow/types";

export type { SidebarTab, LoadSubTab, DesignSubTab, OptimizationSubTab, DocumentationSubTab };

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
  const router = useRouter();
  const setProjectId = useProjectIdStore((s) => s.setProjectId);

  useEffect(() => {
    setProjectId(projectId);
  }, [projectId, setProjectId]);

  // --- Route Guard (Phase 0.2) ---
  // useEnsureAuth এখানে সরাসরি কল করা হচ্ছে (নিচের useGeometryCore/
  // useElementsCore/ইত্যাদি hook-এর ভেতরেও এটাই কল হয় independently —
  // একই hook একাধিক জায়গায় কল করা নিরাপদ, প্রতিটা নিজের
  // onAuthStateChanged listener চালায়) যাতে এই পেজ নিজেই জানতে পারে
  // কেউ signed-in আছে কিনা এবং প্রয়োজনে redirect করতে পারে। ভেতরের
  // data hook গুলো নিজেরাও isAuthReady/user চেক করে (Firestore
  // subscribe করার আগে), তাই এই guard ছাড়াও তারা নিরাপদ — কিন্তু এই
  // guard ছাড়া user না-থাকা অবস্থায় পুরো UI (empty state সহ) দেখা যেত,
  // যেটা confusing (মনে হতো প্রজেক্ট খালি, আসলে কেউ সাইন-ইন করেনি)।
  const { user, isReady: isAuthReady } = useEnsureAuth();

  useEffect(() => {
    if (isAuthReady && !user) {
      router.replace("/login");
    }
  }, [isAuthReady, user, router]);

  const [activeTab, setActiveTab] = useState<SidebarTab>("geometry");
  const [activeLoadSubTab, setActiveLoadSubTab] = useState<LoadSubTab>("patterns");
  const [activeDesignSubTab, setActiveDesignSubTab] = useState<DesignSubTab>("beam");
  const [activeOptimizationSubTab, setActiveOptimizationSubTab] =
    useState<OptimizationSubTab>("section-optimization");
  const [activeDocumentationSubTab, setActiveDocumentationSubTab] =
    useState<DocumentationSubTab>("bar-bending-schedule");
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Phase 0.5 — Layout category প্রতিটা main tab এর জন্য আলাদা:
  //   - dual-panel (2D Plan + 3D Viewport পাশাপাশি): Elements, Analysis
  //     (Analysis সবসময় dual দেখায় — "কখন model লাগবে" নির্ণয় করার
  //     জটিল logic এই Phase এ এড়ানো হয়েছে, ব্যবহারকারীর নিশ্চিতকরণ)
  //   - single 3D panel (কোনো 2D/dual টগল নেই): Visualization, Detailing
  //   - no canvas, শুধু পুরো-width panel content: বাকি সব
  //     (geometry/library/validation/design/optimization/documentation)
  const showDualPanel = activeTab === "elements" || activeTab === "analysis";
  const showSinglePanel = activeTab === "visualization" || activeTab === "detailing";
  const showFullWidthPanel = !showDualPanel && !showSinglePanel;

  // Phase 0.4 — 2D Plan View + 3D Viewport dual panel। lg+ এ দুটোই
  // পাশাপাশি (side-by-side) দেখা যায়, তার নিচে একসাথে জায়গা না হওয়ায়
  // (EngineXDraw এর design studio এর মতোই কারণ) একটা toggle দিয়ে
  // যেকোনো একটা দেখানো হয়।
  const [mobileViewMode, setMobileViewMode] = useState<"2d" | "3d">("3d");

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

  // --- Workflow Layer ---
  // workflowPanelOpen আলাদা UI-only store এ (useWorkflowUiStore) —
  // কারণ এই page কম্পোনেন্ট নিজেই already অনেক local state বহন করছে,
  // আর Sidebar এর "Workflow" আইটেম থেকেও এই state নিয়ন্ত্রণ করতে হয়।
  // activeStage শুধু write হয় (setActiveStage) — read করার দরকার নেই
  // এখানে যেহেতু ActiveStageBanner সরানো হয়েছে (Phase 0.5)।
  // WorkflowSidebar নিজে activeStage read করে না — সেটা প্রতিটা stage
  // card এর status (locked/available/done) useWorkflowProgress() থেকে
  // দেখায়, "কোনটা বর্তমানে সিলেক্টেড" এই ধারণা তার নেই।
  const workflowPanelOpen = useWorkflowUiStore((s) => s.workflowPanelOpen);
  const setWorkflowPanelOpen = useWorkflowUiStore((s) => s.setWorkflowPanelOpen);
  const setActiveStage = useWorkflowUiStore((s) => s.setActiveStage);

  /**
   * Stage ক্লিক করলে page.tsx এর নিজের activeTab state আপডেট হয় —
   * অর্থাৎ wizard কোনো নতুন view রেন্ডার করে না, existing panel-গুলোকেই
   * গাইডেড ক্রমে দেখায়। Phase 0.5 থেকে Optimization নিজের আলাদা
   * SidebarTab (আগে "design" ট্যাবের sub-tab ছিল), তাই এখন আর
   * sub-tab redirect করার দরকার নেই — শুধু Loads stage-এ যাওয়ার সময়
   * sub-tab "patterns" এ রিসেট করা হয় (প্রথম ধাপ থেকে শুরু করানোর জন্য)।
   */
  function handleStageNavigate(stageId: StageId) {
    setActiveStage(stageId);
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    setActiveTab(stage.targetTab);
    // Stage select করার পর workflow panel বন্ধ করে সরাসরি panel sheet
    // খুলে দেওয়া হয় (মোবাইলে), যাতে ইঞ্জিনিয়ারকে আলাদা করে আবার panel
    // বাটন চাপতে না হয়।
    setWorkflowPanelOpen(false);
    setMobilePanelOpen(true);

    if (stageId === "loads") {
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
      <p className="text-sm text-text-muted">লোড হচ্ছে...</p>
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

        {/* --- Design (১৭টা RC/Steel/Foundation/Advanced sub-tab) --- */}
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
        {activeTab === "design" && activeDesignSubTab === "base-isolation" && <BaseIsolationEnergyDissipationPanel />}
        {activeTab === "design" && activeDesignSubTab === "collapse-prediction" && <CollapsePredictionPanel />}

        {/* --- Optimization (Phase 0.5 থেকে independent tab, আগে design এর sub-tab ছিল) --- */}
        {activeTab === "optimization" && activeOptimizationSubTab === "foundation-optimization" && (
          <FoundationOptimizationPanel />
        )}
        {activeTab === "optimization" && activeOptimizationSubTab === "section-optimization" && (
          <SectionOptimizationPanel />
        )}
        {activeTab === "optimization" && activeOptimizationSubTab === "weight-optimization" && (
          <WeightOptimizationPanel />
        )}
        {activeTab === "optimization" && activeOptimizationSubTab === "cost-optimization" && (
          <CostOptimizationPanel />
        )}
        {activeTab === "optimization" &&
          activeOptimizationSubTab === "construction-ai-topology-optimization" && (
            <ConstructionAiTopologyOptimizationPanel />
          )}

        {/* --- Documentation (Phase 0.5 থেকে independent tab; rebar-layout
             থেকে drawing-sync পর্যন্ত ৮টা sub-tab, আগে design এর অংশ ছিল) --- */}
        {activeTab === "documentation" && activeDocumentationSubTab === "rebar-layout" && (
          <RebarLayoutPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "stirrup-tie-zones" && (
          <StirrupTieZonePanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "development-length" && (
          <DevelopmentLengthPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "bar-bending-schedule" && (
          <BarBendingSchedulePanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "section-detail" && (
          <SectionDetailPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "connection-detail" && (
          <ConnectionDetailPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "general-notes" && (
          <GeneralNotesPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "drawing-sync" && (
          <DrawingSyncPanel />
        )}
        {activeTab === "documentation" && activeDocumentationSubTab === "reports-export" && (
          <DocumentationPanel projectId={projectId} />
        )}
      </>
    );
  }

  // Auth এখনো নিশ্চিত হয়নি, অথবা কেউ signed-in নেই (redirect চলছে) —
  // এই দুই ক্ষেত্রেই পুরো editor UI (panel, viewport, sidebar) না
  // দেখিয়ে একটা সাধারণ spinner দেখানো হচ্ছে। এটা bg-surface ব্যবহার
  // করছে, ঠিক নিচের <main> এর মতোই (Phase 0.5 এ পুরনো bg-slate-950
  // fix হয়ে গেছে — এই পেজ এখন সম্পূর্ণ Light Clean palette ব্যবহার
  // করে, COLOR_MIGRATION_TRACKING.md থেকে এই ফাইলের entry বাদ দেওয়া
  // উচিত)।
  if (!isAuthReady || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <span className="spinner" aria-label="লোড হচ্ছে" />
      </div>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-surface text-text-primary overflow-hidden">
      {/* --- Main navigation: lg+ এ permanent left column, তার নিচে fixed drawer --- */}
      <div className="hidden lg:block">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenWorkflow={() => setWorkflowPanelOpen(true)}
        />
      </div>
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[80vw] max-w-xs h-full shadow-2xl">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
                setMobilePanelOpen(true);
              }}
              onOpenWorkflow={() => {
                setMobileSidebarOpen(false);
                setWorkflowPanelOpen(true);
              }}
            />
          </div>
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex-1 bg-black/60 backdrop-blur-sm"
          />
        </div>
      )}

      {/* --- Workflow panel: on-demand drawer (lg+ এ ডান পাশ থেকে, মোবাইলে fullscreen) --- */}
      {workflowPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="w-full max-w-xs h-full shadow-2xl [&>aside]:w-full [&>aside]:h-full">
            <WorkflowSidebar onNavigate={handleStageNavigate} />
          </div>
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setWorkflowPanelOpen(false)}
            className="flex-1 bg-black/60 backdrop-blur-sm"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* মোবাইল top bar: sidebar toggle + project label */}
        <div className="lg:hidden flex items-center justify-between border-b border-surface-border bg-surface-card px-3 py-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary px-1"
            aria-label="মেনু খুলুন"
          >
            ☰
          </button>
          <span className="text-xs text-text-muted truncate">{projectId}</span>
          <button
            type="button"
            onClick={() => setWorkflowPanelOpen(true)}
            className="text-text-secondary hover:text-text-primary px-1"
            aria-label="Workflow খুলুন"
          >
            <ListTree size={18} />
          </button>
        </div>

        {/* সব ধরনের সাব-ট্যাব বার (dual/single/full-width layout নির্বিশেষে,
            যে tab-এর যেটা প্রযোজ্য) — content-এর ঠিক উপরে, always visible। */}
        {activeTab === "loads" && (
          <SubTabBar<LoadSubTab> active={activeLoadSubTab} onChange={setActiveLoadSubTab} tabs={LOAD_SUB_TABS} />
        )}
        {activeTab === "design" && (
          <SubTabBar<DesignSubTab>
            active={activeDesignSubTab}
            onChange={setActiveDesignSubTab}
            groups={DESIGN_SUB_TAB_GROUPS}
          />
        )}
        {activeTab === "optimization" && (
          <SubTabBar<OptimizationSubTab>
            active={activeOptimizationSubTab}
            onChange={setActiveOptimizationSubTab}
            tabs={OPTIMIZATION_SUB_TABS}
          />
        )}
        {activeTab === "documentation" && (
          <SubTabBar<DocumentationSubTab>
            active={activeDocumentationSubTab}
            onChange={setActiveDocumentationSubTab}
            tabs={DOCUMENTATION_SUB_TABS}
          />
        )}

        <div className="flex-1 relative min-w-0 min-h-0">
          {showDualPanel && (
            <div className="flex flex-col h-full lg:flex-row">
              <div
                className={`relative flex-1 min-h-0 lg:block ${
                  mobileViewMode === "2d" ? "block" : "hidden"
                }`}
              >
                <PlanView2D />
              </div>
              <div className="hidden lg:block w-px bg-surface-border flex-shrink-0" />
              <div
                className={`relative flex-1 min-h-0 lg:block ${
                  mobileViewMode === "3d" ? "block" : "hidden"
                }`}
              >
                <StructuralViewport
                  showDetailing={false}
                  showStirrups={showDetailingStirrups}
                  showMesh={showDetailingMesh}
                  isolateElementId={detailingIsolateElementId}
                />

                {drawActiveCategory && (
                  <DrawModeToolbar
                    category={drawActiveCategory}
                    pointCount={drawPoints.length}
                    onFinish={handleFinishDrawing}
                    onUndo={removeLastPoint}
                    onCancel={cancelDrawing}
                  />
                )}
              </div>

              {/* মোবাইলে 2D/3D টগল — dual-panel tab এই শুধু দৃশ্যমান */}
              <div className="lg:hidden absolute top-3 right-3 flex items-center rounded-md border border-surface-border bg-surface-card/95 backdrop-blur p-0.5 shadow-card">
                <button
                  type="button"
                  onClick={() => setMobileViewMode("2d")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    mobileViewMode === "2d" ? "bg-brand-600 text-white" : "text-text-secondary"
                  }`}
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewMode("3d")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    mobileViewMode === "3d" ? "bg-brand-600 text-white" : "text-text-secondary"
                  }`}
                >
                  3D
                </button>
              </div>

              {/* --- Elements/Analysis controls: desktop এ ডান overlay,
                  ঠিক Visualization/Detailing এর মতোই (নিচে দেখুন) —
                  dual-panel tab এও এই controls দরকার (element add/delete
                  form, analysis run button ইত্যাদি), শুধু viewport দিয়ে
                  কাজ চলে না। renderPanelContent() সরাসরি কল করা নিরাপদ
                  এখানে কারণ এই branch শুধু activeTab "elements"/"analysis"
                  হলেই render হয়, ফাংশনের ভেতরের geometry/library/validation
                  ইত্যাদি branch এমনিতেই match করবে না। */}
              <div className="hidden lg:block absolute top-3 right-3 w-80 max-h-[calc(100%-1.5rem)] overflow-y-auto card p-4">
                {renderPanelContent()}
              </div>
            </div>
          )}

          {showSinglePanel && (
            <>
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
            </>
          )}

          {showFullWidthPanel && (
            <div className="h-full overflow-y-auto">
              <div className="max-w-3xl mx-auto p-4 lg:p-6">{renderPanelContent()}</div>
            </div>
          )}

          {/* --- Visualization প্যানেল (controls) desktop এ ডান overlay হিসেবে,
              কারণ Visualization ও Detailing single-panel tab — এগুলোর
              জন্য আলাদা কোনো ডান aside কলাম আর নেই (Phase 0.5 এ পুরনো
              permanent aside সরানো হয়েছে)। */}
          {activeTab === "visualization" && (
            <div className="hidden lg:block absolute top-3 right-3 w-72 max-h-[calc(100%-1.5rem)] overflow-y-auto card p-4">
              <VisualizationControlsPanel />
            </div>
          )}
          {activeTab === "detailing" && (
            <div className="hidden lg:block absolute top-3 right-3 w-72 max-h-[calc(100%-1.5rem)] overflow-y-auto card p-4">
              <DetailingPanel
                showStirrups={showDetailingStirrups}
                onToggleStirrups={setShowDetailingStirrups}
                showMesh={showDetailingMesh}
                onToggleMesh={setShowDetailingMesh}
                isolateElementId={detailingIsolateElementId}
                onSetIsolateElementId={setDetailingIsolateElementId}
              />
            </div>
          )}

          {(showDualPanel || showSinglePanel) && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 flex-wrap">
              <span className="hidden sm:inline text-xs text-text-muted bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-surface-border">
                Project: {projectId}
              </span>
              {isSaving && (
                <span className="text-xs text-status-holdText bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-surface-border">
                  সেভ হচ্ছে...
                </span>
              )}
              {loadError && (
                <span className="text-xs text-red-600 bg-surface-card/90 backdrop-blur rounded-md px-2.5 py-1 border border-red-200">
                  লোড এরর: {loadError}
                </span>
              )}
            </div>
          )}

          {/* মোবাইলে single/dual-panel tab এ ডান প্যানেল বন্ধ থাকলে এই
              floating বাটন দিয়ে খোলা যায় (visualization/detailing এর
              controls, অথবা dual-panel tab এ elements/analysis controls)। */}
          {(showSinglePanel || showDualPanel) && (
            <button
              type="button"
              onClick={() => setMobilePanelOpen(true)}
              className="lg:hidden fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl flex items-center justify-center text-xl transition-colors"
              aria-label="Panel খুলুন"
            >
              ⚙
            </button>
          )}
        </div>
      </div>

      {/* --- মোবাইল প্যানেল: fixed full-screen sheet, single/dual-panel tab এ
          ⚙ বাটনে খোলে, full-width tab এ sidebar থেকে tab পাল্টালেই auto-open হয় --- */}
      {mobilePanelOpen && (showSinglePanel || showDualPanel || showFullWidthPanel) && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-surface-border bg-surface-card px-3 py-2 flex-shrink-0">
            <span className="text-sm font-medium text-text-primary">Panel</span>
            <button
              type="button"
              onClick={() => setMobilePanelOpen(false)}
              className="text-text-muted hover:text-text-primary text-lg px-2"
              aria-label="বন্ধ করুন"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {showSinglePanel &&
              (activeTab === "visualization" ? (
                <VisualizationControlsPanel />
              ) : (
                <DetailingPanel
                  showStirrups={showDetailingStirrups}
                  onToggleStirrups={setShowDetailingStirrups}
                  showMesh={showDetailingMesh}
                  onToggleMesh={setShowDetailingMesh}
                  isolateElementId={detailingIsolateElementId}
                  onSetIsolateElementId={setDetailingIsolateElementId}
                />
              ))}
            {(showDualPanel || showFullWidthPanel) && renderPanelContent()}
          </div>
        </div>
      )}
    </main>
  );
}
