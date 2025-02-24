import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  render() {
    if (this.state.hasError) {
      // Allow access to config page even when there's an error
      if (window.location.pathname === "/config") {
        return this.props.children;
      }

      return (
        <div className="fixed inset-0 bg-base-100 bg-opacity-50 flex items-center justify-center">
          <div className="bg-base-100 p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-medium text-error mb-2">Error</h3>
            <p className="text-base-content mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => (window.location.href = "/")}
                className="px-4 py-2 bg-info text-base-content rounded-md"
              >
                Return Home
              </button>
              <button
                onClick={() => (window.location.href = "/config")}
                className="px-4 py-2 bg-base-100 text-base-content rounded-md hover:bg-base-200"
              >
                Go to Config
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
