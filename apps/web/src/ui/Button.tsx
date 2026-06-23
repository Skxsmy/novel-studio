import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";
import "./ui.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function Button({
  children,
  className,
  icon,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  const variantClass = variant === "primary" ? " primary" : variant === "danger" ? " danger" : variant === "ghost" ? " ghost" : "";
  return (
    <button
      className={cx("btn", `ui-button ui-button--${size}`, variantClass, className)}
      type={type}
      {...props}
    >
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
