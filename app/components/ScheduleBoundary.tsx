"use client";
import { Component, type ReactNode } from "react";

export default class ScheduleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section role="alert" style={{ margin: 24, padding: 32, borderRadius: 20, background: "white" }}><h2>个人日程暂时无法显示</h2><p>已保存的任务仍然保留，可以重试或切换其他页面。</p><button onClick={() => this.setState({ failed: false })}>重新加载日程</button></section>;
    return this.props.children;
  }
}
