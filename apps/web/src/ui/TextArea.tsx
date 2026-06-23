import type { TextareaHTMLAttributes } from "react";
import { cx } from "./utils";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  hideLabel?: boolean;
}

export function TextArea({ className, hint, hideLabel = false, id, label, ...props }: TextAreaProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <label className="field" htmlFor={inputId}>
      <span style={hideLabel ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } : undefined}>{label}</span>
      <textarea
        aria-describedby={hintId}
        className={cx("textarea", className)}
        id={inputId}
        {...props}
      />
      {hint ? <span className="ui-field__hint" id={hintId}>{hint}</span> : null}
    </label>
  );
}
