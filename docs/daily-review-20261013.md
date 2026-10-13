# 每日总结复盘

## 编辑与排版修复

“继续编辑”选择原日期后自动滚动到输入框并聚焦；点击正在编辑的同一天不会重置草稿。已保存内容使用独立块元素和 `white-space: break-spaces`，保留连续空格、换行及空白行。浏览器测试检查实际按钮点击、焦点、滚动可见性、原文和计算后的样式。当前发布镜像 `tongpin-team-workspace:20261013-review-edit`，同名发布目录含数据备份；原服务容器保留为 `tongpin-before-20261013-review-edit`。

## 后续纠正：第三栏全员共享

用户确认第三栏为所有成员可见，现改为 `tongpin-daily-review-v1:team` 的团队每日复盘，所有已登录成员可查看及编辑，同日冲突保护继续生效。旧私人键保持原权限和数据，不自动公开其内容；人格改变不变。页面标注“全员可见、共同编辑”。五成员读写共享文档的 API 测试及浏览器保存流程通过。

当前镜像 `tongpin-team-workspace:20261013-shared-review`，备份目录 `/opt/apps/tongpin-team-workspace/releases/20261013-shared-review`，旧容器 `tongpin-before-20261013-shared-review`。以下为首次实现记录，隐私模式已由本节更正。

“总结复盘”入口改为独立的每日写作空间，参考人格改变的视觉样式。默认今天，可选择日期、保存当天内容，在往日记录里继续编辑。一天一个记录，重复保存更新同一天，不关联任务。各成员只可读写自己的记录。

使用独立键 `tongpin-daily-review-v1:<member>`，服务端校验成员身份、真实日期、每项一万字及修订号。保存时保留其他日期的最新内容；同一天发生冲突时保留输入并提示核对，不自动覆盖其他页面的修改。网络失败保留输入，切换日期和离开页面提示未保存内容，切换工作台栏目保留草稿。原任务复盘和人格改变数据不迁移、不删除。

验证：生产构建通过；47 项自动测试通过；独立浏览器测试覆盖保存、日期隔离、编辑不重复、重新挂载、网络重试、并发冲突、其他日期合并、手机布局；已检查手机截图。完整 TypeScript 检查受仓库原有 Cloudflare 类型缺失以及 work 目录旧副本影响而未通过，报错不涉及新增组件。

部署镜像 `tongpin-team-workspace:20261013-daily-review`。发布目录 `/opt/apps/tongpin-team-workspace/releases/20261013-daily-review`，原数据备份 `data.before`，保留旧容器 `tongpin-before-20261013-daily-review`（停止且 restart=no）。保留原环境、数据挂载及 Caddy 配置，其他网站未变更。不要使用旧数据备份覆盖后续业务记录。
