"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Dark is what this product was designed for, but light is a first-class mode
 * rather than an afterthought, so the default follows the system preference and
 * the toggle overrides it. `disableTransitionOnChange` stops every colour on the
 * page animating at once when the theme flips, which reads as a glitch.
 */
export const ThemeProvider = ({ children }: { readonly children: ReactNode }) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    {children}
  </NextThemeProvider>
);
