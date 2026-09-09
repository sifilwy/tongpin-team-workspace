# 隐藏组件任务栏图标

按用户要求，将日程主窗口和小圆点的 ShowInTaskbar 都设为 false，保留托盘、桌面快捷方式以及小圆点展开入口。托盘“展开日程”改用 Reveal，也能恢复已最小化的主窗口。

不恢复 Explorer 挂接。验证要求窗口无 WS_CHILD，窗口 owner 为空或属于本进程（允许 WinForms 为隐藏任务栏项创建自己的隐藏 owner），不接受跨进程 owner；同时要求两个表面的 ShowInTaskbar 为 false 且没有 WS_EX_APPWINDOW。

构建和原生验证通过：无任务栏图标样式、独立窗口、拖动缩放、Esc 取消、最小化恢复、HTTPS 同步、非黑屏截图、圆点收起展开、关闭。已替换桌面快捷方式对应的程序并重新打开。网站无需重新发布。
