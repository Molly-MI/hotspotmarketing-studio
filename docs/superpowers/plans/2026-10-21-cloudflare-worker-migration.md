# Cloudflare Worker 无服务器迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将热点营销工作台部署为 Cloudflare Worker 静态站点和边缘 API，移除生产环境对阿里云常驻服务器与本地文件系统的依赖。

**Architecture:** `worker/worker.mjs` 拦截 `/api/*` 并调用可测试的处理器；非 API 请求经 Cloudflare `ASSETS` 绑定返回现有静态资源。持久配置与业务记录经 `HOTSPOT_STORE` KV 保存，LLM Secret 只在 Worker 环境中读取，热点抓取使用 Workers 原生 `fetch()`。

**Tech Stack:** JavaScript ES modules、Cloudflare Workers、Cloudflare KV、Wrangler 配置、Node 内置 `node:test`。

**Spec:** `docs/superpowers/specs/2026-10-21-cloudflare-worker-design.md`

## Global Constraints

- 现有页面继续通过相对 `/api/*` URL 调用后端，禁止将 DeepSeek Key 发送给浏览器。
- Worker 代码不得依赖 Node `fs`、`http`、`https`、`zlib` 或常驻进程。
- KV 绑定名固定为 `HOTSPOT_STORE`；实际 namespace ID 与密钥不得提交。
- `server.js` 及本地开发路径保持可用，本次不删除阿里云或 Docker 配置。
- 所有 JSON API 返回 `Cache-Control: no-store`；错误均为 JSON 且不泄露 Secret。

## Review Focus

- 未设置 `DEEPSEEK_API_KEY` 时，`/api/config` 只能返回布尔状态，`/api/llm` 必须以 400 拒绝且不暴露环境内容。
- KV 中缺少值、损坏 JSON 或超大事件列表时，接口应返回安全的默认值或受控错误，而不是崩溃。
- 流式上游响应必须保留 `text/event-stream` 与响应体，不能先完整缓冲。
- 单个热点来源超时、返回非 200 或无效 JSON 时，其他来源的结果仍应返回。
- API 路径以外的 GET 请求必须回退为静态资源；未知 API 路径不得错误地返回 `index.html`。

---

### Task 1: 建立 Worker 路由与静态资源回退

**Files:**
- Create: `worker/worker.mjs`
- Create: `worker/src/handler.mjs`
- Create: `test/worker-handler.test.mjs`
- Create: `wrangler.jsonc`

**Interfaces:**
- Consumes: `env.ASSETS.fetch(request)` 与 `env.HOTSPOT_STORE`。
- Produces: `export default { fetch(request, env, ctx) }`；`handleApi(request, env, deps)` 返回 `Response | null`。

- [ ] **Step 1: 写入失败测试，定义 API 与静态路由边界**

在 `test/worker-handler.test.mjs` 中断言 `/api/config` 返回 JSON、未知 `/api/not-found` 返回 JSON 404、普通 GET 由 `ASSETS.fetch()` 接管。

- [ ] **Step 2: 运行测试，确认因处理器不存在而失败**

Run: `node --test test/worker-handler.test.mjs`

Expected: FAIL，提示 `worker/src/handler.mjs` 或导出函数不存在。

- [ ] **Step 3: 实现 API 分派与静态资源回退**

在 `worker/src/handler.mjs` 实现 `handleApi(request, env, deps)`；在 `worker/worker.mjs` 中仅将 `/api/` 请求交给它，其他请求调用 `env.ASSETS.fetch(request)`。在 `wrangler.jsonc` 声明 `ASSETS` 静态资源目录、Worker 入口、KV 占位绑定与兼容日期。

- [ ] **Step 4: 运行路由测试，确认通过**

Run: `node --test test/worker-handler.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交路由基础设施**

```bash
git add worker/worker.mjs worker/src/handler.mjs test/worker-handler.test.mjs wrangler.jsonc
git commit -m "feat: add Cloudflare Worker API routing"
```

### Task 2: 实现 KV JSON、事件与评测记录存储

**Files:**
- Create: `worker/src/storage.mjs`
- Modify: `worker/src/handler.mjs`
- Modify: `test/worker-handler.test.mjs`

**Interfaces:**
- Consumes: KV 兼容对象 `{ get(key), put(key, value), delete(key) }`。
- Produces: `createStore(kv)`，包含 `getJson`、`putJson`、`listEvalRuns`、`saveEvalRun`、`getEvents`、`appendEvent`、`clearEvents`。

- [ ] **Step 1: 写入失败测试，覆盖 KV 写读、验证和事件上限**

使用内存 KV 测试替身，断言 prompts PUT 后 GET 相等，products 空数组为 400，事件追加后可读取且最多保留 5,000 条，评测运行按 `savedAt` 倒序返回。

- [ ] **Step 2: 运行测试，确认因存储实现缺失而失败**

Run: `node --test test/worker-handler.test.mjs`

Expected: FAIL，提示 KV 路由或存储 API 尚未实现。

- [ ] **Step 3: 实现 KV 存储与兼容 API**

在 `storage.mjs` 使用规格定义的键名存取 JSON；在 handler 中实现 prompts、products、datasets、news sources、eval runs 与 events 的原 URL/方法/验证规则。

- [ ] **Step 4: 运行存储测试，确认通过**

Run: `node --test test/worker-handler.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交 KV 存储实现**

```bash
git add worker/src/storage.mjs worker/src/handler.mjs test/worker-handler.test.mjs
git commit -m "feat: persist studio data in Cloudflare KV"
```

### Task 3: 实现密钥安全的 LLM 代理与流式透传

**Files:**
- Modify: `worker/src/handler.mjs`
- Modify: `test/worker-handler.test.mjs`

**Interfaces:**
- Consumes: `env.DEEPSEEK_API_KEY`、`env.LLM_BASE_URL`、`env.LLM_MODEL` 与可注入 `deps.fetch`。
- Produces: `POST /api/llm` 和 `GET /api/config` 响应。

- [ ] **Step 1: 写入失败测试，覆盖 Secret 隐藏、无 Key 拒绝与 SSE 转发**

断言 `/api/config` 只含 `hasServerKey: true` 而没有 Secret 文本；无前端 Key 且无 Secret 时 `/api/llm` 返回 400；模拟上游 SSE 时响应为 `text/event-stream` 且正文未被改变。

- [ ] **Step 2: 运行测试，确认 LLM 接口尚未满足期望而失败**

Run: `node --test test/worker-handler.test.mjs`

Expected: FAIL，指向缺失的 `/api/llm` 或 `/api/config` 行为。

- [ ] **Step 3: 实现 LLM 验证和转发**

验证 JSON、非空 `messages` 及仅 HTTPS 或 localhost 的 `baseUrl`；构造 OpenAI 兼容请求，优先使用前端临时 Key，否则使用 `env.DEEPSEEK_API_KEY`。使用 Worker `fetch` 直接返回上游 `ReadableStream`，并设置 `Cache-Control: no-store`。

- [ ] **Step 4: 运行 LLM 测试，确认通过**

Run: `node --test test/worker-handler.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交 LLM 代理实现**

```bash
git add worker/src/handler.mjs test/worker-handler.test.mjs
git commit -m "feat: proxy LLM requests through Worker secrets"
```

### Task 4: 将热点抓取迁移到 Workers Fetch

**Files:**
- Create: `worker/src/news.mjs`
- Modify: `worker/src/handler.mjs`
- Modify: `test/worker-handler.test.mjs`

**Interfaces:**
- Consumes: `fetchImpl(url, init)`、自定义 sources 和可选 `force`。
- Produces: `crawlNews(sources, options)`，返回 `{ at, sources, items, riskCount, cached }`。

- [ ] **Step 1: 写入失败测试，覆盖一源失败时的部分成功结果**

模拟一个成功 RSS 源和一个网络失败源，断言 `/api/news` 返回成功条目、失败来源状态和风险字段，不因单源失败改为 502。

- [ ] **Step 2: 运行测试，确认抓取模块不存在而失败**

Run: `node --test test/worker-handler.test.mjs`

Expected: FAIL，提示 `crawlNews` 未定义或 `/api/news` 未实现。

- [ ] **Step 3: 实现 Worker 兼容抓取器**

将现有内置来源、RSS 解析、标题去重和风险词逻辑迁入 `worker/src/news.mjs`；用 `fetch`、`AbortSignal.timeout`（或等价超时）及内存 60 秒缓存替换 Node 网络和压缩流代码。handler 从 KV 读取自定义来源，缺失时回退内置来源。

- [ ] **Step 4: 运行抓取测试，确认通过**

Run: `node --test test/worker-handler.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交热点抓取迁移**

```bash
git add worker/src/news.mjs worker/src/handler.mjs test/worker-handler.test.mjs
git commit -m "feat: crawl hotspot sources from Cloudflare Worker"
```

### Task 5: 文档化 Cloudflare 部署并执行完整验证

**Files:**
- Modify: `README.md`
- Modify: `test/worker-handler.test.mjs`

**Interfaces:**
- Consumes: 已完成的 Worker、KV 绑定和 Cloudflare Secret。
- Produces: 清晰的 GitHub 连接部署、KV 绑定、Secret 设置与自定义域名切换操作说明。

- [ ] **Step 1: 写入失败测试，覆盖上游 LLM 失败与未知 API 路径**

模拟上游 `fetch` 抛错，断言返回 502 JSON；断言未知 `/api/*` 路径返回 404 JSON。

- [ ] **Step 2: 运行测试，确认错误语义尚未完整而失败**

Run: `node --test test/worker-handler.test.mjs`

Expected: FAIL，直到错误响应符合断言。

- [ ] **Step 3: 补齐错误处理并更新 README**

记录 Cloudflare Dashboard 中创建 Worker、连接 GitHub、创建并绑定 KV `HOTSPOT_STORE`、设置加密 Secret `DEEPSEEK_API_KEY`、验证 `workers.dev` 与绑定 `hotspot.hielise.tech` 的步骤；明确旧深圳服务器不参与新版本流量。

- [ ] **Step 4: 运行完整测试与语法检查**

Run: `node --test test/worker-handler.test.mjs; node --check worker/worker.mjs; node --check worker/src/handler.mjs; node --check worker/src/storage.mjs; node --check worker/src/news.mjs`

Expected: 全部 PASS，所有语法检查退出码为 0。

- [ ] **Step 5: 提交文档与验证补充**

```bash
git add README.md test/worker-handler.test.mjs worker
git commit -m "docs: add Cloudflare Worker deployment guide"
```
