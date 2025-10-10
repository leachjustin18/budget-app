import { Button as HeadLessButton } from "@headlessui/react";
import { type MouseEventHandler, type JSX, type ReactNode } from "react";

export const Button = ({
  children,
  onClick,
  className,
}: {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}): JSX.Element => (
  <HeadLessButton className={className} onClick={onClick}>
    {children}
  </HeadLessButton>
);
