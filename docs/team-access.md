# 邀请码与共享数据

每人使用独立邀请码进入。邀请码在服务器 `/opt/apps/tongpin-team-workspace/data/invitations.json`，不要提交到 Git 或发到公开群。当前无角色区分，五名成员共同编辑团队数据。

第一次进入时，如果服务器尚无对应数据，会导入当前浏览器原有内容；请 xzx 先使用原来工作的浏览器进入并打开个人日程。浏览器原数据会保存在带 `-before-cloud` 后缀的本地备份中。其他浏览器随后读取服务器内容，旧浏览器中不同的独立副本不会自动全部合并。

数据约每 1.2 秒同步一次。不同字段的并发修改尽量合并；同一字段同时修改仍可能由后一次保存决定。未完成同步时关闭页面会提示。网络异常会显示重试提示。

独立的团队复盘使用明确保存：点击“添加复盘”后等待保存完成，刷新或重新进入页面可查看最新记录；保存失败保留文字。后续复盘发布和旧服务清理情况见 `review-release-20260907.md`。

## 数据及恢复

容器通过独立挂载 `/opt/apps/tongpin-team-workspace/data:/app/data` 持久保存。`workspace.json` 包含任务、邀请码哈希和登录会话；`workspace.previous.json` 是上次写入前的副本。文件不可公开下载。

备份：在服务器执行 `cp -a /opt/apps/tongpin-team-workspace/data /opt/apps/tongpin-team-workspace/data-backup-日期`，使用未占用的备份名称。恢复前只停止 `tongpin-team-workspace-web`，先保留当前 data 目录副本，再将指定备份内的数据恢复到 data，确认属主 1000:1000 后启动该容器。

正式入口为 https://yanxue-sync.top。2026-09-07 修复版通过原 Caddy 的 443 入口访问，应用仅绑定 `127.0.0.1:4318`，旧公网 4200 已关闭。更新前容器保留为停止状态的 `tongpin-before-20260907-schedule-fix`。备份位置、验证范围和回退限制见 `deployment-20260907.md`。
