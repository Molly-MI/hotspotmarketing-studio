const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
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

  return jsonResponse(404, { error: { message: 'API 不存在' } });
}
