import type { Metadata } from "next";
import "./globals.css";

// নোট: next/font/google (Geist) ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে — এটা
// build-time এ fonts.googleapis.com এ নেটওয়ার্ক কল করে, যা একটা
// অপ্রয়োজনীয় বাহ্যিক নির্ভরতা তৈরি করে (CDN স্লো/ব্লকড হলে Vercel
// build ও আটকাতে পারে)। এর বদলে system font stack ব্যবহার করা হচ্ছে
// (globals.css এ দেখুন), যা দ্রুত ও নেটওয়ার্ক-স্বাধীন।

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
