import type { ReactNode } from "react";
import { EmptyState, List, ListItem, Panel } from "../../ui";

export interface FeatureScaffoldProps {
  title: string;
  eyebrow: string;
  lanes: Array<{
    title: string;
    meta: string;
  }>;
  children?: ReactNode;
}

export function FeatureScaffold({ children, eyebrow, lanes, title }: FeatureScaffoldProps) {
  return (
    <div className="feature-page">
      <Panel eyebrow={eyebrow} title={title}>
        <List aria-label={`${title} sections`}>
          {lanes.map((lane) => (
            <ListItem key={lane.title} meta={lane.meta} title={lane.title} />
          ))}
        </List>
      </Panel>
      <Panel title="Workspace">
        {children ?? (
          <EmptyState
            body="Open a project item to fill this workspace."
            title="Nothing selected"
          />
        )}
      </Panel>
      <Panel title="Inspector">
        <EmptyState body="Contextual details will open here when this workspace becomes active." title="Nothing selected" />
      </Panel>
    </div>
  );
}
