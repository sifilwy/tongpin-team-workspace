# 网页添加桌面组件

个人日程页顶部添加“添加桌面组件”按钮。弹框提供 Windows 安装包与已安装组件的打开链接，非 Windows 设备显示支持范围，关闭按钮和 Esc 可关闭。此处的“快捷键”按上下文实现为可点击入口，不添加全局键盘快捷键。

安装器将八个白名单程序文件解压到当前用户 TongpinWidget/Versions/载荷哈希目录，保留登录 profile、日程和位置。创建桌面快捷方式，在 HKCU/Software/Classes/tongpin-widget 注册当前版本；网页传入固定 URI，程序仅接受 open，无任意 URL 导航或命令执行。升级通过命名事件请求原生组件正常退出；旧版不支持时明确要求先从托盘退出。安装器不修改壁纸、任务栏设置或开机启动。

验证：

- 构建及 32 个 Node 测试通过；浏览器测试覆盖入口、下载文件名、协议链接、打开失败说明、关闭/Esc、非 Windows 提示、移动布局。
- 本机执行安装器载荷校验及安装，两次重复安装通过。桌面快捷方式和协议命令指向同一版本，系统实际调用 tongpin-widget://open 后组件已打开并同步。
- 更新后的原生验证通过独立窗口、任务栏隐藏、拖动缩放、最小化恢复、同步、截图非黑屏、小圆点及关闭。
- 公网 HTTPS 安装包 SHA256 与发布清单一致；真实页面“个人日程”入口、弹框、两个链接和关闭验证通过。
- 离线模拟域名的 Edge 下载事件返回 canceled，没有绕过下载保护。安装包当前没有代码签名，首次下载/运行可能需要浏览器或系统处理，不能声称网页能静默安装。实际公网字节通过 HTTPS 独立核验。

以生产 shared-notes/source 为基础，仅叠加本次页面入口和安装包，保留重复日程共享备注功能。首次视觉检查发现全局 reset 把 dialog 放在左上角，补上 margin:auto 并重新发布。发布镜像最终使用 20260909-desktop-install-v2，安装包清单见 public/downloads/widget-release.json。

Windows 协议机制参考 [Microsoft 的协议处理器说明](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/URLProtocolHandler/explainer.md)。浏览器确认由浏览器管理，不设置自动跳过确认的策略。
