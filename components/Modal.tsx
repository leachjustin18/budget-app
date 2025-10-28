"use client";

import {
  type MouseEventHandler,
  type ReactNode,
  useId,
  useMemo,
} from "react";

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
  Description,
} from "@headlessui/react";
import { Button, type Variant } from "@budget/components/UI/Button";

export default function Modal({
  isOpen = false,
  onClose,
  title,
  children,
  showCancel = false,
  onSave,
  isSaving = false,
  saveText,
  saveVariant,
  loadingText,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  showCancel?: boolean;
  onSave?: MouseEventHandler<HTMLButtonElement>;
  isSaving?: boolean;
  saveText?: string;
  saveVariant?: Variant;
  loadingText?: string;
}) {
  const labelId = useId();
  const descriptionId = useId();

  const dialogTitle = useMemo(() => {
    if (typeof title === "string") {
      const trimmed = title.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return "Dialog window";
  }, [title]);

  const hasBody = useMemo(() => {
    if (children === null || children === undefined) return false;
    if (typeof children === "string") return children.trim().length > 0;
    return true;
  }, [children]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-40 flex w-screen items-center justify-center p-4"
      aria-labelledby={labelId}
      aria-describedby={hasBody ? descriptionId : undefined}
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-emerald-950/40 backdrop-blur"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="z-50 w-full max-w-2xl space-y-5 rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl">
            <DialogTitle id={labelId} className="font-bold">
              {dialogTitle}
            </DialogTitle>
            {hasBody ? (
              <Description id={descriptionId} className="space-y-6" as="div">
                {children}
              </Description>
            ) : null}
            <div className="flex justify-end gap-3">
              {showCancel ? (
                <Button
                  type="button"
                  onClick={onClose}
                  variant="ghost"
                  loading={isSaving}
                >
                  Cancel
                </Button>
              ) : (
                ""
              )}

              {onSave ? (
                <Button
                  type="button"
                  variant={saveVariant || "primary"}
                  onClick={onSave}
                  loading={isSaving}
                  loadingText={loadingText || "Saving..."}
                >
                  {saveText || "Save"}
                </Button>
              ) : (
                ""
              )}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
