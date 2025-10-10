import { Button as HeadlessButton } from "@headlessui/react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type JSX,
  type ReactNode,
} from "react";

const joinClassNames = (
  ...classNames: Array<string | undefined | false>
): string => classNames.filter(Boolean).join(" ");

type Variant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "destructive"
  | "google";

type Size = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  loading?: boolean;
  loadingText?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a84ff] disabled:cursor-not-allowed disabled:opacity-60";

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-b from-[#0a84ff] to-[#0060df] text-white shadow-[0_6px_16px_-8px_rgba(10,132,255,0.9)] hover:from-[#0b7fff] hover:to-[#0057c7] active:translate-y-px",
  secondary:
    "bg-white text-[#0a84ff] border border-[#d0d4da] shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35)] hover:bg-[#f5f6f8] active:translate-y-px",
  tertiary:
    "bg-[#f2f4f7] text-[#1f1f1f] shadow-inner hover:bg-[#e6e8ec] active:translate-y-px",
  ghost:
    "bg-transparent text-[#0a84ff] hover:bg-[#edf2ff] active:bg-[#e0e8ff] active:translate-y-px",
  destructive:
    "bg-gradient-to-b from-[#ff453a] to-[#d70015] text-white shadow-[0_6px_16px_-8px_rgba(255,69,58,0.8)] hover:from-[#ff5349] hover:to-[#c40012] active:translate-y-px",
  google:
    "bg-white text-[#1f1f1f] border border-[#d5d7da] shadow-[0_4px_10px_-6px_rgba(60,64,67,0.4)] hover:bg-[#f7f8f9] active:translate-y-px",
};

const disabledStyles: Partial<
  Record<NonNullable<ButtonProps["variant"]>, string>
> = {
  primary:
    "disabled:bg-gradient-to-b disabled:from-[#8cbcff] disabled:to-[#5f8ff5]",
  destructive:
    "disabled:bg-gradient-to-b disabled:from-[#ff7a72] disabled:to-[#f5534d]",
};

const fullWidthStyle = "w-full";

const LoadingSpinner = (): JSX.Element => (
  <svg
    aria-hidden="true"
    className="size-4 animate-spin text-[inherit]"
    viewBox="0 0 24 24"
    role="img"
  >
    <circle
      className="opacity-20"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      fill="none"
    />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      className="opacity-80"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const GoogleGlyph = (): JSX.Element => (
  <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" role="img">
    <path
      d="M12.24 10.2v3.72h5.22c-.21 1.35-.94 2.49-2.01 3.26l3.25 2.52c1.9-1.75 3-4.32 3-7.38 0-.72-.06-1.41-.18-2.07h-9.28z"
      fill="#4285F4"
    />
    <path
      d="M6.64 12c0-.66.11-1.3.3-1.9l-3.45-2.66A9.753 9.753 0 0 0 2 12c0 1.56.37 3.02 1.03 4.32l3.61-2.8A5.785 5.785 0 0 1 6.64 12"
      fill="#FBBC05"
    />
    <path
      d="M12 6.18c1.08 0 2.05.37 2.81 1.11l2.1-2.1A9.672 9.672 0 0 0 12 3c-3.8 0-7.04 2.2-8.51 5.39l3.45 2.66A5.77 5.77 0 0 1 12 6.18"
      fill="#EA4335"
    />
    <path
      d="M12 21c2.7 0 4.97-.88 6.62-2.39l-3.25-2.52c-.9.63-2.05.99-3.37.99-2.6 0-4.8-1.75-5.58-4.11l-3.61 2.8C4.28 19.66 7.88 21 12 21"
      fill="#34A853"
    />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      fullWidth,
      iconLeading,
      iconTrailing,
      loading = false,
      loadingText,
      size = "md",
      variant = "primary",
      disabled,
      type = "button",
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled ?? loading;

    const classes = joinClassNames(
      baseStyles,
      sizeStyles[size],
      variantStyles[variant],
      disabledStyles[variant],
      fullWidth ? fullWidthStyle : undefined,
      className
    );

    const leadingContent = loading ? (
      <LoadingSpinner />
    ) : (
      iconLeading ?? (variant === "google" ? <GoogleGlyph /> : undefined)
    );

    const contentLabel = loading && loadingText ? loadingText : children;

    return (
      <HeadlessButton
        {...rest}
        ref={ref}
        className={classes}
        disabled={isDisabled}
        type={type}
      >
        {leadingContent ? (
          <span className="flex items-center">{leadingContent}</span>
        ) : null}
        <span className="whitespace-nowrap">{contentLabel}</span>
        {iconTrailing && !loading ? (
          <span className="flex items-center">{iconTrailing}</span>
        ) : null}
      </HeadlessButton>
    );
  }
);

Button.displayName = "Button";
