import os

import pytest
from cryptography.exceptions import InvalidTag

from app import crypto_box


def test_roundtrip_and_wrong_key():
    key, data, aad = crypto_box.new_key(), os.urandom(10_000), b"vault-a"
    nonce, ct = crypto_box.encrypt(key, data, aad)
    assert crypto_box.decrypt(key, nonce, ct, aad) == data
    with pytest.raises(InvalidTag):
        crypto_box.decrypt(crypto_box.new_key(), nonce, ct, aad)
    with pytest.raises(InvalidTag):
        crypto_box.decrypt(key, nonce, ct, b"vault-b")  # ciphertext bound to its vault


def test_unauthenticated_peek_matches_gcm_keystream():
    key, data = crypto_box.new_key(), b"%PDF-1.7 hello world " * 300
    nonce, ct = crypto_box.encrypt(key, data, b"")
    assert crypto_box.peek_without_auth(key, nonce, ct, 4096) == data[:4096]
    garbage = crypto_box.peek_without_auth(crypto_box.new_key(), nonce, ct, 4096)
    assert garbage[:5] != b"%PDF-"


def test_fingerprint_is_stable_and_key_specific():
    k1, k2 = crypto_box.new_key(), crypto_box.new_key()
    assert crypto_box.key_fingerprint(k1) == crypto_box.key_fingerprint(k1)
    assert crypto_box.key_fingerprint(k1) != crypto_box.key_fingerprint(k2)
