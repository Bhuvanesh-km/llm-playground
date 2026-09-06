/**
 * Clerk's components, dressed in this app's palette.
 *
 * Most values point at CSS custom properties from `globals.css`, so they follow
 * the theme the same way everything else does.
 *
 * `colorNeutral` cannot. Clerk derives a whole ramp of borders, muted
 * backgrounds and secondary text from it using `color-mix`, and its own
 * documentation warns that a `var()` there can misbehave. It also has to invert
 * between modes: on a light ground the ramp is generated from a dark base, on a
 * dark ground from a light one. A single fixed value produced a washed-out card
 * with an unreadable button label in dark mode, so it is passed as a literal per
 * theme instead.
 *
 * That is also why this is a function rather than a constant. Clerk resolves its
 * scale once, when the provider mounts, and does not recompute it when the
 * `.dark` class changes underneath it. Handing it a new object as the theme
 * flips is what makes the toggle actually repaint Clerk's UI.
 */
export const clerkAppearance = (isDark: boolean) =>
  ({
    variables: {
      colorPrimary: "var(--rust)",
      colorPrimaryForeground: "var(--rust-contrast)",
      colorBackground: "var(--surface-panel)",
      colorForeground: "var(--text-primary)",
      colorMutedForeground: "var(--text-muted)",
      colorMuted: "var(--surface-raised)",
      colorInput: "var(--surface-page)",
      colorInputForeground: "var(--text-primary)",
      colorBorder: "var(--border-subtle)",
      colorRing: "var(--rust)",
      colorDanger: "var(--danger)",
      colorSuccess: "var(--winner)",
      colorNeutral: isDark ? "#f2e7de" : "#241a13",
      fontFamily: "var(--font-archivo)",
      fontFamilyButtons: "var(--font-archivo)",
      borderRadius: "var(--radius)",
    },
  }) as const;
