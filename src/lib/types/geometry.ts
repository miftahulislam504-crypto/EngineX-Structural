/**
 * Geometry Core Types (Phase 1 — Section 2: Structural Model / Geometry)
 *
 * এই টাইপগুলা এই App-এর নিজস্ব Grid/Story সিস্টেমের জন্য — Hub থেকে আসা
 * HubGrid/HubLevel (src/lib/types/hub.ts) থেকে আলাদা। কারণ:
 *   - Hub-এর Grid/Level শুধু রেফারেন্স জ্যামিতি (Architectural App যা আঁকে)
 *   - এই App-এর Grid/Story হলো Structural Model-এর নিজস্ব workspace,
 *     যা Hub-এর ডেটা দিয়ে সিড হতে পারে (Synchronize Model, Phase 1 এর পরের
 *     অংশ) কিন্তু independently এডিটযোগ্য।
 */

export type GridDirection = "X" | "Y";

export interface StructuralGrid {
  gridId: string;
  label: string; // e.g. "A", "B", "1", "2"
  direction: GridDirection;
  coordinate: number; // meters from origin, along the perpendicular axis
  color?: string; // optional override for viewport rendering
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StructuralStory {
  storyId: string;
  name: string; // e.g. "Ground Floor", "Level 1", "Roof"
  elevation: number; // meters from base (absolute, not relative height)
  height: number; // storey height, meters (distance to the story above)
  order: number; // 0 = base/foundation level, increases upward
  isBaseLevel: boolean;
  color?: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorkPlaneAxis = "XY" | "XZ" | "YZ";

export interface WorkPlane {
  workPlaneId: string;
  name: string;
  axis: WorkPlaneAxis;
  offset: number; // distance along the normal axis, meters
  isActive: boolean;
}

export interface ReferenceLine {
  referenceLineId: string;
  label: string;
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  visible: boolean;
}

/**
 * পুরো Geometry Core মডেল — Firestore এ একটা ডকুমেন্ট হিসেবে থাকবে
 * (subcollection না, কারণ grid/story গুলো সচরাচর একসাথে পড়া/লেখা হয়
 * এবং সংখ্যায় সাধারণত কম, তাই একটা ডকুমেন্টে রাখা Firestore read count
 * ও latency এর দিক থেকে বেশি efficient)।
 */
export interface GeometryCore {
  grids: StructuralGrid[];
  stories: StructuralStory[];
  workPlanes: WorkPlane[];
  referenceLines: ReferenceLine[];
  originOffset: { x: number; y: number; z: number }; // coordinate system origin, relative to Hub's architectural model origin
  updatedAt: string;
}

export function createEmptyGeometryCore(): GeometryCore {
  return {
    grids: [],
    stories: [],
    workPlanes: [
      { workPlaneId: "default-xy", name: "Plan View", axis: "XY", offset: 0, isActive: true },
    ],
    referenceLines: [],
    originOffset: { x: 0, y: 0, z: 0 },
    updatedAt: new Date().toISOString(),
  };
}
