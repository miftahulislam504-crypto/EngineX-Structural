import type { StructuralElement, Point3D } from "@/lib/types/element";
import type { StructuralGrid, GridDirection } from "@/lib/types/geometry";

/**
 * Auto-Grid Derivation।
 *
 * ETABS/SAP2000 এ ইঞ্জিনিয়ার সাধারণত grid আগে বসান, তারপর তার উপর
 * column/beam বসান। এই App এ উল্টো flow-ও সমর্থিত করা দরকার (ব্যবহারকারীর
 * অনুরোধ): element (column/beam/slab/wall/...) যেখানেই আঁকা হোক না কেন,
 * সেই element গুলোর X ও Z কোঅর্ডিনেট থেকে automatically grid line বের
 * করে দেখানো — যাতে grid আগে থেকে সংজ্ঞায়িত না থাকলেও 2D/3D ভিউ ETABS-এর
 * মতো grid+element একসাথে দেখায়।
 *
 * পদ্ধতি:
 *   1. প্রতিটা element এর সব vertex/endpoint/location থেকে (x, z) জোড়া
 *      সংগ্রহ করা হয় (Y বাদ, কারণ grid প্ল্যান-ভিউ কনসেপ্ট — elevation
 *      না, Story দিয়ে সেটা হ্যান্ডল হয়)।
 *   2. X-কোঅর্ডিনেট গুলো ক্লাস্টার করে unique vertical grid (Z-দিকে
 *      চলা রেখা, ETABS কনভেনশনে সংখ্যা দিয়ে লেবেল করা হয়: 1, 2, 3...)।
 *   3. Z-কোঅর্ডিনেট গুলো ক্লাস্টার করে unique horizontal grid (X-দিকে
 *      চলা রেখা, অক্ষর দিয়ে লেবেল করা হয়: A, B, C...)।
 *   4. Clustering একটা tolerance (ডিফল্ট ০.১৫ মিটার = ১৫০ মিমি) এর
 *      মধ্যে কাছাকাছি কোঅর্ডিনেটকে একই গ্রিডে গণ্য করে — বাস্তবে দুটো
 *      কলাম সামান্য ভুল করে ০.০১ মিটার off থাকলেও সেগুলো আলাদা গ্রিড
 *      হয়ে যাওয়া উচিত না।
 *   5. Manual grid (GridPanel থেকে হাতে বানানো, geometry.grids এ persist
 *      হওয়া) এর সাথে merge করা হয় — কোনো manual grid এর কোঅর্ডিনেট এর
 *      কাছাকাছি (tolerance এর মধ্যে) auto coordinate থাকলে সেটা বাদ
 *      দেওয়া হয় (duplicate line না বসিয়ে), ব্যবহারকারীর manual লেবেলটাই
 *      জেতে। এভাবে auto-derive কখনো manual grid কে override করে না,
 *      শুধু ফাঁকা জায়গা পূরণ করে।
 *
 * লেবেলিং (ব্যবহারকারীর সিদ্ধান্ত অনুযায়ী, ETABS কনভেনশন):
 *   - X-direction grid (যা X-কোঅর্ডিনেট বোঝায়, রেখাটা Z-অক্ষ বরাবর চলে):
 *     সংখ্যা — 1, 2, 3, ...
 *   - Y-direction grid (যা Z-কোঅর্ডিনেট বোঝায়, রেখাটা X-অক্ষ বরাবর চলে):
 *     অক্ষর — A, B, C, ..., Z, AA, AB, ...
 *   - বাম থেকে ডানে (বা নিচ থেকে উপরে) coordinate ছোট থেকে বড় ক্রমে
 *     সাজিয়ে লেবেল বসানো হয় — ETABS এও grid label সাধারণত geometric
 *     ক্রম অনুসরণ করে, elementগুলো যে ক্রমে আঁকা হয়েছে সেই ক্রমে না।
 *
 * নোট: এই module টা pure function, কোনো store/side-effect নেই — তাই
 * viewport component গুলোতে useMemo দিয়ে সরাসরি কল করা যায়, এবং টেস্ট
 * করাও সহজ।
 */

const DEFAULT_TOLERANCE_M = 0.15; // মিটার — ১৫ সেমি এর মধ্যে কাছাকাছি কোঅর্ডিনেট একই গ্রিড ধরা হয়

export interface DerivedGrid extends StructuralGrid {
  /** true হলে এই গ্রিড element geometry থেকে auto-derive করা, GridPanel থেকে হাতে বানানো না। */
  isAuto: true;
}

/** নম্বর সিরিজ লেবেল: 1, 2, 3, ... */
function numericLabel(index: number): string {
  return String(index + 1);
}

/** অক্ষর সিরিজ লেবেল: A, B, ..., Z, AA, AB, ... (spreadsheet কলাম কনভেনশন) */
function alphaLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * একটা element এর সব (x, z) reference point বের করে — geometryType
 * অনুযায়ী আলাদা shape (line/area/point)।
 */
function extractPlanPoints(element: StructuralElement): Point3D[] {
  switch (element.category) {
    case "beam":
    case "column":
    case "brace":
    case "pile":
      return [element.startPoint, element.endPoint];

    case "slab":
    case "wall":
    case "shear-wall":
    case "core-wall":
    case "mat-foundation":
    case "stair":
    case "parapet":
      return element.vertices;

    case "footing":
    case "pile-cap":
      return [element.location];

    case "combined-footing":
      return [element.columnALocation, element.columnBLocation];

    case "strip-footing":
      return [element.startPoint, element.endPoint];

    case "pile-group":
      return [element.centroidLocation];

    default: {
      const exhaustiveCheck: never = element;
      console.error("deriveGridsFromElements: unhandled category", exhaustiveCheck);
      return [];
    }
  }
}

/**
 * একমাত্রিক coordinate list কে tolerance অনুযায়ী ক্লাস্টার করে unique
 * grid-coordinate এ নামায় — প্রতিটা ক্লাস্টারের representative value
 * হলো তার সদস্যদের average (raw coordinate সরাসরি না, কারণ ছোটখাটো
 * off-grid ভুল থাকলে গড় মান গ্রিড রেখাটাকে সবচেয়ে "ন্যায্য" জায়গায়
 * বসায়)।
 */
function clusterCoordinates(values: number[], tolerance: number): number[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];

  for (const value of sorted) {
    const lastCluster = clusters[clusters.length - 1];
    if (lastCluster && value - lastCluster[lastCluster.length - 1] <= tolerance) {
      lastCluster.push(value);
    } else {
      clusters.push([value]);
    }
  }

  return clusters.map((cluster) => cluster.reduce((sum, v) => sum + v, 0) / cluster.length);
}

/**
 * Manual grid (existing geometry.grids) এর কোঅর্ডিনেটগুলোর tolerance
 * এর মধ্যে থাকা auto-cluster বাদ দেয় — যাতে duplicate গ্রিড লাইন না
 * বসে এবং manual লেবেলটাই প্রাধান্য পায়।
 */
function filterOutNearManual(
  autoCoords: number[],
  manualCoords: number[],
  tolerance: number
): number[] {
  if (manualCoords.length === 0) return autoCoords;
  return autoCoords.filter(
    (coord) => !manualCoords.some((m) => Math.abs(coord - m) <= tolerance)
  );
}

export interface DeriveGridsOptions {
  tolerance?: number;
}

/**
 * Element list ও existing (manual) grid থেকে auto-derived grid বের করে।
 * শুধু নতুন auto গ্রিডগুলো রিটার্ন করে (manual grid নিজে না) — caller
 * (viewport component) manual+auto দুটো array মিলিয়ে render করবে।
 */
export function deriveGridsFromElements(
  elements: StructuralElement[],
  manualGrids: StructuralGrid[],
  options: DeriveGridsOptions = {}
): DerivedGrid[] {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_M;

  const xValues: number[] = [];
  const zValues: number[] = [];

  for (const element of elements) {
    const points = extractPlanPoints(element);
    for (const p of points) {
      xValues.push(p.x);
      zValues.push(p.z);
    }
  }

  const manualX = manualGrids.filter((g) => g.direction === "X").map((g) => g.coordinate);
  const manualZ = manualGrids.filter((g) => g.direction === "Y").map((g) => g.coordinate);

  const clusteredX = clusterCoordinates(xValues, tolerance);
  const clusteredZ = clusterCoordinates(zValues, tolerance);

  const autoX = filterOutNearManual(clusteredX, manualX, tolerance).sort((a, b) => a - b);
  const autoZ = filterOutNearManual(clusteredZ, manualZ, tolerance).sort((a, b) => a - b);

  const now = new Date().toISOString();

  const autoXGrids: DerivedGrid[] = autoX.map((coordinate, index) => ({
    gridId: `auto-grid-x-${index}-${coordinate.toFixed(3)}`,
    label: numericLabel(index),
    direction: "X" as GridDirection,
    coordinate,
    visible: true,
    createdAt: now,
    updatedAt: now,
    isAuto: true,
  }));

  const autoZGrids: DerivedGrid[] = autoZ.map((coordinate, index) => ({
    gridId: `auto-grid-y-${index}-${coordinate.toFixed(3)}`,
    label: alphaLabel(index),
    direction: "Y" as GridDirection,
    coordinate,
    visible: true,
    createdAt: now,
    updatedAt: now,
    isAuto: true,
  }));

  return [...autoXGrids, ...autoZGrids];
}

/**
 * Model extent (bounding box) বের করে element + grid (manual ও auto
 * উভয়) থেকে — viewport camera zoom/span কে model size অনুযায়ী মানানসই
 * করার জন্য। খালি/ছোট মডেলেও একটা যুক্তিসঙ্গত ন্যূনতম রাখা হয়েছে
 * (৫ মিটার), যাতে single-column model এও camera একদম ক্লোজ-আপ না
 * হয়ে যায়।
 */
export interface ModelExtent {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** সবচেয়ে বড় span (X বা Z) — camera zoom হিসাবের জন্য সুবিধাজনক single number */
  span: number;
}

export function computeModelExtent(
  elements: StructuralElement[],
  allGrids: StructuralGrid[]
): ModelExtent {
  const xs: number[] = [];
  const zs: number[] = [];

  for (const element of elements) {
    for (const p of extractPlanPoints(element)) {
      xs.push(p.x);
      zs.push(p.z);
    }
  }
  for (const grid of allGrids) {
    if (grid.direction === "X") xs.push(grid.coordinate);
    else zs.push(grid.coordinate);
  }

  const MIN_HALF_SPAN = 5; // মিটার — খালি/একক-এলিমেন্ট মডেলেও ন্যূনতম দৃশ্যমান এলাকা

  const minX = xs.length ? Math.min(...xs) : -MIN_HALF_SPAN;
  const maxX = xs.length ? Math.max(...xs) : MIN_HALF_SPAN;
  const minZ = zs.length ? Math.min(...zs) : -MIN_HALF_SPAN;
  const maxZ = zs.length ? Math.max(...zs) : MIN_HALF_SPAN;

  const spanX = Math.max(maxX - minX, MIN_HALF_SPAN * 2);
  const spanZ = Math.max(maxZ - minZ, MIN_HALF_SPAN * 2);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    span: Math.max(spanX, spanZ),
  };
}
