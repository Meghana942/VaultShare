"""
Feldman Verifiable Secret Sharing (Paul Feldman, 1987).

Plain Shamir has a weakness: a custodian can hand in a fake share and nobody
notices until reconstruction produces garbage, and even then you can't tell
WHICH share was bad.

Feldman fixes this. When splitting, the dealer publishes a commitment to each
polynomial coefficient:

    C_j = G^(a_j) mod P        for j = 0 .. t-1

Anyone can then check a share (x, y) on its own, without learning anything
useful about the secret:

    G^y  ==  C_0 * C_1^x * C_2^(x^2) * ... * C_(t-1)^(x^(t-1))     (mod P)

Why it works: the right-hand side is G^(a_0 + a_1 x + a_2 x^2 + ...) = G^f(x).
Faking a y that passes would mean solving a discrete logarithm.

Note: C_0 = G^secret. Hiding the secret now relies on discrete log being hard
(computational security), while plain Shamir shares alone are
information-theoretically secure.
"""

from .params import G, P, Q


def commit(coeffs):
    """Public commitments to each coefficient of the sharing polynomial."""
    return [pow(G, a, P) for a in coeffs]


def verify_share(x, y, commitments):
    """True if (x, y) lies on the committed polynomial."""
    if not (0 <= y < Q):
        return False
    lhs = pow(G, y, P)
    rhs = 1
    for j, c in enumerate(commitments):
        rhs = rhs * pow(c, pow(x, j, Q), P) % P
    return lhs == rhs


def verify_secret(secret, commitments):
    """The reconstructed secret must match C_0 = G^secret."""
    return pow(G, secret, P) == commitments[0]


def refresh_commitments(commitments, delta_coeffs):
    """
    After a refresh, f'(x) = f(x) + delta(x), so each coefficient becomes
    a_j + d_j and its commitment becomes C_j * G^(d_j). Since d_0 = 0, C_0 does
    not change, which is a public sign that the secret is unchanged.
    """
    return [c * pow(G, d, P) % P for c, d in zip(commitments, delta_coeffs)]
