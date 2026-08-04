import type { AnalysisNode } from "@/lib/analysis/runAnalysis";

/**
 * Phase 10l — Displacement + Deformation Animation।
 *
 * সমস্যা: Analysis Engine এর result (nodalDisplacements, nodes) একটা
 * flat array, index দিয়ে ম্যাচ করে (AnalysisNode.md দেখুন)। কিন্তু
 * StructuralElement এর geometry (startPoint/endPoint/vertices) সরাসরি
 * সেই node index জানে না — element নিজের raw (x,y,z) coordinate রাখে,
 * analysis node কোন index সেটা রাখে না। AnalysisPanel.tsx এর pushover
 * control-point picker একই সমস্যায় পড়েছিল (দেখুন uniqueNodePoints,
 * সেখানে "x,y,z" 3-decimal-rounded string key ব্যবহার করা হয়েছিল
 * duplicate/shared node ম্যাচ করতে) — এখানে সেই একই key-pattern পুনরায়
 * ব্যবহার করা হলো, backend এর NodeGraph.index_of() এর সাথে সামঞ্জস্যপূর্ণ
 * (Phase 8a এর মন্তব্য অনুযায়ী)।
 *
 * এই ফাইল একটা coordinate → displacement lookup Map বানায় (একবার,
 * O(n)), তারপর যেকোনো element endpoint/vertex এর জন্য O(1) lookup।
 * shared রাখা হয়েছে কারণ 10l (displacement/deformation), ভবিষ্যতের
 * 10m (moment/shear/axial — যেটা elementEndForces থেকে সরাসরি আসবে,
 * এই lookup লাগবে না) থেকে আলাদা, কিন্তু 10o (mode shape/buckling
 * animation) এই একই lookup pattern পুনরায় ব্যবহার করবে (ModeShapeEntry
 * ও nodalDisplacements এর shape identical — {ux,uy,uz,rx,ry,rz})।
 */

export interface NodeTranslation {
  ux: number;
  uy: number;
  uz: number;
}

const COORD_DECIMALS = 3;

function coordKey(x: number, y: number, z: number): string {
  return `${x.toFixed(COORD_DECIMALS)},${y.toFixed(COORD_DECIMALS)},${z.toFixed(COORD_DECIMALS)}`;
}

/**
 * nodes[] ও একটা positionally-matching translation array (nodalDisplacements
 * বা modeShape/bucklingModeShape এর entry গুলো, যেগুলো সবই {ux,uy,uz,...}
 * shape শেয়ার করে) থেকে coordinate-keyed lookup Map বানায়।
 */
export function buildNodeDisplacementLookup(
  nodes: AnalysisNode[],
  translations: NodeTranslation[]
): Map<string, NodeTranslation> {
  const lookup = new Map<string, NodeTranslation>();
  const count = Math.min(nodes.length, translations.length);
  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    lookup.set(coordKey(n.x, n.y, n.z), translations[i]);
  }
  return lookup;
}

/** একটা element endpoint/vertex coordinate এর জন্য displacement খোঁজে। ম্যাচ না পেলে null (element analysis-এ অংশ নেয়নি, বা geometry পরিবর্তন হয়েছে run-এর পর)। */
export function lookupNodeDisplacement(
  lookup: Map<string, NodeTranslation>,
  point: { x: number; y: number; z: number }
): NodeTranslation | null {
  return lookup.get(coordKey(point.x, point.y, point.z)) ?? null;
}
