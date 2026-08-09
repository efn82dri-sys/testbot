# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «تایید عضویت» — مرجع فایل‌های معماری و عمران
====================================================================
نسخه‌ی نهایی با قابلیت‌های:
- حضور و غیاب خودکار با یادآوری هر ۳ ساعت و پایان خودکار بعد از ۲۴ ساعت
- تاریخ و ساعت شمسی + تهران
- ارسال پیام مستقیم به کاربر از پنل ادمین (دو مرحله‌ای)
- خاموش/روشن کردن ربات با ذخیرهٔ درخواست‌های معلق
- پنل مدیریت کامل با دکمه‌های دوستونه
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta
from html import escape as html_escape
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qsl

import jdatetime
import pytz
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
# ۱) تنظیمات اولیه
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
ATTENDANCE_FILE = Path(__file__).parent / "data" / "attendance.json"
BOT_STATE_FILE = Path(__file__).parent / "data" / "bot_state.json"

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
_attendance_tasks: dict[str, asyncio.Task] = {}

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

# ---------- زمان و تاریخ شمسی ----------
TEHRAN_TZ = pytz.timezone('Asia/Tehran')

def utc_to_tehran(utc_dt: datetime) -> datetime:
    return utc_dt.astimezone(TEHRAN_TZ)

def to_jalali(utc_dt: datetime) -> jdatetime.datetime:
    tehran_dt = utc_to_tehran(utc_dt)
    return jdatetime.datetime.fromgregorian(datetime=tehran_dt.replace(tzinfo=None))

def format_jalali_datetime(utc_dt: datetime) -> str:
    jalali = to_jalali(utc_dt)
    return jalali.strftime("%Y/%m/%d %H:%M:%S")

# ---------- توابع کمکی ----------
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
    phones = load_phones()
    if not phones and not DATA_FILE.exists():
        return None

    form_records = {}
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    uid = str(record.get("user_id"))
                    form_records[uid] = record
                except json.JSONDecodeError:
                    continue

    all_user_ids = set(phones.keys()) | set(form_records.keys())
    if not all_user_ids:
        return None

    rows = []
    for uid_str in all_user_ids:
        try:
            uid_int = int(uid_str)
        except ValueError:
            continue
        phone = phones.get(uid_str, "")
        record = form_records.get(uid_str, {})

        username = record.get("username")
        full_name = record.get("full_name", "")
        submitted_at = record.get("submitted_at", "")
        education = record.get("education_label") or record.get("education") or "-"
        referral = REFERRAL_LABELS.get(record.get("referral"), record.get("referral") or "-")
        interests_list = record.get("interests", [])
        interests_str = "، ".join(interests_list) if interests_list else "-"

        form_status = "تکمیل شده" if record else "تکمیل نشده"

        rows.append([
            uid_str,
            f"@{username}" if username else "-",
            full_name or "-",
            phone or "-",
            submitted_at[:16] if submitted_at else "-",
            education,
            referral,
            interests_str,
            form_status,
        ])

    rows.sort(key=lambda r: (r[4] == "-", r[4]), reverse=False)

    headers = [
        "آیدی عددی",
        "نام کاربری",
        "نام کامل",
        "شماره تلفن",
        "تاریخ و ساعت ثبت (UTC)",
        "مقطع تحصیلی",
        "نحوه آشنایی",
        "علایق انتخاب‌شده",
        "وضعیت فرم",
    ]

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "همه‌ی تأییدشده‌ها"
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

    for col_index, _ in enumerate(headers, start=1):
        max_len = len(headers[col_index - 1])
        for row in rows:
            cell_value = row[col_index - 1]
            max_len = max(max_len, len(str(cell_value)))
        sheet.column_dimensions[get_column_letter(col_index)].width = min(max_len + 4, 42)

    sheet.freeze_panes = "A2"
    sheet.row_dimensions[1].height = 22

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return BufferedInputFile(buffer.read(), filename="همه‌ی تأییدشده‌ها.xlsx")

# ---------- مدیریت وضعیت ربات (خاموش/روشن) ----------
def load_bot_state() -> dict:
    if not BOT_STATE_FILE.exists():
        return {"enabled": True, "pending_requests": []}
    try:
        return json.loads(BOT_STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"enabled": True, "pending_requests": []}

async def save_bot_state(state: dict) -> None:
    async with _write_lock:
        BOT_STATE_FILE.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")

async def process_pending_requests():
    """پردازش درخواست‌های عضویت معلق هنگام روشن شدن ربات"""
    state = load_bot_state()
    pending = state.get("pending_requests", [])
    if not pending:
        return
    logger.info("شروع پردازش %d درخواست معلق", len(pending))
    for user_id in pending:
        try:
            user = await bot.get_chat(user_id)
            await bot.send_message(
                chat_id=user_id,
                text=(
                    f"سلام {user.first_name}،\n\n"
                    "ربات اکنون فعال شده است. برای تکمیل عضویت، لطفاً شمارهٔ تلفن خود را ارسال کنید."
                ),
                reply_markup=phone_request_keyboard(),
            )
            logger.info("پیام به کاربر %s ارسال شد", user_id)
        except Exception as e:
            logger.warning("پردازش درخواست معلق برای %s ناموفق: %s", user_id, e)
        await asyncio.sleep(2)  # فاصله ۲ ثانیه برای جلوگیری از اسپم
    # پس از پردازش، صف را خالی می‌کنیم
    state["pending_requests"] = []
    await save_bot_state(state)
    logger.info("پردازش درخواست‌های معلق پایان یافت")

# ---------- پنل مدیریت (دکمه‌های دوستونه) ----------
def admin_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📊 آمار گروه", callback_data="admin:stats"),
                InlineKeyboardButton(text="📈 آمار تفصیلی", callback_data="admin:stats_detail"),
            ],
            [
                InlineKeyboardButton(text="📄 خروجی اکسل", callback_data="admin:export"),
                InlineKeyboardButton(text="📢 پیام همگانی", callback_data="admin:broadcast"),
            ],
            [
                InlineKeyboardButton(text="📨 ارسال مستقیم", callback_data="admin:sendmsg"),
                InlineKeyboardButton(text="🔌 خاموش/روشن", callback_data="admin:toggle_bot"),
            ],
            [
                InlineKeyboardButton(text="❌ بستن", callback_data="admin:close"),
            ],
        ]
    )

def admin_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")]]
    )

# ---------- دستور /start ----------
@dp.message(Command("start"))
async def handle_start(message: Message):
    await message.answer(
        "به رواق خوش آمدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
        "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
        "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم."
    )

def phone_request_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 اشتراک‌گذاری شماره تلفن", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )

async def send_vpn_warning_and_form(user) -> None:
    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                "⚠️ <b>توجه مهم</b>\n\n"
                "برای باز کردن فرم عضویت، حتماً از یک <b>VPN یا پروکسی متصل به اینترنت</b> استفاده کنید.\n"
                "در غیر این صورت ممکن است صفحه‌ی فرم برای شما باز نشود.\n\n"
                "پس از اطمینان از اتصال، روی دکمه‌ی زیر کلیک کنید."
            ),
        )
    except Exception as e:
        logger.warning("ارسال پیام VPN به کاربر %s ممکن نشد: %s", user.id, e)

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
            text="اکنون می‌توانید فرم را پر کنید.",
            reply_markup=keyboard,
        )
    except Exception as e:
        logger.warning("ارسال دکمه‌ی فرم به کاربر %s ممکن نشد: %s", user.id, e)

# ---------- درخواست عضویت (با پشتیبانی از خاموش/روشن) ----------
@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

    # بررسی وضعیت ربات
    state = load_bot_state()
    if not state.get("enabled", True):
        # ربات خاموش است
        try:
            await bot.send_message(
                chat_id=user.id,
                text="🔴 فعلاً عضوگیری نداریم. به محض روشن شدن ربات، به شما پیام خواهیم داد."
            )
        except Exception as e:
            logger.warning("ارسال پیام خاموشی به کاربر %s ممکن نشد: %s", user.id, e)
        # ذخیره در صف
        pending = state.get("pending_requests", [])
        if user.id not in pending:
            pending.append(user.id)
            state["pending_requests"] = pending
            await save_bot_state(state)
        return

    # ربات روشن است — ادامهٔ روند عادی
    if get_saved_phone(user.id):
        await send_vpn_warning_and_form(user)
        return

    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"سلام {user.first_name}،\n\n"
                "طبق سیاست‌های جدید تلگرام، برای احراز هویت و جلوگیری از ورود ربات‌ها، "
                "لازم است شماره تلفن خود را با استفاده از دکمه‌ی پایین صفحه تأیید کنید.\n"
                "پس از تأیید، فرم عضویت برای شما فعال می‌شود."
            ),
            reply_markup=phone_request_keyboard(),
        )
    except Exception as e:
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)

# ---------- دریافت شماره تلفن ----------
@dp.message(F.contact)
async def handle_contact_shared(message: Message):
    contact = message.contact
    user = message.from_user

    if contact.user_id != user.id:
        await message.answer(
            "این‌جا فقط شماره‌ی خودت کلیدِ ورود است. لطفاً با همان دکمه، "
            "شماره‌ی خودت را به اشتراک بگذار.",
            reply_markup=phone_request_keyboard(),
        )
        return

    await save_phone(user.id, contact.phone_number)
    await message.answer("مسیر باز شد ✅", reply_markup=ReplyKeyboardRemove())
    await send_vpn_warning_and_form(user)

# ---------- رویداد تغییر وضعیت عضو ----------
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
                f"{user_mention} عزیز خوش آمدی 👋\n\n"
                "▫️ اینجا انباری از فایل‌های تخصصی معماری و عمران است.\n"
                "▫️ برای شروع، خودت را در تاپیک <a href='https://t.me/c/4388421316/95'>کافه معماری</a> معرفی کن.\n\n"
                "🏛 آماده‌ای برای پیشرفت؟"
            ),
            parse_mode=ParseMode.HTML,
            disable_notification=True,
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

@dp.poll_answer()
async def handle_leave_poll_answer(poll_answer: PollAnswer):
    user_id = _pending_leave_polls.pop(poll_answer.poll_id, None)
    if user_id is None or not poll_answer.option_ids:
        return

    option_index = poll_answer.option_ids[0]
    if option_index >= len(LEAVE_REASONS):
        return

    _, reply_text = LEAVE_REASONS[option_index]
    try:
        await bot.send_message(chat_id=user_id, text=reply_text)
    except Exception as e:
        logger.warning("ارسال پاسخ نظرسنجی به کاربر %s ممکن نشد: %s", user_id, e)

# ---------- پنل مدیریت (دستورات متنی) ----------
@dp.message(Command("admin"))
async def handle_admin_panel(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    status_text = "روشن ✅" if load_bot_state().get("enabled", True) else "خاموش 🔴"
    await message.answer(
        f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}\nیکی از گزینه‌ها را انتخاب کنید:",
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
        await message.answer("هنوز هیچ کاربری شماره‌اش را تأیید نکرده است.")
        return
    await message.answer_document(file, caption="📄 خروجی اکسل همه‌ی تأییدشده‌ها")

@dp.message(Command("broadcast"))
async def handle_broadcast(message: Message, command: CommandObject):
    if not is_admin(message.from_user.id):
        return
    text = (command.args or "").strip()
    if not text:
        await message.answer(
            "برای ارسال پیام همگانی به این شکل دستور را بفرستید:\n"
            "<code>/broadcast متن پیام شما</code>\n\n"
            "یا از پنل شیشه‌ای با دستور /admin استفاده کنید (که از عکس و فایل هم پشتیبانی می‌کند)."
        )
        return

    user_ids = collect_form_user_ids()
    if not user_ids:
        await message.answer("هیچ کاربری برای ارسال پیدا نشد.")
        return

    await message.answer(f"⏳ در حال ارسال پیام به {len(user_ids)} نفر...")
    sent, failed = await send_broadcast_text(text, user_ids)
    await message.answer(
        f"✅ ارسال همگانی تمام شد.\nموفق: <b>{sent}</b>\nناموفق: <b>{failed}</b>"
    )

async def send_broadcast_text(text: str, user_ids: set[int]) -> tuple[int, int]:
    sent, failed = 0, 0
    for user_id in user_ids:
        try:
            await bot.send_message(chat_id=user_id, text=text)
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)
    return sent, failed

# ---------- دکمه‌های پنل ----------
@dp.callback_query(F.data == "admin:menu")
async def cb_admin_menu(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.clear()
    status_text = "روشن ✅" if load_bot_state().get("enabled", True) else "خاموش 🔴"
    await callback.message.edit_text(
        f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}\nیکی از گزینه‌ها را انتخاب کنید:",
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
        await callback.message.answer("هنوز هیچ کاربری شماره‌اش را تأیید نکرده است.")
        return
    await callback.message.answer_document(file, caption="📄 خروجی اکسل همه‌ی تأییدشده‌ها")

# ---------- برادکست با پشتیبانی از مدیا ----------
class BroadcastStates(StatesGroup):
    waiting_for_text = State()
    confirming = State()

@dp.callback_query(F.data == "admin:broadcast")
async def cb_admin_broadcast_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await state.set_state(BroadcastStates.waiting_for_text)
    await callback.message.edit_text(
        "📢 <b>ارسال پیام همگانی</b>\n\n"
        "می‌توانید یک پیام متنی، عکس، سند، ویدئو یا هر نوع محتوای دیگری را بفرستید.\n"
        "این پیام برای همه‌ی کاربرانی که فرم را تکمیل کرده‌اند ارسال می‌شود.\n\n"
        "برای انصراف، دستور /cancel را بفرستید.",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()

@dp.message(BroadcastStates.waiting_for_text)
async def handle_broadcast_text_input(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer(
            "ارسال همگانی لغو شد.",
            reply_markup=admin_panel_keyboard(),
        )
        return

    await state.update_data(
        broadcast_chat_id=message.chat.id,
        broadcast_message_id=message.message_id,
    )
    await state.set_state(BroadcastStates.confirming)

    preview_text = "پیش‌نمایش پیام:\n"
    if message.text:
        preview_text += message.text
    elif message.caption:
        preview_text += f"📎 {message.caption}"
    else:
        preview_text += "📎 (یک فایل یا رسانه)"

    user_ids = collect_form_user_ids()
    confirm_keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✅ ارسال شود", callback_data="admin:broadcast_confirm")],
            [InlineKeyboardButton(text="❌ انصراف", callback_data="admin:broadcast_cancel")],
        ]
    )
    await message.answer(
        f"{preview_text}\n\n"
        f"این پیام برای <b>{len(user_ids)}</b> نفر ارسال می‌شود. مطمئنید؟",
        reply_markup=confirm_keyboard,
    )

@dp.callback_query(F.data == "admin:broadcast_confirm", BroadcastStates.confirming)
async def cb_broadcast_confirm(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return

    data = await state.get_data()
    chat_id = data.get("broadcast_chat_id")
    message_id = data.get("broadcast_message_id")
    await state.clear()

    if not chat_id or not message_id:
        await callback.answer()
        await callback.message.edit_text(
            "متنی برای ارسال پیدا نشد.",
            reply_markup=admin_back_keyboard()
        )
        return

    await callback.answer("⏳ در حال ارسال...")
    user_ids = collect_form_user_ids()
    sent, failed = 0, 0

    for uid in user_ids:
        try:
            await bot.copy_message(
                chat_id=uid,
                from_chat_id=chat_id,
                message_id=message_id,
            )
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)

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

# ---------- صندوق پیام اعضا ----------
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

# ==============================================================
#  بخش حضور و غیاب هفتگی (اصلاح‌شده)
# ==============================================================

def load_attendance_data() -> dict:
    if not ATTENDANCE_FILE.exists():
        return {"active": None}
    try:
        return json.loads(ATTENDANCE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"active": None}

async def save_attendance_data(data: dict) -> None:
    async with _write_lock:
        ATTENDANCE_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

# ---------- تسک‌های زمان‌بندی ----------
async def _send_attendance_reminder(chat_id: int, main_message_id: int, data: dict):
    active = data.get("active")
    if not active:
        return
    last_msg_id = active.get("last_reminder_message_id")
    if last_msg_id:
        try:
            await bot.delete_message(chat_id=chat_id, message_id=last_msg_id)
        except Exception as e:
            logger.warning("حذف پیام یادآوری قبلی ممکن نشد: %s", e)

    text = (
        "⚠️ <b>یادآوری حضور هفتگی</b>\n\n"
        "هنوز حضور خود را ثبت نکرده‌اید.\n"
        "لطفاً با کلیک روی دکمه‌ی «✅ من اینجام» در پیام بالایی، حضور خود را تأیید کنید.\n\n"
        "🔴 یادآوری: اگر نامتان در لیست نهایی نباشد، از گروه حذف خواهید شد."
    )
    try:
        sent = await bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_to_message_id=main_message_id,
        )
        active["last_reminder_message_id"] = sent.message_id
        await save_attendance_data(data)
    except Exception as e:
        logger.error("ارسال یادآوری ممکن نشد: %s", e)

async def _attendance_reminder_task(chat_id: int, main_message_id: int):
    data = load_attendance_data()
    active = data.get("active")
    if not active:
        return

    # ۸ بار یادآوری = ۲۴ ساعت کامل
    for i in range(1, 9):
        await asyncio.sleep(3 * 3600)

        data = load_attendance_data()
        active = data.get("active")
        if not active:
            break

        await _send_attendance_reminder(chat_id, main_message_id, data)
        active["reminder_count"] = i
        await save_attendance_data(data)

    data = load_attendance_data()
    active = data.get("active")
    if active:
        await _finish_attendance(chat_id)

async def _finish_attendance(chat_id: int):
    data = load_attendance_data()
    active = data.get("active")
    if not active:
        return

    participants = active.get("participants", [])
    total = len(participants)

    if total == 0:
        await bot.send_message(chat_id=chat_id, text="📋 در این دوره هیچ‌کس حضور ثبت نکرد.")
    else:
        lines = [
            f"📋 <b>لیست نهایی حاضرین در دوره‌ی حضور و غیاب</b>\n"
            f"تعداد کل: <b>{total}</b> نفر\n\n"
            "<b>👤 شرکت‌کنندگان:</b>"
        ]
        for p in participants:
            uid = p["user_id"]
            time_jalali = p.get("time", "نامشخص")
            try:
                member = await bot.get_chat_member(GROUP_CHAT_ID, uid)
                name = member.user.full_name or str(uid)
                username = f" @{member.user.username}" if member.user.username else ""
                lines.append(f"• {name} (ID: <code>{uid}</code>){username} — ثبت در {time_jalali}")
            except Exception:
                lines.append(f"• کاربر با آیدی <code>{uid}</code> — ثبت در {time_jalali}")

        if len(lines) <= 60:
            await bot.send_message(chat_id=chat_id, text="\n".join(lines))
        else:
            plain = [l.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "") for l in lines]
            with BytesIO() as f:
                f.write("\n".join(plain).encode("utf-8"))
                f.seek(0)
                await bot.send_document(
                    chat_id=chat_id,
                    document=BufferedInputFile(f.read(), filename="لیست_نهایی_حاضرین.txt"),
                    caption=f"📄 لیست کامل حاضرین (تعداد {total} نفر)"
                )

    data["active"] = None
    await save_attendance_data(data)

    task_key = f"reminder_{chat_id}"
    if task_key in _attendance_tasks:
        _attendance_tasks[task_key].cancel()
        del _attendance_tasks[task_key]

    await bot.send_message(
        chat_id=chat_id,
        text="⏰ <b>دوره‌ی حضور و غیاب به پایان رسید.</b>\n"
             "از تمام شرکت‌کنندگان سپاسگزاریم. تا دوره‌ی بعدی."
    )

# ---------- دستورات حضور و غیاب ----------
@dp.message(Command("attendance_start"))
async def cmd_attendance_start(message: Message):
    if not is_admin(message.from_user.id):
        return
    if message.chat.type not in ("group", "supergroup"):
        await message.answer("این دستور فقط در گروه قابل استفاده است.")
        return

    data = load_attendance_data()
    if data.get("active") is not None:
        await message.answer("یک دوره‌ی حضور و غیاب هم‌اکنون فعال است. ابتدا آن را با /attendance_end پایان دهید.")
        return

    text = (
        "📋 <b>ثبت حضور هفتگی</b>\n\n"
        "⚠️ این پیام یک <b>دورهٔ ۲۴ ساعته</b> برای شناسایی اعضای فعال است.\n"
        "اگر در گروه فعال هستید، حتماً روی دکمهٔ زیر کلیک کنید.\n\n"
        "🔴 <b>توجه:</b> اعضایی که نامشان در لیست نهایی نباشد، از گروه <b>حذف</b> خواهند شد.\n\n"
        "پس از پایان ۲۴ ساعت، لیست نهایی اعلام می‌شود."
    )
    try:
        sent_msg = await bot.send_message(
            chat_id=message.chat.id,
            text=text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="✅ من اینجام", callback_data="attendance:yes")]
                ]
            )
        )
    except Exception as e:
        logger.error("خطا در ارسال پیام حضور: %s", e)
        await message.answer("خطا در ارسال پیام حضور.")
        return

    active_data = {
        "started_at": datetime.utcnow().isoformat(),
        "message_id": sent_msg.message_id,
        "chat_id": message.chat.id,
        "participants": [],
        "reminder_count": 0,
        "last_reminder_message_id": None,
    }
    data["active"] = active_data
    await save_attendance_data(data)

    task_key = f"reminder_{message.chat.id}"
    if task_key in _attendance_tasks:
        _attendance_tasks[task_key].cancel()
    task = asyncio.create_task(_attendance_reminder_task(message.chat.id, sent_msg.message_id))
    _attendance_tasks[task_key] = task

    await message.answer("✅ دوره‌ی حضور و غیاب شروع شد. اولین یادآوری ۳ ساعت دیگر ارسال می‌شود.")

@dp.message(Command("attendance_status"))
async def cmd_attendance_status(message: Message):
    if not is_admin(message.from_user.id):
        return
    data = load_attendance_data()
    active = data.get("active")
    if active is None:
        await message.answer("هیچ دوره‌ی فعالی وجود ندارد.")
        return

    started = format_jalali_datetime(datetime.fromisoformat(active["started_at"]))
    participants_count = len(active["participants"])
    reminder_count = active.get("reminder_count", 0)
    remaining = 8 - reminder_count
    if remaining < 0:
        remaining = 0
    await message.answer(
        f"📊 <b>وضعیت حضور و غیاب</b>\n\n"
        f"⏰ شروع: <code>{started}</code>\n"
        f"👤 شرکت‌کنندگان: <b>{participants_count}</b> نفر\n"
        f"🔔 تعداد یادآوری‌های ارسال‌شده: <b>{reminder_count}</b>\n"
        f"⏳ یادآوری‌های باقی‌مانده: <b>{remaining}</b>"
    )

@dp.message(Command("attendance_end"))
async def cmd_attendance_end(message: Message):
    if not is_admin(message.from_user.id):
        return
    data = load_attendance_data()
    if data.get("active") is None:
        await message.answer("هیچ دوره‌ی فعالی برای پایان دادن وجود ندارد.")
        return

    task_key = f"reminder_{message.chat.id}"
    if task_key in _attendance_tasks:
        _attendance_tasks[task_key].cancel()
        del _attendance_tasks[task_key]

    data["active"] = None
    await save_attendance_data(data)
    await message.answer("✅ دوره‌ی حضور و غیاب به‌صورت دستی پایان یافت.")

@dp.message(Command("attendance_report"))
async def cmd_attendance_report(message: Message):
    if not is_admin(message.from_user.id):
        return
    data = load_attendance_data()
    active = data.get("active")
    if active is None:
        await message.answer("هیچ دوره‌ی فعالی وجود ندارد.")
        return

    participants = active.get("participants", [])
    if not participants:
        await message.answer("📋 تا الان کسی حضور خود را ثبت نکرده است.")
        return

    lines = [
        f"📋 <b>لیست حاضرین در دوره‌ی حضور و غیاب</b>\n"
        f"تعداد کل: <b>{len(participants)}</b> نفر\n\n"
        "<b>👤 شرکت‌کنندگان:</b>"
    ]
    for p in participants:
        uid = p["user_id"]
        time_jalali = p.get("time", "نامشخص")
        try:
            member = await bot.get_chat_member(GROUP_CHAT_ID, uid)
            name = member.user.full_name or str(uid)
            username = f" @{member.user.username}" if member.user.username else ""
            lines.append(f"• {name} (ID: <code>{uid}</code>){username} — ثبت در {time_jalali}")
        except Exception:
            lines.append(f"• کاربر با آیدی <code>{uid}</code> — ثبت در {time_jalali}")

    if len(lines) <= 50:
        await message.answer("\n".join(lines))
    else:
        plain = [l.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "") for l in lines]
        with BytesIO() as f:
            f.write("\n".join(plain).encode("utf-8"))
            f.seek(0)
            await message.answer_document(
                BufferedInputFile(f.read(), filename="لیست_حاضرین.txt"),
                caption=f"📄 لیست کامل حاضرین (تعداد {len(participants)} نفر)"
            )

@dp.callback_query(F.data == "attendance:yes")
async def cb_attendance_yes(callback: CallbackQuery):
    user_id = callback.from_user.id
    data = load_attendance_data()
    active = data.get("active")
    if active is None:
        await callback.answer("دوره‌ی حضور و غیاب فعال نیست.", show_alert=True)
        return

    for p in active["participants"]:
        if p["user_id"] == user_id:
            await callback.answer("✅ حضور شما قبلاً ثبت شده است.")
            return

    now_utc = datetime.utcnow()
    time_jalali = format_jalali_datetime(now_utc)
    active["participants"].append({"user_id": user_id, "time": time_jalali})
    await save_attendance_data(data)
    await callback.answer("✅ حضور شما ثبت شد.", show_alert=False)

# ---------- بازیابی دوره در استارتاپ ----------
async def restore_attendance_tasks():
    data = load_attendance_data()
    active = data.get("active")
    if not active:
        return
    chat_id = active["chat_id"]
    message_id = active["message_id"]
    started_at = datetime.fromisoformat(active["started_at"])
    now = datetime.utcnow()
    elapsed = (now - started_at).total_seconds()

    if elapsed >= 24 * 3600:
        await _finish_attendance(chat_id)
        return

    reminder_count = active.get("reminder_count", 0)
    if reminder_count < 8:
        next_reminder_seconds = (reminder_count + 1) * 3 * 3600 - elapsed
        if next_reminder_seconds < 0:
            next_reminder_seconds = 0
        async def delayed_start():
            await asyncio.sleep(next_reminder_seconds)
            await _attendance_reminder_task(chat_id, message_id)
        task = asyncio.create_task(delayed_start())
        _attendance_tasks[f"reminder_{chat_id}"] = task
        logger.info("دوره‌ی حضور و غیاب بازیابی شد. یادآوری بعدی در %s ثانیه.", next_reminder_seconds)
    else:
        remaining_to_end = 24 * 3600 - elapsed
        if remaining_to_end > 0:
            async def delayed_end():
                await asyncio.sleep(remaining_to_end)
                await _finish_attendance(chat_id)
            task = asyncio.create_task(delayed_end())
            _attendance_tasks[f"reminder_{chat_id}"] = task
            logger.info("تسک پایان دوره بازیابی شد. پایان در %s ثانیه.", remaining_to_end)

# ==============================================================
#  ارسال پیام مستقیم به کاربر (از پنل ادمین - دو مرحله‌ای)
# ==============================================================
class AdminSendMsgStates(StatesGroup):
    waiting_for_identifier = State()
    waiting_for_message = State()

@dp.callback_query(F.data == "admin:sendmsg")
async def cb_admin_sendmsg_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await state.set_state(AdminSendMsgStates.waiting_for_identifier)
    await callback.message.edit_text(
        "📨 <b>ارسال پیام مستقیم</b>\n\n"
        "شناسهٔ کاربر را وارد کنید (آیدی عددی یا @username):\n"
        "مثال: 123456789  یا  @Ali_Arch",
        reply_markup=admin_back_keyboard()
    )
    await callback.answer()

@dp.message(AdminSendMsgStates.waiting_for_identifier)
async def admin_sendmsg_identifier(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    identifier = message.text.strip()
    if not identifier:
        await message.answer("لطفاً یک شناسه معتبر وارد کنید.")
        return

    # بررسی دستور لغو
    if identifier.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    user_id = None
    if identifier.isdigit():
        user_id = int(identifier)
    else:
        username = identifier.lstrip('@')
        try:
            chat = await bot.get_chat(f"@{username}")
            user_id = chat.id
        except Exception as e:
            await message.answer(f"❌ کاربر @{username} پیدا نشد. خطا: {e}\nلطفاً دوباره وارد کنید.")
            return

    # دریافت اطلاعات کاربر
    try:
        user = await bot.get_chat(user_id)
        display = user.full_name or str(user_id)
        await state.update_data(target_user_id=user_id, target_user_display=display)
        await message.answer(
            f"👤 کاربر: <b>{html_escape(display)}</b> (آیدی: <code>{user_id}</code>)\n\n"
            "حالا <b>متن پیام</b> را وارد کنید:",
            reply_markup=admin_back_keyboard()
        )
        await state.set_state(AdminSendMsgStates.waiting_for_message)
    except Exception as e:
        await message.answer(f"❌ خطا در دریافت اطلاعات کاربر: {e}")

@dp.message(AdminSendMsgStates.waiting_for_message)
async def admin_sendmsg_text(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    text = message.text
    if not text:
        await message.answer("لطفاً یک متن وارد کنید.")
        return

    if text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    data = await state.get_data()
    user_id = data.get("target_user_id")
    display = data.get("target_user_display", "کاربر")
    if not user_id:
        await message.answer("خطا: کاربر مشخص نیست.")
        await state.clear()
        return

    try:
        await bot.send_message(chat_id=user_id, text=text)
        await message.answer(f"✅ پیام به <b>{html_escape(display)}</b> ارسال شد.")
    except Exception as e:
        await message.answer(f"❌ خطا در ارسال پیام: {e}")
    await state.clear()

# ==============================================================
#  خاموش/روشن کردن ربات (دکمه)
# ==============================================================
@dp.callback_query(F.data == "admin:toggle_bot")
async def cb_admin_toggle_bot(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    state_data = load_bot_state()
    new_enabled = not state_data.get("enabled", True)
    state_data["enabled"] = new_enabled
    await save_bot_state(state_data)

    status_text = "روشن ✅" if new_enabled else "خاموش 🔴"
    await callback.answer(f"ربات {status_text} شد.")

    await callback.message.edit_text(
        f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}",
        reply_markup=admin_panel_keyboard()
    )

    if new_enabled:
        # پردازش صف در پس‌زمینه
        asyncio.create_task(process_pending_requests())

# ==============================================================
#  اعتبارسنجی initData و دریافت فرم (وب‌هوک)
# ==============================================================

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

# ---------- مسیر سلامت و پینگ خودکار ----------
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

# ---------- راه‌اندازی وب‌سرور ----------
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
        menu_button=MenuButtonWebApp(text="mini app", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    logger.info("Menu Button روی مینی‌اپ تنظیم شد.")

    # بازیابی دوره‌ی حضور و غیاب
    await restore_attendance_tasks()

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