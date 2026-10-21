import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/worker.mjs';
import { handleApi } from '../worker/src/handler.mjs';

const env = {
  ASSETS: {
    fetch: async () => new Response('static asset', { status: 200, headers: { 'content-type': 'text/plain' } }),
  },
};

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
