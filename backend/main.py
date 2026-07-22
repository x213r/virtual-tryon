"""
AI 抠图后端 — FastAPI + rembg
部署到 Render 免费版
"""
import io
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 懒加载 rembg（首次请求时加载模型 ~170MB）
_bg_remover = None


def get_remover():
    global _bg_remover
    if _bg_remover is None:
        from rembg import new_session
        _bg_remover = new_session("u2net")
    return _bg_remover


@app.get("/")
def root():
    return {"status": "ok", "service": "AI Background Removal API"}


@app.post("/api/remove-bg")
async def remove_bg(image: UploadFile = File(...)):
    """上传图片 → 返回去背景 PNG（base64）"""
    if not image.content_type or not image.content_type.startswith("image/"):
        return JSONResponse({"ok": False, "message": "请上传图片文件"}, status_code=400)

    try:
        from rembg import remove

        input_bytes = await image.read()

        # rembg 抠图
        output_bytes = remove(input_bytes, session=get_remover())

        b64 = base64.b64encode(output_bytes).decode()

        return {
            "ok": True,
            "image_base64": b64,
            "message": "抠图完成",
        }

    except Exception as e:
        return JSONResponse({"ok": False, "message": f"抠图失败：{str(e)}"}, status_code=500)
