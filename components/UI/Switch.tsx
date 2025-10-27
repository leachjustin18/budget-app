"use client";

import { Switch as HeadlessSwitch } from "@headlessui/react";
import { joinClassNames } from "@budget/lib/helpers";

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  srLabel?: string;
  size?: "md" | "sm";
  className?: string;
};

export function Switch({
  checked,
  onChange,
  disabled = false,
  srLabel,
  size = "md",
  className,
}: SwitchProps) {
  const dimensions =
    size === "sm"
      ? { track: "h-5 w-9", thumb: "size-4 translate-x-0.5" }
      : { track: "h-6 w-11", thumb: "size-5 translate-x-0.5" };

  return (
    <HeadlessSwitch
      checked={checked}
      onChange={disabled ? () => undefined : onChange}
      className={joinClassNames(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border border-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
        checked ? "bg-emerald-500" : "bg-emerald-200",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        dimensions.track,
        className
      )}
    >
      {srLabel ? (
        <span className="sr-only">{srLabel}</span>
      ) : null}
      <span
        aria-hidden="true"
        className={joinClassNames(
          "pointer-events-none inline-block rounded-full bg-white shadow transition",
          checked
            ? size === "sm"
              ? "translate-x-4"
              : "translate-x-5"
            : "translate-x-0.5",
          dimensions.thumb
        )}
      />
    </HeadlessSwitch>
  );
}
