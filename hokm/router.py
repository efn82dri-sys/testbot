# -*- coding: utf-8 -*-
"""
اتصالِ موتورِ حکم (hokm.engine) به تلگرام با aiogram 3.

معماریِ تعامل (به‌خاطرِ محدودیتِ تلگرام که نمی‌شه دکمه‌ی خصوصی داخلِ گروه
نشون داد):
    • گروه   -> لابیِ ورود، تیم‌بندی، اعلامِ رویدادهای عمومی (نوبت/نتیجه)
                و ارسالِ استیکرِ کارتِ بازی‌شده (میزِ عمومی).
    • پیوی   -> دیدنِ دستِ خصوصیِ هرکس، انتخابِ خالِ حکم توسطِ حاکم،
                و انتخابِ کارت در نوبتِ خود.
"""

from __future__ import annotations

import asyncio
import logging
import random
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
CB_NOOP = "hokm:noop"

TURN_TIMEOUT_SECONDS = 30


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
        lines = [
            "♠️♥️ <b>میز حکم</b> ♦️♣️",
            "━━━━━━━━━━━━━━━",
            f"🎯 <b>بازیکنانِ حاضر ({len(self.joined)}/۴):</b>",
        ]
        if self.joined:
            for i, uid in enumerate(self.joined, start=1):
                tag = " 👑" if i == 1 else ""
                lines.append(f"{i}. {self.names[uid]}{tag}")
        else:
            lines.append("هنوز کسی ننشسته...")
        if len(self.joined) < 4:
            lines.append(f"\n⏳ {4 - len(self.joined)} صندلیِ خالی باقی مانده.")
            lines.append("👇 برای گرفتنِ صندلی، دکمه‌ی زیر رو بزن")
        return "\n".join(lines)

    def render_keyboard(self) -> InlineKeyboardMarkup:
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🪑 گرفتنِ صندلی", callback_data=CB_JOIN)
        ]])

    def render_pairing_text(self) -> str:
        captain = self.names[self.joined[0]]
        return (
            "♠️♥️ <b>میز حکم</b> ♦️♣️\n"
            "━━━━━━━━━━━━━━━\n"
            f"✅ میز پر شد! حالا نوبتِ <b>{captain}</b> 👑 (کاپیتان) است تا هم‌تیمیِ خودش رو انتخاب کنه.\n\n"
            "🔹 نفرِ انتخاب‌شده هم‌تیمیِ کاپیتان می‌شود؛ دو نفرِ باقی‌مانده تیمِ حریف خواهند بود."
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
        self.timeout_tasks: dict[int, asyncio.Task] = {} # chat_id -> تسک تایم‌اوت

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
        if chat_id in self.timeout_tasks:
            self.timeout_tasks[chat_id].cancel()
            del self.timeout_tasks[chat_id]
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
    if not cards:
        return "🃏 دستِ شما خالی است."
    by_suit: dict[Suit, list[Card]] = {s: [] for s in Suit}
    for c in cards:
        by_suit[c.suit].append(c)
    lines = [f"🃏 <b>دستِ شما</b> ({len(cards)} کارت):"]
    for suit in Suit:
        group = sorted(by_suit[suit], key=lambda c: -c.rank)
        if group:
            cards_str = "  ".join(RANK_NAME_FA[c.rank] for c in group)
            lines.append(f"{SUIT_SYMBOL[suit]} <i>{SUIT_NAME_FA[suit]}</i>: <b>{cards_str}</b>")
    return "\n".join(lines)


def _build_card_keyboard(cards: list[Card]) -> InlineKeyboardMarkup:
    """
    کیبورد کارت‌ها را به‌صورت دسته‌بندی‌شده بر اساس خال می‌سازد:
    یک ردیفِ عنوان (غیرقابل‌کلیک) برای هر خال، و زیرِ آن ردیف‌های ۴تایی
    از کارت‌های همان خال. این‌طور تشخیصِ کارت‌ها برای کاربر خیلی راحت‌تر می‌شود.
    """
    by_suit: dict[Suit, list[Card]] = {s: [] for s in Suit}
    for c in cards:
        by_suit[c.suit].append(c)

    rows: list[list[InlineKeyboardButton]] = []
    for suit in Suit:
        group = sorted(by_suit[suit], key=lambda c: -c.rank)
        if not group:
            continue
        header = InlineKeyboardButton(
            text=f"— {SUIT_SYMBOL[suit]} {SUIT_NAME_FA[suit]} —",
            callback_data=CB_NOOP,
        )
        rows.append([header])
        card_buttons = [
            InlineKeyboardButton(text=RANK_NAME_FA[c.rank], callback_data=f"{CB_PLAY_PREFIX}{c.key()}")
            for c in group
        ]
        for i in range(0, len(card_buttons), 4):
            rows.append(card_buttons[i:i + 4])

    return InlineKeyboardMarkup(inline_keyboard=rows)


@hokm_router.callback_query(F.data == CB_NOOP)
async def cb_noop(callback: CallbackQuery) -> None:
    # دکمه‌ی عنوانِ خال؛ صرفاً یک برچسبِ بصری است و کاری انجام نمی‌دهد.
    await callback.answer()


def _build_trump_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        InlineKeyboardButton(
            text=f"{SUIT_SYMBOL[s]} {SUIT_NAME_FA[s]}",
            callback_data=f"{CB_TRUMP_PREFIX}{s.value}",
        )
        for s in Suit
    ]
    return InlineKeyboardMarkup(inline_keyboard=[buttons[:2], buttons[2:]])


def _card_from_key(key: str) -> Card:
    rank_part, suit_part = key.split("_", 1)
    rank_map = {"J": 11, "Q": 12, "K": 13, "A": 14}
    rank = rank_map.get(rank_part, int(rank_part) if rank_part.isdigit() else None)
    if rank is None:
        raise ValueError(f"کلیدِ کارتِ نامعتبر: {key}")
    return Card(rank=rank, suit=Suit[suit_part])


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
        await message.reply("⚔️ یک بازیِ حکم هم‌اکنون در همین گروه در جریان است. صبر کنید تا تمام شود.")
        return
    if chat_id in gm.lobbies:
        await message.reply("🃏 میزِ حکم از قبل بازه — از دکمه‌ی بالا صندلیِ خودت رو بگیر.")
        return

    lobby = Lobby(chat_id=chat_id)
    gm.lobbies[chat_id] = lobby
    
    text = (
        "♠️♥️ <b>میز حکم باز شد!</b> ♦️♣️\n"
        "━━━━━━━━━━━━━━━\n"
        "یک صندلی خالیه... کی جرأت می‌کنه بشینه رو صندلیِ حاکم؟ 👑\n\n"
        "🎮 <b>۴ بازیکن، ۲ تیم، یک برنده</b>\n"
        "🧠 غافلگیری‌های حکم، هماهنگیِ تیمی، و لذتِ بردنِ ترفند به ترفند\n"
        "🏆 اولین تیمی که به <b>۷ امتیاز</b> برسه، قهرمانِ این میزه\n\n"
        "⏱ فقط ۳۰ ثانیه برای هر حرکت وقت داری — پس حواست جمع باشه!\n\n"
        "📢 عضو کانال رسمی‌مون شو: @IRarchit\n"
        "━━━━━━━━━━━━━━━\n"
        "👇 برای گرفتنِ صندلی، دکمه‌ی زیر رو بزن"
    )
    sent = await message.answer(text, reply_markup=lobby.render_keyboard())
    lobby.message_id = sent.message_id


@hokm_router.message(Command("hokm_stop"), F.chat.type.in_({"group", "supergroup"}))
async def cmd_hokm_stop(message: Message, bot: Bot) -> None:
    chat_id = message.chat.id
    member = await bot.get_chat_member(chat_id, message.from_user.id)
    if member.status not in ("administrator", "creator"):
        await message.reply("⛔ فقط ادمین‌های گروه می‌توانند بازی را لغو کنند.")
        return
    had_something = False
    if chat_id in gm.lobbies:
        del gm.lobbies[chat_id]
        had_something = True
    if chat_id in gm.matches:
        gm.cleanup_match(chat_id)
        had_something = True
    await message.reply("✅ بازی/لابی لغو شد." if had_something else "⏳ چیزی برای لغو کردن وجود نداشت.")


@hokm_router.callback_query(F.data == CB_JOIN)
async def cb_join(callback: CallbackQuery, bot: Bot) -> None:
    chat_id = callback.message.chat.id
    lobby = gm.lobbies.get(chat_id)
    if not lobby or lobby.phase != "joining":
        await callback.answer("❌ این لابی دیگر فعال نیست.", show_alert=True)
        return

    user = callback.from_user
    if user.id in lobby.joined:
        await callback.answer("✅ شما قبلاً وارد شدید.")
        return
    if len(lobby.joined) >= 4:
        await callback.answer("❌ ظرفیت لابی پر شده است.", show_alert=True)
        return

    lobby.joined.append(user.id)
    lobby.names[user.id] = user.full_name
    gm.display_name[user.id] = user.full_name
    await callback.answer("✅ شما وارد بازی شدید!")

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
        await callback.answer("❌ این مرحله دیگر فعال نیست.", show_alert=True)
        return

    captain_id = lobby.joined[0]
    if callback.from_user.id != captain_id:
        await callback.answer(f"⛔ فقط {lobby.names[captain_id]} می‌تواند تیم را مشخص کند.", show_alert=True)
        return

    partner_id = int(callback.data[len(CB_PAIR_PREFIX):])
    if partner_id not in lobby.joined or partner_id == captain_id:
        await callback.answer("❌ انتخاب نامعتبر.", show_alert=True)
        return

    team_a = (captain_id, partner_id)
    team_b = tuple(uid for uid in lobby.joined if uid not in team_a)
    names = dict(lobby.names)
    del gm.lobbies[chat_id]

    await callback.answer("✅ تیم‌بندی انجام شد!")
    await bot.edit_message_text(
        chat_id=chat_id, message_id=lobby.message_id,
        text=(
            "♠️♥️ <b>تیم‌بندی نهایی شد</b> ♦️♣️\n"
            "━━━━━━━━━━━━━━━\n"
            f"🟢 <b>تیمِ ۱:</b> {names[team_a[0]]} 🤝 {names[team_a[1]]}\n"
            f"🔴 <b>تیمِ ۲:</b> {names[team_b[0]]} 🤝 {names[team_b[1]]}\n\n"
            "🎴 کارت‌ها دارند به پیویِ هر بازیکن ارسال می‌شن... چند لحظه صبر کن!"
        ),
    )

    ok = await _start_match(chat_id, team_a, team_b, bot)
    if not ok:
        await bot.send_message(
            chat_id,
            "⚠️ <b>بازی شروع نشد!</b>\n"
            "یکی از بازیکنان هنوز رباتِ ما رو در پیوی استارت نکرده.\n"
            "🔹 هر ۴ نفر یک بار روی ربات /start بزنید، بعد دوباره /hokm رو اجرا کنید.",
        )


# ====================================================================== #
# شروعِ مسابقه و مدیریتِ دست‌ها
# ====================================================================== #

async def _start_match(chat_id: int, team_a: tuple[int, int], team_b: tuple[int, int], bot: Bot) -> bool:
    all_players = [*team_a, *team_b]

    # پیش از ساختِ بازی، مطمئن شو همه با ربات پیوی داشتن (وگرنه نمی‌تونیم
    # دستِ خصوصیِ کسی رو براش بفرستیم).
    for uid in all_players:
        pinged = await _safe_dm(bot, uid, "🃏 بازیِ حکمِ گروه شما شروع شد! کارت‌هایتان به‌زودی می‌رسد...")
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
        f"♠️♥️ <b>دستِ شماره‌ی {match.hand_number}</b> ♦️♣️\n"
        f"👑 حاکمِ این دست: <b>{hakem_name}</b>\n"
        f"⏳ در انتظارِ انتخابِ خالِ حکم...",
    )

    for seat in range(4):
        uid = match.user_id_of_seat(seat)
        hand_text = _format_hand(hand.hands[seat])
        if seat == hand.hakem_seat:
            await _safe_dm(
                bot, uid,
                f"👑 <b>تو حاکمِ این دستی!</b>\n\n{hand_text}\n\n"
                f"👇 خالِ حکم رو انتخاب کن (تا {TURN_TIMEOUT_SECONDS} ثانیه وقت داری):",
                reply_markup=_build_trump_keyboard(),
            )
        else:
            await _safe_dm(
                bot, uid,
                f"{hand_text}\n\n⏳ منتظرِ انتخابِ حکم توسط <b>{hakem_name}</b> هستیم...",
            )

    _schedule_trump_timeout(chat_id, hand.hakem_seat, bot)


async def _apply_trump(chat_id: int, match: HokmMatch, seat: int, suit: Suit, bot: Bot, auto: bool = False) -> bool:
    hand = match.current_hand
    try:
        hand.choose_trump(seat, suit)
    except HokmError as e:
        logger.warning("خطا در انتخابِ حکم برای کاربر %s: %s", match.user_id_of_seat(seat), e)
        return False

    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
        del gm.timeout_tasks[chat_id]

    if auto:
        hakem_name = gm.display_name.get(match.user_id_of_seat(seat), "؟")
        await bot.send_message(
            chat_id,
            f"⏱ <b>{hakem_name}</b> در {TURN_TIMEOUT_SECONDS} ثانیه پاسخ نداد؛ "
            f"ربات به‌جای او خالِ حکم را انتخاب کرد.",
        )

    await bot.send_message(
        chat_id,
        f"🔔 <b>حکم اعلام شد:</b> {SUIT_SYMBOL[suit]} {SUIT_NAME_FA[suit]}\n"
        f"🎴 کارت‌های باقی‌مانده پخش شد؛ بازی شروع می‌شود!",
    )

    for seat_i in range(4):
        uid = match.user_id_of_seat(seat_i)
        await _safe_dm(bot, uid, f"🃏 <b>دستِ کاملِ شما</b> (۱۳ کارت):\n\n{_format_hand(hand.hands[seat_i])}")

    await _prompt_turn(chat_id, bot)
    return True


def _schedule_trump_timeout(chat_id: int, hakem_seat: int, bot: Bot) -> None:
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()

    async def _timeout_trump():
        await asyncio.sleep(TURN_TIMEOUT_SECONDS)
        match = gm.matches.get(chat_id)
        if not match:
            return
        hand = match.current_hand
        my_hand = hand.hands[hakem_seat]
        if not my_hand:
            return
        logger.info("تایم‌اوتِ انتخابِ حکم در گروه %s - انتخابِ خودکار", chat_id)
        # خالی که بیشترین کارت را در دستِ حاکم دارد، به‌عنوانِ حکمِ خودکار انتخاب می‌شود.
        counts = {s: 0 for s in Suit}
        for c in my_hand:
            counts[c.suit] += 1
        auto_suit = max(counts, key=lambda s: counts[s])
        await _apply_trump(chat_id, match, hakem_seat, auto_suit, bot, auto=True)

    task = asyncio.create_task(_timeout_trump())
    gm.timeout_tasks[chat_id] = task


@hokm_router.callback_query(F.data.startswith(CB_TRUMP_PREFIX), F.message.chat.type == "private")
async def cb_choose_trump(callback: CallbackQuery, bot: Bot) -> None:
    user_id = callback.from_user.id
    chat_id, match = gm.match_of_user(user_id)
    if not match:
        await callback.answer("❌ بازیِ فعالی برای شما پیدا نشد.", show_alert=True)
        return

    seat = match.seat_of_user(user_id)
    suit_value = int(callback.data[len(CB_TRUMP_PREFIX):])
    suit = Suit(suit_value)

    ok = await _apply_trump(chat_id, match, seat, suit, bot, auto=False)
    if not ok:
        await callback.answer("❌ الان نمی‌توانی خالِ حکم را انتخاب کنی.", show_alert=True)
        return

    await callback.answer(f"✅ خالِ حکم: {SUIT_NAME_FA[suit]}")
    await callback.message.edit_reply_markup(reply_markup=None)


async def _perform_play(bot: Bot, chat_id: int, match: HokmMatch, seat: int, card: Card, auto: bool = False) -> None:
    """اجرای منطقیِ بازی کردن کارت (فراخوانی شده توسط کاربر یا تایم‌اوت)"""
    hand = match.current_hand

    if auto:
        name = gm.display_name.get(match.user_id_of_seat(seat), "؟")
        await bot.send_message(
            chat_id,
            f"⏱ <b>{name}</b> در {TURN_TIMEOUT_SECONDS} ثانیه پاسخ نداد؛ "
            f"ربات برایِ حفظِ روندِ بازی به‌جای او حرکت کرد.",
        )

    try:
        trick_result = hand.play_card(seat, card)
        # ارسال استیکر کارت در گروه
        try:
            await bot.send_sticker(chat_id, sticker_for_card(card))
        except Exception:
            await bot.send_message(chat_id, f"🃏 کارتِ {_card_label(card)} بازی شد.")
    except (HokmError, ValueError) as e:
        logger.warning("خطا در انجام حرکت برای کاربر %s: %s", match.user_id_of_seat(seat), e)
        return

    # پاکسازی تایم‌اوت پس از حرکت موفق
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
        del gm.timeout_tasks[chat_id]

    if trick_result is None:
        await _prompt_turn(chat_id, bot)
    else:
        await _announce_trick(chat_id, trick_result, match, bot)
        if hand.phase == Phase.HAND_OVER:
            await _finish_hand(chat_id, bot)
        else:
            await _prompt_turn(chat_id, bot)


async def _prompt_turn(chat_id: int, bot: Bot) -> None:
    match = gm.matches[chat_id]
    if not match:
        return
    hand = match.current_hand
    seat = hand.turn_seat
    uid = match.user_id_of_seat(seat)
    name = gm.display_name.get(uid, "؟")
    legal = hand.legal_moves(seat)

    await bot.send_message(chat_id, f"🕓 نوبتِ <b>{name}</b> است...")
    await _safe_dm(
        bot, uid,
        f"👇 نوبتِ توئه! یک کارت انتخاب کن (تا {TURN_TIMEOUT_SECONDS} ثانیه وقت داری):",
        reply_markup=_build_card_keyboard(legal),
    )

    # راه‌اندازی تایم‌اوت — اگر پاسخ ندهد، خودِ ربات به‌جای او بازی می‌کند
    # و این چرخه تا بازگشتِ خودِ کاربر در نوبت‌های بعدی نیز ادامه پیدا می‌کند.
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()

    async def _timeout_play():
        await asyncio.sleep(TURN_TIMEOUT_SECONDS)
        match = gm.matches.get(chat_id)
        if not match:
            return
        hand = match.current_hand
        # اگر همچنان نوبت همان کاربر است و حرکتی نکرده
        if hand.turn_seat != seat:
            return

        legal = hand.legal_moves(seat)
        if not legal:
            return
        card = random.choice(legal)
        logger.info(
            "تایم‌اوتِ %s ثانیه‌ای برای کاربر %s در گروه %s - حرکتِ خودکار",
            TURN_TIMEOUT_SECONDS, uid, chat_id,
        )
        await _perform_play(bot, chat_id, match, seat, card, auto=True)

    task = asyncio.create_task(_timeout_play())
    gm.timeout_tasks[chat_id] = task


@hokm_router.callback_query(F.data.startswith(CB_PLAY_PREFIX), F.message.chat.type == "private")
async def cb_play_card(callback: CallbackQuery, bot: Bot) -> None:
    user_id = callback.from_user.id
    chat_id, match = gm.match_of_user(user_id)
    if not match:
        await callback.answer("❌ بازیِ فعالی برای شما پیدا نشد.", show_alert=True)
        return

    hand = match.current_hand
    seat = match.seat_of_user(user_id)
    try:
        card = _card_from_key(callback.data[len(CB_PLAY_PREFIX):])
    except ValueError:
        await callback.answer("❌ کارت نامعتبر.", show_alert=True)
        return

    # قبل از انجام حرکت، تایم‌اوت را لغو می‌کنیم
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
        del gm.timeout_tasks[chat_id]

    await callback.answer(f"✅ {_card_label(card)} بازی شد!")
    await callback.message.edit_reply_markup(reply_markup=None)

    await _perform_play(bot, chat_id, match, seat, card)


async def _announce_trick(chat_id: int, trick: TrickResult, match: HokmMatch, bot: Bot) -> None:
    winner_name = gm.display_name.get(match.user_id_of_seat(trick.winner_seat), "؟")
    hand = match.current_hand
    await bot.send_message(
        chat_id,
        f"🏁 <b>ترفندِ شماره‌ی {len(hand.trick_history)}</b> برای <b>{winner_name}</b> شد!\n"
        f"🟢 تیم ۱: {hand.tricks_won[0]} ترفند   |   🔴 تیم ۲: {hand.tricks_won[1]} ترفند",
    )


async def _finish_hand(chat_id: int, bot: Bot) -> None:
    match = gm.matches[chat_id]
    res = match.on_hand_finished()

    kap_text = "\n🎉 <b>کاپوت!</b> حریف حتی یک ترفند هم نبرد — تیمِ برنده ۲ امتیاز می‌گیرد!" if res.kap else ""
    await bot.send_message(
        chat_id,
        f"🏆 <b>دستِ شماره‌ی {match.hand_number} تمام شد!</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"🎯 برنده‌یِ این دست: <b>تیمِ {res.winning_team + 1}</b> "
        f"({res.team_tricks[0]} - {res.team_tricks[1]} ترفند){kap_text}\n\n"
        f"📈 <b>جدولِ امتیازاتِ مسابقه:</b>\n"
        f"🟢 تیمِ ۱: <b>{match.scores[0]}</b>   |   🔴 تیمِ ۲: <b>{match.scores[1]}</b>\n"
        f"🏁 هدفِ نهایی: {match.target_points} امتیاز",
    )

    if match.finished:
        await bot.send_message(
            chat_id,
            f"🎊🏆 <b>مسابقه تمام شد!</b> 🏆🎊\n"
            f"🥇 قهرمانِ این میز: <b>تیمِ {match.winning_team + 1}</b>\n\n"
            f"برای شروعِ دورِ بعد کافیه دوباره /hokm رو بزنید.\n"
            f"📢 کانالِ رسمی‌مون: @IRarchit",
        )
        gm.cleanup_match(chat_id)
        return

    # پاکسازی تایم‌اوت قبل از شروع دست جدید
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
        del gm.timeout_tasks[chat_id]

    await _announce_new_hand(chat_id, bot)