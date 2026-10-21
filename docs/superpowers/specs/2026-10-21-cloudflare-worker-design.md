# Cloudflare Worker 无服务器迁移设计

## 目标

将热点营销工作台从阿里云深圳常驻 Node 服务迁移到 Cloudflare Worker，以消除对该服务器、Nginx 和本地磁盘的依赖，同时保留服务端 LLM 密钥代理、实时热点抓取和后台数据管理能力。

## 已知约束

- 前端继续使用现有相对 API 路径，不要求用户重新配置浏览器。
- `DEEPSEEK_API_KEY` 只能保存为 Cloudflare 的加密 Secret，任何 API 响应、静态资源和浏览器脚本均不得包含该值。
- Worker 不能使用 Node `fs`、`http`、`https` 或常驻进程；持久数据必须写入 Cloudflare KV。
- 当前本地 `server.js` 保留，用于本地开发；Cloudflare 运行时不执行该文件。
- 静态站点的页面与脚本继续由同一域名提供；所有 `/api/*` 请求先交由 Worker，其余请求回退给静态资源绑定。
- 公开热点源仍可能临时拒绝边缘网络请求；单个源失败必须作为来源状态返回，不能令整个抓取接口失败。

## 架构

```text
浏览器
  ├── 静态页面、JS、CSS ──> Cloudflare 静态资源绑定
  └── /api/* ─────────────> Cloudflare Worker
                                 ├── LLM 上游（DeepSeek）
                                 └── HOTSPOT_STORE（Cloudflare KV）
```

Worker 是唯一的动态入口。它根据路径派发 API 请求；未命中的非 API GET 请求由 `ASSETS.fetch()` 返回现有静态文件。LLM 代理使用 Worker `fetch()` 透传上游流式响应，保留 `text/event-stream`，且仅从 `context.env.DEEPSEEK_API_KEY` 读取默认密钥。

## 接口兼容性

以下接口保持原有 URL、方法和响应字段：

| 接口 | 方法 | Worker 行为 |
| --- | --- | --- |
| `/api/config` | GET | 返回 `hasServerKey`、默认模型和 `liveNews: true`。 |
| `/api/llm` | POST | 验证 `messages` 与受限 `baseUrl`，使用 Secret 或前端临时 Key 转发 DeepSeek；流式响应直接透传。 |
| `/api/prompts` | GET、PUT、POST | 读写 KV 键 `prompts`。 |
| `/api/products` | GET、PUT、POST | 读写 KV 键 `products`，写入时要求非空 `products` 数组。 |
| `/api/datasets` | GET、PUT、POST | 读写 KV 键 `datasets`。 |
| `/api/news/sources` | GET、PUT、POST | 读写 KV 键 `sources`；无自定义值时返回内置抓取源。 |
| `/api/eval-runs` | GET、POST | 运行记录按 `eval:<id>` 存储，`eval:index` 保存倒序索引。 |
| `/api/events` | GET、POST、DELETE | JSON 数组保存在 `events`，最多保留最近 5,000 条。 |
| `/api/news` | GET | 使用 Worker `fetch()` 拉取内置热榜/RSS，聚合、去重、风险标注后返回。 |

所有 JSON API 都返回 `Cache-Control: no-store`。不支持的方法返回 405；非法 JSON 返回 400；上游 LLM/抓取失败返回明确的错误 JSON。

## 数据模型与迁移

KV 绑定名固定为 `HOTSPOT_STORE`。键名均为单一项目命名空间：`prompts`、`products`、`datasets`、`sources`、`events`、`eval:index` 和 `eval:<id>`。

现有服务器的未跟踪运行数据不自动迁移，因为它不在 Git 仓库中且迁移会要求访问服务器文件。前端已有 localStorage 回退；首次部署时没有 KV 值则返回空对象或内置默认抓取源，行为与现有服务一致。以后如需迁移历史数据，单独导出 JSON 后导入 KV。

## 文件边界

- `worker/worker.mjs`：Cloudflare `fetch` 入口；将 API 请求交给处理器、静态请求交给 `ASSETS`。
- `worker/src/handler.mjs`：路由、JSON 响应、LLM 转发与存储 API。
- `worker/src/storage.mjs`：KV JSON、运行记录索引与事件列表的读写。
- `worker/src/news.mjs`：Worker 兼容的热点/RSS 获取、解析、去重和风险识别。
- `wrangler.jsonc`：Worker 名称、静态资源目录、KV 绑定和兼容日期；不包含密钥或实际 KV ID。
- `test/worker-handler.test.mjs`：使用 Node 内置测试框架和内存 KV 验证处理器。
- `README.md`：补充 Cloudflare 无服务器部署、KV 创建、Secret 设置和自定义域名步骤。

## 部署流程

1. 推送 GitHub 后，在 Cloudflare 创建 Worker 项目并连接该仓库。
2. 创建一个 KV 命名空间，将其绑定为 `HOTSPOT_STORE`。
3. 为生产环境设置加密 Secret `DEEPSEEK_API_KEY`；不得将密钥提交到 Git 或发送到聊天中。
4. 部署 Worker，先访问其 `workers.dev` 地址验证 `/api/config` 与首页。
5. 将 `hotspot.hielise.tech` 绑定到该 Worker；移除该子域名指向阿里云的 A 记录或将其替换为 Worker 路由。

## 验收标准

1. Worker 部署后，首页响应含 `热点营销工作台`，不再出现 `Non-compliance ICP Filing` 页面。
2. `/api/config` 在 Secret 存在时只返回 `hasServerKey: true`，绝不返回密钥值。
3. 不带 API Key 的 `/api/llm` 使用 Worker Secret；带临时 Key 的请求仍可工作；流式请求响应保持 `text/event-stream`。
4. 提示词、商品、数据集、抓取源、评测记录和事件在 Worker 重启/再次部署后仍可读取。
5. 热点接口某一来源失败时，其他来源结果仍返回，失败原因在 `sources` 中可见。
6. 自动化测试覆盖：Secret 不泄露、KV 写后可读、非法输入为 400、方法不支持为 405、事件上限以及 LLM 上游错误。

## 非目标

- 不在本次迁移中删除阿里云服务器、Nginx、Docker 或历史证书配置。
- 不迁移未导出的服务器私有数据。
- 不增加用户登录、支付、定时任务或第三方数据库。
- 不保证中国大陆网络对海外边缘服务的连通性或性能；本迁移的直接目标是移除当前阿里云源站触发的 ICP 拦截页。
