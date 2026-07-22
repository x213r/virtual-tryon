/**
 * Cloudflare Worker — AI 图像工具箱后端
 *   POST /remove-bg     → 抠图（发图片，返图片）
 *   POST /proxy/v1/*    → Replicate API 代理（试穿用）
 *   GET  /              → 健康检查
 *
 * Token 存 Cloudflare Secret: npx wrangler secret put REPLICATE_TOKEN
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const TOKEN = env.REPLICATE_TOKEN || "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET") {
      if (!TOKEN) return new Response("ERR: REPLICATE_TOKEN 未设", { headers: CORS });
      return new Response("OK | /remove-bg | /proxy/*", { headers: CORS });
    }

    if (!TOKEN) {
      return text("REPLICATE_TOKEN 未配置", 500);
    }

    try {
      // 抠图
      if (path === "/remove-bg" || path === "/") {
        return await handleRemoveBg(request, TOKEN);
      }

      // Replicate 通用代理 (试穿上传、创建预测、轮询)
      if (path.startsWith("/proxy/")) {
        return await handleProxy(request, TOKEN, path);
      }

      return text("404: " + path, 404);
    } catch (err) {
      return text("异常: " + err.message, 502);
    }
  },
};

// ======================== 抠图 ========================
async function handleRemoveBg(request, token) {
  const bytes = await request.arrayBuffer();
  const file = new File([new Blob([bytes])], "img.png", { type: "image/png" });

  // 上传
  const fd = new FormData();
  fd.append("content", file);
  const u1 = await fetch("https://api.replicate.com/v1/files", {
    method: "POST", headers: { "Authorization": "Token " + token }, body: fd,
  });
  if (!u1.ok) return text("上传失败 " + u1.status + ": " + (await u1.text()).substring(0, 200), u1.status);
  const { urls } = await u1.json();

  // 预测 (lucataco/remove-bg)
  const u2 = await fetch("https://api.replicate.com/v1/models/lucataco/remove-bg/predictions", {
    method: "POST",
    headers: { "Authorization": "Token " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { image: urls.get } }),
  });
  const pText = await u2.text();
  if (!u2.ok) return text("预测失败 " + u2.status + ": " + pText.substring(0, 200), u2.status);
  let pred = JSON.parse(pText);

  // 轮询
  for (let i = 0; i < 30 && pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled"; i++) {
    await sleep(2000);
    const u3 = await fetch("https://api.replicate.com/v1/predictions/" + pred.id, {
      headers: { "Authorization": "Token " + token },
    });
    pred = await u3.json();
  }

  if (pred.status !== "succeeded") {
    return text("状态=" + pred.status + " err=" + (pred.error || ""), 500);
  }

  const outUrl = typeof pred.output === "string" ? pred.output : (pred.output?.[0] || pred.output?.image || "");
  if (!outUrl) return text("无输出: " + JSON.stringify(pred.output).substring(0, 200), 500);

  const u4 = await fetch(outUrl);
  return new Response(u4.body, {
    headers: { ...CORS, "Content-Type": u4.headers.get("Content-Type") || "image/png" },
  });
}

// ======================== Replicate 代理 ========================
async function handleProxy(request, token, path) {
  const targetPath = path.replace("/proxy", ""); // /proxy/v1/files → /v1/files
  const targetUrl = "https://api.replicate.com" + targetPath;

  const headers = new Headers(request.headers);
  headers.set("Authorization", "Token " + token);
  // 不转发浏览器的 Host/Origin/Referer
  headers.delete("Host");
  headers.delete("Origin");
  headers.delete("Referer");

  const resp = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    // @ts-ignore
    duplex: "half",
  });

  const outHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS)) {
    outHeaders.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: outHeaders,
  });
}

// ======================== 工具 ========================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function text(msg, status = 500) {
  return new Response(msg, { status, headers: { ...CORS, "Content-Type": "text/plain" } });
}
