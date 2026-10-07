import json

from fastapi.testclient import TestClient

from app import share_codec
from app.main import app

ROLES = ["CEO", "CTO", "CFO", "Legal Counsel", "CISO"]
PDF = b"%PDF-1.7\n" + b"confidential board minutes " * 2000


def _create(client, t=3):
    r = client.post(
        "/api/vaults",
        data={"name": "Board minutes", "threshold": str(t), "roles": json.dumps(ROLES)},
        files={"file": ("minutes.pdf", PDF, "application/pdf")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return body["vault"]["id"], {s["role"]: s["share"] for s in body["shares"]}


def _submit(client, vid, share):
    r = client.post(f"/api/vaults/{vid}/shares", json={"share": share})
    assert r.status_code == 200, r.text
    return r.json()


def test_full_flow_force_then_unlock():
    with TestClient(app) as client:
        vid, shares = _create(client)
        for s in shares.values():
            assert len(s) < 600  # shares are small, independent of the file size

        _submit(client, vid, shares["CEO"])
        status = _submit(client, vid, shares["CTO"])
        assert status["verified_count"] == 2 and not status["ready"]

        # The "app refuses" path...
        assert client.post(f"/api/vaults/{vid}/unlock").status_code == 400

        # ...and the real security story: forcing it with 2 shares yields garbage.
        forced = client.post(f"/api/vaults/{vid}/force", json={}).json()
        assert forced["match"] is False
        assert forced["k"] == 2 and forced["value_bits"] > 256
        assert forced["gcm"].startswith("InvalidTag")
        assert forced["expected_fingerprint"] != forced["got_fingerprint"]

        status = _submit(client, vid, shares["CFO"])
        assert status["ready"]
        result = client.post(f"/api/vaults/{vid}/unlock").json()
        assert result["verified"] and result["commitment_check"]
        assert result["approved_by"] == ["CEO", "CTO", "CFO"]
        # The 2-share attempt was not a near miss: roughly half the bits differ.
        diff = result["forced_comparison"][0]["differing_bits"]
        assert 80 < diff < 176

        file = client.get(f"/api/vaults/{vid}/download", params={"token": result["download_token"]})
        assert file.status_code == 200 and file.content == PDF

        # Shares were wiped from the session after unlock.
        assert client.get(f"/api/vaults/{vid}").json()["session"]["submitted"] == []


def test_forged_share_rejected_by_feldman():
    with TestClient(app) as client:
        vid, shares = _create(client)
        p = share_codec.decode(shares["CTO"])
        forged = share_codec.encode(vid, p["epoch"], p["x"], p["y"] ^ 1)
        status = _submit(client, vid, forged)
        assert status["verified_count"] == 0
        assert "forged" in status["submitted"][0]["reason"]


def test_refresh_invalidates_old_shares():
    with TestClient(app) as client:
        vid, shares = _create(client)
        refresh = client.post(f"/api/vaults/{vid}/refresh").json()
        assert refresh["epoch"] == 2
        q = int(refresh["q_hex"], 16)
        deltas = {d["x"]: int(d["delta_hex"], 16) for d in refresh["deltas"]}

        new = {}
        for role, s in shares.items():
            p = share_codec.decode(s)
            new[role] = share_codec.encode(vid, 2, p["x"], (p["y"] + deltas[p["x"]]) % q)

        # Old share: rejected even if someone relabels it as epoch 2.
        p = share_codec.decode(shares["CEO"])
        relabelled = share_codec.encode(vid, 2, p["x"], p["y"])
        assert _submit(client, vid, relabelled)["verified_count"] == 0

        _submit(client, vid, new["CTO"])
        _submit(client, vid, new["CFO"])
        # Mixing the relabelled old share with two new ones: garbage.
        mixed = client.post(f"/api/vaults/{vid}/force", json={}).json()
        assert mixed["match"] is False and mixed["unverified_used"] == 1

        # Same with the honestly-labelled old share.
        _submit(client, vid, shares["CEO"])
        mixed = client.post(f"/api/vaults/{vid}/force", json={}).json()
        assert mixed["match"] is False and mixed["mixed_epochs"]

        _submit(client, vid, new["CEO"])
        assert client.post(f"/api/vaults/{vid}/unlock").json()["verified"]


def test_share_for_other_vault_and_bad_threshold():
    with TestClient(app) as client:
        vid_a, shares_a = _create(client)
        vid_b, _ = _create(client)
        r = client.post(f"/api/vaults/{vid_b}/shares", json={"share": shares_a["CEO"]})
        assert r.status_code == 400
        bad = client.post("/api/vaults", data={"name": "x", "threshold": "9", "roles": json.dumps(ROLES),
                                               "text": "hello"})
        assert bad.status_code == 400


def test_audit_chain_detects_tampering():
    from app import storage

    with TestClient(app) as client:
        _create(client)
        assert client.get("/api/audit/verify").json()["ok"]
        with storage.connect() as db:
            db.execute("UPDATE audit SET actor = 'Mallory' WHERE id = 1")
        check = client.get("/api/audit/verify").json()
        assert not check["ok"] and check["broken_at"] == 1
        with storage.connect() as db:  # put it back for other tests
            db.execute("UPDATE audit SET actor = 'Vault admin' WHERE id = 1")
