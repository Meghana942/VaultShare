"""
The vault workflow, tying the pieces together:

  create  : random AES key -> encrypt file -> Shamir-split the key -> Feldman commit
  submit  : a custodian hands in a share -> Feldman-verify it -> hold it in memory
  unlock  : >= t verified shares -> Lagrange -> fingerprint check -> AES-GCM decrypt
  force   : reconstruct from whatever was submitted, even < t, to SHOW it's garbage
  refresh : add a random zero-polynomial -> new shares, same key, old shares dead

Submitted shares live only in this process's memory (never on disk) and are
wiped after a successful unlock, a refresh, or a reset.
"""

import base64
import secrets
import threading
import time

from cryptography.exceptions import InvalidTag

from . import audit, crypto_box, feldman, shamir, share_codec, storage
from .params import KEY_BITS, Q

ADMIN = "Vault admin"
MAX_SHARES = 10
DOWNLOAD_TTL_SECONDS = 600
PEEK_BYTES = 4096


class VaultError(Exception):
    status = 400


class NotFound(VaultError):
    status = 404


_lock = threading.RLock()
_sessions = {}   # vault_id -> {"shares": {x: {...}}, "forced": [...]}
_downloads = {}  # token -> {"vault_id", "key", "expires"}


def _aad(vault_id):
    return f"shamir-vault:{vault_id}".encode()


def _session(vault_id):
    return _sessions.setdefault(vault_id, {"shares": {}, "forced": []})


def _require_vault(vault_id):
    v = storage.get_vault(vault_id)
    if not v:
        raise NotFound("vault not found")
    return v


def _short(n, keep=10):
    h = format(n, "x")
    return h if len(h) <= 2 * keep + 1 else f"{h[:keep]}…{h[-keep:]}"


# --------------------------------------------------------------------- create

def create_vault(name, roles, t, data, filename, mime, kind):
    roles = [r.strip() for r in roles if r and r.strip()]
    n = len(roles)
    if not name.strip():
        raise VaultError("vault name is required")
    if not 2 <= n <= MAX_SHARES:
        raise VaultError(f"need between 2 and {MAX_SHARES} custodian roles")
    if len(set(r.lower() for r in roles)) != n:
        raise VaultError("role names must be unique")
    if not 2 <= t <= n:
        raise VaultError("threshold must be between 2 and the number of custodians")
    if not data:
        raise VaultError("nothing to protect: upload a file or enter a secret")

    vault_id = secrets.token_hex(5)

    # 1. Encrypt the file with a fresh random AES-256 key.
    key = crypto_box.new_key()
    nonce, ciphertext = crypto_box.encrypt(key, data, _aad(vault_id))

    # 2. Split only the 32-byte key, treated as a number in the field.
    shares, coeffs = shamir.split(int.from_bytes(key, "big"), n, t)

    # 3. Publish Feldman commitments so each share can be checked on its own.
    commitments = feldman.commit(coeffs)

    vault = {
        "id": vault_id, "name": name.strip(), "kind": kind, "filename": filename, "mime": mime,
        "size": len(data), "n": n, "t": t, "roles": roles, "epoch": 1, "nonce": nonce.hex(),
        "key_check": crypto_box.key_fingerprint(key), "commitments": commitments,
        "created_at": audit.now_iso(),
    }
    storage.insert_vault(vault, ciphertext)
    # The key and the coefficients go out of scope here and are never stored.
    audit.record("VAULT_CREATED", ADMIN, vault_id, name=vault["name"], n=n, t=t, roles=roles,
                 filename=filename, size=len(data))

    issued = [
        {"x": x, "role": roles[x - 1], "epoch": 1, "share": share_codec.encode(vault_id, 1, x, y)}
        for x, y in shares
    ]
    return public_vault(storage.get_vault(vault_id)), issued


# --------------------------------------------------------------------- views

def public_vault(v):
    return {
        "id": v["id"], "name": v["name"], "kind": v["kind"], "filename": v["filename"],
        "mime": v["mime"], "size": v["size"], "n": v["n"], "t": v["t"], "roles": v["roles"],
        "epoch": v["epoch"], "created_at": v["created_at"], "refreshed_at": v["refreshed_at"],
        "key_check_prefix": v["key_check"][:16],
        "commitments": [_short(c) for c in v["commitments"]],
    }


def session_status(vault_id):
    v = _require_vault(vault_id)
    with _lock:
        s = _session(vault_id)
        submitted = sorted(
            ({k: val for k, val in sh.items() if k != "y"} for sh in s["shares"].values()),
            key=lambda sh: sh["x"],
        )
        forced = [{k: val for k, val in a.items() if k != "key"} for a in s["forced"]]
    verified = sum(1 for sh in submitted if sh["verified"])
    return {
        "submitted": submitted, "verified_count": verified, "threshold": v["t"],
        "ready": verified >= v["t"], "forced_attempts": forced,
    }


def list_vaults():
    return [public_vault(v) for v in storage.list_vaults()]


def get_vault(vault_id):
    return {**public_vault(_require_vault(vault_id)), "session": session_status(vault_id)}


# --------------------------------------------------------------------- shares

def submit_share(vault_id, share_text):
    v = _require_vault(vault_id)
    try:
        parsed = share_codec.decode(share_text)
    except share_codec.ShareFormatError as e:
        raise VaultError(str(e))
    if parsed["vault_id"] != vault_id:
        raise VaultError(f"this share belongs to a different vault ({parsed['vault_id']})")
    x, y = parsed["x"], parsed["y"]
    if not 1 <= x <= v["n"]:
        raise VaultError(f"share index {x} is not a custodian of this vault")

    # The real check: does (x, y) lie on the committed polynomial?
    verified = feldman.verify_share(x, y, v["commitments"])
    if verified:
        reason = None
    elif parsed["epoch"] != v["epoch"]:
        reason = (f"stale share from epoch {parsed['epoch']} (vault is at epoch {v['epoch']}); "
                  "it does not lie on the current polynomial")
    else:
        reason = "share does not lie on the committed polynomial: forged or corrupted"

    role = v["roles"][x - 1]
    entry = {
        "x": x, "role": role, "share_epoch": parsed["epoch"], "verified": verified,
        "reason": reason, "submitted_at": audit.now_iso(), "y": y,
    }
    with _lock:
        _session(vault_id)["shares"][x] = entry
    audit.record("SHARE_ACCEPTED" if verified else "SHARE_REJECTED", role, vault_id,
                 x=x, share_epoch=parsed["epoch"], feldman_valid=verified, reason=reason)
    return session_status(vault_id)


def withdraw_share(vault_id, x):
    v = _require_vault(vault_id)
    with _lock:
        removed = _session(vault_id)["shares"].pop(x, None)
    if removed:
        audit.record("SHARE_WITHDRAWN", v["roles"][x - 1], vault_id, x=x)
    return session_status(vault_id)


def reset_session(vault_id):
    _require_vault(vault_id)
    with _lock:
        _sessions.pop(vault_id, None)
    audit.record("SESSION_RESET", ADMIN, vault_id)
    return session_status(vault_id)


# --------------------------------------------------------------------- force

def force_reconstruct(vault_id, xs=None):
    """
    Run Lagrange on whatever shares are in the room, ignoring the threshold and
    ignoring failed verifications. This is the security demo: with fewer than t
    shares (or with a stale/forged share mixed in) the result is not "close" to
    the key, it is an unrelated random number.
    """
    v = _require_vault(vault_id)
    with _lock:
        pool = _session(vault_id)["shares"]
        chosen = [pool[x] for x in sorted(pool) if xs is None or x in xs]
    if not chosen:
        raise VaultError("submit at least one share first")

    value = shamir.reconstruct([(s["x"], s["y"]) for s in chosen])
    in_key_range = value < 2 ** KEY_BITS
    key_attempt = (value % 2 ** KEY_BITS).to_bytes(32, "big")
    fingerprint = crypto_box.key_fingerprint(key_attempt)
    match = in_key_range and fingerprint == v["key_check"]

    result = {
        "xs": [s["x"] for s in chosen],
        "roles": [s["role"] for s in chosen],
        "k": len(chosen),
        "t": v["t"],
        "verified_used": sum(1 for s in chosen if s["verified"]),
        "unverified_used": sum(1 for s in chosen if not s["verified"]),
        "mixed_epochs": len({s["share_epoch"] for s in chosen}) > 1,
        "value_bits": value.bit_length(),
        "value_preview": _short(value, 16),
        "in_key_range": in_key_range,
        "key_attempt_hex": key_attempt.hex(),
        "expected_fingerprint": v["key_check"][:16],
        "got_fingerprint": fingerprint[:16],
        "match": match,
    }
    audit.record("FORCED_RECONSTRUCTION", ADMIN, vault_id, xs=result["xs"], k=result["k"],
                 t=v["t"], key_matches=match)
    if match:
        # Enough genuine shares were present; don't leak plaintext here, use Unlock.
        result["message"] = "These shares DO reconstruct the real key. Use Unlock to open the vault."
        return result

    ciphertext = storage.read_ciphertext(vault_id)
    nonce = bytes.fromhex(v["nonce"])
    try:
        crypto_box.decrypt(key_attempt, nonce, ciphertext, _aad(vault_id))
        result["gcm"] = "authenticated"  # cannot happen with a wrong key
    except InvalidTag:
        result["gcm"] = "InvalidTag: authentication failed, AES-GCM refuses to decrypt"
    peek = crypto_box.peek_without_auth(key_attempt, nonce, ciphertext, PEEK_BYTES)
    result["peek_b64"] = base64.b64encode(peek).decode()

    attempt = {
        "id": secrets.token_hex(3), "xs": result["xs"], "roles": result["roles"], "k": result["k"],
        "mixed_epochs": result["mixed_epochs"], "unverified_used": result["unverified_used"],
        "at": audit.now_iso(), "key": key_attempt,
    }
    with _lock:
        _session(vault_id)["forced"].append(attempt)
    result["attempt_id"] = attempt["id"]
    return result


# --------------------------------------------------------------------- unlock

def unlock(vault_id):
    v = _require_vault(vault_id)
    with _lock:
        s = _session(vault_id)
        good = [sh for sh in s["shares"].values() if sh["verified"]]
        forced = list(s["forced"])
    if len(good) < v["t"]:
        raise VaultError(f"need {v['t']} verified shares, only {len(good)} so far")

    value = shamir.reconstruct([(sh["x"], sh["y"]) for sh in good])
    commitment_ok = feldman.verify_secret(value, v["commitments"])
    key = value.to_bytes(32, "big") if value < 2 ** KEY_BITS else None
    if key is None or crypto_box.key_fingerprint(key) != v["key_check"]:
        audit.record("UNLOCK_FAILED", ADMIN, vault_id, xs=[sh["x"] for sh in good])
        raise VaultError("reconstruction failed the fingerprint check: wrong shares")

    # Decrypt once now: GCM's tag proves the key AND the stored file are intact.
    try:
        crypto_box.decrypt(key, bytes.fromhex(v["nonce"]), storage.read_ciphertext(vault_id), _aad(vault_id))
    except InvalidTag:
        audit.record("UNLOCK_FAILED", ADMIN, vault_id, reason="ciphertext tampered")
        raise VaultError("key is correct but the stored ciphertext was tampered with")

    token = secrets.token_urlsafe(24)
    with _lock:
        _downloads[token] = {"vault_id": vault_id, "key": key, "expires": time.time() + DOWNLOAD_TTL_SECONDS}
        _sessions.pop(vault_id, None)  # wipe the submitted shares

    key_int = int.from_bytes(key, "big")
    comparison = [
        {
            "id": a["id"], "xs": a["xs"], "roles": a["roles"], "k": a["k"],
            "mixed_epochs": a["mixed_epochs"], "unverified_used": a["unverified_used"],
            "differing_bits": bin(int.from_bytes(a["key"], "big") ^ key_int).count("1"),
            "total_bits": KEY_BITS,
        }
        for a in forced
    ]
    roles = [sh["role"] for sh in sorted(good, key=lambda sh: sh["x"])]
    audit.record("UNLOCK_SUCCESS", ADMIN, vault_id, approved_by=roles, xs=sorted(sh["x"] for sh in good))
    return {
        "verified": True,
        "approved_by": roles,
        "fingerprint": v["key_check"][:16],
        "commitment_check": commitment_ok,
        "gcm": "authenticated",
        "download_token": token,
        "expires_in": DOWNLOAD_TTL_SECONDS,
        "filename": v["filename"], "mime": v["mime"], "size": v["size"], "kind": v["kind"],
        "forced_comparison": comparison,
    }


def download(vault_id, token):
    v = _require_vault(vault_id)
    with _lock:
        for tok in [k for k, d in _downloads.items() if d["expires"] < time.time()]:
            del _downloads[tok]
        grant = _downloads.get(token)
    if not grant or grant["vault_id"] != vault_id:
        raise VaultError("download link expired or invalid: unlock the vault again")
    plaintext = crypto_box.decrypt(grant["key"], bytes.fromhex(v["nonce"]),
                                   storage.read_ciphertext(vault_id), _aad(vault_id))
    audit.record("FILE_DECRYPTED", ADMIN, vault_id, filename=v["filename"])
    return plaintext, v


# --------------------------------------------------------------------- refresh

def refresh(vault_id):
    """
    Proactive share refresh. The server makes a random polynomial delta with
    delta(0) = 0 and tells each custodian delta(x_i). Each custodian adds it to
    their own share. The key is never reconstructed, the server never sees a
    share, and shares from different epochs no longer fit one polynomial.
    """
    v = _require_vault(vault_id)
    xs = list(range(1, v["n"] + 1))
    deltas, delta_coeffs = shamir.refresh_deltas(xs, v["t"])
    new_commitments = feldman.refresh_commitments(v["commitments"], delta_coeffs)
    new_epoch = v["epoch"] + 1
    storage.update_after_refresh(vault_id, new_epoch, new_commitments, audit.now_iso())
    with _lock:
        _sessions.pop(vault_id, None)  # anything submitted is from the old epoch
    audit.record("SHARES_REFRESHED", ADMIN, vault_id, from_epoch=v["epoch"], to_epoch=new_epoch,
                 c0_unchanged=new_commitments[0] == v["commitments"][0])
    return {
        "epoch": new_epoch,
        "q_hex": format(Q, "x"),
        "deltas": [{"x": x, "role": v["roles"][x - 1], "delta_hex": format(deltas[x], "x")} for x in xs],
    }


def delete_vault(vault_id):
    v = _require_vault(vault_id)
    storage.delete_vault(vault_id)
    with _lock:
        _sessions.pop(vault_id, None)
    audit.record("VAULT_DELETED", ADMIN, vault_id, name=v["name"])
