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
  | "stair"
  | "stair-landing"
  | "parapet"
  | "footing"
  | "combined-footing"
  | "strip-footing"
  | "mat-foundation"
  | "pile-cap"
  | "pile-group";

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
 *
 * hingeAtStart/hingeAtEnd (উভয়ই ঐচ্ছিক, ডিফল্ট undefined ≈ false) —
 * Nonlinear Static Analysis (Phase 4, Concentrated Plastic Hinge
 * পদ্ধতি) এর জন্য — কোন প্রান্তে একটা moment hinge assign করা আছে।
 * hinge এর yield moment capacity নিজে element-এ না, বরং
 * SectionLibrary এর সেই element যে section ব্যবহার করছে সেখানে থাকে
 * (StructuralSection.yieldMomentMzKNm) — কারণ capacity মূলত section
 * geometry ও material grade এর ফাংশন, প্রতিটা element instance এর
 * না। hingeAtStart/hingeAtEnd true থাকলেও section এর yield capacity
 * সেট না থাকলে (0 বা undefined), সেই প্রান্ত backend এ কার্যত elastic
 * থেকে যায় (solveNonlinearStatic() docstring দেখুন, backend repo)।
 */
interface LineElement extends BaseElement {
  sectionId: string; // SectionLibrary এর একটা entry রেফারেন্স করে
  startPoint: Point3D;
  endPoint: Point3D;
  connectionType: "moment" | "pin";
  hingeAtStart?: boolean;
  hingeAtEnd?: boolean;
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

/**
 * liveLoadOverride (kN/m², optional) — এই নির্দিষ্ট slab-এর জন্য
 * project-wide Hub bnbcSettings.liveLoadValue বাদ দিয়ে একটা ভিন্ন
 * occupancy live load বসাতে চাইলে ব্যবহার হয় (যেমন একই ভবনে
 * residential floor + parking + roof — আলাদা আলাদা occupancy)।
 * undefined/না থাকলে deriveLiveLoadCases.ts প্রজেক্ট-লেভেল default
 * ব্যবহার করে (আগের আচরণ অপরিবর্তিত)। ২০২৬-০৮ যোগ হলো।
 */
export interface SlabElement extends AreaElement {
  category: "slab";
  liveLoadOverride?: number;
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

/**
 * Stair — প্রতিটা straight flight একটা inclined waist-slab হিসেবে
 * মডেল করা হয় (Draw-এর multi-flight Stair থেকে আসা প্রতিটা StairFlight
 * আলাদা একটা StairElement হয়ে আসে — hub-geometry-parser.ts দেখুন)।
 * জ্যামিতিকভাবে AreaElement-ই ব্যবহার করা হয়েছে (vertices + thickness)
 * যেমন Slab/Wall — vertices-এর নিচের/উপরের প্রান্তের z আলাদা থাকায়
 * inclination ধরা পড়ে, তাই আলাদা geometry shape লাগেনি। mid-run landing
 * (দুই flight-এর মাঝের turn platform) আলাদা LandingElement হিসেবে আসে
 * (২০২৬-০৮ গ্যাপ-ক্লোজিং পাস — আগে আসত না, mapStairLanding() দেখুন);
 * bottom/top landing (স্টোরির নিজস্ব floor level-এ) ইচ্ছাকৃতভাবে বাদ,
 * সেই floor-এর নিজস্ব Slab element দিয়ে ইতিমধ্যে কভার্ড।
 *
 * riserHeightM/numberOfSteps (ঐচ্ছিক) — Draw-এর DrawStairFlight এ
 * এগুলো ইতিমধ্যে ছিল (elevation হিসাবের জন্য mapStair() ব্যবহারও করত),
 * কিন্তু আগে StairElement এ কখনো বসানো হতো না — ২০২৬-০৮ গ্যাপ-ক্লোজিং
 * পাসে এখন সরাসরি mapStair() থেকে বসে। undefined শুধু তখনই হয় যখন
 * element manual-create হয়েছে (import থেকে না) বা কোনো পুরনো
 * import-এর re-sync হয়নি — এই fallback path-এ deriveStairSelfWeightLoads()
 * শুধু waist-slab flat weight ধরে (warning সহ), StairDesignPanel.tsx
 * এ ইঞ্জিনিয়ার override/set করতে পারেন (SlabElement.liveLoadOverride
 * এর ঠিক একই ঐচ্ছিক-override প্যাটার্ন)।
 */
export interface StairElement extends AreaElement {
  category: "stair";
  riserHeightM?: number;
  numberOfSteps?: number;
}

/**
 * Parapet — ছাদের কিনারায় বসা নিচু guard-rail wall। Wall-এর মতোই
 * AreaElement (vertices + thickness — mapParapet() দেখুন,
 * hub-geometry-parser.ts), কিন্তু আলাদা category, কারণ:
 *   (১) এটা lateral-load-resisting সিস্টেমের অংশ না (Wall-এর thickness
 *       review-threshold logic এখানে প্রযোজ্য না — parapet কখনো
 *       shear-wall candidate না, তাই review-recommended thickness
 *       warning এখানে যোগ হয় না),
 *   (২) এর নিজস্ব base floor level-এ না, ছাদের উপরে — তাই Wall-এর
 *       মতো শুধু storyId base elevation থেকে vertices বসালে হয় না,
 *       নিজস্ব `elevation` (মিটার, floor level থেকে) দরকার হয়
 *       (DrawParapetGeometry-র সাথে মেলানো, hub-module-shapes.ts)।
 * এই v1-এ শুধু self-weight/dead-load contribution-এর জন্য মডেল করা
 * হয়েছে (deriveAreaSelfWeightLoads.ts) — wind/seismic-এ parapet-এর
 * নিজস্ব ভূমিকা (যেমন wind suction on a roof-edge guard-rail) এই
 * scope-এ ধরা হয়নি, ভবিষ্যতে দরকার হলে আলাদা design check হিসেবে
 * যোগ করা যাবে।
 */
export interface ParapetElement extends AreaElement {
  category: "parapet";
  elevation: number; // মিটার — floor level থেকে parapet-এর নিজস্ব base (roof-এর উপরে বসে)
}

/**
 * Stair Landing — দুই flight-এর মাঝের mid-run প্ল্যাটফর্ম (Draw-এর
 * deriveStairLandings() এর `kind: 'turn'` — 'bottom'/'top' landing এই
 * App এ import হয় না, DrawStairLandingGeometry কমেন্টে কারণ ব্যাখ্যা
 * করা আছে, hub-module-shapes.ts)। জ্যামিতিকভাবে Slab-এর মতোই
 * horizontal AreaElement (boundary polygon + thickness), Parapet-এর
 * মতো নিজস্ব `elevation` দরকার (storyId base elevation থেকে, Draw-এর
 * StairLanding.elevation অনুযায়ী — যা stair-এর নিজস্ব floor level
 * থেকে মাপা, সেই stair যে flight-এর সাথে যুক্ত সেই flight-এরই
 * base elevation-এর সমান রেফারেন্স ব্যবহার করে, mapStairLanding()
 * দেখুন)।
 *
 * Stair-এর মতোই self-weight/dead-load contribution-এর জন্য মডেল করা
 * হয়েছে (deriveAreaSelfWeightLoads.ts এ, Stair-এর inclined-slope
 * বিশেষ formula দরকার নেই বলে flat-area formula-ই সরাসরি প্রযোজ্য) —
 * নিজস্ব flexural design module এই v1-এ নেই (RC Slab design panel-এই
 * ম্যানুয়ালি ডিজাইন করা যাবে, একটা সাধারণ flat slab হিসেবে)।
 */
export interface LandingElement extends AreaElement {
  category: "stair-landing";
  elevation: number; // মিটার — floor level থেকে landing-এর নিজস্ব base
}

/** Isolated Footing — একটা পয়েন্টে বসে, নিজস্ব plan dimension ও thickness থাকে। */
export interface FootingElement extends BaseElement {
  category: "footing";
  location: Point3D; // ফুটিং-এর কেন্দ্রবিন্দু
  width: number; // mm, plan dimension (X-দিকে)
  length: number; // mm, plan dimension (Z-দিকে)
  thickness: number; // mm
}

/**
 * Combined Footing — Phase 7a। দুটো কলাম (সাধারণত একটা প্রপার্টি লাইন
 * বা কাছাকাছি দূরত্বে থাকা কলামের জন্য, যেখানে আলাদা isolated footing
 * ওভারল্যাপ করে ফেলত) একটাই rectangular footing-এ বহন করে। Footing-এর
 * নিজস্ব দুই প্রান্ত বিন্দু (columnALocation/columnBLocation) দিয়ে
 * সংজ্ঞায়িত — isolated footing-এর মতো একক center point না, কারণ
 * combined footing-এর geometry দুই কলামের অবস্থান ও তাদের মধ্যে
 * spacing-এর উপর নির্ভরশীল। Plan dimension (width/length) sizing
 * ক্যালকুলেশনের আউটপুট হিসেবে আসে (combinedFootingSizing.ts), তাই
 * isolated FootingElement-এর মতো ইঞ্জিনিয়ার-ইনপুট width/length ফিল্ড
 * এখানে নেই — শুধু thickness element property হিসেবে থাকে।
 */
export interface CombinedFootingElement extends BaseElement {
  category: "combined-footing";
  columnALocation: Point3D;
  columnBLocation: Point3D;
  thickness: number; // mm
}

/**
 * Strip/Continuous Footing — Phase 7b। একটা wall বা কলামের সারির
 * নিচে চলা continuous footing, দুই প্রান্ত বিন্দু দিয়ে সংজ্ঞায়িত
 * (LineElement এর মতো জ্যামিতিকভাবে, কিন্তু sectionId/
 * connectionType নেই কারণ এটা কোনো frame member না — Footing
 * category-র মতোই material+geometry-driven)। width sizing calculation
 * থেকে আসে (per-meter-run bearing check), তাই ইঞ্জিনিয়ার-ইনপুট width
 * ফিল্ড এখানে রাখা হয়নি — শুধু thickness element property হিসেবে
 * থাকে, ঠিক CombinedFootingElement-এর প্যাটার্নে।
 */
export interface StripFootingElement extends BaseElement {
  category: "strip-footing";
  startPoint: Point3D;
  endPoint: Point3D;
  thickness: number; // mm
}

/**
 * Mat/Raft Foundation — Phase 7c। AreaElement-এর মতোই polygon
 * vertices দিয়ে সংজ্ঞায়িত (Slab-এর জন্য ব্যবহৃত একই geometry ভিত্তি),
 * কারণ mat/raft একটা বড়, পুরো ভবনের নিচে বিছানো slab-সদৃশ ফাউন্ডেশন।
 * আলাদা category রাখা হয়েছে (Slab-এর সাথে না মিশিয়ে) কারণ design
 * checks সম্পূর্ণ ভিন্ন (soil bearing rigid-method pressure
 * distribution, punching shear প্রতিটা কলামের নিচে, ইত্যাদি) এবং
 * storyId কখনো প্রযোজ্য না (mat সবসময় base level-এ)। rigid-method
 * পদ্ধতি ব্যবহার করা হয়েছে (uniform বা linear-eccentric pressure) —
 * FE shell stress recovery এখনো নেই (Phase 4a সীমাবদ্ধতা), তাই
 * flexible-mat (beam-on-elastic-foundation) মডেল সম্ভব না।
 */
export interface MatFoundationElement extends BaseElement {
  category: "mat-foundation";
  vertices: Point3D[]; // ন্যূনতম ৩টা পয়েন্ট, XZ প্লেনে polygon
  thickness: number; // mm
}

/**
 * Pile Group — Phase 7d। একাধিক pile-এর একটা নিয়মিত (uniform-spacing)
 * rectangular গ্রিড, একটা centroid বিন্দু দিয়ে সংজ্ঞায়িত (individual
 * pile-এর geometry এখানে duplicate করা হয়নি — group-এর rows/columns/
 * spacing/pile dimension থেকেই প্রতিটা pile-এর অবস্থান derive করা
 * যায়, Design panel-এ pileGroupCapacity.ts এর মাধ্যমে)। এটা একটা
 * সরলীকরণ — অনিয়মিত (non-grid) pile arrangement এই v1-এ সমর্থিত না,
 * কারণ বেশিরভাগ ব্যবহারিক pile group নিয়মিত গ্রিডেই ডিজাইন করা হয়।
 * embeddedLengthMm ও pile shape/dimension সব pile-এর জন্য অভিন্ন ধরা
 * হয়েছে (mixed-length বা mixed-diameter group সমর্থিত না)।
 */
export interface PileGroupElement extends BaseElement {
  category: "pile-group";
  centroidLocation: Point3D; // pile cap বটম লেভেলে group-এর কেন্দ্র
  pileShape: "circular" | "square";
  pileDiameterOrWidthMm: number;
  embeddedLengthMm: number;
  pileSpacingCenterToCenterMm: number;
  numberOfRows: number; // Z-দিকে (local)
  numberOfColumns: number; // X-দিকে (local)
}

/**
 * Pile Cap — Phase 7d। FootingElement-এর মতো একটা point element
 * (একটা কেন্দ্রবিন্দুতে বসে, নিজস্ব width/length dimension থাকে) —
 * isolated footing-এর geometry প্যাটার্ন পুনঃব্যবহার করা হয়েছে কারণ
 * pile cap ও isolated footing উভয়ই rectangular plan, single-location
 * ভিত্তিক ফাউন্ডেশন এলিমেন্ট। pileGroupId দিয়ে সংশ্লিষ্ট PileGroupElement-কে
 * রেফারেন্স করে (একটা pile cap ঠিক একটা pile group বহন করে — একাধিক
 * pile group শেয়ার করা কোনো cap এই v1-এ সমর্থিত না, সেটা কার্যত mat
 * foundation-এর মতো একটা আলাদা সমস্যা)।
 */
export interface PileCapElement extends BaseElement {
  category: "pile-cap";
  location: Point3D;
  width: number; // mm
  length: number; // mm
  thickness: number; // mm
  pileGroupId: string;
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
  | StairElement
  | LandingElement
  | ParapetElement
  | FootingElement
  | CombinedFootingElement
  | StripFootingElement
  | MatFoundationElement
  | PileGroupElement
  | PileCapElement;

/** দুটো পয়েন্টের মধ্যে দূরত্ব (Beam/Column এর length হিসাব করতে কাজে লাগে)। */
export function distanceBetweenPoints(a: Point3D, b: Point3D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

/**
 * Beam/Column/Brace/Pile এর length (মিটারে, যেহেতু grid/story কোঅর্ডিনেট
 * মিটারে)। চারটাই LineElement (startPoint/endPoint), তাই একই ফাংশন
 * প্রযোজ্য — আগে parameter type শুধু Beam/Column এ সীমিত ছিল (কোনো
 * real geometric কারণ ছাড়াই, শুধু তখন পর্যন্ত ব্যবহার না হওয়ায়), Brace/
 * Pile self-weight যোগ করার সময় (deriveSelfWeightLoads.ts, ২০২৬-০৮)
 * এই সীমাবদ্ধতা সরানো হলো।
 */
export function computeLineElementLength(element: BeamElement | ColumnElement | BraceElement | PileElement): number {
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

/**
 * Newell's method — polygon যেই সমতলে থাকুক না কেন (অনুভূমিক Slab,
 * উল্লম্ব Wall/ShearWall/CoreWall, বা tilted Stair waist-slab) সঠিক
 * surface area দেয়, কারণ এটা XZ বা কোনো নির্দিষ্ট অক্ষ-জোড়ায় প্রজেক্ট
 * না করে পুরো 3D normal vector-এর ম্যাগনিচিউড থেকে area বের করে
 * (XZ-অনুভূমিক polygon-এ এটা computePolygonPlanArea()-এর মতোই ফলাফল
 * দেয়, কারণ তখন normal vector শুধু Y-দিকে থাকে)।
 *
 * modelChecker.ts-এ এই একই ফর্মুলা zero-area geometry validation-এর
 * জন্য আগে থেকেই ছিল (একটা লোকাল, non-exported ফাংশন হিসেবে) — এখানে
 * একটা শেয়ার্ড, exported সংস্করণ হিসেবে তোলা হলো যাতে সত্যিকারের area
 * হিসাব দরকার এমন জায়গা (যেমন stair waist-slab self-weight
 * derivation, deriveStairSelfWeightLoads.ts দেখুন) computePolygonPlanArea()
 * এর ভুল XZ-projection ব্যবহার না করে এটা ব্যবহার করতে পারে।
 */
export function computePolygonAreaAnyPlane(vertices: Point3D[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < vertices.length; i++) {
    const cur = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    nx += (cur.y - next.y) * (cur.z + next.z);
    ny += (cur.z - next.z) * (cur.x + next.x);
    nz += (cur.x - next.x) * (cur.y + next.y);
  }
  return Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
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

/**
 * নতুন Combined Footing তৈরির হেল্পার। storyId নেই (isolated
 * FootingElement-এর মতোই base level-এ বসে, কোনো story-র elevation-এ
 * না)।
 */
export function createCombinedFooting(params: {
  label: string;
  materialId: string;
  columnALocation: Point3D;
  columnBLocation: Point3D;
  thickness: number;
}): CombinedFootingElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "combined-footing",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Strip Footing তৈরির হেল্পার। storyId নেই (footing base
 * level-এ বসে)।
 */
export function createStripFooting(params: {
  label: string;
  materialId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  thickness: number;
}): StripFootingElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "strip-footing",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Mat/Raft Foundation তৈরির হেল্পার। storyId নেই (base level-এ
 * বসে)।
 */
export function createMatFoundation(params: {
  label: string;
  materialId: string;
  vertices: Point3D[];
  thickness: number;
}): MatFoundationElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "mat-foundation",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Pile Group তৈরির হেল্পার। storyId নেই (foundation, base
 * level-এর নিচে)।
 */
export function createPileGroup(params: {
  label: string;
  materialId: string;
  centroidLocation: Point3D;
  pileShape: "circular" | "square";
  pileDiameterOrWidthMm: number;
  embeddedLengthMm: number;
  pileSpacingCenterToCenterMm: number;
  numberOfRows: number;
  numberOfColumns: number;
}): PileGroupElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "pile-group",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * নতুন Pile Cap তৈরির হেল্পার। storyId নেই (base level-এ বসে)।
 */
export function createPileCap(params: {
  label: string;
  materialId: string;
  location: Point3D;
  width: number;
  length: number;
  thickness: number;
  pileGroupId: string;
}): PileCapElement {
  const now = new Date().toISOString();
  return {
    elementId: makeElementId(),
    category: "pile-cap",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}
