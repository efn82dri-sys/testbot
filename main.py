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
    MenuButtonWebApp,
    Message,
    PollAnswer,
    WebAppInfo,
)
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from openpyxl import Workbook

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

# مسیر فایلی که پاسخ‌های فرم در آن ذخیره می‌شود
DATA_FILE = Path(__file__).parent / "data" / "submissions.jsonl"
DATA_FILE.parent.mkdir(exist_ok=True)

# مسیر فایلی که آمار ساده‌ی ورود/خروج اعضا برای دستور /stats در آن نگه‌داری می‌شود
STATS_FILE = Path(__file__).parent / "data" / "stats.json"

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
        "دقیقاً دنبال چه فایلی بودید؟ اگر جواب بدید به ادمین‌ها اطلاع می‌دم "
        "تا در اولین فرصت تهیه‌اش کنند 🙏",
    ),
    (
        "پیام‌های زیاد گروه رو شلوغ می‌کرد",
        "می‌تونید گروه رو در حالت Mute بذارید و فقط پیام‌های Pin‌شده "
        "(فایل‌های مهم) رو دنبال کنید، بدون شلوغی اعلان‌ها 🔕",
    ),
    (
        "فعلاً به این موضوع نیاز ندارم",
        "کاملاً قابل درک‌ه؛ هر وقت دوباره نیاز داشتید، درهای گروه همیشه "
        "به‌رویتون بازه 🙌",
    ),
    (
        "دلیل دیگه‌ای دارم",
        "ممنون میشیم دلیلش رو مستقیم با ادمین در میون بذارید تا بتونیم "
        "بهتر بشیم 🙏",
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
        "📊 <b>آمار گروه</b>\n\n"
        f"👥 تعداد اعضای فعلی: <b>{member_count}</b>\n"
        f"📝 تعداد فرم‌های تکمیل‌شده: <b>{form_count}</b>\n"
        f"➕ کل ورودهای ثبت‌شده: <b>{total_joined}</b>\n"
        f"➖ کل خروج‌های ثبت‌شده: <b>{total_left}</b>\n"
        f"📉 نرخ ترک گروه: <b>{leave_rate:.1f}٪</b>\n\n"
        "<i>توجه: شمارش ورود/خروج فقط از زمانی که این نسخه از ربات فعال "
        "شده حساب می‌شود، نه از ابتدای عمر گروه.</i>"
    )


def build_export_file() -> BufferedInputFile | None:
    """فایل اکسل خروجی فرم‌ها را می‌سازد، یا None اگر هنوز فرمی ثبت نشده باشد."""
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

    # هدر ستون‌ها از اجتماع تمام کلیدهای موجود در همه‌ی رکوردها ساخته می‌شود
    headers: list[str] = []
    for record in records:
        for key in record.keys():
            if key not in headers:
                headers.append(key)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "submissions"
    sheet.append(headers)
    for record in records:
        sheet.append([str(record.get(h, "")) for h in headers])

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return BufferedInputFile(buffer.read(), filename="submissions.xlsx")


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
        "سلام 👋\n"
        "برای عضویت در «مرجع فایل‌های معماری و عمران» ابتدا باید درخواست "
        "عضویت در گروه را ثبت کنید. بعد از ثبت درخواست، من به صورت خودکار "
        "فرم پذیرش را برایتان می‌فرستم."
    )


# --------------------------------------------------------------
# ۳) وقتی کسی برای عضویت در گروه «درخواست» می‌دهد
#    (این حالت وقتی فعال است که در تنظیمات گروه، گزینه‌ی
#     «تایید اعضای جدید توسط مدیر» روشن باشد)
# --------------------------------------------------------------
@dp.chat_join_request()
async def handle_join_request(join_request: ChatJoinRequest):
    if join_request.chat.id != GROUP_CHAT_ID:
        return  # این گروه، همان گروهی نیست که ربات برایش تنظیم شده

    user = join_request.from_user
    logger.info("درخواست عضویت جدید از %s (%s)", user.full_name, user.id)

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
                f"سلام {user.first_name} عزیز 👋\n\n"
                "درخواست عضویت شما در «مرجع فایل‌های معماری و عمران» ثبت شد.\n"
                "برای تکمیل عضویت، لطفاً فرم کوتاه زیر را پر کنید. این فرم "
                "کمتر از یک دقیقه زمان می‌برد."
            ),
            reply_markup=keyboard,
        )
    except Exception as e:
        # اگر کاربر قبلاً /start را به ربات نزده باشد، تلگرام ممکن است
        # اجازه نده پیام خصوصی بفرستیم. در این حالت فقط لاگ می‌کنیم.
        logger.warning("نمی‌توان به کاربر %s پیام داد: %s", user.id, e)


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
                f"سلام {user.first_name} 👋\n"
                "متوجه شدیم گروه «مرجع فایل‌های معماری و عمران» رو ترک کردید. "
                "خوشحال می‌شیم بدونیم دلیلش چی بوده تا اگه لازمه گروه رو بهتر کنیم:"
            ),
        )

        sent_poll = await bot.send_poll(
            chat_id=user.id,
            question="چرا گروه رو ترک کردید؟",
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
            text="دلمون براتون تنگ می‌شه! هر وقت خواستید، از دکمه‌ی زیر دوباره بهمون ملحق بشید 👇",
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
        await message.answer("لطفاً یک پیام متنی بفرستید (یا /cancel برای انصراف).")
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
                text="✅ عضویت شما تایید شد!\nخوش آمدید به «مرجع فایل‌های معماری و عمران».",
                reply_markup=keyboard,
            )
        else:
            await bot.send_message(
                chat_id=user_id,
                text=(
                    "اطلاعات شما ثبت شد، اما در تایید خودکار عضویت مشکلی پیش آمد. "
                    "لطفاً کمی صبر کنید یا با ادمین گروه تماس بگیرید."
                ),
            )
    except Exception as e:
        logger.warning("ارسال پیام تاییدیه به کاربر %s ممکن نشد: %s", user_id, e)

    return web.json_response({"ok": approved})


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
        menu_button=MenuButtonWebApp(text="فرم عضویت", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    logger.info("Menu Button روی مینی‌اپ تنظیم شد.")


def create_app() -> web.Application:
    app = web.Application()

    # فایل‌های estatic صفحه فرم (index.html / style.css / script.js / فونت‌ها)
    webapp_dir = Path(__file__).parent / "webapp"
    app.router.add_static("/webapp/", path=str(webapp_dir), show_index=False)

    # مسیر دریافتی که فرم برای ثبت نهایی صدا می‌زند
    app.router.add_post("/api/submit", handle_submit)

    # مسیر دریافت پیام‌های تلگرام (Webhook)
    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)

    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=PORT)
