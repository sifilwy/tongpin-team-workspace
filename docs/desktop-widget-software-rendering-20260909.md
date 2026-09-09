# 排查并处理持续黑屏

用户再次反馈全黑画面。检查时原组件进程仍运行，无对应 Application 崩溃日志；原状态只表示宿主存活，不能作为正常显示的证据。问题疑似桌面父窗口中的 GPU 合成异常，未从日志确定唯一根因。

对此组件单独使用 WebView2 AdditionalBrowserArguments=--disable-gpu 作为黑屏兼容处理，不修改 Windows 或普通 Edge 的图形设置。显示设置变化及从休眠恢复时重新布局、切换 WebView 可见性并重新载入；渲染进程异常记录具体类型，渲染进程退出时尝试重载。

状态探测增加网页响应、同步及无响应状态，不再把每五秒宿主定时器写出的 running 当作页面健康依据。page-synced 仅证明网页读取到同步状态，不证明最终桌面合成画面。

验证通过：软件渲染模式下的真实 HTTPS 页面、自动刷新、移动、缩放、圆点展开和关闭；采样 WebView 截图像素排除全黑；模拟恢复重绘后再次确认页面同步且截图非黑。正式组件已替换重启，实际桌面是否恢复仍需用户确认。

微软文档将 disable-gpu 作为排查渲染问题的选项，并建议一般应用不要常规禁用 GPU。这里是对用户连续出现黑屏的针对性兼容处理；后续若确认无效，需要继续检查桌面合成方式，不能用内部截图通过代替用户实际显示验证。

参考：
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance
