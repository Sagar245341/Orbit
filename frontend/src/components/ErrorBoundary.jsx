import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="error-screen">
          <div className="error-card">
            <span className="error-icon"><AlertTriangle size={22} /></span>
            <h1>Something went off course</h1>
            <p>Orbit couldn’t load this screen. Refresh the page to try again.</p>
            <button className="button-primary" onClick={() => window.location.reload()}>
              <RotateCcw size={16} /> Refresh page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
