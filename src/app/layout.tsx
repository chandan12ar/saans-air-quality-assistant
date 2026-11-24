import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font, so the strict CSP (font-src 'self') still holds.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });

export const metadata: Metadata = {
  title: "Saans: smog-season planner for families and communities",
  description:
    "A GenAI assistant that turns live air-quality data into a low-emission daily routine, indoor air hacks and sustainable swaps, and shows the before/after impact of each choice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#11292e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${deva.variable}`}>
      <body>{children}</body>
    </html>
  );
}
