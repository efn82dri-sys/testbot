# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «تایید عضویت» — مرجع فایل‌های معماری و عمران
====================================================================
این فایل قلب پروژه است. کارهایی که انجام می‌دهد:

۱) وقتی کسی درخواست عضویت در گروه می‌دهد (Join Request)، ربات به صورت
   خصوصی برایش پیام می‌دهد و دکمه‌ی «تکمیل فرم پذیرش» (WebApp) را نشان
   می‌دهد.
۲) کاربر داخل WebApp فرم را پر می‌کند و دکمه «ثبت نهایی» را می‌زند.
۳) صفحه‌ی فرم (script.js) داده را مستقیماً با یک درخواست HTTP به آدرس
   /api/submit روی همین سرور می‌فرستد (به‌همراه Telegram.WebApp.initData
   برای اثبات هویت کاربر).
   نکته فنی: تابع Telegram.WebApp.sendData فقط برای مینی‌اپ‌هایی کار
   می‌کند که از «Keyboard Button» باز شده باشند، نه از دکمه‌ی زیر پیام
   (Inline Button) که در این پروژه استفاده شده — برای همین به‌جایش از
   یک درخواست HTTP معمولی استفاده می‌کنیم.
۴) ربات امضای initData را با استفاده از توکن ربات بررسی می‌کند (تا
   مطمئن شود درخواست واقعاً از تلگرام آمده)، داده را در
   data/submissions.jsonl ذخیره می‌کند، درخواست عضویت کاربر را تایید
   (Approve) می‌کند و پیام «شما تایید شدید» را برایش می‌فرستد.

نکته مهم: این فایل هم «ربات» است و هم یک وب‌سرور کوچک که فایل‌های
پوشه‌ی webapp/ (صفحه فرم) را روی اینترنت در دسترس می‌گذارد؛ چون
Telegram WebApp حتماً باید روی یک آدرس HTTPS واقعی باز شود، نه روی
سیستم شخصی شما.
====================================================================
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qsl

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ParseMode
from aiogram.filters import Command, CommandObject
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
# ۱) تنظیمات — این مقادیر را از متغیرهای محیطی (Environment
#    Variables) می‌خوانیم تا توکن ربات داخل کد نوشته نشود.
#    نحوه‌ی تنظیم این مقادیر روی Render در فایل README.md توضیح
#    داده شده است.
# --------------------------------------------------------------
BOT_TOKEN = os.environ["BOT_TOKEN"]                 # توکن ربات از BotFather
GROUP_CHAT_ID = int(os.environ["GROUP_CHAT_ID"])    # آیدی عددی گروه (منفی، با - شروع می‌شود)
GROUP_INVITE_LINK = os.environ.get("GROUP_INVITE_LINK", "")  # لینک عمومی گروه (برای دکمه بازگشت)

# آیدی عددی کانال یا آیدی عددی خود مالک/ادمین که گزارش‌های عضویت
# (عضو جدید / ترک عضو) برایش ارسال می‌شود. اگر کانال است باید ربات
# در آن ادمین با دسترسی ارسال پیام باشد؛ اگر آیدی شخصی است باید آن
# شخص قبلاً یک بار به ربات /start زده باشد. اگر خالی بماند، این
# گزارش‌ها اصلاً ارسال نمی‌شوند.
NOTIFY_CHAT_ID = os.environ.get("NOTIFY_CHAT_ID", "").strip()

# آیدی عددی کسانی که اجازه‌ی استفاده از دستورات مدیریتی
# (/stats ،/export ،/broadcast) را دارند — با ویرگول جدا از هم،
# مثل: 111111111,222222222
ADMIN_IDS = {
    int(x) for x in os.environ.get("ADMIN_IDS", "").replace(" ", "").split(",") if x
}

# آدرس عمومی سایت شما بعد از دیپلوی روی Render، مثل:
# https://my-bot.onrender.com
WEBHOOK_HOST = os.environ["WEBHOOK_HOST"].rstrip("/")
WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

# آدرس صفحه‌ی فرم که داخل WebApp باز می‌شود
WEBAPP_URL = f"{WEBHOOK_HOST}/webapp/index.html"

PORT = int(os.environ.get("PORT", 8080))

# فاصله‌ی زمانیِ پینگِ خودکار به خودِ سرویس (برحسب ثانیه) تا رندر به‌خاطرِ
# بی‌فعالیتی سرویس را نخوابانَد. رندرِ رایگان معمولاً بعد از ۱۵ دقیقه بدونِ
# ترافیک، سرویس را می‌خوابانَد؛ برای اطمینان، هر ۱۰ دقیقه پینگ می‌زنیم.
PING_INTERVAL_SECONDS = int(os.environ.get("PING_INTERVAL_SECONDS", 10 * 60))

# مسیر فایلی که پاسخ‌های فرم در آن ذخیره می‌شود
DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)

# مسیر فایلی که آمار ساده‌ی ورود/خروج اعضا برای دستور /stats در آن نگه‌داری می‌شود
STATS_FILE = Path(__file__).parent / "data" / "stats.json"

# مسیر فایلی که شماره تلفنِ تاییدشده‌ی هر کاربر (بعد از احراز هویت با
# دکمه‌ی «اشتراک‌گذاری شماره تلفن») در آن نگه‌داری می‌شود. کلید = آیدی
# عددی کاربر (به‌صورت رشته)، مقدار = شماره تلفن.
PHONES_FILE = Path(__file__).parent / "data" / "phones.json"

# برای نمایش خواناتر ستون «نحوه آشنایی» در خروجی اکسل — چون در فرم فقط
# کدِ گزینه (instagram, friends, ...) ذخیره می‌شود، نه متن فارسی‌اش.
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

# قفل ساده برای اینکه چند نفر همزمان با هم فایل داده را خراب نکنند
_write_lock = asyncio.Lock()

# نگاشت poll_id -> user_id برای نظرسنجی‌های «دلیل ترک گروه» که هنوز
# پاسخی به آن‌ها داده نشده — تا وقتی کاربر گزینه‌ای را انتخاب کند،
# بتوانیم بفهمیم پاسخ مربوط به کدام کاربر است.
_pending_leave_polls: dict[str, int] = {}

# گزینه‌های نظرسنجی «چرا گروه را ترک کردید؟» به همراه پاسخ متناسب
# با هر گزینه که بعد از رأی کاربر برایش فرستاده می‌شود.
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
    """آمار ساده‌ی تعداد کل ورودها/خروج‌ها را می‌خواند (از زمانی که این قابلیت فعال شده)."""
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
    """شماره‌تلفن‌های تاییدشده را می‌خواند: {"123456789": "+98912...", ...}"""
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


# حالت‌های گفت‌وگوی «ارسال پیام همگانی» — وقتی ادمین دکمه‌ی «ارسال
# پیام همگانی» را می‌زند، ربات منتظر می‌ماند متن پیام را بفرستد،
# سپس یک پیش‌نمایش با دکمه‌ی تایید/انصراف نشان می‌دهد.
class BroadcastStates(StatesGroup):
    waiting_for_text = State()
    confirming = State()


def collect_form_user_ids() -> set[int]:
    """آیدی عددی همه‌ی کسانی که تا الان فرم را پر کرده‌اند."""
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


def build_export_file() -> BufferedInputFile | None:
    """فایل اکسل مرتب خروجی فرم‌ها را می‌سازد، یا None اگر هنوز فرمی ثبت نشده باشد."""
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

    # جدیدترین فرم‌ها بالای لیست باشند (مرور راحت‌تر برای ادمین)
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

    # عرض هر ستون را متناسب با بلندترین محتوایش تنظیم کن
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


# --------------------------------------------------------------
# صفحه‌کلیدهای شیشه‌ای (Inline) پنل مدیریت
# --------------------------------------------------------------
def admin_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 آمار گروه", callback_data="admin:stats")],
            [InlineKeyboardButton(text="📄 خروجی اکسل فرم‌ها", callback_data="admin:export")],
            [InlineKeyboardButton(text="📢 ارسال پیام همگانی", callback_data="admin:broadcast")],
            [InlineKeyboardButton(text="❌ بستن", callback_data="admin:close")],
        ]
    )


def admin_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 بازگشت به منو", callback_data="admin:menu")]]
    )


# --------------------------------------------------------------
# ۲) وقتی کاربر روی /start کلیک می‌کند
#    (این فقط یک پیام خوش‌آمد است؛ فرآیند اصلی از طریق درخواست
#     عضویت در گروه شروع می‌شود — مرحله ۳)
# --------------------------------------------------------------
@dp.message(Command("start"))
async def handle_start(message: Message):
    await message.answer(
        "به رواق خوش آمدی؛ درگاهِ تخصصیِ فایل‌های معماری و عمران.\n"
        "این‌جا انبارِ دانشِ هزاران معمار و مهندس است. برای ورود، کافی‌ست "
        "درخواستِ عضویت در گروه را ثبت کنی. مسیرِ بعدی را برایت می‌گشایم."
    )


# --------------------------------------------------------------
# ۳) وقتی کسی برای عضویت در گروه «درخواست» می‌دهد
#    (این حالت وقتی فعال است که در تنظیمات گروه، گزینه‌ی
#     «تایید اعضای جدید توسط مدیر» روشن باشد)
# --------------------------------------------------------------
def phone_request_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 اشتراک‌گذاری شماره تلفن", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


async def send_webapp_form_message(user) -> None:
    """پیام «تکمیل فرم پذیرش» را برای کاربری که شماره‌اش تایید شده ارسال می‌کند."""
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
        return  # این گروه، همان گروهی نیست که ربات برایش تنظیم شده

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

    # اگر قبلاً یک‌بار شماره‌اش را تایید کرده، مستقیم فرم را بفرست
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
        # اگر کاربر قبلاً /start را به ربات نزده باشد، تلگرام ممکن است
        # اجازه نده پیام خصوصی بفرستیم. در این حالت فقط لاگ می‌کنیم.
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)


# --------------------------------------------------------------
# ۳.۰) دریافت شماره تلفن اشتراک‌گذاشته‌شده — این همان مرحله‌ی
#      احراز هویت است که باید قبل از باز شدن فرم (مینی‌اپ) طی شود.
# --------------------------------------------------------------
@dp.message(F.contact)
async def handle_contact_shared(message: Message):
    contact = message.contact
    user = message.from_user

    # فقط شماره‌ی خودِ همان کاربر پذیرفته می‌شود، نه یک مخاطب فوروارد‌شده
    if contact.user_id != user.id:
        await message.answer(
            "این‌جا فقط شماره‌ی خودت کلیدِ ورود است. لطفاً با همان دکمه، "
            "شماره‌ی خودت را به اشتراک بگذار.",
            reply_markup=phone_request_keyboard(),
        )
        return

    await save_phone(user.id, contact.phone_number)
    await message.answer("مسیر باز شد ✅", reply_markup=ReplyKeyboardRemove())
    await send_webapp_form_message(user)


# --------------------------------------------------------------
# ۳.۱) وقتی وضعیت عضویت کسی داخل گروه تغییر می‌کند (عضو جدید، ترک
#      گروه، اخراج و ...). از همین یک هندلر هم برای اطلاع‌رسانیِ
#      «عضو جدید» به مالک/کانال استفاده می‌کنیم و هم برای شروع
#      فرآیند «چرا ترک کردید؟» وقتی کسی گروه را ترک می‌کند.
#      نکته: برای اینکه این آپدیت‌ها اصلاً به ربات برسند، باید در
#      on_startup مقدار allowed_updates را صریحاً شامل chat_member
#      کنیم (پایین‌تر انجام شده).
# --------------------------------------------------------------
@dp.chat_member()
async def handle_chat_member_update(update: ChatMemberUpdated):
    if update.chat.id != GROUP_CHAT_ID:
        return

    old_status = update.old_chat_member.status
    new_status = update.new_chat_member.status
    user = update.new_chat_member.user

    if user.is_bot:
        return  # تغییر وضعیت خودِ ربات‌ها (از جمله خودمان) را نادیده می‌گیریم

    # حالت ۱: کاربر تازه عضو گروه شده (چه از طریق تایید فرم، چه از
    # طریق لینک دعوت مستقیم)
    became_member = new_status == ChatMemberStatus.MEMBER and old_status != ChatMemberStatus.MEMBER
    if became_member:
        await increment_stat("total_joined")
        await notify_new_member(user)
        return

    # حالت ۲: کاربر گروه را ترک کرده یا اخراج شده
    left_group = (
        old_status == ChatMemberStatus.MEMBER
        and new_status in (ChatMemberStatus.LEFT, ChatMemberStatus.KICKED)
    )
    if left_group:
        await increment_stat("total_left")
        await handle_member_left(user)


async def notify_new_member(user) -> None:
    """به کانال یا پیوی مالک، خبر عضویت موفق یک عضو جدید را می‌دهد."""
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
    """وقتی کاربری گروه را ترک می‌کند: پیام + نظرسنجی دلیل ترک + تلاش برای بازگرداندنش."""
    # به مالک/کانال اطلاع بده
    if NOTIFY_CHAT_ID:
        username_part = f"@{user.username}" if user.username else f"<code>{user.id}</code>"
        try:
            await bot.send_message(
                chat_id=NOTIFY_CHAT_ID,
                text=f"🚪 یک عضو گروه را ترک کرد:\n👤 {user.full_name} ({username_part})",
            )
        except Exception as e:
            logger.warning("ارسال گزارش ترک عضو ممکن نشد: %s", e)

    # به خودِ کاربر پیام بده (اگر چت خصوصی با ربات باز باشد)
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
        # کاربر ربات را بلاک کرده یا هرگز /start نزده — کاری از دستمان برنمی‌آید
        logger.warning("نمی‌توان به کاربر خارج‌شده %s پیام داد: %s", user.id, e)


# --------------------------------------------------------------
# ۳.۲) پاسخ کاربر به نظرسنجی «چرا گروه رو ترک کردید؟»
# --------------------------------------------------------------
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


# --------------------------------------------------------------
# ۳.۳) پنل مدیریت شیشه‌ای — فقط برای آیدی‌های داخل ADMIN_IDS
#      با /admin باز می‌شود؛ همچنین /stats، /export و /broadcast
#      به‌عنوان میان‌بر مستقیم هم نگه داشته شده‌اند.
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
        # فاصله‌ی کوتاه بین ارسال‌ها تا به محدودیت نرخ ارسال تلگرام نخوریم
        await asyncio.sleep(0.05)
    return sent, failed


# ---------- دکمه‌های پنل ----------

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
# ۴) بررسی امضای initData — تایید می‌کند که درخواست واقعاً از داخل
#    مینی‌اپِ همین ربات آمده و کسی آن را جعل نکرده است.
#    (روش رسمی تلگرام: core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
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
# ۵) وقتی کاربر داخل WebApp دکمه «ثبت نهایی» را می‌زند
#    داده‌ی فرم از طریق یک درخواست HTTP (fetch) به این‌جا می‌رسد
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

    record = {
        "user_id": user_id,
        "username": user.get("username"),
        "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "phone": get_saved_phone(user_id),
        "submitted_at": datetime.utcnow().isoformat(),
        **form_data,
    }

    # ذخیره‌ی رکورد در فایل (هر خط یک JSON مستقل = فرمت JSONL)
    async with _write_lock:
        with open(DATA_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    logger.info("فرم کاربر %s ذخیره شد.", user_id)

    # تایید درخواست عضویت کاربر در گروه
    approved = False
    try:
        await bot.approve_chat_join_request(chat_id=GROUP_CHAT_ID, user_id=user_id)
        approved = True
    except Exception as e:
        logger.warning("تایید عضویت کاربر %s ممکن نشد: %s", user_id, e)

    # یک پیام تاییدیه هم داخل چت خصوصی با ربات بفرست (جدا از خودِ WebApp)
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
# ۵.۵) نگه‌داشتنِ سرویس بیدار روی رندر — رندرِ رایگان بعد از مدتی
#      بی‌فعالیتیِ HTTP، سرویس را می‌خوابانَد. برای جلوگیری از این
#      اتفاق، یک مسیرِ سبکِ سلامت (/health) می‌سازیم و از داخلِ خودِ
#      برنامه هر PING_INTERVAL_SECONDS ثانیه یک درخواست به همان مسیر
#      می‌فرستیم تا رندر همیشه ترافیک ببیند و سرویس را فعال نگه دارد.
#      نکته: این کار فقط از «خوابیدنِ سرویس» جلوگیری می‌کند؛ اگر روی
#      رندر دیسکِ پایدار (Persistent Disk) وصل نکرده باشید، فایل‌های
#      data/ (submissions.jsonl ،phones.json و ...) با هر دیپلوی یا
#      ری‌استارتِ سرویس همچنان از بین می‌روند — پینگ به‌تنهایی مشکلِ
#      ذخیره‌سازیِ غیرپایدار را حل نمی‌کند.
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
# ۶) راه‌اندازی وب‌سرور: هم Webhook ربات، هم فایل‌های WebApp
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

    # دکمه‌ی کنار جعبه‌ی پیام (Menu Button) را روی لینک مینی‌اپ تنظیم می‌کنیم
    # تا کاربر بدون نیاز به دیدن پیام درخواست عضویت هم بتواند فرم را باز کند.
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="mini app", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    logger.info("Menu Button روی مینی‌اپ تنظیم شد.")


def create_app() -> web.Application:
    app = web.Application()

    # فایل‌های estatic صفحه فرم (index.html / style.css / script.js / فونت‌ها)
    webapp_dir = Path(__file__).parent / "webapp"
    app.router.add_static("/webapp/", path=str(webapp_dir), show_index=False)

    # مسیر دریافتی که فرم برای ثبت نهایی صدا می‌زند
    app.router.add_post("/api/submit", handle_submit)

    # مسیرِ سبکِ سلامت — هم برای پینگِ خودکارِ خودمان و هم برای هر ابزارِ
    # مانیتورینگِ بیرونی (مثل UptimeRobot) قابلِ استفاده است.
    app.router.add_get("/health", handle_health)

    # مسیر دریافت پیام‌های تلگرام (Webhook)
    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)

    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_startup.append(start_self_ping)
    app.on_cleanup.append(stop_self_ping)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)
