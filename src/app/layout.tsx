import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

import { auth } from "@/auth";
import { AmbientBackground } from "@/components/ambient-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TimezoneSync } from "@/components/timezone-sync";
import { IS_INDEXABLE, SITE_URL } from "@/lib/site";
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
  // Absolute base for every relative canonical/OG URL below and in child routes.
  metadataBase: new URL(SITE_URL),
  title: {
    // Front-loads the phrase people actually search; the brand follows.
    default: "Upcoming Coding Contests — NextContest",
    // Child routes set a bare `title` (e.g. "Contests") and inherit the suffix.
    template: "%s — NextContest",
  },
  description:
    "Every upcoming Codeforces, LeetCode, AtCoder and CodeChef contest in one live feed — with start times in your timezone, calendar sync, email reminders and rating predictions.",
  applicationName: "NextContest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NextContest",
    url: "/",
    locale: "en_US",
    title: "Upcoming Coding Contests — NextContest",
    description:
      "Every upcoming Codeforces, LeetCode, AtCoder and CodeChef contest in one live feed.",
  },
  twitter: { card: "summary_large_image" },
  robots: IS_INDEXABLE ? undefined : { index: false, follow: false },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#08090c" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TRPCReactProvider>
            {session?.user ? <TimezoneSync /> : null}
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
