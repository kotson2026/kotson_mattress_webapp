import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 md:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-heading text-lg font-bold text-[#2D2D2D]">
            {this.props.fallbackTitle || "Unable to display this section"}
          </h3>
          <p className="mt-1.5 text-sm text-[#666666] max-w-md mx-auto">
            {this.props.fallbackMessage || "An unexpected error occurred while loading this view. Please try refreshing."}
          </p>
          <Button
            type="button"
            onClick={this.handleReset}
            variant="outline"
            className="mt-5 rounded-xl border-[#CBD6C7] text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
