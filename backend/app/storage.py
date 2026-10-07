"""
Persistence. What the server keeps at rest:
  - the AES-GCM ciphertext of each file (data/blobs/<id>.bin)
  - public metadata: name, threshold, roles, epoch, nonce, key fingerprint,
    Feldman commitments
  - the audit log

What it never keeps: the AES key, the shares, or the polynomial coefficients.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.environ.get("SHAMIR_VAULT_DATA", Path(__file__).resolve().parent.parent / "data"))
BLOB_DIR = DATA_DIR / "blobs"
DB_PATH = DATA_DIR / "vault.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS vaults (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    kind         TEXT NOT NULL,          -- 'file' or 'text'
    filename     TEXT NOT NULL,
    mime         TEXT NOT NULL,
    size         INTEGER NOT NULL,       -- plaintext size in bytes
    n            INTEGER NOT NULL,
    t            INTEGER NOT NULL,
    roles        TEXT NOT NULL,          -- JSON list, roles[x-1] holds share x
    epoch        INTEGER NOT NULL,
    nonce        TEXT NOT NULL,          -- hex
    key_check    TEXT NOT NULL,          -- SHA-256 fingerprint of the AES key
    commitments  TEXT NOT NULL,          -- JSON list of hex Feldman commitments
    created_at   TEXT NOT NULL,
    refreshed_at TEXT
);
CREATE TABLE IF NOT EXISTS audit (
    id        INTEGER PRIMARY KEY,
    ts        TEXT NOT NULL,
    vault_id  TEXT,
    actor     TEXT NOT NULL,
    action    TEXT NOT NULL,
    detail    TEXT NOT NULL,             -- JSON
    prev_hash TEXT NOT NULL,
    hash      TEXT NOT NULL
);
"""


def init():
    BLOB_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(SCHEMA)


@contextmanager
def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    finally:
        db.close()


def _row_to_vault(row):
    v = dict(row)
    v["roles"] = json.loads(v["roles"])
    v["commitments"] = [int(c, 16) for c in json.loads(v["commitments"])]
    return v


def insert_vault(v, ciphertext):
    (BLOB_DIR / f"{v['id']}.bin").write_bytes(ciphertext)
    with connect() as db:
        db.execute(
            "INSERT INTO vaults (id, name, kind, filename, mime, size, n, t, roles, epoch, nonce,"
            " key_check, commitments, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                v["id"], v["name"], v["kind"], v["filename"], v["mime"], v["size"], v["n"], v["t"],
                json.dumps(v["roles"]), v["epoch"], v["nonce"], v["key_check"],
                json.dumps([format(c, "x") for c in v["commitments"]]), v["created_at"],
            ),
        )


def get_vault(vault_id):
    with connect() as db:
        row = db.execute("SELECT * FROM vaults WHERE id = ?", (vault_id,)).fetchone()
    return _row_to_vault(row) if row else None


def list_vaults():
    with connect() as db:
        rows = db.execute("SELECT * FROM vaults ORDER BY created_at DESC").fetchall()
    return [_row_to_vault(r) for r in rows]


def update_after_refresh(vault_id, epoch, commitments, refreshed_at):
    with connect() as db:
        db.execute(
            "UPDATE vaults SET epoch = ?, commitments = ?, refreshed_at = ? WHERE id = ?",
            (epoch, json.dumps([format(c, "x") for c in commitments]), refreshed_at, vault_id),
        )


def read_ciphertext(vault_id):
    return (BLOB_DIR / f"{vault_id}.bin").read_bytes()


def delete_vault(vault_id):
    (BLOB_DIR / f"{vault_id}.bin").unlink(missing_ok=True)
    with connect() as db:
        db.execute("DELETE FROM vaults WHERE id = ?", (vault_id,))
