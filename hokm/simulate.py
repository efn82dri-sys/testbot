# -*- coding: utf-8 -*-
"""اجرای یک مسابقه‌ی کامل با حرکاتِ تصادفی برای تستِ صحتِ موتور."""

import random

from .cards import Suit
from .engine import HokmMatch, Phase


def simulate_match(seed: int = 1, verbose: bool = True) -> None:
    rng = random.Random(seed)
    match = HokmMatch(team_a=(1001, 1003), team_b=(1002, 1004), rng=rng)

    hand_count = 0
    while not match.finished:
        hand = match.current_hand
        hand_count += 1
        if verbose:
            print(f"\n=== دست شماره {hand_count} | حاکم: صندلی {hand.hakem_seat} "
                  f"(کاربر {hand.seats[hand.hakem_seat]}) ===")

        # حاکم خالِ حکم را انتخاب می‌کند (اینجا تصادفی)
        trump = rng.choice(list(Suit))
        hand.choose_trump(hand.hakem_seat, trump)
        if verbose:
            print(f"خالِ حکم: {trump.name}")

        # بازیِ ۱۳ ترفند
        while hand.phase == Phase.PLAYING:
            seat = hand.turn_seat
            legal = hand.legal_moves(seat)
            card = rng.choice(legal)
            trick_result = hand.play_card(seat, card)
            if trick_result and verbose:
                cards_str = ", ".join(f"صندلی{s}:{c}" for s, c in trick_result.cards.items())
                print(f"  ترفند -> {cards_str}  | برنده: صندلی {trick_result.winner_seat}")

        res = match.on_hand_finished()
        if verbose:
            print(f"نتیجه‌ی دست: تیمِ {res.winning_team} برد "
                  f"(ترفندها={res.team_tricks}, کاپوت={res.kap}) | امتیاز کلی={match.scores}")

    print(f"\n🏆 مسابقه تمام شد. تیمِ برنده: {match.winning_team} | امتیاز نهایی: {match.scores} "
          f"| تعداد دست‌ها: {hand_count}")


if __name__ == "__main__":
    simulate_match()