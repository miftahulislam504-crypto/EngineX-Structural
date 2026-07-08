import { create } from "zustand";
import type { DrawableCategory } from "@/lib/viewport/useDrawModeStore";
import type { Point3D } from "@/lib/types/element";

export interface PendingAreaElement {
  category: DrawableCategory;
  vertices: Point3D[];
  storyId?: string;
}

interface PendingAreaElementState {
  pending: PendingAreaElement | null;
  setPending: (pending: PendingAreaElement) => void;
  clearPending: () => void;
}

/**
 * draw mode এ "Finish" চাপার পর polygon vertices চূড়ান্ত হয়ে যায়,
 * কিন্তু element তৈরির জন্য এখনো material ও thickness লাগবে — সেটা
 * sidebar এর একটা ছোট ফর্মে জিজ্ঞেস করা হয় (viewport এ মডাল না,
 * বাকি সব প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ রাখতে)। এই দুই ধাপের মাঝে
 * vertices গুলো এই store এ অস্থায়ীভাবে থাকে।
 */
export const usePendingAreaElementStore = create<PendingAreaElementState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));
