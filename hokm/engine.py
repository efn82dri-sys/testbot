# -*- coding: utf-8 -*-
"""
موتور بازی حکم (۴ نفره، ۲ تیمِ ۲نفره، دِک ۵۲تایی).

این ماژول کاملاً مستقل از تلگرام است — منطق بازی اینجاست، اتصال به ربات
(ارسال استیکر، دکمه‌های اینلاین در پیوی) در ماژول جدا (router) پیاده می‌شود.

قوانینِ پیاده‌سازی‌شده طبق تصمیم‌های گرفته‌شده:
- تیم‌بندی: دستی (بازیکن‌ها جفتِ خودشون رو مشخص می‌کنن).
- حاکم: کسی که در پخشِ اولِ ۵ کارتی، بالاترین کارت (بر اساسِ رنک) را داشته
  باشد. در صورتِ تساوی رنک، کسی که زودتر (در ترتیبِ پخشِ کارت‌به‌کارت) آن
  رنک را گرفته، حاکم می‌شود.
- امتیاز: هر دست تا ۱۳ ترفند ادامه دارد؛ تیمی که ۷ ترفند یا بیشتر ببرد،
  «دست» را می‌برد. اگر یک تیم هر ۱۳ ترفند را ببرد (کاپوت)، آن دست ۲ امتیاز
  حساب می‌شود. مسابقه پیش‌فرض تا ۷ امتیازِ دست (قابل تنظیم) ادامه دارد.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
import random

from .cards import Card, Suit, new_shuffled_deck


class HokmError(ValueError):
    """خطای مربوط به یک حرکتِ نامعتبر یا فراخوانیِ متد در فازِ اشتباه."""


class Phase(Enum):
    DEALING_FIRST5 = auto()   # پخشِ ۵ کارتِ اول برای تعیینِ حاکم
    CHOOSING_HOKM = auto()    # منتظرِ انتخابِ خالِ حکم توسطِ حاکم
    DEALING_REST = auto()     # پخشِ ۸ کارتِ باقی‌مانده
    PLAYING = auto()          # درحالِ بازی (ترفندها)
    HAND_OVER = auto()        # این دست تمام شده، منتظرِ شروعِ دستِ بعد
    MATCH_OVER = auto()       # کلِ مسابقه تمام شده


@dataclass
class TrickResult:
    cards: dict[int, Card]        # seat -> card played
    winner_seat: int
    led_suit: Suit


@dataclass
class HandResult:
    winning_team: int             # 0 یا 1
    team_tricks: dict[int, int]   # team -> تعداد ترفندهای برده‌شده
    kap: bool                     # آیا کاپوت (۱۳-۰) بود؟
    points_awarded: int           # ۱ یا ۲ (در صورت کاپوت)


class HokmHand:
    """یک «دست» کامل حکم (از پخش تا پایانِ ۱۳ ترفند)."""

    def __init__(self, seats: list[int], dealer_seat: int, rng: random.Random | None = None):
        if len(seats) != 4:
            raise HokmError("حکم ۴ نفره است؛ باید دقیقاً ۴ بازیکن باشد.")
        self.seats = seats                 # seats[i] = user_id در صندلیِ i
        self.dealer_seat = dealer_seat
        self.rng = rng or random.Random()

        self.hands: dict[int, list[Card]] = {i: [] for i in range(4)}
        self.hakem_seat: int | None = None
        self.trump: Suit | None = None
        self.phase = Phase.DEALING_FIRST5

        self._deck: list[Card] = []
        self._deal_pointer = 0
        self._deal_order_log: list[tuple[int, Card]] = []  # برای شکستنِ تساویِ حاکم

        self.current_trick: dict[int, Card] = {}
        self.trick_leader: int | None = None
        self.turn_seat: int | None = None
        self.tricks_won: dict[int, int] = {0: 0, 1: 0}   # team -> count
        self.trick_history: list[TrickResult] = []

        self._deal_first_five()

    # ------------------------------------------------------------------ #
    # کمکی‌ها
    # ------------------------------------------------------------------ #
    def team_of_seat(self, seat: int) -> int:
        return 0 if seat % 2 == 0 else 1

    def _next_seat(self, seat: int) -> int:
        return (seat + 1) % 4

    # ------------------------------------------------------------------ #
    # فازِ ۱: پخشِ ۵ کارتِ اول + تعیینِ حاکم
    # ------------------------------------------------------------------ #
    def _deal_first_five(self) -> None:
        self._deck = new_shuffled_deck(self.rng)
        self._deal_pointer = 0
        order_seat = self._next_seat(self.dealer_seat)
        for _ in range(5):
            for i in range(4):
                seat = (order_seat + i) % 4
                card = self._deck[self._deal_pointer]
                self._deal_pointer += 1
                self.hands[seat].append(card)
                self._deal_order_log.append((seat, card))
        self.hakem_seat = self._determine_hakem()
        self.phase = Phase.CHOOSING_HOKM

    def _determine_hakem(self) -> int:
        best_rank = -1
        best_seat = None
        for seat, card in self._deal_order_log:
            if card.rank > best_rank:
                best_rank = card.rank
                best_seat = seat
            # چون به ترتیبِ زمانِ پخش پیمایش می‌کنیم، اولین رخدادِ بالاترین
            # رنک به‌طورِ طبیعی برنده می‌ماند و تساوی خودکار شکسته می‌شود.
        assert best_seat is not None
        return best_seat

    # ------------------------------------------------------------------ #
    # فازِ ۲: انتخابِ خالِ حکم
    # ------------------------------------------------------------------ #
    def choose_trump(self, seat: int, suit: Suit) -> None:
        if self.phase != Phase.CHOOSING_HOKM:
            raise HokmError("الان زمانِ انتخابِ حکم نیست.")
        if seat != self.hakem_seat:
            raise HokmError("فقط حاکم می‌تواند خالِ حکم را انتخاب کند.")
        self.trump = suit
        self._deal_rest()

    # ------------------------------------------------------------------ #
    # فازِ ۳: پخشِ ۸ کارتِ باقی‌مانده
    # ------------------------------------------------------------------ #
    def _deal_rest(self) -> None:
        order_seat = self._next_seat(self.dealer_seat)
        for _ in range(8):
            for i in range(4):
                seat = (order_seat + i) % 4
                card = self._deck[self._deal_pointer]
                self._deal_pointer += 1
                self.hands[seat].append(card)
        assert self._deal_pointer == 52
        for seat in range(4):
            assert len(self.hands[seat]) == 13
        self.phase = Phase.PLAYING
        self.trick_leader = self.hakem_seat
        self.turn_seat = self.hakem_seat
        self.current_trick = {}

    # ------------------------------------------------------------------ #
    # فازِ ۴: بازی (ترفندها)
    # ------------------------------------------------------------------ #
    def legal_moves(self, seat: int) -> list[Card]:
        if self.phase != Phase.PLAYING:
            return []
        hand = self.hands[seat]
        if not self.current_trick:
            return list(hand)  # آزاد برای شروعِ ترفند
        led_suit = self.current_trick[self.trick_leader].suit
        same_suit = [c for c in hand if c.suit == led_suit]
        return same_suit if same_suit else list(hand)

    def play_card(self, seat: int, card: Card) -> TrickResult | None:
        if self.phase != Phase.PLAYING:
            raise HokmError("الان زمانِ بازی‌کردنِ کارت نیست.")
        if seat != self.turn_seat:
            raise HokmError("نوبتِ این بازیکن نیست.")
        legal = self.legal_moves(seat)
        if card not in legal:
            raise HokmError("این کارت طبقِ قانونِ پیروی از خال مجاز نیست.")

        self.hands[seat].remove(card)
        self.current_trick[seat] = card

        if len(self.current_trick) < 4:
            self.turn_seat = self._next_seat(self.turn_seat)
            return None

        # ترفند کامل شد
        result = self._resolve_trick()
        self.trick_history.append(result)
        self.tricks_won[self.team_of_seat(result.winner_seat)] += 1
        self.current_trick = {}
        self.trick_leader = result.winner_seat
        self.turn_seat = result.winner_seat

        if sum(self.tricks_won.values()) == 13:
            self.phase = Phase.HAND_OVER
        return result

    def _resolve_trick(self) -> TrickResult:
        led_suit = self.current_trick[self.trick_leader].suit
        trumps_played = {s: c for s, c in self.current_trick.items() if c.suit == self.trump}
        if trumps_played:
            winner_seat = max(trumps_played, key=lambda s: trumps_played[s].rank)
        else:
            same_suit = {s: c for s, c in self.current_trick.items() if c.suit == led_suit}
            winner_seat = max(same_suit, key=lambda s: same_suit[s].rank)
        return TrickResult(cards=dict(self.current_trick), winner_seat=winner_seat, led_suit=led_suit)

    # ------------------------------------------------------------------ #
    def result(self) -> HandResult:
        if self.phase != Phase.HAND_OVER:
            raise HokmError("دست هنوز تمام نشده.")
        winning_team = 0 if self.tricks_won[0] > self.tricks_won[1] else 1
        kap = self.tricks_won[winning_team] == 13
        return HandResult(
            winning_team=winning_team,
            team_tricks=dict(self.tricks_won),
            kap=kap,
            points_awarded=2 if kap else 1,
        )


class HokmMatch:
    """یک مسابقه که از چند «دست» (HokmHand) پشتِ سرِ هم تشکیل می‌شود."""

    DEFAULT_TARGET_POINTS = 7

    def __init__(
        self,
        team_a: tuple[int, int],
        team_b: tuple[int, int],
        target_points: int = DEFAULT_TARGET_POINTS,
        rng: random.Random | None = None,
    ):
        # چینشِ صندلی‌ها به‌صورتِ متناوب تا هم‌تیمی‌ها روبه‌رویِ هم بنشینند:
        # صندلی ۰،۲ = تیمِ A   |   صندلی ۱،۳ = تیمِ B
        self.seats: list[int] = [team_a[0], team_b[0], team_a[1], team_b[1]]
        self.target_points = target_points
        self.rng = rng or random.Random()

        self.scores: dict[int, int] = {0: 0, 1: 0}
        self.dealer_seat = self.rng.randrange(4)
        self.hand_number = 0
        self.current_hand: HokmHand = self._start_new_hand()
        self.finished = False
        self.winning_team: int | None = None

    def _start_new_hand(self) -> HokmHand:
        self.hand_number += 1
        return HokmHand(self.seats, self.dealer_seat, rng=self.rng)

    def on_hand_finished(self) -> HandResult:
        """بعدِ اینکه current_hand به HAND_OVER رسید، این را صدا بزنید."""
        res = self.current_hand.result()
        self.scores[res.winning_team] += res.points_awarded
        if self.scores[res.winning_team] >= self.target_points:
            self.finished = True
            self.winning_team = res.winning_team
        else:
            self.dealer_seat = self._next_dealer()
            self.current_hand = self._start_new_hand()
        return res

    def _next_dealer(self) -> int:
        return (self.dealer_seat + 1) % 4

    def user_id_of_seat(self, seat: int) -> int:
        return self.seats[seat]

    def seat_of_user(self, user_id: int) -> int:
        return self.seats.index(user_id)