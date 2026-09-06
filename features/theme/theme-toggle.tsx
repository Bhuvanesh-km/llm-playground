"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const subscribe = () => () => {};

/**
 * The stored theme is not knowable on the server, so until hydration nothing is
 * marked selected rather than guessing wrong and flickering. This returns false
 * on the server and true on the client, with no state set from inside an effect.
 */
const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** Wraps at both ends, which is what a radiogroup's arrow keys are meant to do. */
const nextIndex = (current: number, step: number, length: number): number =>
  (current + step + length) % length;

/**
 * Three explicit choices rather than a two-way flip, because "follow my system"
 * is a real preference and a flip cannot express it.
 *
 * A real radiogroup, not just the role. The group is a single tab stop: only the
 * selected option is tabbable and the arrows move both focus and selection, with
 * Home and End jumping to the ends. An earlier version carried the role and the
 * comment saying all this while implementing only click handling, which left
 * three separate tab stops and arrow keys doing nothing, so the markup promised
 * a keyboard contract the component did not honour.
 */
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = OPTIONS.findIndex(({ value }) => value === theme);
  // Before hydration, and for any unrecognised stored value, the first option
  // holds the tab stop so the group is never unreachable by keyboard.
  const tabStopIndex = hydrated && selectedIndex >= 0 ? selectedIndex : 0;

  const moveTo = (index: number): void => {
    setTheme(OPTIONS[index]!.value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const { key } = event;
    if (key === "ArrowRight" || key === "ArrowDown") {
      event.preventDefault();
      moveTo(nextIndex(index, 1, OPTIONS.length));
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      event.preventDefault();
      moveTo(nextIndex(index, -1, OPTIONS.length));
    } else if (key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (key === "End") {
      event.preventDefault();
      moveTo(OPTIONS.length - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="border-subtle inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const selected = hydrated && theme === value;
        return (
          <button
            key={value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => setTheme(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
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
