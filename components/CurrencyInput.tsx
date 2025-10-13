import { type FocusEventHandler } from "react";
import PkgCurrencyInput, {
  type CurrencyInputOnChangeValues,
} from "react-currency-input-field";

export default function CurrencyInput({
  name,
  value,
  onBlur,
  onValueChange,
}: {
  name?: string;
  value?: string | number;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onValueChange?: (
    value?: string,
    name?: string | undefined,
    values?: CurrencyInputOnChangeValues | undefined
  ) => void;
}) {
  return (
    <PkgCurrencyInput
      name={name}
      value={value}
      onBlur={onBlur}
      onValueChange={onValueChange}
      decimalsLimit={2}
      prefix="$"
      allowNegativeValue={false}
      className="mt-1 w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-right text-sm font-semibold text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
    />
  );
}
