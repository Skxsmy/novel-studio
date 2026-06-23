import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ action, body, title }: EmptyStateProps) {
  return (
    <div className="large-note">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}
