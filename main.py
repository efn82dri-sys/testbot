# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «رواق» — مرجع فایل‌های معماری و عمران
====================================================================
نسخهٔ نهایی با اصلاحات:
- رفع باگ تشخیص عضویت (is_user_member)
- سیستم حضور و غیاب با خروجی اکسل و ارسال فقط به ادمین
- مدیریت محتوا با قابلیت حذف اطلاعیه‌ها و سوالات
- دکمهٔ «دعوت از دوستان» در پنل کاربری
- اسپینر لودینگ در فرم و رفع باگ تیک قوانین
- حذفِ احرازِ هویت با شماره تلفن، جایگزینی با تستِ ضدربات (دکمه‌های چندگزینه‌ای)
- حذفِ مینی‌اپِ وب، جایگزینی با فرمِ پذیرشِ تماماً دکمه‌ای (پنل شیشه‌ای)
- متن‌های شخصی‌سازی‌شده با نامِ کاربر و جزئیاتِ پویا (رتبه‌ی عضویت و ...)
"""

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timedelta
from html import escape as html_escape
from io import BytesIO
from pathlib import Path

import jdatetime
import pytz
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ParseMode
from aiogram.filters import Command, CommandObject, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    ChatJoinRequest,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    PollAnswer,
    Update,
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

# شناسه‌ی افکت انیمیشنیِ 🎉 (Add an animated effect)
# نکته‌ی مهم: message_effect_id فقط توی sendMessage/sendPhoto و... کار می‌کند،
# روی editMessageText اثری ندارد و توسط تلگرام نادیده گرفته می‌شود.
# همچنین این افکت‌ها فقط در چت خصوصی (private) قابل نمایش‌اند، نه در گروه.
MESSAGE_EFFECT_PARTY_POPPER = "5046509860389126442"  # 🎉
GROUP_INVITE_LINK = os.environ.get("GROUP_INVITE_LINK", "")
NOTIFY_CHAT_ID = os.environ.get("NOTIFY_CHAT_ID", "").strip()
ADMIN_IDS = {
    int(x) for x in os.environ.get("ADMIN_IDS", "").replace(" ", "").split(",") if x
}
WEBHOOK_HOST = os.environ["WEBHOOK_HOST"].rstrip("/")
WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"
PORT = int(os.environ.get("PORT", 8080))
PING_INTERVAL_SECONDS = int(os.environ.get("PING_INTERVAL_SECONDS", 10 * 60))

DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)
STATS_FILE = Path(__file__).parent / "data" / "stats.json"
VERIFIED_FILE = Path(__file__).parent / "data" / "verified_humans.json"
FUNNEL_USERS_FILE = Path(__file__).parent / "data" / "funnel_users.json"
ATTENDANCE_FILE = Path(__file__).parent / "data" / "attendance.json"
BOT_STATE_FILE = Path(__file__).parent / "data" / "bot_state.json"
MENU_CONFIG_FILE = Path(__file__).parent / "data" / "menu_config.json"

REFERRAL_LABELS = {
    "instagram": "📷 اینستاگرام",
    "friends": "👥 معرفی دوستان",
    "other_groups": "💬 سایر گروه‌ها و کانال‌ها",
    "search": "🔍 جستجوی اینترنتی",
    "other": "✨ سایر موارد",
}

EDUCATION_OPTIONS: list[tuple[str, str]] = [
    ("diploma", "دیپلم / پیش‌دانشگاهی"),
    ("associate", "کاردانی"),
    ("bachelor", "کارشناسی"),
    ("master", "کارشناسی ارشد"),
    ("phd", "دکتری"),
    ("other", "سایر"),
]

INTERESTS: list[str] = [
    "اتاق پرامپت",
    "فرصت‌های شغلی",
    "پرزانته و پرتفولیو",
    "آکادمی آنلاین",
    "کتابخانه و ضوابط ملی",
    "رادیو معماری",
    "بانک پروژه",
    "معماری جهان",
    "فایل‌های گرافیکی",
    "دنیای نرم‌افزار و پلاگین",
    "آبجکت، فمیلی و متریال",
    "پلان و نقشه‌های اجرایی",
]
MAX_INTERESTS = 3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

storage = MemoryStorage()
bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher(storage=storage)

_write_lock = asyncio.Lock()
_pending_leave_polls: dict[str, int] = {}
_pending_admin_replies: dict[int, int] = {}
_attendance_tasks: dict[str, asyncio.Task] = {}
_user_cache: dict[str, dict] = {}

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

def load_verified() -> dict:
    if not VERIFIED_FILE.exists():
        return {}
    try:
        return json.loads(VERIFIED_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

async def mark_verified(user_id: int) -> None:
    async with _write_lock:
        verified = load_verified()
        verified[str(user_id)] = datetime.utcnow().isoformat()
        VERIFIED_FILE.write_text(json.dumps(verified, ensure_ascii=False), encoding="utf-8")

def is_verified(user_id: int) -> bool:
    return str(user_id) in load_verified()

# ---------- کاربرانِ واردشده به قیف (استارت ربات یا درخواست عضویت) ----------
def load_funnel_users() -> set[int]:
    if not FUNNEL_USERS_FILE.exists():
        return set()
    try:
        return set(json.loads(FUNNEL_USERS_FILE.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        return set()

async def mark_funnel_entry(user_id: int) -> None:
    """کاربر را به‌عنوان یکی از ورودی‌های قیف ثبت می‌کند (استارت ربات یا
    پیامی که به‌خاطر درخواست عضویت برایش ارسال شده). هر کاربر فقط یک‌بار
    شمرده می‌شود، حتی اگر چندبار استارت بزند."""
    async with _write_lock:
        users = load_funnel_users()
        if user_id in users:
            return
        users.add(user_id)
        FUNNEL_USERS_FILE.write_text(json.dumps(list(users)), encoding="utf-8")

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

async def is_user_member(user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(GROUP_CHAT_ID, user_id)
        return member.status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR]
    except Exception:
        return False

def is_form_completed(user_id: int) -> bool:
    return str(user_id) in _user_cache

def cache_users():
    if not DATA_FILE.exists():
        return
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                _user_cache[str(record["user_id"])] = record
            except (json.JSONDecodeError, KeyError):
                continue

cache_users()

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
    funnel_count = len(load_funnel_users())
    verified_count = len(load_verified())
    form_joined_count = stats.get("form_completed_and_joined", 0)

    # نرخ افت هر مرحله نسبت به مرحله‌ی قبل، برای اینکه ادمین سریع بفهمد
    # بیشترین ریزشِ کاربر کجای مسیر (قیف) اتفاق می‌افتد.
    verified_rate = (verified_count / funnel_count * 100) if funnel_count else 0
    joined_rate = (form_joined_count / verified_count * 100) if verified_count else 0

    return (
        "📐 <b>داشبورد رواق (آمار لحظه‌ای)</b>\n\n"
        f"👥 ساکنینِ فعلی گروه: <b>{member_count}</b>\n\n"
        "<b>قیفِ عضویت:</b>\n"
        f"1️⃣ استارت ربات / پیامِ درخواست عضویت: <b>{funnel_count}</b>\n"
        f"2️⃣ تاییدِ عدمِ ربات‌بودن: <b>{verified_count}</b> ({verified_rate:.0f}٪)\n"
        f"3️⃣ فرمِ تکمیل‌شده + ورود به گروه: <b>{form_joined_count}</b> ({joined_rate:.0f}٪)\n\n"
        f"📝 کل فرم‌های ثبت‌شده (شامل موارد تأییدنشده): <b>{form_count}</b>\n\n"
        "<i>این آمار از زمانی که دروازه‌ی الکترونیکی نصب شده، ثبت می‌شود.</i>"
    )

async def build_admin_dashboard_text() -> str:
    status_text = "روشن ✅" if load_bot_state().get("enabled", True) else "خاموش 🔴"
    stats_text = await build_stats_text()
    return f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}\n\n{stats_text}"

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
    verified = load_verified()
    if not verified and not DATA_FILE.exists():
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

    all_user_ids = set(verified.keys()) | set(form_records.keys())
    if not all_user_ids:
        return None

    rows = []
    for uid_str in all_user_ids:
        try:
            uid_int = int(uid_str)
        except ValueError:
            continue
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
            submitted_at[:16] if submitted_at else "-",
            education,
            referral,
            interests_str,
            form_status,
        ])

    rows.sort(key=lambda r: (r[3] == "-", r[3]), reverse=False)

    headers = [
        "آیدی عددی",
        "نام کاربری",
        "نام کامل",
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

# ---------- مدیریت منوی پویا ----------
def migrate_menu_config(config: dict) -> dict:
    if "menu_items" not in config:
        config["menu_items"] = {}
    if "settings" not in config:
        config["settings"] = {}

    if "join" in config["menu_items"]:
        if config["menu_items"]["join"].get("label") == "📝 عضویت در گروه":
            config["menu_items"]["join"]["label"] = "👥 دعوت از دوستان"

    defaults = {
        "join": {"label": "👥 دعوت از دوستان", "response": "🔗 لینک دعوت گروه:\n{invite_link}"},
        "topics": {"label": "📚 راهنمای تایپیک‌ها", "response": "لطفاً یکی از تایپیک‌های زیر را انتخاب کنید:"},
        "contact_admin": {"label": "📞 ارتباط با ادمین", "response": "پیام خود را تایپ کنید تا برای ادمین ارسال شود."},
        "my_status": {"label": "📊 وضعیت عضویت من", "response": "وضعیت شما: {status}"},
        "announcements": {"label": "📢 اطلاعیه‌های جدید", "response": "آخرین اطلاعیه‌ها:\n{announcements}"},
        "faq": {"label": "❓ سوالات متداول", "response": "سوالات پرتکرار:\n{faq_list}"},
        "social": {"label": "🌐 شبکه‌های اجتماعی", "response": "ما را دنبال کنید:\nاینستاگرام: {instagram}\nکانال: {channel}"},
    }
    for key, val in defaults.items():
        if key not in config["menu_items"]:
            config["menu_items"][key] = val
        else:
            if key == "join":
                config["menu_items"][key]["label"] = defaults[key]["label"]
                config["menu_items"][key]["response"] = defaults[key]["response"]

    if "settings" not in config:
        config["settings"] = {}
    settings_defaults = {
        "group_invite_link": GROUP_INVITE_LINK,
        "announcements": [],
        "announcement_files": [],
        "faq": [],
        "faq_files": [],
        "social": {
            "instagram": "https://www.instagram.com/archit.ir/",
            "channel": "https://t.me/irarchit"
        }
    }
    for key, val in settings_defaults.items():
        if key not in config["settings"]:
            config["settings"][key] = val

    return config

def load_menu_config() -> dict:
    if not MENU_CONFIG_FILE.exists():
        default_config = {
            "menu_items": {
                "join": {"label": "👥 دعوت از دوستان", "response": "🔗 لینک دعوت گروه:\n{invite_link}"},
                "topics": {"label": "📚 راهنمای تایپیک‌ها", "response": "لطفاً یکی از تایپیک‌های زیر را انتخاب کنید:"},
                "contact_admin": {"label": "📞 ارتباط با ادمین", "response": "پیام خود را تایپ کنید تا برای ادمین ارسال شود."},
                "my_status": {"label": "📊 وضعیت عضویت من", "response": "وضعیت شما: {status}"},
                "announcements": {"label": "📢 اطلاعیه‌های جدید", "response": "آخرین اطلاعیه‌ها:\n{announcements}"},
                "faq": {"label": "❓ سوالات متداول", "response": "سوالات پرتکرار:\n{faq_list}"},
                "social": {"label": "🌐 شبکه‌های اجتماعی", "response": "ما را دنبال کنید:\nاینستاگرام: {instagram}\nکانال: {channel}"},
            },
            "settings": {
                "group_invite_link": GROUP_INVITE_LINK,
                "announcements": [],
                "announcement_files": [],
                "faq": [],
                "faq_files": [],
                "social": {
                    "instagram": "https://www.instagram.com/archit.ir/",
                    "channel": "https://t.me/irarchit"
                }
            }
        }
        MENU_CONFIG_FILE.parent.mkdir(exist_ok=True)
        MENU_CONFIG_FILE.write_text(json.dumps(default_config, ensure_ascii=False, indent=2), encoding="utf-8")
        return default_config
    try:
        config = json.loads(MENU_CONFIG_FILE.read_text(encoding="utf-8"))
        config = migrate_menu_config(config)
        return config
    except:
        return load_menu_config()

async def save_menu_config(config: dict) -> None:
    async with _write_lock:
        MENU_CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------- پنل تایپیک‌ها ----------
TOPICS = {
    "🎓 آکادمی آنلاین": "https://t.me/c/4388421316/146",
    "🛠 رفع اشکال تخصصی": "https://t.me/thedaraeii",
    "📐 پلان و نقشه‌های اجرایی": "https://t.me/c/4388421316/143",
    "💻 نرم‌افزار و پلاگین": "https://t.me/c/4388421316/136",
    "🎨 گرافیک و پست‌پرو": "https://t.me/c/4388421316/134",
    "🤖 اتاق پرامپت": "https://t.me/c/4388421316/114",
    "🛋 آبجکت و متریال": "https://t.me/c/4388421316/140",
    "📚 کتابخانه ضوابط ملی": "https://t.me/c/4388421316/123",
    "🖼 پرزانته و پورتفولیو": "https://t.me/c/4388421316/121",
    "📂 بانک پروژه": "https://t.me/c/4388421316/149",
    "💼 فرصت‌های شغلی": "https://t.me/c/4388421316/109",
    "🌐 معماری جهان": "https://t.me/c/4388421316/131",
    "☕️ کافه معماری": "https://t.me/c/4388421316/95",
    "🎙 رادیو معماری": "https://t.me/c/4388421316/125"
}

def topics_panel_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    topic_items = list(TOPICS.items())
    for i in range(0, len(topic_items), 2):
        row = []
        row.append(InlineKeyboardButton(text=topic_items[i][0], url=topic_items[i][1], style="primary"))
        if i+1 < len(topic_items):
            row.append(InlineKeyboardButton(text=topic_items[i+1][0], url=topic_items[i+1][1], style="primary"))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت به پنل", callback_data="menu:back", style="primary")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

# ---------- پنل کاربری ----------
# سبک هر دکمه بر اساس کارکردش: سبز برای عملِ مثبت/رشد (دعوت از دوستان)،
# آبی برای گزینه‌های اطلاعاتی/ناوبری، قرمز برای بستن پنل.
_USER_MENU_STYLES = {
    "join": "success",
    "topics": "primary",
    "contact_admin": "primary",
    "my_status": "primary",
    "announcements": "primary",
    "faq": "primary",
    "social": "primary",
}

def user_panel_keyboard() -> InlineKeyboardMarkup:
    config = load_menu_config()
    items = config["menu_items"]
    filtered_keys = ["join", "topics", "contact_admin", "my_status", "announcements", "faq", "social"]
    buttons = []
    for i in range(0, len(filtered_keys), 2):
        row = []
        key1 = filtered_keys[i]
        row.append(InlineKeyboardButton(
            text=items[key1]["label"], callback_data=f"menu:{key1}",
            style=_USER_MENU_STYLES.get(key1, "primary"),
        ))
        if i+1 < len(filtered_keys):
            key2 = filtered_keys[i+1]
            row.append(InlineKeyboardButton(
                text=items[key2]["label"], callback_data=f"menu:{key2}",
                style=_USER_MENU_STYLES.get(key2, "primary"),
            ))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="❌ بستن پنل", callback_data="menu:close", style="danger")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

# ---------- پنل ادمین ----------
def admin_panel_keyboard() -> InlineKeyboardMarkup:
    bot_enabled = load_bot_state().get("enabled", True)
    if bot_enabled:
        toggle_label = "🔴 خاموش کردن ربات"
        toggle_style = "danger"
    else:
        toggle_label = "🟢 روشن کردن ربات"
        toggle_style = "success"

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📈 آمار تفصیلی", callback_data="admin:stats_detail", style="primary"),
                InlineKeyboardButton(text="📄 خروجی اکسل", callback_data="admin:export", style="primary"),
            ],
            [
                InlineKeyboardButton(text="📢 پیام همگانی", callback_data="admin:broadcast", style="success"),
                InlineKeyboardButton(text="📨 ارسال مستقیم", callback_data="admin:sendmsg", style="primary"),
            ],
            [
                InlineKeyboardButton(text="🛠 مدیریت محتوا", callback_data="admin:menu_edit", style="primary"),
                InlineKeyboardButton(text="🗑 حذف کاربر", callback_data="admin:delete_user", style="danger"),
            ],
            [
                InlineKeyboardButton(text=toggle_label, callback_data="admin:toggle_bot", style=toggle_style),
            ],
            [
                InlineKeyboardButton(text="❌ بستن", callback_data="admin:close", style="danger"),
            ],
        ]
    )

def admin_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu", style="primary")]]
    )

def admin_menu_edit_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📢 ویرایش اطلاعیه‌ها", callback_data="admin:edit_announcements", style="primary")],
            [InlineKeyboardButton(text="❓ ویرایش سوالات متداول", callback_data="admin:edit_faq", style="primary")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu", style="primary")],
        ]
    )

# ---------- مدیریت وضعیت ربات ----------
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
    state = load_bot_state()
    pending = state.get("pending_requests", [])
    if not pending:
        return
    logger.info("شروع پردازش %d درخواست معلق", len(pending))
    for user_id in pending:
        try:
            user = await bot.get_chat(user_id)
            if is_verified(user_id):
                await start_membership_form(user)
            else:
                await send_captcha_challenge(user)
            logger.info("پیام به کاربر %s ارسال شد", user_id)
        except Exception as e:
            logger.warning("پردازش درخواست معلق برای %s ناموفق: %s", user_id, e)
        await asyncio.sleep(2)
    state["pending_requests"] = []
    await save_bot_state(state)
    logger.info("پردازش درخواست‌های معلق پایان یافت")

# ---------- نشانگر تایپ ----------
async def send_with_action(chat_id: int, action: str = "typing", delay: float = 1.0):
    await bot.send_chat_action(chat_id=chat_id, action=action)
    if delay > 0:
        await asyncio.sleep(delay)

# ---------- دستور /start ----------
@dp.message(Command("start"))
async def handle_start(message: Message):
    user_id = message.from_user.id
    await mark_funnel_entry(user_id)
    await send_with_action(message.chat.id, "typing", 0.5)

    display_name = message.from_user.first_name or "دوست عزیز"

    if is_form_completed(user_id) or await is_user_member(user_id):
        await message.answer(
            f"🏛 خوش برگشتی {display_name}!\nاز پنل زیر یکی از گزینه‌ها را انتخاب کن:",
            reply_markup=user_panel_keyboard()
        )
    else:
        await message.answer(
            f"سلام {display_name}، به رواق خوش اومدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
            "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
            "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم.\n\n"
            "🔗 لینک دعوت گروه:\n" + GROUP_INVITE_LINK,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📝 ثبت درخواست عضویت", url=GROUP_INVITE_LINK)]
                ]
            )
        )

# ==============================================================
#  تست ضدِ ربات — دکمه‌های چندگزینه‌ای (جایگزینِ احرازِ هویت با شماره)
# ==============================================================
_pending_captcha: dict[int, int] = {}

def captcha_keyboard(correct: int, wrong: int) -> InlineKeyboardMarkup:
    options = [correct, wrong]
    random.shuffle(options)
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text=str(v), callback_data=f"captcha:{v}", style="primary")
            for v in options
        ]]
    )

async def send_captcha_challenge(user) -> None:
    a, b = random.randint(2, 89), random.randint(2, 89)
    while b == a:
        b = random.randint(2, 89)
    correct, wrong = max(a, b), min(a, b)
    _pending_captcha[user.id] = correct
    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"سلام {user.first_name} 👋\n\n"
                "قبل از باز شدنِ فرمِ پذیرش، یک تاییدِ خیلی ساده لازم است تا مطمئن شویم "
                "پشتِ این پیام یک آدمِ واقعی است، نه یک ربات.\n\n"
                f"❓ کدوم عدد بزرگ‌تره؟"
            ),
            reply_markup=captcha_keyboard(correct, wrong),
        )
    except Exception as e:
        logger.warning("ارسال تستِ ضدربات به کاربر %s ممکن نشد: %s", user.id, e)

@dp.callback_query(F.data.startswith("captcha:"))
async def cb_captcha_answer(callback: CallbackQuery):
    user = callback.from_user
    try:
        chosen = int(callback.data.split(":", 1)[1])
    except ValueError:
        await callback.answer()
        return

    correct = _pending_captcha.get(user.id)
    if correct is None:
        await callback.answer("این چالش منقضی شده. لطفاً دوباره درخواستِ عضویت بده.", show_alert=True)
        return

    if chosen == correct:
        _pending_captcha.pop(user.id, None)
        await mark_verified(user.id)
        try:
            await callback.message.edit_text(f"✅ تاییدِ انسان‌بودن با موفقیت انجام شد، {user.first_name} جان.")
        except Exception:
            pass
        await callback.answer("تایید شد ✅")
        await start_membership_form(user)
    else:
        await callback.answer("❌ جواب درست نبود، یک چالشِ تازه برایت می‌فرستم.", show_alert=True)
        try:
            await callback.message.delete()
        except Exception:
            pass
        await send_captcha_challenge(user)

# ==============================================================
#  فرمِ پذیرش با دکمه‌های پنل (جایگزینِ مینی‌اپِ وب)
# ==============================================================
_pending_form: dict[int, dict] = {}

def education_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    for i in range(0, len(EDUCATION_OPTIONS), 2):
        row = [InlineKeyboardButton(text=EDUCATION_OPTIONS[i][1], callback_data=f"form_edu:{EDUCATION_OPTIONS[i][0]}", style="primary")]
        if i + 1 < len(EDUCATION_OPTIONS):
            row.append(InlineKeyboardButton(text=EDUCATION_OPTIONS[i+1][1], callback_data=f"form_edu:{EDUCATION_OPTIONS[i+1][0]}", style="primary"))
        buttons.append(row)
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def referral_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    items = list(REFERRAL_LABELS.items())
    for i in range(0, len(items), 2):
        row = [InlineKeyboardButton(text=items[i][1], callback_data=f"form_ref:{items[i][0]}", style="primary")]
        if i + 1 < len(items):
            row.append(InlineKeyboardButton(text=items[i+1][1], callback_data=f"form_ref:{items[i+1][0]}", style="primary"))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت به سوالِ قبل", callback_data="form_back:edu", style="danger")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def interests_keyboard(selected: list[str]) -> InlineKeyboardMarkup:
    buttons = []
    for i in range(0, len(INTERESTS), 2):
        row = []
        for item in INTERESTS[i:i + 2]:
            is_sel = item in selected
            row.append(InlineKeyboardButton(
                text=f"✅ {item}" if is_sel else item,
                callback_data=f"form_int:{item}",
                style="success" if is_sel else "primary",
            ))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(
        text=f"🏁 ثبتِ نهایی ({len(selected)}/{MAX_INTERESTS})",
        callback_data="form_int_done",
        style="success" if selected else "primary",
    )])
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت به سوالِ قبل", callback_data="form_back:ref", style="danger")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

async def start_membership_form(user) -> None:
    _pending_form[user.id] = {}
    try:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"عالی بود، {user.first_name} 🌿\n\n"
                "برای تکمیلِ عضویت، فقط سه سوالِ کوتاه مونده — با همین دکمه‌ها جواب بده.\n\n"
                "سوال ۱ از ۳ — سطحِ حرفه‌ای‌ات چیه؟"
            ),
            reply_markup=education_keyboard(),
        )
    except Exception as e:
        logger.warning("ارسالِ فرمِ پذیرش به کاربر %s ممکن نشد: %s", user.id, e)

@dp.callback_query(F.data.startswith("form_edu:"))
async def cb_form_education(callback: CallbackQuery):
    user = callback.from_user
    value = callback.data.split(":", 1)[1]
    label = dict(EDUCATION_OPTIONS).get(value, value)
    _pending_form[user.id] = {"education": value, "education_label": label}
    await callback.message.edit_text(
        f"ثبت شد: <b>{label}</b> ✅\n\nسوال ۲ از ۳ — از کدوم مسیر به این رواق رسیدی؟",
        reply_markup=referral_keyboard(),
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("form_ref:"))
async def cb_form_referral(callback: CallbackQuery):
    user = callback.from_user
    value = callback.data.split(":", 1)[1]
    data = _pending_form.setdefault(user.id, {})
    data["referral"] = value
    data["interests"] = set()
    label = REFERRAL_LABELS.get(value, value)
    await callback.message.edit_text(
        f"ثبت شد: <b>{label}</b> ✅\n\n"
        f"سوال ۳ از ۳ — کدوم بخش از این انبارِ دانش بیشتر به‌کارت میاد؟\n"
        f"(حداکثر {MAX_INTERESTS} مورد را انتخاب کن)",
        reply_markup=interests_keyboard([]),
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("form_int:"))
async def cb_form_interest_toggle(callback: CallbackQuery):
    user = callback.from_user
    item = callback.data.split(":", 1)[1]
    data = _pending_form.setdefault(user.id, {})
    selected: set = data.setdefault("interests", set())
    if item in selected:
        selected.discard(item)
    elif len(selected) >= MAX_INTERESTS:
        await callback.answer(f"حداکثر {MAX_INTERESTS} مورد رو می‌تونی انتخاب کنی.", show_alert=True)
        return
    else:
        selected.add(item)
    await callback.message.edit_reply_markup(reply_markup=interests_keyboard(list(selected)))
    await callback.answer()

@dp.callback_query(F.data == "form_back:edu")
async def cb_form_back_to_education(callback: CallbackQuery):
    user = callback.from_user
    _pending_form[user.id] = {}
    await callback.message.edit_text(
        "سوال ۱ از ۳ — سطحِ حرفه‌ای‌ات چیه؟",
        reply_markup=education_keyboard(),
    )
    await callback.answer()

@dp.callback_query(F.data == "form_back:ref")
async def cb_form_back_to_referral(callback: CallbackQuery):
    user = callback.from_user
    data = _pending_form.setdefault(user.id, {})
    data.pop("referral", None)
    data.pop("interests", None)
    await callback.message.edit_text(
        "سوال ۲ از ۳ — از کدوم مسیر به این رواق رسیدی؟",
        reply_markup=referral_keyboard(),
    )
    await callback.answer()

@dp.callback_query(F.data == "form_int_done")
async def cb_form_submit(callback: CallbackQuery):
    user = callback.from_user
    data = _pending_form.get(user.id)
    if not data or not data.get("education") or not data.get("referral"):
        await callback.answer("انگار مسیر قطع شده. لطفاً دوباره درخواستِ عضویت بده.", show_alert=True)
        return
    selected = list(data.get("interests") or [])
    if not selected:
        await callback.answer("حداقل یک مورد رو انتخاب کن.", show_alert=True)
        return

    await callback.answer("⏳ در حال ثبتِ نهایی...")
    try:
        await callback.message.edit_text("⏳ در حال بررسیِ اطلاعات...")
    except Exception:
        pass

    record = {
        "user_id": user.id,
        "username": user.username,
        "full_name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
        "submitted_at": datetime.utcnow().isoformat(),
        "education": data["education"],
        "education_label": data["education_label"],
        "referral": data["referral"],
        "interests": selected,
    }

    async with _write_lock:
        with open(DATA_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    _user_cache[str(user.id)] = record
    _pending_form.pop(user.id, None)
    logger.info("فرم کاربر %s ذخیره شد.", user.id)

    approved = False
    try:
        await bot.approve_chat_join_request(chat_id=GROUP_CHAT_ID, user_id=user.id)
        approved = True
    except Exception as e:
        logger.warning("تایید عضویت کاربر %s ممکن نشد: %s", user.id, e)

    if approved:
        await increment_stat("form_completed_and_joined")

    display_name = user.first_name or "دوست عزیز"
    if approved:
        rank_line = ""
        try:
            member_count = await bot.get_chat_member_count(GROUP_CHAT_ID)
            rank_line = f"تو ساکنِ شماره‌ی <b>{member_count}</b>‌ اُمِ این رواقی 🌱\n\n"
        except Exception:
            pass
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"🏛 آفرین {display_name}! سندِ عضویت‌ات صادر شد.\n"
                f"{rank_line}"
                f"علایقی که ثبت کردی: <b>{'، '.join(selected)}</b>\n\n"
                "از این لحظه، تو یکی از ساکنانِ این رواقی. کتابخانه‌ی "
                "فایل‌ها، پلان‌ها و پروژه‌ها به رویِ تو گشوده شد.\n"
                "امیدوارم این فضا، مرجعِ همیشگیِ مسیرِ حرفه‌ای‌ات باشد.\n\n"
                "از پنل زیر برای دسترسی به امکانات استفاده کنید:"
            ),
            reply_markup=user_panel_keyboard(),
        )
    else:
        await bot.send_message(
            chat_id=user.id,
            text=(
                f"{display_name} جان، اطلاعاتت ثبت شد، اما در بازشدنِ درِ رواق کمی تاخیر افتاد. "
                "کمی صبر کن، یا از طریقِ گروه با ادمین در میان بگذار."
            ),
        )

# ---------- درخواست عضویت ----------
@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)
    await mark_funnel_entry(user.id)

    state = load_bot_state()
    if not state.get("enabled", True):
        try:
            await bot.send_message(
                chat_id=user.id,
                text=f"🔴 {user.first_name} جان، فعلاً عضوگیری نداریم. به محضِ روشن شدنِ ربات بهت پیام می‌دیم."
            )
        except Exception as e:
            logger.warning("ارسال پیام خاموشی به کاربر %s ممکن نشد: %s", user.id, e)
        pending = state.get("pending_requests", [])
        if user.id not in pending:
            pending.append(user.id)
            state["pending_requests"] = pending
            await save_bot_state(state)
        return

    if is_verified(user.id):
        await start_membership_form(user)
        return

    await send_captcha_challenge(user)

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
                "▫️ برای شروع، خودت را در تایپیک <a href='https://t.me/c/4388421316/95'>کافه معماری</a> معرفی کن.\n\n"
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
    await send_with_action(message.chat.id, "typing", 0.5)
    await message.answer(
        await build_admin_dashboard_text(),
        reply_markup=admin_panel_keyboard(),
    )

@dp.message(Command("stats"))
async def handle_stats(message: Message):
    if not is_admin(message.from_user.id):
        return
    await send_with_action(message.chat.id, "typing", 1.0)
    await message.answer(await build_stats_text())

@dp.message(Command("stats_detail"))
async def handle_stats_detail(message: Message):
    if not is_admin(message.from_user.id):
        return
    await send_with_action(message.chat.id, "typing", 1.0)
    await message.answer(await build_stats_detail_text())

@dp.message(Command("export"))
async def handle_export(message: Message):
    if not is_admin(message.from_user.id):
        return
    await send_with_action(message.chat.id, "upload_document", 0.5)
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

# ---------- هندلر واحد برای تمام کالبک‌های ادمین ----------
@dp.callback_query(F.data.startswith("admin:"))
async def handle_all_admin_callbacks(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ دسترسی ندارید.", show_alert=True)
        return

    action = callback.data.split(":", 1)[1]
    logger.info(f"ادمین {callback.from_user.id} درخواست {action} کرد")

    if action == "menu":
        await state.clear()
        await callback.message.edit_text(
            await build_admin_dashboard_text(),
            reply_markup=admin_panel_keyboard(),
        )
        await callback.answer()
        return

    if action == "close":
        await state.clear()
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.answer("پنل بسته شد.")
        return

    if action == "stats_detail":
        await callback.answer()
        await callback.message.edit_text(await build_stats_detail_text(), reply_markup=admin_back_keyboard())
        return

    if action == "export":
        await callback.answer("⏳ در حال ساخت فایل اکسل...")
        await send_with_action(callback.message.chat.id, "upload_document", 1.0)
        file = build_export_file()
        if file is None:
            await callback.message.answer("هنوز هیچ کاربری شماره‌اش را تأیید نکرده است.")
            return
        await callback.message.answer_document(file, caption="📄 خروجی اکسل همه‌ی تأییدشده‌ها")
        return

    if action == "broadcast":
        await state.set_state(BroadcastStates.waiting_for_text)
        await callback.message.edit_text(
            "📢 <b>ارسال پیام همگانی</b>\n\n"
            "می‌توانید یک پیام متنی، عکس، سند، ویدئو یا هر نوع محتوای دیگری را بفرستید.\n"
            "این پیام برای همه‌ی کاربرانی که فرم را تکمیل کرده‌اند ارسال می‌شود.\n\n"
            "برای انصراف، دستور /cancel را بفرستید.",
            reply_markup=admin_back_keyboard(),
        )
        await callback.answer()
        return

    if action == "sendmsg":
        await state.set_state(AdminSendMsgStates.waiting_for_identifier)
        await callback.message.edit_text(
            "📨 <b>ارسال پیام مستقیم</b>\n\n"
            "شناسهٔ کاربر را وارد کنید (آیدی عددی یا @username):\n"
            "مثال: 123456789  یا  @Ali_Arch\n\n"
            "⚠️ بعد از شناسایی کاربر، می‌توانید هر نوع فایلی (عکس، سند، ویدئو، استیکر و...) ارسال کنید.\n"
            "(برای لغو، /cancel بفرستید)",
            reply_markup=admin_back_keyboard()
        )
        await callback.answer()
        return

    if action == "toggle_bot":
        state_data = load_bot_state()
        new_enabled = not state_data.get("enabled", True)
        state_data["enabled"] = new_enabled
        await save_bot_state(state_data)

        status_text = "روشن ✅" if new_enabled else "خاموش 🔴"
        await callback.answer(f"ربات {status_text} شد.")

        await callback.message.edit_text(
            await build_admin_dashboard_text(),
            reply_markup=admin_panel_keyboard()
        )

        if new_enabled:
            asyncio.create_task(process_pending_requests())
        return

    if action == "menu_edit":
        await state.clear()
        await callback.message.edit_text(
            "🛠 <b>مدیریت محتوا</b>\n\n"
            "از گزینه‌های زیر برای ویرایش محتوای پویای ربات استفاده کنید:",
            reply_markup=admin_menu_edit_keyboard()
        )
        await callback.answer()
        return

    if action == "edit_announcements":
        await state.set_state(ContentEditStates.editing_announcements)
        config = load_menu_config()
        announcements = config["settings"].get("announcements", [])
        files = config["settings"].get("announcement_files", [])

        text = "📢 <b>مدیریت اطلاعیه‌ها</b>\n\n"
        if announcements:
            text += "لیست اطلاعیه‌های فعلی:\n"
            for i, ann in enumerate(announcements, 1):
                text += f"{i}. {ann}\n"
        else:
            text += "هیچ اطلاعیه‌ای وجود ندارد.\n"

        if files:
            text += f"\n📎 {len(files)} فایل ضمیمه شده است."

        text += "\n\n📝 برای <b>جایگزین کردن</b> کل اطلاعیه‌ها، یک متن جدید (هر خط یک اطلاعیه) ارسال کنید.\n"
        text += "📎 می‌توانید همراه با متن، فایل یا عکس نیز ارسال کنید (ضمیمه می‌شود).\n"
        text += "برای لغو، /cancel بفرستید."

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🗑 حذف همه", callback_data="admin:announcement_delete_all")],
                [InlineKeyboardButton(text="🗑 حذف یک مورد (شماره را وارد کنید)", callback_data="admin:announcement_delete_one_start")],
                [InlineKeyboardButton(text="🔙 بازگشت به مدیریت محتوا", callback_data="admin:menu_edit")],
            ]
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return

    if action == "announcement_delete_all":
        config = load_menu_config()
        config["settings"]["announcements"] = []
        config["settings"]["announcement_files"] = []
        await save_menu_config(config)
        await callback.answer("✅ همه اطلاعیه‌ها حذف شدند.")
        await handle_all_admin_callbacks(
            CallbackQuery(
                id=callback.id,
                from_user=callback.from_user,
                chat_instance=callback.chat_instance,
                message=callback.message,
                data="admin:edit_announcements"
            ),
            state
        )
        return

    if action == "announcement_delete_one_start":
        await state.set_state(ContentEditStates.deleting_announcement)
        await callback.message.edit_text(
            "🗑 <b>حذف یک اطلاعیه</b>\n\n"
            "شمارهٔ اطلاعیه‌ای که می‌خواهید حذف کنید را وارد کنید.\n"
            "مثال: 3\n\n"
            "برای لغو، /cancel بفرستید.",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="🔙 لغو و بازگشت", callback_data="admin:edit_announcements")]]
            )
        )
        await callback.answer()
        return

    if action == "edit_faq":
        await state.set_state(ContentEditStates.editing_faq)
        config = load_menu_config()
        faq_items = config["settings"].get("faq", [])
        files = config["settings"].get("faq_files", [])

        text = "❓ <b>مدیریت سوالات متداول</b>\n\n"
        if faq_items:
            text += "لیست سوالات فعلی:\n"
            for i, item in enumerate(faq_items, 1):
                text += f"{i}. س: {item['q']}\n   ج: {item['a']}\n"
        else:
            text += "هیچ سوالی ثبت نشده است.\n"

        if files:
            text += f"\n📎 {len(files)} فایل ضمیمه شده است."

        text += "\n\n📝 برای <b>جایگزین کردن</b> کل سوالات، هر سوال و پاسخ را در یک خط به‌صورت زیر وارد کنید:\n"
        text += "سوال: پاسخ\n"
        text += "مثال: چطور عضو شوم؟: روی /start کلیک کنید.\n"
        text += "📎 می‌توانید همراه با متن، فایل یا عکس نیز ارسال کنید (ضمیمه می‌شود).\n"
        text += "برای لغو، /cancel بفرستید."

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🗑 حذف همه", callback_data="admin:faq_delete_all")],
                [InlineKeyboardButton(text="🗑 حذف یک مورد (شماره را وارد کنید)", callback_data="admin:faq_delete_one_start")],
                [InlineKeyboardButton(text="🔙 بازگشت به مدیریت محتوا", callback_data="admin:menu_edit")],
            ]
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return

    if action == "faq_delete_all":
        config = load_menu_config()
        config["settings"]["faq"] = []
        config["settings"]["faq_files"] = []
        await save_menu_config(config)
        await callback.answer("✅ همه سوالات حذف شدند.")
        await handle_all_admin_callbacks(
            CallbackQuery(
                id=callback.id,
                from_user=callback.from_user,
                chat_instance=callback.chat_instance,
                message=callback.message,
                data="admin:edit_faq"
            ),
            state
        )
        return

    if action == "faq_delete_one_start":
        await state.set_state(ContentEditStates.deleting_faq)
        await callback.message.edit_text(
            "🗑 <b>حذف یک سوال</b>\n\n"
            "شمارهٔ سوالی که می‌خواهید حذف کنید را وارد کنید.\n"
            "مثال: 2\n\n"
            "برای لغو، /cancel بفرستید.",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="🔙 لغو و بازگشت", callback_data="admin:edit_faq")]]
            )
        )
        await callback.answer()
        return

    if action == "delete_user":
        await state.set_state(DeleteUserStates.waiting_for_user_id)
        await callback.message.edit_text(
            "🗑 <b>حذف کاربر از گروه</b>\n\n"
            "آیدی عددی یا @username کاربر را وارد کنید:\n"
            "مثال: 123456789  یا  @Ali_Arch\n\n"
            "⚠️ کاربر از گروه اخراج شده و تمام اطلاعاتش (فرم، شماره تلفن) حذف می‌شود.\n"
            "(برای لغو، /cancel بفرستید)",
            reply_markup=admin_back_keyboard()
        )
        await callback.answer()
        return

    await callback.answer("❌ گزینه نامعتبر", show_alert=True)

# ---------- هندلرهای اختصاصی برای FSM ----------
class BroadcastStates(StatesGroup):
    waiting_for_text = State()
    confirming = State()

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
            [InlineKeyboardButton(text="✅ ارسال شود", callback_data="admin:broadcast_confirm", style="success")],
            [InlineKeyboardButton(text="❌ انصراف", callback_data="admin:broadcast_cancel", style="danger")],
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
#  بخش پنل کاربری
# ==============================================================

class ContactAdminStates(StatesGroup):
    waiting_for_message = State()

@dp.callback_query(F.data == "menu:back")
async def cb_menu_back(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🏛 به رواق خوش آمدید.\nاز پنل زیر یکی از گزینه‌ها را انتخاب کنید:",
        reply_markup=user_panel_keyboard()
    )
    await callback.answer()

@dp.callback_query(F.data == "menu:close")
async def cb_menu_close(callback: CallbackQuery):
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.answer("پنل بسته شد.")

@dp.callback_query(F.data.startswith("menu:"))
async def handle_user_menu(callback: CallbackQuery, state: FSMContext):
    key = callback.data.split(":", 1)[1]
    if key in ["close", "back"]:
        return

    config = load_menu_config()
    item = config["menu_items"].get(key)
    if not item:
        await callback.answer("گزینه‌ای یافت نشد.")
        return

    if key == "topics":
        await callback.message.edit_text(
            "📚 <b>راهنمای تایپیک‌های رواق</b>\n\n"
            "لطفاً یکی از تایپیک‌های زیر را انتخاب کنید:",
            reply_markup=topics_panel_keyboard()
        )
        await callback.answer()
        return

    if key == "contact_admin":
        await state.set_state(ContactAdminStates.waiting_for_message)
        await callback.message.edit_text(
            "📞 پیام خود را تایپ کنید تا برای ادمین ارسال شود.\n"
            "(برای لغو، /cancel بفرستید)",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به پنل", callback_data="menu:back")]]
            )
        )
        await callback.answer()
        return

    if key == "my_status":
        user_id = callback.from_user.id
        await send_with_action(callback.message.chat.id, "typing", 1.0)
        try:
            user = await bot.get_chat(user_id)
            display_name = user.full_name or user.first_name or "کاربر"
        except Exception:
            display_name = "کاربر"

        # نکته: تلگرام تاریخِ دقیقِ عضویت را در اختیار بات‌ها نمی‌گذارد،
        # پس فقط خودِ وضعیتِ عضویت (که مستقیم و لحظه‌ای از تلگرام گرفته
        # می‌شود، نه از دیتای محلیِ ما) را نشان می‌دهیم.
        is_member = False
        try:
            member = await bot.get_chat_member(GROUP_CHAT_ID, user_id)
            is_member = member.status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR]
        except Exception as e:
            logger.warning("گرفتن وضعیت عضویت کاربر %s ممکن نشد: %s", user_id, e)
            is_member = False

        if is_member:
            status_text = f"✅ {display_name} عزیز، شما عضو گروه هستید."
        else:
            status_text = f"❌ {display_name} عزیز، شما عضو گروه نیستید."

        # نکته: editMessageText پارامتر message_effect_id ندارد، پس برای
        # نمایشِ افکتِ 🎉 مجبوریم پیامِ قبلی را حذف و یک پیامِ جدید با
        # sendMessage ارسال کنیم. افکت فقط وقتی اعمال می‌شود که کاربر
        # واقعاً عضو گروه باشد (حالت جشن‌گرفتنی)؛ برای حالت «عضو نیستید»
        # افکتی ارسال نمی‌شود.
        try:
            await callback.message.delete()
        except Exception:
            pass

        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=status_text,
            reply_markup=user_panel_keyboard(),
            message_effect_id=MESSAGE_EFFECT_PARTY_POPPER if is_member else None,
        )
        await callback.answer()
        return

    if key == "announcements":
        announcements = config["settings"].get("announcements", [])
        announcement_files = config["settings"].get("announcement_files", [])

        if announcements:
            announcements_text = "\n".join([f"▪️ {a}" for a in announcements])
        else:
            announcements_text = "📢 هیچ اطلاعیه‌ای وجود ندارد."

        response = item["response"].format(
            announcements=announcements_text
        )

        await callback.message.edit_text(response, reply_markup=user_panel_keyboard())

        for file_id in announcement_files:
            try:
                await callback.message.answer_document(document=file_id)
            except Exception:
                pass

        await callback.answer()
        return

    if key == "faq":
        faq_items = config["settings"].get("faq", [])
        faq_files = config["settings"].get("faq_files", [])

        if faq_items:
            faq_text = "\n".join([f"❓ {item['q']}\n📝 {item['a']}" for item in faq_items])
        else:
            faq_text = "هنوز سوالی ثبت نشده است."

        response = item["response"].format(
            faq_list=faq_text
        )

        await callback.message.edit_text(response, reply_markup=user_panel_keyboard())

        for file_id in faq_files:
            try:
                await callback.message.answer_document(document=file_id)
            except Exception:
                pass

        await callback.answer()
        return

    if key == "social":
        social = config["settings"]["social"]
        response = item["response"].format(
            instagram=social.get("instagram", ""),
            channel=social.get("channel", "")
        )
        await callback.message.edit_text(response, reply_markup=user_panel_keyboard())
        await callback.answer()
        return

    if key == "join":
        response = item["response"].format(
            invite_link=config["settings"]["group_invite_link"]
        )
        await callback.message.edit_text(response, reply_markup=user_panel_keyboard())
        await callback.answer()
        return

    await callback.message.edit_text(response, reply_markup=user_panel_keyboard())
    await callback.answer()

@dp.message(ContactAdminStates.waiting_for_message)
async def handle_contact_admin_message(message: Message, state: FSMContext):
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=user_panel_keyboard())
        return

    await relay_message_to_admin(message.from_user, message.text)
    await message.answer("✅ پیام شما به ادمین ارسال شد.", reply_markup=user_panel_keyboard())
    await state.clear()

# ==============================================================
#  بخش مدیریت محتوا (ادمین) - هندلرهای حذف یک اطلاعیه/سوال
# ==============================================================

class ContentEditStates(StatesGroup):
    editing_announcements = State()
    editing_faq = State()
    deleting_announcement = State()
    deleting_faq = State()

@dp.message(ContentEditStates.deleting_announcement)
async def handle_delete_announcement_number(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    if not message.text or not message.text.strip().isdigit():
        await message.answer("❌ لطفاً یک شمارهٔ معتبر (عدد) وارد کنید.")
        return

    index = int(message.text.strip())
    config = load_menu_config()
    announcements = config["settings"].get("announcements", [])
    if 1 <= index <= len(announcements):
        deleted = announcements.pop(index - 1)
        config["settings"]["announcements"] = announcements
        await save_menu_config(config)
        await message.answer(f"✅ اطلاعیهٔ شمارهٔ {index} با متن:\n«{deleted}»\nحذف شد.")
    else:
        await message.answer(f"❌ شمارهٔ {index} معتبر نیست. تعداد اطلاعیه‌ها: {len(announcements)}")

    await state.clear()
    await message.answer("برای ادامه، روی دکمه‌ی «ویرایش اطلاعیه‌ها» کلیک کنید.", reply_markup=admin_menu_edit_keyboard())

@dp.message(ContentEditStates.deleting_faq)
async def handle_delete_faq_number(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    if not message.text or not message.text.strip().isdigit():
        await message.answer("❌ لطفاً یک شمارهٔ معتبر (عدد) وارد کنید.")
        return

    index = int(message.text.strip())
    config = load_menu_config()
    faq_items = config["settings"].get("faq", [])
    if 1 <= index <= len(faq_items):
        deleted = faq_items.pop(index - 1)
        config["settings"]["faq"] = faq_items
        await save_menu_config(config)
        await message.answer(f"✅ سوال شمارهٔ {index} با متن:\n«{deleted['q']}»\nحذف شد.")
    else:
        await message.answer(f"❌ شمارهٔ {index} معتبر نیست. تعداد سوالات: {len(faq_items)}")

    await state.clear()
    await message.answer("برای ادامه، روی دکمه‌ی «ویرایش سوالات متداول» کلیک کنید.", reply_markup=admin_menu_edit_keyboard())

# ---------- هندلرهای ویرایش محتوا ----------
@dp.message(ContentEditStates.editing_announcements)
async def handle_edit_announcements(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    config = load_menu_config()

    if message.text:
        lines = [line.strip() for line in message.text.split("\n") if line.strip()]
        if lines:
            config["settings"]["announcements"] = lines

    file_id = None
    if message.document:
        file_id = message.document.file_id
    elif message.photo:
        file_id = message.photo[-1].file_id
    elif message.video:
        file_id = message.video.file_id
    elif message.audio:
        file_id = message.audio.file_id

    if file_id:
        if "announcement_files" not in config["settings"]:
            config["settings"]["announcement_files"] = []
        config["settings"]["announcement_files"].append(file_id)
        await message.answer("✅ فایل با موفقیت ضمیمه شد.")

    await save_menu_config(config)

    if message.text:
        await message.answer(f"✅ {len(config['settings']['announcements'])} اطلاعیه ثبت شد.", reply_markup=admin_menu_edit_keyboard())
    else:
        await message.answer("✅ فایل ضمیمه شد.", reply_markup=admin_menu_edit_keyboard())

    await state.clear()

@dp.message(ContentEditStates.editing_faq)
async def handle_edit_faq(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    config = load_menu_config()

    if message.text:
        lines = [line.strip() for line in message.text.split("\n") if line.strip()]
        faq_items = []
        for line in lines:
            if ":" in line:
                q, a = line.split(":", 1)
                faq_items.append({"q": q.strip(), "a": a.strip()})
        if faq_items:
            config["settings"]["faq"] = faq_items

    file_id = None
    if message.document:
        file_id = message.document.file_id
    elif message.photo:
        file_id = message.photo[-1].file_id
    elif message.video:
        file_id = message.video.file_id
    elif message.audio:
        file_id = message.audio.file_id

    if file_id:
        if "faq_files" not in config["settings"]:
            config["settings"]["faq_files"] = []
        config["settings"]["faq_files"].append(file_id)
        await message.answer("✅ فایل با موفقیت ضمیمه شد.")

    await save_menu_config(config)

    if message.text:
        await message.answer(f"✅ {len(config['settings']['faq'])} سوال و پاسخ ثبت شد.", reply_markup=admin_menu_edit_keyboard())
    else:
        await message.answer("✅ فایل ضمیمه شد.", reply_markup=admin_menu_edit_keyboard())

    await state.clear()

# ==============================================================
#  بخش حذف کاربر (ادمین)
# ==============================================================

class DeleteUserStates(StatesGroup):
    waiting_for_user_id = State()
    confirming = State()

@dp.message(DeleteUserStates.waiting_for_user_id)
async def delete_user_identifier(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    identifier = message.text.strip()
    if not identifier:
        await message.answer("لطفاً یک شناسه معتبر وارد کنید.")
        return

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

    await state.update_data(target_user_id=user_id, target_identifier=identifier)
    await state.set_state(DeleteUserStates.confirming)

    try:
        user = await bot.get_chat(user_id)
        display = user.full_name or str(user_id)
        await state.update_data(target_display=display)
        confirm_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="✅ بله، حذف شود", callback_data="admin:delete_confirm", style="danger")],
                [InlineKeyboardButton(text="❌ انصراف", callback_data="admin:delete_cancel", style="primary")],
            ]
        )
        await message.answer(
            f"⚠️ آیا از حذف کاربر <b>{html_escape(display)}</b> (آیدی: <code>{user_id}</code>) مطمئنید؟\n"
            "این عملیات غیرقابل بازگشت است.",
            reply_markup=confirm_keyboard
        )
    except Exception as e:
        await message.answer(f"❌ خطا در دریافت اطلاعات کاربر: {e}")
        await state.clear()

@dp.callback_query(F.data == "admin:delete_confirm", DeleteUserStates.confirming)
async def cb_delete_confirm(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return

    data = await state.get_data()
    user_id = data.get("target_user_id")
    display = data.get("target_display", "کاربر")
    if not user_id:
        await callback.message.edit_text("خطا: کاربر مشخص نیست.")
        await state.clear()
        return

    try:
        await bot.ban_chat_member(chat_id=GROUP_CHAT_ID, user_id=user_id)
        async with _write_lock:
            verified = load_verified()
            if str(user_id) in verified:
                del verified[str(user_id)]
                VERIFIED_FILE.write_text(json.dumps(verified, ensure_ascii=False), encoding="utf-8")

            if DATA_FILE.exists():
                new_lines = []
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            record = json.loads(line)
                            if record.get("user_id") != user_id:
                                new_lines.append(line)
                        except json.JSONDecodeError:
                            continue
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines))
                    if new_lines:
                        f.write("\n")

            if str(user_id) in _user_cache:
                del _user_cache[str(user_id)]

        await callback.message.edit_text(f"✅ کاربر <b>{html_escape(display)}</b> با موفقیت حذف شد.")
        await state.clear()
        await callback.message.answer("🛠 پنل مدیریت", reply_markup=admin_panel_keyboard())
    except Exception as e:
        logger.error(f"خطا در حذف کاربر {user_id}: {e}")
        await callback.message.edit_text(f"❌ خطا در حذف کاربر: {e}")
        await state.clear()

@dp.callback_query(F.data == "admin:delete_cancel", DeleteUserStates.confirming)
async def cb_delete_cancel(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.clear()
    await callback.message.edit_text("عملیات حذف لغو شد.", reply_markup=admin_panel_keyboard())
    await callback.answer()

# ==============================================================
#  بخش ارسال مستقیم به کاربر
# ==============================================================

class AdminSendMsgStates(StatesGroup):
    waiting_for_identifier = State()
    waiting_for_message = State()

@dp.message(AdminSendMsgStates.waiting_for_identifier)
async def admin_sendmsg_identifier(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    identifier = message.text.strip()
    if not identifier:
        await message.answer("لطفاً یک شناسه معتبر وارد کنید.")
        return

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

    try:
        user = await bot.get_chat(user_id)
        display = user.full_name or str(user_id)
        await state.update_data(target_user_id=user_id, target_user_display=display)
        await message.answer(
            f"👤 کاربر: <b>{html_escape(display)}</b> (آیدی: <code>{user_id}</code>)\n\n"
            "📤 حالا <b>متن، عکس، سند، ویدئو، استیکر یا هر فایل دیگری</b> را ارسال کنید:\n"
            "(برای لغو، /cancel بفرستید)",
            reply_markup=admin_back_keyboard()
        )
        await state.set_state(AdminSendMsgStates.waiting_for_message)
    except Exception as e:
        await message.answer(f"❌ خطا در دریافت اطلاعات کاربر: {e}")

@dp.message(AdminSendMsgStates.waiting_for_message)
async def admin_sendmsg_media(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if message.text and message.text.startswith("/"):
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

    caption = message.caption or ""

    try:
        if message.text:
            await bot.send_message(chat_id=user_id, text=message.text)
        elif message.photo:
            await bot.send_photo(chat_id=user_id, photo=message.photo[-1].file_id, caption=caption)
        elif message.document:
            await bot.send_document(chat_id=user_id, document=message.document.file_id, caption=caption, file_name=message.document.file_name)
        elif message.video:
            await bot.send_video(chat_id=user_id, video=message.video.file_id, caption=caption, supports_streaming=True)
        elif message.audio:
            await bot.send_audio(chat_id=user_id, audio=message.audio.file_id, caption=caption, performer=message.audio.performer, title=message.audio.title)
        elif message.voice:
            await bot.send_voice(chat_id=user_id, voice=message.voice.file_id, caption=caption)
        elif message.video_note:
            await bot.send_video_note(chat_id=user_id, video_note=message.video_note.file_id)
        elif message.sticker:
            await bot.send_sticker(chat_id=user_id, sticker=message.sticker.file_id)
        elif message.animation:
            await bot.send_animation(chat_id=user_id, animation=message.animation.file_id, caption=caption)
        elif message.contact:
            await bot.send_contact(chat_id=user_id, phone_number=message.contact.phone_number, first_name=message.contact.first_name, last_name=message.contact.last_name)
        elif message.location:
            await bot.send_location(chat_id=user_id, latitude=message.location.latitude, longitude=message.location.longitude)
        elif message.poll:
            await bot.send_poll(chat_id=user_id, question=message.poll.question, options=[opt.text for opt in message.poll.options], is_anonymous=message.poll.is_anonymous, type=message.poll.type)
        else:
            await message.answer("❌ این نوع فایل پشتیبانی نمی‌شود.")
            return

        await message.answer(f"✅ پیام به <b>{html_escape(display)}</b> ارسال شد.")
    except Exception as e:
        logger.error(f"خطا در ارسال پیام به {user_id}: {e}")
        await message.answer(f"❌ خطا در ارسال پیام: {e}")
    await state.clear()

# ==============================================================
#  بخش حضور و غیاب (با خروجی اکسل و ارسال فقط به ادمین)
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

async def build_attendance_excel(participants: list) -> BufferedInputFile:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "لیست حاضرین"
    sheet.sheet_view.rightToLeft = True

    headers = ["ردیف", "نام کامل", "آیدی عددی", "یوزرنیم", "تاریخ ثبت (شمسی)"]
    sheet.append(headers)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="14532F", end_color="14532F", fill_type="solid")
    for cell in sheet[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for i, p in enumerate(participants, 1):
        uid = p["user_id"]
        time_jalali = p.get("time", "نامشخص")

        try:
            member = await bot.get_chat_member(GROUP_CHAT_ID, uid)
            name = member.user.full_name or str(uid)
            username = f"@{member.user.username}" if member.user.username else ""
        except Exception:
            name = f"کاربر {uid}"
            username = ""

        sheet.append([i, name, uid, username, time_jalali])

    col_widths = [8, 30, 18, 20, 22]
    for idx, width in enumerate(col_widths, 1):
        sheet.column_dimensions[get_column_letter(idx)].width = width

    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return BufferedInputFile(buffer.read(), filename="لیست_حاضرین_نهایی.xlsx")

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

    admin_id = active.get("admin_id", chat_id)
    participants = active.get("participants", [])
    total = len(participants)

    last_reminder = active.get("last_reminder_message_id")
    if last_reminder:
        try:
            await bot.delete_message(chat_id=chat_id, message_id=last_reminder)
        except Exception:
            pass

    if total == 0:
        await bot.send_message(
            chat_id=admin_id,
            text="📋 در این دوره هیچ‌کس حضور ثبت نکرد."
        )
    else:
        await bot.send_message(
            chat_id=admin_id,
            text=f"📋 <b>دوره‌ی حضور و غیاب به پایان رسید.</b>\nتعداد کل شرکت‌کنندگان: <b>{total}</b> نفر"
        )

        if total > 30:
            excel_file = await build_attendance_excel(participants)
            await bot.send_document(
                chat_id=admin_id,
                document=excel_file,
                caption=f"📄 لیست کامل {total} نفر شرکت‌کننده"
            )
        else:
            lines = ["👤 <b>شرکت‌کنندگان:</b>"]
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

            text = "\n".join(lines)
            if len(text) < 4000:
                await bot.send_message(chat_id=admin_id, text=text)
            else:
                plain = [l.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "") for l in lines]
                with BytesIO() as f:
                    f.write("\n".join(plain).encode("utf-8"))
                    f.seek(0)
                    await bot.send_document(
                        chat_id=admin_id,
                        document=BufferedInputFile(f.read(), filename="لیست_حاضرین.txt"),
                        caption=f"📄 لیست کامل حاضرین (تعداد {total} نفر)"
                    )

    data["active"] = None
    await save_attendance_data(data)

    task_key = f"reminder_{chat_id}"
    if task_key in _attendance_tasks:
        _attendance_tasks[task_key].cancel()
        del _attendance_tasks[task_key]

    await bot.send_message(
        chat_id=admin_id,
        text="✅ گزارش نهایی حضور و غیاب ارسال شد."
    )

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
        "admin_id": message.from_user.id,
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

    await _finish_attendance(message.chat.id)
    await message.answer("✅ دوره‌ی حضور و غیاب به‌صورت دستی پایان یافت و گزارش برای شما ارسال شد.")

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

    total = len(participants)
    if total > 30:
        excel_file = await build_attendance_excel(participants)
        await message.answer_document(
            document=excel_file,
            caption=f"📄 لیست حاضرین تا این لحظه (تعداد {total} نفر)"
        )
    else:
        lines = ["📋 لیست حاضرین تا این لحظه:"]
        for p in participants:
            uid = p["user_id"]
            time_jalali = p.get("time", "نامشخص")
            try:
                member = await bot.get_chat_member(GROUP_CHAT_ID, uid)
                name = member.user.full_name or str(uid)
                username = f" @{member.user.username}" if member.user.username else ""
                lines.append(f"• {name} (ID: {uid}){username} — ثبت در {time_jalali}")
            except Exception:
                lines.append(f"• کاربر با آیدی {uid} — ثبت در {time_jalali}")
        await message.answer("\n".join(lines))

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

# ==============================================================
#  مدیریت خطاهای سراسری
# ==============================================================

@dp.errors()
async def global_error_handler(update: Update, exception: Exception):
    logger.error(f"❌ خطای سراسری: {exception}", exc_info=True)

    user_id = None
    chat_id = None

    if update.message:
        user_id = update.message.from_user.id
        chat_id = update.message.chat.id
    elif update.callback_query:
        user_id = update.callback_query.from_user.id
        chat_id = update.callback_query.message.chat.id

    if chat_id:
        try:
            await bot.send_message(
                chat_id=chat_id,
                text=(
                    "⚠️ <b>متأسفانه مشکلی پیش آمد!</b>\n\n"
                    "تیم فنی رواق مطلع شد و در حال رفع مشکل است.\n"
                    "لطفاً چند دقیقه بعد دوباره تلاش کنید.\n\n"
                    "اگر مشکل ادامه داشت، از طریق دکمه‌ی «📞 ارتباط با ادمین» به ما اطلاع دهید.\n"
                    "🙏 پوزش از بابت مزاحمت"
                ),
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [InlineKeyboardButton(text="📞 ارتباط با ادمین", callback_data="menu:contact_admin")]
                    ]
                )
            )
        except Exception as e:
            logger.error(f"ارسال پیام خطا به کاربر ممکن نشد: {e}")

    if NOTIFY_CHAT_ID_INT and user_id:
        try:
            error_summary = f"{exception.__class__.__name__}: {str(exception)[:100]}"
            await bot.send_message(
                chat_id=NOTIFY_CHAT_ID_INT,
                text=(
                    f"🚨 <b>خطا در ربات</b>\n"
                    f"کاربر: <code>{user_id}</code>\n"
                    f"خطا: <code>{error_summary}</code>\n"
                    f"زمان: {format_jalali_datetime(datetime.utcnow())}"
                )
            )
        except Exception as e:
            logger.error(f"ارسال گزارش خطا به ادمین ممکن نشد: {e}")

    return True

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

    await restore_attendance_tasks()
    logger.info("ربات «رواق» با موفقیت راه‌اندازی شد! 🏛")

def create_app() -> web.Application:
    app = web.Application()

    app.router.add_get("/health", handle_health)

    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_startup.append(start_self_ping)
    app.on_cleanup.append(stop_self_ping)
    return app

if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)