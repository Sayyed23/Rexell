import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"

import { Toaster } from "@/components/ui/sonner";
import { BlockchainProviders } from "@/providers/blockchain-providers";
import { ThemeProvider } from "@/providers/theme-provider";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rexell",
  description: "Ticketing system for Web3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} scroll-smooth`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <BlockchainProviders>
            {children}
            <Analytics />
          </BlockchainProviders>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
