import { create } from "zustand";
import type { CameraVector3 } from "./useStructuralCameraStore";

/**
 * Phase 3 (Shared Viewport / camera persistence) — VisualizationViewport
 * (Visualization ট্যাব) এর জন্য নিজস্ব, স্বাধীন ক্যামেরা state।
 *
 * useStructuralCameraStore.ts থেকে ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে —
 * পুরো রেশনাল সেই ফাইলের doc-comment এ, সংক্ষেপে: StructuralViewport
 * (editing) আর VisualizationViewport (read-only presentation) সম্পূর্ণ
 * আলাদা Canvas/component (VisualizationViewport.tsx এর নিজস্ব কমেন্ট
 * অনুযায়ী), তাই এই দুই viewport এর মধ্যে camera angle জোর করে sync
 * করা একটা স্বাভাবিক workflow ভাঙতে পারে — কেউ Elements এ এক কোণা
 * zoom করে edit করে Visualization এ গিয়ে সম্পূর্ণ ভিন্ন অংশ দেখতে
 * চাইতে পারে। (selection state এর ক্ষেত্রে shared রাখা ইচ্ছাকৃত এবং
 * সঠিক ছিল, কিন্তু camera এর যুক্তি ভিন্ন — বিস্তারিত ঐ কমেন্টে।)
 *
 * CameraVector3 টাইপ useStructuralCameraStore থেকে re-export না করে
 * import করা হয়েছে (duplicate টাইপ ডেফিনিশন এড়াতে) — দুই store এর
 * ডেটা shape এক হলেও state নিজেই সম্পূর্ণ স্বাধীন।
 */

interface VisualizationCameraState {
  position: CameraVector3;
  target: CameraVector3;
  setCamera: (position: CameraVector3, target: CameraVector3) => void;
}

/** VisualizationViewport.tsx এর <Canvas camera={{ position: [14, 10, 14], ... }}> এর সাথে হুবহু মেলানো ডিফল্ট। */
const DEFAULT_POSITION: CameraVector3 = { x: 14, y: 10, z: 14 };
const DEFAULT_TARGET: CameraVector3 = { x: 0, y: 0, z: 0 };

export const useVisualizationCameraStore = create<VisualizationCameraState>((set) => ({
  position: DEFAULT_POSITION,
  target: DEFAULT_TARGET,
  setCamera: (position, target) => set({ position, target }),
}));
