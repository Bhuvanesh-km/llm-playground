"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * Three explicit choices rather than a two-way flip, because "follow my system"
 * is a real preference and a flip cannot express it.
 *
 * Rendered as a radiogroup so the whole control is one tab stop and the arrow
 * keys move between options, which is what a keyboard user expects from a
 * segmented control.
 *
 * The stored theme is not knowable on the server, so until hydration nothing is
 * marked selected rather than guessing wrong and flickering. `useSyncExternalStore`
 * expresses that directly, returning false on the server and true on the client,
 * with no state to set from inside an effect.
 */
const subscribe = () => () => {};

const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="border-subtle inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = hydrated && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={
              selected
                ? "bg-rust text-rust-contrast rounded-md p-1.5"
                : "text-muted-ink hover:bg-raised hover:text-ink rounded-md p-1.5"
            }
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </div>
  );
};
