
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  VITE_API_BASE_URL?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
}

const buildRuntimeEnvScript = (env: Env) => {
  const runtimeEnv = {
    VITE_API_BASE_URL: env.VITE_API_BASE_URL,
    VITE_TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY,
  };

  return `<script>window.__ENV__=${JSON.stringify(runtimeEnv)};</script>`;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 这里可以处理 API 请求
    const url = new URL(request.url);
    
    if (url.pathname.startsWith("/api/")) {
      return new Response("API is working. D1 is bound.", { status: 200 });
    }

    // 对于其他请求，返回静态资源 (React App)
    // 注意：[assets] 配置会自动提供 env.ASSETS
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return response;
    }

    const runtimeEnvScript = buildRuntimeEnvScript(env);
    return new HTMLRewriter()
      .on('head', {
        element(element) {
          element.append(runtimeEnvScript, { html: true });
        }
      })
      .transform(response);
  },
};
