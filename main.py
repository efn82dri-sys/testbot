# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «تایید عضویت» — مرجع فایل‌های معماری و عمران
====================================================================

تغییرات جدید:
- پیام درخواست شماره تلفن به‌روزرسانی شد با لحن اعتمادآمیز و مختصر
- اضافه شدن سیستم حضور و غیاب هفتگی با دکمه‌ی شیشه‌ای (WebApp) داخل گروه
- خروجی لیست اعضای غیرفعال در پایان هر هفته برای ادمین
- قابلیت حذف اعضای غیرفعال از گروه (با تأیید ادمین)
- پیش‌نمایش مراحل فرم عضویت در پنل مدیریت
====================================================================
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
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
ATTENDANCE_WEBAPP_URL = f"{WEBHOOK_HOST}/webapp/attendance.html"
PORT = int(os.environ.get("PORT", 8080))
PING_INTERVAL_SECONDS = int(os.environ.get("PING_INTERVAL_SECONDS", 10 * 60))
ATTENDANCE_CHECK_INTERVAL_SECONDS = 3600  # هر یک ساعت بررسی کن

DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)
STATS_FILE = Path(__file__).parent / "data" / "stats.json"
PHONES_FILE = Path(__file__).parent / "data" / "phones.json"
ATTENDANCE_FILE = Path(__file__).parent / "data" / "attendance.json"

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


# ==============================================================
# مدیریت حضور و غیاب (Attendance)
# ==============================================================

def load_attendance_data() -> dict:
    """بارگذاری داده‌های حضور و غیاب."""
    if not ATTENDANCE_FILE.exists():
        return {"weeks": {}, "current_week": None}
    try:
        return json.loads(ATTENDANCE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"weeks": {}, "current_week": None}


async def save_attendance_data(data: dict) -> None:
    """ذخیره‌ی داده‌های حضور و غیاب."""
    async with _write_lock:
        ATTENDANCE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_iso_week_number(dt: datetime) -> str:
    """بازگرداندن شماره‌ی هفته به فرمت YYYY-Www."""
    return dt.strftime("%Y-W%W")


def get_week_start_end(week_key: str) -> tuple[datetime, datetime]:
    """بازگرداندن شروع و پایان یک هفته بر اساس کلید هفته."""
    year, week = week_key.split("-W")
    year = int(year)
    week = int(week)
    # محاسبه‌ی روز شروع هفته (دوشنبه)
    start = datetime.fromisocalendar(year, week, 1).replace(tzinfo=timezone.utc)
    end = start + timedelta(days=7)
    return start, end


def get_current_week_key() -> str:
    """بازگرداندن کلید هفته‌ی جاری (UTC)."""
    return get_iso_week_number(datetime.now(timezone.utc))


async def get_group_member_ids() -> list[int]:
    """گرفتن لیست آیدی تمام اعضای گروه (به‌صورت تدریجی)."""
    member_ids = []
    try:
        async for member in bot.get_chat_members(GROUP_CHAT_ID):
            if not member.user.is_bot:
                member_ids.append(member.user.id)
    except Exception as e:
        logger.warning("گرفتن لیست اعضای گروه ممکن نشد: %s", e)
    return member_ids


async def start_attendance_week() -> bool:
    """شروع یک هفته‌ی جدید برای حضور و غیاب. پیام در گروه ارسال می‌شود."""
    data = load_attendance_data()
    current_week = get_current_week_key()

    # اگر هفته‌ی جاری از قبل شروع شده، کاری نکن
    if data.get("current_week") == current_week:
        return False

    # بستن هفته‌ی قبلی (اگر وجود داشت)
    old_week = data.get("current_week")
    if old_week and old_week in data["weeks"]:
        data["weeks"][old_week]["status"] = "closed"

    # شروع هفته‌ی جدید
    start_dt, end_dt = get_week_start_end(current_week)
    data["weeks"][current_week] = {
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "records": {},
        "message_id": None,
        "status": "active",
    }
    data["current_week"] = current_week
    await save_attendance_data(data)

    # ارسال پیام حضور و غیاب در گروه
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ ثبت حضور این هفته",
                    web_app=WebAppInfo(url=ATTENDANCE_WEBAPP_URL),
                )
            ]
        ]
    )

    try:
        sent = await bot.send_message(
            chat_id=GROUP_CHAT_ID,
            text=(
                "🏛 <b>حضور و غیاب هفتگی رواق</b>\n\n"
                "سلام به همه‌ی ساکنانِ این رواق!\n"
                "برای اینکه بدانیم کدامیک از شما همچنان در این مسیر همراه ما هستید، "
                "لطفاً با کلیک روی دکمه‌ی زیر، حضور خود را ثبت کنید.\n\n"
                "⏳ این فرصت تا پایان هفته (یکشنبه شب) باز است.\n"
                "کسانی که تا آن زمان حضورشان را ثبت نکنند، <b>غیرفعال</b> محسوب می‌شوند."
            ),
            reply_markup=keyboard,
        )
        # ذخیره‌ی message_id برای پیگیری
        data = load_attendance_data()
        if current_week in data["weeks"]:
            data["weeks"][current_week]["message_id"] = sent.message_id
            await save_attendance_data(data)
        logger.info("پیام حضور و غیاب برای هفته‌ی %s در گروه ارسال شد.", current_week)
        return True
    except Exception as e:
        logger.error("ارسال پیام حضور و غیاب ممکن نشد: %s", e)
        return False


async def close_attendance_week(week_key: str) -> dict | None:
    """بستن هفته‌ی حضور و غیاب و بازگرداندن گزارش."""
    data = load_attendance_data()
    if week_key not in data["weeks"]:
        return None

    week = data["weeks"][week_key]
    if week["status"] == "closed":
        return None

    # بستن هفته
    week["status"] = "closed"
    await save_attendance_data(data)

    # دریافت لیست اعضای گروه
    member_ids = await get_group_member_ids()
    records = week.get("records", {})
    attended = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended]

    # ارسال گزارش به ادمین
    report = {
        "week_key": week_key,
        "start": week["start"],
        "end": week["end"],
        "total_members": len(member_ids),
        "attended_count": len(attended),
        "inactive_count": len(inactive),
        "inactive_ids": inactive,
        "attended_ids": list(attended),
    }
    return report


async def record_attendance(user_id: int) -> bool:
    """ثبت حضور یک کاربر در هفته‌ی جاری."""
    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        return False

    week = data["weeks"][current_week]
    if week["status"] != "active":
        return False

    # بررسی اینکه آیا کاربر قبلاً ثبت کرده
    uid_str = str(user_id)
    if uid_str in week["records"]:
        return False

    week["records"][uid_str] = datetime.now(timezone.utc).isoformat()
    await save_attendance_data(data)
    return True


def get_attendance_status(user_id: int) -> str | None:
    """بررسی وضعیت حضور کاربر در هفته‌ی جاری."""
    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        return None
    week = data["weeks"][current_week]
    if week["status"] != "active":
        return None
    uid_str = str(user_id)
    if uid_str in week["records"]:
        return "attended"
    return "pending"


# ==============================================================
# وضعیت‌های FSM
# ==============================================================

class BroadcastStates(StatesGroup):
    waiting_for_text = State()
    confirming = State()


class AdminStates(StatesGroup):
    waiting_for_delete_user_id = State()
    waiting_for_attendance_remove = State()


# ==============================================================
# توابع کمکی
# ==============================================================

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

    # اطلاعات حضور و غیاب هفتگی
    att_data = load_attendance_data()
    current_week = att_data.get("current_week")
    week_info = ""
    if current_week and current_week in att_data["weeks"]:
        week = att_data["weeks"][current_week]
        records_count = len(week.get("records", {}))
        week_info = f"\n✅ ثبت‌شده‌ی این هفته: <b>{records_count}</b> نفر"

    return (
        "📐 <b>گزارشِ وضعیتِ بنا (آمار لحظه‌ای)</b>\n\n"
        f"👥 ساکنینِ فعلی: <b>{member_count}</b>\n"
        f"📝 پروفایل‌های تکمیل‌شده (فرم): <b>{form_count}</b>\n"
        f"➕ کل ورودها از ابتدای ساماندهی: <b>{total_joined}</b>\n"
        f"➖ کل خروج‌ها: <b>{total_left}</b>\n"
        f"📉 نرخِ ریزشِ جمعیت: <b>{leave_rate:.1f}٪</b>"
        f"{week_info}\n\n"
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


# ==============================================================
# حذف اطلاعات کاربر
# ==============================================================

async def delete_user_data(user_id: int) -> tuple[bool, str]:
    uid_str = str(user_id)
    phones = load_phones()
    removed_phone = False
    if uid_str in phones:
        del phones[uid_str]
        async with _write_lock:
            PHONES_FILE.write_text(json.dumps(phones, ensure_ascii=False), encoding="utf-8")
        removed_phone = True

    removed_form = False
    if DATA_FILE.exists():
        lines = []
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    if int(record.get("user_id", 0)) == user_id:
                        removed_form = True
                        continue
                except (json.JSONDecodeError, ValueError):
                    pass
                lines.append(line)
        if removed_form:
            async with _write_lock:
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + ("\n" if lines else ""))

    if not removed_phone and not removed_form:
        return False, f"❌ کاربری با آیدی `{user_id}` در هیچ داده‌ای یافت نشد."

    msg = f"✅ اطلاعات کاربر `{user_id}` حذف شد."
    if removed_phone:
        msg += " (شماره تلفن)"
    if removed_form:
        msg += " (فرم عضویت)"
    return True, msg


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


# ==============================================================
# صفحه‌کلیدهای مدیریت (با دکمه‌های جدید)
# ==============================================================

def admin_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 آمار گروه", callback_data="admin:stats")],
            [InlineKeyboardButton(text="📈 آمار تفصیلیِ فرم‌ها", callback_data="admin:stats_detail")],
            [InlineKeyboardButton(text="📄 خروجی اکسل (همه‌ی تأییدشده‌ها)", callback_data="admin:export")],
            [InlineKeyboardButton(text="📢 ارسال پیام همگانی", callback_data="admin:broadcast")],
            [InlineKeyboardButton(text="🗑 حذف کاربر", callback_data="admin:delete_user")],
            [InlineKeyboardButton(text="👥 حضور و غیاب", callback_data="admin:attendance_menu")],
            [InlineKeyboardButton(text="👁 پیش‌نمایش مراحل فرم", callback_data="admin:preview_steps")],
            [InlineKeyboardButton(text="❌ بستن", callback_data="admin:close")],
        ]
    )


def admin_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")]]
    )


# ==============================================================
# دستورات
# ==============================================================

@dp.message(Command("start"))
async def handle_start(message: Message):
    await message.answer(
        "به رواق خوش آمدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
        "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
        "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم."
    )


@dp.message(Command("help"))
async def handle_help(message: Message):
    await message.answer(
        "📚 <b>راهنما و پشتیبانی</b>\n\n"
        "برای ارتباط با مدیریت رواق، کافیست پیام خود را در همین چت بنویسید. "
        "پیام شما به‌طور خودکار به ادمین‌ها ارسال می‌شود و آنها در اسرع وقت پاسخ می‌دهند.\n\n"
        "🔹 دستورات موجود:\n"
        "/start - شروع مجدد\n"
        "/help - نمایش این راهنما\n"
        "/admin - پنل مدیریت (فقط ادمین‌ها)\n\n"
        "اگر سوال یا مشکلی دارید، پیام خود را بنویسید تا به ادمین برسد."
    )


def phone_request_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 اشتراک‌گذاری شماره تلفن", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


# ==============================================================
# درخواست عضویت — پیام به‌روزرسانی‌شده
# ==============================================================

@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

    if get_saved_phone(user.id):
        await send_vpn_warning_and_form(user)
        return

    # پیام به‌روزرسانی‌شده با لحن اعتمادآمیز و مختصر
    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"سلام {user.first_name} عزیز.\n\n"
                "طبق سیاست‌های جدید تلگرام و برای جلوگیری از ورود ربات‌های خودکار، "
                "احراز هویت با شماره تلفن الزامی است.\n"
                "لطفاً شماره‌ی خود را با دکمه‌ی پایین صفحه به اشتراک بگذارید.\n\n"
                "🔒 این شماره فقط برای تأیید هویت شما استفاده می‌شود و نزد ما محفوظ است."
            ),
            reply_markup=phone_request_keyboard(),
        )
    except Exception as e:
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)


# ==============================================================
# دریافت شماره تلفن و ارسال VPN + فرم
# ==============================================================

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


# ==============================================================
# رویداد تغییر وضعیت عضو
# ==============================================================

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


# ==============================================================
# پنل مدیریت
# ==============================================================

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


# ==============================================================
# دستور /delete_user
# ==============================================================

@dp.message(Command("delete_user"))
async def handle_delete_user(message: Message, command: CommandObject):
    if not is_admin(message.from_user.id):
        return
    args = (command.args or "").strip()
    if not args:
        await message.answer(
            "⚠️ لطفاً آیدی عددی کاربر را مشخص کنید:\n"
            "<code>/delete_user 123456789</code>"
        )
        return
    try:
        user_id = int(args)
    except ValueError:
        await message.answer("❌ آیدی باید یک عدد صحیح باشد.")
        return
    ok, msg = await delete_user_data(user_id)
    await message.answer(msg)


# ==============================================================
# حضور و غیاب — دستورات ادمین
# ==============================================================

@dp.message(Command("attendance_start"))
async def handle_attendance_start(message: Message):
    """شروع دستی هفته‌ی حضور و غیاب."""
    if not is_admin(message.from_user.id):
        return
    result = await start_attendance_week()
    if result:
        await message.answer("✅ هفته‌ی حضور و غیاب با موفقیت شروع شد.")
    else:
        await message.answer("⚠️ هفته‌ی حضور و غیاب از قبل فعال است یا مشکلی پیش آمد.")


@dp.message(Command("attendance_report"))
async def handle_attendance_report(message: Message):
    """دریافت گزارش هفته‌ی جاری."""
    if not is_admin(message.from_user.id):
        return

    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        await message.answer("هیچ هفته‌ی فعالی برای حضور و غیاب وجود ندارد.")
        return

    week = data["weeks"][current_week]
    records = week.get("records", {})
    attended_count = len(records)

    # دریافت لیست اعضای گروه
    member_ids = await get_group_member_ids()
    attended_set = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended_set]

    report = (
        f"📋 <b>گزارش حضور و غیاب — هفته‌ی {current_week}</b>\n\n"
        f"👥 کل اعضای گروه: <b>{len(member_ids)}</b>\n"
        f"✅ ثبت‌شده: <b>{attended_count}</b>\n"
        f"❌ ثبت‌نشده: <b>{len(inactive)}</b>\n\n"
        f"<i>برای دریافت لیست کامل افرادی که ثبت نکرده‌اند، روی دکمه‌ی «لیست غایبان» در پنل کلیک کنید.</i>"
    )

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📋 لیست غایبان", callback_data="admin:attendance_list")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")],
        ]
    )
    await message.answer(report, reply_markup=keyboard)


@dp.message(Command("attendance_remove"))
async def handle_attendance_remove(message: Message, state: FSMContext):
    """حذف اعضای غیرفعال (با تأیید)."""
    if not is_admin(message.from_user.id):
        return

    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        await message.answer("هیچ هفته‌ی فعالی برای حضور و غیاب وجود ندارد.")
        return

    week = data["weeks"][current_week]
    records = week.get("records", {})
    member_ids = await get_group_member_ids()
    attended_set = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended_set]

    if not inactive:
        await message.answer("✅ همه‌ی اعضای گروه در این هفته حضور ثبت کرده‌اند. کسی برای حذف وجود ندارد.")
        return

    await state.set_state(AdminStates.waiting_for_attendance_remove)
    await state.update_data(inactive_list=inactive)

    # نمایش چند نمونه از کاربران
    sample = inactive[:5]
    sample_text = "\n".join([f"• `{uid}`" for uid in sample])
    if len(inactive) > 5:
        sample_text += f"\n• ... و {len(inactive) - 5} نفر دیگر"

    await message.answer(
        f"⚠️ <b>حذف اعضای غیرفعال</b>\n\n"
        f"<b>{len(inactive)}</b> نفر در این هفته حضور ثبت نکرده‌اند.\n\n"
        f"نمونه:\n{sample_text}\n\n"
        "برای تأیید حذف این افراد از گروه، دستور زیر را بفرستید:\n"
        "<code>/confirm_remove</code>\n\n"
        "برای لغو، دستور /cancel را بفرستید."
    )


@dp.message(Command("confirm_remove"), AdminStates.waiting_for_attendance_remove)
async def handle_confirm_remove(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    data = await state.get_data()
    inactive_list = data.get("inactive_list", [])
    await state.clear()

    if not inactive_list:
        await message.answer("لیست خالی است.")
        return

    removed = 0
    failed = 0
    for uid in inactive_list:
        try:
            await bot.ban_chat_member(chat_id=GROUP_CHAT_ID, user_id=uid)
            removed += 1
            await asyncio.sleep(0.3)  # جلوگیری از محدودیت
        except Exception as e:
            logger.warning("حذف کاربر %s ممکن نشد: %s", uid, e)
            failed += 1

    await message.answer(
        f"✅ عملیات حذف کامل شد.\n"
        f"موفق: <b>{removed}</b>\n"
        f"ناموفق: <b>{failed}</b>"
    )


# ==============================================================
# دکمه‌های پنل مدیریت
# ==============================================================

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
        await callback.message.answer("هنوز هیچ کاربری شماره‌اش را تأیید نکرده است.")
        return
    await callback.message.answer_document(file, caption="📄 خروجی اکسل همه‌ی تأییدشده‌ها")


# ==============================================================
# برادکست با پشتیبانی از مدیا
# ==============================================================

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


# ==============================================================
# حذف کاربر از طریق پنل مدیریت
# ==============================================================

@dp.callback_query(F.data == "admin:delete_user")
async def cb_admin_delete_user(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await state.set_state(AdminStates.waiting_for_delete_user_id)
    await callback.message.edit_text(
        "🗑 <b>حذف کاربر</b>\n\n"
        "لطفاً آیدی عددی کاربر مورد نظر را در یک پیام جداگانه ارسال کنید.\n"
        "مثال: <code>123456789</code>\n\n"
        "برای لغو، دستور /cancel را بفرستید.",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()


@dp.message(AdminStates.waiting_for_delete_user_id)
async def handle_delete_user_id_input(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = (message.text or "").strip()
    if not text:
        await message.answer("لطفاً یک آیدی عددی وارد کنید.")
        return
    if text.startswith("/"):
        await state.clear()
        await message.answer("عملیات لغو شد.", reply_markup=admin_panel_keyboard())
        return
    try:
        user_id = int(text)
    except ValueError:
        await message.answer("❌ آیدی باید عددی باشد. دوباره تلاش کنید یا /cancel بزنید.")
        return
    ok, msg = await delete_user_data(user_id)
    await message.answer(msg)
    await state.clear()
    await message.answer(
        "🛠 بازگشت به پنل مدیریت",
        reply_markup=admin_panel_keyboard()
    )


# ==============================================================
# حضور و غیاب — دکمه‌های پنل
# ==============================================================

@dp.callback_query(F.data == "admin:attendance_menu")
async def cb_admin_attendance_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📢 شروع هفته‌ی جدید", callback_data="admin:attendance_start")],
            [InlineKeyboardButton(text="📋 گزارش هفته‌ی جاری", callback_data="admin:attendance_report")],
            [InlineKeyboardButton(text="🗑 حذف غایبان", callback_data="admin:attendance_remove")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")],
        ]
    )
    await callback.message.edit_text(
        "👥 <b>مدیریت حضور و غیاب</b>\n\n"
        "از این بخش می‌توانید هفته‌ی جدید را شروع کنید، گزارش بگیرید "
        "و اعضای غیرفعال را حذف کنید.",
        reply_markup=keyboard,
    )
    await callback.answer()


@dp.callback_query(F.data == "admin:attendance_start")
async def cb_admin_attendance_start(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await callback.answer("⏳ در حال شروع...")
    result = await start_attendance_week()
    if result:
        await callback.message.edit_text(
            "✅ هفته‌ی حضور و غیاب با موفقیت شروع شد.\n"
            "پیام مربوطه در گروه ارسال گردید.",
            reply_markup=admin_back_keyboard(),
        )
    else:
        await callback.message.edit_text(
            "⚠️ هفته‌ی حضور و غیاب از قبل فعال است یا مشکلی پیش آمد.",
            reply_markup=admin_back_keyboard(),
        )


@dp.callback_query(F.data == "admin:attendance_report")
async def cb_admin_attendance_report(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        await callback.message.edit_text(
            "هیچ هفته‌ی فعالی برای حضور و غیاب وجود ندارد.",
            reply_markup=admin_back_keyboard(),
        )
        await callback.answer()
        return

    week = data["weeks"][current_week]
    records = week.get("records", {})
    attended_count = len(records)

    member_ids = await get_group_member_ids()
    attended_set = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended_set]

    report = (
        f"📋 <b>گزارش حضور و غیاب — هفته‌ی {current_week}</b>\n\n"
        f"👥 کل اعضای گروه: <b>{len(member_ids)}</b>\n"
        f"✅ ثبت‌شده: <b>{attended_count}</b>\n"
        f"❌ ثبت‌نشده: <b>{len(inactive)}</b>"
    )

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📋 لیست غایبان", callback_data="admin:attendance_list")],
            [InlineKeyboardButton(text="🔙 بازگشت", callback_data="admin:attendance_menu")],
        ]
    )
    await callback.message.edit_text(report, reply_markup=keyboard)
    await callback.answer()


@dp.callback_query(F.data == "admin:attendance_list")
async def cb_admin_attendance_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        await callback.answer("هیچ هفته‌ی فعالی وجود ندارد.")
        return

    week = data["weeks"][current_week]
    records = week.get("records", {})
    member_ids = await get_group_member_ids()
    attended_set = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended_set]

    if not inactive:
        await callback.message.edit_text(
            "✅ همه‌ی اعضای گروه در این هفته حضور ثبت کرده‌اند.",
            reply_markup=admin_back_keyboard(),
        )
        await callback.answer()
        return

    # نمایش لیست در چند پیام
    lines = [f"📋 <b>لیست غایبان — هفته‌ی {current_week}</b>\n\n"]
    for uid in inactive:
        lines.append(f"• <code>{uid}</code>")
        if len("\n".join(lines)) > 3500:
            await callback.message.answer("\n".join(lines))
            lines = ["..."]

    if lines:
        await callback.message.answer("\n".join(lines))

    await callback.message.answer(
        "🔙 برای بازگشت به منوی حضور و غیاب، دکمه‌ی زیر را بزنید.",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🔙 بازگشت", callback_data="admin:attendance_menu")]
            ]
        )
    )
    await callback.answer()


@dp.callback_query(F.data == "admin:attendance_remove")
async def cb_admin_attendance_remove(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    data = load_attendance_data()
    current_week = data.get("current_week")
    if not current_week or current_week not in data["weeks"]:
        await callback.answer("هیچ هفته‌ی فعالی وجود ندارد.")
        return

    week = data["weeks"][current_week]
    records = week.get("records", {})
    member_ids = await get_group_member_ids()
    attended_set = set(int(uid) for uid in records.keys())
    inactive = [uid for uid in member_ids if uid not in attended_set]

    if not inactive:
        await callback.answer("✅ همه حضور ثبت کرده‌اند.")
        return

    await state.set_state(AdminStates.waiting_for_attendance_remove)
    await state.update_data(inactive_list=inactive)

    sample = inactive[:5]
    sample_text = "\n".join([f"• `{uid}`" for uid in sample])
    if len(inactive) > 5:
        sample_text += f"\n• ... و {len(inactive) - 5} نفر دیگر"

    await callback.message.edit_text(
        f"⚠️ <b>حذف اعضای غیرفعال</b>\n\n"
        f"<b>{len(inactive)}</b> نفر در این هفته حضور ثبت نکرده‌اند.\n\n"
        f"نمونه:\n{sample_text}\n\n"
        "برای تأیید حذف این افراد از گروه، دستور زیر را بفرستید:\n"
        "<code>/confirm_remove</code>\n\n"
        "برای لغو، دستور /cancel را بفرستید.",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()


# ==============================================================
# پیش‌نمایش مراحل فرم
# ==============================================================

@dp.callback_query(F.data == "admin:preview_steps")
async def cb_admin_preview_steps(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return

    # شبیه‌سازی نمایش مراحل فرم
    preview = (
        "👁 <b>پیش‌نمایش مراحل فرم عضویت</b>\n\n"
        "🔹 <b>مرحله ۱ — مقطع تحصیلی</b>\n"
        "   دیپلم / پیش‌دانشگاهی\n"
        "   کاردانی\n"
        "   کارشناسی\n"
        "   کارشناسی ارشد\n"
        "   دکتری\n"
        "   سایر\n\n"
        "🔹 <b>مرحله ۲ — نحوه‌ی آشنایی</b>\n"
        "   اینستاگرام\n"
        "   معرفی دوستان\n"
        "   سایر گروه‌ها و کانال‌ها\n"
        "   جستجوی اینترنتی\n"
        "   سایر موارد\n\n"
        "🔹 <b>مرحله ۳ — علایق تخصصی</b>\n"
        "   انتخاب حداکثر ۳ مورد از:\n"
        "   اتاق پرامپت، فرصت‌های شغلی، پرزانته و پرتفولیو،\n"
        "   آکادمی آنلاین، کتابخانه و ضوابط ملی، رادیو معماری،\n"
        "   بانک پروژه، معماری جهان، فایل‌های گرافیکی،\n"
        "   دنیای نرم‌افزار و پلاگین، آبجکت و فمیلی، پلان و نقشه\n\n"
        "🔹 <b>مرحله ۴ — نتیجه</b>\n"
        "   پس از ارسال، کاربر پیام تایید یا خطا را می‌بیند.\n\n"
        "<i>این همان فرمی است که کاربران هنگام تکمیل عضویت می‌بینند.</i>"
    )

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")]
        ]
    )
    await callback.message.edit_text(preview, reply_markup=keyboard)
    await callback.answer()


# ==============================================================
# صندوق پیام اعضا
# ==============================================================

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
# اعتبارسنجی initData و دریافت فرم
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
        "submitted_at": datetime.now(timezone.utc).isoformat(),
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


# ==============================================================
# اندپوینت حضور و غیاب
# ==============================================================

async def handle_attendance(request: web.Request) -> web.Response:
    """ثبت حضور کاربر از طریق WebApp."""
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"ok": False, "error": "invalid_json"}, status=400)

    init_data = payload.get("initData", "")
    user = validate_init_data(init_data)
    if user is None:
        logger.warning("attendance: initData نامعتبر بود.")
        return web.json_response({"ok": False, "error": "invalid_init_data"}, status=403)

    user_id = user["id"]

    # بررسی اینکه آیا کاربر عضو گروه است
    try:
        member = await bot.get_chat_member(GROUP_CHAT_ID, user_id)
        if member.status not in (ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR):
            return web.json_response({"ok": False, "error": "not_member"}, status=403)
    except Exception:
        return web.json_response({"ok": False, "error": "not_member"}, status=403)

    # ثبت حضور
    success = await record_attendance(user_id)
    if success:
        return web.json_response({"ok": True, "status": "attended"})
    else:
        # ممکن است قبلاً ثبت کرده باشد یا هفته فعال نباشد
        status = get_attendance_status(user_id)
        if status == "attended":
            return web.json_response({"ok": True, "status": "already_attended"})
        return web.json_response({"ok": False, "error": "no_active_week"}, status=400)


# ==============================================================
# مسیر سلامت و پینگ خودکار
# ==============================================================

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


# ==============================================================
# وظیفه‌ی زمان‌بندی‌شده برای حضور و غیاب
# ==============================================================

async def attendance_scheduler_loop(app: web.Application) -> None:
    """بررسی هر ساعت برای شروع هفته‌ی جدید و بستن هفته‌ی قبلی."""
    while True:
        await asyncio.sleep(ATTENDANCE_CHECK_INTERVAL_SECONDS)
        try:
            data = load_attendance_data()
            current_week = get_current_week_key()
            last_week = data.get("current_week")

            # اگر هفته عوض شده باشد
            if last_week != current_week:
                # بستن هفته‌ی قبلی و گزارش به ادمین
                if last_week and last_week in data["weeks"]:
                    report = await close_attendance_week(last_week)
                    if report and report["inactive_ids"]:
                        # ارسال گزارش به ادمین‌ها
                        for admin_id in ADMIN_IDS:
                            try:
                                await bot.send_message(
                                    chat_id=admin_id,
                                    text=(
                                        f"📊 <b>گزارش پایان هفته‌ی حضور و غیاب</b>\n\n"
                                        f"هفته‌ی: {report['week_key']}\n"
                                        f"👥 کل اعضا: {report['total_members']}\n"
                                        f"✅ ثبت‌شده: {report['attended_count']}\n"
                                        f"❌ غایب: {report['inactive_count']}\n\n"
                                        f"برای مشاهده‌ی لیست غایبان و حذف آنها، از پنل مدیریت استفاده کنید."
                                    ),
                                    reply_markup=InlineKeyboardMarkup(
                                        inline_keyboard=[
                                            [InlineKeyboardButton(text="👥 رفتن به حضور و غیاب", callback_data="admin:attendance_menu")]
                                        ]
                                    )
                                )
                            except Exception as e:
                                logger.warning("ارسال گزارش به ادمین %s ممکن نشد: %s", admin_id, e)

                # شروع هفته‌ی جدید
                await start_attendance_week()

        except Exception as e:
            logger.error("خطا در scheduler حضور و غیاب: %s", e)


async def start_attendance_scheduler(app: web.Application) -> None:
    app["attendance_scheduler_task"] = asyncio.create_task(attendance_scheduler_loop(app))


async def stop_attendance_scheduler(app: web.Application) -> None:
    task = app.get("attendance_scheduler_task")
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# ==============================================================
# راه‌اندازی وب‌سرور
# ==============================================================

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

    # یک بار در ابتدا سعی کن هفته‌ی جاری را شروع کنی (اگر قبلاً شروع نشده)
    data = load_attendance_data()
    current_week = get_current_week_key()
    if data.get("current_week") != current_week:
        logger.info("شروع هفته‌ی حضور و غیاب در زمان راه‌اندازی...")
        await start_attendance_week()


def create_app() -> web.Application:
    app = web.Application()

    webapp_dir = Path(__file__).parent / "webapp"
    app.router.add_static("/webapp/", path=str(webapp_dir), show_index=False)
    app.router.add_post("/api/submit", handle_submit)
    app.router.add_post("/api/attendance", handle_attendance)
    app.router.add_get("/health", handle_health)

    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_startup.append(start_self_ping)
    app.on_startup.append(start_attendance_scheduler)
    app.on_cleanup.append(stop_self_ping)
    app.on_cleanup.append(stop_attendance_scheduler)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)