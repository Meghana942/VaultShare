"""
Hybrid encryption: the FILE is encrypted with AES-256-GCM under a random key,
and only that 32-byte KEY is split with Shamir.

Why not Shamir-split the file directly? Every share would be as large as the
file (a 10 MB PDF x 5 custodians = 50 MB of shares), splitting would mean
polynomial arithmetic over every chunk of the file, and you'd lose the
integrity check GCM gives for free. Splitting a 256-bit key is instant, and
each share stays the same small size whatever the file size.
"""

import hashlib
import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_BYTES = 32
NONCE_BYTES = 12
TAG_BYTES = 16


def new_key():
    """A fresh random AES-256 key from the OS cryptographic RNG."""
    return AESGCM.generate_key(bit_length=256)


def encrypt(key, plaintext, aad):
    """
    AES-256-GCM. Returns (nonce, ciphertext_with_tag).
    `aad` (here: the vault id) is authenticated but not encrypted, so a
    ciphertext can't be swapped between vaults.
    """
    nonce = os.urandom(NONCE_BYTES)
    return nonce, AESGCM(key).encrypt(nonce, plaintext, aad)


def decrypt(key, nonce, ciphertext, aad):
    """Raises cryptography.exceptions.InvalidTag if the key or data is wrong."""
    return AESGCM(key).decrypt(nonce, ciphertext, aad)


def key_fingerprint(key):
    """
    SHA-256 check value stored with the vault, so the system can say
    "reconstruction verified" vs "wrong shares" before touching the file.
    Domain-separated so it can't be confused with any other hash of the key.
    """
    return hashlib.sha256(b"shamir-vault/key-check/v1" + key).hexdigest()


def peek_without_auth(key, nonce, ciphertext, length=4096):
    """
    DEMO ONLY. Shows what the ciphertext turns into under a given key, *skipping*
    GCM's authentication check (which would simply refuse a wrong key).

    GCM is AES in counter mode plus a MAC. For a 96-bit nonce the first counter
    block used for data is nonce || 00000002, so CTR mode from that block
    reproduces GCM's keystream. With the right key this yields the real
    plaintext; with a wrong key it yields uniformly random-looking bytes.
    """
    body = ciphertext[:-TAG_BYTES][:length]
    counter0 = nonce + (2).to_bytes(4, "big")
    dec = Cipher(algorithms.AES(key), modes.CTR(counter0)).decryptor()
    return dec.update(body) + dec.finalize()
