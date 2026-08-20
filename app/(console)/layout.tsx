import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";

import "../globals.css";

/**
 * Root layout for the signed-in consoles.
 *
 * A second root layout, alongside `app/[locale]/layout.tsx`. The consoles are
 * operated by staff in English and are not indexed, so they carry no locale
 * segment — while the public pages are generated once per language and need
 * the right `lang` on `<html>`, which only a root layout can set.
 *
 * The cost is a full page load when crossing between the two, which is
 * acceptable: marketing to console is a sign-in boundary anyway.
 */
export const metadata: Metadata = {
  title: {
    default: "Pasumai Trade",
    template: "%s · Pasumai Trade",
  },
  description:
    "Farm-to-business marketplace and logistics network for India.",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e120e" },
  ],
};

export default function ConsoleRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
