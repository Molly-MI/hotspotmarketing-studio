import { handleApi } from './src/handler.mjs';

export default {
  async fetch(request, env) {
    const response = await handleApi(request, env);
    return response || env.ASSETS.fetch(request);
  },
};
