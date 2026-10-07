import secrets

from app import feldman, shamir
from app.params import Q


def _setup():
    secret = secrets.randbits(256)
    shares, coeffs = shamir.split(secret, n=5, t=3)
    return secret, shares, feldman.commit(coeffs)


def test_honest_shares_verify():
    secret, shares, commitments = _setup()
    assert all(feldman.verify_share(x, y, commitments) for x, y in shares)
    assert feldman.verify_secret(secret, commitments)


def test_forged_share_is_caught():
    _, shares, commitments = _setup()
    x, y = shares[1]
    assert not feldman.verify_share(x, (y + 1) % Q, commitments)
    assert not feldman.verify_share(x + 1, y, commitments)  # right y, wrong position


def test_refresh_updates_commitments_and_rejects_old_shares():
    secret, old, commitments = _setup()
    deltas, delta = shamir.refresh_deltas([x for x, _ in old], t=3)
    new = [(x, shamir.apply_delta(y, deltas[x])) for x, y in old]
    new_commitments = feldman.refresh_commitments(commitments, delta)

    assert new_commitments[0] == commitments[0]  # C0 = G^secret is unchanged
    assert all(feldman.verify_share(x, y, new_commitments) for x, y in new)
    assert not any(feldman.verify_share(x, y, new_commitments) for x, y in old)
    assert feldman.verify_secret(secret, new_commitments)
