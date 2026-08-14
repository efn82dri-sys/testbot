# -*- coding: utf-8 -*-
"""
اتصالِ موتورِ حکم (hokm.engine) به تلگرام با aiogram 3.

معماریِ تعامل (به‌خاطرِ محدودیتِ تلگرام که نمی‌شه دکمه‌ی خصوصی داخلِ گروه
نشون داد):
    • گروه   -> لابیِ ورود، تیم‌بندی، اعلامِ رویدادهای عمومی (نوبت/نتیجه)
                و ارسالِ استیکرِ کارتِ بازی‌شده (میزِ عمومی).
    • پیوی   -> دیدنِ دستِ خصوصیِ هرکس، انتخابِ خالِ حکم توسطِ حاکم،
                و انتخابِ کارت در نوبتِ خود.

این ماژول با یک خط به ربات وصل می‌شود:
    from hokm.router import hokm_router
    dp.include_router(hokm_router)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from .cards import Card, Suit, SUIT_NAME_FA, SUIT_SYMBOL, RANK_NAME_FA
from .engine import HokmError, HokmMatch, Phase, TrickResult
from .sticker_repo import sticker_for_card

logger = logging.getLogger("hokm.router")

hokm_router = Router(name="hokm")

CB_JOIN = "hokm:join"
CB_PAIR_PREFIX = "hokm:pair:"
CB_TRUMP_PREFIX = "hokm:trump:"
CB_PLAY_PREFIX = "hokm:play:"


# ====================================================================== #
# state
# ====================================================================== #

@dataclass
class Lobby:
    chat_id: int
    phase: str = "joining"          # "joining" | "pairing"
    joined: list[int] = field(default_factory=list)
    names: dict[int, str] = field(default_factory=dict)
    message_id: int | None = None

    def render_text(self) -> str:
        lines = ["🃏 <b>بازیِ حکم</b>", "", f"بازیکنانِ حاضر ({len(self.joined)}/۴):"]
        for uid in self.joined:
            lines.append(f"• {self.names[uid]}")
        if len(self.joined) < 4:
            lines.append("\nبرای ورود، دکمه‌ی زیر رو بزن.")
        return "\n".join(lines)

    def render_keyboard(self) -> InlineKeyboardMarkup:
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🚪 ورود به بازی", callback_data=CB_JOIN)
        ]])

    def render_pairing_text(self) -> str:
        captain = self.names[self.joined[0]]
        return (
            "🃏 <b>بازیِ حکم</b>\n\n"
            f"۴ نفر جمع شدن! حالا نوبتِ <b>{captain}</b> هست که هم‌تیمیِ خودش رو انتخاب کنه:"
        )

    def render_pairing_keyboard(self) -> InlineKeyboardMarkup:
        captain = self.joined[0]
        others = [uid for uid in self.joined if uid != captain]
        buttons = [
            InlineKeyboardButton(text=self.names[uid], callback_data=f"{CB_PAIR_PREFIX}{uid}")
            for uid in others
        ]
        return InlineKeyboardMarkup(inline_keyboard=[[b] for b in buttons])


class GameManager:
    """نگهدارنده‌ی همه‌ی لابی‌ها و بازی‌های فعال (in-memory)."""

    def __init__(self) -> None:
        self.lobbies: dict[int, Lobby] = {}          # chat_id -> Lobby
        self.matches: dict[int, HokmMatch] = {}       # chat_id -> HokmMatch
        self.user_to_chat: dict[int, int] = {}        # user_id -> chat_id (بازیِ فعالِ کاربر)
        self.display_name: dict[int, str] = {}        # user_id -> نام نمایشی

    def chat_of(self, user_id: int) -> int | None:
        return self.user_to_chat.get(user_id)

    def match_of_user(self, user_id: int) -> tuple[int, HokmMatch] | tuple[None, None]:
        chat_id = self.user_to_chat.get(user_id)
        if chat_id is None:
            return None, None
        match = self.matches.get(chat_id)
        if match is None:
            return None, None
        return chat_id, match

    def cleanup_match(self, chat_id: int) -> None:
        match = self.matches.pop(chat_id, None)
        if not match:
            return
        for uid in match.seats:
            if self.user_to_chat.get(uid) == chat_id:
                del self.user_to_chat[uid]


gm = GameManager()


# ====================================================================== #
# کمکی‌های نمایش
# ====================================================================== #

def _card_label(card: Card) -> str:
    return f"{RANK_NAME_FA[card.rank]}{SUIT_SYMBOL[card.suit]}"


def _format_hand(cards: list[Card]) -> str:
    by_suit: dict[Suit, list[Card]] = {s: [] for s in Suit}
    for c in cards:
        by_suit[c.suit].append(c)
    lines = []
    for suit in Suit:
        group = sorted(by_suit[suit], key=lambda c: -c.rank)
        if group:
            lines.append(f"{SUIT_SYMBOL[suit]} " + " ".join(RANK_NAME_FA[c.rank] for c in group))
    return "\n".join(lines) if lines else "—"


def _card_from_key(key: str) -> Card:
    rank_part, suit_part = key.split("_", 1)
    rank_map = {"J": 11, "Q": 12, "K": 13, "A": 14}
    rank = rank_map.get(rank_part, int(rank_part) if rank_part.isdigit() else None)
    if rank is None:
        raise ValueError(f"کلیدِ کارتِ نامعتبر: {key}")
    return Card(rank=rank, suit=Suit[suit_part])


def _build_card_keyboard(cards: list[Card]) -> InlineKeyboardMarkup:
    cards_sorted = sorted(cards, key=lambda c: (c.suit.value, -c.rank))
    buttons = [
        InlineKeyboardButton(text=_card_label(c), callback_data=f"{CB_PLAY_PREFIX}{c.key()}")
        for c in cards_sorted
    ]
    rows = [buttons[i:i + 4] for i in range(0, len(buttons), 4)]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _build_trump_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        InlineKeyboardButton(
            text=f"{SUIT_SYMBOL[s]} {SUIT_NAME_FA[s]}",
            callback_data=f"{CB_TRUMP_PREFIX}{s.value}",
        )
        for s in Suit
    ]
    return InlineKeyboardMarkup(inline_keyboard=[buttons[:2], buttons[2:]])


async def _safe_dm(bot: Bot, user_id: int, text: str, **kwargs) -> Message | None:
    try:
        return await bot.send_message(user_id, text, **kwargs)
    except TelegramForbiddenError:
        return None


# ====================================================================== #
# شروعِ لابی در گروه
# ====================================================================== #

@hokm_router.message(Command("hokm"), F.chat.type.in_({"group", "supergroup"}))
async def cmd_hokm(message: Message, bot: Bot) -> None:
    chat_id = message.chat.id
    if chat_id in gm.matches:
        await message.reply("یه بازیِ حکم همین الان تو این گروه در جریانه. صبر کن تموم بشه یا با /hokm_stop لغوش کن.")
        return
    if chat_id in gm.lobbies:
        await message.reply("لابیِ بازی از قبل بازه — از دکمه‌ی بالا وارد شو.")
        return

    lobby = Lobby(chat_id=chat_id)
    gm.lobbies[chat_id] = lobby
    sent = await message.answer(lobby.render_text(), reply_markup=lobby.render_keyboard())
    lobby.message_id = sent.message_id


@hokm_router.message(Command("hokm_stop"), F.chat.type.in_({"group", "supergroup"}))
async def cmd_hokm_stop(message: Message, bot: Bot) -> None:
    chat_id = message.chat.id
    member = await bot.get_chat_member(chat_id, message.from_user.id)
    if member.status not in ("administrator", "creator"):
        await message.reply("فقط ادمین‌های گروه می‌تونن بازی رو لغو کنن.")
        return
    had_something = False
    if chat_id in gm.lobbies:
        del gm.lobbies[chat_id]
        had_something = True
    if chat_id in gm.matches:
        gm.cleanup_match(chat_id)
        had_something = True
    await message.reply("بازی/لابی لغو شد." if had_something else "چیزی برای لغو‌کردن نبود.")


@hokm_router.callback_query(F.data == CB_JOIN)
async def cb_join(callback: CallbackQuery, bot: Bot) -> None:
    chat_id = callback.message.chat.id
    lobby = gm.lobbies.get(chat_id)
    if not lobby or lobby.phase != "joining":
        await callback.answer("این لابی دیگه فعال نیست.", show_alert=True)
        return

    user = callback.from_user
    if user.id in lobby.joined:
        await callback.answer("قبلاً وارد شدی ✅")
        return
    if len(lobby.joined) >= 4:
        await callback.answer("لابی پره.", show_alert=True)
        return

    lobby.joined.append(user.id)
    lobby.names[user.id] = user.full_name
    gm.display_name[user.id] = user.full_name
    await callback.answer("وارد بازی شدی ✅")

    if len(lobby.joined) < 4:
        await bot.edit_message_text(
            chat_id=chat_id, message_id=lobby.message_id,
            text=lobby.render_text(), reply_markup=lobby.render_keyboard(),
        )
        return

    lobby.phase = "pairing"
    await bot.edit_message_text(
        chat_id=chat_id, message_id=lobby.message_id,
        text=lobby.render_pairing_text(), reply_markup=lobby.render_pairing_keyboard(),
    )


@hokm_router.callback_query(F.data.startswith(CB_PAIR_PREFIX))
async def cb_pick_partner(callback: CallbackQuery, bot: Bot) -> None:
    chat_id = callback.message.chat.id
    lobby = gm.lobbies.get(chat_id)
    if not lobby or lobby.phase != "pairing":
        await callback.answer("این مرحله دیگه فعال نیست.", show_alert=True)
        return

    captain_id = lobby.joined[0]
    if callback.from_user.id != captain_id:
        await callback.answer(f"فقط {lobby.names[captain_id]} می‌تونه تیم رو مشخص کنه.", show_alert=True)
        return

    partner_id = int(callback.data[len(CB_PAIR_PREFIX):])
    if partner_id not in lobby.joined or partner_id == captain_id:
        await callback.answer("انتخابِ نامعتبر.", show_alert=True)
        return

    team_a = (captain_id, partner_id)
    team_b = tuple(uid for uid in lobby.joined if uid not in team_a)
    names = dict(lobby.names)
    del gm.lobbies[chat_id]

    await callback.answer("تیم‌بندی انجام شد!")
    await bot.edit_message_text(
        chat_id=chat_id, message_id=lobby.message_id,
        text=(
            "🃏 <b>تیم‌بندی نهایی شد</b>\n\n"
            f"تیمِ ۱: {names[team_a[0]]} 🤝 {names[team_a[1]]}\n"
            f"تیمِ ۲: {names[team_b[0]]} 🤝 {names[team_b[1]]}\n\n"
            "کارت‌ها الان تو پیویِ هرکس ارسال می‌شه..."
        ),
    )

    ok = await _start_match(chat_id, team_a, team_b, bot)
    if not ok:
        await bot.send_message(
            chat_id,
            "⚠️ نشد بازی رو شروع کنم — یکی از بازیکن‌ها باید اول ربات رو تو پیوی /start بزنه، بعد دوباره /hokm.",
        )


# ====================================================================== #
# شروعِ مسابقه و مدیریتِ دست‌ها
# ====================================================================== #

async def _start_match(chat_id: int, team_a: tuple[int, int], team_b: tuple[int, int], bot: Bot) -> bool:
    all_players = [*team_a, *team_b]

    # پیش از ساختِ بازی، مطمئن شو همه با ربات پیوی داشتن (وگرنه نمی‌تونیم
    # دستِ خصوصیِ کسی رو براش بفرستیم).
    for uid in all_players:
        pinged = await _safe_dm(bot, uid, "🃏 بازیِ حکمِ گروهت شروع شد! کارت‌هات همین‌الان می‌رسه...")
        if pinged is None:
            return False

    match = HokmMatch(team_a=team_a, team_b=team_b)
    gm.matches[chat_id] = match
    for uid in all_players:
        gm.user_to_chat[uid] = chat_id

    await _announce_new_hand(chat_id, bot)
    return True


async def _announce_new_hand(chat_id: int, bot: Bot) -> None:
    match = gm.matches[chat_id]
    hand = match.current_hand
    hakem_uid = match.user_id_of_seat(hand.hakem_seat)
    hakem_name = gm.display_name.get(hakem_uid, "؟")

    await bot.send_message(
        chat_id,
        f"🃏 <b>دستِ شماره‌ی {match.hand_number}</b>\n"
        f"حاکم: <b>{hakem_name}</b> — در انتظارِ انتخابِ خالِ حکم...",
    )

    for seat in range(4):
        uid = match.user_id_of_seat(seat)
        hand_text = f"دستِ اولیه‌ات:\n{_format_hand(hand.hands[seat])}"
        if seat == hand.hakem_seat:
            await _safe_dm(
                bot, uid,
                f"👑 حاکمِ این دست تویی!\n\n{hand_text}\n\nخالِ حکم رو انتخاب کن:",
                reply_markup=_build_trump_keyboard(),
            )
        else:
            await _safe_dm(bot, uid, f"{hand_text}\n\nمنتظرِ انتخابِ حکم توسطِ {hakem_name} هستیم...")


@hokm_router.callback_query(F.data.startswith(CB_TRUMP_PREFIX), F.message.chat.type == "private")
async def cb_choose_trump(callback: CallbackQuery, bot: Bot) -> None:
    user_id = callback.from_user.id
    chat_id, match = gm.match_of_user(user_id)
    if not match:
        await callback.answer("بازیِ فعالی برات پیدا نشد.", show_alert=True)
        return

    hand = match.current_hand
    seat = match.seat_of_user(user_id)
    suit_value = int(callback.data[len(CB_TRUMP_PREFIX):])
    suit = Suit(suit_value)

    try:
        hand.choose_trump(seat, suit)
    except HokmError as e:
        await callback.answer(str(e), show_alert=True)
        return

    await callback.answer(f"خالِ حکم: {SUIT_NAME_FA[suit]} ✅")
    await callback.message.edit_reply_markup(reply_markup=None)

    await bot.send_message(
        chat_id,
        f"🔔 خالِ حکم اعلام شد: <b>{SUIT_SYMBOL[suit]} {SUIT_NAME_FA[suit]}</b>\nکارت‌های باقی‌مونده پخش شد، بازی شروع می‌شه!",
    )

    for seat_i in range(4):
        uid = match.user_id_of_seat(seat_i)
        await _safe_dm(bot, uid, f"دستِ کاملِ تو (۱۳ کارت):\n{_format_hand(hand.hands[seat_i])}")

    await _prompt_turn(chat_id, bot)


async def _prompt_turn(chat_id: int, bot: Bot) -> None:
    match = gm.matches[chat_id]
    hand = match.current_hand
    seat = hand.turn_seat
    uid = match.user_id_of_seat(seat)
    name = gm.display_name.get(uid, "؟")
    legal = hand.legal_moves(seat)

    await bot.send_message(chat_id, f"🕓 نوبتِ <b>{name}</b>")
    await _safe_dm(bot, uid, "نوبتِ توئه، یه کارت انتخاب کن:", reply_markup=_build_card_keyboard(legal))


@hokm_router.callback_query(F.data.startswith(CB_PLAY_PREFIX), F.message.chat.type == "private")
async def cb_play_card(callback: CallbackQuery, bot: Bot) -> None:
    user_id = callback.from_user.id
    chat_id, match = gm.match_of_user(user_id)
    if not match:
        await callback.answer("بازیِ فعالی برات پیدا نشد.", show_alert=True)
        return

    hand = match.current_hand
    seat = match.seat_of_user(user_id)
    try:
        card = _card_from_key(callback.data[len(CB_PLAY_PREFIX):])
        trick_result = hand.play_card(seat, card)
    except (HokmError, ValueError) as e:
        await callback.answer(str(e), show_alert=True)
        return

    await callback.answer(f"{_card_label(card)} بازی شد ✅")
    await callback.message.edit_reply_markup(reply_markup=None)

    try:
        await bot.send_sticker(chat_id, sticker_for_card(card))
    except (KeyError, TelegramBadRequest) as e:
        logger.warning("sticker missing/invalid for %s: %s", card.key(), e)
        await bot.send_message(chat_id, f"({_card_label(card)} بازی شد)")

    if trick_result is None:
        await _prompt_turn(chat_id, bot)
        return

    await _announce_trick(chat_id, trick_result, match, bot)

    if hand.phase == Phase.HAND_OVER:
        await _finish_hand(chat_id, bot)
    else:
        await _prompt_turn(chat_id, bot)


async def _announce_trick(chat_id: int, trick: TrickResult, match: HokmMatch, bot: Bot) -> None:
    winner_name = gm.display_name.get(match.user_id_of_seat(trick.winner_seat), "؟")
    hand = match.current_hand
    await bot.send_message(
        chat_id,
        f"🏁 این ترفند رو <b>{winner_name}</b> برد.\n"
        f"امتیازِ ترفندها — تیمِ ۱: {hand.tricks_won[0]} | تیمِ ۲: {hand.tricks_won[1]}",
    )


async def _finish_hand(chat_id: int, bot: Bot) -> None:
    match = gm.matches[chat_id]
    res = match.on_hand_finished()

    kap_text = " 🎉 <b>کاپوت!</b>" if res.kap else ""
    await bot.send_message(
        chat_id,
        f"🏆 این دست رو <b>تیمِ {res.winning_team + 1}</b> برد "
        f"({res.team_tricks[0]}–{res.team_tricks[1]}).{kap_text}\n"
        f"امتیازِ کلیِ مسابقه — تیمِ ۱: {match.scores[0]} | تیمِ ۲: {match.scores[1]}",
    )

    if match.finished:
        await bot.send_message(
            chat_id,
            f"🎊 <b>مسابقه تمام شد!</b> برنده: تیمِ {match.winning_team + 1} 🎊",
        )
        gm.cleanup_match(chat_id)
        return

    await _announce_new_hand(chat_id, bot)