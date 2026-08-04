/**
 * Connection Detail — Bolted / Welded / Base Plate Geometry
 * Phase 10f — Detailing ইঞ্জিনের ষষ্ঠ ধাপ। Phase 6g (boltedConnection.ts,
 * weldedConnection.ts, basePlate.ts) capacity/adequacy CHECK করে (bolt
 * count, weld size, plate dimension — সবই ইঞ্জিনিয়ার-দেওয়া ইনপুট হিসেবে,
 * "এই arrangement কি যথেষ্ট?"), কিন্তু bolt/weld আসলে PLATE-এর কোথায়
 * বসবে তা বলে না। এই ফাইল সেই already-decided arrangement-কে (x,y)
 * জ্যামিতিতে রূপান্তর করে — 10e-এর মতোই প্যাটার্ন (abstract → concrete
 * placement), কিন্তু rebar না, connection hardware-এর জন্য।
 *
 * সীমাবদ্ধতা (v1, ইচ্ছাকৃতভাবে flagged):
 *   - Bolted layout শুধু single vertical line ধরে (সবচেয়ে সাধারণ simple
 *     shear tab/clip angle প্যাটার্ন) — multi-column bolt grid এই v1-এ নেই।
 *   - Welded layout দুই সমান্তরাল প্রান্তে সমান length ভাগ করে (শেয়ার
 *     ট্যাব উভয় পাশে ওয়েল্ড করার সাধারণ প্রথা) — L-shape বা other weld
 *     path এই v1-এ নেই।
 *   - Base plate anchor bolt count ডিফল্ট ৪ (সবচেয়ে প্রচলিত standard
 *     column base প্র্যাকটিস) — 6g নিজেই anchor bolt design করে না
 *     (শুধু plate size/thickness), তাই count/edge-distance এখানে
 *     ইঞ্জিনিয়ার-ইনপুট, derive করা হয় না।
 *   - Standard bolt hole clearance +2mm (SI প্র্যাকটিসে সাধারণ, AISC-এর
 *     পূর্ণাঙ্গ bolt-size-নির্ভর STD/OVS হোল টেবিল না)।
 */

export interface HolePosition {
  xMm: number;
  yMm: number;
  holeDiameterMm: number;
}

export interface LineSegment {
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
}

const STANDARD_HOLE_CLEARANCE_MM = 2; // SI প্র্যাকটিসের সাধারণ ধারণা, bolt dia + 2mm

// ---------------------------------------------------------------------------
// Bolted shear connection — single vertical line of bolts
// ---------------------------------------------------------------------------
export interface BoltedConnectionLayoutInput {
  numberOfBolts: number;
  boltDiameterMm: number;
  boltSpacingMm: number;
  edgeDistanceMm: number; // প্রথম/শেষ বোল্ট থেকে প্লেটের প্রান্ত পর্যন্ত (উভয় দিকে সমান ধরা হয়েছে)
  plateWidthMm: number;
  plateHeightMm: number;
}

export interface BoltedConnectionLayout {
  plateWidthMm: number;
  plateHeightMm: number;
  holes: HolePosition[];
  warnings: string[];
}

export function computeBoltedConnectionLayout(input: BoltedConnectionLayoutInput): BoltedConnectionLayout {
  const warnings: string[] = [];
  const holes: HolePosition[] = [];
  const xMm = input.plateWidthMm / 2; // একক ভার্টিক্যাল লাইন, প্লেটের কেন্দ্রে

  for (let i = 0; i < input.numberOfBolts; i++) {
    holes.push({
      xMm,
      yMm: input.edgeDistanceMm + i * input.boltSpacingMm,
      holeDiameterMm: input.boltDiameterMm + STANDARD_HOLE_CLEARANCE_MM,
    });
  }

  const requiredHeightMm = 2 * input.edgeDistanceMm + (input.numberOfBolts - 1) * input.boltSpacingMm;
  if (requiredHeightMm > input.plateHeightMm) {
    warnings.push(
      `Bolt group-এর প্রয়োজনীয় উচ্চতা (${requiredHeightMm.toFixed(0)}mm) plate height (${input.plateHeightMm}mm)-এর চেয়ে বেশি — plate বড় করুন।`,
    );
  }

  return { plateWidthMm: input.plateWidthMm, plateHeightMm: input.plateHeightMm, holes, warnings };
}

// ---------------------------------------------------------------------------
// Welded connection — দুই সমান্তরাল প্রান্তে সমান ভাগে weld
// ---------------------------------------------------------------------------
export interface WeldedConnectionLayoutInput {
  weldSizeMm: number;
  weldLengthMm: number; // মোট effective length (উভয় পাশ একসাথে, 6g-এর FilletWeldInput কনভেনশনের সাথে সামঞ্জস্যপূর্ণ)
  plateWidthMm: number;
  plateHeightMm: number;
}

export interface WeldedConnectionLayout {
  plateWidthMm: number;
  plateHeightMm: number;
  weldLines: LineSegment[]; // দুইটা — বাম আর ডান প্রান্ত বরাবর
  weldSizeMm: number;
  warnings: string[];
}

export function computeWeldedConnectionLayout(input: WeldedConnectionLayoutInput): WeldedConnectionLayout {
  const warnings: string[] = [];
  const lengthPerSideMm = input.weldLengthMm / 2;

  if (lengthPerSideMm > input.plateHeightMm) {
    warnings.push(
      `প্রতি পাশে প্রয়োজনীয় weld length (${lengthPerSideMm.toFixed(0)}mm) plate height (${input.plateHeightMm}mm)-এর চেয়ে বেশি — plate বড় করুন অথবা weld size বাড়িয়ে length কমান।`,
    );
  }

  const weldLines: LineSegment[] = [
    { x1Mm: 0, y1Mm: 0, x2Mm: 0, y2Mm: Math.min(lengthPerSideMm, input.plateHeightMm) }, // বাম প্রান্ত
    {
      x1Mm: input.plateWidthMm,
      y1Mm: 0,
      x2Mm: input.plateWidthMm,
      y2Mm: Math.min(lengthPerSideMm, input.plateHeightMm),
    }, // ডান প্রান্ত
  ];

  return { plateWidthMm: input.plateWidthMm, plateHeightMm: input.plateHeightMm, weldLines, weldSizeMm: input.weldSizeMm, warnings };
}

// ---------------------------------------------------------------------------
// Base plate — anchor bolt pattern (৪ কোণা, সবচেয়ে প্রচলিত)
// ---------------------------------------------------------------------------
export interface BasePlateLayoutInput {
  plateLengthMm: number; // N (6g BasePlateResult থেকে)
  plateWidthMm: number; // B
  columnDepthMm: number;
  columnFlangeWidthMm: number;
  anchorBoltDiameterMm: number;
  anchorBoltEdgeDistanceMm: number; // প্লেটের প্রান্ত থেকে anchor bolt কেন্দ্র পর্যন্ত
  anchorBoltCount?: 4; // v1-এ শুধু ৪-বোল্ট কর্নার প্যাটার্ন সাপোর্ট করে
}

export interface BasePlateLayout {
  plateLengthMm: number;
  plateWidthMm: number;
  columnOutline: { xMm: number; yMm: number; widthMm: number; heightMm: number }; // প্লেটের কেন্দ্রে বসানো
  anchorBolts: HolePosition[];
  warnings: string[];
}

export function computeBasePlateLayout(input: BasePlateLayoutInput): BasePlateLayout {
  const warnings: string[] = [];
  const e = input.anchorBoltEdgeDistanceMm;

  const anchorBolts: HolePosition[] = [
    { xMm: e, yMm: e, holeDiameterMm: input.anchorBoltDiameterMm + STANDARD_HOLE_CLEARANCE_MM },
    { xMm: input.plateWidthMm - e, yMm: e, holeDiameterMm: input.anchorBoltDiameterMm + STANDARD_HOLE_CLEARANCE_MM },
    {
      xMm: input.plateWidthMm - e,
      yMm: input.plateLengthMm - e,
      holeDiameterMm: input.anchorBoltDiameterMm + STANDARD_HOLE_CLEARANCE_MM,
    },
    { xMm: e, yMm: input.plateLengthMm - e, holeDiameterMm: input.anchorBoltDiameterMm + STANDARD_HOLE_CLEARANCE_MM },
  ];

  const columnOutline = {
    xMm: (input.plateWidthMm - input.columnFlangeWidthMm) / 2,
    yMm: (input.plateLengthMm - input.columnDepthMm) / 2,
    widthMm: input.columnFlangeWidthMm,
    heightMm: input.columnDepthMm,
  };

  if (columnOutline.xMm < 0 || columnOutline.yMm < 0) {
    warnings.push("Column section plate-এর চেয়ে বড় — plate dimension পুনর্বিবেচনা করুন।");
  }
  // anchor bolt column flange-এর সাথে সংঘর্ষ করছে কিনা একটা সাধারণ চেক
  for (const bolt of anchorBolts) {
    const withinColumnX = bolt.xMm > columnOutline.xMm && bolt.xMm < columnOutline.xMm + columnOutline.widthMm;
    const withinColumnY = bolt.yMm > columnOutline.yMm && bolt.yMm < columnOutline.yMm + columnOutline.heightMm;
    if (withinColumnX && withinColumnY) {
      warnings.push("একটা anchor bolt column footprint-এর ভিতরে পড়ছে — edge distance বাড়ান অথবা plate বড় করুন।");
      break;
    }
  }

  return { plateLengthMm: input.plateLengthMm, plateWidthMm: input.plateWidthMm, columnOutline, anchorBolts, warnings };
}
