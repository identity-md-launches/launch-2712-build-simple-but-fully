import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "SqueekYield · Stake SEED on Sepolia",
  description: SITE_DESCRIPTION,
  icons: { icon: "./favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f1e6" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Relative on purpose: the export is served from an IPFS gateway path or an ENS name. */}
        <meta property="og:title" content={SITE_NAME} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:image" content="./og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
