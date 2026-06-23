import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";

export interface NavButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  description?: string;
  marker: ReactNode;
  label: string;
}

export function NavButton({
  active = false,
  className,
  description,
  label,
  marker,
  type = "button",
  ...props
}: NavButtonProps) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cx("nav-row", active && "is-active", className)}
      type={type}
      {...props}
    >
      <span>
        <span className="row-title">{label}</span>
        {description ? <span className="row-meta">{description}</span> : null}
      </span>
      {marker}
    </button>
  );
}
