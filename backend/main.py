"""
AI 抠图后端 — FastAPI + rembg
"""
import io, base64, traceback
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保所有响应都带 CORS 头
@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

_bg_remover = None

def get_remover():
    global _bg_remover
    if _bg_remover is None:
        from rembg import new_session
        # isnet-general-use 比 u2net 轻量，适合 512MB 内存
        _bg_remover = new_session("isnet-general-use")
    return _bg_remover

@app.get("/")
def root():
    return {"status": "ok", "service": "AI Background Removal"}

@app.get("/api/health")
def health():
    try:
        get_remover()
        return {"status": "ready"}
    except Exception as e:
        return {"status": "loading", "error": str(e)}

@app.post("/api/remove-bg")
async def remove_bg(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        return {"ok": False, "message": "请上传图片"}

    try:
        from rembg import remove
        input_bytes = await image.read()

        if len(input_bytes) > 10 * 1024 * 1024:
            return {"ok": False, "message": "图片不能超过 10MB"}

        output_bytes = remove(input_bytes, session=get_remover())
        b64 = base64.b64encode(output_bytes).decode()

        return {"ok": True, "image_base64": b64, "message": "抠图完成"}
    except Exception as e:
        return {"ok": False, "message": f"抠图失败：{str(e)}", "detail": traceback.format_exc()}
