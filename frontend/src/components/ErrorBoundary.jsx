import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    // You could also log the error to an error reporting service here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard">
          <h2>Something went wrong.</h2>
          <p>We've encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;