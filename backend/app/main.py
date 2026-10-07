"""HTTP API for VaultShare. Run with:  uvicorn app.main:app --reload  (or run-backend.cmd)"""

import json
import mimetypes
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import audit, storage, vault_service
from .params import G, P, Q, SHARE_HEX_WIDTH
from .vault_service import VaultError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@asynccontextmanager
async def lifespan(_app):
    storage.init()
    yield


app = FastAPI(title="VaultShare API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(VaultError)
async def vault_error_handler(_request: Request, exc: VaultError):
    return JSONResponse(status_code=exc.status, content={"detail": str(exc)})


class ShareIn(BaseModel):
    share: str


class ForceIn(BaseModel):
    xs: Optional[list[int]] = None


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/params")
def params():
    return {
        "group": "RFC 3526 MODP-2048 (safe prime P = 2Q + 1)",
        "p_bits": P.bit_length(),
        "q_bits": Q.bit_length(),
        "g": G,
        "q_hex": format(Q, "x"),
        "share_hex_width": SHARE_HEX_WIDTH,
        "cipher": "AES-256-GCM",
    }


@app.get("/api/vaults")
def list_vaults():
    return vault_service.list_vaults()


@app.post("/api/vaults")
async def create_vault(
    name: str = Form(...),
    threshold: int = Form(...),
    roles: str = Form(..., description="JSON list of custodian role names"),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    try:
        role_list = json.loads(roles)
        assert isinstance(role_list, list)
    except (ValueError, AssertionError):
        raise VaultError("roles must be a JSON list of names")

    if file is not None and file.filename:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise VaultError("file too large (max 25 MB)")
        filename = file.filename
        mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        kind = "file"
    elif text:
        data, filename, mime, kind = text.encode("utf-8"), "secret-note.txt", "text/plain; charset=utf-8", "text"
    else:
        raise VaultError("upload a file or enter a secret message")

    vault, shares = vault_service.create_vault(name, role_list, threshold, data, filename, mime, kind)
    return {"vault": vault, "shares": shares}


@app.get("/api/vaults/{vault_id}")
def get_vault(vault_id: str):
    return vault_service.get_vault(vault_id)


@app.delete("/api/vaults/{vault_id}")
def delete_vault(vault_id: str):
    vault_service.delete_vault(vault_id)
    return {"ok": True}


@app.post("/api/vaults/{vault_id}/shares")
def submit_share(vault_id: str, body: ShareIn):
    return vault_service.submit_share(vault_id, body.share)


@app.delete("/api/vaults/{vault_id}/shares/{x}")
def withdraw_share(vault_id: str, x: int):
    return vault_service.withdraw_share(vault_id, x)


@app.post("/api/vaults/{vault_id}/reset")
def reset_session(vault_id: str):
    return vault_service.reset_session(vault_id)


@app.post("/api/vaults/{vault_id}/force")
def force(vault_id: str, body: ForceIn):
    return vault_service.force_reconstruct(vault_id, set(body.xs) if body.xs else None)


@app.post("/api/vaults/{vault_id}/unlock")
def unlock(vault_id: str):
    return vault_service.unlock(vault_id)


@app.get("/api/vaults/{vault_id}/download")
def download(vault_id: str, token: str):
    plaintext, v = vault_service.download(vault_id, token)
    disposition = f"inline; filename*=UTF-8''{quote(v['filename'])}"
    return Response(content=plaintext, media_type=v["mime"],
                    headers={"Content-Disposition": disposition, "Cache-Control": "no-store"})


@app.post("/api/vaults/{vault_id}/refresh")
def refresh(vault_id: str):
    return vault_service.refresh(vault_id)


@app.get("/api/audit")
def audit_log(vault_id: Optional[str] = None, limit: int = 500):
    return audit.entries(vault_id, min(limit, 2000))


@app.get("/api/audit/verify")
def audit_verify():
    return audit.verify_chain()
