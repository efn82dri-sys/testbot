# -*- coding: utf-8 -*-
"""بارگذاریِ نگاشتِ کارت↔استیکر که با fetch_sticker_set.py یا دستی ساخته شده."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .cards import Card

_MAP_PATH = Path(__file__).parent / "sticker_map.json"


@lru_cache(maxsize=1)
def _load() -> dict:
    if not _MAP_PATH.exists():
        raise FileNotFoundError(
            f"فایلِ {_MAP_PATH.name} پیدا نشد. اول باید نگاشتِ استیکرها رو بسازی."
        )
    return json.loads(_MAP_PATH.read_text(encoding="utf-8"))


def sticker_for_card(card: Card) -> str:
    """file_id استیکرِ متناظرِ یک کارت را برمی‌گرداند."""
    data = _load()
    try:
        return data["cards"][card.key()]
    except KeyError as e:
        raise KeyError(f"استیکری برایِ کارتِ {card.key()} تو sticker_map.json نیست.") from e


def sticker_for_extra(name: str) -> str:
    """name یکی از: card_back_red, card_back_blue, joker"""
    return _load()["extras"][name]