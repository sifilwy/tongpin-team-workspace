# 同频工作台

面向五人团队的任务分配、周时间线、沟通、已完成归档与个人日程系统。

## 当前功能

- 协作总览：待安排任务、人员分配、任务沟通与已完成归档。
- 任务时间线：按周查看与拖动任务，支持上下周和完成状态。
- 总结复盘：为后续团队复盘保留独立入口。
- 个人日程：xzx 与 czl 的独立待办、分类、时间安排和全员辅助视角。
- 数据目前保存在浏览器本地存储中，不包含登录和云端数据库。

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
  -p 4200:4200 \
  tongpin-team-workspace:latest
```

应用容器使用非 root 用户运行，不依赖研学 Lottery、OpenClaw 或其他项目的数据和网络。

## 数据与隐私

不要提交 `.env*`、私钥、Token、聊天导出、`public/orders.json` 或其他用户隐私数据。当前任务数据位于每台浏览器的本地存储，清除浏览器数据会同时清除未导出的任务。
