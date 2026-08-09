import { create } from "zustand";

/**
 * Phase 3 (Shared Viewport / camera persistence) — StructuralViewport
 * (Elements/Analysis/Detailing tab-এ ব্যবহৃত) এর ক্যামেরা position ও
 * OrbitControls target এর জন্য state।
 *
 * কেন দরকার: StructuralViewport.tsx এর <Canvas camera={{ position:
 * [14, 10, 14], fov: 45 }}> prop টা শুধু initial/default camera তৈরির
 * জন্য (দেখুন node_modules/@react-three/fiber/dist/declarations/src/
 * core/renderer.d.ts এর camera prop কমেন্ট — "props that go into the
 * default camera")। এর পরে OrbitControls ইউজারের pan/zoom/rotate সরাসরি
 * Three.js camera object-এ imperatively বসায় — React state/store এ না।
 * <Canvas> unmount হলে (page.tsx এ StructuralViewport দুইটা আলাদা JSX
 * position এ বসানো আছে — dual-panel block আর single-panel block,
 * দেখুন page.tsx এর কমেন্ট — তাই Elements/Analysis ↔ Detailing এর
 * মধ্যে সুইচ করলে React একে নতুন component instance ধরে, remount হয়)
 * সেই camera state পুরোপুরি হারিয়ে যায়, hardcoded default এ ফিরে আসে।
 *
 * এই store OrbitControls এর 'end' event এ (drag/gesture শেষ হলে, প্রতি
 * frame এ না — 'change' event এর চেয়ে অনেক কম ঘন ঘন) আপডেট হয়, আর
 * StructuralViewport mount হওয়ার সময় hardcoded default এর বদলে এখান
 * থেকে initial camera position/target পড়ে। ফলাফল: remount হলেও
 * ব্যবহারকারীর শেষ camera angle প্রায় হুবহু ফিরে আসে।
 *
 * VisualizationViewport এর ক্যামেরা ইচ্ছাকৃতভাবে এই store শেয়ার করে
 * না (আলাদা useVisualizationCameraStore, একই ফোল্ডারে) — কারণ
 * VisualizationViewport.tsx এর নিজস্ব কমেন্ট অনুযায়ী এটা সম্পূর্ণ আলাদা,
 * read-only presentation viewport (StructuralViewport এর editing
 * viewport থেকে ইচ্ছাকৃতভাবে বিচ্ছিন্ন)। Elements ট্যাবে একটা কোণা
 * zoom করে edit করার পর Visualization ট্যাবে গিয়ে সম্পূর্ণ ভিন্ন অংশের
 * DCR heat map দেখতে চাওয়া একটা স্বাভাবিক workflow — সেখানে একটার
 * camera angle আরেকটায় জোর করে টেনে আনা বরং বিরক্তিকর হতো। selection
 * state (useSelectionStore) ইচ্ছাকৃতভাবে shared থাকে দুই viewport এর
 * মধ্যে (element-focused workflow এর জন্য, VisualizationViewport.tsx এর
 * কমেন্টে ব্যাখ্যা করা আছে) — কিন্তু camera সেই একই যুক্তিতে পড়ে না।
 */

export interface CameraVector3 {
  x: number;
  y: number;
  z: number;
}

interface StructuralCameraState {
  position: CameraVector3;
  target: CameraVector3;
  setCamera: (position: CameraVector3, target: CameraVector3) => void;
}

/** StructuralViewport.tsx এর <Canvas camera={{ position: [14, 10, 14], ... }}> এর সাথে হুবহু মেলানো ডিফল্ট — প্রথমবার কোনো ইউজার ইন্টারঅ্যাকশনের আগে এই একই isometric-কাছাকাছি ভিউ থাকা উচিত। */
const DEFAULT_POSITION: CameraVector3 = { x: 14, y: 10, z: 14 };
const DEFAULT_TARGET: CameraVector3 = { x: 0, y: 0, z: 0 };

export const useStructuralCameraStore = create<StructuralCameraState>((set) => ({
  position: DEFAULT_POSITION,
  target: DEFAULT_TARGET,
  setCamera: (position, target) => set({ position, target }),
}));
