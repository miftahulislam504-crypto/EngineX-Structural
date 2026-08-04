import { create } from "zustand";
import type { ElementCategory } from "@/lib/types/element";

/**
 * Phase 10i — Visualization ভিউপোর্টের জন্য আলাদা view-mode state।
 *
 * এই store টা useSelectionStore/useDrawModeStore থেকে ইচ্ছাকৃতভাবে
 * আলাদা রাখা হয়েছে কারণ এটা geometry-editing viewport
 * (StructuralViewport) এর কোনো state না — এটা শুধু Visualization
 * viewport (VisualizationViewport, নতুন এই Phase-এ) এর নিজস্ব "কীভাবে
 * দেখাবে" state। Draw mode বা grid/story সিলেকশনের সাথে এর কোনো
 * সম্পর্ক নেই, তাই আলাদা store থাকাই architecturally পরিষ্কার —
 * ভবিষ্যতে Visualization viewport এর কোনো state পরিবর্তন হলে
 * geometry viewport এর কোনো component re-render হবে না, এবং উল্টোটাও।
 *
 * Story isolation: null মানে "সব story দেখাও" (default), একটা storyId
 * সেট করলে শুধু সেই story-র element গুলো দেখাবে বাকি সব fade/hide হবে
 * — বড় বিল্ডিং এ single-floor rebar/result inspection এর জন্য জরুরি,
 * CSI/ETABS এর মতো সফটওয়্যারেও এই প্যাটার্ন প্রচলিত।
 *
 * Category visibility: প্রতিটা ElementCategory ডিফল্টভাবে visible;
 * false করলে সেই category এর সব element viewport থেকে বাদ যায়। এটা
 * per-category (per-element না) কারণ একসাথে "সব Slab লুকাও" জাতীয়
 * bulk toggle ই বাস্তবে দরকার হয়, individual element hide আলাদা
 * (future) দরকার হলে সেটা ভিন্ন mechanism (selection-based) হবে।
 *
 * renderMode: "solid" ডিফল্ট। "wireframe" পুরো viewport কে outline-only
 * দেখায় (bulk edit বা internal element দেখার জন্য দরকারি)। "x-ray" সব
 * element কে transparent করে দেয় (solid থাকে কিন্তু ভিতরের/পিছনের
 * element দেখা যায়) — 10j এ rebar cage বাইরের কংক্রিট surface এর
 * ভিতরে বসবে, তখন x-ray mode ছাড়া rebar দেখাই যাবে না, তাই এই
 * mode টা এখানেই (10i) ভিত্তি হিসেবে যোগ করা হলো যদিও এর আসল
 * ব্যবহার শুরু হবে 10j থেকে।
 */

export type VisualizationRenderMode = "solid" | "wireframe" | "x-ray";

const ALL_CATEGORIES: ElementCategory[] = [
  "beam",
  "column",
  "brace",
  "pile",
  "slab",
  "wall",
  "shear-wall",
  "core-wall",
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
  "pile-cap",
  "pile-group",
];

function defaultCategoryVisibility(): Record<ElementCategory, boolean> {
  const map = {} as Record<ElementCategory, boolean>;
  for (const category of ALL_CATEGORIES) {
    map[category] = true;
  }
  return map;
}

interface VisualizationViewState {
  /** null = সব story দেখাও; নাহলে শুধু এই storyId এর element গুলো। */
  isolatedStoryId: string | null;
  setIsolatedStoryId: (storyId: string | null) => void;

  renderMode: VisualizationRenderMode;
  setRenderMode: (mode: VisualizationRenderMode) => void;

  categoryVisibility: Record<ElementCategory, boolean>;
  toggleCategoryVisibility: (category: ElementCategory) => void;
  setAllCategoriesVisible: (visible: boolean) => void;

  /**
   * Isolate করা story-র বাইরের element গুলো সম্পূর্ণ হাইড না করে
   * ম্লান (faded) দেখানো হয় কিনা — context বজায় রাখতে সাহায্য করে
   * (পুরো বিল্ডিং এর মধ্যে একটা floor কোথায় আছে বোঝা যায়)। false
   * করলে isolate করা story ছাড়া বাকি সব সম্পূর্ণ হাইড হয়ে যাবে।
   */
  fadeNonIsolated: boolean;
  setFadeNonIsolated: (fade: boolean) => void;

  /**
   * Phase 10l — Displacement + Deformation Animation state।
   *
   * deformationEnabled: false হলে element গুলো তাদের আসল (undeformed)
   * geometry-তে দেখায় (10i এর আগের আচরণ, ডিফল্ট) — true হলে
   * VisualizationElementsLayer প্রতিটা endpoint/vertex কে matching
   * analysis node এর displacement দিয়ে অফসেট করে দেখায়।
   *
   * deformationScale: রিয়েল displacement সাধারণত mm-order (structure
   * meter-order) — scale ছাড়া চোখে দেখা যায় না, তাই ETABS/SAP2000 এর
   * মতোই একটা exaggeration factor দরকার। ডিফল্ট 50x একটা সাধারণ শুরুর
   * মান (ইঞ্জিনিয়ার সাধারণত visually reasonable মান পাওয়া পর্যন্ত
   * নিজে বাড়ান/কমান), UI-তে slider দিয়ে 1x-500x এর মধ্যে সমন্বয়যোগ্য।
   *
   * isAnimating: true হলে deformationScale 0 → target এর মধ্যে
   * দোলে (breathing animation), স্থির deformed shape না দেখিয়ে যাতে
   * eye আগের/পরের shape এর পার্থক্য সহজে ধরতে পারে — CSI/ETABS এর
   * "animate deformed shape" এর মতোই। animationPhase 0-1 এর মধ্যে,
   * VisualizationViewport এর useFrame প্রতি frame এ আপডেট করে; আসল
   * scale multiplier = deformationScale * sin(animationPhase * π)
   * (0 থেকে peak থেকে 0 এ ফিরে, smooth loop)।
   */
  deformationEnabled: boolean;
  setDeformationEnabled: (enabled: boolean) => void;

  deformationScale: number;
  setDeformationScale: (scale: number) => void;

  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;

  animationPhase: number;
  setAnimationPhase: (phase: number) => void;

  /**
   * Phase 10m — Moment/Shear/Axial Diagram state।
   *
   * diagramEnabled: false হলে কোনো diagram overlay আঁকা হয় না (default)।
   *
   * diagramQuantity: একবারে একটাই quantity দেখানো হয় (moment/shear/
   * axial) — তিনটা একসাথে দেখালে viewport অতিরিক্ত ঘিঞ্জি হয়ে যাবে,
   * ETABS/SAP2000 এও diagram টাইপ একবারে একটাই সিলেক্ট করা হয়।
   *
   * diagramScale: elementEndForces এর মান (kN, kN·m) সরাসরি viewport
   * এর মিটার-স্কেল geometry তে অফসেট করলে দেখাই যাবে না বা পুরো মডেল
   * ঢেকে ফেলবে — তাই deformationScale এর মতোই একটা exaggeration
   * factor, তবে ভিন্ন default রেঞ্জ (force/moment magnitude সাধারণত
   * displacement এর চেয়ে অনেক বড়, তাই স্কেল অনেক ছোট রাখা হয়েছে)।
   */
  diagramEnabled: boolean;
  setDiagramEnabled: (enabled: boolean) => void;

  diagramQuantity: "moment" | "shear" | "axial";
  setDiagramQuantity: (quantity: "moment" | "shear" | "axial") => void;

  diagramScale: number;
  setDiagramScale: (scale: number) => void;

  /** Phase 10n — Reaction Display state। শুধু Linear Static এ পাওয়া যায় (দেখুন ReactionLayer.tsx এর doc-comment)। */
  reactionEnabled: boolean;
  setReactionEnabled: (enabled: boolean) => void;
  reactionScale: number;
  setReactionScale: (scale: number) => void;
  reactionShowMoments: boolean;
  setReactionShowMoments: (show: boolean) => void;

  /** Phase 10o — DCR Heat Map toggle। কোন element এর color override হবে তা VisualizationElementsLayer নিজেই dcrRecords prop দিয়ে নির্ধারণ করে, এখানে শুধু on/off। */
  dcrHeatMapEnabled: boolean;
  setDcrHeatMapEnabled: (enabled: boolean) => void;

  /**
   * Phase 10p — Mode Shape / Buckling Animation state।
   *
   * এটা 10l এর deformation animation থেকে আলাদা রাখা হয়েছে (একই
   * isAnimating/animationPhase রিইউজ করা যেত না) কারণ 10l "সব real
   * displacement result কে deform" বোঝায় (linear-static/pdelta/
   * response-spectrum/nonlinear-static), কিন্তু mode shape সম্পূর্ণ
   * ভিন্ন ধারণা — normalized shape (একটা arbitrary scale এ, physical
   * displacement magnitude না), নির্দিষ্ট mode index বেছে নেওয়া
   * প্রয়োজন, এবং deformationEnabled সত্য থাকলেও mode shape mode এ
   * থাকা উচিত না (দুটো একসাথে conflict করবে, কোনটা দেখাবে অস্পষ্ট)।
   */
  modeShapeEnabled: boolean;
  setModeShapeEnabled: (enabled: boolean) => void;
  modeShapeSource: "modal" | "buckling";
  setModeShapeSource: (source: "modal" | "buckling") => void;
  modeShapeIndex: number;
  setModeShapeIndex: (index: number) => void;
  modeShapeScale: number;
  setModeShapeScale: (scale: number) => void;
  modeShapeAnimating: boolean;
  setModeShapeAnimating: (animating: boolean) => void;
  modeShapeAnimationPhase: number;
  setModeShapeAnimationPhase: (phase: number) => void;

  /**
   * Phase 10q — Stress/Strain Contour (honest displacement-magnitude
   * proxy) toggle। কোন analysis result থেকে magnitude আসবে তা
   * VisualizationViewport নিজেই activeAnalysisType/activeNodalDisplacements
   * থেকে নির্ধারণ করে (10l এর মতোই সোর্স, নতুন কিছু ধরার দরকার নেই)।
   */
  stressContourEnabled: boolean;
  setStressContourEnabled: (enabled: boolean) => void;

  /**
   * Phase 10r — Crack Prediction / Failure Visualization (hinge marker)
   * toggle। শুধু Nonlinear Static/Pushover result এ পাওয়া যায় (দেখুন
   * HingeMarkerLayer.tsx এর doc-comment — honest partial, final state
   * only)। hingeSource দিয়ে দুটোর মধ্যে বেছে নেওয়া যায় (একসাথে দুটো
   * result থাকতে পারে না যেহেতু activeAnalysisType একটাই, কিন্তু UI
   * তে source আলাদা রাখা holo ভবিষ্যতে দুটো একসাথে রাখার সম্ভাবনার
   * জন্য)।
   */
  hingeMarkersEnabled: boolean;
  setHingeMarkersEnabled: (enabled: boolean) => void;
  hingeMarkerShowLabels: boolean;
  setHingeMarkerShowLabels: (show: boolean) => void;
}

export const useVisualizationViewStore = create<VisualizationViewState>((set) => ({
  isolatedStoryId: null,
  setIsolatedStoryId: (storyId) => set({ isolatedStoryId: storyId }),

  renderMode: "solid",
  setRenderMode: (mode) => set({ renderMode: mode }),

  categoryVisibility: defaultCategoryVisibility(),
  toggleCategoryVisibility: (category) =>
    set((state) => ({
      categoryVisibility: {
        ...state.categoryVisibility,
        [category]: !state.categoryVisibility[category],
      },
    })),
  setAllCategoriesVisible: (visible) =>
    set(() => {
      const map = {} as Record<ElementCategory, boolean>;
      for (const category of ALL_CATEGORIES) {
        map[category] = visible;
      }
      return { categoryVisibility: map };
    }),

  fadeNonIsolated: true,
  setFadeNonIsolated: (fade) => set({ fadeNonIsolated: fade }),

  deformationEnabled: false,
  setDeformationEnabled: (enabled) => set({ deformationEnabled: enabled }),

  deformationScale: 50,
  setDeformationScale: (scale) => set({ deformationScale: scale }),

  isAnimating: false,
  setIsAnimating: (animating) => set({ isAnimating: animating }),

  animationPhase: 0,
  setAnimationPhase: (phase) => set({ animationPhase: phase }),

  diagramEnabled: false,
  setDiagramEnabled: (enabled) => set({ diagramEnabled: enabled }),

  diagramQuantity: "moment",
  setDiagramQuantity: (quantity) => set({ diagramQuantity: quantity }),

  diagramScale: 0.05,
  setDiagramScale: (scale) => set({ diagramScale: scale }),

  reactionEnabled: false,
  setReactionEnabled: (enabled) => set({ reactionEnabled: enabled }),
  reactionScale: 0.8,
  setReactionScale: (scale) => set({ reactionScale: scale }),
  reactionShowMoments: true,
  setReactionShowMoments: (show) => set({ reactionShowMoments: show }),

  dcrHeatMapEnabled: false,
  setDcrHeatMapEnabled: (enabled) => set({ dcrHeatMapEnabled: enabled }),

  modeShapeEnabled: false,
  setModeShapeEnabled: (enabled) => set({ modeShapeEnabled: enabled }),
  modeShapeSource: "modal",
  setModeShapeSource: (source) => set({ modeShapeSource: source }),
  modeShapeIndex: 0,
  setModeShapeIndex: (index) => set({ modeShapeIndex: index }),
  modeShapeScale: 50,
  setModeShapeScale: (scale) => set({ modeShapeScale: scale }),
  modeShapeAnimating: false,
  setModeShapeAnimating: (animating) => set({ modeShapeAnimating: animating }),
  modeShapeAnimationPhase: 0,
  setModeShapeAnimationPhase: (phase) => set({ modeShapeAnimationPhase: phase }),

  stressContourEnabled: false,
  setStressContourEnabled: (enabled) => set({ stressContourEnabled: enabled }),

  hingeMarkersEnabled: false,
  setHingeMarkersEnabled: (enabled) => set({ hingeMarkersEnabled: enabled }),
  hingeMarkerShowLabels: true,
  setHingeMarkerShowLabels: (show) => set({ hingeMarkerShowLabels: show }),
}));
