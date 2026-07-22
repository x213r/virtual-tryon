/**
 * Cloudflare Worker — HuggingFace API 代理
 * Token 藏在这里，不暴露到前端代码
 */
export default {
  async fetch(request) {
    // 把 Token 填在这里（替换下面的 xxx）
    const HF_TOKEN = "hf_你的Token填这里";

    const hfUrl = "https://api-inference.huggingface.co/models/not-lain/rembg";

    const resp = await fetch(hfUrl, {
      method: "POST",
      headers: { "Authorization": "Bearer " + HF_TOKEN },
      body: request.body,
    });

    return new Response(resp.body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": resp.headers.get("Content-Type") || "image/png",
      },
    });
  },
};
