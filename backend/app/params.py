"""
Public mathematical parameters shared by Shamir and Feldman.

We need ONE prime field for the shares that is also the order of a group in
which discrete logarithms are hard (Feldman's verification needs that). The
standard way to get both at once is a *safe prime*:

    P = 2*Q + 1      with P and Q both prime

- Shamir arithmetic (polynomials, shares, Lagrange) is done modulo Q.
- Feldman commitments live in the multiplicative group modulo P, inside the
  subgroup of order Q.

P below is the 2048-bit MODP group from RFC 3526 (section 3), a published,
well-studied safe prime, so nobody has to trust that we picked it honestly.
"""

P = int(
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D"
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9"
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
    "15728E5A8AACAA68FFFFFFFFFFFFFFFF",
    16,
)

# Order of the subgroup we work in, and the prime field for Shamir shares.
Q = (P - 1) // 2

# Generator of the order-Q subgroup. 4 = 2^2 is a square, so it lies in the
# subgroup of squares (which has order Q). Q is prime, so any element other
# than 1 generates the whole subgroup.
G = 4

# AES-256 keys are 256-bit integers; they must fit in the field (Q has 2047 bits).
KEY_BITS = 256
assert Q.bit_length() > KEY_BITS

# Shares are written as fixed-width hex so they all look the same length.
SHARE_HEX_WIDTH = (Q.bit_length() + 3) // 4
