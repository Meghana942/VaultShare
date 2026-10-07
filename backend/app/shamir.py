"""
Shamir's Secret Sharing (Adi Shamir, 1979), written out in full.

Idea: hide the secret S as the y-intercept of a random polynomial of degree t-1

    f(x) = S + a1*x + a2*x^2 + ... + a(t-1)*x^(t-1)      (mod Q)

and give person i the point (i, f(i)). Any t points pin down exactly one
polynomial of degree t-1 (Lagrange interpolation), so t people recover S = f(0).
With only t-1 points, EVERY possible S is matched by exactly one polynomial, so
the points say nothing about S. That is information-theoretic security:
no amount of computing power helps.

All arithmetic is modulo the prime Q (see params.py). Working in a finite field
instead of the real numbers is what makes "every S equally possible" exactly true.
"""

import secrets

from .params import Q


def eval_poly(coeffs, x, q=Q):
    """Evaluate coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ... at x (Horner's rule)."""
    result = 0
    for c in reversed(coeffs):
        result = (result * x + c) % q
    return result


def random_polynomial(secret, t, q=Q):
    """Random polynomial of degree exactly t-1 whose constant term is the secret."""
    if not 0 <= secret < q:
        raise ValueError("secret must be in the field [0, q)")
    middle = [secrets.randbelow(q) for _ in range(t - 2)]
    leading = secrets.randbelow(q - 1) + 1  # non-zero, so the degree really is t-1
    return [secret] + middle + [leading] if t > 1 else [secret]


def split(secret, n, t, q=Q):
    """
    Split `secret` into n shares, any t of which recover it.
    Returns (shares, coeffs), where shares = [(1, f(1)), ..., (n, f(n))].
    The caller needs coeffs only for Feldman commitments and must then forget them.
    """
    if not 1 <= t <= n:
        raise ValueError("need 1 <= t <= n")
    if n >= q:
        raise ValueError("too many shares for this field")
    coeffs = random_polynomial(secret, t, q)
    shares = [(x, eval_poly(coeffs, x, q)) for x in range(1, n + 1)]
    return shares, coeffs


def lagrange_basis_at_zero(xs, i, q=Q):
    """
    L_i(0) = product over j != i of (0 - x_j) / (x_i - x_j)   (mod q)

    L_i is the polynomial that equals 1 at x_i and 0 at every other x_j.
    Division mod q means multiplying by the modular inverse.
    """
    num, den = 1, 1
    for j, xj in enumerate(xs):
        if j == i:
            continue
        num = num * (-xj) % q
        den = den * (xs[i] - xj) % q
    return num * pow(den, -1, q) % q


def reconstruct(shares, q=Q):
    """
    Lagrange interpolation at x = 0:   f(0) = sum of y_i * L_i(0)   (mod q)

    Given t or more correct shares this returns the secret. Given fewer than t,
    it still returns *a* number (the intercept of the lower-degree curve through
    those points), but that number is unrelated to the secret.
    """
    if not shares:
        raise ValueError("no shares given")
    xs = [x for x, _ in shares]
    if len(set(xs)) != len(xs):
        raise ValueError("duplicate share x-coordinates")
    secret = 0
    for i, (_, yi) in enumerate(shares):
        secret = (secret + yi * lagrange_basis_at_zero(xs, i, q)) % q
    return secret


# ---------------------------------------------------------------------------
# Proactive share refresh (Herzberg et al., 1995 - simplified, single dealer)
# ---------------------------------------------------------------------------

def zero_polynomial(t, q=Q):
    """Random polynomial of degree t-1 with constant term 0: delta(0) = 0."""
    return [0] + [secrets.randbelow(q) for _ in range(t - 1)]


def refresh_deltas(xs, t, q=Q):
    """
    New shares are f'(x) = f(x) + delta(x). Because delta(0) = 0, f'(0) = f(0):
    same secret, brand-new random polynomial. Each holder adds delta(x_i) to their
    own share, so nobody (including this server) ever reconstructs the secret.

    Returns ({x: delta(x)}, delta_coeffs). delta_coeffs are needed once to update
    the Feldman commitments and must then be discarded.
    """
    delta = zero_polynomial(t, q)
    return {x: eval_poly(delta, x, q) for x in xs}, delta


def apply_delta(y, delta_y, q=Q):
    """What each custodian does locally after a refresh: y' = y + delta(x)."""
    return (y + delta_y) % q
