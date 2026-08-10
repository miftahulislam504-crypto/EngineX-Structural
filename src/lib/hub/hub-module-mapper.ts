/**
 * Hub Module Data — Field Shape Mapper (এই App-এর দিক থেকে)
 * ------------------------------------------------------------------
 * hub-module-shapes.ts এর raw Draw shape (ProjectGrid/ProjectLevel,
 * contract.types.ts থেকে) কে এই App-এর নিজস্ব domain shape এ
 * (StructuralGrid, StructuralStory — src/lib/types/geometry.ts) রূপান্তর
 * করে।
 *
 * CPMS-এর src/lib/hub/hub-sync.ts এর একই design নীতি অনুসরণ করা হয়েছে:
 * প্রতিটা mapping ফাংশন defensive — কোনো item-এর shape অপ্রত্যাশিত হলে
 * (missing field, ভুল type) পুরো conversion না ভেঙে সেই item স্কিপ করে,
 * console.warn করে, বাকি item গুলো process করতে থাকে।
 *
 * এই ফাইল Firestore/Storage ছোঁয় না (কোনো read/write/fetch নেই) — শুধু
 * pure data transformation, যাতে unit test করা সহজ হয় এবং
 * hub-geometry-parser.ts (যেটা আসল Storage fetch করে, hub-sdk-client.ts
 * এর getModuleDataFile() দিয়ে) থেকে ডেটা পাওয়ার পর এই ফাংশনগুলো কল করা
 * যায়।
 */

import type { StructuralGrid, StructuralStory } from "@/lib/types/geometry";
import type { ProjectGrid, ProjectLevel } from "./contract.types";
import type { DrawArchitecturalExport } from "./hub-module-shapes";

function warnSkipped(context: string, index: number, reason: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[hub-module-mapper] ${context}[${index}] স্কিপ করা হলো — ${reason}`);
}

// ─── Architectural: Grid ────────────────────────────────────────────────

/**
 * Draw-এর ProjectGrid[] কে এই App-এর StructuralGrid[] এ map করে।
 * label ফিল্ড ProjectGrid-এর শেপে নেই (শুধু axis+position) — তাই axis
 * অক্ষর + ক্রমিক সংখ্যা দিয়ে generate করা হয় (যেমন X1, X2, Y1),
 * ইঞ্জিনিয়ার পরে UI থেকে চাইলে rename করতে পারবেন। color/visible এই
 * App-এর নিজস্ব viewport-এর জন্য, Draw পাঠায় না — নিরাপদ default বসানো
 * হয়েছে।
 */
export function mapArchitecturalGrid(
  gridLines: ProjectGrid[] | undefined,
  nowIso: string,
): StructuralGrid[] {
  if (!gridLines || gridLines.length === 0) return [];

  const counters: Record<"X" | "Y", number> = { X: 0, Y: 0 };
  const result: StructuralGrid[] = [];

  gridLines.forEach((g, i) => {
    if (!g || typeof g.id !== "string" || !g.id) {
      warnSkipped("grid", i, "id অনুপস্থিত বা খালি");
      return;
    }
    if (g.axis !== "X" && g.axis !== "Y") {
      warnSkipped("grid", i, `অপ্রত্যাশিত axis: ${String(g.axis)}`);
      return;
    }
    if (typeof g.position !== "number" || Number.isNaN(g.position)) {
      warnSkipped("grid", i, "position সংখ্যা না");
      return;
    }

    counters[g.axis] += 1;
    result.push({
      gridId: g.id,
      label: `${g.axis}${counters[g.axis]}`,
      direction: g.axis,
      coordinate: g.position,
      visible: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  return result;
}

// ─── Architectural: Levels/Stories ──────────────────────────────────────

/**
 * Draw-এর ProjectLevel[] কে এই App-এর StructuralStory[] এ map করে।
 * order (0 = base, increasing upward) elevation অনুযায়ী sort করে বসানো
 * হয় — Draw পাঠায় না, কিন্তু StructuralStory তে আবশ্যক ফিল্ড।
 * isBaseLevel = সবচেয়ে কম elevation-এর story-র জন্য true (ধরে নেওয়া
 * হচ্ছে Draw সবসময় absolute elevation পাঠায়, relative না — এটা
 * contract.types.ts এর ProjectLevel.elevation-এর সাথে সংগতিপূর্ণ,
 * এবং buildArchitecturalExport()-এ computeFloorBaseElevations() থেকে
 * verified হয়েছে)।
 */
export function mapArchitecturalLevels(
  levels: ProjectLevel[] | undefined,
  nowIso: string,
): StructuralStory[] {
  if (!levels || levels.length === 0) return [];

  const valid: ProjectLevel[] = [];
  levels.forEach((lvl, i) => {
    if (!lvl || typeof lvl.id !== "string" || !lvl.id) {
      warnSkipped("level", i, "id অনুপস্থিত বা খালি");
      return;
    }
    if (typeof lvl.elevation !== "number" || Number.isNaN(lvl.elevation)) {
      warnSkipped("level", i, "elevation সংখ্যা না");
      return;
    }
    if (typeof lvl.height !== "number" || Number.isNaN(lvl.height)) {
      warnSkipped("level", i, "height সংখ্যা না");
      return;
    }
    valid.push(lvl);
  });

  const sorted = [...valid].sort((a, b) => a.elevation - b.elevation);

  return sorted.map((lvl, order) => ({
    storyId: lvl.id,
    name: lvl.name && lvl.name.trim() ? lvl.name : `Level ${order}`,
    elevation: lvl.elevation,
    height: lvl.height,
    order,
    isBaseLevel: order === 0,
    visible: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

/**
 * সুবিধাজনক wrapper — Storage থেকে fetch করা DrawArchitecturalExport
 * থেকে সরাসরি grid+levels দুটোই এক কলে বের করে (element mapping
 * hub-geometry-parser.ts এ, এখানে না — সেটার জন্য material/section
 * library-ও লাগে, যা এই ফাইলের pure-transformation নীতির সাথে যায় না)।
 */
export function mapArchitecturalGeometry(
  data: DrawArchitecturalExport | undefined,
  nowIso: string = new Date().toISOString(),
): { grids: StructuralGrid[]; stories: StructuralStory[] } {
  return {
    grids: mapArchitecturalGrid(data?.grids, nowIso),
    stories: mapArchitecturalLevels(data?.levels, nowIso),
  };
}
