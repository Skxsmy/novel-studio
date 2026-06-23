import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";
import "./ui.css";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  noShadow?: boolean;
  children: ReactNode;
}

export function Panel({ actions, children, className, eyebrow, noShadow, title, ...props }: PanelProps) {
  return (
    <section className={cx("panel", noShadow && "no-shadow", className)} {...props}>
      {title || eyebrow || actions ? (
        <div className="panel-head">
          <div>
            {title ? <div className="panel-title">{title}</div> : null}
            {eyebrow ? <div className="panel-kicker">{eyebrow}</div> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
