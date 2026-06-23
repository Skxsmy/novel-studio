import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";

export type BadgeTone = "neutral" | "positive" | "attention" | "accent";

const toneMap: Record<BadgeTone, string> = {
  neutral: "",
  positive: " green",
  attention: " amber",
  accent: " violet",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cx("pill", toneMap[tone], className)} {...props}>
      {children}
    </span>
  );
}
