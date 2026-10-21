const EVENT_LIMIT = 5000;

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function createStore(kv) {
  if (!kv) throw new Error('缺少 HOTSPOT_STORE KV 绑定');

  return {
    getJson: (key, fallback = {}) => readJson(kv, key, fallback),
    putJson: async (key, value) => kv.put(key, JSON.stringify(value)),

    async saveEvalRun(run) {
      const id = String(run.id || `run-${Date.now()}`).replace(/[^\w.-]/g, '');
      const saved = { ...run, id, savedAt: run.savedAt || new Date().toISOString() };
      await kv.put(`eval:${id}`, JSON.stringify(saved));
      const index = await readJson(kv, 'eval:index', []);
      const next = [{ id, savedAt: saved.savedAt, summary: saved.summary || null, meta: saved.meta || null }, ...index.filter(item => item.id !== id)]
        .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      await kv.put('eval:index', JSON.stringify(next));
      return saved;
    },

    async getEvalRun(id) {
      return readJson(kv, `eval:${String(id).replace(/[^\w.-]/g, '')}`, null);
    },

    async listEvalRuns() {
      return readJson(kv, 'eval:index', []);
    },

    async getEvents(limit = 500) {
      const events = await readJson(kv, 'events', []);
      const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), EVENT_LIMIT);
      return { events: events.slice(-safeLimit), total: events.length };
    },

    async appendEvent(event) {
      const events = await readJson(kv, 'events', []);
      events.push(event);
      await kv.put('events', JSON.stringify(events.slice(-EVENT_LIMIT)));
    },

    clearEvents: () => kv.delete('events'),
  };
}
