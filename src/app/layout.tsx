import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import { getStats } from "@/lib/items";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display" });

export const dynamic = "force-dynamic"; // live DB reads every request

export const metadata: Metadata = {
  title: "CyBuzz — cybersecurity, trending",
  description:
    "The latest attacks, CVEs, breaches and ransomware hits, ranked by what the industry is talking about.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const stats = getStats();
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${display.variable}`}>
      <body className="bg-[var(--bg)] font-sans text-[var(--text)] antialiased">
        <div className="flex min-h-screen">
          <Sidebar stats={stats} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <Ticker />
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
