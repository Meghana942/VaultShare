import random

from app.params import G, P, Q


def is_probable_prime(n, rounds=40):
    if n < 4:
        return n in (2, 3)
    d, s = n - 1, 0
    while d % 2 == 0:
        d, s = d // 2, s + 1
    for _ in range(rounds):
        x = pow(random.randrange(2, n - 2), d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def test_safe_prime():
    assert P == 2 * Q + 1
    assert P.bit_length() == 2048
    assert is_probable_prime(P)
    assert is_probable_prime(Q)


def test_generator_has_order_q():
    assert G != 1
    assert pow(G, Q, P) == 1
