/**
 * PDF Theme — Phase 11b
 *
 * Documentation Engine এর সব PDF template (Design Report sections,
 * Calc Sheet, BBS, QC Report, General Notes, Drawing Sheets) এই একই
 * token সেট ব্যবহার করবে, যাতে সব document দেখতে একই "family"-র মনে
 * হয় — আলাদা আলাদা component আলাদা রঙ/ফন্ট বেছে নিলে যেমন হতো তার
 * বিপরীতে।
 *
 * অ্যাপের নিজের UI ("Light Clean" design system — CivilOS ecosystem
 * জুড়ে চলমান migration, Primary #1a56db, Inter, Tailwind gray neutral)
 * থেকে এই token সেট ইচ্ছাকৃতভাবে আলাদা রাখা হলো। কারণ: PDF এখানে একটা
 * প্রিন্ট/ইঞ্জিনিয়ারিং ডকুমেন্ট (client কে দেওয়া হবে, ফাইল করে রাখা
 * হবে, অথরিটি ভেরিফাই করবে) — dark-app UI বা এমনকি "Light Clean" এর
 * soft-brand রঙও এখানে অনুপযুক্ত। প্রথাগত ইঞ্জিনিয়ারিং ড্রয়িং/রিপোর্ট
 * কনভেনশন মেনে চলা হয়েছে: সাদা পাতা, কালো টেক্সট, ন্যূনতম রঙ — শুধু
 * status indication এ (pass/fail/warning) সীমিত সিমান্টিক রঙ।
 */

export const pdfColors = {
  // মূল প্যালেট — কালো/সাদা/গ্রে-ই বেশিরভাগ, ছাপার জন্য নিরাপদ
  ink: "#111111", // প্রধান body text
  inkMuted: "#4b5563", // secondary text, ক্যাপশন, ফুটার
  inkFaint: "#9ca3af", // watermark-স্টাইল হালকা টেক্সট, disabled ফিল্ড
  hairline: "#d1d5db", // টেবিল বর্ডার, সেপারেটর — প্রিন্ট হলে খুব হালকা কালো/গ্রে দেখাবে
  hairlineStrong: "#374151", // titleblock outer border, প্রধান সেকশন ডিভাইডার
  paper: "#ffffff",
  panel: "#f3f4f6", // টেবিল হেডার row, titleblock label cell ব্যাকগ্রাউন্ড

  // সিমান্টিক স্ট্যাটাস — শুধু QC/Validation/Design-check status ও
  // pass/fail ব্যাজে ব্যবহৃত, সাধারণ ডেটার জন্য না
  statusPass: "#15803d",
  statusPassBg: "#f0fdf4",
  statusWarning: "#b45309",
  statusWarningBg: "#fffbeb",
  statusFail: "#b91c1c",
  statusFailBg: "#fef2f2",
  statusInfo: "#1d4ed8",
  statusInfoBg: "#eff6ff",
} as const;

/**
 * @react-pdf/renderer পাঁচটা built-in ফন্ট দিয়ে আসে (Courier,
 * Helvetica, Times-Roman, Symbol, ZapfDingbats) — এগুলো কোনো নেটওয়ার্ক
 * কল ছাড়াই কাজ করে, PDF এ embed হয় standard ভাবে।
 *
 * সিদ্ধান্ত: Google Fonts (Inter ইত্যাদি) remote-register না করে
 * built-in Helvetica/Courier ব্যবহার করা হলো। কারণ react-pdf community
 * তে সুপরিচিত সমস্যা — Google Fonts এর CDN URL সাধারণত WOFF2 সার্ভ
 * করে যেটা react-pdf এ ভালোভাবে সাপোর্টেড না (TTF/OTF দরকার), এবং
 * Font.register() এর ডাউনলোড asynchronous — renderToBuffer()/PDFDownloadLink
 * ফন্ট লোড শেষ হওয়ার আগেই চলতে পারে (কোনো built-in await-font-ready
 * মেকানিজম নেই)। এছাড়া কিছু deployment environment (serverless/restricted
 * network) এ বহিরাগত font CDN এ আউটবাউন্ড রিকোয়েস্ট ব্লক থাকতে পারে।
 * ইঞ্জিনিয়ারিং রিপোর্টের মতো reliability-critical output এর জন্য
 * এই flakiness অগ্রহণযোগ্য — built-in ফন্ট সবসময় নির্ভরযোগ্যভাবে কাজ
 * করে, কোনো network dependency নেই।
 *
 * Helvetica-Bold/Oblique/BoldOblique ভ্যারিয়েন্টও built-in হিসেবে
 * পাওয়া যায় (আলাদা করে register করতে হয় না) — @react-pdf/renderer
 * নিজেই fontWeight/fontStyle prop দেখে সঠিক ভ্যারিয়েন্ট বেছে নেয়।
 */
export const pdfFonts = {
  body: "Helvetica",
  mono: "Courier", // সংখ্যাসূচক টেবিল (BBS, calc sheet) এ tabular alignment এর জন্য monospace ভালো পড়া যায়
} as const;

export const pdfSpacing = {
  pageMarginMm: 15, // A4/A3 উভয়ের জন্য standard margin, titleblock এর জন্য জায়গা রেখে
  sectionGap: 12,
  rowPaddingV: 4,
  rowPaddingH: 6,
} as const;

export const pdfFontSize = {
  h1: 16,
  h2: 12,
  h3: 10,
  body: 9,
  caption: 7.5,
  tableHeader: 8,
  tableBody: 8.5,
} as const;

/**
 * চরিত্র নিরাপত্তা — built-in Helvetica/Courier (উপরের pdfFonts) এ কোন
 * বিশেষ ক্যারেক্টার নিরাপদ, Phase 11c তে actual render (rasterize করে
 * চোখে দেখা, শুধু typecheck না) দিয়ে verify করা হয়েছে:
 *
 *   নিরাপদ (WinAnsiEncoding এ আছে, সঠিকভাবে রেন্ডার হয়): — (em-dash),
 *   – (en-dash), · (middle dot), × (multiplication sign)
 *
 *   ভাঙা (glyph missing/mismatched, overlapping বা blank রেন্ডার হয়):
 *   φ (phi, U+03C6) — beam/column reinforcement callout এ ব্যবহার
 *   করার প্রলোভন সবচেয়ে বেশি (যেমন "4-φ20"), কিন্তু rebar diameter
 *   callout এ এর বদলে ASCII "D" প্রিফিক্স ব্যবহার করা হয় (যেমন "D20")।
 *   ³ (superscript three, U+00B3) — "m³" এর বদলে "m3" লেখা হয়।
 *
 * নতুন কোনো non-ASCII ক্যারেক্টার ব্যবহারের আগে সবসময় charset-test.tsx
 * (স্ক্রিপ্ট, এই রিপোতে না থাকলে scripts/ এ নতুন করে বানিয়ে) দিয়ে
 * renderToBuffer() → rasterize → চোখে দেখে যাচাই করা উচিত, শুধু ধরে
 * নেওয়া উচিত না যে WinAnsiEncoding তে আছে মানেই react-pdf ঠিকভাবে
 * রেন্ডার করবে (³ এর ক্ষেত্রে এটাই ভুল প্রমাণিত হয়েছে)।
 */
export const pdfUnsafeCharacters = ["φ", "³"] as const;
