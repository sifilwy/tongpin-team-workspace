"use client";
import { useEffect, useRef, useState } from 'react';
import './desktop-widget-button.css';

export default function DesktopWidgetButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [supported, setSupported] = useState(true);
  const [opening, setOpening] = useState(false);
  useEffect(() => { setSupported(/Windows/i.test(navigator.userAgent)); }, []);
  return <>
    <button type="button" className="desktop-install-button" aria-label="添加桌面组件" title="添加桌面组件" onClick={() => { setOpening(false); dialog.current?.showModal(); }}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M9 10h6m-3-3v6"/></svg><span>添加桌面组件</span>
    </button>
    <dialog ref={dialog} className="desktop-install-dialog" aria-labelledby="desktop-install-title" onClick={event => { if (event.target === event.currentTarget) { const rect=event.currentTarget.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.current?.close(); } }}>
      <button type="button" className="desktop-install-close" aria-label="关闭安装说明" onClick={() => dialog.current?.close()}>×</button>
      <div className="desktop-install-icon" aria-hidden="true">✓</div>
      <h2 id="desktop-install-title">把日程放到桌面</h2>
      <p>查看 xzx 的日程，完成任务、切换视角，随时收成小圆点。</p>
      {supported ? <>
        <ol><li>下载并打开安装程序。</li><li>点击“安装并打开”，桌面图标会自动创建。</li><li>首次打开，用网站邀请码登录。</li></ol>
        <a className="desktop-install-download" href="/downloads/TongpinWidgetSetup-20260909.exe" download>下载 Windows 安装程序</a>
        <a className="desktop-install-open" href="tongpin-widget://open" onClick={() => setOpening(true)}>已安装，打开桌面组件 ↗</a>
        {opening && <p className="desktop-install-hint" role="status">请在浏览器提示中选择“打开”。如果没有反应，请先运行上面的安装程序。</p>}
        <small>适用于 Windows 10 / 11（64 位）· 不占任务栏位置</small>
      </> : <p className="desktop-install-hint">桌面组件目前支持 Windows 10 / 11（64 位）。请在 Windows 电脑上打开此页面安装。</p>}
    </dialog>
  </>;
}
