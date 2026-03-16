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
        <div
          className="loki-eb-tablet"
          role="alert"
          aria-live="assertive"
          aria-label="Loki has captured a component error"
        >
          {/* Top rune border — decorative */}
          <div className="loki-eb-rune-border" aria-hidden="true">
            ᛚ ᛟ ᚲ ᛁ · ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ · ᛚ ᛟ ᚲ ᛁ
          </div>

          <div className="loki-eb-body">
            {/* Loki avatar */}
            <div className="loki-eb-avatar">
              <span className="loki-eb-avatar-rune" aria-hidden="true">ᛚᛟᚲᛁ</span>
              <span className="loki-eb-avatar-label">Loki · The Trickster</span>
            </div>

            {/* Divider */}
            <div className="loki-eb-divider" aria-hidden="true">ᚦ · ᛚᚨᚢᚷᚨᛉ · ᚦ</div>

            {/* Heading */}
            <h3 className="loki-eb-heading">
              The Trickster Has Snared This Thread
            </h3>

            {/* Subheading */}
            <p className="loki-eb-subheading">
              Loki has bound this error to the world-serpent&apos;s coils — it shall cause no further chaos
            </p>

            {/* Error inscription */}
            <div className="loki-eb-inscription" aria-label="Error details">
              <span className="loki-eb-inscription-label">Captured Inscription (error.message)</span>
              <code className="loki-eb-inscription-message">
                {this.state.error?.message ?? "Unknown error"}
              </code>
            </div>

            {/* Loki seal — decorative */}
            <div className="loki-eb-seal" aria-hidden="true">
              <div className="loki-eb-seal-runes">ᛚᛟᚲᛁ · ᚹᛟᚱᛚᛞ-ᛊᛖᚱᛈᛖᚾᛏ</div>
              <div className="loki-eb-seal-inscription">&ldquo;Every truth hides a lie, every build hides a flaw&rdquo;</div>
              <div className="loki-eb-seal-sub">ᛚ — So the trickster weaves — ᛚ</div>
            </div>

            {/* Retry action */}
            <div className="loki-eb-action">
              <button
                type="button"
                className="loki-eb-retry-btn"
                aria-label="Reweave the Thread — retry this component"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Reweave the Thread
              </button>
            </div>
          </div>

          {/* Bottom rune border — decorative */}
          <div className="loki-eb-rune-border bottom" aria-hidden="true">
            ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛉ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ · ᛚ ᛟ ᚲ ᛁ
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
