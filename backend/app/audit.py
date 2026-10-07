"""
Tamper-evident audit log.

Each entry stores the hash of the previous entry, and its own hash covers its
content plus that previous hash (a hash chain, like a tiny blockchain without
the consensus). Editing or deleting any past row breaks every hash after it,
and verify_chain() reports exactly where.
"""

import hashlib
import json
from datetime import datetime, timezone

from . import storage

GENESIS = "0" * 64


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _entry_hash(prev_hash, ts, vault_id, actor, action, detail_json):
    payload = json.dumps([prev_hash, ts, vault_id, actor, action, detail_json], separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def record(action, actor, vault_id=None, **detail):
    ts = now_iso()
    detail_json = json.dumps(detail, sort_keys=True)
    with storage.connect() as db:
        last = db.execute("SELECT hash FROM audit ORDER BY id DESC LIMIT 1").fetchone()
        prev_hash = last["hash"] if last else GENESIS
        h = _entry_hash(prev_hash, ts, vault_id, actor, action, detail_json)
        db.execute(
            "INSERT INTO audit (ts, vault_id, actor, action, detail, prev_hash, hash) VALUES (?,?,?,?,?,?,?)",
            (ts, vault_id, actor, action, detail_json, prev_hash, h),
        )


def entries(vault_id=None, limit=500):
    with storage.connect() as db:
        if vault_id:
            rows = db.execute(
                "SELECT * FROM audit WHERE vault_id = ? ORDER BY id DESC LIMIT ?", (vault_id, limit)
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{**dict(r), "detail": json.loads(r["detail"])} for r in rows]


def verify_chain():
    with storage.connect() as db:
        rows = db.execute("SELECT * FROM audit ORDER BY id ASC").fetchall()
    prev = GENESIS
    for r in rows:
        expected = _entry_hash(prev, r["ts"], r["vault_id"], r["actor"], r["action"], r["detail"])
        if r["prev_hash"] != prev or r["hash"] != expected:
            return {"ok": False, "count": len(rows), "broken_at": r["id"]}
        prev = r["hash"]
    return {"ok": True, "count": len(rows), "broken_at": None, "head": prev}
