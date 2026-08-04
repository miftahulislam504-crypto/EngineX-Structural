import { create } from "zustand";
import type { Point3D } from "@/lib/types/element";

export type DrawableCategory = "slab" | "wall" | "shear-wall" | "core-wall" | "mat-foundation";

/**
 * DrawableCategory এর সাথে একসাথে রাখা হয়েছে (একই ফাইলে) যাতে নতুন
 * category যোগ করার সময় টাইপ ও তার label একসাথে আপডেট হয় — আলাদা
 * ফাইলে থাকলে একটা আপডেট করে আরেকটা ভুলে যাওয়ার ঝুঁকি থাকতো।
 * AreaElementPanel ও DrawModeToolbar দুটোই এখান থেকে import করে,
 * কোনো ডুপ্লিকেট map রাখা হয়নি। mat-foundation (Phase 7c) এখানে
 * যোগ করা হয়েছে কারণ সেটাও polygon-vertex ভিত্তিক area geometry
 * শেয়ার করে, যদিও এর design workflow সম্পূর্ণ আলাদা (RcWallDesignPanel/
 * ElementLoadPanel/loadVerification.ts এ mat-foundation ইচ্ছাকৃতভাবে
 * অন্তর্ভুক্ত করা হয়নি — ওগুলো explicit literal category set ব্যবহার
 * করে, DrawableCategory না, তাই mat-foundation ভুলবশত wall-এর load/
 * design logic এ ঢুকে পড়বে না)।
 */
export const DRAWABLE_CATEGORY_LABELS: Record<DrawableCategory, string> = {
  slab: "Slab",
  wall: "Wall",
  "shear-wall": "Shear Wall",
  "core-wall": "Core Wall",
  "mat-foundation": "Mat Foundation",
};

export const DRAWABLE_CATEGORY_LABEL_PREFIXES: Record<DrawableCategory, string> = {
  slab: "S1",
  wall: "W1",
  "shear-wall": "SW1",
  "core-wall": "CW1",
  "mat-foundation": "MAT1",
};

interface DrawModeState {
  /** null মানে draw mode বন্ধ — viewport স্বাভাবিক select/orbit আচরণে থাকে। */
  activeCategory: DrawableCategory | null;
  /** এখন পর্যন্ত ক্লিক করা vertex গুলো, ক্রম অনুযায়ী। */
  points: Point3D[];
  /** কোন elevation-এ আঁকা হচ্ছে (সাধারণত সিলেক্টেড story-র elevation)। */
  drawElevation: number;
  /**
   * draw শুরু হওয়ার মুহূর্তে যে story সিলেক্টেড ছিল (থাকলে), সেটার
   * ID। এটা drawElevation এর সাথেই একই সময়ে capture করা হয় এবং
   * drawing session জুড়ে অপরিবর্তিত থাকে — যাতে finishDrawing এর পর
   * তৈরি হওয়া Slab/Wall element টা সঠিক story-র সাথে associate থাকে,
   * draw চলাকালীন ইউজার sidebar থেকে অন্য story ক্লিক করে ফেললেও।
   */
  drawStoryId: string | undefined;

  startDrawing: (category: DrawableCategory, elevation: number, storyId?: string) => void;
  addPoint: (point: Point3D) => void;
  removeLastPoint: () => void;
  cancelDrawing: () => void;
  /** ফিনিশ করার পর points ও storyId রিটার্ন করে এবং state রিসেট করে। */
  finishDrawing: () => { points: Point3D[]; storyId: string | undefined };
}

/**
 * এই store useSelectionStore থেকে ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে —
 * selection ("viewport এ কী হাইলাইট আছে") ও draw mode ("viewport এখন
 * click আসলে কী করবে") দুটো ভিন্ন concern। একসাথে রাখলে viewport
 * component-এ if-else এর জট তৈরি হতো (click handler কে বুঝতে হতো
 * এটা select নাকি draw-vertex-add, দুই store আলাদা থাকায় সেই
 * সিদ্ধান্ত পরিষ্কারভাবে "activeCategory null কিনা" চেক করেই হয়)।
 */
export const useDrawModeStore = create<DrawModeState>((set, get) => ({
  activeCategory: null,
  points: [],
  drawElevation: 0,
  drawStoryId: undefined,

  startDrawing: (category, elevation, storyId) =>
    set({ activeCategory: category, points: [], drawElevation: elevation, drawStoryId: storyId }),

  addPoint: (point) => set((state) => ({ points: [...state.points, point] })),

  removeLastPoint: () => set((state) => ({ points: state.points.slice(0, -1) })),

  cancelDrawing: () =>
    set({ activeCategory: null, points: [], drawElevation: 0, drawStoryId: undefined }),

  finishDrawing: () => {
    const { points, drawStoryId } = get();
    set({ activeCategory: null, points: [], drawElevation: 0, drawStoryId: undefined });
    return { points, storyId: drawStoryId };
  },
}));
