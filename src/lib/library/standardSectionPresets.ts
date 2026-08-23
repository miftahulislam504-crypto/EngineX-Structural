/**
 * standardSectionPresets.ts — Standard rectangular section size preset
 * ------------------------------------------------------------------
 * আগে এই preset তালিকাগুলো SectionPanel.tsx (ম্যানুয়াল "Standard Size"
 * dropdown) এর ভেতরেই define করা ছিল। এখন autoAssignSection.ts
 * (Phase: section auto-assign) এই একই preset গুলো span/category
 * ভিত্তিক auto-selection এ ব্যবহার করবে বলে এখানে shared module এ
 * সরানো হলো — দুই জায়গায় duplicate তালিকা রাখলে ভবিষ্যতে একটা বদলালে
 * আরেকটা stale থেকে যাওয়ার ঝুঁকি থাকত।
 *
 * বাংলাদেশে প্রচলিত RC beam/column/footing/slab size (BNBC 2020
 * প্র্যাকটিসে সাধারণত ব্যবহৃত রেঞ্জ)। ম্যানুয়াল ব্যবহারে এগুলো শুধু
 * সুবিধাজনক শুরুর বিন্দু (ইউজার পরে বদলাতে পারেন); auto-assign
 * ব্যবহারে এই তালিকা থেকেই নিকটতম উপযুক্ত size বেছে নেওয়া হয়, তাই
 * auto-assigned section সবসময় এই ডকুমেন্টেড রেঞ্জের মধ্যেই থাকে।
 */

export interface StandardSizePreset {
  id: string;
  label: string; // যেমন "Beam 250×450"
  width: number; // mm
  depth: number; // mm
}

/**
 * Beam প্রিসেট — বাংলাদেশে প্রচলিত রেঞ্জ: width সাধারণত 200-400mm
 * (25mm গ্রিডে), depth 300-750mm (50mm গ্রিডে)। L/12 থেকে L/10
 * span-to-depth অনুপাত অনুযায়ী সাধারণ প্র্যাকটিসে যেসব কম্বিনেশন
 * বাস্তবে ব্যবহৃত হয়, সেগুলোর মোটামুটি পূর্ণ ম্যাট্রিক্স — যাতে
 * কোনো একটা প্রচলিত সাইজ বাদ না পড়ে।
 */
export const STANDARD_BEAM_PRESETS: StandardSizePreset[] = [
  // 200mm width
  { id: "beam-200x300", label: "Beam 200×300", width: 200, depth: 300 },
  { id: "beam-200x350", label: "Beam 200×350", width: 200, depth: 350 },
  { id: "beam-200x400", label: "Beam 200×400", width: 200, depth: 400 },
  { id: "beam-200x450", label: "Beam 200×450", width: 200, depth: 450 },
  // 230mm width
  { id: "beam-230x300", label: "Beam 230×300", width: 230, depth: 300 },
  { id: "beam-230x350", label: "Beam 230×350", width: 230, depth: 350 },
  { id: "beam-230x400", label: "Beam 230×400", width: 230, depth: 400 },
  { id: "beam-230x450", label: "Beam 230×450", width: 230, depth: 450 },
  { id: "beam-230x500", label: "Beam 230×500", width: 230, depth: 500 },
  // 250mm width
  { id: "beam-250x350", label: "Beam 250×350", width: 250, depth: 350 },
  { id: "beam-250x400", label: "Beam 250×400", width: 250, depth: 400 },
  { id: "beam-250x450", label: "Beam 250×450", width: 250, depth: 450 },
  { id: "beam-250x500", label: "Beam 250×500", width: 250, depth: 500 },
  { id: "beam-250x550", label: "Beam 250×550", width: 250, depth: 550 },
  { id: "beam-250x600", label: "Beam 250×600", width: 250, depth: 600 },
  // 300mm width
  { id: "beam-300x400", label: "Beam 300×400", width: 300, depth: 400 },
  { id: "beam-300x450", label: "Beam 300×450", width: 300, depth: 450 },
  { id: "beam-300x500", label: "Beam 300×500", width: 300, depth: 500 },
  { id: "beam-300x550", label: "Beam 300×550", width: 300, depth: 550 },
  { id: "beam-300x600", label: "Beam 300×600", width: 300, depth: 600 },
  { id: "beam-300x650", label: "Beam 300×650", width: 300, depth: 650 },
  { id: "beam-300x700", label: "Beam 300×700", width: 300, depth: 700 },
  // 350mm width
  { id: "beam-350x450", label: "Beam 350×450", width: 350, depth: 450 },
  { id: "beam-350x500", label: "Beam 350×500", width: 350, depth: 500 },
  { id: "beam-350x600", label: "Beam 350×600", width: 350, depth: 600 },
  { id: "beam-350x650", label: "Beam 350×650", width: 350, depth: 650 },
  { id: "beam-350x700", label: "Beam 350×700", width: 350, depth: 700 },
  // 400mm width (transfer beam / ভারী লোড)
  { id: "beam-400x500", label: "Beam 400×500", width: 400, depth: 500 },
  { id: "beam-400x600", label: "Beam 400×600", width: 400, depth: 600 },
  { id: "beam-400x650", label: "Beam 400×650", width: 400, depth: 650 },
  { id: "beam-400x700", label: "Beam 400×700", width: 400, depth: 700 },
  { id: "beam-400x750", label: "Beam 400×750 (transfer beam)", width: 400, depth: 750 },
];

/**
 * Column প্রিসেট — square (সবচেয়ে প্রচলিত) এবং rectangular দুই ধরনই,
 * 200mm থেকে 600mm রেঞ্জে 25/50mm গ্রিডে।
 */
export const STANDARD_COLUMN_PRESETS: StandardSizePreset[] = [
  // Square columns
  { id: "col-200x200", label: "Column 200×200", width: 200, depth: 200 },
  { id: "col-225x225", label: "Column 225×225", width: 225, depth: 225 },
  { id: "col-250x250", label: "Column 250×250", width: 250, depth: 250 },
  { id: "col-275x275", label: "Column 275×275", width: 275, depth: 275 },
  { id: "col-300x300", label: "Column 300×300", width: 300, depth: 300 },
  { id: "col-325x325", label: "Column 325×325", width: 325, depth: 325 },
  { id: "col-350x350", label: "Column 350×350", width: 350, depth: 350 },
  { id: "col-375x375", label: "Column 375×375", width: 375, depth: 375 },
  { id: "col-400x400", label: "Column 400×400", width: 400, depth: 400 },
  { id: "col-450x450", label: "Column 450×450", width: 450, depth: 450 },
  { id: "col-500x500", label: "Column 500×500", width: 500, depth: 500 },
  { id: "col-550x550", label: "Column 550×550", width: 550, depth: 550 },
  { id: "col-600x600", label: "Column 600×600 (ভারী লোড)", width: 600, depth: 600 },
  // Rectangular columns
  { id: "col-250x300", label: "Column 250×300", width: 250, depth: 300 },
  { id: "col-250x350", label: "Column 250×350", width: 250, depth: 350 },
  { id: "col-250x400", label: "Column 250×400", width: 250, depth: 400 },
  { id: "col-300x350", label: "Column 300×350", width: 300, depth: 350 },
  { id: "col-300x400", label: "Column 300×400", width: 300, depth: 400 },
  { id: "col-300x450", label: "Column 300×450", width: 300, depth: 450 },
  { id: "col-300x500", label: "Column 300×500", width: 300, depth: 500 },
  { id: "col-350x450", label: "Column 350×450", width: 350, depth: 450 },
  { id: "col-350x500", label: "Column 350×500", width: 350, depth: 500 },
  { id: "col-400x500", label: "Column 400×500", width: 400, depth: 500 },
  { id: "col-400x600", label: "Column 400×600", width: 400, depth: 600 },
  { id: "col-450x600", label: "Column 450×600 (shear wall-এর কাছাকাছি কলাম)", width: 450, depth: 600 },
];

/** Footing প্রিসেট — isolated footing-এ প্রচলিত রেঞ্জ, 100mm গ্রিডে বিস্তৃত। */
export const STANDARD_FOOTING_PRESETS: StandardSizePreset[] = [
  { id: "foot-900x900", label: "Footing 900×900", width: 900, depth: 900 },
  { id: "foot-1000x1000", label: "Footing 1000×1000", width: 1000, depth: 1000 },
  { id: "foot-1100x1100", label: "Footing 1100×1100", width: 1100, depth: 1100 },
  { id: "foot-1200x1200", label: "Footing 1200×1200", width: 1200, depth: 1200 },
  { id: "foot-1300x1300", label: "Footing 1300×1300", width: 1300, depth: 1300 },
  { id: "foot-1400x1400", label: "Footing 1400×1400", width: 1400, depth: 1400 },
  { id: "foot-1500x1500", label: "Footing 1500×1500", width: 1500, depth: 1500 },
  { id: "foot-1600x1600", label: "Footing 1600×1600", width: 1600, depth: 1600 },
  { id: "foot-1700x1700", label: "Footing 1700×1700", width: 1700, depth: 1700 },
  { id: "foot-1800x1800", label: "Footing 1800×1800", width: 1800, depth: 1800 },
  { id: "foot-2000x2000", label: "Footing 2000×2000", width: 2000, depth: 2000 },
  { id: "foot-2200x2200", label: "Footing 2200×2200", width: 2200, depth: 2200 },
  { id: "foot-2400x2400", label: "Footing 2400×2400", width: 2400, depth: 2400 },
  { id: "foot-2500x2500", label: "Footing 2500×2500 (ভারী লোড)", width: 2500, depth: 2500 },
];

/** Slab প্রিসেট — 1m strip equivalent rectangular section, thickness 100-225mm। */
export const STANDARD_SLAB_PRESETS: StandardSizePreset[] = [
  { id: "slab-1000x100", label: "Slab (100mm thick, 1m strip)", width: 1000, depth: 100 },
  { id: "slab-1000x125", label: "Slab (125mm thick, 1m strip)", width: 1000, depth: 125 },
  { id: "slab-1000x150", label: "Slab (150mm thick, 1m strip)", width: 1000, depth: 150 },
  { id: "slab-1000x175", label: "Slab (175mm thick, 1m strip)", width: 1000, depth: 175 },
  { id: "slab-1000x200", label: "Slab (200mm thick, 1m strip)", width: 1000, depth: 200 },
  { id: "slab-1000x225", label: "Slab (225mm thick, 1m strip — ভারী লোড/ফ্ল্যাট স্ল্যাব)", width: 1000, depth: 225 },
];

/**
 * সব rectangular preset একসাথে গ্রুপ করা — dropdown-এ Beam/Column/
 * Footing/Slab সেকশন হেডিং সহ দেখানোর জন্য। Slab-কে সাধারণত rectangular
 * "section" হিসেবে মডেল করা হয় না (এটা area element), কিন্তু এখানে
 * সুবিধার জন্য 1m-strip equivalent rectangular section হিসেবে দেওয়া
 * হলো — কেউ hand-calculation বা beam-strip পদ্ধতিতে slab ডিজাইন
 * করতে চাইলে কাজে লাগবে।
 */
export const PRESET_GROUPS: { groupLabel: string; presets: StandardSizePreset[] }[] = [
  { groupLabel: "Beam", presets: STANDARD_BEAM_PRESETS },
  { groupLabel: "Column", presets: STANDARD_COLUMN_PRESETS },
  { groupLabel: "Footing", presets: STANDARD_FOOTING_PRESETS },
  { groupLabel: "Slab (1m strip)", presets: STANDARD_SLAB_PRESETS },
];

export const ALL_STANDARD_PRESETS: StandardSizePreset[] = PRESET_GROUPS.flatMap((g) => g.presets);
