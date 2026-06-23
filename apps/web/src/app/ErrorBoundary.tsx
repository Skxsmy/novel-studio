import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { Button, EmptyState, Panel } from "../ui";

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error("Unexpected view error"),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <Panel>
          <EmptyState
            action={<Button onClick={() => this.setState({ error: null })}>Reset View</Button>}
            body="The current workspace stopped rendering. Local draft state stays in memory."
            title="Workspace paused"
          />
        </Panel>
      );
    }

    return this.props.children;
  }
}
