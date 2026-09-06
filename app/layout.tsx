import type { Metadata } from "next";
import { Archivo } from "next/font/google";

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
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
