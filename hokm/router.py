# -*- coding: utf-8 -*-
"""
hokm/router.py
اتصال موتور حکم به تلگرام با رابط کاربری حرفه‌ای و دکمه‌های شیشه‌ای
"""

from __future__ import annotations

import asyncio
import random
import logging
from dataclasses import dataclass, field

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
)
from aiogram.exceptions import TelegramBadRequest

from ..cards import Card, Suit, SUIT_NAME_FA, SUIT_SYMBOL, RANK_NAME_FA
from ..engine import HokmError, HokmMatch, Phase, TrickResult
from ..sticker_repo import sticker_for_card

logger = logging.getLogger("hokm.router")
hokm_router = Router(name="hokm")

# =========== Callback Data Constants ===========
CB_JOIN_A = "hokm:join_a"
CB_JOIN_B = "hokm:join_b"
CB_START = "hokm:start"
CB_CANCEL = "hokm:cancel"
CB_TRUMP_PREFIX = "hokm:trump:"
CB_PLAY_PREFIX = "hokm:play:"

# =========== Game Manager (In-Memory) ===========
@dataclass
class GameManager:
    """مدیریت تمام لابی‌ها و مسابقات فعال"""
    lobbies: dict[int, Lobby] = field(default_factory=dict)
    matches: dict[int, HokmMatch] = field(default_factory=dict)
    user_to_chat: dict[int, int] = field(default_factory=dict)
    display_name: dict[int, str] = field(default_factory=dict)
    timeout_tasks: dict[int, asyncio.Task] = field(default_factory=dict)
    last_dm_message_id: dict[int, int] = field(default_factory=dict)   # برای پاک‌سازی پی‌وی
    last_group_msg_id: dict[int, int] = field(default_factory=dict)    # آخرین پیام گروه برای Reply

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
            self.last_dm_message_id.pop(uid, None)
        self.last_group_msg_id.pop(chat_id, None)
        self.timeout_tasks.pop(chat_id, None)

gm = GameManager()

# =========== Lobby Class ===========
class Lobby:
    def __init__(self, chat_id: int, message_id: int):
        self.chat_id = chat_id
        self.message_id = message_id
        self.team_a: list[int] = []
        self.team_b: list[int] = []
        self.names: dict[int, str] = {}

    def get_team_keyboard(self) -> ReplyKeyboardMarkup:
        """دکمه‌های شیشه‌ای برای لابی"""
        buttons = []
        if len(self.team_a) < 2:
            buttons.append([KeyboardButton(text="🟦 عضویت در تیم A")])
        if len(self.team_b) < 2:
            buttons.append([KeyboardButton(text="🟥 عضویت در تیم B")])
        if len(self.team_a) == 2 and len(self.team_b) == 2:
            buttons.append([KeyboardButton(text="🚀 شروع مسابقه")])
        buttons.append([KeyboardButton(text="❌ لغو بازی")])
        return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=False)

    def render_text(self) -> str:
        lines = ["🎮 <b>درخواست شروع بازی با حکم!</b>", ""]
        lines.append("برای شروع، تیم خود را انتخاب کنید و روی دکمه‌های زیر کلیک کنید:\n")
        lines.append("🟦 <b>اعضای تیم A:</b>")
        for uid in self.team_a:
            lines.append(f"    • {self.names.get(uid, '')}")
        if len(self.team_a) < 2:
            lines.append("    • (بدون عضو)")

        lines.append("\n🟥 <b>اعضای تیم B:</b>")
        for uid in self.team_b:
            lines.append(f"    • {self.names.get(uid, '')}")
        if len(self.team_b) < 2:
            lines.append("    • (بدون عضو)")
        return "\n".join(lines)

# =========== Command Handlers ===========
@hokm_router.message(Command("hokm"), F.chat.type.in_({"group", "supergroup"}))
async def cmd_hokm(message: Message, bot: Bot):
    chat_id = message.chat.id
    if chat_id in gm.matches or chat_id in gm.lobbies:
        await message.reply("⚠️ یه بازی یا لابی همین الان در این گروه فعاله! صبر کن تموم بشه.")
        return

    sent = await message.reply("در حال راه‌اندازی میز...")
    lobby = Lobby(chat_id, sent.message_id)
    gm.lobbies[chat_id] = lobby

    # ارسال پیام اصلی با دکمه‌های شیشه‌ای (کیبورد)
    await bot.send_message(
        chat_id,
        lobby.render_text(),
        reply_markup=lobby.get_team_keyboard()
    )

@hokm_router.message(Command("hokm_stop"), F.chat.type.in_({"group", "supergroup"}))
async def cmd_hokm_stop(message: Message, bot: Bot):
    chat_id = message.chat.id
    if chat_id in gm.lobbies:
        del gm.lobbies[chat_id]
        await bot.send_message(chat_id, "❌ لابی لغو شد.", reply_markup=ReplyKeyboardRemove())
    if chat_id in gm.matches:
        gm.cleanup_match(chat_id)
        await bot.send_message(chat_id, "❌ مسابقه متوقف شد.", reply_markup=ReplyKeyboardRemove())
    if chat_id not in gm.lobbies and chat_id not in gm.matches:
        await message.reply("هیچ بازی یا لابی فعالی وجود ندارد.")

# =========== Lobby Button Handlers (ReplyKeyboard) ===========
@hokm_router.message(F.text.in_(["🟦 عضویت در تیم A", "🟥 عضویت در تیم B", "🚀 شروع مسابقه", "❌ لغو بازی"]), F.chat.type.in_({"group", "supergroup"}))
async def handle_lobby_buttons(message: Message, bot: Bot):
    chat_id = message.chat.id
    lobby = gm.lobbies.get(chat_id)
    if not lobby:
        await message.reply("❌ لابی منقضی شده. دوباره /hokm بزنید.")
        return

    text = message.text
    user = message.from_user

    if text == "🟦 عضویت در تیم A":
        if user.id in lobby.team_b:
            await message.reply("⚠️ شما قبلاً در تیم B هستید.")
            return
        if user.id not in lobby.team_a and len(lobby.team_a) < 2:
            lobby.team_a.append(user.id)
            lobby.names[user.id] = user.full_name
            await message.reply(f"✅ {user.full_name} به تیم A پیوست!")
            await bot.edit_message_text(chat_id=chat_id, message_id=lobby.message_id, text=lobby.render_text())
            await bot.send_message(chat_id, "تیم‌ها به‌روز شدند.", reply_markup=lobby.get_team_keyboard())
            return
        await message.reply("⚠️ تیم A پر شده!")

    elif text == "🟥 عضویت در تیم B":
        if user.id in lobby.team_a:
            await message.reply("⚠️ شما قبلاً در تیم A هستید.")
            return
        if user.id not in lobby.team_b and len(lobby.team_b) < 2:
            lobby.team_b.append(user.id)
            lobby.names[user.id] = user.full_name
            await message.reply(f"✅ {user.full_name} به تیم B پیوست!")
            await bot.edit_message_text(chat_id=chat_id, message_id=lobby.message_id, text=lobby.render_text())
            await bot.send_message(chat_id, "تیم‌ها به‌روز شدند.", reply_markup=lobby.get_team_keyboard())
            return
        await message.reply("⚠️ تیم B پر شده!")

    elif text == "🚀 شروع مسابقه":
        if len(lobby.team_a) != 2 or len(lobby.team_b) != 2:
            await message.reply("⚠️ هر دو تیم باید ۲ عضو داشته باشن!")
            return
        # حذف کیبورد شیشه‌ای
        await bot.send_message(chat_id, "⏳ در حال شروع مسابقه...", reply_markup=ReplyKeyboardRemove())
        del gm.lobbies[chat_id]

        # شروع بازی
        match = HokmMatch(team_a=tuple(lobby.team_a), team_b=tuple(lobby.team_b))
        gm.matches[chat_id] = match
        for uid in lobby.team_a + lobby.team_b:
            gm.user_to_chat[uid] = chat_id
            gm.display_name[uid] = lobby.names[uid]

        # بررسی دسترسی به پی‌وی
        for uid in gm.user_to_chat:
            try:
                await bot.send_message(uid, "🃏 بازی حکم شروع شد! کارت‌هایتان را در پی‌وی بررسی کنید.")
            except:
                await bot.send_message(chat_id, f"⚠️ کاربر {gm.display_name[uid]} ربات را بلاک کرده یا استارت نزده!")
                gm.cleanup_match(chat_id)
                return

        await _announce_new_hand(chat_id, bot)

    elif text == "❌ لغو بازی":
        del gm.lobbies[chat_id]
        await bot.send_message(chat_id, "❌ لابی لغو شد.", reply_markup=ReplyKeyboardRemove())

# =========== Core Game Functions ===========
async def _send_group_reply(chat_id: int, reply_to_id: int, text: str, bot: Bot):
    """ارسال پیام با قابلیت Quote (Reply) به پیام قبلی برای زیبایی بصری"""
    try:
        await bot.send_message(chat_id, text, reply_to_message_id=reply_to_id)
    except:
        # اگر ریپلای ممکن نبود، به‌صورت عادی بفرست
        sent = await bot.send_message(chat_id, text)
        gm.last_group_msg_id[chat_id] = sent.message_id

async def _dm_update(uid: int, text: str, keyboard: InlineKeyboardMarkup = None, delete_prev: bool = True, bot: Bot = None):
    """ارسال یا ویرایش پیام در پی‌وی با پاکسازی خودکار"""
    try:
        if delete_prev and uid in gm.last_dm_message_id:
            try:
                await bot.delete_message(uid, gm.last_dm_message_id[uid])
            except:
                pass
        sent = await bot.send_message(uid, text, reply_markup=keyboard)
        gm.last_dm_message_id[uid] = sent.message_id
    except Exception as e:
        logger.warning(f"خطا در ارسال پی‌وی به {uid}: {e}")

async def _announce_new_hand(chat_id: int, bot: Bot):
    match = gm.matches[chat_id]
    hand = match.current_hand
    hakem_uid = match.user_id_of_seat(hand.hakem_seat)
    hakem_name = gm.display_name.get(hakem_uid, "؟")

    await bot.send_message(
        chat_id,
        f"🃏 <b>دست شماره‌ی {match.hand_number}</b>\n"
        f"👑 حاکم: <b>{hakem_name}</b> — در انتظار انتخاب خال حکم در پی‌وی..."
    )

    # ارسال کارت‌های اولیه به هر بازیکن
    for seat in range(4):
        uid = match.user_id_of_seat(seat)
        hand_cards = hand.hands[seat]
        # نمایش مرتب بر اساس خال و رتبه
        by_suit = {s: [] for s in Suit}
        for c in hand_cards:
            by_suit[c.suit].append(c)
        hand_text_lines = []
        for suit in Suit:
            cards = sorted(by_suit[suit], key=lambda c: -c.rank)
            if cards:
                line = f"{SUIT_SYMBOL[suit]} " + " ".join(RANK_NAME_FA[c.rank] for c in cards)
                hand_text_lines.append(line)
        hand_text = "\n".join(hand_text_lines) if hand_text_lines else "—"

        if seat == hand.hakem_seat:
            # حاکم باید حکم را انتخاب کند
            trump_kb = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text=f"{SUIT_SYMBOL[s]} {SUIT_NAME_FA[s]}", callback_data=f"{CB_TRUMP_PREFIX}{s.value}")]
                    for s in Suit
                ]
            )
            await _dm_update(
                uid,
                f"👑 حاکمِ این دست تویی!\n\n🃏 دست اولیه‌ات:\n{hand_text}\n\nخال حکم را انتخاب کن:",
                keyboard=trump_kb,
                delete_prev=True,
                bot=bot
            )
        else:
            await _dm_update(
                uid,
                f"🃏 دست اولیه‌ات:\n{hand_text}\n\nمنتظر انتخاب حکم توسط {hakem_name} هستیم...",
                delete_prev=True,
                bot=bot
            )

async def _prompt_turn(chat_id: int, bot: Bot, reply_to_id: int = None):
    """نمایش نوبت در گروه و ارسال دکمه‌های کارت به پی‌وی کاربر"""
    match = gm.matches.get(chat_id)
    if not match:
        return
    hand = match.current_hand
    seat = hand.turn_seat
    uid = match.user_id_of_seat(seat)
    name = gm.display_name.get(uid, "کاربر")
    legal = hand.legal_moves(seat)

    # ارسال به گروه با استفاده از Reply
    if reply_to_id:
        await _send_group_reply(chat_id, reply_to_id, f"🕐 نوبتِ <b>{name}</b> (مهلت ۳۰ ثانیه)", bot)
    else:
        sent = await bot.send_message(chat_id, f"🕐 نوبتِ <b>{name}</b> (مهلت ۳۰ ثانیه)")
        reply_to_id = sent.message_id
    gm.last_group_msg_id[chat_id] = reply_to_id

    # ارسال کارت‌ها به پی‌وی با دکمه‌های اینلاین (دسته‌بندی شده)
    cards_sorted = sorted(legal, key=lambda c: (c.suit.value, -c.rank))
    buttons = [
        InlineKeyboardButton(
            text=f"{RANK_NAME_FA[c.rank]}{SUIT_SYMBOL[c.suit]}",
            callback_data=f"{CB_PLAY_PREFIX}{c.key()}"
        )
        for c in cards_sorted
    ]
    # ساخت ردیف‌های ۴ تایی
    rows = [buttons[i:i+4] for i in range(0, len(buttons), 4)]
    keyboard = InlineKeyboardMarkup(inline_keyboard=rows)

    await _dm_update(uid, f"🃏 نوبت شماست! کارت انتخاب کنید:", keyboard=keyboard, delete_prev=True, bot=bot)

    # تنظیم تایم‌اوت (لغو قبلی)
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
    gm.timeout_tasks[chat_id] = asyncio.create_task(_auto_play_timeout(chat_id, seat, reply_to_id, bot))

async def _auto_play_timeout(chat_id: int, seat: int, reply_to_id: int, bot: Bot):
    await asyncio.sleep(30)
    match = gm.matches.get(chat_id)
    if not match:
        return
    hand = match.current_hand
    if hand.phase != Phase.PLAYING or hand.turn_seat != seat:
        return

    uid = match.user_id_of_seat(seat)
    legal = hand.legal_moves(seat)
    if not legal:
        return

    # ربات به‌جای کاربر کارت می‌زنه
    card = random.choice(legal)
    try:
        trick_result = hand.play_card(seat, card)
        await _send_group_reply(chat_id, reply_to_id, f"⏰ زمان <b>{gm.display_name[uid]}</b> تمام شد! ربات کارت زد.", bot)
        await bot.send_sticker(chat_id, sticker_for_card(card))
    except:
        return

    # پاک کردن پیام دکمه‌های پی‌وی
    await _dm_update(uid, "⏰ زمان شما تمام شد، ربات به‌جای شما حرکت کرد.", delete_prev=True, bot=bot)

    # ادامه روند بازی
    if trick_result is None:
        await _prompt_turn(chat_id, bot, reply_to_id=reply_to_id)
    else:
        await _announce_trick(chat_id, trick_result, match, bot, reply_to_id)

async def _announce_trick(chat_id: int, trick: TrickResult, match: HokmMatch, bot: Bot, reply_to_id: int):
    winner_uid = match.user_id_of_seat(trick.winner_seat)
    winner_name = gm.display_name.get(winner_uid, "؟")
    hand = match.current_hand

    await _send_group_reply(
        chat_id,
        reply_to_id,
        f"🏁 برنده ترفند: <b>{winner_name}</b>\n📊 تیم آبی: {hand.tricks_won[0]} | تیم قرمز: {hand.tricks_won[1]}",
        bot
    )

    if hand.phase == Phase.HAND_OVER:
        await _finish_hand(chat_id, bot)
    else:
        await _prompt_turn(chat_id, bot, reply_to_id=reply_to_id)

async def _finish_hand(chat_id: int, bot: Bot):
    match = gm.matches[chat_id]
    res = match.on_hand_finished()
    kap = " 🎉 کاپوت!" if res.kap else ""
    await bot.send_message(
        chat_id,
        f"🏆 دست توسط تیم {res.winning_team+1} برده شد ({res.team_tricks[0]}–{res.team_tricks[1]}){kap}\n"
        f"امتیازات کلی: تیم آبی {match.scores[0]} | تیم قرمز {match.scores[1]}"
    )
    if match.finished:
        await bot.send_message(chat_id, f"🎊 <b>مسابقه تمام شد!</b> برنده: تیم {match.winning_team+1} 🎊")
        gm.cleanup_match(chat_id)
        return
    await _announce_new_hand(chat_id, bot)

# =========== Callback Handlers (Trump & Play) ===========
@hokm_router.callback_query(F.data.startswith(CB_TRUMP_PREFIX))
async def cb_choose_trump(callback: CallbackQuery, bot: Bot):
    uid = callback.from_user.id
    chat_id, match = gm.match_of_user(uid)
    if not match:
        return await callback.answer("بازی فعالی نیست.")

    suit_val = int(callback.data.split(":")[2])
    suit = Suit(suit_val)
    seat = match.seat_of_user(uid)

    try:
        match.current_hand.choose_trump(seat, suit)
    except HokmError as e:
        return await callback.answer(str(e), show_alert=True)

    # حذف دکمه‌های پی‌وی
    await callback.message.delete()
    await callback.answer(f"حکم: {SUIT_NAME_FA[suit]} ✅")

    # اعلام به گروه
    await bot.send_message(chat_id, f"🔔 حکم اعلام شد: <b>{SUIT_SYMBOL[suit]} {SUIT_NAME_FA[suit]}</b>")

    # ارسال کارت‌های کامل به همه
    for i in range(4):
        u = match.user_id_of_seat(i)
        hand_cards = match.current_hand.hands[i]
        by_suit = {s: [] for s in Suit}
        for c in hand_cards:
            by_suit[c.suit].append(c)
        lines = []
        for suit in Suit:
            cards = sorted(by_suit[suit], key=lambda c: -c.rank)
            if cards:
                lines.append(f"{SUIT_SYMBOL[suit]} " + " ".join(RANK_NAME_FA[c.rank] for c in cards))
        hand_text = "\n".join(lines) if lines else "—"
        await _dm_update(u, f"🃏 دست کامل شما:\n{hand_text}", delete_prev=True, bot=bot)

    await _prompt_turn(chat_id, bot)

@hokm_router.callback_query(F.data.startswith(CB_PLAY_PREFIX))
async def cb_play_card(callback: CallbackQuery, bot: Bot):
    uid = callback.from_user.id
    chat_id, match = gm.match_of_user(uid)
    if not match:
        return await callback.answer("بازی فعالی نیست.")

    card_key = callback.data.split(":")[2]
    rank_map = {"J": 11, "Q": 12, "K": 13, "A": 14}
    rank_part, suit_part = card_key.split("_")
    rank = rank_map.get(rank_part, int(rank_part))
    card = Card(rank=rank, suit=Suit[suit_part])

    hand = match.current_hand
    seat = match.seat_of_user(uid)
    try:
        trick_result = hand.play_card(seat, card)
    except HokmError as e:
        return await callback.answer(str(e), show_alert=True)

    # حذف پیام دکمه‌های پی‌وی
    await callback.message.delete()
    await callback.answer(f"{RANK_NAME_FA[card.rank]}{SUIT_SYMBOL[card.suit]} بازی شد ✅")

    # ارسال استیکر به گروه
    await bot.send_sticker(chat_id, sticker_for_card(card))
    # همچنین نمایش نام کارت در گروه به صورت Reply
    reply_to_id = gm.last_group_msg_id.get(chat_id)
    if reply_to_id:
        await _send_group_reply(
            chat_id,
            reply_to_id,
            f"✅ {gm.display_name[uid]} کارت {RANK_NAME_FA[card.rank]}{SUIT_SYMBOL[card.suit]} را بازی کرد",
            bot
        )
    else:
        await bot.send_message(chat_id, f"✅ {gm.display_name[uid]} کارت {RANK_NAME_FA[card.rank]}{SUIT_SYMBOL[card.suit]} را بازی کرد")

    # ادامه مسیر
    if trick_result is None:
        await _prompt_turn(chat_id, bot, reply_to_id=reply_to_id)
    else:
        await _announce_trick(chat_id, trick_result, match, bot, reply_to_id)