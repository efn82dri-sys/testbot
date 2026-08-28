# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «رواق» — مرجع فایل‌های معماری و عمران
نسخهٔ نهایی با احراز هویت ساده، پنل کاربری بازطراحی‌شده،
ماژول VIP پیشرفته و مدیریت حرفه‌ای
====================================================================
"""

import asyncio
import json
import logging
import os
import random
import uuid
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
    InputMediaPhoto,
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
PORT = int(os.environ.get("PORT", 8080))
PING_INTERVAL_SECONDS = int(os.environ.get("PING_INTERVAL_SECONDS", 10 * 60))

DATA_FILE = Path(__file__).parent / "data" / "users.json"
DATA_FILE.parent.mkdir(exist_ok=True)
GOLDEN_USERS_FILE = Path(__file__).parent / "data" / "golden_users.json"
STATS_FILE = Path(__file__).parent / "data" / "stats.json"
FUNNEL_USERS_FILE = Path(__file__).parent / "data" / "funnel_users.json"
ATTENDANCE_FILE = Path(__file__).parent / "data" / "attendance.json"
BOT_STATE_FILE = Path(__file__).parent / "data" / "bot_state.json"
MENU_CONFIG_FILE = Path(__file__).parent / "data" / "menu_config.json"

# ---------- تنظیمات گروه VIP ----------
VIP_GROUP_CHAT_ID_RAW = os.environ.get("VIP_GROUP_CHAT_ID", "").strip()
try:
    VIP_GROUP_CHAT_ID: int | None = int(VIP_GROUP_CHAT_ID_RAW) if VIP_GROUP_CHAT_ID_RAW else None
except ValueError:
    VIP_GROUP_CHAT_ID = None

VIP_CARD_NUMBER = os.environ.get("VIP_CARD_NUMBER", "6219861963810246").strip()
VIP_CARD_HOLDER = os.environ.get("VIP_CARD_HOLDER", "عرفان دارائی").strip()
VIP_INTRO_DELAY_MINUTES = int(os.environ.get("VIP_INTRO_DELAY_MINUTES", 30))

VIP_CATEGORIES_FILE = Path(__file__).parent / "data" / "vip_categories.json"
VIP_SUBSCRIPTIONS_FILE = Path(__file__).parent / "data" / "vip_subscriptions.json"
VIP_PAYMENTS_FILE = Path(__file__).parent / "data" / "vip_payments.json"
VIP_GLOBAL_SETTINGS_FILE = Path(__file__).parent / "data" / "vip_global_settings.json"

VIP_MONTHS_TO_DAYS = {3: 90, 6: 180, 12: 365}
_vip_intro_tasks: dict[int, asyncio.Task] = {}

GROUP_NAME = "رواق"
SIGNATURE = f"\n\n— <i>تیمِ {GROUP_NAME}</i> 🏛"

GROUP_RULES_URL = os.environ.get("GROUP_RULES_URL", "").strip()
RULES_TEXT = (
    "📜 <b>قوانین گروه رواق</b>\n\n"
    "<blockquote>۱. احترام متقابل و پرهیز از هرگونه تبلیغ خارج از رواق.\n"
    "۲. فایل‌ها و محتوای رواق فقط برای استفادهٔ شخصی و آموزشی است.\n"
    "۳. اطلاعات شما فقط برای مدیریت عضویت نگهداری می‌شود و در اختیار شخص ثالث قرار نمی‌گیرد.\n"
    "۴. هر زمان بخواهید می‌توانید با «📞 ارتباط با ادمین» درخواست حذف اطلاعات خود را ثبت کنید.</blockquote>\n\n"
    "با پذیرش این قوانین، عضویت شما در گروه تأیید می‌شود."
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

storage = MemoryStorage()
bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(
    parse_mode=ParseMode.HTML,
    protect_content=True  # غیرفعال‌سازی فوروارد
))
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
        "رواق گم‌شده‌ای پیدا می‌شود که به‌کارت بیاید.\n\n"
        "به ادمین‌ها پیام بده، شاید درِ گنج‌خانه‌ای تازه باز شود 🙏",
    ),
    (
        "پیام‌های زیاد گروه رو شلوغ می‌کرد",
        "راستی؟ می‌دونی که می‌تونی گروه رو روی حالتِ سکوت بذاری و فقط گاهی "
        "سراغِ «پیام‌های سنجاق‌شده» (همون فایل‌های طلایی) بیای؟\n\n"
        "بدونِ اینکه اعلان‌ها اذیتت کنن 🔕",
    ),
    (
        "فعلاً به این موضوع نیاز ندارم",
        "کاملاً درک می‌کنم. بساطِ معماری گاهی خلوت‌شدن هم می‌خواد.\n\n"
        "هر وقت دوباره خواستی قدم بذاری، درِ رواق به رویت باز است 🙌",
    ),
    (
        "دلیل دیگه‌ای دارم",
        "ممنون که وقت گذاشتی.\n\n"
        "اگه حرفِ دلت رو مستقیم با ادمین‌ها در میون بذاری، به ما در مرمتِ این فضا کمکِ بزرگی کردی 🙏",
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
def to_persian_num(num) -> str:
    mapping = {
        '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
        '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
    }
    return ''.join(mapping.get(ch, ch) for ch in str(num))

def greet_user(user, suffix="عزیز") -> str:
    name = html_escape(user.first_name or "کاربر")
    return f"{name} {suffix}"

def sign(text: str) -> str:
    return f"{text}{SIGNATURE}"

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS

def load_stats() -> dict:
    if not STATS_FILE.exists():
        return {"total_joined": 0, "total_left": 0, "golden_users": 0}
    try:
        return json.loads(STATS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"total_joined": 0, "total_left": 0, "golden_users": 0}

async def increment_stat(field: str) -> None:
    async with _write_lock:
        stats = load_stats()
        stats[field] = stats.get(field, 0) + 1
        STATS_FILE.write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")

def load_golden_users() -> dict:
    if not GOLDEN_USERS_FILE.exists():
        return {}
    try:
        return json.loads(GOLDEN_USERS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

async def save_golden_user(user_id: int, data: dict) -> None:
    async with _write_lock:
        golden = load_golden_users()
        golden[str(user_id)] = data
        GOLDEN_USERS_FILE.write_text(json.dumps(golden, ensure_ascii=False), encoding="utf-8")
    await increment_stat("golden_users")

def is_golden(user_id: int) -> bool:
    return str(user_id) in load_golden_users()

def load_funnel_users() -> set[int]:
    if not FUNNEL_USERS_FILE.exists():
        return set()
    try:
        return set(json.loads(FUNNEL_USERS_FILE.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        return set()

async def mark_funnel_entry(user_id: int) -> None:
    async with _write_lock:
        users = load_funnel_users()
        if user_id in users:
            return
        users.add(user_id)
        FUNNEL_USERS_FILE.write_text(json.dumps(list(users)), encoding="utf-8")

def load_user_data(user_id: int) -> dict | None:
    if not DATA_FILE.exists():
        return None
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if record.get("user_id") == user_id:
                    return record
            except (json.JSONDecodeError, KeyError):
                continue
    return None

async def save_user_data(user_id: int, data: dict) -> None:
    async with _write_lock:
        new_lines = []
        if DATA_FILE.exists():
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        if record.get("user_id") != user_id:
                            new_lines.append(line)
                    except (json.JSONDecodeError, KeyError):
                        continue
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            for line in new_lines:
                f.write(line + "\n")
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
    _user_cache[str(user_id)] = data

async def is_user_member(user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(GROUP_CHAT_ID, user_id)
        return member.status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR]
    except Exception:
        return False

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

def collect_form_user_ids_by_interest(interest: str) -> set[int]:
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
                if interest in (record.get("interests") or []):
                    user_ids.add(int(record["user_id"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return user_ids

# ==============================================================
#  توابع کمکی داده‌های VIP
# ==============================================================

def load_vip_categories() -> list[dict]:
    if not VIP_CATEGORIES_FILE.exists():
        return []
    try:
        return json.loads(VIP_CATEGORIES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

async def save_vip_categories(categories: list[dict]) -> None:
    async with _write_lock:
        VIP_CATEGORIES_FILE.parent.mkdir(exist_ok=True)
        VIP_CATEGORIES_FILE.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")

def get_vip_category(cat_id: str) -> dict | None:
    for cat in load_vip_categories():
        if cat["id"] == cat_id:
            return cat
    return None

def load_vip_subscriptions() -> dict:
    if not VIP_SUBSCRIPTIONS_FILE.exists():
        return {}
    try:
        return json.loads(VIP_SUBSCRIPTIONS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

async def save_vip_subscriptions(data: dict) -> None:
    async with _write_lock:
        VIP_SUBSCRIPTIONS_FILE.parent.mkdir(exist_ok=True)
        VIP_SUBSCRIPTIONS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def load_vip_payments() -> dict:
    if not VIP_PAYMENTS_FILE.exists():
        return {}
    try:
        return json.loads(VIP_PAYMENTS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

async def save_vip_payments(data: dict) -> None:
    async with _write_lock:
        VIP_PAYMENTS_FILE.parent.mkdir(exist_ok=True)
        VIP_PAYMENTS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def load_vip_global_settings() -> dict:
    if not VIP_GLOBAL_SETTINGS_FILE.exists():
        return {
            "prices": {"3": 150000, "6": 250000, "12": 400000},
            "discount_percent": 0,
            "updated_at": datetime.utcnow().isoformat()
        }
    try:
        return json.loads(VIP_GLOBAL_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"prices": {"3": 150000, "6": 250000, "12": 400000}, "discount_percent": 0}

async def save_vip_global_settings(settings: dict) -> None:
    settings["updated_at"] = datetime.utcnow().isoformat()
    async with _write_lock:
        VIP_GLOBAL_SETTINGS_FILE.parent.mkdir(exist_ok=True)
        VIP_GLOBAL_SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")

def format_toman(amount: int) -> str:
    return f"{to_persian_num(f'{amount:,}')} تومان"

# ---------- توابع آمار (ساده‌شده) ----------
async def build_stats_text() -> str:
    try:
        member_count = await bot.get_chat_member_count(GROUP_CHAT_ID)
        member_count_str = to_persian_num(member_count)
    except Exception as e:
        logger.warning("گرفتن تعداد اعضا ممکن نشد: %s", e)
        member_count_str = "نامشخص"

    golden_count = len(load_golden_users())
    return (
        "📐 <b>داشبورد رواق</b>\n\n"
        f"👥 ساکنینِ فعلی گروه: <b>{member_count_str}</b>\n"
        f"🌟 کاربران طلایی: <b>{to_persian_num(golden_count)}</b>"
    )

async def build_admin_dashboard_text() -> str:
    status_text = "روشن ✅" if load_bot_state().get("enabled", True) else "خاموش 🔴"
    stats_text = await build_stats_text()
    return f"🛠 <b>پنل مدیریت</b>\nوضعیت ربات: {status_text}\n\n{stats_text}"

def build_export_file() -> BufferedInputFile | None:
    # ساخت فایل اکسل از کاربران (اختصاری)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "کاربران"
    sheet.sheet_view.rightToLeft = True
    headers = ["آیدی", "نام", "یوزرنیم", "تاریخ عضویت"]
    sheet.append(headers)
    # خواندن داده‌ها
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    sheet.append([
                        record.get("user_id"),
                        record.get("full_name", ""),
                        record.get("username", ""),
                        record.get("joined_at", "")
                    ])
                except:
                    continue
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return BufferedInputFile(buffer.read(), filename="کاربران.xlsx")

# ---------- مدیریت منوی پویا ----------
def migrate_menu_config(config: dict) -> dict:
    if "menu_items" not in config:
        config["menu_items"] = {}
    if "settings" not in config:
        config["settings"] = {}

    defaults = {
        "profile": {"label": "📊 پروفایل من", "response": ""},
        "vip": {"label": "🌟 گروه VIP", "response": ""},
        "topics": {"label": "📚 راهنمای تاپیک‌ها", "response": "لطفاً یکی از تاپیک‌های زیر را انتخاب کنید:"},
        "join": {"label": "👥 دعوت از دوستان", "response": "🔗 لینک دعوت گروه:\n{invite_link}"},
        "my_status": {"label": "📊 وضعیت عضویت من", "response": "وضعیت شما: {status}"},
        "contact_admin": {"label": "📞 ارتباط با ادمین", "response": "پیام خود را تایپ کنید تا برای ادمین ارسال شود."},
        "faq": {"label": "❓ سوالات متداول", "response": "سوالات پرتکرار:\n{faq_list}"},
        "social": {"label": "🌐 شبکه‌های اجتماعی", "response": "ما را دنبال کنید:\nاینستاگرام: {instagram}\nکانال: {channel}"},
        "announcements": {"label": "📢 اطلاعیه‌های جدید", "response": "آخرین اطلاعیه‌ها:\n{announcements}"},
    }
    for key, val in defaults.items():
        if key not in config["menu_items"]:
            config["menu_items"][key] = val

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
                "profile": {"label": "📊 پروفایل من", "response": ""},
                "vip": {"label": "🌟 گروه VIP", "response": ""},
                "topics": {"label": "📚 راهنمای تاپیک‌ها", "response": "لطفاً یکی از تاپیک‌های زیر را انتخاب کنید:"},
                "join": {"label": "👥 دعوت از دوستان", "response": "🔗 لینک دعوت گروه:\n{invite_link}"},
                "my_status": {"label": "📊 وضعیت عضویت من", "response": "وضعیت شما: {status}"},
                "contact_admin": {"label": "📞 ارتباط با ادمین", "response": "پیام خود را تایپ کنید تا برای ادمین ارسال شود."},
                "faq": {"label": "❓ سوالات متداول", "response": "سوالات پرتکرار:\n{faq_list}"},
                "social": {"label": "🌐 شبکه‌های اجتماعی", "response": "ما را دنبال کنید:\nاینستاگرام: {instagram}\nکانال: {channel}"},
                "announcements": {"label": "📢 اطلاعیه‌های جدید", "response": "آخرین اطلاعیه‌ها:\n{announcements}"},
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

# ---------- پنل تاپیک‌ها ----------
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
        row.append(InlineKeyboardButton(text=topic_items[i][0], url=topic_items[i][1]))
        if i+1 < len(topic_items):
            row.append(InlineKeyboardButton(text=topic_items[i+1][0], url=topic_items[i+1][1]))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت به پنل", callback_data="menu:back")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

# ---------- پنل کاربری (چیدمان جدید) ----------
def user_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📊 پروفایل من", callback_data="menu:profile"),
                InlineKeyboardButton(text="🌟 گروه VIP", callback_data="menu:vip"),
            ],
            [
                InlineKeyboardButton(text="📚 راهنمای تاپیک‌ها", callback_data="menu:topics"),
                InlineKeyboardButton(text="👥 دعوت از دوستان", callback_data="menu:join"),
            ],
            [
                InlineKeyboardButton(text="📊 وضعیت عضویت من", callback_data="menu:my_status"),
                InlineKeyboardButton(text="📞 ارتباط با ادمین", callback_data="menu:contact_admin"),
            ],
            [
                InlineKeyboardButton(text="❓ سوالات متداول", callback_data="menu:faq"),
                InlineKeyboardButton(text="🌐 شبکه‌های اجتماعی", callback_data="menu:social"),
            ],
            [
                InlineKeyboardButton(text="❌ بستن پنل", callback_data="menu:close"),
            ],
        ]
    )

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
                InlineKeyboardButton(text="📄 خروجی اکسل", callback_data="admin:export"),
            ],
            [
                InlineKeyboardButton(text="📢 پیام همگانی", callback_data="admin:broadcast"),
                InlineKeyboardButton(text="📨 ارسال مستقیم", callback_data="admin:sendmsg"),
            ],
            [
                InlineKeyboardButton(text="🛠 مدیریت محتوا", callback_data="admin:menu_edit"),
                InlineKeyboardButton(text="🗑 حذف کاربر", callback_data="admin:delete_user"),
            ],
            [
                InlineKeyboardButton(text="💎 تنظیمات VIP", callback_data="admin:vip_settings"),
                InlineKeyboardButton(text="💰 تنظیم قیمت اشتراک", callback_data="admin:vip_global_settings"),
            ],
            [
                InlineKeyboardButton(text=toggle_label, callback_data="admin:toggle_bot", style=toggle_style),
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
            [InlineKeyboardButton(text="📢 ویرایش اطلاعیه‌ها", callback_data="admin:edit_announcements")],
            [InlineKeyboardButton(text="❓ ویرایش سوالات متداول", callback_data="admin:edit_faq")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")],
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

# ---------- تابع زمینه‌ساز قبل از قوانین ----------
async def send_rules_and_join_button(user) -> None:
    text = RULES_TEXT
    if GROUP_RULES_URL:
        text += f"\n\n🔗 متنِ کامل: {GROUP_RULES_URL}"
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✅ قوانین را می‌پذیرم و عضو می‌شوم", callback_data="accept_rules")]
        ]
    )
    await bot.send_message(chat_id=user.id, text=text, reply_markup=keyboard)

async def process_pending_requests():
    state = load_bot_state()
    pending = state.get("pending_requests", [])
    if not pending:
        return
    logger.info("شروع پردازش %d درخواست معلق", len(pending))
    for user_id in pending:
        try:
            user = await bot.get_chat(user_id)
            await send_rules_and_join_button(user)
            logger.info("پیام قوانین به کاربر %s ارسال شد", user_id)
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
async def handle_start(message: Message, command: CommandObject = None):
    user_id = message.from_user.id
    await mark_funnel_entry(user_id)
    await send_with_action(message.chat.id, "typing", 0.5)

    # بررسی لینک مستقیم VIP
    if command and command.args and command.args.strip() == "vip":
        if VIP_GROUP_CHAT_ID is None:
            await message.answer("گروه VIP هنوز راه‌اندازی نشده است.")
            return
        caption, keyboard, image_id = await render_vip_page(0)
        if image_id:
            await message.answer_photo(photo=image_id, caption=caption, reply_markup=keyboard)
        else:
            await message.answer(caption, reply_markup=keyboard)
        return

    # اگر کاربر قبلاً عضو شده باشد، پنل را نشان بده
    if await is_user_member(user_id) or load_user_data(user_id) is not None:
        await message.answer(
            "🏛 <b>به رواق خوش آمدید</b>\n\n"
            "از پنل زیر یکی از گزینه‌ها را انتخاب کنید:",
            reply_markup=user_panel_keyboard()
        )
    else:
        # ارسال قوانین
        await send_rules_and_join_button(message.from_user)

# ---------- پذیرش قوانین و عضویت ----------
@dp.callback_query(F.data == "accept_rules")
async def cb_accept_rules(callback: CallbackQuery):
    user = callback.from_user
    user_id = user.id

    # ذخیره اطلاعات پایه کاربر
    user_data = {
        "user_id": user_id,
        "username": user.username,
        "full_name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
        "joined_at": datetime.utcnow().isoformat(),
    }
    await save_user_data(user_id, user_data)
    await increment_stat("total_joined")

    # تأیید عضویت در گروه
    try:
        await bot.approve_chat_join_request(chat_id=GROUP_CHAT_ID, user_id=user_id)
        await callback.answer("✅ عضویت شما تأیید شد!")
        await callback.message.delete()
        await callback.message.answer(
            "🏛 <b>به رواق خوش آمدید</b>\n\n"
            "از پنل زیر یکی از گزینه‌ها را انتخاب کنید:",
            reply_markup=user_panel_keyboard()
        )
    except Exception as e:
        logger.warning("تایید عضویت کاربر %s ممکن نشد: %s", user_id, e)
        await callback.answer("خطا در تأیید عضویت. لطفاً دوباره تلاش کنید.", show_alert=True)

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
                text=(
                    "🔴 <b>عضویت موقتاً بسته است</b>\n\n"
                    "درِ رواق برای عضوگیری بسته شده.\n"
                    "به محضِ فعال‌سازی، به شما اطلاع داده خواهد شد."
                )
            )
        except Exception as e:
            logger.warning("ارسال پیام خاموشی به کاربر %s ممکن نشد: %s", user.id, e)
        pending = state.get("pending_requests", [])
        if user.id not in pending:
            pending.append(user.id)
            state["pending_requests"] = pending
            await save_bot_state(state)
        return

    # ارسال قوانین
    await send_rules_and_join_button(user)

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

async def handle_member_left(user) -> None:
    # همان کد قبلی (اختصاری)
    pass

# ==============================================================
#  بخش پنل کاربری
# ==============================================================

class ContactAdminStates(StatesGroup):
    waiting_for_message = State()

class ProfileStates(StatesGroup):
    waiting_interest = State()
    waiting_field = State()

@dp.callback_query(F.data == "menu:back")
async def cb_menu_back(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🏛 <b>به رواق خوش آمدید</b>\n\n"
        "از پنل زیر یکی از گزینه‌ها را انتخاب کنید:",
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

    if key == "profile":
        user_id = callback.from_user.id
        user_data = load_user_data(user_id)
        golden_data = load_golden_users().get(str(user_id))

        if not user_data:
            await callback.answer("اطلاعات شما یافت نشد. لطفاً دوباره درخواست عضویت دهید.", show_alert=True)
            return

        text = f"📊 <b>پروفایل من</b>\n\n"
        text += f"👤 {html_escape(user_data.get('full_name', 'نامشخص'))}\n"
        text += f"🆔 {user_id}\n"
        if golden_data:
            text += f"🌟 وضعیت: <b>طلایی</b>\n"
            text += f"🎯 علاقه‌مندی: {golden_data.get('interest', 'ثبت نشده')}\n"
            text += f"📝 زمینه: {golden_data.get('field', 'ثبت نشده')}\n"
        else:
            text += f"🌟 وضعیت: <b>عادی</b>\n"

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="✏️ ویرایش اطلاعات", callback_data="profile:edit")],
                [InlineKeyboardButton(text="🔙 بازگشت به پنل", callback_data="menu:back")],
            ]
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return

    if key == "vip":
        if VIP_GROUP_CHAT_ID is None:
            await callback.answer("گروه VIP هنوز راه‌اندازی نشده است.", show_alert=True)
            return
        caption, keyboard, image_id = await render_vip_page(0)
        if image_id:
            await callback.message.edit_media(
                media=InputMediaPhoto(media=image_id, caption=caption, show_caption_above_media=True),
                reply_markup=keyboard,
            )
        else:
            await callback.message.edit_text(caption, reply_markup=keyboard)
        await callback.answer()
        return

    if key == "topics":
        await callback.message.edit_text(
            "📚 <b>راهنمای تاپیک‌های رواق</b>\n\n"
            "لطفاً یکی از تاپیک‌های زیر را انتخاب کنید:",
            reply_markup=topics_panel_keyboard()
        )
        await callback.answer()
        return

    if key == "join":
        config = load_menu_config()
        invite_link = config["settings"].get("group_invite_link", GROUP_INVITE_LINK)
        await callback.message.edit_text(
            f"🔗 لینک دعوت گروه:\n{invite_link}",
            reply_markup=user_panel_keyboard()
        )
        await callback.answer()
        return

    if key == "my_status":
        user_id = callback.from_user.id
        await send_with_action(callback.message.chat.id, "typing", 1.0)
        is_member = await is_user_member(user_id)
        if is_member:
            status_text = "✅ شما عضو گروه هستید."
        else:
            status_text = "❌ شما عضو گروه نیستید."
        await callback.message.edit_text(status_text, reply_markup=user_panel_keyboard())
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

    if key == "faq":
        config = load_menu_config()
        faq_items = config["settings"].get("faq", [])
        if faq_items:
            faq_text = "\n".join([f"❓ {item['q']}\n📝 {item['a']}" for item in faq_items])
        else:
            faq_text = "هنوز سوالی ثبت نشده است."
        await callback.message.edit_text(faq_text, reply_markup=user_panel_keyboard())
        await callback.answer()
        return

    if key == "social":
        config = load_menu_config()
        social = config["settings"]["social"]
        text = f"ما را دنبال کنید:\nاینستاگرام: {social.get('instagram', '')}\nکانال: {social.get('channel', '')}"
        await callback.message.edit_text(text, reply_markup=user_panel_keyboard())
        await callback.answer()
        return

    if key == "announcements":
        config = load_menu_config()
        announcements = config["settings"].get("announcements", [])
        if announcements:
            text = "\n".join([f"▪️ {a}" for a in announcements])
        else:
            text = "📢 هیچ اطلاعیه‌ای وجود ندارد."
        await callback.message.edit_text(text, reply_markup=user_panel_keyboard())
        await callback.answer()
        return

    # سایر گزینه‌ها
    await callback.message.edit_text("این گزینه در حال توسعه است.", reply_markup=user_panel_keyboard())
    await callback.answer()

# ---------- ویرایش پروفایل و ارتقا به طلایی ----------
@dp.callback_query(F.data == "profile:edit")
async def cb_profile_edit(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing=False)  # همیشه ویرایش جدید
    await callback.message.edit_text(
        "🌟 <b>تبدیل به کاربر طلایی</b>\n\n"
        "با پاسخ به دو سؤال زیر، به جمع کاربران طلایی رواق بپیوندید.\n\n"
        "سؤال ۱: علاقه‌مندی اصلی شما در معماری چیست؟",
        reply_markup=profile_interest_keyboard()
    )
    await callback.answer()

def profile_interest_keyboard() -> InlineKeyboardMarkup:
    interests = [
        "طراحی معماری",
        "نقشه‌کشی و اجرا",
        "گرافیک و پست‌پرو",
        "نرم‌افزارهای تخصصی",
        "مدیریت پروژه",
        "پایداری و محیط‌زیست",
        "تاریخ و نظریه",
        "سایر"
    ]
    buttons = []
    for i in range(0, len(interests), 2):
        row = []
        row.append(InlineKeyboardButton(text=interests[i], callback_data=f"prof_int:{interests[i]}"))
        if i+1 < len(interests):
            row.append(InlineKeyboardButton(text=interests[i+1], callback_data=f"prof_int:{interests[i+1]}"))
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 انصراف", callback_data="menu:back")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

@dp.callback_query(F.data.startswith("prof_int:"))
async def cb_profile_interest(callback: CallbackQuery, state: FSMContext):
    interest = callback.data.split(":", 1)[1]
    await state.update_data(interest=interest)
    await state.set_state(ProfileStates.waiting_field)
    await callback.message.edit_text(
        f"✅ علاقه‌مندی شما ثبت شد.\n\n"
        "سؤال ۲: زمینهٔ موردعلاقه شما برای پیشرفت حرفه‌ای چیست؟\n"
        "(متن آزاد، مثلاً: «یادگیری نرم‌افزار BIM»)",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="🔙 انصراف", callback_data="menu:back")]]
        )
    )
    await callback.answer()

@dp.message(ProfileStates.waiting_field)
async def handle_profile_field(message: Message, state: FSMContext):
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=user_panel_keyboard())
        return

    data = await state.get_data()
    interest = data.get("interest")
    if not interest:
        await state.clear()
        await message.answer("خطا: لطفاً دوباره از پنل اقدام کنید.", reply_markup=user_panel_keyboard())
        return

    field = message.text.strip()
    if not field:
        await message.answer("لطفاً یک متن معتبر وارد کنید.")
        return

    user_id = message.from_user.id
    golden_data = {
        "interest": interest,
        "field": field,
        "updated_at": datetime.utcnow().isoformat()
    }
    await save_golden_user(user_id, golden_data)

    await state.clear()
    await message.answer(
        "🌟 <b>تبریک! شما کاربر طلایی رواق شدید.</b>\n\n"
        "از این پس می‌توانید از امکانات ویژه بهره‌مند شوید.\n"
        "برای مشاهده پروفایل خود، گزینهٔ «پروفایل من» را انتخاب کنید.",
        reply_markup=user_panel_keyboard()
    )

# ---------- ماژول VIP (نسخهٔ نهایی با ناوبری هوشمند) ----------
async def render_vip_page(index: int):
    categories = load_vip_categories()
    if not categories:
        return (
            "🌟 <b>گروه ویژه VIP</b>\n\nهنوز هیچ دسته‌بندی‌ای اضافه نشده. به‌زودی تکمیل می‌شود.",
            InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به پنل اصلی", callback_data="menu:back")]]),
            None
        )
    index = index % len(categories)
    cat = categories[index]

    desc_lines = cat.get('description', '').split('\n')
    desc_text = '\n'.join([html_escape(line) for line in desc_lines])

    caption = (
        f"🌟 <b>گروه ویژه VIP</b>\n"
        f"({to_persian_num(index + 1)}/{to_persian_num(len(categories))})\n\n"
        f"📦 <b>{html_escape(cat['name'])}</b>\n\n"
        f"{desc_text}\n\n"
        "💎 با خرید اشتراک، به تمام محتواهای این دسته‌بندی‌ها دسترسی کامل خواهید داشت."
    )

    rows = []
    nav_row = []
    if len(categories) > 1:
        if index > 0:
            nav_row.append(InlineKeyboardButton(text="◀️ قبلی", callback_data=f"vipnav:{index-1}"))
        if index < len(categories) - 1:
            nav_row.append(InlineKeyboardButton(text="بعدی ▶️", callback_data=f"vipnav:{index+1}"))
    if nav_row:
        rows.append(nav_row)

    rows.append([InlineKeyboardButton(text="💎 خرید اشتراک کامل", callback_data="vip:buy_subscription")])
    rows.append([InlineKeyboardButton(text="🔙 بازگشت به پنل اصلی", callback_data="menu:back")])
    keyboard = InlineKeyboardMarkup(inline_keyboard=rows)

    image_file_id = cat.get("image_file_id")
    return caption, keyboard, image_file_id

@dp.callback_query(F.data == "vip:open")
async def cb_vip_open(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    if VIP_GROUP_CHAT_ID is None:
        await callback.answer("گروه VIP هنوز راه‌اندازی نشده است.", show_alert=True)
        return
    caption, keyboard, image_id = await render_vip_page(0)
    if image_id:
        await callback.message.edit_media(
            media=InputMediaPhoto(media=image_id, caption=caption, show_caption_above_media=True),
            reply_markup=keyboard,
        )
    else:
        await callback.message.edit_text(caption, reply_markup=keyboard)
    await callback.answer()

@dp.callback_query(F.data.startswith("vipnav:"))
async def cb_vip_nav(callback: CallbackQuery):
    try:
        index = int(callback.data.split(":", 1)[1])
    except ValueError:
        index = 0
    caption, keyboard, image_id = await render_vip_page(index)
    if image_id:
        await callback.message.edit_media(
            media=InputMediaPhoto(media=image_id, caption=caption, show_caption_above_media=True),
            reply_markup=keyboard,
        )
    else:
        await callback.message.edit_text(caption, reply_markup=keyboard)
    await callback.answer()

# ---------- خرید اشتراک VIP ----------
class VipSubscriptionStates(StatesGroup):
    choosing_duration = State()
    waiting_for_receipt = State()

@dp.callback_query(F.data == "vip:buy_subscription")
async def cb_vip_buy_subscription(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    try:
        settings = load_vip_global_settings()
        prices = settings.get("prices", {})
        discount = settings.get("discount_percent", 0)

        text = "💎 <b>انتخاب مدت اشتراک VIP</b>\n\n"
        for months in (3, 6, 12):
            price = prices.get(str(months), 0)
            if discount > 0:
                final_price = int(price * (1 - discount / 100))
                text += (
                    f"▫️ {to_persian_num(months)} ماهه: "
                    f"<s>{format_toman(price)}</s> → {format_toman(final_price)} "
                    f"(تخفیف {to_persian_num(discount)}%)\n"
                )
            else:
                text += f"▫️ {to_persian_num(months)} ماهه: {format_toman(price)}\n"

        text += "\nلطفاً یکی از گزینه‌های بالا را انتخاب کنید."

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text=f"{to_persian_num(3)} ماهه", callback_data="vip:duration:3")],
                [InlineKeyboardButton(text=f"{to_persian_num(6)} ماهه", callback_data="vip:duration:6")],
                [InlineKeyboardButton(text=f"{to_persian_num(12)} ماهه", callback_data="vip:duration:12")],
                [InlineKeyboardButton(text="❌ انصراف", callback_data="vip:cancel_payment")],
            ]
        )
        await callback.message.delete()
        await callback.message.answer(text, reply_markup=keyboard)
        await state.set_state(VipSubscriptionStates.choosing_duration)
        await callback.answer()
    except Exception as e:
        logger.error(f"خطا در باز کردن صفحه خرید: {e}")
        await callback.answer("متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.", show_alert=True)

@dp.callback_query(F.data.startswith("vip:duration:"), VipSubscriptionStates.choosing_duration)
async def cb_vip_duration_chosen(callback: CallbackQuery, state: FSMContext):
    months = int(callback.data.split(":", 2)[2])
    settings = load_vip_global_settings()
    price = settings.get("prices", {}).get(str(months), 0)
    discount = settings.get("discount_percent", 0)
    if discount > 0:
        final_price = int(price * (1 - discount / 100))
    else:
        final_price = price

    await state.update_data(vip_months=months, vip_price=final_price)
    await state.set_state(VipSubscriptionStates.waiting_for_receipt)

    price_line = ""
    if discount > 0:
        price_line = (
            f"💰 مبلغ اصلی: <s>{format_toman(price)}</s>\n"
            f"💰 مبلغ پس از تخفیف {to_persian_num(discount)}%: <b>{format_toman(final_price)}</b>"
        )
    else:
        price_line = f"💰 مبلغ: <b>{format_toman(final_price)}</b>"

    text = sign(
        f"💳 <b>پرداختِ اشتراکِ VIP</b>\n\n"
        f"🗓 مدت: <b>{to_persian_num(months)} ماهه</b>\n"
        f"{price_line}\n\n"
        f"لطفاً مبلغ فوق را به شماره‌کارتِ زیر واریز کنید:\n\n"
        f"<code>{VIP_CARD_NUMBER}</code>\n"
        f"به نام: {html_escape(VIP_CARD_HOLDER)}\n\n"
        "(روی شماره‌کارت بزنید تا کپی شود)\n\n"
        "📸 پس از واریز، عکسِ فیش یا رسیدِ پرداخت را همین‌جا ارسال کنید.\n"
        "پس از تاییدِ ادمین، لینکِ ورود به گروهِ VIP برایتان ارسال می‌شود."
    )
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="❌ انصراف", callback_data="vip:cancel_payment")]]
    )
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()

@dp.callback_query(F.data == "vip:cancel_payment")
async def cb_vip_cancel_payment(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text("عملیاتِ خرید لغو شد.", reply_markup=user_panel_keyboard())
    await callback.answer()

@dp.message(VipSubscriptionStates.waiting_for_receipt)
async def handle_vip_receipt(message: Message, state: FSMContext):
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=user_panel_keyboard())
        return

    photo_file_id = None
    if message.photo:
        photo_file_id = message.photo[-1].file_id
    elif message.document and (message.document.mime_type or "").startswith("image/"):
        photo_file_id = message.document.file_id

    if not photo_file_id:
        await message.answer("لطفاً فقط عکسِ فیش یا رسیدِ پرداخت را ارسال کنید.")
        return

    data = await state.get_data()
    months = data.get("vip_months")
    price = data.get("vip_price")
    if not months or not price:
        await state.clear()
        await message.answer("مسیرِ خرید قطع شده. لطفاً دوباره از پنلِ VIP اقدام کنید.", reply_markup=user_panel_keyboard())
        return

    user = message.from_user
    payment_id = f"pay_{uuid.uuid4().hex[:10]}"
    payment_record = {
        "id": payment_id,
        "user_id": user.id,
        "user_display": user.full_name or str(user.id),
        "username": user.username,
        "category_id": "all",
        "category_name": "اشتراک کامل VIP",
        "months": months,
        "price": price,
        "photo_file_id": photo_file_id,
        "status": "pending",
        "requested_at": datetime.utcnow().isoformat(),
        "admin_messages": [],
    }

    payments = load_vip_payments()
    payments[payment_id] = payment_record
    await save_vip_payments(payments)
    await state.clear()

    await message.answer(
        sign(
            "✅ <b>رسید شما دریافت شد</b>\n\n"
            "فیشِ پرداخت برای بررسیِ ادمین ارسال شد.\n"
            "به‌محضِ تایید، لینکِ ورود به گروهِ VIP برایتان ارسال می‌شود."
        )
    )

    username_part = f"@{user.username}" if user.username else f"<code>{user.id}</code>"
    caption = (
        f"💳 <b>درخواستِ جدیدِ اشتراکِ VIP</b>\n\n"
        f"👤 {html_escape(user.full_name or str(user.id))} ({username_part})\n"
        f"🗓 مدت: <b>{to_persian_num(months)} ماهه</b>\n"
        f"💰 مبلغ: <b>{format_toman(price)}</b>\n\n"
        f"شناسه پرداخت: <code>{payment_id}</code>"
    )
    for admin_id in ADMIN_IDS:
        try:
            sent = await bot.send_photo(
                chat_id=admin_id,
                photo=photo_file_id,
                caption=caption,
                reply_markup=vip_admin_decision_keyboard(payment_id),
            )
            payment_record["admin_messages"].append({"chat_id": admin_id, "message_id": sent.message_id})
        except Exception as e:
            logger.warning("ارسالِ درخواستِ پرداخت به ادمین %s ممکن نشد: %s", admin_id, e)

    payments = load_vip_payments()
    if payment_id in payments:
        payments[payment_id]["admin_messages"] = payment_record["admin_messages"]
        await save_vip_payments(payments)

def vip_admin_decision_keyboard(payment_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="✅ تایید و ارسالِ لینک", callback_data=f"vipadm:approve:{payment_id}"),
            InlineKeyboardButton(text="❌ رد کردن", callback_data=f"vipadm:reject:{payment_id}"),
        ]]
    )

@dp.callback_query(F.data.startswith("vipadm:"))
async def cb_vip_admin_decision(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ دسترسی ندارید.", show_alert=True)
        return

    _, action, payment_id = callback.data.split(":", 2)
    payments = load_vip_payments()
    payment = payments.get(payment_id)
    if not payment:
        await callback.answer("این درخواست دیگر یافت نشد.", show_alert=True)
        return
    if payment["status"] != "pending":
        await callback.answer("این درخواست قبلاً بررسی شده است.", show_alert=True)
        return

    user_id = payment["user_id"]
    admin_name = callback.from_user.full_name or str(callback.from_user.id)

    if action == "reject":
        payment["status"] = "rejected"
        payment["decided_by"] = callback.from_user.id
        payment["decided_at"] = datetime.utcnow().isoformat()
        payments[payment_id] = payment
        await save_vip_payments(payments)

        for ref in payment.get("admin_messages", []):
            try:
                await bot.edit_message_reply_markup(chat_id=ref["chat_id"], message_id=ref["message_id"], reply_markup=None)
            except Exception:
                pass
        try:
            await callback.message.edit_caption(caption=callback.message.caption + f"\n\n❌ رد شد توسط {html_escape(admin_name)}")
        except Exception:
            pass

        try:
            await bot.send_message(
                chat_id=user_id,
                text=sign(
                    "❌ <b>پرداختِ شما تایید نشد</b>\n\n"
                    "ممکن است رسیدِ ارسالی خوانا نبوده یا مبلغ مطابقت نداشته باشد.\n"
                    "برای پیگیری، از «📞 ارتباط با ادمین» استفاده کنید یا دوباره از پنلِ VIP اقدام کنید."
                ),
            )
        except Exception as e:
            logger.warning("اطلاع‌رسانیِ ردِ پرداخت به کاربر %s ممکن نشد: %s", user_id, e)

        await callback.answer("درخواست رد شد.")
        return

    if action == "approve":
        if VIP_GROUP_CHAT_ID is None:
            await callback.answer("آیدیِ گروهِ VIP تنظیم نشده است.", show_alert=True)
            return

        try:
            invite = await bot.create_chat_invite_link(
                chat_id=VIP_GROUP_CHAT_ID,
                member_limit=1,
                name=f"vip-{user_id}-{payment['months']}m",
            )
        except Exception as e:
            logger.error("ساختِ لینکِ دعوتِ VIP ناموفق بود: %s", e)
            await callback.answer(f"خطا در ساختِ لینکِ دعوت: {e}", show_alert=True)
            return

        now = datetime.utcnow()
        days = VIP_MONTHS_TO_DAYS.get(payment["months"], payment["months"] * 30)
        end = now + timedelta(days=days)

        subs = load_vip_subscriptions()
        user_subs = subs.setdefault(str(user_id), [])
        user_subs.append({
            "category_id": "all",
            "category_name": "اشتراک کامل VIP",
            "months": payment["months"],
            "price": payment["price"],
            "start": now.isoformat(),
            "end": end.isoformat(),
            "status": "active",
            "reminded": False,
        })
        await save_vip_subscriptions(subs)

        payment["status"] = "approved"
        payment["decided_by"] = callback.from_user.id
        payment["decided_at"] = now.isoformat()
        payments[payment_id] = payment
        await save_vip_payments(payments)

        for ref in payment.get("admin_messages", []):
            try:
                await bot.edit_message_reply_markup(chat_id=ref["chat_id"], message_id=ref["message_id"], reply_markup=None)
            except Exception:
                pass
        try:
            await callback.message.edit_caption(caption=callback.message.caption + f"\n\n✅ تایید شد توسط {html_escape(admin_name)}")
        except Exception:
            pass

        end_jalali = format_jalali_datetime(end)
        try:
            await bot.send_message(
                chat_id=user_id,
                text=sign(
                    "✅ <b>پرداختِ شما تایید شد</b>\n\n"
                    f"🗓 مدت: <b>{to_persian_num(payment['months'])} ماهه</b>\n"
                    f"⏳ تا تاریخِ: <b>{end_jalali}</b>\n\n"
                    "برای ورود به گروهِ VIP از لینکِ زیر استفاده کنید (این لینک فقط یک‌بار قابلِ استفاده است):"
                ),
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[[InlineKeyboardButton(text="🌟 ورود به گروهِ VIP", url=invite.invite_link)]]
                ),
            )
        except Exception as e:
            logger.warning("ارسالِ لینکِ VIP به کاربر %s ممکن نشد: %s", user_id, e)

        await callback.answer("تایید شد و لینک ارسال شد.")
        return

# ---------- بررسی انقضای اشتراک VIP ----------
async def vip_expiry_checker_loop() -> None:
    while True:
        try:
            await _check_vip_expirations()
        except Exception as e:
            logger.error("خطا در بررسیِ انقضای اشتراک‌های VIP: %s", e)
        await asyncio.sleep(3 * 3600)

async def _check_vip_expirations() -> None:
    subs = load_vip_subscriptions()
    now = datetime.utcnow()
    changed = False

    for user_id_str, user_subs in subs.items():
        for sub in user_subs:
            if sub.get("status") != "active":
                continue
            end = datetime.fromisoformat(sub["end"])
            remaining_days = (end - now).total_seconds() / 86400

            if 0 < remaining_days <= 3 and not sub.get("reminded"):
                sub["reminded"] = True
                changed = True
                try:
                    await bot.send_message(
                        chat_id=int(user_id_str),
                        text=sign(
                            f"⏳ <b>یادآوریِ اشتراکِ VIP</b>\n\n"
                            f"اشتراکِ VIP شما تا "
                            f"<b>{to_persian_num(int(remaining_days) + 1)}</b> روزِ دیگر به پایان می‌رسد.\n"
                            "برای تمدید، از پنلِ VIP اقدام کنید."
                        ),
                        reply_markup=InlineKeyboardMarkup(
                            inline_keyboard=[[InlineKeyboardButton(text="🌟 تمدیدِ اشتراک", callback_data="vip:open")]]
                        ),
                    )
                except Exception:
                    pass

            elif remaining_days <= 0:
                sub["status"] = "expired"
                changed = True
                if VIP_GROUP_CHAT_ID is not None:
                    try:
                        await bot.ban_chat_member(chat_id=VIP_GROUP_CHAT_ID, user_id=int(user_id_str))
                        await bot.unban_chat_member(chat_id=VIP_GROUP_CHAT_ID, user_id=int(user_id_str), only_if_banned=True)
                    except Exception as e:
                        logger.warning("حذفِ خودکارِ کاربرِ %s از گروهِ VIP ممکن نشد: %s", user_id_str, e)
                try:
                    await bot.send_message(
                        chat_id=int(user_id_str),
                        text=sign(
                            f"⌛️ اشتراکِ VIP شما به پایان رسید.\n"
                            "برای تمدید، از پنلِ VIP اقدام کنید."
                        ),
                        reply_markup=InlineKeyboardMarkup(
                            inline_keyboard=[[InlineKeyboardButton(text="🌟 تمدیدِ اشتراک", callback_data="vip:open")]]
                        ),
                    )
                except Exception:
                    pass
                if NOTIFY_CHAT_ID_INT:
                    try:
                        await bot.send_message(
                            chat_id=NOTIFY_CHAT_ID_INT,
                            text=f"⌛️ اشتراکِ VIP کاربر <code>{user_id_str}</code> به پایان رسید.",
                        )
                    except Exception:
                        pass

    if changed:
        await save_vip_subscriptions(subs)

# ---------- پنل تنظیمات VIP (ادمین) با چیدمان دو ستونی ----------
class VipCategoryStates(StatesGroup):
    waiting_new_name = State()
    waiting_new_desc = State()
    waiting_edit_value = State()
    waiting_banner = State()

class VipGlobalSettingsStates(StatesGroup):
    waiting_price3 = State()
    waiting_price6 = State()
    waiting_price12 = State()
    waiting_discount = State()

async def build_vip_settings_text() -> str:
    categories = load_vip_categories()
    if not categories:
        return "💎 <b>تنظیماتِ VIP</b>\n\nهنوز هیچ دسته‌بندی‌ای اضافه نشده است."
    lines = ["💎 <b>تنظیماتِ VIP</b>\n", "دسته‌بندی‌های فعلی:\n"]
    for i, cat in enumerate(categories, 1):
        lines.append(f"{to_persian_num(i)}. <b>{html_escape(cat['name'])}</b>\n   {html_escape(cat.get('description', ''))[:60]}...")
    return "\n".join(lines)

def vip_settings_keyboard() -> InlineKeyboardMarkup:
    categories = load_vip_categories()
    buttons = []
    for cat in categories:
        buttons.append([
            InlineKeyboardButton(text=f"✏️ {cat['name']}", callback_data=f"vipset:edit:{cat['id']}"),
            InlineKeyboardButton(text="🗑", callback_data=f"vipset:delete:{cat['id']}"),
        ])
    buttons.append([InlineKeyboardButton(text="➕ افزودن دسته‌بندی جدید", callback_data="vipset:add")])
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def vip_category_edit_keyboard(cat_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✏️ ویرایشِ نام", callback_data=f"vipset:field:{cat_id}:name")],
            [InlineKeyboardButton(text="✏️ ویرایشِ توضیحات", callback_data=f"vipset:field:{cat_id}:description")],
            [InlineKeyboardButton(text="🖼 آپلود/تغییر بنر", callback_data=f"vipset:banner:{cat_id}")],
            [InlineKeyboardButton(text="🗑 حذف بنر", callback_data=f"vipset:delete_banner:{cat_id}")],
            [InlineKeyboardButton(text="🔙 بازگشت به لیست", callback_data="admin:vip_settings")],
        ]
    )

@dp.callback_query(F.data == "vipset:add")
async def cb_vipset_add(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    await state.set_state(VipCategoryStates.waiting_new_name)
    await callback.message.edit_text(
        "➕ <b>افزودنِ دسته‌بندیِ جدید</b>\n\nنامِ دسته‌بندی را ارسال کنید:\n(برای لغو، /cancel بفرستید)",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()

@dp.message(VipCategoryStates.waiting_new_name)
async def handle_vipset_new_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    await state.update_data(new_cat_name=message.text.strip())
    await state.set_state(VipCategoryStates.waiting_new_desc)
    await message.answer("توضیحاتِ دسته‌بندی را ارسال کنید (می‌توانید از خط جدید استفاده کنید):")

@dp.message(VipCategoryStates.waiting_new_desc)
async def handle_vipset_new_desc(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    data = await state.get_data()
    categories = load_vip_categories()
    new_cat = {
        "id": f"cat_{uuid.uuid4().hex[:8]}",
        "name": data["new_cat_name"],
        "description": message.text.strip(),
        "created_at": datetime.utcnow().isoformat(),
        "image_file_id": None,
    }
    categories.append(new_cat)
    await save_vip_categories(categories)
    await state.clear()
    await message.answer(
        f"✅ دسته‌بندیِ «{html_escape(new_cat['name'])}» با موفقیت اضافه شد.",
        reply_markup=admin_back_keyboard(),
    )

@dp.callback_query(F.data.startswith("vipset:edit:"))
async def cb_vipset_edit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    cat_id = callback.data.split(":", 2)[2]
    cat = get_vip_category(cat_id)
    if not cat:
        await callback.answer("این دسته‌بندی دیگر موجود نیست.", show_alert=True)
        return
    text = (
        f"✏️ <b>ویرایشِ دسته‌بندی</b>\n\n"
        f"نام: <b>{html_escape(cat['name'])}</b>\n"
        f"توضیحات:\n{html_escape(cat.get('description', ''))}\n\n"
        "کدام مورد را می‌خواهید ویرایش کنید؟"
    )
    await callback.message.edit_text(text, reply_markup=vip_category_edit_keyboard(cat_id))
    await callback.answer()

@dp.callback_query(F.data.startswith("vipset:field:"))
async def cb_vipset_field(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    _, _, cat_id, field = callback.data.split(":", 3)
    cat = get_vip_category(cat_id)
    if not cat:
        await callback.answer("این دسته‌بندی دیگر موجود نیست.", show_alert=True)
        return

    await state.update_data(edit_cat_id=cat_id, edit_field=field)
    await state.set_state(VipCategoryStates.waiting_edit_value)

    prompts = {
        "name": "نامِ جدید را ارسال کنید:",
        "description": "توضیحاتِ جدید را ارسال کنید (می‌توانید چند خط باشد):",
    }
    await callback.message.edit_text(
        prompts.get(field, "مقدارِ جدید را ارسال کنید:"),
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()

@dp.message(VipCategoryStates.waiting_edit_value)
async def handle_vipset_edit_value(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return

    data = await state.get_data()
    cat_id = data.get("edit_cat_id")
    field = data.get("edit_field")
    categories = load_vip_categories()
    cat = next((c for c in categories if c["id"] == cat_id), None)
    if not cat:
        await state.clear()
        await message.answer("این دسته‌بندی دیگر موجود نیست.", reply_markup=admin_panel_keyboard())
        return

    if field == "name":
        cat["name"] = message.text.strip()
    elif field == "description":
        cat["description"] = message.text.strip()

    await save_vip_categories(categories)
    await state.clear()
    await message.answer("✅ با موفقیت به‌روزرسانی شد.", reply_markup=admin_back_keyboard())

@dp.callback_query(F.data.startswith("vipset:banner:"))
async def cb_vipset_banner(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    cat_id = callback.data.split(":", 2)[2]
    cat = get_vip_category(cat_id)
    if not cat:
        await callback.answer("دسته‌بندی یافت نشد.", show_alert=True)
        return
    await state.update_data(edit_cat_id=cat_id)
    await state.set_state(VipCategoryStates.waiting_banner)
    await callback.message.edit_text(
        "🖼 لطفاً یک عکس برای بنر این دسته‌بندی ارسال کنید.\n"
        "عکس می‌تواند هر فرمتی داشته باشد (JPEG, PNG و غیره).\n"
        "(برای لغو، /cancel بفرستید)",
        reply_markup=admin_back_keyboard(),
    )
    await callback.answer()

@dp.message(VipCategoryStates.waiting_banner, F.photo)
async def handle_vipset_banner_photo(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    cat_id = data.get("edit_cat_id")
    if not cat_id:
        await state.clear()
        await message.answer("خطا: شناسه دسته‌بندی مشخص نیست.", reply_markup=admin_panel_keyboard())
        return
    file_id = message.photo[-1].file_id
    categories = load_vip_categories()
    cat = next((c for c in categories if c["id"] == cat_id), None)
    if not cat:
        await state.clear()
        await message.answer("دسته‌بندی دیگر موجود نیست.", reply_markup=admin_panel_keyboard())
        return
    cat["image_file_id"] = file_id
    await save_vip_categories(categories)
    await state.clear()
    await message.answer(
        f"✅ بنر برای دسته‌بندی «{html_escape(cat['name'])}» با موفقیت آپلود شد.",
        reply_markup=admin_back_keyboard(),
    )

@dp.callback_query(F.data.startswith("vipset:delete_banner:"))
async def cb_vipset_delete_banner(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    cat_id = callback.data.split(":", 2)[2]
    categories = load_vip_categories()
    cat = next((c for c in categories if c["id"] == cat_id), None)
    if not cat:
        await callback.answer("دسته‌بندی یافت نشد.", show_alert=True)
        return
    cat.pop("image_file_id", None)
    await save_vip_categories(categories)
    await callback.answer("✅ بنر حذف شد.")
    await callback.message.edit_text(
        f"✏️ <b>ویرایشِ دسته‌بندی</b>\n\n"
        f"نام: <b>{html_escape(cat['name'])}</b>\n"
        f"توضیحات:\n{html_escape(cat.get('description', ''))}\n\n"
        "کدام مورد را می‌خواهید ویرایش کنید؟",
        reply_markup=vip_category_edit_keyboard(cat_id),
    )

@dp.callback_query(F.data.startswith("vipset:delete:"))
async def cb_vipset_delete(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    cat_id = callback.data.split(":", 2)[2]
    cat = get_vip_category(cat_id)
    if not cat:
        await callback.answer("این دسته‌بندی دیگر موجود نیست.", show_alert=True)
        return
    await callback.message.edit_text(
        f"⚠️ آیا از حذفِ دسته‌بندیِ «{html_escape(cat['name'])}» مطمئنید؟",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="✅ بله، حذف شود", callback_data=f"vipset:delete_confirm:{cat_id}")],
            [InlineKeyboardButton(text="❌ انصراف", callback_data="admin:vip_settings")],
        ]),
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("vipset:delete_confirm:"))
async def cb_vipset_delete_confirm(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    cat_id = callback.data.split(":", 2)[2]
    categories = [c for c in load_vip_categories() if c["id"] != cat_id]
    await save_vip_categories(categories)
    await callback.answer("✅ حذف شد.")
    await callback.message.edit_text(await build_vip_settings_text(), reply_markup=vip_settings_keyboard())

# ---------- تنظیمات قیمت‌های جهانی ----------
async def build_vip_global_settings_text() -> str:
    settings = load_vip_global_settings()
    prices = settings.get("prices", {})
    discount = settings.get("discount_percent", 0)
    return (
        f"💰 <b>تنظیم قیمت اشتراک VIP</b>\n\n"
        f"قیمت ۳ ماهه: {format_toman(prices.get('3', 0))}\n"
        f"قیمت ۶ ماهه: {format_toman(prices.get('6', 0))}\n"
        f"قیمت ۱۲ ماهه: {format_toman(prices.get('12', 0))}\n"
        f"تخفیف درصدی: {to_persian_num(discount)}%\n"
        f"آخرین بروزرسانی: {format_jalali_datetime(datetime.fromisoformat(settings.get('updated_at', datetime.utcnow().isoformat())))}"
    )

def vip_global_settings_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✏️ قیمت ۳ ماهه", callback_data="vipglob:price3")],
            [InlineKeyboardButton(text="✏️ قیمت ۶ ماهه", callback_data="vipglob:price6")],
            [InlineKeyboardButton(text="✏️ قیمت ۱۲ ماهه", callback_data="vipglob:price12")],
            [InlineKeyboardButton(text="✏️ تخفیف درصدی", callback_data="vipglob:discount")],
            [InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")],
        ]
    )

@dp.callback_query(F.data.startswith("vipglob:"))
async def cb_vipglob(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    field = callback.data.split(":", 1)[1]
    state_map = {
        "price3": VipGlobalSettingsStates.waiting_price3,
        "price6": VipGlobalSettingsStates.waiting_price6,
        "price12": VipGlobalSettingsStates.waiting_price12,
        "discount": VipGlobalSettingsStates.waiting_discount,
    }
    await state.set_state(state_map.get(field))
    prompts = {
        "price3": "قیمت جدیدِ ۳ ماهه را (فقط عدد، تومان) وارد کنید:",
        "price6": "قیمت جدیدِ ۶ ماهه را (فقط عدد، تومان) وارد کنید:",
        "price12": "قیمت جدیدِ ۱۲ ماهه را (فقط عدد، تومان) وارد کنید:",
        "discount": "تخفیف درصدی جدید را (فقط عدد، مثل 10 برای ۱۰٪) وارد کنید:",
    }
    await callback.message.edit_text(prompts.get(field, "مقدار جدید را وارد کنید:"), reply_markup=admin_back_keyboard())
    await callback.answer()

async def _parse_price_or_discount(message: Message) -> tuple[int | None, bool]:
    if not message.text:
        return None, False
    digits = message.text.strip().replace(",", "").replace("٬", "")
    persian_to_en = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
    digits = digits.translate(persian_to_en)
    if not digits.isdigit():
        return None, False
    return int(digits), True

@dp.message(VipGlobalSettingsStates.waiting_price3)
async def handle_vipglob_price3(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    price, ok = await _parse_price_or_discount(message)
    if not ok:
        await message.answer("❌ لطفاً فقط عدد وارد کنید.")
        return
    settings = load_vip_global_settings()
    settings["prices"]["3"] = price
    await save_vip_global_settings(settings)
    await state.clear()
    await message.answer("✅ قیمت ۳ ماهه به‌روزرسانی شد.", reply_markup=admin_back_keyboard())

@dp.message(VipGlobalSettingsStates.waiting_price6)
async def handle_vipglob_price6(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    price, ok = await _parse_price_or_discount(message)
    if not ok:
        await message.answer("❌ لطفاً فقط عدد وارد کنید.")
        return
    settings = load_vip_global_settings()
    settings["prices"]["6"] = price
    await save_vip_global_settings(settings)
    await state.clear()
    await message.answer("✅ قیمت ۶ ماهه به‌روزرسانی شد.", reply_markup=admin_back_keyboard())

@dp.message(VipGlobalSettingsStates.waiting_price12)
async def handle_vipglob_price12(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    price, ok = await _parse_price_or_discount(message)
    if not ok:
        await message.answer("❌ لطفاً فقط عدد وارد کنید.")
        return
    settings = load_vip_global_settings()
    settings["prices"]["12"] = price
    await save_vip_global_settings(settings)
    await state.clear()
    await message.answer("✅ قیمت ۱۲ ماهه به‌روزرسانی شد.", reply_markup=admin_back_keyboard())

@dp.message(VipGlobalSettingsStates.waiting_discount)
async def handle_vipglob_discount(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer("لغو شد.", reply_markup=admin_panel_keyboard())
        return
    discount, ok = await _parse_price_or_discount(message)
    if not ok or discount < 0 or discount > 100:
        await message.answer("❌ لطفاً عددی بین ۰ تا ۱۰۰ وارد کنید.")
        return
    settings = load_vip_global_settings()
    settings["discount_percent"] = discount
    await save_vip_global_settings(settings)
    await state.clear()
    await message.answer(f"✅ تخفیف به {to_persian_num(discount)}% تنظیم شد.", reply_markup=admin_back_keyboard())

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

async def stop_vip_expiry_checker(app: web.Application) -> None:
    task = app.get("vip_expiry_task")
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

    # بازیابی تسک‌های حضور و غیاب (اختیاری)
    # ...

    app["vip_expiry_task"] = asyncio.create_task(vip_expiry_checker_loop())
    logger.info("ربات «رواق» با موفقیت راه‌اندازی شد! 🏛")

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", handle_health)
    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_startup.append(start_self_ping)
    app.on_cleanup.append(stop_self_ping)
    app.on_cleanup.append(stop_vip_expiry_checker)
    return app

if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)