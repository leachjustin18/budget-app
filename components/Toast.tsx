import CustomToast, { type ToastProps } from "@budget/components/UI/ToastUI";

export default function Toast({
  title,
  description,
  variant = "info",
  icon,
  actions,
  dismissible,
  onDismiss,
  autoDismissMs = 5000,
  persistent,
  className,
}: ToastProps) {
  return (
    <div
      className={` ${className} pointer-events-none fixed inset-x-0 top-[120px] z-1000 flex flex-col items-center gap-3 px-4 sm:items-end`}
    >
      <CustomToast
        variant={variant}
        icon={icon}
        actions={actions}
        dismissible={dismissible}
        onDismiss={onDismiss}
        autoDismissMs={autoDismissMs}
        persistent={persistent}
        title={title}
        description={description}
        className={`${className} w-full sm:max-w-sm`}
      />
    </div>
  );
}
