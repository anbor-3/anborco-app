import React from "react";

type State = { hasError: boolean; err?: any };
export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: any) { return { hasError: true, err }; }
  componentDidCatch(err: any, info: any) { console.error("💥 ErrorBoundary", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:16,fontFamily:"system-ui"}}>
          <h2>画面の表示でエラーが発生しました</h2>
          <p>ブラウザの拡張を一時的に無効化し、ハードリロードをお試しください。</p>
          <details style={{whiteSpace:"pre-wrap", marginTop:8}}>
            {String(this.state.err)}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
