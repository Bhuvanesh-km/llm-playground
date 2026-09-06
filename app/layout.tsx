import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import { AuthProvider } from "@/features/auth/clerk-provider";
import { PostHogIdentify } from "@/features/auth/posthog-identify";
import { ThemeProvider } from "@/features/theme/theme-provider";

import "./globals.css";

/**
 * One family, loaded once, carrying its own width axis.
 *
 * Archivo is a variable font with a `wdth` axis, so the expanded display
 * treatment is a variation of the same file rather than a second download. It
 * also has true tabular figures, which this app leans on: the metrics change
 * while a model is still streaming and the digits must not shift as they do.
 * That is why there is no monospace anywhere in this design.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LLM Arena",
  description:
    "Send one prompt to three models at once, watch them answer, and vote for the best.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the theme
    // class onto <html> before React hydrates, so the server and client markup
    // legitimately differ on that one attribute.
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} h-full`}>
      {/* Clerk's provider belongs inside <body>, not wrapping <html>: older
          Clerk examples wrap <html>, which is no longer correct. Theme sits
          outside it because Clerk's appearance has to react to the resolved
          theme, and that reads from ThemeProvider's context. */}
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>
            <PostHogIdentify />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
