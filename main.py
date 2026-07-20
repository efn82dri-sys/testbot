# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «تایید عضویت» — مرجع فایل‌های معماری و عمران
====================================================================
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime
from html import escape as html_escape
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qsl

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ParseMode
from aiogram.filters import Command, CommandObject, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    ChatJoinRequest,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    MenuButtonWebApp,
    Message,
    PollAnswer,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    WebAppInfo,
)
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

# --------------------------------------------------------------
# ۱) تنظیمات
# --------------------------------------------------------------
BOT_TOKEN = os.environ["BOT_TOKEN"]
GROUP_CHAT_ID = int(os.environ["GROUP_CHAT_ID"])
GROUP_INVITE_LINK = os.environ.get("GROUP_INVITE_LINK", "")

NOTIFY_CHAT_ID = os.environ.get("NOTIFY_CHAT_ID", "").strip()

ADMIN_IDS = {
    int(x) for x in os.environ.get("ADMIN_IDS", "").replace(" ", "").split(",") if x
}

WEBHOOK_HOST = os.environ["WEBHOOK_HOST"].rstrip("/")
WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"
WEBAPP_URL = f"{WEBHOOK_HOST}/webapp/index.html"

PORT = int(os.environ.get("PORT", 8080))
PING_INTERVAL_SECONDS = int(os.environ.get("PING_INTERVAL_SECONDS", 10 * 60))

DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)

STATS_FILE = Path(__file__).parent / "data" / "stats.json"
PHONES_FILE = Path(__file__).parent / "data" / "phones.json"

REFERRAL_LABELS = {
    "instagram": "اینستاگرام",
    "friends": "معرفی دوستان",
    "other_groups": "سایر گروه‌ها و کانال‌ها",
    "search": "جستجوی اینترنتی",
    "other": "سایر موارد",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

_write_lock = asyncio.Lock()
_pending_leave_polls: dict[str, int] = {}
_pending_admin_replies: dict[int, int] = {}

try:
    NOTIFY_CHAT_ID_INT = int(NOTIFY_CHAT_ID) if NOTIFY_CHAT_ID else None
except ValueError:
    NOTIFY_CHAT_ID_INT = None

LEAVE_REASONS: list[tuple[str, str]] = [
    (
        "فایل‌ها و محتوای گروه به‌دردم نخورد",
        "حیف شد! اگر دقیقاً بگویی دنبالِ چه فایلی بودی، حتماً در انبارِ این "
        "رواق گم‌شده‌ای پیدا می‌شود که به‌کارت بیاید. به ادمین‌ها پیام بده، "
        "شاید درِ گنج‌خانه‌ای تازه باز شود 🙏",
    ),
    (
        "پیام‌های زیاد گروه رو شلوغ می‌کرد",
        "راستی؟ می‌دونی که می‌تونی گروه رو روی حالتِ سکوت بذاری و فقط گاهی "
        "سراغِ «پیام‌های سنجاق‌شده» (همون فایل‌های طلایی) بیای؟ بدونِ اینکه "
        "اعلان‌ها اذیتت کنن 🔕",
    ),
    (
        "فعلاً به این موضوع نیاز ندارم",
        "کاملاً درک می‌کنم. بساطِ معماری گاهی خلوت‌شدن هم می‌خواد. هر وقت "
        "دوباره خواستی قدم بذاری، درِ رواق به رویت باز است 🙌",
    ),
    (
        "دلیل دیگه‌ای دارم",
        "ممنون که وقت گذاشتی. اگه حرفِ دلت رو مستقیم با ادمین‌ها در میون "
        "بذاری، به ما در مرمتِ این فضا کمکِ بزرگی کردی 🙏",
    ),
]


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def load_stats() -> dict:
    if not STATS_FILE.exists():
        return {"total_joined": 0, "total_left": 0}
    try:
        return json.loads(STATS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"total_joined": 0, "total_left": 0}


async def increment_stat(field: str) -> None:
    async with _write_lock:
        stats = load_stats()
        stats[field] = stats.get(field, 0) + 1
        STATS_FILE.write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")


def load_phones() -> dict:
    if not PHONES_FILE.exists():
        return {}
    try:
        return json.loads(PHONES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


async def save_phone(user_id: int, phone: str) -> None:
    async with _write_lock:
        phones = load_phones()
        phones[str(user_id)] = phone
        PHONES_FILE.write_text(json.dumps(phones, ensure_ascii=False), encoding="utf-8")


def get_saved_phone(user_id: int) -> str:
    return load_phones().get(str(user_id), "")


def has_submitted_form(user_id: int) -> bool:
    """بررسی می‌کند که آیا کاربر قبلاً فرم را پر کرده است یا خیر."""
    if not DATA_FILE.exists():
        return False
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if int(record.get("user_id", 0)) == user_id:
                    return True
            except:
                continue
    return False


class BroadcastStates(StatesGroup):
    waiting_for_text = State()
    confirming = State()


class ReplyStates(StatesGroup):
    waiting_for_reply_text = State()


def collect_form_user_ids() -> set[int]:
    user_ids: set[int] = set()
    if not DATA_FILE.exists():
        return user_ids
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                user_ids.add(int(record["user_id"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return user_ids


async def build_stats_text() -> str:
    try:
        member_count = await bot.get_chat_member_count(GROUP_CHAT_ID)
    except Exception as e:
        logger.warning("گرفتن تعداد اعضا ممکن نشد: %s", e)
        member_count = "نامشخص"

    form_count = 0
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            form_count = sum(1 for line in f if line.strip())

    stats = load_stats()
    total_joined = stats.get("total_joined", 0)
    total_left = stats.get("total_left", 0)
    leave_rate = (total_left / total_joined * 100) if total_joined else 0

    return (
        "📐 <b>گزارشِ وضعیتِ بنا (آمار لحظه‌ای)</b>\n\n"
        f"👥 ساکنینِ فعلی: <b>{member_count}</b>\n"
        f"📝 پروفایل‌های تکمیل‌شده (فرم): <b>{form_count}</b>\n"
        f"➕ کل ورودها از ابتدای ساماندهی: <b>{total_joined}</b>\n"
        f"➖ کل خروج‌ها: <b>{total_left}</b>\n"
        f"📉 نرخِ ریزشِ جمعیت: <b>{leave_rate:.1f}٪</b>\n\n"
        "<i>این آمار از زمانی که دروازه‌ی الکترونیکی نصب شده، ثبت می‌شود.</i>"
    )


async def build_stats_detail_text() -> str:
    if not DATA_FILE.exists():
        return "هنوز هیچ فرمی ثبت نشده است."

    educations: dict[str, int] = {}
    referrals: dict[str, int] = {}
    interests: dict[str, int] = {}
    form_count = 0

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            form_count += 1

            edu_label = record.get("education_label") or record.get("education") or "نامشخص"
            educations[edu_label] = educations.get(edu_label, 0) + 1

            ref = record.get("referral") or "نامشخص"
            ref_label = REFERRAL_LABELS.get(ref, ref)
            referrals[ref_label] = referrals.get(ref_label, 0) + 1

            for interest in record.get("interests") or []:
                interests[interest] = interests.get(interest, 0) + 1

    if form_count == 0:
        return "هنوز هیچ فرمی ثبت نشده است."

    lines = [
        f"📊 <b>آمارِ تفصیلیِ ساکنانِ رواق</b>\n"
        f"از میانِ <b>{form_count}</b> نفری که احرازِ هویت را کامل کرده‌اند:\n"
    ]

    lines.append("<b>مقطعِ تحصیلی:</b>")
    for label, count in sorted(educations.items(), key=lambda x: -x[1]):
        lines.append(f"▪️ {label}: <b>{count}</b> نفر")

    lines.append("\n<b>نحوه‌ی آشنایی:</b>")
    for label, count in sorted(referrals.items(), key=lambda x: -x[1]):
        lines.append(f"▪️ {label}: <b>{count}</b> نفر")

    lines.append("\n<b>علایق:</b>")
    if interests:
        for label, count in sorted(interests.items(), key=lambda x: -x[1]):
            lines.append(f"▪️ {label}: <b>{count}</b> نفر")
    else:
        lines.append("هنوز کسی علایقش را ثبت نکرده.")

    return "\n".join(lines)


def build_export_file() -> BufferedInputFile | None:
    if not DATA_FILE.exists():
        return None

    records: list[dict] = []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    if not records:
        return None

    records.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
    phones = load_phones()

    headers = [
        "آیدی عددی", "نام کاربری", "نام کامل", "شماره تلفن",
        "تاریخ و ساعت ثبت (UTC)", "مقطع تحصیلی", "نحوه آشنایی", "علایق انتخاب‌شده",
    ]

    def format_date(raw: str) -> str:
        try:
            dt = datetime.fromisoformat(raw)
            return dt.strftime("%Y-%m-%d  %H:%M")
        except (ValueError, TypeError):
            return raw or "-"

    def format_interests(value) -> str:
        if isinstance(value, list):
            return "، ".join(value) if value else "-"
        return str(value) if value else "-"

    rows = []
    for record in records:
        user_id = record.get("user_id", "")
        username = record.get("username")
        rows.append([
            user_id,
            f"@{username}" if username else "-",
            record.get("full_name") or "-",
            phones.get(str(user_id), "-"),
            format_date(record.get("submitted_at", "")),
            record.get("education_label") or record.get("education") or "-",
            REFERRAL_LABELS.get(record.get("referral"), record.get("referral") or "-"),
            format_interests(record.get("interests")),
        ])

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "فرم‌های ثبت‌شده"
    sheet.sheet_view.rightToLeft = True

    sheet.append(headers)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="14532F", end_color="14532F", fill_type="solid")
    for cell in sheet[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row in rows:
        sheet.append(row)

    for row_cells in sheet.iter_rows(min_row=2):
        for cell in row_cells:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    for col_index, header in enumerate(headers, start=1):
        max_len = len(str(header))
        for row in rows:
            cell_value = row[col_index - 1]
            max_len = max(max_len, len(str(cell_value)))
        sheet.column_dimensions[get_column_letter(col_index)].width = min(max_len + 4, 42)

    sheet.freeze_panes = "A2"
    sheet.row_dimensions[1].height = 22

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return BufferedInputFile(buffer.read(), filename="فرم‌های عضویت.xlsx")


def admin_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 آمار گروه", callback_data="admin:stats")],
            [InlineKeyboardButton(text="📈 آمار تفصیلیِ فرم‌ها", callback_data="admin:stats_detail")],
            [InlineKeyboardButton(text="📄 خروجی اکسل فرم‌ها", callback_data="admin:export")],
            [InlineKeyboardButton(text="📢 ارسال پیام همگانی", callback_data="admin:broadcast")],
            [InlineKeyboardButton(text="❌ بستن", callback_data="admin:close")],
        ]
    )


def admin_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")]]
    )


def phone_request_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 اشتراک‌گذاری شماره تلفن", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


# --------------------------------------------------------------
# ۲) هندلر /start
# --------------------------------------------------------------
@dp.message(Command("start"))
async def handle_start(message: Message, command: CommandObject = None):
    args = command.args if command else None
    
    if args == "phone":
        # کاربر از مینی‌اپ آمده تا شماره را به اشتراک بگذارد
        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="📱 اشتراک‌گذاری شماره تلفن", request_contact=True)]],
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        await message.answer(
            "📱 برای تکمیل احراز هویت، لطفاً شماره تلفن خود را با دکمه‌ی زیر به اشتراک بگذارید:",
            reply_markup=keyboard
        )
        return
    
    await message.answer(
        "به رواق خوش آمدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
        "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
        "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم."
    )


# --------------------------------------------------------------
# ۳) دریافت شماره تلفن
# --------------------------------------------------------------
@dp.message(F.contact)
async def handle_contact_shared(message: Message):
    contact = message.contact
    user = message.from_user

    # فقط شماره‌ی خودِ همان کاربر پذیرفته می‌شود
    if contact.user_id != user.id:
        await message.answer(
            "این‌جا فقط شماره‌ی خودت کلیدِ ورود است. لطفاً با همان دکمه، "
            "شماره‌ی خودت را به اشتراک بگذار.",
            reply_markup=phone_request_keyboard(),
        )
        return

    # ذخیره شماره
    await save_phone(user.id, contact.phone_number)
    await message.answer(
        "✅ شماره‌ی شما ثبت شد. حالا می‌توانید فرم را تکمیل کنید.",
        reply_markup=ReplyKeyboardRemove()
    )
    
    # باز کردن مینی‌اپ با شماره به‌عنوان پارامتر
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📝 بازگشت به فرم",
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}?phone={contact.phone_number}")
                )
            ]
        ]
    )
    await message.answer(
        "برای ادامه‌ی فرم، روی دکمه‌ی زیر کلیک کن:",
        reply_markup=keyboard
    )


# --------------------------------------------------------------
# ۴) درخواست عضویت
# --------------------------------------------------------------
async def send_webapp_form_message(user) -> None:
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📝 تکمیل فرم پذیرش",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ]
    )
    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                "هویتت ثبت شد ✅\n\n"
                "حالا نوبت به ترسیمِ پروفایلِ تو در این جمع می‌رسد. یک فرمِ "
                "کوتاه (کمتر از یک دقیقه) پیشِ رویِ توست تا جایگاهِ حرفه‌ای‌ات "
                "را در این رواق مشخص کنی."
            ),
            reply_markup=keyboard,
        )
    except Exception as e:
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)


@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

    # اگر کاربر قبلاً فرم را پر کرده باشد، مستقیماً تایید کن
    if has_submitted_form(user.id):
        try:
            await bot.approve_chat_join_request(chat_id=GROUP_CHAT_ID, user_id=user.id)
            logger.info("کاربر %s قبلاً فرم را پر کرده بود، درخواست تایید شد.", user.id)
        except Exception as e:
            logger.warning("تایید خودکار کاربر %s ممکن نشد: %s", user.id, e)
        return

    # اگر شماره ذخیره شده دارد، فرم را بفرست
    if get_saved_phone(user.id):
        await send_webapp_form_message(user)
        return

    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"سلام {user.first_name} عزیز. عبور از این دروازه، یک گامِ احرازِ "
                "هویت دارد.\n"
                "برای اینکه مطمئن شویم «خودِ تو» هستی و از مصالحِ این رواق "
                "محافظت کنیم، شماره‌ات را با دکمه‌ی پایینِ صفحه (فقط شماره‌ی "
                "خودت) به اشتراک بگذار تا نقشه‌ی ورودت تکمیل شود."
            ),
            reply_markup=phone_request_keyboard(),
        )
    except Exception as e:
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)


# --------------------------------------------------------------
# ۵) تغییر وضعیت عضویت
# --------------------------------------------------------------
@dp.chat_member()
async def handle_chat_member_update(update: ChatMemberUpdated):
    if update.chat.id != GROUP_CHAT_ID:
        return

    old_status = update.old_chat_member.status
    new_status = update.new_chat_member.status
    user = update.new_chat_member.user

    if user.is_bot:
        return

    became_member = new_status == ChatMemberStatus.MEMBER and old_status != ChatMemberStatus.MEMBER
    if became_member:
        await increment_stat("total_joined")
        await notify_new_member(user)
        await send_welcome_to_group(user)
        return

    left_group = (
        old_status == ChatMemberStatus.MEMBER
        and new_status in (ChatMemberStatus.LEFT, ChatMemberStatus.KICKED)
    )
    if left_group:
        await increment_stat("total_left")
        await handle_member_left(user)


async def notify_new_member(user) -> None:
    if not NOTIFY_CHAT_ID:
        return
    username_part = f"@{user.username}" if user.username else f"<code>{user.id}</code>"
    try:
        await bot.send_message(
            chat_id=NOTIFY_CHAT_ID,
            text=(
                f"✅ عضو جدید به گروه پیوست:\n"
                f"👤 {user.full_name} ({username_part})"
            ),
        )
    except Exception as e:
        logger.warning("ارسال گزارش عضو جدید ممکن نشد: %s", e)


async def send_welcome_to_group(user) -> None:
    display_name = html_escape(user.full_name or user.first_name or "کاربر")
    user_mention = f"<a href='tg://user?id={user.id}'>{display_name}</a>"
    try:
        sent = await bot.send_message(
            chat_id=GROUP_CHAT_ID,
            text=(
                f"سلام {user_mention}\n\n"
                "🧱 به جمع معمارای حرفه‌ای خوش اومدی!\n\n"
                "اینجا جاییه که آدمای باهوش مثل تو، به بهترین فایل‌ها و "
                "منابع معماری دسترسی دارن.\n"
                "📌 لطفاً خودت رو در تایپیک کافه معماری معرفی کن.\n\n"
                "🏛 آماده‌ای بریم سمت پیشرفت؟"
            ),
            parse_mode=ParseMode.HTML,
        )
    except Exception as e:
        logger.warning("ارسال پیام خوش‌آمدگویی به گروه ممکن نشد: %s", e)
        return

    asyncio.create_task(_delete_message_later(sent.chat.id, sent.message_id, delay=30))


async def _delete_message_later(chat_id: int, message_id: int, delay: int) -> None:
    await asyncio.sleep(delay)
    try:
        await bot.delete_message(chat_id=chat_id, message_id=message_id)
    except Exception as e:
        logger.warning("حذفِ خودکارِ پیامِ خوش‌آمدگویی ممکن نشد: %s", e)


async def handle_member_left(user) -> None:
    if NOTIFY_CHAT_ID:
        username_part = f"@{user.username}" if user.username else f"<code>{user.id}</code>"
        try:
            await bot.send_message(
                chat_id=NOTIFY_CHAT_ID,
                text=f"🚪 یک عضو گروه را ترک کرد:\n👤 {user.full_name} ({username_part})",
            )
        except Exception as e:
            logger.warning("ارسال گزارش ترک عضو ممکن نشد: %s", e)

    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"متأسفانه از جمعِ ما فاصله گرفتی {user.first_name}. اگر یک "
                "دقیقه وقت بگذاری و بگویی «چرا این بنا را ترک کردی؟»، به ما "
                "کمک می‌کنی تا طرحِ بهتری بریزیم."
            ),
        )

        sent_poll = await bot.send_poll(
            chat_id=user.id,
            question="چرا این بنا را ترک کردی؟",
            options=[reason for reason, _ in LEAVE_REASONS],
            is_anonymous=False,
        )
        _pending_leave_polls[sent_poll.poll.id] = user.id

        keyboard = None
        if GROUP_INVITE_LINK:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="بازگشت به گروه ↩️", url=GROUP_INVITE_LINK)]
                ]
            )
        await bot.send_message(
            chat_id=user.id,
            text="هرگاه خواستی، طاق‌ها هنوز پابرجایند — درِ رواق باز است 🏛",
            reply_markup=keyboard,
        )
    except Exception as e:
        logger.warning("نمی‌توان به کاربر خارج‌شده %s پیام داد: %s", user.id, e)


# --------------------------------------------------------------
# ۶) پاسخ نظرسنجی ترک گروه
# --------------------------------------------------------------
@dp.poll_answer()
async def handle_leave_poll_answer(poll_answer: PollAnswer):
    user_id = _pending_leave_polls.pop(poll_answer.poll_id, None)
    if user_id is None or not poll_answer.option_ids:
        return

    option_index = poll_answer.option_ids[0]
    if option_index >= len(LEAVE_REASONS):
        return

    reason_text, reply_text = LEAVE_REASONS[option_index]
    try:
        await bot.send_message(chat_id=user_id, text=reply_text)
    except Exception as e:
        logger.warning("ارسال پاسخ نظرسنجی به کاربر %s ممکن نشد: %s", user_id, e)

    if NOTIFY_CHAT_ID and reason_text:
        try:
            user = await bot.get_chat(user_id)
            display_name = html_escape(user.full_name or user.first_name or "کاربر")
            user_mention = f"<a href='tg://user?id={user_id}'>{display_name}</a>"
            username_part = f"@{user.username}" if user.username else f"<code>{user_id}</code>"

            reply_keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="✏️ پاسخ به این کاربر",
                            callback_data=f"reply_to_user:{user_id}"
                        )
                    ]
                ]
            )

            await bot.send_message(
                chat_id=NOTIFY_CHAT_ID,
                text=(
                    f"📩 **انتقاد جدید از یک کاربر خارج‌شده**\n\n"
                    f"👤 {user_mention}\n"
                    f"🆔 {username_part}\n\n"
                    f"💬 **دلیل ترک:**\n{reason_text}"
                ),
                reply_markup=reply_keyboard,
                parse_mode=ParseMode.HTML,
            )
        except Exception as e:
            logger.warning("ارسال انتقاد به ادمین ممکن نشد: %s", e)


# --------------------------------------------------------------
# ۷) پنل مدیریت
# --------------------------------------------------------------
@dp.message(Command("admin"))
async def handle_admin_panel(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    await message.answer(
        "🛠 <b>پنل مدیریت</b>\nیکی از گزینه‌ها را انتخاب کنید:",
        reply_markup=admin_panel_keyboard(),
    )


@dp.message(Command("stats"))
async def handle_stats(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer(await build_stats_text())


@dp.message(Command("stats_detail"))
async def handle_stats_detail(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer(await build_stats_detail_text())


@dp.message(Command("export"))
async def handle_export(message: Message):
    if not is_admin(message.from_user.id):
        return
    file = build_export_file()
    if file is None:
        await message.answer("هنوز هیچ فرمی ثبت نشده است.")
        return
    await message.answer_document(file, caption="📄 خروجی اکسل فرم‌های ثبت‌شده")


@dp.message(Command("broadcast"))
async def handle_broadcast(message: Message, command: CommandObject):
    if not is_admin(message.from_user.id):
        return

    text = (command.args or "").strip()
    if not text:
        await message.answer(
            "برای ارسال پیام همگانی به این شکل دستور را بفرستید:\n"
            "<code>/broadcast متن پیام شما</code>\n\n"
            "یا از پنل شیشه‌ای با دستور /admin استفاده کنید."
        )
        return

    user_ids = collect_form_user_ids()
    if not user_ids:
        await message.answer("هیچ کاربری برای ارسال پیدا نشد.")
        return

    await message.answer(f"⏳ در حال ارسال پیام به {len(user_ids)} نفر...")
    sent, failed = await send_broadcast(text, user_ids)
    await message.answer(
        f"✅ ارسال همگانی تمام شد.\nموفق: <b>{sent}</b>\nناموفق: <b>{failed}</b>"
    )


async def send_broadcast(text: str, user_ids: set[int]) -> tuple[int, int]:
    sent, failed = 0, 0
    for user_id in user_ids:
        try:
            await bot.send_message(chat_id=user_id, text=text)
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)
    return sent, failed


@dp.callback_query(F.data == "admin:menu")
async def cb_admin_menu(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.clear()
    await callback.message.edit_text(
        "🛠 <b>پنل مدیریت</b>\nیکی از گزینه‌ها را انتخاب کنید:",
        reply_markup=admin_panel_keyboard(),
    )
    await callback.answer()


@dp.callback_query(F.data == "admin:close")
async def cb_admin_close(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.clear()
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(F.data == "admin:stats")
async def cb_admin_stats(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await callback.answer()
    await callback.message.edit_text(await build_stats_text(), reply_markup=admin_back_keyboard())


@dp.callback_query(F.data == "admin:stats_detail")
async def cb_admin_stats_detail(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await callback.answer()
    await callback.message.edit_text(await build_stats_detail_text(), reply_markup=admin_back_keyboard())


@dp.callback_query(F.data == "admin:export")
async def cb_admin_export(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await callback.answer("⏳ در حال ساخت فایل اکسل...")
    file = build_export_file()
    if file is None:
        await callback.message.answer("هنوز هیچ فرمی ثبت نشده است.")
        return
    await callback.message.answer_document(file, caption="📄 خروجی اکسل فرم‌های ثبت‌شده")


@dp.callback_query(F.data == "admin:broadcast")
async def cb_admin_broadcast_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await state.set_state(BroadcastStates.waiting_for_text)
    await callback.message.edit_text(
        "📢 متن پیامی که می‌خواهید برای همه‌ی کسانی که فرم را پر کرده‌اند "
        "ارسال شود را همین‌جا بفرستید.\n\n"
        "برای انصراف، دستور /cancel را بفرستید.",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()


@dp.message(BroadcastStates.waiting_for_text)
async def handle_broadcast_text_input(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    raw_text = (message.text or "").strip()
    if raw_text.startswith("/"):
        await state.clear()
        await message.answer(
            "ارسال پیام همگانی لغو شد. برای اجرای دستور جدید، دوباره بفرستیدش.",
            reply_markup=admin_panel_keyboard(),
        )
        return

    text = message.html_text or message.text or ""
    if not text.strip():
        await message.answer("یک پیامِ متنی برایمان بفرست تا مسیر ادامه پیدا کند (یا /cancel برای انصراف).")
        return

    user_ids = collect_form_user_ids()
    await state.update_data(broadcast_text=text)
    await state.set_state(BroadcastStates.confirming)

    confirm_keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✅ ارسال شود", callback_data="admin:broadcast_confirm")],
            [InlineKeyboardButton(text="❌ انصراف", callback_data="admin:broadcast_cancel")],
        ]
    )
    await message.answer(
        f"پیش‌نمایش پیام شما:\n\n{text}\n\n"
        f"این پیام برای <b>{len(user_ids)}</b> نفر ارسال می‌شود. مطمئنید؟",
        reply_markup=confirm_keyboard,
    )


@dp.callback_query(F.data == "admin:broadcast_confirm", BroadcastStates.confirming)
async def cb_broadcast_confirm(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return

    data = await state.get_data()
    text = data.get("broadcast_text", "")
    await state.clear()

    if not text:
        await callback.answer()
        await callback.message.edit_text("متنی برای ارسال پیدا نشد.", reply_markup=admin_back_keyboard())
        return

    await callback.answer("⏳ در حال ارسال...")
    user_ids = collect_form_user_ids()
    sent, failed = await send_broadcast(text, user_ids)
    await callback.message.edit_text(
        f"✅ ارسال همگانی تمام شد.\nموفق: <b>{sent}</b>\nناموفق: <b>{failed}</b>",
        reply_markup=admin_back_keyboard(),
    )


@dp.callback_query(F.data == "admin:broadcast_cancel", BroadcastStates.confirming)
async def cb_broadcast_cancel(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.clear()
    await callback.answer()
    await callback.message.edit_text("ارسال همگانی لغو شد.", reply_markup=admin_back_keyboard())


# --------------------------------------------------------------
# ۸) صندوق پیام اعضا
# --------------------------------------------------------------
async def relay_message_to_admin(user, text: str) -> None:
    if not NOTIFY_CHAT_ID:
        return

    display_name = html_escape(user.full_name or user.first_name or "یک عضو")
    username_part = f"@{user.username}" if user.username else f"<code>{user.id}</code>"

    try:
        sent = await bot.send_message(
            chat_id=NOTIFY_CHAT_ID,
            text=(
                "📩 پیامِ تازه از یکی از اعضای رواق\n"
                f"👤 {display_name} ({username_part})\n\n"
                f"{html_escape(text)}\n\n"
                "برای پاسخ به همین عضو، فقط روی همین پیام «ریپلای» بزنید؛ "
                "پاسخ‌تون مستقیم و بدونِ نیاز به دونستنِ آیدی، براش ارسال می‌شه."
            ),
        )
        _pending_admin_replies[sent.message_id] = user.id
    except Exception as e:
        logger.warning("ارسالِ پیامِ عضو به ادمین ممکن نشد: %s", e)


@dp.message(F.chat.id == NOTIFY_CHAT_ID_INT, F.reply_to_message)
async def handle_admin_reply_via_native_reply(message: Message):
    if not is_admin(message.from_user.id):
        return

    replied_id = message.reply_to_message.message_id
    target_user_id = _pending_admin_replies.get(replied_id)
    if target_user_id is None:
        return

    reply_text = (message.html_text or message.text or "").strip()
    if not reply_text:
        return

    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=f"از سوی مدیریتِ رواق:\n\n{reply_text}",
        )
        await message.reply("✅ پاسخ شما برای همون عضو ارسال شد.")
    except Exception as e:
        logger.warning("ارسالِ پاسخِ ادمین به کاربر %s ممکن نشد: %s", target_user_id, e)
        await message.reply(f"❌ ارسال پاسخ ناموفق بود: {e}")


@dp.message(F.chat.type == "private", StateFilter(None))
async def handle_generic_member_message(message: Message):
    if is_admin(message.from_user.id):
        return

    text = message.text or message.caption
    if not text or text.startswith("/"):
        return

    await relay_message_to_admin(message.from_user, text)
    await message.answer("پیامت به گوشِ ادمین‌های رواق رسید؛ به‌زودی جواب می‌گیری 🙏")


# --------------------------------------------------------------
# ۹) پاسخ به دکمه‌ی «پاسخ به کاربر»
# --------------------------------------------------------------
@dp.callback_query(F.data.startswith("reply_to_user:"))
async def cb_reply_to_user(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("این دکمه فقط برای ادمین‌ها فعال است.", show_alert=True)
        return

    user_id_str = callback.data.split(":")[1]
    try:
        target_user_id = int(user_id_str)
    except ValueError:
        await callback.answer("خطا در شناسایی کاربر.", show_alert=True)
        return

    await state.update_data(reply_target_user_id=target_user_id)
    await state.set_state(ReplyStates.waiting_for_reply_text)

    await callback.message.edit_text(
        f"✏️ لطفاً متن پاسخ خود را برای کاربر با آیدی `{target_user_id}` تایپ کنید.\n\n"
        "می‌توانید از HTML (مثل <b>پررنگ</b>) استفاده کنید.\n"
        "برای انصراف، دستور /cancel را بفرستید."
    )
    await callback.answer()


@dp.message(ReplyStates.waiting_for_reply_text)
async def handle_reply_text_input(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    text = (message.text or "").strip()
    if text.lower().startswith("/cancel"):
        await state.clear()
        await message.answer("❌ ارسال پاسخ لغو شد.")
        return

    if not text:
        await message.answer("لطفاً یک متن غیرخالی ارسال کنید.")
        return

    data = await state.get_data()
    target_user_id = data.get("reply_target_user_id")
    if not target_user_id:
        await state.clear()
        await message.answer("❌ شناسه‌ی کاربر پیدا نشد. لطفاً دوباره از دکمه استفاده کنید.")
        return

    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=(
                f"📩 **پاسخ ادمین به انتقاد شما:**\n\n"
                f"{text}\n\n"
                "🙏 از اینکه وقت گذاشتید و نظرتان را با ما در میان گذاشتید، سپاسگزاریم."
            ),
            parse_mode=ParseMode.HTML,
        )
        await message.answer(f"✅ پاسخ شما با موفقیت به کاربر ارسال شد.")
    except Exception as e:
        logger.warning("ارسال پاسخ به کاربر %s ممکن نشد: %s", target_user_id, e)
        await message.answer(f"❌ ارسال پاسخ ناموفق بود: {str(e)}")

    await state.clear()


@dp.message(Command("cancel"))
async def handle_cancel(message: Message, state: FSMContext):
    current_state = await state.get_state()
    if current_state is None:
        await message.answer("هیچ عملی در جریان نیست.")
        return
    await state.clear()
    await message.answer("✅ عملیات لغو شد.")


# --------------------------------------------------------------
# ۱۰) بررسی امضای initData
# --------------------------------------------------------------
def validate_init_data(init_data: str):
    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    user_raw = pairs.get("user")
    if not user_raw:
        return None
    return json.loads(user_raw)


# --------------------------------------------------------------
# ۱۱) دریافت فرم از مینی‌اپ
# --------------------------------------------------------------
async def handle_submit(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"ok": False, "error": "invalid_json"}, status=400)

    init_data = payload.get("initData", "")
    form_data = payload.get("form", {})

    user = validate_init_data(init_data)
    if user is None:
        logger.warning("initData نامعتبر بود — درخواست رد شد.")
        return web.json_response({"ok": False, "error": "invalid_init_data"}, status=403)

    user_id = user["id"]
    
    phone_from_form = form_data.get("phone", "")
    if phone_from_form and not get_saved_phone(user_id):
        await save_phone(user_id, phone_from_form)

    record = {
        "user_id": user_id,
        "username": user.get("username"),
        "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "phone": get_saved_phone(user_id),
        "submitted_at": datetime.utcnow().isoformat(),
        **form_data,
    }

    async with _write_lock:
        with open(DATA_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    logger.info("فرم کاربر %s ذخیره شد.", user_id)

    approved = False
    try:
        await bot.approve_chat_join_request(chat_id=GROUP_CHAT_ID, user_id=user_id)
        approved = True
    except Exception as e:
        logger.warning("تایید عضویت کاربر %s ممکن نشد: %s", user_id, e)

    try:
        keyboard = None
        if GROUP_INVITE_LINK:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="ورود به گروه ↩️", url=GROUP_INVITE_LINK)]
                ]
            )
        if approved:
            await bot.send_message(
                chat_id=user_id,
                text=(
                    "🏛 آفرین! سندِ عضویت‌ات صادر شد.\n"
                    "از این لحظه، تو یکی از ساکنانِ این رواقی. کتابخانه‌ی "
                    "فایل‌ها، پلان‌ها و پروژه‌ها به رویِ تو گشوده شد.\n"
                    "امیدوارم این فضا، مرجعِ همیشگیِ مسیرِ حرفه‌ای‌ات باشد."
                ),
                reply_markup=keyboard,
            )
        else:
            await bot.send_message(
                chat_id=user_id,
                text=(
                    "اطلاعاتت ثبت شد، اما در بازشدنِ درِ رواق کمی تاخیر افتاد. "
                    "کمی صبر کن، یا از طریقِ گروه با ادمین در میان بگذار."
                ),
            )
    except Exception as e:
        logger.warning("ارسال پیام تاییدیه به کاربر %s ممکن نشد: %s", user_id, e)

    return web.json_response({"ok": approved})


# --------------------------------------------------------------
# ۱۲) سلامت و پینگ
# --------------------------------------------------------------
async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"ok": True})


async def self_ping_loop(app: web.Application) -> None:
    import aiohttp

    ping_url = f"{WEBHOOK_HOST}/health"
    async with aiohttp.ClientSession() as session:
        while True:
            await asyncio.sleep(PING_INTERVAL_SECONDS)
            try:
                async with session.get(ping_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    logger.info("پینگِ خودکار به %s — کدِ پاسخ: %s", ping_url, resp.status)
            except Exception as e:
                logger.warning("پینگِ خودکار ناموفق بود: %s", e)


async def start_self_ping(app: web.Application) -> None:
    app["self_ping_task"] = asyncio.create_task(self_ping_loop(app))


async def stop_self_ping(app: web.Application) -> None:
    task = app.get("self_ping_task")
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# --------------------------------------------------------------
# ۱۳) راه‌اندازی
# --------------------------------------------------------------
async def on_startup(app: web.Application):
    await bot.set_webhook(
        WEBHOOK_URL,
        drop_pending_updates=True,
        allowed_updates=[
            "message",
            "chat_join_request",
            "chat_member",
            "poll_answer",
            "callback_query",
        ],
    )
    logger.info("Webhook تنظیم شد روی: %s", WEBHOOK_URL)

    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="ورود به رواق", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    logger.info("Menu Button روی مینی‌اپ تنظیم شد.")


def create_app() -> web.Application:
    app = web.Application()

    webapp_dir = Path(__file__).parent / "webapp"
    app.router.add_static("/webapp/", path=str(webapp_dir), show_index=False)

    app.router.add_post("/api/submit", handle_submit)
    app.router.add_get("/health", handle_health)

    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)

    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_startup.append(start_self_ping)
    app.on_cleanup.append(stop_self_ping)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)