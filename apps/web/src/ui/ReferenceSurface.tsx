import { createElement, forwardRef, useMemo, type MouseEventHandler } from "react";

import { getReferenceElementSnapshot } from "../app/reference-source";

export interface ReferenceSurfaceProps {
  hidden?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  selector: string;
}

function toReactProps(attributes: Array<[string, string]>) {
  const props: Record<string, unknown> = {};
  for (const [name, value] of attributes) {
    if (name === "class") props.className = value;
    else if (name === "hidden") props.hidden = true;
    else if (name === "tabindex") props.tabIndex = Number(value);
    else props[name] = value;
  }
  return props;
}

export const ReferenceSurface = forwardRef<HTMLElement, ReferenceSurfaceProps>(function ReferenceSurface(
  { hidden, onClick, selector },
  ref,
) {
  const snapshot = useMemo(() => getReferenceElementSnapshot(selector), [selector]);
  const props = toReactProps(snapshot.attributes);
  if (hidden !== undefined) props.hidden = hidden;
  return createElement(snapshot.tagName, {
    ...props,
    dangerouslySetInnerHTML: { __html: snapshot.innerHtml },
    onClick,
    ref,
  });
});
