# 2026-09-07 同频上线记录

- 正式入口：https://yanxue-sync.top
- 新镜像：`tongpin-team-workspace:20260907-schedule-fix`
- 运行容器：`tongpin-team-workspace-web`
- 端口：`127.0.0.1:4318 -> 4200`，由现有 Caddy 代理；旧公网 4200 已关闭。
- 环境：`TONGPIN_PUBLIC_ORIGIN=https://yanxue-sync.top`
- 数据挂载保持 `/opt/apps/tongpin-team-workspace/data:/app/data`。
- 源码包 SHA256：`1677C49FB6BAEF91BBCE918B333853ED3514997DCE13124F39BB881E090B4B11`。本次使用本机工作区源码包发布，尚未提交 Git，也未推送 GitHub。

## 验证结果

- 服务器 Docker 镜像构建成功。
- 有效证书的 HTTPS 首页返回 200，未登录接口返回 401。
- HTTPS 登录、Secure/HttpOnly Cookie、四类共享文档读取、退出及会话失效验证通过。
- 本机 Edge 通过公网 HTTPS 登录，五名成员顺序和切换、编辑弹窗分类、刷新验证通过，无运行时异常。测试未保存业务修改，会话已退出。
- 上线前后全部共享文档和邀请码身份映射逐项比较一致。
- HTTP 自动 308 跳转 HTTPS；www 自动 308 跳转正式域名。
- 保留 `/fitness-api` 路由，其根路径代理响应与后端一致（均为 404）；未做该应用完整业务测试。
- 原研学根页面路由已由同频替代，旧研学容器、卷和数据未删除。
- 旧同频 4200 无本机监听，新应用仅绑定 loopback 地址。

## 备份与回退资料

服务器目录 `/opt/apps/tongpin-team-workspace/releases/20260907-schedule-fix` 包含发布源码包、构建日志、`data.before` 一致性备份、`Caddyfile.before`、`Caddyfile.next` 和原容器配置 `container.before.json`。该目录仅管理员可访问，包含敏感数据的文件不得公开或提交。

旧容器保留为 `tongpin-before-20260907-schedule-fix`，已停止并设置 `restart=no`；旧镜像仍保留。回退前先备份新增业务数据，不应直接用上线前备份覆盖后续任务。旧版本没有本次 HTTPS Origin 适配，不能直接重启旧公网 HTTP 入口让成员登录；回退需保留 HTTPS 并验证来源校验、Cookie 和数据挂载。

## 仍未覆盖

未在线上创建或修改真实任务，未做真实多人同时编辑、拖拽或全面视觉验收。新增和编辑保存的组件行为、并发合并等已由本机测试覆盖。

此前自动审批拒绝本地测试服务的记录仍保留于 `personal-schedule-regression.md`。本次远程部署和 HTTPS 验证调用获准执行，未通过公网 HTTP 发送任何凭据，未删除历史审计记录。
