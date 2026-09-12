import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import { Providers } from "./providers";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bagrank.xyz"),
  title: {
    default: "bagrank",
    template: "%s · bagrank",
  },
  description: "Crowd hold map of top Hyperliquid wallets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
        <Script id="bagindex-theme" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <Providers>
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
