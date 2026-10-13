# 生活任务分类

团队任务分类增加“生活”，新建、编辑、时间线分类筛选、人员分类看板及已完成分组统一使用分类列表。添加粉色分类样式，覆盖卡片、标签和已完成分组。个人日程的自定义分类独立维护，不改变既有个人分类。

生产构建通过。发布镜像 `tongpin-team-workspace:20261014-life-category`，发布目录 `/opt/apps/tongpin-team-workspace/releases/20261014-life-category` 保存原环境、容器配置和数据备份。旧容器保留为 `tongpin-before-20261014-life-category`，停止且 restart=no。部署保留原数据挂载和全部记录，不做数据迁移。
