# 💡 مثال‌های عملی و کدِ قطعه‌ای

## 🎯 سناریو ۱: یک کاربر VIP درخواست عضویت می‌دهد

### مراحل سیستم:

```
1. کاربر درخواست ارسال می‌کند
   ↓
2. ادمین درخواست را می‌بیند
   ↓
3. ادمین دکمهٔ "تایید" رو می‌زند
   ↓
4. سیستم:
   ✓ نوعِ کاربر رو تعیین می‌کند: VIP
   ✓ تاپیک می‌سازد: "👑 علی حسینی"
   ✓ پیامِ VIP رو ارسال می‌کند
   ✓ درخواست رو پاک می‌کند
   ↓
5. صندوقِ ورودی آپدیت می‌شود
```

### کدِ مربوطه:

```python
# ۱️⃣ در تابعِ تایید درخواست:

@dp.callback_query(F.data.startswith("join:approve:"))
async def approve_join_request(callback: CallbackQuery, state: FSMContext):
    """تایید درخواست عضویت"""
    user_id = int(callback.data.split(":")[2])
    
    try:
        # ۲️⃣ تعیینِ نوعِ کاربر
        user_type = await get_user_type(user_id)  # "vip", "gold", "normal"
        
        # ۳️⃣ ایجادِ تاپیک با بج
        user = await bot.get_chat(user_id)
        full_name = user.full_name or user.username or "Member"
        
        topic_name = build_topic_name_with_badge(user_id, full_name, user_type)
        
        topic = await bot.create_forum_topic(
            chat_id=NOTIFY_CHAT_ID_INT,
            name=topic_name
        )
        topic_id = topic.message_thread_id
        
        # ۴️⃣ ارسالِ پیامِ شخصی‌سازی شدهٔ خوش‌آمد
        welcome_msg = custom_messages_manager.get_message(
            user_type=user_type,
            message_key="approval",
            user_id=user_id
        )
        
        await bot.send_message(
            chat_id=user_id,
            text=welcome_msg,
            parse_mode=ParseMode.HTML,
            message_effect_id=MESSAGE_EFFECT_PARTY_POPPER
        )
        
        # ۵️⃣ ارسالِ پیامِ خوش‌آمد در تاپیک
        topic_welcome = (
            f"👋 <b>{full_name} رو خوش آمد</b>\n\n"
            f"نوع عضویت: <b>{user_type.upper()}</b>\n"
            f"تاریخِ پیوستن: {format_jalali_datetime(datetime.utcnow())}"
        )
        
        await bot.send_message(
            chat_id=NOTIFY_CHAT_ID_INT,
            text=topic_welcome,
            message_thread_id=topic_id,
            parse_mode=ParseMode.HTML
        )
        
        # ۶️⃣ حذفِ درخواست قدیم
        await callback.message.delete()
        
        # ۷️⃣ آپدیتِ صندوقِ ورودی
        _pending_join_requests.pop(user_id, None)
        mobile_inbox_manager.cache_pending_count(
            GROUP_CHAT_ID,
            len(_pending_join_requests)
        )
        
        # ۸️⃣ پاسخِ کالبک
        await callback.answer(
            f"✅ درخواست {user_type.upper()} تایید شد!",
            show_alert=False
        )
        
    except Exception as e:
        logger.error(f"خطا در تایید درخواست: {e}")
        await callback.answer(
            "❌ خطایی رخ داد",
            show_alert=True
        )
```

---

## 🎯 سناریو ۲: ادمین صندوقِ ورودی رو باز می‌کند

### مراحل:

```
ادمین: /admin
    ↓
منو ظاهر می‌شود
    ↓
ادمین: "📬 صندوقِ ورودی (3)"
    ↓
لیستِ ۳ درخواستِ معلق
    ↓
ادمین روی یکی کلیک می‌کند
    ↓
جزئیاتِ درخواست + دکمه‌های تایید/رد
```

### کدِ مربوطه:

```python
# ۱️⃣ اضافه‌کردنِ دکمهٔ صندوق به منوِ ادمین:

@dp.callback_query(F.data == "admin:menu")
async def show_admin_menu(callback: CallbackQuery):
    """منوِ ادمین"""
    
    pending_count = len(_pending_join_requests)
    
    buttons = [
        [InlineKeyboardButton(
            text="📊 آمار",
            callback_data="admin:stats"
        )],
        [InlineKeyboardButton(
            text=f"📬 صندوقِ ورودی ({pending_count})",
            callback_data="admin:inbox"
        )],
        [InlineKeyboardButton(
            text="🎨 شخصی‌سازی پیام‌ها",
            callback_data="admin:customize_messages"
        )],
        [InlineKeyboardButton(
            text="⚙️ تنظیمات",
            callback_data="admin:settings"
        )],
        [InlineKeyboardButton(
            text="🔙 بازگشت",
            callback_data="menu:main"
        )],
    ]
    
    await callback.message.edit_text(
        text="⚙️ <b>منوِ ادمین</b>",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode=ParseMode.HTML
    )


# ۲️⃣ کالبکِ صندوقِ ورودی:

@dp.callback_query(F.data == "admin:inbox")
async def show_admin_inbox(callback: CallbackQuery):
    """نمایشِ صندوقِ ورودی"""
    
    pending_count = len(_pending_join_requests)
    
    if pending_count == 0:
        await callback.message.edit_text(
            text="✅ هیچ درخواستِ معلقی نیست!",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(
                    text="🔙 بازگشت",
                    callback_data="admin:menu"
                )]]
            )
        )
        await callback.answer("✨ تمام درخواست‌ها پردازش شدند!")
        return
    
    # ساختِ لیستِ درخواست‌ها
    buttons = []
    
    for idx, (uid, req_data) in enumerate(list(_pending_join_requests.items())[:5], 1):
        full_name = req_data.get("full_name", f"کاربر {uid}")
        
        buttons.append([InlineKeyboardButton(
            text=f"👤 {idx}. {full_name}",
            callback_data=f"inbox:details:{uid}"
        )])
    
    # دکمهٔ بیشتر
    if pending_count > 5:
        buttons.append([InlineKeyboardButton(
            text=f"➕ {pending_count - 5} درخواستِ دیگر",
            callback_data="inbox:page:2"
        )])
    
    buttons.append([InlineKeyboardButton(
        text="🔙 بازگشت",
        callback_data="admin:menu"
    )])
    
    await callback.message.edit_text(
        text=(
            f"📬 <b>صندوقِ ورودی</b>\n\n"
            f"تعدادِ درخواست‌های معلق: <b>{pending_count}</b>\n\n"
            f"لطفاً یکی رو انتخاب کنید:"
        ),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode=ParseMode.HTML
    )


# ۳️⃣ نمایشِ جزئیاتِ درخواست:

@dp.callback_query(F.data.startswith("inbox:details:"))
async def show_request_details(callback: CallbackQuery):
    """نمایشِ جزئیاتِ یک درخواست خاص"""
    
    user_id = int(callback.data.split(":")[-1])
    req_data = _pending_join_requests.get(user_id)
    
    if not req_data:
        await callback.answer("❌ درخواست یافت نشد", show_alert=True)
        return
    
    # استخراجِ اطلاعات
    full_name = req_data.get("full_name", "نامشناس")
    education = req_data.get("education", "نامشخص")
    referral = req_data.get("referral", "نامشخص")
    created_at = req_data.get("created_at", "نامشخص")
    
    # متنِ جزئیات
    details_text = (
        f"📋 <b>اطلاعاتِ درخواست</b>\n\n"
        f"👤 <b>نام:</b> {full_name}\n"
        f"🎓 <b>سطحِ تحصیلی:</b> {education}\n"
        f"📍 <b>نحوهٔ آشنایی:</b> {referral}\n"
        f"📅 <b>زمان:</b> {created_at}\n\n"
        f"<b>تصمیمِ خود رو بگیرید:</b>"
    )
    
    buttons = [
        [
            InlineKeyboardButton(
                text="✅ تایید",
                callback_data=f"inbox:approve:{user_id}"
            ),
            InlineKeyboardButton(
                text="❌ رد",
                callback_data=f"inbox:reject:{user_id}"
            )
        ],
        [InlineKeyboardButton(
            text="⏸ معلّق",
            callback_data=f"inbox:suspend:{user_id}"
        )],
        [InlineKeyboardButton(
            text="🔙 بازگشت",
            callback_data="admin:inbox"
        )]
    ]
    
    await callback.message.edit_text(
        text=details_text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode=ParseMode.HTML
    )


# ۴️⃣ اکشنِ تایید/رد:

@dp.callback_query(F.data.startswith("inbox:approve:"))
async def approve_from_inbox(callback: CallbackQuery):
    """تایید درخواست از صندوقِ ورودی"""
    user_id = int(callback.data.split(":")[-1])
    
    # استفاده از تابعِ تایید
    await approve_join_request_internal(user_id, callback)


@dp.callback_query(F.data.startswith("inbox:reject:"))
async def reject_from_inbox(callback: CallbackQuery):
    """رد درخواست از صندوقِ ورودی"""
    user_id = int(callback.data.split(":")[-1])
    
    reject_msg = custom_messages_manager.get_message(
        user_type="default",
        message_key="rejection",
        user_id=user_id
    )
    
    try:
        await bot.send_message(
            chat_id=user_id,
            text=reject_msg,
            parse_mode=ParseMode.HTML
        )
        
        _pending_join_requests.pop(user_id, None)
        
        # آپدیتِ صندوق
        mobile_inbox_manager.cache_pending_count(
            GROUP_CHAT_ID,
            len(_pending_join_requests)
        )
        
        await callback.answer("❌ درخواست رد شد", show_alert=False)
        await callback.message.delete()
        
    except Exception as e:
        logger.error(f"خطا در رد کردن: {e}")
        await callback.answer("❌ خطایی رخ داد", show_alert=True)
```

---

## 🎯 سناریو ۳: ادمین پیام‌های پیش‌فرض رو شخصی‌سازی می‌کند

### مراحل:

```
ادمین: /admin
    ↓
"🎨 شخصی‌سازی پیام‌ها"
    ↓
لیستِ پیام‌های قابل‌تغییر
    ↓
ادمین: "✏️ welcome"
    ↓
متنِ فعلی نمایش داده می‌شود
    ↓
ادمین متنِ جدید ارسال می‌کند
    ↓
"✅ پیام به‌روز شد!"
```

### کدِ مربوطه:

```python
# ۱️⃣ منوِ شخصی‌سازی:

@dp.callback_query(F.data == "admin:customize_messages")
async def customize_messages_menu(callback: CallbackQuery, state: FSMContext):
    """منوِ شخصی‌سازی پیام‌ها"""
    
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("❌ فقط ادمین‌ها", show_alert=True)
        return
    
    templates = custom_messages_manager.list_templates("default")
    
    # ترجمهٔ کلیدهای پیام
    message_labels = {
        "welcome": "🌱 خوش‌آمد",
        "approval": "✅ تایید درخواست",
        "rejection": "❌ رد درخواست",
        "pending": "⏳ درخواستِ معلق"
    }
    
    buttons = []
    for key, label in message_labels.items():
        if key in templates:
            buttons.append([InlineKeyboardButton(
                text=label,
                callback_data=f"customize:edit:{key}"
            )])
    
    buttons.append([InlineKeyboardButton(
        text="🔙 بازگشت",
        callback_data="admin:menu"
    )])
    
    await callback.message.edit_text(
        text="🎨 <b>شخصی‌سازی پیام‌های سیستم</b>\n\nلطفاً پیامی رو برای ویرایش انتخاب کنید:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode=ParseMode.HTML
    )
    
    await state.set_state(CustomMessageStates.choosing_template)


# ۲️⃣ شروعِ ویرایش:

@dp.callback_query(F.data.startswith("customize:edit:"))
async def start_edit_message(callback: CallbackQuery, state: FSMContext):
    """شروعِ ویرایشِ یک پیام"""
    
    message_key = callback.data.split(":")[-1]
    current_text = custom_messages_manager.get_message("default", message_key)
    
    message_labels = {
        "welcome": "پیامِ خوش‌آمد",
        "approval": "پیامِ تایید",
        "rejection": "پیامِ رد",
        "pending": "پیامِ درخواستِ معلق"
    }
    
    label = message_labels.get(message_key, message_key)
    
    await callback.message.edit_text(
        text=(
            f"✏️ <b>ویرایشِ {label}</b>\n\n"
            f"<b>متنِ فعلی:</b>\n\n"
            f"<code>{current_text}</code>\n\n"
            f"—\n\n"
            f"لطفاً متنِ جدید رو ارسال کنید:\n\n"
            f"<i>(می‌تونید از HTML استفاده کنید: &lt;b&gt;، &lt;i&gt;، &lt;code&gt;)</i>"
        ),
        parse_mode=ParseMode.HTML
    )
    
    await state.update_data(message_key=message_key)
    await state.set_state(CustomMessageStates.editing_message)


# ۳️⃣ دریافتِ متنِ جدید:

@dp.message(CustomMessageStates.editing_message)
async def receive_new_message(message: Message, state: FSMContext):
    """دریافت و ذخیرهٔ پیامِ جدید"""
    
    data = await state.get_data()
    message_key = data["message_key"]
    new_text = message.text
    
    # ۱. ذخیرهٔ پیام
    custom_messages_manager.data["default"][message_key] = new_text
    custom_messages_manager._persist()
    
    # ۲. تأیید
    await message.answer(
        text=(
            f"✅ <b>پیام به‌روز شد!</b>\n\n"
            f"<b>متنِ جدید:</b>\n<code>{new_text}</code>"
        ),
        parse_mode=ParseMode.HTML
    )
    
    # ۳. بازگشت به منو
    await state.clear()
    await asyncio.sleep(1)
    await message.answer(
        text="بازگشت به منوِ ادمین...",
    )


# ۴️⃣ تأیید دوباره (اختیاری):

@dp.callback_query(F.data == "customize:confirm")
async def confirm_message_edit(callback: CallbackQuery, state: FSMContext):
    """تأییدِ تغییراتِ نهایی"""
    
    data = await state.get_data()
    message_key = data["message_key"]
    
    # پیغام تأیید
    await callback.answer(
        f"✅ پیام '{message_key}' با موفقیت ذخیره شد!",
        show_alert=False
    )
    
    await state.clear()
```

---

## 🎯 سناریو ۴: سیستمِ User Type

### چگونه user_type را تعیین کنیم:

```python
async def get_user_type(user_id: int) -> str:
    """
    دریافت نوعِ کاربر بر اساس VIP subscription
    
    بازگشت‌ها:
    - "vip": اشتراک فعالِ VIP (۵۰۰۰+ تومان)
    - "gold": اشتراک فعالِ طلایی (۱۰۰۰+ تومان)
    - "normal": کاربرِ عادی
    """
    
    # بررسیِ دیتای VIP
    if VIP_SUBSCRIPTIONS_FILE.exists():
        try:
            vip_subs = json.loads(VIP_SUBSCRIPTIONS_FILE.read_text(encoding="utf-8"))
            
            if str(user_id) in vip_subs:
                sub = vip_subs[str(user_id)]
                
                # چک کنید که اشتراک فعال است
                if sub.get("status") == "active":
                    expire_date = sub.get("expire_date", "")
                    if expire_date and datetime.fromisoformat(expire_date) > datetime.utcnow():
                        amount = sub.get("amount", 0)
                        
                        # VIP: ۵۰۰۰ تومان
                        if amount >= 5000:
                            return "vip"
                        # طلایی: ۱۰۰۰ تومان
                        elif amount >= 1000:
                            return "gold"
        
        except Exception as e:
            logger.error(f"خطا در دریافتِ نوعِ کاربر: {e}")
    
    return "normal"


# استفادهٔ این تابع:

# مثال ۱:
user_type = await get_user_type(12345)
print(f"کاربر {12345} از نوع: {user_type}")  # Output: "vip" یا "gold" یا "normal"


# مثال ۲:
if user_type == "vip":
    emoji = "👑"
elif user_type == "gold":
    emoji = "⭐"
else:
    emoji = ""

topic_name = f"{emoji} علی حسینی" if emoji else "علی حسینی"
```

---

## 🎯 سناریو ۵: نمایشِ Badge در لیستِ اعضا

### اگر لیستِ اعضا داشته باشید:

```python
async def list_members_with_badges():
    """لیستِ اعضا با بج‌های ویژه"""
    
    members = []
    
    for user_id in get_all_member_ids():
        user_type = await get_user_type(user_id)
        user = await bot.get_chat(user_id)
        
        badge = USER_BADGES.get(user_type, "")
        
        if badge:
            member_text = f"{badge} {user.full_name}"
        else:
            member_text = user.full_name
        
        members.append(member_text)
    
    # نمایش
    await bot.send_message(
        chat_id=ADMIN_CHAT_ID,
        text="👥 <b>لیستِ اعضا</b>\n\n" + "\n".join(members),
        parse_mode=ParseMode.HTML
    )
```

---

## 📱 راهنمایی برای موبایل

### ✅ آنچه برای موبایل خوب است:
- ✅ دکمه‌های بزرگ
- ✅ ایموجی‌ها برای رنگ‌بندی
- ✅ متن کوتاه
- ✅ Pagination (صفحه‌بندی)

### ❌ آنچه برای موبایل بد است:
- ❌ متن‌های طولانی
- ❌ دکمه‌های کوچک در یک ردیف
- ❌ لیست‌های بلند بدون pagination
- ❌ inline keyboards پیچیده

### 💡 نکات عملی:

```python
# ❌ بد برای موبایل:
buttons = [[
    InlineKeyboardButton(text="۱", callback_data="1"),
    InlineKeyboardButton(text="۲", callback_data="2"),
    InlineKeyboardButton(text="۳", callback_data="3"),
    InlineKeyboardButton(text="۴", callback_data="4"),
]]  # دکمه‌ها خیلی کوچک هستند!


# ✅ خوب برای موبایل:
buttons = [
    [InlineKeyboardButton(text="1. گزینه‌ی اول 👍", callback_data="1")],
    [InlineKeyboardButton(text="2. گزینه‌ی دوم 👍", callback_data="2")],
    [InlineKeyboardButton(text="3. گزینه‌ی سوم 👍", callback_data="3")],
]  # هر دکمه در یک ردیف - راحت برای تاچ
```

---

🎉 **حالا می‌تونید شروع کنید!**

استفاده کنید از این مثال‌ها و آنها رو با کدِ اصلی خود ادغام کنید.
