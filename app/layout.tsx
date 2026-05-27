import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap"
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "DeepAgents 通用智能体",
  description: "基于 DeepAgents 的 Manus 风格通用智能体工作台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${newsreader.variable} ${sourceSans.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
