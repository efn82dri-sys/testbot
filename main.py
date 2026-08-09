# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «تایید عضویت» — مرجع فایل‌های معماری و عمران
====================================================================
نسخه‌ی نهایی با قابلیت‌های:
- حضور و غیاب خودکار با یادآوری هر ۳ ساعت و پایان خودکار بعد از ۲۴ ساعت
- تاریخ و ساعت شمسی + تهران
- ارسال پیام مستقیم به کاربر با پشتیبانی از فایل (عکس، سند، ویدئو، ...)
- خاموش/روشن کردن ربات با ذخیره‌ی درخواست‌های معلق
- منوی تعاملی دوستونه با مدیریت پویا از پنل ادمین
- مدیریت خطاهای سراسری با پیام‌های کاربرپسند
- نشانگر تایپ و آپلود برای تجربه‌ی کاربری بهتر
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import shutil
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
from aiogram.fsm.storage.memory import MemoryStorage
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
    Update,
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

# مسیرهای فایل‌ها
DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)
STATS_FILE = Path(__file__).parent / "data" / "stats.json"
PHONES_FILE = Path(__file__).parent / "data" / "phones.json"
ATTENDANCE_FILE = Path(__file__).parent / "data" / "attendance.json"
BOT_STATE_FILE = Path(__file__).parent / "data" / "bot_state.json"
MENU_CONFIG_FILE = Path(__file__).parent / "data" / "menu_config.json"
BACKUP_DIR = Path(__file__).parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

REFERRAL_LABELS = {
    "instagram": "اینستاگرام",
    "friends": "معرفی دوستان",
    "other_groups": "سایر گروه‌ها و کانال‌ها",
    "search": "جستجوی اینترنتی",
    "other": "سایر موارد",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ذخیره‌سازی FSM در حافظه
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

def is_user_member(user_id: int) -> bool:
    """بررسی اینکه کاربر عضو گروه است یا خیر"""
    try:
        member = asyncio.run(bot.get_chat_member(GROUP_CHAT_ID, user_id))
        return member.status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR]
    except Exception:
        return False

def is_form_completed(user_id: int) -> bool:
    """بررسی اینکه کاربر فرم را تکمیل کرده است یا خیر"""
    return str(user_id) in _user_cache

def cache_users():
    """ذخیره‌سازی کاربران در حافظه برای دسترسی سریع"""
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

# بارگذاری کش در ابتدا
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

# ---------- پشتیبان‌گیری خودکار ----------
async def auto_backup():
    """پشتیبان‌گیری خودکار از فایل‌های داده"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    for file in [DATA_FILE, PHONES_FILE, STATS_FILE, ATTENDANCE_FILE, BOT_STATE_FILE, MENU_CONFIG_FILE]:
        if file.exists():
            backup_file = BACKUP_DIR / f"{file.stem}_{timestamp}.json"
            shutil.copy(file, backup_file)
    
    # حذف پشتیبان‌های قدیمی‌تر از ۳۰ روز
    for backup in BACKUP_DIR.glob("*.json"):
        if (datetime.now() - datetime.fromtimestamp(backup.stat().st_mtime)).days > 30:
            backup.unlink()
    logger.info("پشتیبان‌گیری خودکار انجام شد.")

# ---------- مدیریت منوی پویا ----------
def load_menu_config() -> dict:
    """بارگذاری تنظیمات منو از فایل"""
    if not MENU_CONFIG_FILE.exists():
        default_config = {
            "menu_items": {
                "join": {"label": "📝 عضویت در گروه", "response": "برای عضویت در گروه، روی لینک زیر کلیک کنید:\n{invite_link}"},
                "topics": {"label": "📚 راهنمای تاپیک‌ها", "response": "📂 تاپیک‌های فعال:\n┌ کافه معماری\n├ اخبار و اطلاعیه\n├ پرزانته و پرتفولیو\n├ رادیو معماری\n├ فایل‌های گرافیکی و پست‌های پرو\n├ کتابخانه و ضوابط ملی\n├ اتاق پرامپت\n├ گنجینه ارائه\n├ فرصت‌های شغلی و کارآموزی\n├ آبجکت، فمیلی و متریال\n├ آکادمی آنلاین\n├ بانک پروژه\n├ دنیای نرم‌افزار و پلاگین\n├ پلان‌ها و نقشه‌های اجرایی\n└ معماری جهان"},
                "contact_admin": {"label": "📞 ارتباط با ادمین", "response": "پیام خود را تایپ کنید تا برای ادمین ارسال شود."},
                "invite_link": {"label": "🔗 لینک دعوت گروه", "response": "لینک دعوت گروه:\n{invite_link}"},
                "my_status": {"label": "📊 وضعیت عضویت من", "response": "وضعیت شما: {status}"},
                "announcements": {"label": "📢 اطلاعیه‌های جدید", "response": "آخرین اطلاعیه‌ها:\n{announcements}"},
                "faq": {"label": "❓ سوالات متداول", "response": "سوالات پرتکرار:\n{faq_list}"},
                "social": {"label": "🌐 شبکه‌های اجتماعی", "response": "ما را دنبال کنید:\nاینستاگرام: {instagram}\nکانال: {channel}"},
                "settings": {"label": "⚙️ تنظیمات", "response": "تنظیمات پیام‌های همگانی:\n{settings_status}"}
            },
            "settings": {
                "group_invite_link": GROUP_INVITE_LINK,
                "announcements": ["📌 به‌زودی: وبینار تخصصی سازه"],
                "faq": [
                    {"q": "چطور عضو شوم؟", "a": "روی /start کلیک کنید و مراحل را طی کنید."},
                    {"q": "فرم کجاست؟", "a": "پس از تأیید شماره، دکمه‌ی فرم نمایش داده می‌شود."},
                    {"q": "چرا شماره تلفن می‌خواهید؟", "a": "برای احراز هویت و جلوگیری از ورود ربات‌ها."},
                    {"q": "چطور با ادمین تماس بگیرم؟", "a": "از دکمه‌ی «📞 ارتباط با ادمین» استفاده کنید."}
                ],
                "social": {
                    "instagram": "https://www.instagram.com/archit.ir/",
                    "channel": "https://t.me/irarchit"
                },
                "notifications_enabled": True
            }
        }
        MENU_CONFIG_FILE.parent.mkdir(exist_ok=True)
        MENU_CONFIG_FILE.write_text(json.dumps(default_config, ensure_ascii=False, indent=2), encoding="utf-8")
        return default_config
    try:
        return json.loads(MENU_CONFIG_FILE.read_text(encoding="utf-8"))
    except:
        return load_menu_config()

async def save_menu_config(config: dict) -> None:
    async with _write_lock:
        MENU_CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

def get_menu_label(key: str) -> str:
    """دریافت برچسب دکمه از تنظیمات"""
    config = load_menu_config()
    return config["menu_items"].get(key, {}).get("label", key)

def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """ساخت صفحه‌کلید منوی اصلی (دو ردیفه)"""
    config = load_menu_config()
    items = config["menu_items"]
    
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=items["join"]["label"]),
                KeyboardButton(text=items["topics"]["label"]),
            ],
            [
                KeyboardButton(text=items["contact_admin"]["label"]),
                KeyboardButton(text=items["invite_link"]["label"]),
            ],
            [
                KeyboardButton(text=items["my_status"]["label"]),
                KeyboardButton(text=items["announcements"]["label"]),
            ],
            [
                KeyboardButton(text=items["faq"]["label"]),
                KeyboardButton(text=items["social"]["label"]),
            ],
            [
                KeyboardButton(text=items["settings"]["label"]),
            ],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )

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
        await asyncio.sleep(2)
    state["pending_requests"] = []
    await save_bot_state(state)
    logger.info("پردازش درخواست‌های معلق پایان یافت")

# ---------- نشانگر تایپ و پردازش ----------
async def send_with_action(chat_id: int, action: str = "typing", delay: float = 1.0):
    """ارسال نشانگر وضعیت به کاربر"""
    await bot.send_chat_action(chat_id=chat_id, action=action)
    if delay > 0:
        await asyncio.sleep(delay)

async def send_message_with_typing(chat_id: int, text: str, delay: float = 1.0, **kwargs):
    """ارسال پیام با نشانگر تایپ"""
    await send_with_action(chat_id, "typing", delay)
    return await bot.send_message(chat_id=chat_id, text=text, **kwargs)

async def send_document_with_uploading(chat_id: int, document, **kwargs):
    """ارسال سند با نشانگر آپلود"""
    await send_with_action(chat_id, "upload_document", 0.5)
    return await bot.send_document(chat_id=chat_id, document=document, **kwargs)

async def send_photo_with_uploading(chat_id: int, photo, **kwargs):
    """ارسال عکس با نشانگر آپلود"""
    await send_with_action(chat_id, "upload_photo", 0.5)
    return await bot.send_photo(chat_id=chat_id, photo=photo, **kwargs)

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
                InlineKeyboardButton(text="🛠 مدیریت منو", callback_data="admin:menu_edit"),
                InlineKeyboardButton(text="💾 پشتیبان‌گیری", callback_data="admin:backup"),
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

def admin_menu_edit_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📝 ویرایش متن دکمه‌ها", callback_data="admin:edit_menu_text")],
            [InlineKeyboardButton(text="🔗 ویرایش لینک دعوت", callback_data="admin:edit_invite_link")],
            [InlineKeyboardButton(text="📢 ویرایش اطلاعیه‌ها", callback_data="admin:edit_announcements")],
            [InlineKeyboardButton(text="❓ ویرایش سوالات متداول", callback_data="admin:edit_faq")],
            [InlineKeyboardButton(text="🌐 ویرایش شبکه‌های اجتماعی", callback_data="admin:edit_social")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")],
        ]
    )

# ---------- دستور /start ----------
@dp.message(Command("start"))
async def handle_start(message: Message):
    user_id = message.from_user.id
    await send_with_action(message.chat.id, "typing", 0.5)
    
    # بررسی اینکه کاربر عضو است یا فرم را تکمیل کرده
    if is_form_completed(user_id) or is_user_member(user_id):
        await message.answer(
            "🏛 به رواق خوش آمدید.\nاز منوی زیر یکی از گزینه‌ها را انتخاب کنید:",
            reply_markup=main_menu_keyboard()
        )
    else:
        await message.answer(
            "به رواق خوش آمدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
            "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
            "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم.\n\n"
            "🔗 لینک دعوت گروه:\n" + GROUP_INVITE_LINK,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📝 ثبت درخواست عضویت", url=GROUP_INVITE_LINK)]
                ]
            )
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

# ---------- درخواست عضویت ----------
@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

    state = load_bot_state()
    if not state.get("enabled", True):
        try:
            await bot.send_message(
                chat_id=user.id,
                text="🔴 فعلاً عضوگیری نداریم. به محض روشن شدن ربات، به شما پیام خواهیم داد."
            )
        except Exception as e:
            logger.warning("ارسال پیام خاموشی به کاربر %s ممکن نشد: %s", user.id, e)
        pending = state.get("pending_requests", [])
        if user.id not in pending:
            pending.append(user.id)
            state["pending_requests"] = pending
            await save_bot_state(state)
        return

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
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📚 مشاهده تاپیک‌ها", callback_data="show_topics")],
            [InlineKeyboardButton(text="📞 ارتباط با ادمین", callback_data="contact_admin")],
            [InlineKeyboardButton(text="🏛 ورود به کافه معماری", url="https://t.me/c/4388421316/95")],
        ]
    )
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
            reply_markup=keyboard,
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
    await send_with_action(message.chat.id, "typing", 0.5)
    await message.answer(
        f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}\nیکی از گزینه‌ها را انتخاب کنید:",
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
    await send_with_action(callback.message.chat.id, "upload_document", 1.0)
    file = build_export_file()
    if file is None:
        await callback.message.answer("هنوز هیچ کاربری شماره‌اش را تأیید نکرده است.")
        return
    await callback.message.answer_document(file, caption="📄 خروجی اکسل همه‌ی تأییدشده‌ها")

@dp.callback_query(F.data == "admin:backup")
async def cb_admin_backup(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await callback.answer("⏳ در حال تهیه پشتیبان...")
    await auto_backup()
    await callback.message.answer("✅ پشتیبان‌گیری انجام شد.", reply_markup=admin_back_keyboard())

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
    
    # اگر یکی از دکمه‌های منو بود، هندلرهای اختصاصی آن را مدیریت می‌کنند
    config = load_menu_config()
    menu_labels = [item["label"] for item in config["menu_items"].values()]
    if text in menu_labels:
        return

    await relay_message_to_admin(message.from_user, text)
    await message.answer("پیامت به گوشِ ادمین‌های رواق رسید؛ به‌زودی جواب می‌گیری 🙏")

# ---------- منوی تعاملی (هندلرهای دکمه‌ها) ----------
@dp.message(F.text == load_menu_config()["menu_items"]["join"]["label"])
async def handle_join_button(message: Message):
    config = load_menu_config()
    response = config["menu_items"]["join"]["response"].format(
        invite_link=config["settings"]["group_invite_link"]
    )
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["topics"]["label"])
async def handle_topics_button(message: Message):
    config = load_menu_config()
    response = config["menu_items"]["topics"]["response"]
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["contact_admin"]["label"])
async def handle_contact_admin_button(message: Message):
    await send_message_with_typing(
        message.chat.id,
        "📞 پیام خود را تایپ کنید تا برای ادمین ارسال شود.\n"
        "(برای لغو، /cancel بفرستید)",
        0.5
    )
    # وضعیت کاربر در حالت انتظار پیام قرار می‌گیرد
    # اما چون این دکمه از منوی اصلی است، با State عمومی کار می‌کند

@dp.message(F.text == load_menu_config()["menu_items"]["invite_link"]["label"])
async def handle_invite_link_button(message: Message):
    config = load_menu_config()
    response = config["menu_items"]["invite_link"]["response"].format(
        invite_link=config["settings"]["group_invite_link"]
    )
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["my_status"]["label"])
async def handle_my_status_button(message: Message):
    user_id = message.from_user.id
    await send_with_action(message.chat.id, "typing", 1.0)
    
    is_member = is_user_member(user_id)
    form_completed = is_form_completed(user_id)
    phone = get_saved_phone(user_id)
    
    status_parts = []
    if is_member:
        status_parts.append("✅ عضو گروه هستید")
    else:
        status_parts.append("❌ عضو گروه نیستید")
    
    if form_completed:
        status_parts.append("✅ فرم عضویت را تکمیل کرده‌اید")
    else:
        status_parts.append("❌ فرم عضویت را تکمیل نکرده‌اید")
    
    if phone:
        status_parts.append(f"📱 شماره تلفن: {phone}")
    else:
        status_parts.append("❌ شماره تلفن ثبت نشده")
    
    config = load_menu_config()
    response = config["menu_items"]["my_status"]["response"].format(
        status="\n".join(status_parts)
    )
    await message.answer(response)

@dp.message(F.text == load_menu_config()["menu_items"]["announcements"]["label"])
async def handle_announcements_button(message: Message):
    config = load_menu_config()
    announcements = config["settings"].get("announcements", [])
    if not announcements:
        announcements_text = "📢 هیچ اطلاعیه‌ای وجود ندارد."
    else:
        announcements_text = "\n".join([f"▪️ {a}" for a in announcements])
    response = config["menu_items"]["announcements"]["response"].format(
        announcements=announcements_text
    )
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["faq"]["label"])
async def handle_faq_button(message: Message):
    config = load_menu_config()
    faq_items = config["settings"].get("faq", [])
    if not faq_items:
        faq_text = "هنوز سوالی ثبت نشده است."
    else:
        faq_text = "\n".join([f"❓ {item['q']}\n📝 {item['a']}" for item in faq_items])
    response = config["menu_items"]["faq"]["response"].format(
        faq_list=faq_text
    )
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["social"]["label"])
async def handle_social_button(message: Message):
    config = load_menu_config()
    social = config["settings"]["social"]
    response = config["menu_items"]["social"]["response"].format(
        instagram=social.get("instagram", ""),
        channel=social.get("channel", "")
    )
    await send_message_with_typing(message.chat.id, response, 0.5)

@dp.message(F.text == load_menu_config()["menu_items"]["settings"]["label"])
async def handle_settings_button(message: Message):
    config = load_menu_config()
    notifications = config["settings"].get("notifications_enabled", True)
    status = "فعال ✅" if notifications else "غیرفعال ❌"
    response = config["menu_items"]["settings"]["response"].format(
        settings_status=f"دریافت پیام‌های همگانی: {status}"
    )
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔕 خاموش کردن نوتیفیکیشن‌ها" if notifications else "🔔 روشن کردن نوتیفیکیشن‌ها",
                    callback_data="toggle_notifications"
                )
            ]
        ]
    )
    await send_message_with_typing(message.chat.id, response, 0.5, reply_markup=keyboard)

@dp.callback_query(F.data == "toggle_notifications")
async def cb_toggle_notifications(callback: CallbackQuery):
    config = load_menu_config()
    current = config["settings"].get("notifications_enabled", True)
    config["settings"]["notifications_enabled"] = not current
    await save_menu_config(config)
    status = "فعال ✅" if not current else "غیرفعال ❌"
    await callback.answer(f"نوتیفیکیشن‌ها {status} شد.")
    await callback.message.edit_text(
        f"⚙️ تنظیمات به‌روز شد.\nوضعیت: {status}",
        reply_markup=admin_back_keyboard()
    )

@dp.callback_query(F.data == "show_topics")
async def cb_show_topics(callback: CallbackQuery):
    await callback.answer()
    config = load_menu_config()
    response = config["menu_items"]["topics"]["response"]
    await callback.message.answer(response)

@dp.callback_query(F.data == "contact_admin")
async def cb_contact_admin(callback: CallbackQuery):
    await callback.answer()
    await callback.message.answer(
        "📞 پیام خود را تایپ کنید تا برای ادمین ارسال شود."
    )

# ---------- مدیریت پویای منو (پنل ادمین) ----------
class MenuEditStates(StatesGroup):
    choosing_item = State()
    editing_text = State()
    editing_link = State()
    editing_announcements = State()
    editing_faq = State()
    editing_social = State()

@dp.callback_query(F.data == "admin:menu_edit")
async def cb_menu_edit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("دسترسی ندارید.", show_alert=True)
        return
    await state.clear()
    await callback.message.edit_text(
        "🛠 <b>مدیریت منو و محتوا</b>\n\n"
        "از گزینه‌های زیر برای ویرایش محتوای پویای ربات استفاده کنید:",
        reply_markup=admin_menu_edit_keyboard()
    )
    await callback.answer()

@dp.callback_query(F.data == "admin:edit_menu_text")
async def cb_edit_menu_text(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    config = load_menu_config()
    items = config["menu_items"]
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=items[key]["label"], callback_data=f"edit_item:{key}")]
            for key in items.keys()
        ] + [[InlineKeyboardButton(text="🔙 بازگشت", callback_data="admin:menu_edit")]]
    )
    await callback.message.edit_text(
        "📝 کدام دکمه را ویرایش می‌خواهید؟\n(متن و پاسخ آن قابل تغییر است)",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("edit_item:"))
async def cb_edit_specific_item(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    key = callback.data.split(":")[1]
    config = load_menu_config()
    item = config["menu_items"][key]
    await state.update_data(editing_key=key)
    await state.set_state(MenuEditStates.editing_text)
    await callback.message.edit_text(
        f"📝 ویرایش دکمه‌ی «{item['label']}»\n\n"
        f"متن فعلی:\n{item['response'][:200]}...\n\n"
        "متن جدید را وارد کنید (می‌توانید از {invite_link} و {status} و ... استفاده کنید):\n"
        "(برای لغو، /cancel بفرستید)",
        reply_markup=admin_back_keyboard()
    )
    await callback.answer()

@dp.message(MenuEditStates.editing_text)
async def handle_edit_item_text(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    data = await state.get_data()
    key = data.get("editing_key")
    if not key:
        await message.answer("خطا! دوباره تلاش کنید.")
        await state.clear()
        return
    new_text = message.text.strip()
    config = load_menu_config()
    config["menu_items"][key]["response"] = new_text
    await save_menu_config(config)
    await message.answer(f"✅ متن دکمه‌ی «{config['menu_items'][key]['label']}» به‌روز شد.")
    await state.clear()
    # بازگشت به منوی ویرایش
    await message.answer(
        "🛠 مدیریت منو",
        reply_markup=admin_menu_edit_keyboard()
    )

@dp.callback_query(F.data == "admin:edit_invite_link")
async def cb_edit_invite_link(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(MenuEditStates.editing_link)
    config = load_menu_config()
    await callback.message.edit_text(
        f"🔗 لینک دعوت فعلی:\n{config['settings']['group_invite_link']}\n\n"
        "لینک جدید را وارد کنید:\n"
        "(برای لغو، /cancel بفرستید)",
        reply_markup=admin_back_keyboard()
    )
    await callback.answer()

@dp.message(MenuEditStates.editing_link)
async def handle_edit_invite_link(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    new_link = message.text.strip()
    if not new_link.startswith("https://t.me/"):
        await message.answer("❌ لینک باید با https://t.me/ شروع شود.")
        return
    config = load_menu_config()
    config["settings"]["group_invite_link"] = new_link
    await save_menu_config(config)
    await message.answer("✅ لینک دعوت به‌روز شد.", reply_markup=admin_menu_edit_keyboard())
    await state.clear()

@dp.callback_query(F.data == "admin:edit_announcements")
async def cb_edit_announcements(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(MenuEditStates.editing_announcements)
    config = load_menu_config()
    announcements = config["settings"].get("announcements", [])
    text = "📢 اطلاعیه‌های فعلی:\n"
    if announcements:
        text += "\n".join([f"{i+1}. {a}" for i, a in enumerate(announcements)])
    else:
        text += "هیچ اطلاعیه‌ای وجود ندارد."
    text += "\n\nلطفاً اطلاعیه‌های جدید را به‌صورت خط‌به‌خط وارد کنید:\n"
    text += "(برای لغو، /cancel بفرستید)"
    await callback.message.edit_text(text, reply_markup=admin_back_keyboard())
    await callback.answer()

@dp.message(MenuEditStates.editing_announcements)
async def handle_edit_announcements(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    lines = [line.strip() for line in message.text.split("\n") if line.strip()]
    config = load_menu_config()
    config["settings"]["announcements"] = lines
    await save_menu_config(config)
    await message.answer(f"✅ {len(lines)} اطلاعیه ثبت شد.", reply_markup=admin_menu_edit_keyboard())
    await state.clear()

@dp.callback_query(F.data == "admin:edit_faq")
async def cb_edit_faq(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(MenuEditStates.editing_faq)
    config = load_menu_config()
    faq_items = config["settings"].get("faq", [])
    text = "❓ سوالات متداول فعلی:\n"
    if faq_items:
        text += "\n".join([f"{i+1}. س: {item['q']}\n   ج: {item['a']}" for i, item in enumerate(faq_items)])
    else:
        text += "هیچ سوالی ثبت نشده است."
    text += "\n\nلطفاً سوالات جدید را به‌صورت زیر وارد کنید (هر سوال و پاسخ در یک خط):\n"
    text += "سوال: پاسخ\n"
    text += "مثال: چطور عضو شوم؟: روی /start کلیک کنید.\n"
    text += "(برای لغو، /cancel بفرستید)"
    await callback.message.edit_text(text, reply_markup=admin_back_keyboard())
    await callback.answer()

@dp.message(MenuEditStates.editing_faq)
async def handle_edit_faq(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    lines = [line.strip() for line in message.text.split("\n") if line.strip()]
    faq_items = []
    for line in lines:
        if ":" in line:
            q, a = line.split(":", 1)
            faq_items.append({"q": q.strip(), "a": a.strip()})
    config = load_menu_config()
    config["settings"]["faq"] = faq_items
    await save_menu_config(config)
    await message.answer(f"✅ {len(faq_items)} سوال و پاسخ ثبت شد.", reply_markup=admin_menu_edit_keyboard())
    await state.clear()

@dp.callback_query(F.data == "admin:edit_social")
async def cb_edit_social(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(MenuEditStates.editing_social)
    config = load_menu_config()
    social = config["settings"]["social"]
    text = (
        f"🌐 شبکه‌های اجتماعی فعلی:\n"
        f"اینستاگرام: {social.get('instagram', '')}\n"
        f"کانال: {social.get('channel', '')}\n\n"
        "لطفاً لینک‌های جدید را به‌صورت زیر وارد کنید:\n"
        "اینستاگرام: https://...\n"
        "کانال: https://...\n"
        "(برای لغو، /cancel بفرستید)"
    )
    await callback.message.edit_text(text, reply_markup=admin_back_keyboard())
    await callback.answer()

@dp.message(MenuEditStates.editing_social)
async def handle_edit_social(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    lines = message.text.split("\n")
    config = load_menu_config()
    for line in lines:
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if "اینستاگرام" in key:
                config["settings"]["social"]["instagram"] = value
            elif "کانال" in key:
                config["settings"]["social"]["channel"] = value
    await save_menu_config(config)
    await message.answer("✅ شبکه‌های اجتماعی به‌روز شدند.", reply_markup=admin_menu_edit_keyboard())
    await state.clear()

# ---------- ارسال پیام مستقیم به کاربر (از پنل ادمین - با پشتیبانی از فایل) ----------
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
        "مثال: 123456789  یا  @Ali_Arch\n\n"
        "⚠️ بعد از شناسایی کاربر، می‌توانید هر نوع فایلی (عکس، سند، ویدئو، استیکر و...) ارسال کنید.\n"
        "(برای لغو، /cancel بفرستید)",
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
            await bot.send_photo(
                chat_id=user_id, 
                photo=message.photo[-1].file_id, 
                caption=caption
            )
            
        elif message.document:
            await bot.send_document(
                chat_id=user_id, 
                document=message.document.file_id, 
                caption=caption,
                file_name=message.document.file_name
            )
            
        elif message.video:
            await bot.send_video(
                chat_id=user_id, 
                video=message.video.file_id, 
                caption=caption,
                supports_streaming=True
            )
            
        elif message.audio:
            await bot.send_audio(
                chat_id=user_id, 
                audio=message.audio.file_id, 
                caption=caption,
                performer=message.audio.performer,
                title=message.audio.title
            )
            
        elif message.voice:
            await bot.send_voice(
                chat_id=user_id, 
                voice=message.voice.file_id, 
                caption=caption
            )
            
        elif message.video_note:
            await bot.send_video_note(
                chat_id=user_id, 
                video_note=message.video_note.file_id
            )
            
        elif message.sticker:
            await bot.send_sticker(
                chat_id=user_id, 
                sticker=message.sticker.file_id
            )
            
        elif message.animation:
            await bot.send_animation(
                chat_id=user_id, 
                animation=message.animation.file_id, 
                caption=caption
            )
            
        elif message.contact:
            await bot.send_contact(
                chat_id=user_id,
                phone_number=message.contact.phone_number,
                first_name=message.contact.first_name,
                last_name=message.contact.last_name
            )
            
        elif message.location:
            await bot.send_location(
                chat_id=user_id,
                latitude=message.location.latitude,
                longitude=message.location.longitude
            )
            
        elif message.poll:
            await bot.send_poll(
                chat_id=user_id,
                question=message.poll.question,
                options=[opt.text for opt in message.poll.options],
                is_anonymous=message.poll.is_anonymous,
                type=message.poll.type
            )
            
        else:
            await message.answer("❌ این نوع فایل پشتیبانی نمی‌شود.")
            return

        await message.answer(f"✅ پیام به <b>{html_escape(display)}</b> ارسال شد.")
        
    except Exception as e:
        logger.error(f"خطا در ارسال پیام به {user_id}: {e}")
        await message.answer(f"❌ خطا در ارسال پیام: {e}")
    
    await state.clear()

# ---------- خاموش/روشن کردن ربات ----------
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
        asyncio.create_task(process_pending_requests())

# ==============================================================
#  بخش حضور و غیاب هفتگی
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
    
    # به‌روزرسانی کش
    _user_cache[str(user_id)] = record

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
                    "امیدوارم این فضا، مرجعِ همیشگیِ مسیرِ حرفه‌ای‌ات باشد.\n\n"
                    "از منوی زیر برای دسترسی به امکانات استفاده کنید:"
                ),
                reply_markup=main_menu_keyboard(),
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

# ==============================================================
#  مدیریت خطاهای سراسری (Global Error Handler)
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
                        [InlineKeyboardButton(text="📞 ارتباط با ادمین", callback_data="contact_admin")]
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

    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="mini app", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    logger.info("Menu Button روی مینی‌اپ تنظیم شد.")

    await restore_attendance_tasks()
    await auto_backup()
    logger.info("ربات «رواق» با موفقیت راه‌اندازی شد! 🏛")

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