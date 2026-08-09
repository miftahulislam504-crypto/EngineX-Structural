import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/lib/auth/AuthProvider";

/**
 * Phase 6 (Typography) — next/font/google আনা হলো (আগে ইচ্ছাকৃতভাবে
 * বাদ দেওয়া হয়েছিল, নিচের পুরনো কারণ দেখুন)।
 *
 * পুরনো কারণ (এখন প্রত্যাখ্যাত): build-time এ fonts.googleapis.com এ
 * নেটওয়ার্ক কল Vercel build আটকাতে পারে — এটা precautionary ছিল,
 * কোনো আসল ঘটনার রেকর্ড ছিল না। EngineXDraw (একই monorepo family,
 * একই Vercel deployment pattern) নিজেই ঠিক এই ৪টা ফন্ট next/font/
 * google দিয়ে production এ ব্যবহার করে (কোনো vercel.json বা
 * network-resilience config ছাড়াই — শুধু standard default), তাই
 * ঝুঁকি কম বলে বিবেচিত।
 *
 * Draw এর মূল variable নাম রাখা হয়েছে (--font-display) সেই ফন্টটার
 * জন্য (Space Grotesk) যেটা Draw এ নিজস্ব "geometric/technical" display
 * পরিচয় বহন করে — কিন্তু Structural এর বিদ্যমান কোনো component এ এখনই
 * জোর করে বসানো হয়নি (এটা color/font token টা *উপলব্ধ* করে দেওয়া,
 * কোথায় কোথায় ব্যবহার করা হবে সেটা আলাদা, পরবর্তী ইচ্ছাকৃত সিদ্ধান্ত)।
 * body টেক্সটের জন্য Structural এর আগে থেকে থাকা --font-sans/--font-mono
 * নাম রাখা হলো (৫টা ফাইল ইতিমধ্যে font-sans/font-mono utility class
 * ব্যবহার করে — Sidebar.tsx, AnalysisPanel.tsx ইত্যাদি — নাম বদলালে
 * সেগুলো ভাঙত), শুধু মান এখন Google Fonts (Inter) থেকে — globals.css
 * এর @theme ব্লকে font-sans/font-mono/font-display তিনটাই কীভাবে এই
 * variable থেকে composite হয়েছে দেখুন।
 *
 * Noto Sans Bengali — Draw এর নিজস্ব কমেন্ট অনুযায়ী যোগ করা হলো (Space
 * Grotesk/Inter বাংলা glyph কভার করে না)। Structural এর বর্তমান UI
 * label ইংরেজি, কিন্তু কোডবেসের বাকি অংশ (comment, ভবিষ্যতে সম্ভাব্য
 * বাংলা UI) দ্বিভাষিক — তাই এখনই যোগ করে রাখা হলো, পরে দরকার হলে খালি
 * fallback হিসেবে থাকবে, ক্ষতি নেই।
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CivilOS Structural — Analysis & Design",
  description: "CivilOS Hub-integrated structural analysis and design application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoSansBengali.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
