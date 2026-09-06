"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useMemo, type ReactNode } from "react";

import { clerkAppearance } from "./clerk-appearance";

/**
 * ClerkProvider, kept in step with the theme.
 *
 * Clerk resolves its colour scale when the provider mounts and does not watch
 * the `.dark` class, so flipping the theme left its components painted for the
 * previous mode: a washed-out card with a button label you could not read.
 * Passing a fresh appearance object whenever the resolved theme changes is what
 * makes them repaint.
 *
 * This has to sit inside ThemeProvider for `useTheme` to work, which is why the
 * nesting in the root layout is theme first, Clerk second.
 */
export const AuthProvider = ({ children }: { readonly children: ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const appearance = useMemo(
    () => clerkAppearance(resolvedTheme === "dark"),
    [resolvedTheme],
  );

  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
};
