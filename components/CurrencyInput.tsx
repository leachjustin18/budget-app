import { type FocusEventHandler } from "react";
import PkgCurrencyInput, {
  type CurrencyInputOnChangeValues,
} from "react-currency-input-field";
import { joinClassNames } from "@budget/lib/helpers";

export default function CurrencyInput({
  name,
  value,
  onBlur,
  onValueChange,
  disabled,
}: {
  name?: string;
  value?: string | number;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onValueChange?: (
    value?: string,
    name?: string | undefined,
    values?: CurrencyInputOnChangeValues | undefined
  ) => void;
  disabled?: boolean;
}) {
  return (
    <PkgCurrencyInput
      name={name}
      value={value}
      onBlur={onBlur}
      onValueChange={onValueChange}
      decimalsLimit={2}
      disabled={disabled}
      intlConfig={{ locale: "en-US", currency: "USD" }}
      allowNegativeValue={false}
      className={joinClassNames(
        "mt-1 w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-right text-sm font-semibold text-emerald-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300",
        disabled ? "border-0" : "border shadow-inner "
      )}
    />
  );
}
