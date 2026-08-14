# router.py
import asyncio
import random
import logging
from aiogram import Bot, F, Router
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove, ForceReply
)
from aiogram.exceptions import TelegramBadRequest
from .cards import Card, Suit, SUIT_NAME_FA, SUIT_SYMBOL, RANK_NAME_FA
from .engine import HokmError, HokmMatch, Phase, TrickResult
from .sticker_repo import sticker_for_card

logger = logging.getLogger("hokm.router")
hokm_router = Router(name="hokm")

CB_JOIN_A = "hokm:join_a"
CB_JOIN_B = "hokm:join_b"
CB_START = "hokm:start"
CB_CANCEL = "hokm:cancel"
CB_TRUMP_PREFIX = "hokm:trump:"
CB_PLAY_PREFIX = "hokm:play:"

# ------------------------------------------------------------
# 1. مدیریت لابی و تیم‌بندی با دکمه‌های شیشه‌ای (Reply Keyboard)
# ------------------------------------------------------------
class Lobby:
    def __init__(self, chat_id, message_id):
        self.chat_id = chat_id
        self.message_id = message_id
        self.team_a = []
        self.team_b = []
        self.names = {}

    def get_team_keyboard(self) -> ReplyKeyboardMarkup:
        # ساخت دکمه‌های شیشه‌ای رنگی (رنگ‌ها در تلگرام توسط کلاینت تنظیم میشه)
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

# ------------------------------------------------------------
# 2. هندلرهای لابی
# ------------------------------------------------------------
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

# ------------------------------------------------------------
# 3. هسته بازی (مدیریت تایم‌اوت، Reply در گروه و پاکسازی پی‌وی)
# ------------------------------------------------------------
gm = GameManager()  # فرض بر این است که کلاس GameManager در بالای فایل تعریف شده

async def _send_group_reply(chat_id: int, reply_to_id: int, text: str):
    """ارسال پیام با قابلیت Quote (Reply) به پیام قبلی برای زیبایی بصری"""
    try:
        await bot.send_message(chat_id, text, reply_to_message_id=reply_to_id)
    except:
        await bot.send_message(chat_id, text)

async def _dm_update(uid: int, text: str, keyboard: InlineKeyboardMarkup = None, delete_prev: bool = True):
    """ارسال یا ویرایش پیام در پی‌وی با پاکسازی خودکار"""
    try:
        # اگر پیام قبلی وجود داشت حذفش کن تا پی‌وی شلوغ نشه
        if uid in gm.last_dm_message_id:
            try:
                await bot.delete_message(uid, gm.last_dm_message_id[uid])
            except:
                pass
        sent = await bot.send_message(uid, text, reply_markup=keyboard)
        gm.last_dm_message_id[uid] = sent.message_id
    except Exception as e:
        logger.warning(f"خطا در ارسال پی‌وی به {uid}: {e}")

async def _prompt_turn(chat_id: int, bot: Bot, reply_to_id: int = None):
    """نمایش نوبت در گروه و ارسال دکمه‌های کارت به پی‌وی کاربر"""
    match = gm.matches.get(chat_id)
    hand = match.current_hand
    seat = hand.turn_seat
    uid = match.user_id_of_seat(seat)
    name = gm.display_name.get(uid, "کاربر")
    legal = hand.legal_moves(seat)

    # ارسال به گروه با استفاده از Reply (اگر reply_to_id وجود داشت)
    if reply_to_id:
        await _send_group_reply(chat_id, reply_to_id, f"🕐 نوبتِ <b>{name}</b> (مهلت ۳۰ ثانیه)")
    else:
        sent = await bot.send_message(chat_id, f"🕐 نوبتِ <b>{name}</b> (مهلت ۳۰ ثانیه)")
        reply_to_id = sent.message_id

    # ارسال کارت‌ها به پی‌وی با دکمه‌های اینلاین
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"{RANK_NAME_FA[c.rank]}{SUIT_SYMBOL[c.suit]}", callback_data=f"{CB_PLAY_PREFIX}{c.key()}")]
            for c in sorted(legal, key=lambda x: (x.suit.value, -x.rank))
        ]
    )
    await _dm_update(uid, f"🃏 نوبت شماست! کارت انتخاب کنید:", keyboard=keyboard)

    # تنظیم تایم‌اوت
    if chat_id in gm.timeout_tasks:
        gm.timeout_tasks[chat_id].cancel()
    gm.timeout_tasks[chat_id] = asyncio.create_task(_auto_play_timeout(chat_id, seat, reply_to_id, bot))

async def _auto_play_timeout(chat_id: int, seat: int, reply_to_id: int, bot: Bot):
    await asyncio.sleep(30)
    match = gm.matches.get(chat_id)
    if not match: return
    hand = match.current_hand
    if hand.phase != Phase.PLAYING or hand.turn_seat != seat: return

    uid = match.user_id_of_seat(seat)
    legal = hand.legal_moves(seat)
    if not legal: return

    # ربات به‌جای کاربر کارت می‌زنه
    card = random.choice(legal)
    try:
        trick_result = hand.play_card(seat, card)
        await bot.send_message(chat_id, f"⏰ زمان <b>{gm.display_name[uid]}</b> تمام شد! ربات کارت زد.", reply_to_message_id=reply_to_id)
        await bot.send_sticker(chat_id, sticker_for_card(card))
    except:
        return

    # ادامه روند بازی (پاک کردن پی‌ویِ کاربر)
    await _dm_update(uid, "⏰ زمان شما تمام شد، ربات به‌جای شما حرکت کرد.", delete_prev=True)

    if trick_result is None:
        await _prompt_turn(chat_id, bot, reply_to_id=reply_to_id)
    else:
        await _announce_trick(chat_id, trick_result, match, bot, reply_to_id)

# ------------------------------------------------------------
# 4. هندلرهای انتخاب حکم و کارت
# ------------------------------------------------------------
@hokm_router.callback_query(F.data.startswith(CB_TRUMP_PREFIX))
async def cb_choose_trump(callback: CallbackQuery, bot: Bot):
    uid = callback.from_user.id
    chat_id, match = gm.match_of_user(uid)
    if not match: return await callback.answer("بازی فعالی نیست.")

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

    # اعلام به گروه و شروع بازی
    await bot.send_message(chat_id, f"🔔 حکم اعلام شد: <b>{SUIT_SYMBOL[suit]} {SUIT_NAME_FA[suit]}</b>")
    # ارسال کارت‌های کامل به همه
    for i in range(4):
        u = match.user_id_of_seat(i)
        hand_str = "\n".join([f"{SUIT_SYMBOL[s]} {' '.join([RANK_NAME_FA[c.rank] for c in sorted(cards, key=lambda x: -x.rank)])}" 
                              for s, cards in Suit.items() if cards])
        await _dm_update(u, f"دست کامل شما:\n{hand_str}", delete_prev=True)

    await _prompt_turn(chat_id, bot)

@hokm_router.callback_query(F.data.startswith(CB_PLAY_PREFIX))
async def cb_play_card(callback: CallbackQuery, bot: Bot):
    uid = callback.from_user.id
    chat_id, match = gm.match_of_user(uid)
    if not match: return await callback.answer("بازی فعالی نیست.")

    card_key = callback.data.split(":")[2]
    rank_map = {"J":11, "Q":12, "K":13, "A":14}
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

    # **ارسال استیکر و نتیجه به گروه با Reply**
    # استیکر کارت زده شده
    await bot.send_sticker(chat_id, sticker_for_card(card))
    
    # ادامه مسیر
    if trick_result is None:
        await _prompt_turn(chat_id, bot, reply_to_id=gm.last_group_msg_id) # reply_to_id رو پاس میدیم
    else:
        await _announce_trick(chat_id, trick_result, match, bot, gm.last_group_msg_id)

async def _announce_trick(chat_id, trick_result, match, bot, reply_to_id):
    winner_uid = match.user_id_of_seat(trick_result.winner_seat)
    winner_name = gm.display_name.get(winner_uid, "؟")
    
    # ارسال به گروه با ریپلای به پیام قبلی
    await _send_group_reply(
        chat_id, 
        reply_to_id, 
        f"🏁 برنده ترفند: <b>{winner_name}</b>\n📊 تیم آبی: {match.current_hand.tricks_won[0]} | تیم قرمز: {match.current_hand.tricks_won[1]}"
    )

    if match.current_hand.phase == Phase.HAND_OVER:
        await _finish_hand(chat_id, bot)
    else:
        await _prompt_turn(chat_id, bot, reply_to_id=reply_to_id)

async def _finish_hand(chat_id, bot):
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