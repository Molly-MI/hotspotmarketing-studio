import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/worker.mjs';
import { handleApi } from '../worker/src/handler.mjs';
import { createStore } from '../worker/src/storage.mjs';

const env = {
  ASSETS: {
    fetch: async () => new Response('static asset', { status: 200, headers: { 'content-type': 'text/plain' } }),
  },
};

function memoryKv() {
  const data = new Map();
  return {
    async get(key) { return data.get(key) ?? null; },
    async put(key, value) { data.set(key, value); },
    async delete(key) { data.delete(key); },
  };
}

function apiEnv() {
  return { ...env, HOTSPOT_STORE: memoryKv() };
}

test('returns configuration JSON for the existing config endpoint', async () => {
  const response = await handleApi(new Request('https://example.test/api/config'), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    hasServerKey: false,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    liveNews: true,
  });
});

test('returns JSON 404 for an unknown API endpoint instead of static HTML', async () => {
  const response = await handleApi(new Request('https://example.test/api/not-found'), env);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { message: 'API 不存在' } });
});

test('forwards non-API GET requests to the static asset binding', async () => {
  const response = await worker.fetch(new Request('https://example.test/index.html'), env, {});

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'static asset');
});

test('persists prompts through the existing API contract', async () => {
  const storeEnv = apiEnv();
  const payload = { system: '只输出正文', userTemplate: '标题: {{news.title}}' };
  const write = await handleApi(new Request('https://example.test/api/prompts', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }), storeEnv);

  assert.equal(write.status, 200);
  const read = await handleApi(new Request('https://example.test/api/prompts'), storeEnv);
  assert.deepEqual(await read.json(), payload);
});

test('rejects an empty product list instead of overwriting stored products', async () => {
  const response = await handleApi(new Request('https://example.test/api/products', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ products: [] }),
  }), apiEnv());

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { message: '缺少 products 数组,拒绝写入' } });
});

test('keeps only the newest 5000 events in persistent storage', async () => {
  const kv = memoryKv();
  const store = createStore(kv);
  await kv.put('events', JSON.stringify(Array.from({ length: 5000 }, (_, index) => ({ type: 'generate', id: index + 1 }))));

  await store.appendEvent({ type: 'generate', id: 5001 });
  const result = await store.getEvents(5000);

  assert.equal(result.events.length, 5000);
  assert.equal(result.events[0].id, 2);
  assert.equal(result.events.at(-1).id, 5001);
});

test('lists evaluation runs in descending savedAt order', async () => {
  const store = createStore(memoryKv());
  await store.saveEvalRun({ id: 'old', results: [], savedAt: '2026-10-01T00:00:00.000Z' });
  await store.saveEvalRun({ id: 'new', results: [], savedAt: '2026-10-02T00:00:00.000Z' });

  assert.deepEqual((await store.listEvalRuns()).map(run => run.id), ['new', 'old']);
});

test('reports only the presence of a configured server key', async () => {
  const response = await handleApi(new Request('https://example.test/api/config'), {
    ...env,
    DEEPSEEK_API_KEY: 'sk-this-must-never-reach-the-browser',
  });
  const payload = await response.json();

  assert.equal(payload.hasServerKey, true);
  assert.equal(JSON.stringify(payload).includes('sk-this-must-never-reach-the-browser'), false);
});

test('rejects LLM requests without a browser key or a Worker secret', async () => {
  const response = await handleApi(new Request('https://example.test/api/llm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
  }), apiEnv());

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.message.includes('API Key'), true);
});

test('streams the upstream SSE response through the LLM endpoint', async () => {
  let upstreamRequest;
  const response = await handleApi(new Request('https://example.test/api/llm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '写一条文案' }], stream: true }),
  }), { ...apiEnv(), DEEPSEEK_API_KEY: 'sk-worker-secret' }, {
    fetch: async request => {
      upstreamRequest = request;
      return new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      });
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(await response.text(), 'data: {"choices":[]}\n\ndata: [DONE]\n\n');
  assert.equal(upstreamRequest.headers.get('authorization'), 'Bearer sk-worker-secret');
});
