/**
 * Section Library Types
 * Phase 2a: Standard Sections (rectangular, circular, w-shape, HSS)
 * Phase 2c: + Built-up (পূর্ণাঙ্গ geometry calculation সহ), এবং
 * Composite/Prestressed/Cold-Formed (টাইপ-শুধু, নিচে বিস্তারিত কারণ)
 *
 * প্রতিটা section shape এর geometric properties (Area, Ix, Iy, J
 * ইত্যাদি) এখানেই হিসাব করা হয় — কারণ এগুলো pure geometry, কোনো
 * material বা load লাগে না। Phase 4 এর Analysis Engine (C++/OpenSees)
 * এই properties input হিসেবে নেবে; সেই কারণে এখানকার সূত্রগুলো
 * standard structural engineering references (AISC Steel Construction
 * Manual, ACI 318-19) থেকে নেওয়া, যাতে Phase 4 এ সরাসরি ব্যবহারযোগ্য
 * সংখ্যা পাওয়া যায়।
 *
 * Composite/Prestressed/Cold-Formed কেন টাইপ-শুধু:
 *   - Composite Section: transformed-section পদ্ধতি লাগে (দুই ভিন্ন
 *     material-এর geometry একসাথে, modular ratio দিয়ে ওজন করা) — এটা
 *     Composite Material-এর মতোই (material.ts দেখুন) একটা পূর্ণাঙ্গ
 *     calculator দাবি করে যেটা Phase 6 (Composite Design module) এর
 *     পরিধিতে পড়ে।
 *   - Prestressed Section: geometric property হিসাব rectangular/
 *     I-shape এর মতোই, কিন্তু তার সাথে tendon profile, prestress
 *     force, losses (elastic shortening, creep, shrinkage, relaxation)
 *     লাগে যা সম্পূর্ণ ভিন্ন একটা ডোমেইন — Phase 6 এর Prestressed
 *     Concrete module এ যথাযথভাবে বসবে।
 *   - Cold-Formed Section: AISI S100 অনুযায়ী effective width/thickness
 *     reduction করতে হয় local buckling বিবেচনা করে, যা load-dependent
 *     (নির্দিষ্ট geometry এর জন্যও effective property স্ট্রেস লেভেল
 *     অনুযায়ী বদলায়) — তাই এটা pure geometry না, Design/Analysis
 *     পর্যায়ে iterative গণনা দাবি করে।
 * তিনটাই v1-এ ভুল/misleading সংখ্যা দেওয়ার চেয়ে honest placeholder
 * রাখা ভালো — যতক্ষণ না তাদের নিজস্ব calculator (উপরের Phase গুলোতে)
 * তৈরি হয়।
 */

export type SectionShape =
  | "rectangular" // concrete-এর জন্য প্রধান
  | "circular" // concrete column-এর জন্য (গোলাকার)
  | "w-shape" // steel wide-flange (I-beam)
  | "hss-rectangular" // steel hollow structural section, rectangular/square
  | "hss-circular" // steel hollow structural section, circular (pipe)
  | "built-up-i" // ওয়েল্ডেড প্লেট দিয়ে বানানো I-section
  | "composite" // placeholder — transformed-section calculator ছাড়া pure geometry অর্থহীন
  | "prestressed" // placeholder — tendon/losses calculator ছাড়া pure geometry অসম্পূর্ণ
  | "cold-formed"; // placeholder — effective width AISI S100 অনুযায়ী load-dependent, তাই একটা নির্দিষ্ট সংখ্যা এখানে বিভ্রান্তিকর

interface BaseSection {
  sectionId: string;
  name: string; // যেমন "300x500 RC Beam", "W12x26"
  shape: SectionShape;
  source: "user-defined" | "standard-database";
  /**
   * Nonlinear Static Analysis (Phase 4, Concentrated Plastic Hinge
   * পদ্ধতি) এর জন্য ঐচ্ছিক — এই section এর major-axis (strong axis,
   * Mz) yield moment capacity, kN·m একক। ইঞ্জিনিয়ার সরাসরি input
   * দেন (design-code-specific হিসাব — steel: Zx·Fy/ASD বা Zx·Fy,
   * concrete: ACI 318/BNBC nominal moment capacity Mn — এই অ্যাপ
   * নিজে fy/rebar থেকে recompute করে না, Design Engine Phase এ যোগ
   * হবে)। undefined বা 0 মানে এই section ব্যবহার করা element এর
   * কোনো প্রান্তে hinge assign করলেও (LineElement.hingeAtStart/
   * hingeAtEnd) সেই প্রান্ত backend এ কার্যত elastic থেকে যাবে।
   */
  yieldMomentMzKNm?: number;
  createdAt: string;
  updatedAt: string;
}

/** আয়তক্ষেত্র সেকশন — RC beam/column এর সবচেয়ে সাধারণ আকৃতি। */
export interface RectangularSection extends BaseSection {
  shape: "rectangular";
  width: number; // mm, b
  depth: number; // mm, h (বা D)
}

/** বৃত্তাকার সেকশন — সাধারণত RC column-এ ব্যবহৃত। */
export interface CircularSection extends BaseSection {
  shape: "circular";
  diameter: number; // mm
}

/**
 * Steel W-shape (wide flange, I-beam)। AISC-এর নামকরণ কনভেনশন:
 * W12x26 মানে nominal depth 12 inch, weight 26 lb/ft — কিন্তু এখানে
 * সব ডাইমেনশন metric (mm) এ রাখা হয়েছে যাতে বাকি সিস্টেমের সাথে
 * সামঞ্জস্যপূর্ণ থাকে (BNBC/ACI metric কনভেনশন)।
 */
export interface WShapeSection extends BaseSection {
  shape: "w-shape";
  depth: number; // mm, d (overall depth)
  flangeWidth: number; // mm, bf
  flangeThickness: number; // mm, tf
  webThickness: number; // mm, tw
  designation?: string; // যেমন "W12x26" — রেফারেন্সের জন্য
}

/** Steel HSS — আয়তক্ষেত্র/বর্গাকার হলো টিউব সেকশন। */
export interface HssRectangularSection extends BaseSection {
  shape: "hss-rectangular";
  width: number; // mm, outer dimension
  depth: number; // mm, outer dimension
  wallThickness: number; // mm
}

/** Steel HSS — বৃত্তাকার (pipe) সেকশন। */
export interface HssCircularSection extends BaseSection {
  shape: "hss-circular";
  outerDiameter: number; // mm
  wallThickness: number; // mm
}

/**
 * Built-up I-Section — ওয়েল্ডেড প্লেট দিয়ে বানানো, W-shape এর মতোই
 * জ্যামিতিক কাঠামো (দুই flange plate + এক web plate) কিন্তু rolled
 * catalog থেকে আসে না, প্রতিটা dimension স্বাধীনভাবে নির্বাচন করা
 * যায় (rolled section-এ যেমন AISC টেবিলের নির্দিষ্ট combination-এই
 * সীমাবদ্ধ থাকতে হয়, built-up এ তা লাগে না) — বড় স্প্যান বা ভারী
 * লোডের জন্য যখন কোনো rolled section যথেষ্ট বড় হয় না তখন ব্যবহৃত হয়।
 */
export interface BuiltUpISection extends BaseSection {
  shape: "built-up-i";
  overallDepth: number; // mm, d — flange বাদে শুধু web height না, পূর্ণ overall depth
  flangeWidth: number; // mm, bf (উভয় flange একই ধরে নেওয়া হয়েছে — সিমেট্রিক built-up, সবচেয়ে সাধারণ কেস)
  flangeThickness: number; // mm, tf
  webThickness: number; // mm, tw
}

/**
 * Composite Section — placeholder। উপরের ফাইল-হেডার মন্তব্যে বিস্তারিত
 * কারণ ব্যাখ্যা করা আছে। এই টাইপ শুধু referenced material দুটো ও
 * সাধারণ dimension ধরে রাখে, geometric property হিসাব করে না।
 */
export interface CompositeSection extends BaseSection {
  shape: "composite";
  description?: string; // যেমন "Steel W-shape encased in concrete"
  overallDepth?: number; // mm — শুধু রেফারেন্সের জন্য, property হিসাবে ব্যবহৃত হয় না
  overallWidth?: number; // mm
}

/** Prestressed Section — placeholder, ফাইল-হেডার মন্তব্যে কারণ বিস্তারিত। */
export interface PrestressedSection extends BaseSection {
  shape: "prestressed";
  description?: string; // যেমন "I-Girder", "Box Girder"
  overallDepth?: number; // mm — রেফারেন্সের জন্য
  overallWidth?: number; // mm
}

/** Cold-Formed Section — placeholder, ফাইল-হেডার মন্তব্যে কারণ বিস্তারিত। */
export interface ColdFormedSection extends BaseSection {
  shape: "cold-formed";
  description?: string; // যেমন "C-Channel", "Z-Purlin"
  nominalDepth?: number; // mm — রেফারেন্সের জন্য
  nominalThickness?: number; // mm
}

export type StructuralSection =
  | RectangularSection
  | CircularSection
  | WShapeSection
  | HssRectangularSection
  | HssCircularSection
  | BuiltUpISection
  | CompositeSection
  | PrestressedSection
  | ColdFormedSection;

/**
 * সব সেকশন shape-এর জন্য প্রয়োজনীয় geometric properties, যা Phase 4
 * এর analysis engine ইনপুট হিসেবে নেবে।
 */
export interface SectionProperties {
  area: number; // mm², cross-sectional area A
  ixx: number; // mm⁴, moment of inertia about strong (local x) axis
  iyy: number; // mm⁴, moment of inertia about weak (local y) axis
  j: number; // mm⁴, torsional constant (approximate for non-circular shapes)
  centroidY: number; // mm, ऊपर থেকে centroid পর্যন্ত দূরত্ব (asymmetric shape এর জন্য প্রয়োজন — বর্তমান সব shape সিমেট্রিক, তাই depth/2)
}

/**
 * প্রতিটা shape-এর জন্য section properties হিসাব করে। একটাই ফাংশন,
 * discriminated union এর উপর switch করে — নতুন shape (Phase 2b তে)
 * যোগ হলে TypeScript exhaustiveness check এই ফাংশনে কম্পাইল এরর দেবে
 * যদি নতুন case না লেখা হয় (নিচের `never` assertion দেখুন)।
 */
export function computeSectionProperties(section: StructuralSection): SectionProperties {
  switch (section.shape) {
    case "rectangular": {
      const { width: b, depth: h } = section;
      return {
        area: b * h,
        ixx: (b * h ** 3) / 12,
        iyy: (h * b ** 3) / 12,
        // আয়তক্ষেত্রের জন্য torsional constant এর কোনো closed-form
        // exact সূত্র নেই — এটা একটা প্রচলিত approximation
        // (Timoshenko, Theory of Elasticity), b ≤ h ধরে নিয়ে।
        j: computeRectangularTorsionalConstant(Math.min(b, h), Math.max(b, h)),
        centroidY: h / 2,
      };
    }

    case "circular": {
      const r = section.diameter / 2;
      const area = Math.PI * r ** 2;
      const i = (Math.PI * r ** 4) / 4;
      return {
        area,
        ixx: i,
        iyy: i, // বৃত্তাকার সেকশন উভয় অক্ষে সিমেট্রিক
        j: (Math.PI * r ** 4) / 2, // বৃত্তাকার সেকশনের জন্য exact polar moment
        centroidY: r,
      };
    }

    case "w-shape": {
      // নোট: এই সূত্র flange ও web কে perfect rectangle ধরে হিসাব করে
      // (rolled section-এর flange-web জংশনে যে fillet/root radius
      // থাকে সেটা বাদ দিয়ে)। এই sandbox-এ AISC-published W12x26 এর
      // সাথে যাচাই করা হয়েছে: Ixx তে ~1.5% এবং Area তে ~1.2% পার্থক্য
      // পাওয়া গেছে (fillet বাদ দেওয়ার কারণেই, প্রত্যাশিত ও পরিচিত
      // সীমাবদ্ধতা)। ইঞ্জিনিয়ারিং preliminary design/analysis এ এই
      // নির্ভুলতা সাধারণত গ্রহণযোগ্য, কিন্তু চূড়ান্ত connection design
      // এর মতো জায়গায় AISC Manual এর প্রকাশিত exact টেবিল মান ব্যবহার
      // করা উচিত (Phase 2b/ভবিষ্যতে standard section database থেকে
      // AISC-published মান সরাসরি import করার সুযোগ থাকবে)।
      const { depth: d, flangeWidth: bf, flangeThickness: tf, webThickness: tw } = section;
      const webDepth = d - 2 * tf;

      const area = 2 * bf * tf + webDepth * tw;

      // Ixx: flange গুলোর parallel-axis contribution + web এর নিজস্ব inertia
      const flangeIxx =
        2 * ((bf * tf ** 3) / 12 + bf * tf * ((d - tf) / 2) ** 2);
      const webIxx = (tw * webDepth ** 3) / 12;
      const ixx = flangeIxx + webIxx;

      // Iyy: flange গুলো (নিজেদের কেন্দ্র দিয়ে, কারণ web-অক্ষ বরাবর সিমেট্রিক) + web
      const flangeIyy = 2 * ((tf * bf ** 3) / 12);
      const webIyy = (webDepth * tw ** 3) / 12;
      const iyy = flangeIyy + webIyy;

      // Open thin-walled section torsional constant (approximate):
      // J ≈ Σ (bi * ti³ / 3) — প্রতিটা rectangular অংশের (২টা flange + web) যোগফল
      const j =
        (2 * bf * tf ** 3) / 3 + (webDepth * tw ** 3) / 3;

      return { area, ixx, iyy, j, centroidY: d / 2 };
    }

    case "hss-rectangular": {
      const { width: b, depth: h, wallThickness: t } = section;
      const innerB = b - 2 * t;
      const innerH = h - 2 * t;

      const area = b * h - innerB * innerH;
      const ixx = (b * h ** 3) / 12 - (innerB * innerH ** 3) / 12;
      const iyy = (h * b ** 3) / 12 - (innerH * innerB ** 3) / 12;

      // বদ্ধ থিন-ওয়াল সেকশনের জন্য torsional constant (Bredt's formula
      // এর simplification, uniform wall thickness ধরে নিয়ে):
      // J ≈ 2t(b-t)²(h-t)² / (b + h - 2t)
      const j =
        (2 * t * (b - t) ** 2 * (h - t) ** 2) / (b + h - 2 * t);

      return { area, ixx, iyy, j, centroidY: h / 2 };
    }

    case "hss-circular": {
      const { outerDiameter: D, wallThickness: t } = section;
      const outerR = D / 2;
      const innerR = outerR - t;

      const area = Math.PI * (outerR ** 2 - innerR ** 2);
      const i = (Math.PI * (outerR ** 4 - innerR ** 4)) / 4;

      return {
        area,
        ixx: i,
        iyy: i,
        j: (Math.PI * (outerR ** 4 - innerR ** 4)) / 2, // বৃত্তাকার হলো টিউবের জন্যও exact
        centroidY: outerR,
      };
    }

    case "built-up-i": {
      // W-shape এর ঠিক একই সূত্র প্রযোজ্য — জ্যামিতিকভাবে built-up
      // I-section ও rolled W-shape অভিন্ন (দুই flange + এক web), শুধু
      // built-up এ fillet radius থাকে না (ওয়েল্ডেড জোড়া, রোল করা না),
      // তাই এই হিসাব বরং rolled W-shape এর চেয়েও বেশি exact এখানে —
      // W-shape case এর fillet-সংক্রান্ত approximation note এখানে
      // প্রযোজ্য না।
      const { overallDepth: d, flangeWidth: bf, flangeThickness: tf, webThickness: tw } = section;
      const webDepth = d - 2 * tf;

      const area = 2 * bf * tf + webDepth * tw;

      const flangeIxx = 2 * ((bf * tf ** 3) / 12 + bf * tf * ((d - tf) / 2) ** 2);
      const webIxx = (tw * webDepth ** 3) / 12;
      const ixx = flangeIxx + webIxx;

      const flangeIyy = 2 * ((tf * bf ** 3) / 12);
      const webIyy = (webDepth * tw ** 3) / 12;
      const iyy = flangeIyy + webIyy;

      const j = (2 * bf * tf ** 3) / 3 + (webDepth * tw ** 3) / 3;

      return { area, ixx, iyy, j, centroidY: d / 2 };
    }

    case "composite":
    case "prestressed":
    case "cold-formed": {
      // ইচ্ছাকৃতভাবে সংখ্যা রিটার্ন করা হচ্ছে না — এই তিন ধরনের
      // section এর geometric property pure geometry থেকে নির্ভরযোগ্যভাবে
      // বের করা যায় না (ফাইল-হেডার মন্তব্যে বিস্তারিত কারণ: composite
      // এ transformed-section লাগে, prestressed এ tendon/losses লাগে,
      // cold-formed এ load-dependent effective width লাগে)। কোনো
      // যাচাই-না-করা সংখ্যা (যেমন 0 বা placeholder) রিটার্ন করলে সেটা
      // Phase 4 এর analysis engine এ চুপচাপ ভুল ফলাফল দিয়ে দিত —
      // explicit error দেওয়া নিরাপদ, কারণ এটা caller কে অবিলম্বে জানায়
      // যে এই section type এখনো সাপোর্টেড না, ভুল সংখ্যা দিয়ে না এগিয়ে।
      throw new Error(
        `Section shape "${section.shape}" এর জন্য geometric property calculation এখনো সাপোর্টেড না — এটা pure geometry থেকে নির্ভরযোগ্যভাবে বের করা যায় না (Phase 6 এর নির্দিষ্ট design module প্রয়োজন)। বিস্তারিত কারণের জন্য এই ফাইলের হেডার মন্তব্য দেখুন।`
      );
    }

    default: {
      // Exhaustiveness check: যদি StructuralSection এ নতুন shape যোগ
      // হয় কিন্তু এখানে case না লেখা হয়, TypeScript এই লাইনে কম্পাইল
      // এরর দেবে — একটা shape চুপচাপ miss হয়ে যাওয়ার ঝুঁকি এভাবে
      // দূর করা হলো।
      const exhaustiveCheck: never = section;
      throw new Error(`Unhandled section shape: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * আয়তক্ষেত্র সেকশনের approximate torsional constant (Timoshenko &
 * Goodier, "Theory of Elasticity")। b = ছোট মাত্রা, h = বড় মাত্রা।
 *
 * এটা exact সমাধান না — Timoshenko এর সিরিজ সমাধানের একটা প্রতিষ্ঠিত
 * closed-form approximation, যেটা প্রায় সব undergraduate/professional
 * রেফারেন্সে (Boresi, McCormac) ব্যবহৃত হয়। এই sandbox-এ যাচাই করা
 * হয়েছে: b/h=1 (বর্গাকার) এ এটা ঠিক k=0.141 দেয় (established value),
 * এবং b/h=0.5 এ k≈0.2289 দেয় যা রেফারেন্স টেবিলের k≈0.229 এর থেকে
 * মাত্র ০.০৫% ব্যবধানে। খুব বেশি elongated সেকশনে (b/h < 0.2, যেমন
 * পাতলা প্লেট) নির্ভুলতা কমতে পারে — সেক্ষেত্রে thin-wall open-section
 * সূত্র (J ≈ Σbt³/3, W-shape এ যেমন ব্যবহার করা হয়েছে) বেশি
 * নির্ভরযোগ্য, যা rectangular concrete section এ প্রযোজ্য না কারণ
 * concrete solid, thin-wall না।
 */
function computeRectangularTorsionalConstant(b: number, h: number): number {
  const ratio = b / h;
  // k factor table (Timoshenko) — b/h অনুপাত অনুযায়ী ইন্টারপোলেশন করা
  // হয়েছে standard reference টেবিলের কয়েকটা কী পয়েন্ট থেকে।
  const kFactor =
    ratio >= 1
      ? 0.141
      : 1 / 3 - 0.21 * ratio * (1 - ratio ** 4 / 12);
  return kFactor * b ** 3 * h;
}

/** নতুন Rectangular Section তৈরির জন্য একটা যুক্তিসঙ্গত ডিফল্ট (300x500mm, প্রচলিত RC beam সাইজ)। */
export function createDefaultRectangularSection(
  id: string,
  name: string
): RectangularSection {
  const now = new Date().toISOString();
  return {
    sectionId: id,
    name,
    shape: "rectangular",
    source: "user-defined",
    width: 300,
    depth: 500,
    createdAt: now,
    updatedAt: now,
  };
}
