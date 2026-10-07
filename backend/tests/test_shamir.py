import itertools
import secrets

import pytest

from app import shamir
from app.params import Q


def test_any_t_shares_recover_the_secret():
    secret = secrets.randbits(256)
    shares, _ = shamir.split(secret, n=5, t=3)
    for subset in itertools.combinations(shares, 3):
        assert shamir.reconstruct(list(subset)) == secret
    assert shamir.reconstruct(shares) == secret  # more than t also works


def test_fewer_than_t_shares_give_an_unrelated_number():
    secret = secrets.randbits(256)
    shares, _ = shamir.split(secret, n=5, t=3)
    for subset in itertools.combinations(shares, 2):
        wrong = shamir.reconstruct(list(subset))
        assert wrong != secret
        assert wrong.bit_length() > 256  # not even in the AES key range (overwhelmingly likely)


def test_duplicate_x_is_rejected():
    shares, _ = shamir.split(42, n=3, t=2)
    with pytest.raises(ValueError):
        shamir.reconstruct([shares[0], shares[0]])


def test_perfect_secrecy_exhaustively_in_a_small_field():
    """
    In GF(31) with t = 3: fix two shares. Count, for each candidate secret s,
    how many polynomials f(x) = s + a1 x + a2 x^2 produce exactly those shares.
    Every s must be matched by exactly ONE polynomial -> 2 shares reveal nothing.
    """
    q = 31
    shares, _ = shamir.split(17, n=3, t=3, q=q)
    (x1, y1), (x2, y2) = shares[0], shares[1]
    counts = {s: 0 for s in range(q)}
    for s in range(q):
        for a1 in range(q):
            for a2 in range(q):
                f = [s, a1, a2]
                if shamir.eval_poly(f, x1, q) == y1 and shamir.eval_poly(f, x2, q) == y2:
                    counts[s] += 1
    assert set(counts.values()) == {1}


def test_refresh_keeps_secret_and_kills_old_shares():
    secret = secrets.randbits(256)
    old, _ = shamir.split(secret, n=5, t=3)
    deltas, delta = shamir.refresh_deltas([x for x, _ in old], t=3)
    assert delta[0] == 0
    new = [(x, shamir.apply_delta(y, deltas[x])) for x, y in old]

    assert shamir.reconstruct(new[:3]) == secret          # new shares work
    assert shamir.reconstruct(old[2:]) == secret          # old shares still agree with each other...
    mixed = [old[0], new[1], new[2]]
    assert shamir.reconstruct(mixed) != secret            # ...but can't be combined with new ones
    assert all(o[1] != n[1] for o, n in zip(old, new))


def test_secret_must_be_in_field():
    with pytest.raises(ValueError):
        shamir.split(Q, n=3, t=2)
