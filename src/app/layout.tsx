import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

import { AmbientBackground } from "@/components/ambient-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TRPCReactProvider } from "@/trpc/react";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "NextContest — never miss a coding contest",
  description:
    "One portal for every upcoming competitive programming contest — Codeforces, LeetCode, AtCoder, CodeChef — with reminders so you never miss one.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TRPCReactProvider>
            <AmbientBackground />
            <div className="relative z-[1] flex min-h-screen flex-col">
              <SiteHeader />
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
