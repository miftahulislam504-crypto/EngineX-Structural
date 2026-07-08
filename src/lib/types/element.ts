/**
 * Structural Elements
 * Phase 2a: Beam, Column, Slab, Wall, Isolated Footing (priority items)
 * Phase 2c: + Brace, Shear Wall, Core Wall, Pile (বাকি যা এখনকার
 * geometry system এ সরাসরি ফিট করে)
 *
 * Full list from Section 2: Frame, Beam, Column, Brace, Truss, Slab,
 * Flat Slab, Drop Panel, Wall, Shear Wall, Core Wall, Foundation,
 * Footing, Raft, Pile, Pile Cap, Shell, Plate, Membrane, Solid, Cable,
 * Tendon, Spring, Damper, Link, Base Isolation, Custom Elements।
 *
 * Phase 2c-তে এখনো বাদ: Flat Slab/Drop Panel (Slab-এরই বিশেষ ধরন,
 * কিন্তু drop panel geometry-তে variable thickness লাগে যা এখনকার
 * uniform-thickness AreaElement এ ফিট করে না), Raft/Pile Cap (এগুলো
 * Slab-সদৃশ কিন্তু foundation-নির্দিষ্ট validation লাগবে), Shell/Plate/
 * Membrane/Solid (এগুলো FE-mesh ভিত্তিক এলিমেন্ট, Phase 4-এর Finite
 * Element Module ছাড়া অর্থপূর্ণ না), Cable/Tendon (significant
 * geometric nonlinearity — sag, prestress — যা এই straight-line
 * LineElement মডেলে ধরা যায় না বাস্তবসম্মতভাবে), Spring/Damper/Link/
 * Base Isolation (এগুলো point-to-point connector element, সম্পূর্ণ
 * ভিন্ন geometry ও degrees-of-freedom মডেল দাবি করে)।
 *
 * Truss নিয়ে একটা গুরুত্বপূর্ণ নোট: Truss সদস্য জ্যামিতিকভাবে Beam/
 * Brace-এর থেকে আলাদা না (দুই পয়েন্টের সরলরেখা) — পার্থক্যটা
 * structural behavior-এ (pin-connected, তাই শুধু axial force নেয়,
 * moment না)। তাই এখানে আলাদা "truss" category বানানো হয়নি, বরং
 * LineElement-এ connectionType ফিল্ড যোগ করা হয়েছে যা এই behavior
 * ধরে — Analysis Engine (Phase 4) এই ফিল্ড দেখে বুঝবে কোন member-কে
 * pin-ended (truss-এর মতো) আর কোন member-কে moment-connected (ফ্রেমের
 * মতো) হিসেবে সলভ করতে হবে।
 *
 * দুটো মৌলিক জ্যামিতিক শ্রেণী:
 *   - Line elements (Beam, Column, Brace, Pile): দুটো পয়েন্ট দিয়ে সংজ্ঞায়িত
 *   - Area elements (Slab, Wall, Shear Wall, Core Wall): polygon vertices দিয়ে সংজ্ঞায়িত
 *   - Point element (Footing): একটা পয়েন্টে বসে, নিজস্ব dimension আছে
 *
 * এই ভাগাভাগি geometryType discriminated union দিয়ে TypeScript এ
 * enforce করা আছে, যাতে ভুলবশত একটা Beam এ vertices বসানো বা Slab এ
 * startPoint বসানো কম্পাইল-টাইমেই ধরা পড়ে।
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type ElementCategory =
  | "beam"
  | "column"
  | "brace"
  | "pile"
  | "slab"
  | "wall"
  | "shear-wall"
  | "core-wall"
  | "footing";

interface BaseElement {
  elementId: string;
  category: ElementCategory;
  label: string; // যেমন "B1", "C1", "S1" — ইঞ্জিনিয়ারের নিজের নামকরণ কনভেনশন
  materialId: string; // MaterialLibrary এর একটা entry রেফারেন্স করে
  storyId?: string; // যে story-র সাথে সম্পর্কিত (Phase 1 এর StructuralStory), optional কারণ কিছু element (যেমন foundation) কোনো story-র না হয়ে base-এ থাকতে পারে
  createdAt: string;
  updatedAt: string;
}

/**
 * Beam, Column, Brace, Pile — সবাই Line Element, দুটো পয়েন্ট দিয়ে
 * সংজ্ঞায়িত। connectionType বলে দেয় এন্ড কন্ডিশন কেমন — "moment"
 * (rigid frame connection, ডিফল্ট Beam/Column-এর জন্য) বা "pin"
 * (truss-এর মতো আচরণ, শুধু axial force, কোনো moment transfer না)।
 */
interface LineElement extends BaseElement {
  sectionId: string; // SectionLibrary এর একটা entry রেফারেন্স করে
  startPoint: Point3D;
  endPoint: Point3D;
  connectionType: "moment" | "pin";
}

export interface BeamElement extends LineElement {
  category: "beam";
}

export interface ColumnElement extends LineElement {
  category: "column";
}

/**
 * Brace — সাধারণত diagonal member, lateral load resist করার জন্য
 * (wind/seismic bracing system)। ডিফল্টভাবে pin-connected ধরা হয়
 * (বাস্তবে বেশিরভাগ bracing system-এই এটাই প্রচলিত), কিন্তু moment-
 * connected bracing (rare, কিন্তু কিছু বিশেষ সিস্টেমে ব্যবহৃত) এর
 * সুযোগও connectionType দিয়ে রাখা হয়েছে।
 */
export interface BraceElement extends LineElement {
  category: "brace";
}

/**
 * Pile — foundation-এর গভীরে যাওয়া vertical/near-vertical member।
 * জ্যামিতিকভাবে Column-এর মতোই (দুই পয়েন্ট), কিন্তু আলাদা category
 * রাখা হয়েছে কারণ: (1) এটা সাধারণত base level-এর নিচে যায় (negative
 * elevation), storyId কখনো থাকে না, (2) ভবিষ্যতে geotechnical-specific
 * property (skin friction, end bearing) এই category-তে যোগ হবে যা
 * Column-এর সাথে মেশানো ঠিক হবে না semantically।
 */
export interface PileElement extends LineElement {
  category: "pile";
}

/** Slab ও Wall উভয়ই Area Element — polygon vertices দিয়ে সংজ্ঞায়িত। */
interface AreaElement extends BaseElement {
  vertices: Point3D[]; // ন্যূনতম ৩টা পয়েন্ট, ঘড়ির কাঁটার বিপরীতে (counter-clockwise) ক্রমে ধরা হয়
  thickness: number; // mm
}

export interface SlabElement extends AreaElement {
  category: "slab";
}

export interface WallElement extends AreaElement {
  category: "wall";
}

/**
 * Shear Wall — lateral load resist করার জন্য বিশেষায়িত wall, সাধারণত
 * Wall-এর চেয়ে পুরু এবং in-plane stiffness-কেন্দ্রিক ডিজাইন হয়।
 * জ্যামিতিকভাবে Wall থেকে আলাদা না (একই AreaElement), কিন্তু আলাদা
 * category রাখা হয়েছে কারণ Design Engine (Phase 6) এ shear wall-এর
 * জন্য আলাদা design check (boundary element, coupling beam ইত্যাদি)
 * প্রযোজ্য হবে যা সাধারণ partition wall-এ হয় না — সেই পার্থক্যটা
 * এখনই ডেটা মডেলে ধরে রাখা হচ্ছে, যদিও check logic এখনো লেখা হয়নি।
 */
export interface ShearWallElement extends AreaElement {
  category: "shear-wall";
}

/**
 * Core Wall — সাধারণত elevator/stair shaft ঘিরে থাকা connected shear
 * wall-এর গ্রুপ, যা একসাথে একটা "core" হিসেবে lateral system-এর
 * প্রধান অংশ হয় উঁচু ভবনে। এই মুহূর্তে এটা একটা একক AreaElement
 * হিসেবেই মডেল করা হয়েছে (একটা wall segment), কারণ পূর্ণাঙ্গ "core"
 * ধারণা (একাধিক wall segment-কে গ্রুপ করে একটা যৌথ ইউনিট হিসেবে
 * ট্রিট করা) একটা বড়, আলাদা ফিচার — সেটা ভবিষ্যতে group/assembly
 * concept হিসেবে যোগ হতে পারে।
 */
export interface CoreWallElement extends AreaElement {
  category: "core-wall";
}

/** Isolated Footing — একটা পয়েন্টে বসে, নিজস্ব plan dimension ও thickness থাকে। */
export interface FootingElement extends BaseElement {
  category: "footing";
  location: Point3D; // ফুটিং-এর কেন্দ্রবিন্দু
  width: number; // mm, plan dimension (X-দিকে)
  length: number; // mm, plan dimension (Z-দিকে)
  thickness: number; // mm
}

export type StructuralElement =
  | BeamElement
  | ColumnElement
  | BraceElement
  | PileElement
  | SlabElement
  | WallElement
  | ShearWallElement
  | CoreWallElement
  | FootingElement;

/** দুটো পয়েন্টের মধ্যে দূরত্ব (Beam/Column এর length হিসাব করতে কাজে লাগে)। */
export function distanceBetweenPoints(a: Point3D, b: Point3D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

/** Beam/Column এর length (মিটারে, যেহেতু grid/story কোঅর্ডিনেট মিটারে)। */
export function computeLineElementLength(element: BeamElement | ColumnElement): number {
  return distanceBetweenPoints(element.startPoint, element.endPoint);
}

/**
 * একটা polygon area হিসাব করে (Shoelace formula), XZ প্লেনে প্রজেক্ট
 * করে (Y = elevation কে উচ্চতা হিসেবে ধরে, তাই plan area XZ প্লেনেই
 * থাকে)। Slab-এর plan area, Wall-এর ক্ষেত্রে এটা কম প্রাসঙ্গিক (wall
 * সাধারণত vertical plane এ থাকে) — Wall-এর জন্য ভবিষ্যতে length×height
 * ভিত্তিক আলাদা হিসাব যোগ হতে পারে, কিন্তু এই ফাংশন Slab-এর জন্য যথেষ্ট।
 */
export function computePolygonPlanArea(vertices: Point3D[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area / 2);
}

function makeElementId(): string {
  return `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** নতুন Beam তৈরির হেল্পার। connectionType ডিফল্ট "moment" (rigid frame connection, Beam-এর জন্য standard)। */
export function createBeam(params: {
  label: string;
  materialId: string;
  sectionId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  storyId?: string;
  connectionType?: "moment" | "pin";
}): BeamElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "beam",
    ...params,
    // params স্প্রেড করার পরে connectionType আলাদাভাবে বসানো হচ্ছে
    // (স্প্রেড-এর আগে ডিফল্ট রাখার বদলে), যাতে params.connectionType
    // explicitly undefined হলেও (যা TypeScript এ optional field-এর
    // জন্য একটা বৈধ assignable value) ডিফল্ট ঠিকভাবে প্রয়োগ হয় —
    // object spread এ পরের property আগেরটাকে override করে এমনকি
    // value undefined হলেও, তাই ডিফল্টকে সবসময় শেষে ?? দিয়ে বসানো
    // নিরাপদ প্যাটার্ন।
    connectionType: params.connectionType ?? "moment",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Column তৈরির হেল্পার। connectionType ডিফল্ট "moment" (rigid frame connection, Column-এর জন্য standard)। */
export function createColumn(params: {
  label: string;
  materialId: string;
  sectionId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  storyId?: string;
  connectionType?: "moment" | "pin";
}): ColumnElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "column",
    ...params,
    connectionType: params.connectionType ?? "moment",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Brace তৈরির হেল্পার। connectionType ডিফল্ট "pin" — বাস্তবে
 * বেশিরভাগ bracing system pin-connected (Beam/Column-এর "moment"
 * ডিফল্টের বিপরীত, কারণ bracing-এর মূল উদ্দেশ্যই axial force দিয়ে
 * lateral load resist করা, moment transfer না)।
 */
export function createBrace(params: {
  label: string;
  materialId: string;
  sectionId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  storyId?: string;
  connectionType?: "moment" | "pin";
}): BraceElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "brace",
    ...params,
    connectionType: params.connectionType ?? "pin",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Pile তৈরির হেল্পার। connectionType ডিফল্ট "moment" (pile cap-এর
 * সাথে সাধারণত fixed/moment connection ধরা হয়), storyId সাধারণত
 * undefined থাকে (base level-এর নিচে, কোনো story-র অংশ না)।
 */
export function createPile(params: {
  label: string;
  materialId: string;
  sectionId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  connectionType?: "moment" | "pin";
}): PileElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "pile",
    ...params,
    connectionType: params.connectionType ?? "moment",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Footing তৈরির হেল্পার। Beam/Column থেকে ভিন্ন — sectionId নেই
 * (Footing standard section catalog থেকে আসে না, প্রতিটা প্রজেক্টে
 * bearing capacity/column load অনুযায়ী নিজস্ব dimension দিয়ে সরাসরি
 * সংজ্ঞায়িত হয়), এবং storyId সাধারণত থাকে না কারণ Footing base level-এ
 * বসে (কোনো story-র elevation-এ না, বরং তার নিচে) — তাও optional
 * parameter হিসেবে রাখা হয়েছে যদি কখনো elevated/transfer footing-এর
 * প্রয়োজন হয়।
 */
export function createFooting(params: {
  label: string;
  materialId: string;
  location: Point3D;
  width: number;
  length: number;
  thickness: number;
  storyId?: string;
}): FootingElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "footing",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}
