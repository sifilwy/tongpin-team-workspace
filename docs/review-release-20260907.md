# 复盘入口与旧服务清理

日期：2026-09-07。正式入口：https://yanxue-sync.top。

## 复盘

总结复盘页面增加填写入口。每条复盘保存正文、作者和时间，团队成员可查看。仅在服务器确认保存成功后清空输入；失败时显示提示并保留文字。保存读取最新版本，遇到并发冲突最多重试三次，不覆盖其他成员新增记录。刷新或重新进入页面加载最新记录。

存储文档为 `tongpin-review-notes-v1`，与现有任务数据共同保存在同频数据目录。服务端校验非空及一万字长度限制，并设置真实登录作者和服务器时间。

最终镜像：`tongpin-team-workspace:20260907-review2`。运行容器仍为 `tongpin-team-workspace-web`，仅绑定 `127.0.0.1:4318`。此次发布目录为 `/opt/apps/tongpin-team-workspace/releases/20260907-review`，包含构建日志、最终源码目录和升级前数据备份；最初 `source.tgz` 为 review1，最终源码以 `source/` 和 Git 提交为准。

验证：生产构建、14 项 Node 测试、离线浏览器交互测试通过；公网 HTTPS 浏览器完成登录、五名成员日程、复盘提交和刷新后读取验证。临时验证复盘已定向删除，测试会话已退出。未修改真实任务。

## 用户授权删除的旧服务

- 删除健身容器：`form-fitness-api`、`form-fitness-scheduler`、`form-fitness-backup`、`form-fitness-db`。
- 删除健身专用卷：`form_fitness_uploads`、`form_fitness_backups`、`form_fitness_db`，以及专用网络 `form-fitness`。
- 删除目录：`/opt/apps/form-fitness`、`/opt/apps/form-fitness-build-0.3.9`、`/opt/apps/form-fitness-release-0.3.9`。
- 删除抽奖容器 `yanxue-sync` 和目录 `/opt/apps/yanxue-sync`，包括其专用数据。
- 删除健身应用镜像 0.2.0、0.2.1、0.3.0 至 0.3.9；删除抽奖 `lottery-only` 和 `latest` 镜像。

清理前核对了所有容器挂载及健身网络成员；这些目录和卷不被同频、儿陪师应用使用。未执行全局 Docker prune。

## HTTPS 代理保留

原 Caddy 配置迁至 `/opt/apps/tongpin-team-workspace/Caddyfile`，代理容器更名为新建的 `tongpin-caddy`，旧 `yanxue-caddy` 容器已删除。证书和代理配置卷 `yanxue_caddy_data`、`yanxue_caddy_config` 继续使用，名称虽保留旧前缀，实际服务于同频，不属于可删除的抽奖数据。

已移除健身、抽奖路由；保留同频主域名和 www 到主域名的 HTTPS 跳转。儿陪师和搜索服务未改动。

回退同频应用可使用保留的 `tongpin-before-review-20260907` 对应镜像和现有数据挂载。操作前备份当前新增数据，保持 HTTPS 和内部端口，不恢复已授权删除的健身或抽奖服务。不要使用首次复盘尝试的 `tongpin-review1-retired` 作为回退版本。
