import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AccountNav } from "@/components/account-nav";
import Link from "next/link";
import "./globals.css";
import { PwaControls } from "@/components/pwa-controls";

export const metadata: Metadata = {
  title: "Business Collab",
  applicationName: "Business Collab",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Business Collab", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" },
  description: "A South African business-to-business collaboration platform.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#171717", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8" aria-label="Main navigation">
            <Link href="/" className="font-semibold no-underline">Business Collab</Link>
            <Suspense fallback={<span className="text-sm">Loading account…</span>}><AccountNav /></Suspense>
          </nav>
        </header>
        <PwaControls />
        {children}
      </body>
    </html>
  );
}
