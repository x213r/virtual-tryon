/**
 * Cloudflare Worker — Replicate API 代理
 *
 * 部署方式：
 * 1. 打开 cloudflare.com 注册，进入 Workers & Pages
 * 2. 创建新的 Worker，把这段代码粘贴进去
 * 3. 点 Deploy，拿到 worker 的网址（如 xxx.workers.dev）
 * 4. 把网址填到 main.js 顶部的 PROXY_URL 里
 */

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    // 从路径中提取 Replicate API 的路径
    // /api/replicate/v1/files -> https://api.replicate.com/v1/files
    const apiPath = url.pathname.replace("/api/replicate", "");
    const replicateUrl = "https://api.replicate.com" + apiPath;

    // 构建转发请求
    const headers = new Headers(request.headers);
    headers.set("Host", "api.replicate.com");

    // 保留原始请求的 Authorization
    const authHeader = request.headers.get("Authorization");

    const proxyRequest = new Request(replicateUrl, {
      method: request.method,
      headers: {
        "Authorization": authHeader || "",
        "Content-Type": request.headers.get("Content-Type") || "application/json",
      },
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });

    try {
      const response = await fetch(proxyRequest);

      // 返回响应，添加 CORS 头
      const corsHeaders = new Headers(response.headers);
      corsHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        detail: "代理请求失败：" + err.message
      }), {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
