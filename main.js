/**
 * 虚拟试穿 — 静态站点（GitHub Pages）
 *
 * ✅ 一键抠图：@imgly/background-removal 浏览器本地运行，免费
 * 🔒 虚拟试穿：需 Replicate API Key，输入 Key 后解锁
 */

// 抠图引擎（ES Module 导入，首次自动下载 AI 模型 ~40MB）
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/index.mjs";

// Replicate API 代理（解决浏览器 CORS 跨域拦截，零配置）
function replicateFetch(path, options) {
  const url = "https://corsproxy.io/?" + encodeURIComponent("https://api.replicate.com" + path);
  return fetch(url, options);
}

// ============================================================
//  工具函数
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, isError = false) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.className = "toast" + (isError ? " error" : "");
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function showLoading(text = "AI 处理中，请稍候...") {
    $("#loadingText").textContent = text;
    $("#loadingSub").textContent = "";
    $("#loadingOverlay").classList.add("show");
}

function updateLoading(text, sub) {
    $("#loadingText").textContent = text;
    if (sub !== undefined) $("#loadingSub").textContent = sub;
}

function hideLoading() {
    $("#loadingOverlay").classList.remove("show");
}

// ============================================================
//  API Key 管理（存 localStorage）
// ============================================================
const STORAGE_KEY = "replicate_api_token";

function getApiToken() {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
}

function saveApiToken(token) {
    localStorage.setItem(STORAGE_KEY, token.trim());
}

function clearApiToken() {
    localStorage.removeItem(STORAGE_KEY);
}

function hasApiToken() {
    return getApiToken().length > 0;
}

function maskToken(token) {
    if (token.length <= 8) return token;
    return token.slice(0, 4) + "****" + token.slice(-4);
}

// 更新试穿按钮和输入框状态
function updateTryOnUI() {
    const hasKey = hasApiToken();
    const btn = $("#btnTryOn");
    const input = $("#apiKeyInput");
    const msg = $("#apiKeyMsg");
    const saveBtn = $("#btnSaveKey");

    if (hasKey) {
        const token = getApiToken();
        input.value = maskToken(token);
        input.classList.add("saved");
        input.readOnly = true;
        input.type = "text";
        saveBtn.textContent = "更换";
        saveBtn.classList.add("saved");
        msg.textContent = "✅ Key 已保存 — 试穿功能已解锁";
        msg.className = "api-key-msg success";

        // 如果两张图片都上传了，解锁试穿按钮
        if (personFile && clothFile) {
            btn.disabled = false;
            btn.textContent = "✨ 生成试穿效果";
            btn.title = "";
        } else {
            btn.disabled = true;
            btn.textContent = "✨ 生成试穿效果（请先上传图片）";
        }
    } else {
        input.value = "";
        input.type = "password";
        input.classList.remove("saved");
        input.readOnly = false;
        saveBtn.textContent = "保存";
        saveBtn.classList.remove("saved");
        msg.textContent = "";
        msg.className = "api-key-msg";
        btn.disabled = true;
        btn.textContent = "🔑 需要 API Key 才能使用";
        btn.title = "请在下方输入 Replicate API Key";
    }
}

// 保存 Key
function handleSaveKey() {
    const input = $("#apiKeyInput");
    const newKey = input.value.trim();

    if (!newKey) {
        // 清除 Key
        clearApiToken();
        updateTryOnUI();
        showToast("API Key 已清除");
        return;
    }

    // 基本格式校验：r8_ 开头
    if (!newKey.startsWith("r8_")) {
        showToast("API Key 格式不正确（应以 r8_ 开头）", true);
        return;
    }

    saveApiToken(newKey);
    updateTryOnUI();
    showToast("API Key 已保存，试穿功能已解锁！");
}

// ============================================================
//  Tab 切换
// ============================================================
$$(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        $$(".nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
        $$(".tab-panel").forEach(p => p.classList.remove("active"));
        $("#panel-" + tab).classList.add("active");
    });
});

// ============================================================
//  图片上传通用逻辑
// ============================================================
function setupUpload({ cardId, uploadId, inputId, clearId, previewId, onImageReady }) {
    const card = $("#" + cardId);
    const uploadArea = $("#" + uploadId);
    const input = $("#" + inputId);
    const clearBtn = $("#" + clearId);
    const preview = $("#" + previewId);

    uploadArea.addEventListener("click", () => input.click());
    card.addEventListener("click", (e) => {
        if (e.target === card || e.target === preview) input.click();
    });

    // 拖拽上传
    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            loadImage(file, preview, card, onImageReady);
        }
    });

    // 文件选择
    input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) loadImage(file, preview, card, onImageReady);
    });

    // 清除
    clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        preview.src = "";
        card.classList.remove("has-image");
        if (onImageReady) onImageReady(null);
    });
}

function loadImage(file, previewEl, cardEl, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewEl.src = e.target.result;
        cardEl.classList.add("has-image");
        if (callback) callback(file);
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  虚拟试穿 — 上传逻辑
// ============================================================
let personFile = null;
let clothFile = null;

setupUpload({
    cardId: "personCard",
    uploadId: "personUpload",
    inputId: "personInput",
    clearId: "personClear",
    previewId: "personPreview",
    onImageReady: (file) => { personFile = file; checkTryOnReady(); }
});

setupUpload({
    cardId: "clothCard",
    uploadId: "clothUpload",
    inputId: "clothInput",
    clearId: "clothClear",
    previewId: "clothPreview",
    onImageReady: (file) => { clothFile = file; checkTryOnReady(); }
});

function checkTryOnReady() {
    const hasKey = hasApiToken();
    const ready = personFile && clothFile;
    const btn = $("#btnTryOn");

    if (!hasKey) {
        btn.disabled = true;
        btn.textContent = "🔑 需要 API Key 才能使用";
        return;
    }

    btn.disabled = !ready;
    btn.textContent = ready ? "✨ 生成试穿效果" : "✨ 生成试穿效果（请先上传图片）";
}

// 试穿按钮点击
$("#btnTryOn").addEventListener("click", async () => {
    // 如果没有 Key，弹出引导
    if (!hasApiToken()) {
        showToast("请先在下方输入 Replicate API Key ⬇️", true);
        $("#apiKeyInput").focus();
        return;
    }

    if (!personFile || !clothFile) return;

    // --- 调用 Replicate API 虚拟试穿 ---
    const token = getApiToken();

    showLoading("正在上传图片到 Replicate...", "步骤 1/2：上传");

    try {
        // Step 1: 上传图片到 Replicate（获取 URL）
        updateLoading("正在上传人物照片...", "步骤 1/3：上传人物照片");
        const personUrl = await uploadToReplicate(personFile, token);

        updateLoading("正在上传服装图片...", "步骤 2/3：上传服装图片");
        const clothUrl = await uploadToReplicate(clothFile, token);

        // Step 2: 创建试穿任务
        updateLoading("正在生成试穿效果...", "步骤 3/3：AI 推理中（约 30-60 秒）");
        const resultBlob = await runTryOnPrediction(personUrl, clothUrl, token);

        // Step 3: 显示结果
        const resultUrl = URL.createObjectURL(resultBlob);
        $("#tryonPersonThumb").src = URL.createObjectURL(personFile);
        $("#tryonClothThumb").src = URL.createObjectURL(clothFile);
        $("#tryonOutput").src = resultUrl;
        $("#tryonDownload").href = resultUrl;
        $("#tryonResult").style.display = "block";
        $("#tryonResult").scrollIntoView({ behavior: "smooth" });
        showToast("试穿效果生成成功！");
    } catch (err) {
        showToast("试穿失败：" + err.message, true);
    } finally {
        hideLoading();
    }
});

// 上传图片到 Replicate，返回 URL
async function uploadToReplicate(file, token) {
    const formData = new FormData();
    formData.append("content", file);

    const resp = await replicateFetch("/v1/files", {
        method: "POST",
        headers: { "Authorization": "Token " + token },
        body: formData,
    });

    if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 401) throw new Error("API Key 无效，请检查后重新输入");
        if (resp.status === 402) throw new Error("Replicate 账户余额不足，请充值");
        throw new Error(errData.detail || "上传图片失败 (HTTP " + resp.status + ")");
    }

    const data = await resp.json();
    // Replicate 返回的 URLs 在 urls.get 字段
    return data.urls.get;
}

// 创建试穿任务并等待结果
async function runTryOnPrediction(personUrl, clothUrl, token) {
    const resp = await replicateFetch("/v1/predictions", {
        method: "POST",
        headers: {
            "Authorization": "Token " + token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            version: "906425dbca90663ff542762483958b9faa28f66ce60ac94eb15ba33a95f5b146",
            input: {
                human_image: personUrl,
                cloth_image: clothUrl,
            },
        }),
    });

    if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || "创建试穿任务失败");
    }

    const prediction = await resp.json();
    const predictionId = prediction.id;

    // 轮询等待结果
    let attempts = 0;
    const maxAttempts = 60; // 最多等 5 分钟（每 5 秒一次）
    while (attempts < maxAttempts) {
        await sleep(5000);
        attempts++;

        const pollResp = await replicateFetch("/v1/predictions/" + predictionId, {
            headers: { "Authorization": "Token " + token },
        });

        if (!pollResp.ok) {
            throw new Error("查询试穿任务状态失败");
        }

        const pollData = await pollResp.json();
        updateLoading(
            "正在生成试穿效果...",
            "步骤 3/3：AI 推理中（已等待 " + (attempts * 5) + " 秒）"
        );

        if (pollData.status === "succeeded") {
            // output 是结果图片 URL 数组
            const resultUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
            const imgResp = await fetch(resultUrl);
            if (!imgResp.ok) throw new Error("下载结果图片失败");
            return await imgResp.blob();
        }

        if (pollData.status === "failed") {
            throw new Error("试穿任务失败：" + (pollData.error || "未知错误"));
        }

        if (pollData.status === "canceled") {
            throw new Error("试穿任务被取消");
        }
    }

    throw new Error("试穿任务超时，请稍后重试");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
//  一键抠图 — 上传逻辑
// ============================================================
let bgFile = null;

setupUpload({
    cardId: "bgCard",
    uploadId: "bgUpload",
    inputId: "bgInput",
    clearId: "bgClear",
    previewId: "bgPreview",
    onImageReady: (file) => {
        bgFile = file;
        $("#btnRemoveBg").disabled = !file;
    }
});

// 抠图按钮点击
$("#btnRemoveBg").addEventListener("click", async () => {
    if (!bgFile) return;

    showLoading("正在下载 AI 模型（首次使用）...", "模型约 40MB，下次使用无需下载");

    try {
        const resultBlob = await removeBackground(bgFile, {
            model: "isnet_quint8",
            output: {
                type: "image/png",
                quality: 1.0,
            },
            progress: (key, current, total) => {
                const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                if (key && key.startsWith("fetch:")) {
                    updateLoading("正在下载 AI 模型...", `下载进度：${pct}%（下次无需下载）`);
                } else if (key && key.startsWith("compute:")) {
                    updateLoading("AI 正在抠图中...", `处理进度：${pct}%`);
                } else {
                    updateLoading("AI 处理中，请稍候...", `${pct}%`);
                }
            },
        });

        // 显示结果
        const resultUrl = URL.createObjectURL(resultBlob);
        $("#bgOriginal").src = URL.createObjectURL(bgFile);
        $("#bgOutput").src = resultUrl;
        $("#bgDownload").href = resultUrl;
        $("#bgResult").style.display = "block";
        $("#bgResult").scrollIntoView({ behavior: "smooth" });
        showToast("抠图完成！✅");
    } catch (err) {
        showToast("抠图失败：" + (err.message || "未知错误"), true);
    } finally {
        hideLoading();
    }
});

// ============================================================
//  API Key 保存按钮
// ============================================================
$("#btnSaveKey").addEventListener("click", handleSaveKey);

// 输入框按 Enter 也可以保存
$("#apiKeyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSaveKey();
});

// ============================================================
//  一键去水印 — Canvas 涂抹 + 像素补全（纯 JS，不需要额外模块）
// ============================================================
let wmFile = null;
let wmImage = null;         // 原始图片 Image 对象
let wmMaskCanvas = null;    // 遮罩层（用户涂抹的水印区域）
let wmMaskCtx = null;
let wmDisplayCanvas = null; // 显示层（原图 + 遮罩叠加）
let wmDisplayCtx = null;
let wmCurrentTool = "brush";
let wmBrushSize = 20;
let wmIsDrawing = false;

setupUpload({
    cardId: "wmCard",
    uploadId: "wmUpload",
    inputId: "wmInput",
    clearId: "wmClear",
    previewId: "wmPreview",
    onImageReady: (file) => {
        wmFile = file;
        if (file) {
            loadWatermarkImage(file);
        } else {
            $("#wmEditor").style.display = "none";
            $("#wmResult").style.display = "none";
        }
    }
});

function loadWatermarkImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            wmImage = img;
            setupWatermarkCanvas(img);
            $("#wmEditor").style.display = "block";
            $("#wmResult").style.display = "none";
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function setupWatermarkCanvas(img) {
    const canvas = $("#wmCanvas");
    const maxW = 780;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";

    // 显示层
    wmDisplayCanvas = canvas;
    wmDisplayCtx = canvas.getContext("2d");
    wmDisplayCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 遮罩层（不可见，存储涂抹数据）
    wmMaskCanvas = document.createElement("canvas");
    wmMaskCanvas.width = canvas.width;
    wmMaskCanvas.height = canvas.height;
    wmMaskCtx = wmMaskCanvas.getContext("2d");
    wmMaskCtx.fillStyle = "black";
    wmMaskCtx.fillRect(0, 0, canvas.width, canvas.height);

    // 事件
    canvas.onmousedown = (e) => { wmIsDrawing = true; wmDraw(e); };
    canvas.onmousemove = (e) => { if (wmIsDrawing) wmDraw(e); };
    canvas.onmouseup = () => { wmIsDrawing = false; };
    canvas.onmouseleave = () => { wmIsDrawing = false; };
    canvas.ontouchstart = (e) => { e.preventDefault(); wmIsDrawing = true; wmDraw(e.touches[0]); };
    canvas.ontouchmove = (e) => { e.preventDefault(); if (wmIsDrawing) wmDraw(e.touches[0]); };
    canvas.ontouchend = () => { wmIsDrawing = false; };

    // 设置自定义圆形光标
    updateWmCursor();
}

function wmDraw(e) {
    const rect = wmDisplayCanvas.getBoundingClientRect();
    const scaleX = wmDisplayCanvas.width / rect.width;
    const scaleY = wmDisplayCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 在遮罩层画（白色=水印区域要移除，黑色=保留）
    wmMaskCtx.beginPath();
    wmMaskCtx.arc(x, y, wmBrushSize / 2, 0, Math.PI * 2);
    wmMaskCtx.fillStyle = wmCurrentTool === "brush" ? "white" : "black";
    wmMaskCtx.fill();

    // 在显示层画视觉提示
    wmDisplayCtx.beginPath();
    wmDisplayCtx.arc(x, y, wmBrushSize / 2, 0, Math.PI * 2);
    if (wmCurrentTool === "brush") {
        // 红色标记水印区域（50% 透明度，比之前更清晰）
        wmDisplayCtx.fillStyle = "rgba(255, 50, 50, 0.5)";
        wmDisplayCtx.fill();
    } else {
        // 橡皮擦：恢复显示原图
        wmDisplayCtx.save();
        wmDisplayCtx.clip();
        wmDisplayCtx.drawImage(wmImage, 0, 0, wmDisplayCanvas.width, wmDisplayCanvas.height);
        wmDisplayCtx.restore();
    }
}

// 自定义圆形光标
function updateWmCursor() {
    const size = wmBrushSize + 4;
    const cursorCanvas = document.createElement("canvas");
    cursorCanvas.width = size;
    cursorCanvas.height = size;
    const ctx = cursorCanvas.getContext("2d");
    const cx = size / 2, cy = size / 2, r = wmBrushSize / 2;
    const color = wmCurrentTool === "brush" ? "#ef4444" : "#64748b";

    // 虚线圆
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

    // 中心十字
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();

    const dataUrl = cursorCanvas.toDataURL();
    wmDisplayCanvas.style.cursor = `url(${dataUrl}) ${cx} ${cy}, crosshair`;
}

// 工具切换
$$(".wm-tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        $$(".wm-tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        wmCurrentTool = btn.dataset.tool;
        if (wmDisplayCanvas) updateWmCursor();
    });
});

// 画笔大小
$("#wmBrushSize").addEventListener("input", (e) => {
    wmBrushSize = parseInt(e.target.value);
    $("#wmBrushSizeVal").textContent = wmBrushSize + "px";
    if (wmDisplayCanvas) updateWmCursor();
});

// 去除水印按钮
$("#btnRemoveWatermark").addEventListener("click", async () => {
    if (!wmImage) return;
    await doInpaint("正在去除水印...");
});

// 自动识别按钮
$("#btnAutoDetect").addEventListener("click", async () => {
    if (!wmImage) return;
    showLoading("正在自动识别水印...", "扫描相似区域中");

    try {
        const count = autoDetectWatermarks();
        if (count > 0) {
            hideLoading();
            showToast(`已自动标记 ${count} 处疑似水印，请确认后点"去除水印"`);
        } else {
            hideLoading();
            showToast("未检测到相似水印，请手动涂抹后重试", true);
        }
    } catch (err) {
        hideLoading();
        showToast("识别失败：" + (err.message || "未知错误"), true);
    }
});

async function doInpaint(msg) {
    showLoading(msg, "Telea 像素修复算法处理中");
    await sleep(100);

    try {
        const resultBlob = await inpaintWatermarkTelea();
        const resultUrl = URL.createObjectURL(resultBlob);

        $("#wmOriginal").src = URL.createObjectURL(wmFile);
        $("#wmOutput").src = resultUrl;
        $("#wmDownload").href = resultUrl;
        $("#wmResult").style.display = "block";
        $("#wmResult").scrollIntoView({ behavior: "smooth" });
        showToast("去水印完成！");
    } catch (err) {
        showToast("去水印失败：" + (err.message || "未知错误"), true);
    } finally {
        hideLoading();
    }
}

// 自动识别：找出与已涂抹区域相似的像素
function autoDetectWatermarks() {
    const w = wmDisplayCanvas.width, h = wmDisplayCanvas.height;
    const maskData = wmMaskCtx.getImageData(0, 0, w, h);
    const mask = maskData.data;
    const srcData = wmDisplayCtx.getImageData(0, 0, w, h);
    const src = srcData.data;

    // 从已涂抹区域采样颜色
    let sampleR = 0, sampleG = 0, sampleB = 0, sampleCount = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (mask[i] > 128) {
                sampleR += src[i]; sampleG += src[i + 1]; sampleB += src[i + 2];
                sampleCount++;
            }
        }
    }
    if (sampleCount === 0) return 0;

    sampleR = Math.round(sampleR / sampleCount);
    sampleG = Math.round(sampleG / sampleCount);
    sampleB = Math.round(sampleB / sampleCount);

    // 扫描全图，找相似颜色的像素
    const threshold = 45; // 颜色容差
    const minCluster = 30; // 最小聚类大小
    const similar = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
        const si = i * 4;
        const dr = Math.abs(src[si] - sampleR);
        const dg = Math.abs(src[si + 1] - sampleG);
        const db = Math.abs(src[si + 2] - sampleB);
        if (dr < threshold && dg < threshold && db < threshold) {
            similar[i] = 1;
        }
    }

    // 膨胀操作：扩展相似区域
    const dilated = new Uint8Array(similar);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (similar[y * w + x] === 1) {
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        dilated[(y + dy) * w + (x + dx)] = 1;
                    }
                }
            }
        }
    }

    // 自动标记到遮罩
    let markedCount = 0;
    for (let i = 0; i < w * h; i++) {
        if (dilated[i] === 1) {
            const mi = i * 4;
            mask[mi] = 255;     // 白色=标记
            mask[mi + 3] = 255;
            markedCount++;
        }
    }
    wmMaskCtx.putImageData(maskData, 0, 0);

    // 更新显示
    wmDisplayCtx.drawImage(wmImage, 0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
        if (mask[i * 4] > 128) {
            const x = i % w, y = Math.floor(i / w);
            const si = i * 4;
            const alpha = 0.35;
            src[si] = src[si] * (1 - alpha) + 255 * alpha;
            src[si + 1] = src[si + 1] * (1 - alpha);
            src[si + 2] = src[si + 2] * (1 - alpha);
        }
    }
    wmDisplayCtx.putImageData(srcData, 0, 0);

    return Math.round(markedCount / 100); // 近似水印数量
}

// 边缘像素补全——在显示尺寸填充，输出时还原原始尺寸
function inpaintWatermarkTelea() {
    const dw = wmDisplayCanvas.width, dh = wmDisplayCanvas.height;
    const ow = wmImage.width, oh = wmImage.height; // 原始尺寸
    const scale = ow / dw; // 缩放比例

    wmDisplayCtx.drawImage(wmImage, 0, 0, dw, dh);
    const srcData = wmDisplayCtx.getImageData(0, 0, dw, dh);
    const src = srcData.data;
    const maskData = wmMaskCtx.getImageData(0, 0, dw, dh);
    const mask = maskData.data;

    // 所有待填充像素
    const maskedSet = new Set();
    const originalMasked = new Set(); // 备份，输出时用
    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            if (mask[(y * dw + x) * 4] > 128) {
                maskedSet.add(y * dw + x);
                originalMasked.add(y * dw + x);
            }
        }
    }
    if (maskedSet.size === 0) {
        // 还是输出原始尺寸
        const outCanvas = document.createElement("canvas");
        outCanvas.width = ow; outCanvas.height = oh;
        outCanvas.getContext("2d").drawImage(wmImage, 0, 0, ow, oh);
        return new Promise(resolve => outCanvas.toBlob(blob => resolve(blob), "image/png"));
    }

    // 逐轮从边缘向内填充
    const maxPasses = 500;
    for (let pass = 0; pass < maxPasses && maskedSet.size > 0; pass++) {
        const edgePixels = [];
        for (const i of maskedSet) {
            const x = i % dw, y = Math.floor(i / dw);
            let hasKnown = false;
            for (let dy = -1; dy <= 1 && !hasKnown; dy++) {
                for (let dx = -1; dx <= 1 && !hasKnown; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) continue;
                    if (!maskedSet.has(ny * dw + nx)) hasKnown = true;
                }
            }
            if (hasKnown) edgePixels.push(i);
        }
        if (edgePixels.length === 0) break;

        for (const idx of edgePixels) {
            const x = idx % dw, y = Math.floor(idx / dw);
            let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
            const si = idx * 4;

            for (let r = 2; r <= 15 && wSum === 0; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) continue;
                        const ni = ny * dw + nx;
                        if (maskedSet.has(ni)) continue;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const weight = 1 / (1 + dist);
                        rSum += src[ni * 4] * weight;
                        gSum += src[ni * 4 + 1] * weight;
                        bSum += src[ni * 4 + 2] * weight;
                        wSum += weight;
                    }
                }
            }

            if (wSum > 0) {
                src[si] = Math.round(rSum / wSum);
                src[si + 1] = Math.round(gSum / wSum);
                src[si + 2] = Math.round(bSum / wSum);
                src[si + 3] = 255;
                maskedSet.delete(idx);
            }
        }
    }

    // 输出原始尺寸：以原图打底，修复区域覆盖上去
    const outCanvas = document.createElement("canvas");
    outCanvas.width = ow;
    outCanvas.height = oh;
    const outCtx = outCanvas.getContext("2d");
    outCtx.drawImage(wmImage, 0, 0, ow, oh);
    const origData = outCtx.getImageData(0, 0, ow, oh);

    // 把修复后的显示层像素映射回原始尺寸
    for (let dy = 0; dy < dh; dy++) {
        for (let dx = 0; dx < dw; dx++) {
            const di = dy * dw + dx;
            // 跳过还在maskedSet里的（没被填充的），跳过从来没被遮罩标记的
            if (maskedSet.has(di)) continue;

            const si = di * 4;
            // 原来在遮罩里 且 现在不在maskedSet里 = 被修复过了
            if (originalMasked.has(di) && !maskedSet.has(di)) {
                const ox1 = Math.floor(dx * scale);
                const oy1 = Math.floor(dy * scale);
                const ox2 = Math.floor((dx + 1) * scale);
                const oy2 = Math.floor((dy + 1) * scale);

                for (let oy = oy1; oy < oy2; oy++) {
                    for (let ox = ox1; ox < ox2; ox++) {
                        if (ox >= 0 && ox < ow && oy >= 0 && oy < oh) {
                            const oi = (oy * ow + ox) * 4;
                            origData.data[oi] = src[si];
                            origData.data[oi + 1] = src[si + 1];
                            origData.data[oi + 2] = src[si + 2];
                            origData.data[oi + 3] = 255;
                        }
                    }
                }
            }
        }
    }

    outCtx.putImageData(origData, 0, 0);
    return new Promise(resolve => outCanvas.toBlob(blob => resolve(blob), "image/png"));
}

// ============================================================
//  初始化
// ============================================================
function init() {
    const dot = $("#statusDot");
    const text = $("#statusText");

    // ES Module 导入成功 = 抠图引擎就绪
    dot.className = "status-dot online";
    text.textContent = "抠图就绪 ✅";

    // 恢复已保存的 API Key
    updateTryOnUI();
}

init();
