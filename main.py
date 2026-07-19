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
from pathlib import Path
from urllib.parse import parse_qsl

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import (
    ChatJoinRequest,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

# --------------------------------------------------------------
# ۱) تنظیمات — این مقادیر را از متغیرهای محیطی (Environment
#    Variables) می‌خوانیم تا توکن ربات داخل کد نوشته نشود.
#    نحوه‌ی تنظیم این مقادیر روی Render در فایل README.md توضیح
#    داده شده است.
# --------------------------------------------------------------
BOT_TOKEN = os.environ["BOT_TOKEN"]                 # توکن ربات از BotFather
GROUP_CHAT_ID = int(os.environ["GROUP_CHAT_ID"])    # آیدی عددی گروه (منفی، با - شروع می‌شود)
GROUP_INVITE_LINK = os.environ.get("GROUP_INVITE_LINK", "")  # لینک عمومی گروه (برای دکمه بازگشت)

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# قفل ساده برای اینکه چند نفر همزمان با هم فایل داده را خراب نکنند
_write_lock = asyncio.Lock()


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
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    logger.info("Webhook تنظیم شد روی: %s", WEBHOOK_URL)


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
