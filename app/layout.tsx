import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/docs/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkipLink } from "@/components/docs/skip-link";
import { DocsHeader } from "@/components/docs/docs-header";
import { DocsFooter } from "@/components/docs/docs-footer";
import { NavigationProvider } from "@/components/docs/navigation-provider";
import { SiteChrome } from "@/components/docs/site-chrome";
import { SearchProvider } from "@/components/search/search-provider";
import { siteConfig } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SearchProvider>
              {/*
                A root layout receives no route params (D12) and must not
                pay for reading every version's markdown on every page,
                including the landing page - so it no longer loads
                DocNavCategory[] here. previous-page/next-page therefore
                start as no-ops (findAdjacentByRoute against []) until a
                future step gives NavigationProvider a way to receive the
                current page's version-scoped nav.
              */}
              <NavigationProvider nav={[]}>
                <SkipLink />
                <SiteChrome>
                  <DocsHeader />
                </SiteChrome>
                <main id="main-content" className="flex flex-1 flex-col">
                  {children}
                </main>
                <SiteChrome>
                  <DocsFooter />
                </SiteChrome>
              </NavigationProvider>
            </SearchProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
