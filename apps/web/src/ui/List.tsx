import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

export function List({ children, className, ...props }: ListProps) {
  return (
    <ul className={cx("row-list", className)} style={{ listStyle: "none", margin: 0, padding: 0 }} {...props}>
      {children}
    </ul>
  );
}

export interface ListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  meta?: string;
  title: string;
  trailing?: ReactNode;
}

export function ListItem({ active = false, className, meta, title, trailing, type = "button", ...props }: ListItemProps) {
  return (
    <li>
      <button
        className={cx("data-row", active && "is-active", className)}
        type={type}
        {...props}
      >
        <span>
          <span className="row-title">{title}</span>
          {meta ? <span className="row-meta">{meta}</span> : null}
        </span>
        {trailing ? <span>{trailing}</span> : null}
      </button>
    </li>
  );
}
