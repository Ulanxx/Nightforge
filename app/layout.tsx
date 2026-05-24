import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "DeepAgents Agent",
  description: "Manus-like general agent with E2B sandboxes"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${newsreader.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
