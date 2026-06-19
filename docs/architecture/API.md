# 本地 API v1

基础路径：`/api/v1`

## 系统

- `GET /health`：服务状态和版本。
- `GET /system/config`：作品库位置及是否完成初始化。
- `PUT /system/config`：更新作品库和备份目录。

## 系列与场景

- `GET /series`
- `POST /series`
- `GET /series/:seriesId`
- `POST /series/:seriesId/scenes`
- `GET /series/:seriesId/scenes/:sceneId`
- `PUT /series/:seriesId/scenes/:sceneId`
- `POST /series/:seriesId/index/rebuild`
- `GET /series/:seriesId/search?q=`

所有写入使用 Zod 验证。场景更新必须传 `baseRevision`；冲突返回 HTTP 409 和当前版本。

M4 后的长任务返回 job ID，并通过 `GET /jobs/:jobId/events` 的 SSE 流输出状态。API 不向局域网公开。

