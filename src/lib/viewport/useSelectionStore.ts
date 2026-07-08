import { create } from "zustand";

/**
 * পুরো viewport-এর জন্য একটাই selection state। Phase 1-এ selection
 * শুধু useGeometryStore এর ভিতরে ছিল (grid/story), কিন্তু Phase 2a
 * থেকে element-ও সিলেক্টযোগ্য হচ্ছে — এবং ভবিষ্যতে Load (Phase 3),
 * Analysis result (Phase 4+) ইত্যাদিও সিলেক্টযোগ্য হবে। তাই selection
 * কে একটা আলাদা, domain-independent store এ সরানো হলো, যাতে
 * useGeometryStore নিজের দায়িত্বে (শুধু Grid/Story ডেটা) সীমাবদ্ধ থাকে।
 *
 * এটা Phase 1-এর GeometrySelection এর সরাসরি replacement — Phase 1-এর
 * কোড যেখানে useGeometryStore থেকে selection ব্যবহার করত, সেটা এখন
 * এই store থেকে ব্যবহার করবে (useGeometryCore.ts, GridPanel.tsx,
 * StoryPanel.tsx, StructuralViewport.tsx আপডেট করা হয়েছে)।
 */
export type ViewportSelection =
  | { type: "none" }
  | { type: "grid"; gridId: string }
  | { type: "story"; storyId: string }
  | { type: "element"; elementId: string };

interface SelectionStoreState {
  selection: ViewportSelection;
  setSelection: (selection: ViewportSelection) => void;
}

export const useSelectionStore = create<SelectionStoreState>((set) => ({
  selection: { type: "none" },
  setSelection: (selection) => set({ selection }),
}));
