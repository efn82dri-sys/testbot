# -*- coding: utf-8 -*-
"""
====================================================================
 ربات تلگرام «رواق» — نسخهٔ بهبود شدهٔ موبایل-فریندلی
UX شبیه برنامه‌های پریمیوم + سیستم پیام‌های شخصی‌سازی شده
====================================================================
"""

# ================== اضافه‌نمایی به بخشِ تنظیمات ==================

# 1️⃣ ایموجی‌های مخصوص کاربران VIP و طلایی
USER_BADGES = {
    "vip": "👑",           # برای کاربران VIP
    "gold": "⭐",          # برای کاربران طلایی
    "premium": "✨",       # برای سایر پریمیوم‌ها
    "moderator": "🛡️",    # برای مدیرین
}

# 2️⃣ الگوی ذخیره‌سازی پیام‌های شخصی‌سازی شده
CUSTOM_MESSAGES_FILE = Path(__file__).parent / "data" / "custom_messages.json"

# 3️⃣ فایل صندوقِ ورودیِ موبایل-فریندلی (برای کش کردن تعداد درخواست‌ها)
MOBILE_INBOX_CACHE_FILE = Path(__file__).parent / "data" / "mobile_inbox_cache.json"


# ================== کلاسِ مدیریتِ پیام‌های شخصی‌سازی شده ==================

class CustomMessagesManager:
    """
    مدیریت پیام‌های از قبل تعریف شدهٔ قابلِ شخصی‌سازی برای هر کاربر
    مثال: ادمین پیام‌های پیش‌فرض تنظیم می‌کند و کاربران می‌تونند تغییر دهند
    """
    
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.data: dict = {}
        self._load()
    
    def _load(self) -> None:
        if self.file_path.exists():
            try:
                self.data = json.loads(self.file_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.data = {}
        else:
            self._save_defaults()
    
    def _save_defaults(self) -> None:
        """ایجاد پیام‌های پیش‌فرض"""
        self.data = {
            "default": {
                "welcome": "🌱 خوش آمدید به رواق!\n\nما یک جامعهٔ زنده‌یِ معمارانِ کار‌فرما هستیم.",
                "approval": "✅ درخواستِ عضویتِ شما تایید شد!\n\n🎉 خوش آمدید به خانوادهٔ رواق",
                "rejection": "❌ متأسفانه درخواستِ عضویتِ شما تایید نشد.\n\nلطفاً دوباره سعی کنید.",
                "pending": "⏳ درخواستِ عضویتِ شما در انتظارِ بررسی است.",
            },
            "vip": {
                "welcome": "👑 خوش آمدید به اِکسکلوسیو!\n\nشما به‌عنوانِ عضوِ VIP وارد شدید.",
                "approval": "✅ شما اکنون به VIPِ رواق پیوستید! 🌟",
            },
            "gold": {
                "welcome": "⭐ خوش آمدید، عضوِ طلایی!\n\nشما دسترسیِ ویژه دارید.",
            }
        }
        self._persist()
    
    def _persist(self) -> None:
        self.file_path.parent.mkdir(exist_ok=True)
        self.file_path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
    
    def get_message(self, user_type: str = "default", message_key: str = "welcome", user_id: int | None = None) -> str:
        """
        دریافت پیام شخصی‌سازی شده
        ترجیح: پیام شخصیِ کاربر > پیام تیپ کاربری > پیام پیش‌فرض
        """
        if user_id and "custom" in self.data and str(user_id) in self.data["custom"]:
            if message_key in self.data["custom"][str(user_id)]:
                return self.data["custom"][str(user_id)][message_key]
        
        if user_type in self.data and message_key in self.data[user_type]:
            return self.data[user_type][message_key]
        
        if message_key in self.data["default"]:
            return self.data["default"][message_key]
        
        return f"[پیام '{message_key}' برای '{user_type}' تعریف نشده]"
    
    def set_custom_message(self, user_id: int, message_key: str, text: str) -> None:
        """تنظیمِ پیامِ شخصیِ کاربر"""
        if "custom" not in self.data:
            self.data["custom"] = {}
        if str(user_id) not in self.data["custom"]:
            self.data["custom"][str(user_id)] = {}
        
        self.data["custom"][str(user_id)][message_key] = text
        self._persist()
    
    def list_templates(self, user_type: str = "default") -> dict:
        """لیستِ تمامِ پیام‌های قابلِ شخصی‌سازی"""
        return self.data.get(user_type, self.data["default"])


custom_messages_manager = CustomMessagesManager(CUSTOM_MESSAGES_FILE)


# ================== کلاسِ مدیریتِ صندوقِ ورودیِ موبایل ==================

class MobileInboxManager:
    """
    مدیریتِ کمپکتِ صندوقِ ورودیِ برای موبایل
    - کش کردنِ تعدادِ درخواست‌های معلق
    - نشان‌دادنِ یک دکمهٔ کوچک با شمارِ درخواست‌ها
    - منوِ تاپیک‌بندی شدهٔ تعاملی برای تایید/رد کردن
    """
    
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.cache: dict = {}
        self._load()
    
    def _load(self) -> None:
        if self.file_path.exists():
            try:
                self.cache = json.loads(self.file_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.cache = {}
    
    def _persist(self) -> None:
        self.file_path.parent.mkdir(exist_ok=True)
        self.file_path.write_text(json.dumps(self.cache, ensure_ascii=False), encoding="utf-8")
    
    def cache_pending_count(self, group_id: int, count: int) -> None:
        """کش کردنِ تعدادِ درخواست‌های معلق"""
        self.cache[str(group_id)] = {
            "pending_count": count,
            "updated_at": datetime.utcnow().isoformat()
        }
        self._persist()
    
    def get_pending_count(self, group_id: int) -> int:
        """دریافت تعدادِ کش شدهٔ درخواست‌های معلق"""
        return self.cache.get(str(group_id), {}).get("pending_count", 0)
    
    def create_compact_button_row(self, group_id: int, pending_count: int) -> list[InlineKeyboardButton]:
        """ایجاد یک ردیفِ کمپکت با دکمهٔ درخواست‌های معلق"""
        self.cache_pending_count(group_id, pending_count)
        
        if pending_count == 0:
            return [InlineKeyboardButton(
                text="✅ تمامِ درخواست‌ها پردازش شدند",
                callback_data="inbox:no_pending"
            )]
        
        return [InlineKeyboardButton(
            text=f"⏳ {pending_count} درخواستِ معلق",
            callback_data=f"inbox:view_pending:{group_id}"
        )]


mobile_inbox_manager = MobileInboxManager(MOBILE_INBOX_CACHE_FILE)


# ================== تابعِ ساختِ نام تاپیک با بج ==================

def build_topic_name_with_badge(user_id: int, username: str, user_type: str = "normal") -> str:
    """
    ساختِ نام تاپیک با ایموجیِ مخصوص برای کاربران VIP/طلایی
    مثال: "👑 علی | @username" یا "⭐ فاطمه | @username"
    """
    badge = USER_BADGES.get(user_type, "")
    
    if badge:
        return f"{badge} {username}"
    return username


# ================== تابعِ پاسخِ تعاملی برای صندوقِ ورودی موبایل ==================

async def handle_mobile_inbox_view(callback: CallbackQuery, group_id: int, bot: Bot):
    """
    نشان‌دادنِ منوِ تاپیک‌بندی شدهٔ درخواست‌های معلق
    هر درخواست در یک تاپیک جداگانه با دکمه‌های تایید/رد
    """
    try:
        pending_requests = _pending_requests.get(int(group_id), [])
        
        if not pending_requests:
            await callback.answer("✅ درخواستی معلق نیست!", show_alert=False)
            return
        
        # ایجاد منوِ پیمایشی
        buttons = []
        for idx, req in enumerate(pending_requests[:5], 1):  # نمایش حداکثر 5 درخواست در یک بار
            user_id = req.get("user_id")
            username = req.get("username", f"User {user_id}")
            full_name = req.get("full_name", "")
            
            display_text = f"{idx}. {full_name or username}"
            buttons.append([
                InlineKeyboardButton(
                    text=display_text,
                    callback_data=f"inbox:details:{user_id}"
                )
            ])
        
        # دکمهٔ بازگشت
        buttons.append([
            InlineKeyboardButton(text="🔙 بازگشت", callback_data="menu:main")
        ])
        
        # اگر بیشتر از 5 درخواست باشد
        if len(pending_requests) > 5:
            buttons.append([
                InlineKeyboardButton(
                    text=f"➕ نمایشِ {len(pending_requests) - 5} درخواستِ دیگر",
                    callback_data="inbox:show_more"
                )
            ])
        
        await callback.message.edit_text(
            text=(
                f"📋 <b>صندوقِ ورودیِ درخواست‌های معلق</b>\n\n"
                f"تعدادِ درخواست‌های معلق: <b>{len(pending_requests)}</b>\n\n"
                f"لطفاً یکی رو انتخاب کنید:"
            ),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
            parse_mode=ParseMode.HTML
        )
    except Exception as e:
        logger.error(f"خطا در handle_mobile_inbox_view: {e}")
        await callback.answer("❌ خطایی رخ داد", show_alert=True)


# ================== تابعِ نمایشِ جزئیاتِ درخواست با دکمه‌های تایید/رد ==================

async def handle_request_details_mobile(callback: CallbackQuery, user_id: int, bot: Bot):
    """
    نمایشِ جزئیاتِ یک درخواستِ خاص در موبایل
    با دکمه‌های بزرگ و واضح برای تایید/رد کردن
    """
    try:
        # دریافت اطلاعات درخواست
        pending_data = _pending_join_requests.get(int(user_id), {})
        
        if not pending_data:
            await callback.answer("❌ درخواست یافت نشد", show_alert=True)
            return
        
        full_name = pending_data.get("full_name", "نامشناس")
        education = pending_data.get("education", "نامشخص")
        referral = pending_data.get("referral", "نامشخص")
        created_at = pending_data.get("created_at", "نامشخص")
        
        # متنِ جزئیات
        details_text = (
            f"👤 <b>نام:</b> {full_name}\n"
            f"🎓 <b>سطحِ تحصیلی:</b> {education}\n"
            f"📍 <b>نحوهٔ آشنایی:</b> {referral}\n"
            f"📅 <b>زمانِ درخواست:</b> {created_at}\n\n"
            f"<b>آیا این درخواست رو تایید می‌کنید؟</b>"
        )
        
        # دکمه‌های تایید/رد (بزرگ و واضح برای موبایل)
        buttons = [
            [
                InlineKeyboardButton(text="✅ تایید", callback_data=f"inbox:approve:{user_id}"),
                InlineKeyboardButton(text="❌ رد", callback_data=f"inbox:reject:{user_id}")
            ],
            [InlineKeyboardButton(text="🔙 بازگشت", callback_data="inbox:view_pending:main")]
        ]
        
        await callback.message.edit_text(
            text=details_text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
            parse_mode=ParseMode.HTML
        )
    except Exception as e:
        logger.error(f"خطا در handle_request_details_mobile: {e}")
        await callback.answer("❌ خطایی رخ داد", show_alert=True)


# ================== کالبک‌های جدید برای صندوقِ ورودیِ موبایل ==================

@dp.callback_query(F.data.startswith("inbox:"))
async def handle_inbox_callbacks(callback: CallbackQuery, state: FSMContext):
    """
    مدیریتِ تمامِ کالبک‌های صندوقِ ورودی
    شامل: view_pending, details, approve, reject
    """
    data = callback.data
    
    try:
        if data.startswith("inbox:view_pending:"):
            group_id_str = data.split(":")[-1]
            if group_id_str != "main":
                await handle_mobile_inbox_view(callback, int(group_id_str), bot)
            else:
                await callback.message.edit_text("🔙 بازگشت به منوِ اصلی...")
        
        elif data.startswith("inbox:details:"):
            user_id = int(data.split(":")[-1])
            await handle_request_details_mobile(callback, user_id, bot)
        
        elif data.startswith("inbox:approve:"):
            user_id = int(data.split(":")[-1])
            # کدِ تایید درخواست (از کدِ موجود قرض کنید)
            await _approve_join_request(user_id, callback)
            await callback.answer("✅ درخواست تایید شد!", show_alert=False)
        
        elif data.startswith("inbox:reject:"):
            user_id = int(data.split(":")[-1])
            # کدِ رد درخواست (از کدِ موجود قرض کنید)
            await _reject_join_request(user_id, callback)
            await callback.answer("❌ درخواست رد شد", show_alert=False)
        
        elif data == "inbox:no_pending":
            await callback.answer("✅ تمامِ درخواست‌ها بررسی شدند!", show_alert=False)
    
    except Exception as e:
        logger.error(f"خطا در handle_inbox_callbacks: {e}")
        await callback.answer("❌ خطایی رخ داد", show_alert=True)


# ================== فنکشن برای نمایش صندوقِ ورودی در ادمین ==================

async def show_admin_inbox_button(user_id: int):
    """
    نمایشِ دکمهٔ صندوقِ ورودی برای ادمین (موبایل-فریندلی)
    این دکمه تعدادِ درخواست‌های معلق رو نشان می‌ده
    """
    if user_id not in ADMIN_IDS:
        return
    
    try:
        pending_count = len(_pending_join_requests)
        
        buttons = []
        if pending_count > 0:
            buttons.append(
                mobile_inbox_manager.create_compact_button_row(GROUP_CHAT_ID, pending_count)
            )
        else:
            buttons.append([InlineKeyboardButton(
                text="✅ تمامِ درخواست‌ها پردازش شدند",
                callback_data="inbox:no_pending"
            )])
        
        await bot.send_message(
            chat_id=user_id,
            text=f"📬 <b>صندوقِ ورودی</b>\n\n{pending_count} درخواستِ معلق برای بررسی",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons[0]) if buttons else None,
            parse_mode=ParseMode.HTML
        )
    except Exception as e:
        logger.error(f"خطا در show_admin_inbox_button: {e}")


# ================== اضافه‌نمایی به کالبک تایید درخواست ==================

async def handle_approve_join_with_badge(callback: CallbackQuery, user_id: int, user_type: str = "normal"):
    """
    تایید درخواست با ایجاد تاپیک با بج ویژه
    اگر کاربر VIP یا طلایی است، ایموجی مخصوص در نام تاپیک قرار می‌گیرد
    """
    try:
        user = await bot.get_chat(user_id)
        username = user.username or user.first_name or "Member"
        full_name = user.full_name or username
        
        # ساختِ نام تاپیک با بج
        topic_name = build_topic_name_with_badge(user_id, full_name, user_type)
        
        # ایجادِ تاپیک در گروهِ NOTIFY_CHAT_ID
        if NOTIFY_CHAT_ID_INT:
            try:
                topic = await bot.create_forum_topic(
                    chat_id=NOTIFY_CHAT_ID_INT,
                    name=topic_name
                )
                topic_id = topic.message_thread_id
            except Exception as e:
                logger.error(f"خطا در ایجادِ تاپیک: {e}")
                topic_id = None
        
        # ارسالِ پیامِ خوش‌آمد شخصی‌سازی شده
        welcome_message = custom_messages_manager.get_message(
            user_type=user_type,
            message_key="welcome",
            user_id=user_id
        )
        
        if topic_id:
            await bot.send_message(
                chat_id=NOTIFY_CHAT_ID_INT,
                text=welcome_message,
                message_thread_id=topic_id,
                parse_mode=ParseMode.HTML
            )
    
    except Exception as e:
        logger.error(f"خطا در handle_approve_join_with_badge: {e}")


# ================== FSM حالاتِ جدید برای شخصی‌سازی پیام ==================

class CustomMessageStates(StatesGroup):
    """حالاتِ FSM برای شخصی‌سازی پیام‌های پیش‌فرض"""
    choosing_template = State()
    editing_message = State()
    confirming = State()


# ================== کالبک برای ادمین برای شخصی‌سازی پیام‌ها ==================

@dp.callback_query(F.data == "admin:customize_messages")
async def admin_customize_messages(callback: CallbackQuery, state: FSMContext):
    """
    منوِ شخصی‌سازی پیام‌های پیش‌فرض برای ادمین
    """
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("❌ فقط ادمین‌ها می‌تونن این کار رو انجام دهند", show_alert=True)
        return
    
    templates = custom_messages_manager.list_templates("default")
    
    buttons = []
    for key in templates.keys():
        buttons.append([InlineKeyboardButton(
            text=f"✏️ {key}",
            callback_data=f"customize:edit:{key}"
        )])
    
    buttons.append([InlineKeyboardButton(text="🔙 بازگشت", callback_data="menu:admin")])
    
    await callback.message.edit_text(
        text="🎨 <b>شخصی‌سازی پیام‌های پیش‌فرض</b>\n\nلطفاً پیامی رو انتخاب کنید:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode=ParseMode.HTML
    )
    await state.set_state(CustomMessageStates.choosing_template)


@dp.callback_query(F.data.startswith("customize:edit:"))
async def start_message_edit(callback: CallbackQuery, state: FSMContext):
    """
    شروعِ ویرایشِ یک پیامِ خاص
    """
    message_key = callback.data.split(":")[-1]
    current_message = custom_messages_manager.get_message("default", message_key)
    
    await callback.message.edit_text(
        text=(
            f"✏️ <b>ویرایشِ پیام: {message_key}</b>\n\n"
            f"<b>متنِ فعلی:</b>\n<code>{current_message}</code>\n\n"
            f"لطفاً متنِ جدید رو ارسال کنید:"
        ),
        parse_mode=ParseMode.HTML
    )
    
    await state.update_data(message_key=message_key, current_message=current_message)
    await state.set_state(CustomMessageStates.editing_message)


@dp.message(CustomMessageStates.editing_message)
async def confirm_message_edit(message: Message, state: FSMContext):
    """
    تأیید ویرایشِ پیام
    """
    data = await state.get_data()
    message_key = data["message_key"]
    new_message = message.text
    
    # ذخیرهٔ پیام جدید
    custom_messages_manager.data["default"][message_key] = new_message
    custom_messages_manager._persist()
    
    await message.answer(
        text=f"✅ پیام '<code>{message_key}</code>' با موفقیت به‌روز شد!",
        parse_mode=ParseMode.HTML
    )
    
    await state.clear()


# ==================================================================
#  نکاتِ پیاده‌سازی برای بقیهٔ کدِ موجود
# ==================================================================

"""
برای یکپارچگی کاملِ این ویژگی‌ها با کدِ موجود:

1️⃣ زمانِ تایید درخواست (در تابعِ _approve_join_request):
   - تعیینِ user_type (vip, gold, normal)
   - فراخوانیِ handle_approve_join_with_badge()
   - ایجادِ تاپیک با نام سفارشی

2️⃣ زمانِ نمایشِ پیام‌های سیستمی:
   - جایگزینی متنِ سخت‌کدی شدهٔ پیش‌فرض با:
     custom_messages_manager.get_message(user_type, message_key, user_id)

3️⃣ برای صندوقِ ورودیِ موبایل:
   - اضافه‌کردنِ کالبک‌های inbox: به دستورِ handle_inbox_callbacks
   - نمایشِ دکمهٔ صندوق در منوِ ادمین

4️⃣ تغییراتِ دیتابیس:
   - اضافه‌کردنِ فیلدِ user_type به _pending_join_requests
   - مثال: {"user_id": 123, "user_type": "vip", ...}

5️⃣ برای Webhook:
   - اطمینان از اینکه NOTIFY_CHAT_ID دارایِ Topics فعال است
   - این شامل Permission "Manage Topics" برای ربات است
"""

# ==================================================================
#  چند نکتهٔ UX پیشرفتهٔ موبایل دیگر
# ==================================================================

"""
💡 پیشنهاداتِ حرفه‌ای برای تجربهٔ موبایل:

1. **Pagination هوشمند**:
   - نمایشِ ۲-۳ درخواست در یک بار
   - دکمهٔ "بیشتر" برای بار بعدی
   - کاهشِ scroll

2. **Swipe Actions** (اگه بتونید):
   - فعلاً تلگرام این رو نمی‌پذیرد ولی inline buttons کافیه

3. **Visual Hierarchy**:
   - بزرگ‌تر کردنِ دکمه‌های مهم (تایید/رد)
   - رنگ‌بندیِ ویژه برای اکشن‌های خطرناک (قرمز برای رد)

4. **Notification Badges**:
   - نشان دادنِ تعدادِ درخواست‌ها در دکمهٔ صندوق
   - استفاده از ایموجی برای الویت

5. **Caching و Performance**:
   - کش کردنِ تعدادِ درخواست‌ها (مثل mobile_inbox_manager)
   - کاهشِ فراخوانی‌های API

6. **Dark Mode Friendly**:
   - استفادهٔ ایموجی‌ها برای رنگ‌بندی (✅❌⏳👑⭐)
   - رنگ‌های neutral

7. **Error Handling**:
   - پیام‌های خطا کوتاه و واضح
   - دکمهٔ "دوباره سعی کنید"

8. **Confirmation Dialogs**:
   - برای اکشن‌های حساس (رد درخواست)
   - از show_alert=True استفاده کنید
"""

# ==================================================================
#  نکاتِ تکنیکی برای پیاده‌سازی
# ==================================================================

"""
🔧 چگونه یکپارچه کنید:

# در کدِ موجود، در تابعِ تایید درخواست (حدود خط ۲۵۰۰):
@dp.callback_query(F.data.startswith("join:approve:"))
async def cb_approve_join_request(callback: CallbackQuery):
    user_id = int(callback.data.split(":")[2])
    
    # تعیینِ نوعِ کاربر (از دیتابیسِ موجود)
    user_type = "normal"  # یا "vip" یا "gold"
    
    # تایید با بج
    await handle_approve_join_with_badge(callback, user_id, user_type)
    
    # حذفِ پیامِ قدیمی
    await callback.message.delete()
    
    # نمایشِ پیامِ تایید
    await callback.answer("✅ درخواست تایید شد!")


# برای صندوقِ ورودی در منوِ ادمین:
@dp.callback_query(F.data == "admin:inbox")
async def show_admin_inbox(callback: CallbackQuery):
    pending_count = len(_pending_join_requests)
    
    buttons = mobile_inbox_manager.create_compact_button_row(
        GROUP_CHAT_ID, pending_count
    )
    
    await callback.message.edit_text(
        text=f"📬 {pending_count} درخواستِ معلق",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[buttons])
    )
"""
