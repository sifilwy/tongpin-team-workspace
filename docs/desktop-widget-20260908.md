# Windows 桌面日程组件

用户明确要求嵌入桌面背景后，新增独立 Windows 原生宿主 `desktop-widget/Widget.cs`，通过 WebView2 展示已有 HTTPS `/desktop`。本次没有更改网站代码或重新部署服务器。

组件窗口通过 GetShellWindow / SetParent 成为 Progman 的 WS_CHILD 子窗口，不设置 WS_EX_TOPMOST。右侧显示可交互的日程面板，菜单及托盘提供刷新、临时解除固定以移动位置、重新固定、恢复右侧、退出。关闭时释放托盘和 WebView2，不改壁纸文件，也不创建快捷方式或设置开机启动。

使用 .NET Framework 编译器及版本固定为 1.0.4191.47 的微软 WebView2 SDK。构建命令 `node desktop-widget/build.mjs`；输出包含原生程序、三个 DLL、微软许可证和使用说明。

身份验证保持网站原有邀请码机制。正常使用时在网站表单中登录；本机初始化允许从重定向标准输入一次性接收邀请码，通过验证证书的 HTTPS、TLS 1.2 登录原站。仅导入同站 Secure/HttpOnly/SameSite=Strict 会话 Cookie。没有把邀请码写入源码、命令行、报告或 Git。独立 WebView2 资料保存在当前用户 LocalAppData/TongpinWidget/WebView2。

## 实机验证

2026-09-08 在 Windows 11 26100、200% 显示缩放的本机验证：

- 本地编译成功。
- `--verify` 运行独立验证资料目录，确认窗口父级为 Progman、具备 WS_CHILD 且没有 WS_EX_TOPMOST。
- 通过 HTTPS 登录并读取真实 xzx 日程；上一周及回到今天的日期选择有效。
- 等待一个同步周期后，页面更新时间变化，自动同步有效。
- 截取 WebView2 页面并检查中文、布局、时间和完成状态；没有截图桌面整体，因此不把截图作为图标遮挡关系的验证依据。
- 解除固定后父级为空，重新固定后父级回到桌面，验证通过。
- 最终程序安装到 LocalAppData/TongpinWidget/App 并启动；本机报告 `state: synced`、`attached: true`、`parentClass: Progman`、`topmost: false`，进程正常响应。

本次安装运行的是新编译的桌面组件，不是之前被自动审批拒绝的 Edge 应用快捷方式操作；没有重试该快捷方式创建或启动操作。用户移走 URL 文件以及其他任务产生的个人日程代码改动未包含在本次提交中。

## 边界

首次运行需要联网及有效邀请码。网站会话过期后仍需重新登录。桌面 Shell 的生命周期由 Windows 管理，若 Explorer 重启导致组件退出，重新运行程序即可。多显示器的恢复右侧操作以主屏幕为准。没有创建自动启动项。

实现参考：

- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getshellwindow
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/winforms
