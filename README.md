# 同频工作台

面向五人团队的任务分配、周时间线、沟通、已完成归档与个人日程系统。

## 当前功能

- 协作总览：待安排任务、人员分配、任务沟通与已完成归档。
- 任务时间线：按周查看与拖动任务，支持上下周和完成状态。
- 总结复盘：填写团队复盘，保存后显示作者、时间和正文；刷新后可继续查看。
- 个人日程：xzx、吃吃、czl、子涵、悦悦的独立待办、分类、时间安排和全员辅助视角。
- 每人使用邀请码登录，团队数据保存在服务器挂载目录中；浏览器保留本地同步备份。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

生产构建与测试：

```bash
npm test
```

## Docker

```bash
docker build -t tongpin-team-workspace:latest .
docker run -d --name tongpin-team-workspace-web \
  --restart unless-stopped \
  --memory 768m --cpus 1.0 \
  -p 127.0.0.1:4318:4200 \
  -v /opt/apps/tongpin-team-workspace/data:/app/data \
  -e TONGPIN_PUBLIC_ORIGIN=https://yanxue-sync.top \
  tongpin-team-workspace:latest
```

应用容器使用非 root 用户运行，不依赖研学 Lottery、OpenClaw 或其他项目的数据和网络。

上面的命令用于理解运行配置，不要直接覆盖已有容器。升级前备份数据和代理配置，保留旧镜像，确认数据目录允许容器用户 1000 写入。通过 Caddy 的 HTTPS 入口访问，禁止将邀请码发送到公网 HTTP。

## 数据与隐私

不要提交 `.env*`、私钥、Token、聊天导出、`public/orders.json` 或其他用户隐私数据。服务器持久化目录与恢复说明见 `docs/team-access.md`。浏览器尚未同步的修改仍可能在清除浏览器数据后丢失。
