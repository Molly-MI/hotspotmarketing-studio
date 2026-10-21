const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}

async function requestJson(request) {
  try {
    return { value: await request.json() };
  } catch {
    return { error: jsonResponse(400, { error: { message: '请求体不是合法 JSON' } }) };
  }
}

function methodNotAllowed() {
  return jsonResponse(405, { error: { message: '请求方法不支持' } });
}

async function jsonStoreRoute(request, store, key, validate) {
  if (request.method === 'GET') return jsonResponse(200, await store.getJson(key, {}));
  if (!['PUT', 'POST'].includes(request.method)) return methodNotAllowed();
  const body = await requestJson(request);
  if (body.error) return body.error;
  const message = validate?.(body.value);
  if (message) return jsonResponse(400, { error: { message } });
  await store.putJson(key, body.value);
  return jsonResponse(200, { ok: true, ...(key === 'prompts' ? { updatedAt: body.value.updatedAt || null } : {}) });
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;

  if (url.pathname === '/api/config' && request.method === 'GET') {
    return jsonResponse(200, {
      hasServerKey: Boolean(env.DEEPSEEK_API_KEY || env.LLM_API_KEY),
      defaultBaseUrl: env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
      defaultModel: env.LLM_MODEL || 'deepseek-chat',
      liveNews: true,
    });
  }

  const storedRoutes = new Set([
    '/api/prompts', '/api/products', '/api/datasets', '/api/news/sources', '/api/eval-runs', '/api/events',
  ]);
  if (!storedRoutes.has(url.pathname)) return jsonResponse(404, { error: { message: 'API 不存在' } });

  const store = env.HOTSPOT_STORE ? createStore(env.HOTSPOT_STORE) : null;
  if (!store) return jsonResponse(503, { error: { message: 'KV 存储尚未绑定' } });

  if (url.pathname === '/api/prompts') {
    return jsonStoreRoute(request, store, 'prompts', data =>
      !data || typeof data.system !== 'string' ? '缺少 system 字段,拒绝写入' : null);
  }
  if (url.pathname === '/api/products') {
    return jsonStoreRoute(request, store, 'products', data =>
      !Array.isArray(data?.products) || !data.products.length ? '缺少 products 数组,拒绝写入' : null);
  }
  if (url.pathname === '/api/datasets') {
    return jsonStoreRoute(request, store, 'datasets', data =>
      !data || (!Array.isArray(data.cases) && !Array.isArray(data)) ? '缺少 cases 数组,拒绝写入' : null);
  }
  if (url.pathname === '/api/news/sources') {
    return jsonStoreRoute(request, store, 'sources', data =>
      !Array.isArray(data?.sources) ? '缺少 sources 数组,拒绝写入' : null);
  }
  if (url.pathname === '/api/eval-runs') {
    if (request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        const run = await store.getEvalRun(id);
        return run ? jsonResponse(200, run) : jsonResponse(404, { error: { message: '运行记录不存在' } });
      }
      return jsonResponse(200, await store.listEvalRuns());
    }
    if (request.method !== 'POST') return methodNotAllowed();
    const body = await requestJson(request);
    if (body.error) return body.error;
    if (!body.value || !Array.isArray(body.value.results)) return jsonResponse(400, { error: { message: '缺少 results 字段' } });
    const saved = await store.saveEvalRun(body.value);
    return jsonResponse(200, { ok: true, id: saved.id });
  }
  if (url.pathname === '/api/events') {
    if (request.method === 'GET') return jsonResponse(200, await store.getEvents(url.searchParams.get('limit')));
    if (request.method === 'DELETE') {
      await store.clearEvents();
      return jsonResponse(200, { ok: true });
    }
    if (request.method !== 'POST') return methodNotAllowed();
    const body = await requestJson(request);
    if (body.error) return body.error;
    if (!body.value || !['generate', 'publish', 'crawl', 'eval'].includes(body.value.type))
      return jsonResponse(400, { error: { message: 'type 必须是 generate/publish/crawl/eval' } });
    await store.appendEvent({ ...body.value, at: body.value.at || new Date().toISOString() });
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(404, { error: { message: 'API 不存在' } });
}
import { createStore } from './storage.mjs';

