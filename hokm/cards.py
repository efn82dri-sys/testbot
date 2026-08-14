# -*- coding: utf-8 -*-
"""
مدل کارت و دِک برای موتور بازی حکم.
این ماژول کاملاً مستقل از تلگرام است تا بشود آن را جدا تست کرد.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from enum import IntEnum


class Suit(IntEnum):
    CLUBS = 0     # گشنیز ♣
    DIAMONDS = 1  # خشت ♦
    HEARTS = 2    # دل ♥
    SPADES = 3    # پیک ♠


SUIT_SYMBOL = {
    Suit.CLUBS: "♣",
    Suit.DIAMONDS: "♦",
    Suit.HEARTS: "♥",
    Suit.SPADES: "♠",
}

SUIT_NAME_FA = {
    Suit.CLUBS: "گشنیز",
    Suit.DIAMONDS: "خشت",
    Suit.HEARTS: "دل",
    Suit.SPADES: "پیک",
}

# رنک‌ها: ۲ تا ۱۰، سپس J=11 Q=12 K=13 A=14 (تک بالاترین کارت است)
RANK_NAME_FA = {
    2: "۲", 3: "۳", 4: "۴", 5: "۵", 6: "۶", 7: "۷", 8: "۸",
    9: "۹", 10: "۱۰", 11: "سرباز", 12: "بی‌بی", 13: "شاه", 14: "تک",
}


@dataclass(frozen=True, order=False)
class Card:
    rank: int   # 2..14
    suit: Suit

    def __str__(self) -> str:
        return f"{RANK_NAME_FA[self.rank]}{SUIT_SYMBOL[self.suit]}"

    def __repr__(self) -> str:
        return f"Card({self.rank},{self.suit.name})"

    def key(self) -> str:
        """کلید پایدار برای نگاشت به استیکر، مثلا 'A_SPADES' یا '10_HEARTS'."""
        rank_key = {11: "J", 12: "Q", 13: "K", 14: "A"}.get(self.rank, str(self.rank))
        return f"{rank_key}_{self.suit.name}"


def build_deck() -> list[Card]:
    return [Card(rank, suit) for suit in Suit for rank in range(2, 15)]


def new_shuffled_deck(rng: random.Random | None = None) -> list[Card]:
    rng = rng or random.Random()
    deck = build_deck()
    rng.shuffle(deck)
    return deck