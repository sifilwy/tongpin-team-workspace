# 邀请码与共享数据

每人使用独立邀请码进入。邀请码在服务器 `/opt/apps/tongpin-team-workspace/data/invitations.json`，不要提交到 Git 或发到公开群。当前无角色区分，五名成员共同编辑团队数据。

第一次进入时，如果服务器尚无对应数据，会导入当前浏览器原有内容；请 xzx 先使用原来工作的浏览器进入并打开个人日程。浏览器原数据会保存在带 `-before-cloud` 后缀的本地备份中。其他浏览器随后读取服务器内容，旧浏览器中不同的独立副本不会自动全部合并。

数据约每 1.2 秒同步一次。不同字段的并发修改尽量合并；同一字段同时修改仍可能由后一次保存决定。未完成同步时关闭页面会提示。网络异常会显示重试提示。

## 数据及恢复

容器通过独立挂载 `/opt/apps/tongpin-team-workspace/data:/app/data` 持久保存。`workspace.json` 包含任务、邀请码哈希和登录会话；`workspace.previous.json` 是上次写入前的副本。文件不可公开下载。

备份：在服务器执行 `cp -a /opt/apps/tongpin-team-workspace/data /opt/apps/tongpin-team-workspace/data-backup-日期`，使用未占用的备份名称。恢复前只停止 `tongpin-team-workspace-web`，先保留当前 data 目录副本，再将指定备份内的数据恢复到 data，确认属主 1000:1000 后启动该容器。

上一版应用保留为停止状态的 `tongpin-before-invitations` 容器。新应用独立占用 4200，不改动研学和 80/443。当前访问地址使用 HTTP；邀请码和数据正式使用前应配置独立 HTTPS 入口。
