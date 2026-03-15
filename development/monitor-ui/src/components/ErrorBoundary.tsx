import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: "1rem",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.8rem",
          color: "#fca5a5",
          background: "#1a0a0a",
          borderRadius: "4px",
          margin: "0.5rem",
        }}>
          <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
            {"\u26A0"} Component Error
          </div>
          <div style={{ color: "#a0a0b0" }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "0.5rem",
              padding: "0.3rem 0.8rem",
              background: "#2a2a3e",
              color: "#f0b429",
              border: "1px solid #3a3a4e",
              borderRadius: "3px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.75rem",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
