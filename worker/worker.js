/**
 * Cloudflare Worker — HuggingFace rembg API 代理
 *
 * 🔒 HF Token 通过 wrangler secret 保存在 Cloudflare，永不暴露到前端
 *
 * 部署：
 *   cd worker
 *   npx wrangler secret put HF_TOKEN   ← 输入你的 HF Token
 *   npx wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 只接受 POST
    if (request.method !== "POST") {
      return new Response("Worker OK — send a POST with image binary", {
        status: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 🔒 Token 存服务端，浏览器不可见
    const HF_TOKEN = env.HF_TOKEN || "hf_你的Token填这里";

    const hfUrl = "https://api-inference.huggingface.co/models/not-lain/rembg";

    try {
      const resp = await fetch(hfUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + HF_TOKEN,
          "Content-Type": request.headers.get("Content-Type") || "application/octet-stream",
        },
        body: request.body,
      });

      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Content-Type", resp.headers.get("Content-Type") || "image/png");

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        headers.set("Content-Type", "text/plain");
        return new Response(`HF API error (${resp.status}): ${errText}`, { status: resp.status, headers });
      }

      return new Response(resp.body, { headers });
    } catch (err) {
      return new Response("Worker fetch error: " + err.message, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
