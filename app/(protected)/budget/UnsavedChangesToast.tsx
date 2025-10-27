"use client";
import { Button } from "@budget/components/UI/Button";
import { joinClassNames } from "@budget/lib/helpers";

export default function UnsavedChangesToast({
  onClick,
  loading,
  loadingText,
  isOpen = false,
}: {
  onClick: () => void;
  loading?: boolean;
  loadingText?: string;
  isOpen?: boolean;
}) {
  return (
    <div
      className={joinClassNames(
        "fixed transition-all duration-300 ease-in-out w-full max-w-9/10 left-[50%] transform-[translateX(-50%)]",
        isOpen ? "bottom-25" : "bottom-0"
      )}
    >
      <div
        className="pointer-events-auto relative border p-3 isolate bg-white/95 backdrop-blur-xl transition-all duration-200 border-amber-500/40 bg-white/95 text-amber-950 rounded-2xl"
        role="status"
        aria-live="polite"
      >
        <div className="flex">
          <div className="flex-none self-center">
            <span className="mt-0.5 text-current/70">
              <svg
                aria-hidden
                className="size-5"
                viewBox="0 0 24 24"
                role="img"
              >
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
            </span>
          </div>
          <div className="flex-1 flex items-center justify-between">
            <p className="text-sm font-medium">
              Changes are local until you save
            </p>
            <Button
              size="sm"
              onClick={onClick}
              loading={loading}
              loadingText={loadingText}
            >
              Save Budget 💾
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
