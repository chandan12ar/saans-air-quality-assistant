import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saans: smog-season planner for families and communities",
  description:
    "A GenAI assistant that turns live air-quality data into a low-emission daily routine, indoor air hacks and sustainable swaps, and shows the before/after impact of each choice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b4f50",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
