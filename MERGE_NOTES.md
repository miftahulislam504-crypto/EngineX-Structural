# Documentation Section — Merge Notes

## ১. ফাইল বসানো
এই ZIP-এর সব ফাইল আপনার EngineX-Structural repo-তে **একই relative path**-এ বসান
(GitHub web editor-এ প্রতিটা path অনুযায়ী upload/replace করুন)। ২০টা ফাইল
existing ফাইল প্রতিস্থাপন করবে, বাকিগুলো নতুন।

## ২. নতুন dependency ইনস্টল করা আবশ্যক
Documentation module দুটো নতুন প্যাকেজ ব্যবহার করে যা আগে repo-তে ছিল না:
- `@react-pdf/renderer` (PDF generate করার জন্য — Design Report, BBS, Calc
  Sheets, QC Report, General Notes, Drawing Sheets সবগুলোই এটা দিয়ে বানানো)
- `exceljs` (BBS-এর xlsx export এর জন্য)

`package.json`-এ এই দুটো যোগ করে দিয়েছি (এই ZIP-এ `package.json`ও আছে,
merge করুন) — কিন্তু deploy করার আগে অবশ্যই `npm install` চালাতে হবে
(Vercel deploy করলে এটা build-এর সময় নিজে থেকেই হবে, কিন্তু Termux/local এ
manually `npm install` লাগবে)।

## ৩. যা যোগ হলো (সংক্ষেপে)
- **Documentation tab-এ নতুন sub-tab**: "Reports & Export" (existing ৮টা
  sub-tab এর সাথে ৯ম হিসেবে যোগ হয়েছে — নাম-সংঘর্ষ এড়াতে "Documentation"
  নামটা existing detailing-tools এর জন্যই রাখা হয়েছে)
- **Firestore persist layer** — Analysis, Design (সব ১২ ধরনের element),
  Detailing, General Notes — এতদিন এগুলো শুধু client-side state এ থাকত
  (পেজ রিলোড দিলে হারিয়ে যেত)। এখন Firestore এ save হয়, Documentation
  Engine PDF বানানোর সময় এখান থেকেই পড়ে।
- **২টা ছোট gap fix**: `fetchAllElements()` (elements/firestore.ts) ও
  `fetchLoadCases()` (loads/firestore.ts) — Documentation Engine এর
  one-shot fetch দরকার ছিল, আগে শুধু real-time listener ছিল।

## ৪. জানা সীমাবদ্ধতা (Phase 11 প্যাকেজ থেকেই, আমার merge-এর বাইরে)
- Calc Sheet PDF শুধু Beam/Column/Slab/Footing এর জন্য আছে — Wall, Steel
  Beam/Column, Combined/Strip/Mat Footing, Pile Cap, Retaining Wall এর
  design result persist ও quantity summary-তে দেখাবে, কিন্তু individual
  calc sheet পাবে না।
- Drawing Sheets ডকুমেন্টে এখনো S-01 General Notes আলাদা sheet হিসেবে
  নেই (General Notes আলাদাভাবে ডাউনলোড করতে হবে)।

## ৫. দ্রুত smoke-test চেকলিস্ট
মার্জ করার পর:
1. একটা beam design করে "Run Design" চাপুন → error ছাড়া চলা উচিত
2. Documentation ট্যাব → Reports & Export sub-tab এ যান
3. "Design Report" ডাউনলোড করে দেখুন beam-টা Section G তে দেখাচ্ছে কিনা
