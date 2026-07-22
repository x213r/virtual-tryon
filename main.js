/**
 * 虚拟试穿 — 静态站点（GitHub Pages）
 *
 * ✅ 一键抠图：@imgly/background-removal 浏览器本地运行，免费
 * 🔒 虚拟试穿：需 Replicate API Key，输入 Key 后解锁
 */

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
//  抠图引擎检测
// ============================================================
function getRemoveBgFn() {
    // @imgly/background-removal IIFE 构建可能暴露不同的全局变量
    if (typeof imglyBackgroundRemoval !== "undefined" && imglyBackgroundRemoval.removeBackground) {
        return imglyBackgroundRemoval.removeBackground;
    }
    if (typeof removeBackground === "function") {
        return removeBackground;
    }
    // 有些版本挂载在 window 上
    if (window.removeBackground && typeof window.removeBackground === "function") {
        return window.removeBackground;
    }
    return null;
}

function isBgRemovalReady() {
    return getRemoveBgFn() !== null;
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

    const resp = await fetch("https://api.replicate.com/v1/files", {
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
    const resp = await fetch("https://api.replicate.com/v1/predictions", {
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

        const pollResp = await fetch("https://api.replicate.com/v1/predictions/" + predictionId, {
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

    const removeBg = getRemoveBgFn();
    if (!removeBg) {
        showToast("抠图引擎加载失败，请刷新页面重试", true);
        return;
    }

    showLoading("正在下载 AI 模型（首次使用）...", "模型约 40MB，下次使用无需下载");

    try {
        const resultBlob = await removeBg(bgFile, {
            model: "isnet-general-use",
            output: {
                type: "image/png",
                quality: 1.0,
            },
            progress: (key, current, total) => {
                // key 可能是 "download:model" 或 "compute:inference"
                const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                if (key && key.includes("download")) {
                    updateLoading("正在下载 AI 模型...", `下载进度：${pct}%（下次使用无需下载）`);
                } else if (key && key.includes("compute")) {
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
//  初始化
// ============================================================
function init() {
    const dot = $("#statusDot");
    const text = $("#statusText");

    // 检查抠图引擎
    if (isBgRemovalReady()) {
        dot.className = "status-dot online";
        text.textContent = "抠图就绪 ✅";
    } else {
        // 可能还在加载 CDN 脚本，等 2 秒再试
        dot.className = "status-dot";
        text.textContent = "加载中...";
        setTimeout(() => {
            if (isBgRemovalReady()) {
                dot.className = "status-dot online";
                text.textContent = "抠图就绪 ✅";
            } else {
                dot.className = "status-dot offline";
                text.textContent = "抠图引擎加载失败";
            }
        }, 3000);
    }

    // 恢复已保存的 API Key
    updateTryOnUI();
}

init();
