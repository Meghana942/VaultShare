"""
Text format for a share, so it can be copied, printed or emailed:

    svs1-<vault id>-<epoch>-<x>-<y as fixed-width hex>

The vault id and epoch are labels for humans and for routing. They are NOT
what makes a share valid: a share passes only if Feldman verification says
(x, y) lies on the vault's current polynomial. Editing the epoch label on an
old share doesn't help; the math still rejects it.
"""

import re

from .params import SHARE_HEX_WIDTH

PREFIX = "svs1"
_PATTERN = re.compile(r"^svs1-([0-9a-f]+)-(\d+)-(\d+)-([0-9a-f]+)$")


class ShareFormatError(ValueError):
    pass


def encode(vault_id, epoch, x, y):
    return f"{PREFIX}-{vault_id}-{epoch}-{x}-{y:0{SHARE_HEX_WIDTH}x}"


def decode(text):
    """Returns dict(vault_id, epoch, x, y). Whitespace and line breaks are ignored."""
    compact = re.sub(r"\s+", "", text or "").lower()
    m = _PATTERN.match(compact)
    if not m:
        raise ShareFormatError("not a valid share (expected svs1-<vault>-<epoch>-<x>-<hex>)")
    vault_id, epoch, x, y_hex = m.groups()
    return {"vault_id": vault_id, "epoch": int(epoch), "x": int(x), "y": int(y_hex, 16)}
