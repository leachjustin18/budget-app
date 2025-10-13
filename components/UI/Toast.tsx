"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { joinClassNames } from "@budget/lib/helpers";

export type ToastVariant = "success" | "info" | "warning" | "danger";

type ToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  icon?: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  autoDismissMs?: number;
  persistent?: boolean;
  className?: string;
};

const variantStyles: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/50 bg-white/95 text-emerald-950 shadow-[0_16px_38px_rgba(22,101,52,0.25)]",
  info: "border-sky-500/40 bg-white/95 text-sky-950 shadow-[0_16px_38px_rgba(2,132,199,0.22)]",
  warning:
    "border-amber-500/40 bg-white/95 text-amber-950 shadow-[0_16px_38px_rgba(245,158,11,0.22)]",
  danger:
    "border-rose-500/45 bg-white/95 text-rose-950 shadow-[0_16px_38px_rgba(244,63,94,0.26)]",
};

const variantIcons: Record<ToastVariant, ReactNode> = {
  success: (
    <svg aria-hidden className="size-5" viewBox="0 0 24 24" role="img">
      <path
        d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="m16.22 9.47-4.11 5.01a1 1 0 0 1-1.51.05l-2.05-2.17a1 1 0 1 1 1.45-1.37l1.26 1.33 3.44-4.19a1 1 0 1 1 1.52 1.24"
        fill="currentColor"
      />
    </svg>
  ),
  info: (
    <svg aria-hidden className="size-5" viewBox="0 0 24 24" role="img">
      <path
        d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M12 7.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0 4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1"
        fill="currentColor"
      />
    </svg>
  ),
  warning: (
    <svg aria-hidden className="size-5" viewBox="0 0 24 24" role="img">
      <path
        d="M12.87 4.26c-.4-.73-1.34-.73-1.74 0L3.53 18.1c-.38.7.11 1.65.87 1.65h15.2c.76 0 1.25-.95.87-1.65z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M12 8.25a1 1 0 0 1 1 1v4.5a1 1 0 1 1-2 0v-4.5a1 1 0 0 1 1-1m0 8a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5"
        fill="currentColor"
      />
    </svg>
  ),
  danger: (
    <svg aria-hidden className="size-5" viewBox="0 0 24 24" role="img">
      <path
        d="M12.87 4.26c-.4-.73-1.34-.73-1.74 0L3.53 18.1c-.38.7.11 1.65.87 1.65h15.2c.76 0 1.25-.95.87-1.65z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M10.97 8.47a1 1 0 0 1 1.88 0l.96 2.89a1 1 0 0 1-.95 1.32h-1.9a1 1 0 0 1-.95-1.32zm.03 7.03a1 1 0 1 1 2 0 1 1 0 0 1-2 0"
        fill="currentColor"
      />
    </svg>
  ),
};

export function Toast({
  title,
  description,
  variant = "info",
  icon,
  actions,
  dismissible,
  onDismiss,
  autoDismissMs,
  persistent,
  className,
}: ToastProps) {
  useEffect(() => {
    if (persistent || !autoDismissMs || !onDismiss) return;

    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, onDismiss, persistent]);

  const resolvedIcon = icon ?? variantIcons[variant];

  return (
    <div
      className={joinClassNames(
        "pointer-events-auto relative w-full max-w-sm rounded-2xl border px-4 py-3",
        "isolate bg-white/95 backdrop-blur-xl transition-all duration-200",
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-current/70">{resolvedIcon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-current/80">
              {description}
            </p>
          ) : null}
        </div>
        {dismissible && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/50 bg-white/70 p-1 text-current/60 transition hover:text-current"
            aria-label="Dismiss toast"
          >
            <svg aria-hidden className="size-4" viewBox="0 0 24 24" role="img">
              <path
                d="m15.78 8.22-3.53 3.53-3.53-3.53a.75.75 0 0 0-1.06 1.06l3.53 3.53-3.53 3.53a.75.75 0 1 0 1.06 1.06l3.53-3.53 3.53 3.53a.75.75 0 0 0 1.06-1.06l-3.53-3.53 3.53-3.53a.75.75 0 0 0-1.06-1.06"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {actions ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export default Toast;
